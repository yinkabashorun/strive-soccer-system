// My drills, read on the server (078). Every read is for the signed-in
// free player's OWN drills: the functions take the viewer and read by
// viewer.profile.id only, so nothing here can hand one player's takes to
// another. The friends feed and profiles never call this file (held by a
// source check in tests/my-drills.test.ts). Takes are played through
// short-lived signed addresses made here, for the owner alone.
import { createServiceClient } from "./supabase/server";
import type { Viewer } from "./session";
import { POST_BUCKET, POST_URL_SECONDS } from "./tracker";
import { trackerFor } from "./tracker-server";
import { demoDrills } from "./my-drills-demo";
import { byDate, type MyDrill, type Take } from "./my-drills";

export type DrillWithTakes = MyDrill & { list: Take[] };

type TakeRow = { id: string; drill_id: string; clip_path: string; count: number | null; seconds: number | null; created_at: string };

// Is this viewer a free player who may have drills? (Members and coaches
// never reach the free app; the layout already sends them away.)
async function freeOwner(viewer: Viewer | null): Promise<"demo" | "real" | null> {
  if (!viewer || viewer.role !== "player") return null;
  const tracker = await trackerFor(viewer);
  if (!tracker) return null;
  return viewer.demo ? "demo" : "real";
}

export async function myDrillsFor(viewer: Viewer | null): Promise<MyDrill[]> {
  const who = await freeOwner(viewer);
  if (!who) return [];
  if (who === "demo") return demoDrills().map(({ list: _list, ...d }) => d);
  const admin = createServiceClient();
  if (!admin) return [];
  const [{ data: drills }, { data: takes }] = await Promise.all([
    admin
      .from("elite_tracker_drills")
      .select("id, name, start_take_id, created_at")
      .eq("profile_id", viewer!.profile.id)
      .order("created_at", { ascending: false }),
    admin.from("elite_tracker_takes").select("drill_id, created_at").eq("profile_id", viewer!.profile.id),
  ]);
  const byDrill = new Map<string, string[]>();
  for (const t of (takes as { drill_id: string; created_at: string }[] | null) ?? []) {
    byDrill.set(t.drill_id, [...(byDrill.get(t.drill_id) ?? []), t.created_at]);
  }
  return ((drills as { id: string; name: string; start_take_id: string | null }[] | null) ?? []).map((d) => {
    const dates = (byDrill.get(d.id) ?? []).sort();
    return {
      id: d.id,
      name: d.name,
      start_take_id: d.start_take_id,
      takes: dates.length,
      first_at: dates[0] ?? null,
      latest_at: dates[dates.length - 1] ?? null,
    };
  });
}

// One of the viewer's own drills with every take, each with a signed
// address, oldest first. Null when it is not theirs or not there.
export async function myDrillFor(viewer: Viewer | null, drillId: string): Promise<DrillWithTakes | null> {
  const who = await freeOwner(viewer);
  if (!who) return null;
  if (who === "demo") return demoDrills().find((d) => d.id === drillId) ?? null;
  const admin = createServiceClient();
  if (!admin) return null;
  const { data: drill } = await admin
    .from("elite_tracker_drills")
    .select("id, name, start_take_id")
    .eq("id", drillId)
    .eq("profile_id", viewer!.profile.id)
    .maybeSingle();
  if (!drill) return null;
  const { data } = await admin
    .from("elite_tracker_takes")
    .select("id, drill_id, clip_path, count, seconds, created_at")
    .eq("drill_id", drillId)
    .eq("profile_id", viewer!.profile.id)
    .order("created_at", { ascending: true });
  const rows = (data as TakeRow[] | null) ?? [];
  const urls = new Map<string, string>();
  if (rows.length > 0) {
    const { data: signed } = await admin.storage
      .from(POST_BUCKET)
      .createSignedUrls(
        rows.map((r) => r.clip_path),
        POST_URL_SECONDS
      );
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  const list = byDate(
    rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      count: r.count,
      seconds: r.seconds === null ? null : Number(r.seconds),
      url: urls.get(r.clip_path) ?? null,
    }))
  );
  const d = drill as { id: string; name: string; start_take_id: string | null };
  return {
    id: d.id,
    name: d.name,
    start_take_id: d.start_take_id,
    takes: list.length,
    first_at: list[0]?.created_at ?? null,
    latest_at: list[list.length - 1]?.created_at ?? null,
    list,
  };
}
