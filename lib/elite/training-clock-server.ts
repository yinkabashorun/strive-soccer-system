// The training clock, on the server (lib/elite/training-clock.ts has the
// rules). Two things happen here:
//
//   1. hearClockStart: the phone says "a clock just started". The server
//      keeps WHEN IT HEARD that, one row per player (089). It is what lets
//      the server measure the session with its own clock.
//   2. saveClockPost: the finish. Both photos arrive together with the
//      phone's times; the server works out how long the session counts
//      (settleClock), refuses one that overlaps training already timed,
//      stores the two photos and writes ONE entry with proof 'clock'.
//
// The entry's id is worked out from the player and the start, so the same
// finish sent twice (a retry on weak signal) writes one entry. NOT server
// actions: called only by the app's clock routes, with the signed-in
// account's id and photos the route already checked.
import { createHash } from "node:crypto";
import { createServiceClient } from "./supabase/server";
import { POST_BUCKET, limitHit, postPath, startPhotoPath, type Kind } from "./tracker";
import { lessApplied, settleClock, type ClockRefusal } from "./training-clock";

type Admin = NonNullable<ReturnType<typeof createServiceClient>>;

// A stable uuid for (player, start): the same two always give the same id.
export function clockLogId(profileId: string, phoneStartedMs: number): string {
  const h = createHash("sha256").update(`strive-clock:${profileId}:${phoneStartedMs}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// The New York day an instant falls on, as the week reads days.
export function nyDayOf(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

type SeenRow = { phone_started_ms: number | string; ago_seconds: number; seen_at: string };

// "A clock just started." Kept once per start: a second word about the
// SAME start (a retry) never replaces the first, which is the one that
// may have been live. A new start replaces an old one. Best effort: a
// clock the server never heard of still counts, by the phone's own time.
export async function hearClockStart(profileId: string, phoneStartedMs: number, agoSeconds: number): Promise<boolean> {
  try {
    const admin = createServiceClient();
    if (!admin) return false;
    const { data } = await admin.from("elite_training_clocks").select("phone_started_ms").eq("profile_id", profileId).maybeSingle();
    if (data && Number((data as { phone_started_ms: number | string }).phone_started_ms) === phoneStartedMs) return true;
    const { error } = await admin.from("elite_training_clocks").upsert(
      { profile_id: profileId, phone_started_ms: phoneStartedMs, ago_seconds: Math.max(0, Math.round(agoSeconds)), seen_at: new Date().toISOString() },
      { onConflict: "profile_id" }
    );
    return !error;
  } catch {
    return false;
  }
}

// The clock was stopped without posting: nothing is kept.
export async function forgetClock(profileId: string): Promise<void> {
  try {
    const admin = createServiceClient();
    if (admin) await admin.from("elite_training_clocks").delete().eq("profile_id", profileId);
  } catch {
    /* a row left behind is replaced by the next start */
  }
}

async function seenFor(admin: Admin, profileId: string, phoneStartedMs: number): Promise<{ atMs: number; agoSeconds: number } | null> {
  const { data } = await admin.from("elite_training_clocks").select("phone_started_ms, ago_seconds, seen_at").eq("profile_id", profileId).maybeSingle();
  const row = data as SeenRow | null;
  if (!row || Number(row.phone_started_ms) !== phoneStartedMs) return null;
  const atMs = Date.parse(row.seen_at);
  return Number.isFinite(atMs) ? { atMs, agoSeconds: row.ago_seconds } : null;
}

export type ClockSaved =
  | { ok: true; id: string; minutes: number; fresh: boolean }
  | { ok: false; reason: ClockRefusal | "overlap" | "day_cap" | "error" };

export async function saveClockPost(input: {
  profileId: string;
  kind: Kind;
  caption: string | null;
  startPhoto: Uint8Array;
  finishPhoto: Uint8Array;
  times: { started: number; ended: number; sent: number }; // the phone's own clock, in ms
  // minutes the player took OFF ("finished before I took this photo")
  less?: number;
  weekTarget: number | null;
  nowMs?: number;
}): Promise<ClockSaved> {
  const admin = createServiceClient();
  if (!admin) return { ok: false, reason: "error" };
  const id = clockLogId(input.profileId, input.times.started);
  const finishPath = postPath(input.profileId, id);
  const startPath = startPhotoPath(input.profileId, id);
  if (!finishPath || !startPath) return { ok: false, reason: "error" };

  // the same finish sent again (the first answer never reached the phone)
  const { data: already } = await admin.from("elite_training_logs").select("id, minutes").eq("id", id).eq("profile_id", input.profileId).maybeSingle();
  if (already) return { ok: true, id, minutes: (already as { minutes: number }).minutes, fresh: false };

  const seen = await seenFor(admin, input.profileId, input.times.started).catch(() => null);
  const settled = settleClock({
    nowMs: input.nowMs ?? Date.now(),
    phoneStartedMs: input.times.started,
    phoneEndedMs: input.times.ended,
    phoneSentMs: input.times.sent,
    seen,
  });
  if (!settled.ok) return { ok: false, reason: settled.reason };
  // the server's own count, less what the player took off: never more
  const minutes = lessApplied(settled.minutes, input.less ?? 0);
  const startedAt = new Date(settled.startedAtMs).toISOString();
  const endedAt = new Date(settled.endedAtMs).toISOString();

  // one stretch of time is trained once: no second timed session inside it
  const { data: clash, error: clashError } = await admin
    .from("elite_training_logs")
    .select("id")
    .eq("profile_id", input.profileId)
    .eq("proof", "clock")
    .lt("started_at", endedAt)
    .gt("ended_at", startedAt)
    .limit(1);
  if (clashError) return { ok: false, reason: "error" };
  if (clash?.length) return { ok: false, reason: "overlap" };

  // the photos first, then the entry that points at them
  const put = (path: string, bytes: Uint8Array) => admin.storage.from(POST_BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  const [a, b] = await Promise.all([put(startPath, input.startPhoto), put(finishPath, input.finishPhoto)]);
  const takeBack = () => admin.storage.from(POST_BUCKET).remove([startPath, finishPath]).catch(() => undefined);
  if (a.error || b.error) {
    await takeBack();
    return { ok: false, reason: "error" };
  }
  const { error } = await admin.from("elite_training_logs").insert({
    id,
    profile_id: input.profileId,
    trained_on: nyDayOf(settled.endedAtMs),
    minutes,
    kind: input.kind,
    photo_path: finishPath,
    start_photo_path: startPath,
    caption: input.caption,
    proof: "clock",
    started_at: startedAt,
    ended_at: endedAt,
    week_target: input.weekTarget || null,
  });
  if (error) {
    // 23505: the same finish landed twice at once. The other one wrote it.
    if (String(error.code ?? "") === "23505") return { ok: true, id, minutes, fresh: false };
    await takeBack();
    return { ok: false, reason: limitHit(error) === "day_cap" ? "day_cap" : "error" };
  }
  await forgetClock(input.profileId);
  return { ok: true, id, minutes, fresh: true };
}
