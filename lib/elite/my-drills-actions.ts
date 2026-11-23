"use server";

// My drills, the writes (078). The free player's own drills and takes,
// written with the service client after the ownership check, like every
// free table (069). The video itself goes up from the phone into the
// player's own folder (the storage policy in 078 allows only that); the
// row is written here only once the path is theirs and the file is there.
// The example account saves nothing.
import { revalidatePath } from "next/cache";
import { createServiceClient } from "./supabase/server";
import { getViewer } from "./session";
import { trackerFor } from "./tracker-server";
import { FREE_WEEK, POST_BUCKET } from "./tracker";
import {
  DRILL_CAP_MESSAGE,
  FREE_DRILLS,
  TAKE_CAP_MESSAGE,
  TAKE_TOO_LONG,
  cleanCount,
  isUuid,
  ownsTakePath,
  takeLengthOk,
} from "./my-drills";
import { demoDrills } from "./my-drills-demo";
import { cleanDrillName } from "./my-drills-name";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
const OFFLINE = "We could not reach the server. Try again in a minute.";
const NOT_THERE = "That is not there any more.";
const COUNT_LINE = "A count is a whole number from 0 to 999, or leave it empty.";

type Admin = NonNullable<ReturnType<typeof createServiceClient>>;
type Owner = { kind: "no"; error: string } | { kind: "demo" } | { kind: "ok"; admin: Admin; profileId: string };

async function owner(): Promise<Owner> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "player") return { kind: "no", error: "Sign in first." };
  const tracker = await trackerFor(viewer);
  if (!tracker) return { kind: "no", error: "My drills are part of the free app." };
  if (viewer.demo) return { kind: "demo" };
  const admin = createServiceClient();
  if (!admin) return { kind: "demo" };
  return { kind: "ok", admin, profileId: viewer.profile.id };
}

function touch(drillId?: string) {
  revalidatePath(FREE_DRILLS);
  revalidatePath(FREE_WEEK);
  if (drillId) revalidatePath(`${FREE_DRILLS}/${drillId}`);
}

function capError(message: string | undefined): string | null {
  if (!message) return null;
  if (message.includes("drill_cap")) return DRILL_CAP_MESSAGE;
  if (message.includes("take_cap")) return TAKE_CAP_MESSAGE;
  return null;
}

async function ownDrill(admin: Admin, profileId: string, drillId: unknown): Promise<string | null> {
  if (!isUuid(drillId)) return null;
  const { data } = await admin
    .from("elite_tracker_drills")
    .select("id")
    .eq("id", drillId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return data ? (data as { id: string }).id : null;
}

// The chips on the posting screen: the player's drill names.
// profileId names the player's own folder for the upload; null for the
// example account, which films nothing.
export async function myDrillNames(): Promise<
  { ok: true; profileId: string | null; drills: { id: string; name: string }[] } | Fail
> {
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") return { ok: true, profileId: null, drills: demoDrills().map((d) => ({ id: d.id, name: d.name })) };
  const { data, error } = await o.admin
    .from("elite_tracker_drills")
    .select("id, name")
    .eq("profile_id", o.profileId)
    .order("created_at", { ascending: false });
  if (error) return fail(OFFLINE);
  return { ok: true, profileId: o.profileId, drills: (data as { id: string; name: string }[] | null) ?? [] };
}

export async function createDrill(rawName: string): Promise<{ ok: true; id: string } | Fail> {
  const named = cleanDrillName(rawName);
  if (!named.ok) return fail(named.error);
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") return { ok: true, id: demoDrills()[0].id };
  const { data, error } = await o.admin
    .from("elite_tracker_drills")
    .insert({ profile_id: o.profileId, name: named.name })
    .select("id")
    .single();
  if (error || !data) return fail(capError(error?.message) ?? OFFLINE);
  touch();
  return { ok: true, id: (data as { id: string }).id };
}

export async function renameDrill(drillId: string, rawName: string): Promise<{ ok: true } | Fail> {
  const named = cleanDrillName(rawName);
  if (!named.ok) return fail(named.error);
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") return { ok: true };
  if (!(await ownDrill(o.admin, o.profileId, drillId))) return fail(NOT_THERE);
  const { error } = await o.admin
    .from("elite_tracker_drills")
    .update({ name: named.name, updated_at: new Date().toISOString() })
    .eq("id", drillId)
    .eq("profile_id", o.profileId);
  if (error) return fail(OFFLINE);
  touch(drillId);
  return { ok: true };
}

// A drill and every take in it: the videos first, then the rows.
export async function deleteDrill(drillId: string): Promise<{ ok: true } | Fail> {
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") return { ok: true };
  if (!(await ownDrill(o.admin, o.profileId, drillId))) return fail(NOT_THERE);
  const { data } = await o.admin
    .from("elite_tracker_takes")
    .select("clip_path")
    .eq("drill_id", drillId)
    .eq("profile_id", o.profileId);
  const paths = ((data as { clip_path: string }[] | null) ?? [])
    .map((r) => r.clip_path)
    .filter((p) => ownsTakePath(p, o.profileId));
  if (paths.length > 0) await o.admin.storage.from(POST_BUCKET).remove(paths).catch(() => undefined);
  const { error } = await o.admin.from("elite_tracker_drills").delete().eq("id", drillId).eq("profile_id", o.profileId);
  if (error) return fail(OFFLINE);
  touch();
  return { ok: true };
}

// A take the phone just uploaded: into an existing drill, or a new drill
// named on the spot (the posting screen's "New drill").
export async function saveTake(input: {
  drillId?: string | null;
  newDrillName?: string | null;
  takeId: string;
  path: string;
  count?: number | string | null;
  seconds?: number | null;
}): Promise<{ ok: true; drillId: string } | Fail> {
  const count = cleanCount(input.count);
  if (count === undefined) return fail(COUNT_LINE);
  const seconds = typeof input.seconds === "number" && Number.isFinite(input.seconds) ? input.seconds : null;
  if (seconds !== null && !takeLengthOk(seconds)) return fail(TAKE_TOO_LONG);
  if (!isUuid(input.takeId)) return fail(NOT_THERE);
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") return { ok: true, drillId: input.drillId && isUuid(input.drillId) ? input.drillId : demoDrills()[0].id };
  if (!ownsTakePath(input.path, o.profileId, input.takeId)) return fail("That video isn't yours.");

  // The file has to be there: the phone uploads before it asks.
  const { data: files } = await o.admin.storage
    .from(POST_BUCKET)
    .list(o.profileId, { search: `take-${input.takeId}` });
  if (!files || files.length === 0) return fail("Your video did not finish going up. Try again.");

  let drillId = await ownDrill(o.admin, o.profileId, input.drillId);
  if (!drillId) {
    if (!input.newDrillName) return fail("Pick a drill for this take.");
    const made = await createDrill(input.newDrillName);
    if (!made.ok) return made;
    drillId = made.id;
  }
  const { error } = await o.admin.from("elite_tracker_takes").insert({
    id: input.takeId,
    drill_id: drillId,
    profile_id: o.profileId,
    clip_path: input.path,
    count,
    seconds: seconds === null ? null : Math.round(seconds * 100) / 100,
  });
  if (error) {
    await o.admin.storage.from(POST_BUCKET).remove([input.path]).catch(() => undefined);
    return fail(capError(error.message) ?? OFFLINE);
  }
  touch(drillId);
  return { ok: true, drillId };
}

async function ownTake(admin: Admin, profileId: string, takeId: unknown) {
  if (!isUuid(takeId)) return null;
  const { data } = await admin
    .from("elite_tracker_takes")
    .select("id, drill_id, clip_path")
    .eq("id", takeId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return (data as { id: string; drill_id: string; clip_path: string } | null) ?? null;
}

export async function deleteTake(takeId: string): Promise<{ ok: true } | Fail> {
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") return { ok: true };
  const take = await ownTake(o.admin, o.profileId, takeId);
  if (!take) return fail(NOT_THERE);
  if (ownsTakePath(take.clip_path, o.profileId)) {
    await o.admin.storage.from(POST_BUCKET).remove([take.clip_path]).catch(() => undefined);
  }
  const { error } = await o.admin.from("elite_tracker_takes").delete().eq("id", take.id).eq("profile_id", o.profileId);
  if (error) return fail(OFFLINE);
  touch(take.drill_id);
  return { ok: true };
}

// "Set as starting take": which take Then and now and the reel count
// from. Null puts it back on the first take.
export async function setStartTake(drillId: string, takeId: string | null): Promise<{ ok: true } | Fail> {
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") return { ok: true };
  if (!(await ownDrill(o.admin, o.profileId, drillId))) return fail(NOT_THERE);
  if (takeId !== null) {
    const take = await ownTake(o.admin, o.profileId, takeId);
    if (!take || take.drill_id !== drillId) return fail(NOT_THERE);
  }
  const { error } = await o.admin
    .from("elite_tracker_drills")
    .update({ start_take_id: takeId, updated_at: new Date().toISOString() })
    .eq("id", drillId)
    .eq("profile_id", o.profileId);
  if (error) return fail(OFFLINE);
  touch(drillId);
  return { ok: true };
}

export async function setTakeCount(takeId: string, rawCount: number | string | null): Promise<{ ok: true } | Fail> {
  const count = cleanCount(rawCount);
  if (count === undefined) return fail(COUNT_LINE);
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") return { ok: true };
  const take = await ownTake(o.admin, o.profileId, takeId);
  if (!take) return fail(NOT_THERE);
  const { error } = await o.admin.from("elite_tracker_takes").update({ count }).eq("id", take.id).eq("profile_id", o.profileId);
  if (error) return fail(OFFLINE);
  touch(take.drill_id);
  return { ok: true };
}
