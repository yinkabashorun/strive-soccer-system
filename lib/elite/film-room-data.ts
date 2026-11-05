import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";
import { createServiceClient } from "./supabase/server";
import { CLIP_BUCKET } from "./clips";
import { bookableSlots, monthKeyNY } from "./film-room";
import type { CheckinDay, CheckinSlot, FilmRoom, FilmRoomClip } from "./types";

// Readers for the Film Room and the check-in days (062). Everything reads
// with the service client after the page's own viewer check: players
// cannot read other members' rows, and the coach pages are coach-only.
// Never served from Next's data cache, so a link or a time the coaches
// just changed shows on the next load.

function admin(): SupabaseClient | null {
  noStore();
  return createServiceClient();
}

const FILM_ROOM_GRACE_MS = 3 * 3_600_000; // a room stays "this week's" for 3h after it starts

// The next announced Film Room a member should see: the earliest one that
// has not finished yet.
export async function getNextFilmRoom(now = Date.now()): Promise<FilmRoom | null> {
  const db = admin();
  if (!db) return null;
  const { data, error } = await db
    .from("elite_film_rooms")
    .select("*")
    .not("announced_at", "is", null)
    .gte("scheduled_at", new Date(now - FILM_ROOM_GRACE_MS).toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1);
  if (error || !data || data.length === 0) return null; // 062 not applied yet
  return data[0] as FilmRoom;
}

export async function getPlayerFilmRoomClips(playerId: string, roomId: string): Promise<FilmRoomClip[]> {
  const db = admin();
  if (!db) return [];
  const { data, error } = await db
    .from("elite_film_room_clips")
    .select("*")
    .eq("player_id", playerId)
    .eq("film_room_id", roomId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data as FilmRoomClip[] | null) ?? [];
}

export type FilmRoomWithClips = FilmRoom & {
  clips: (FilmRoomClip & { player_name: string })[];
};

// Coach page: the upcoming rooms and the last eight, with every member's
// clips and one-hour signed links.
export async function getFilmRoomsForCoach(): Promise<FilmRoomWithClips[]> {
  const db = admin();
  if (!db) return [];
  const { data: rooms, error } = await db
    .from("elite_film_rooms")
    .select("*")
    .order("scheduled_at", { ascending: false })
    .limit(12);
  if (error || !rooms) return [];
  const list = rooms as FilmRoom[];
  if (list.length === 0) return [];

  const { data: clips } = await db
    .from("elite_film_room_clips")
    .select("*, elite_players(full_name)")
    .in("film_room_id", list.map((r) => r.id))
    .order("created_at", { ascending: true });
  type Raw = FilmRoomClip & { elite_players: { full_name: string } | { full_name: string }[] | null };
  const raw = (clips as Raw[] | null) ?? [];

  const paths = raw.map((c) => c.clip_path);
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await db.storage.from(CLIP_BUCKET).createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
  }

  return list
    .map((r) => ({
      ...r,
      clips: raw
        .filter((c) => c.film_room_id === r.id)
        .map((c) => {
          const p = Array.isArray(c.elite_players) ? c.elite_players[0] : c.elite_players;
          return { ...c, player_name: p?.full_name ?? "Member", url: urlByPath.get(c.clip_path) ?? null };
        }),
    }))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
}

export type CheckinDayWithSlots = CheckinDay & {
  slots: (CheckinSlot & { player_name: string | null })[];
};

export async function getCheckinDaysForCoach(now = Date.now()): Promise<CheckinDayWithSlots[]> {
  const db = admin();
  if (!db) return [];
  const { data: days, error } = await db
    .from("elite_checkin_days")
    .select("*")
    .gte("ends_at", new Date(now - 7 * 86_400_000).toISOString())
    .order("starts_at", { ascending: true });
  if (error || !days) return [];
  const list = days as CheckinDay[];
  if (list.length === 0) return [];
  const { data: slots } = await db
    .from("elite_checkin_slots")
    .select("*, elite_players(full_name)")
    .in("day_id", list.map((d) => d.id))
    .order("starts_at", { ascending: true });
  type Raw = CheckinSlot & { elite_players: { full_name: string } | { full_name: string }[] | null };
  const raw = (slots as Raw[] | null) ?? [];
  return list.map((d) => ({
    ...d,
    slots: raw
      .filter((s) => s.day_id === d.id)
      .map((s) => {
        const p = Array.isArray(s.elite_players) ? s.elite_players[0] : s.elite_players;
        return { ...s, player_name: p?.full_name ?? null };
      }),
  }));
}

export type PlayerCheckin = {
  booked: { slot: CheckinSlot; day: CheckinDay } | null; // the next booked, upcoming call
  open: { slot: CheckinSlot; day: CheckinDay }[]; // what this player may still book
};

// The player's own view: the call they hold and the slots they may book
// (open, in the future, in a month they have no call).
export async function getPlayerCheckin(playerId: string, now = Date.now()): Promise<PlayerCheckin> {
  const empty: PlayerCheckin = { booked: null, open: [] };
  const db = admin();
  if (!db) return empty;
  const { data: days, error } = await db
    .from("elite_checkin_days")
    .select("*")
    .gte("ends_at", new Date(now).toISOString())
    .order("starts_at", { ascending: true });
  if (error || !days || days.length === 0) return empty;
  const dayList = days as CheckinDay[];
  const dayById = new Map(dayList.map((d) => [d.id, d]));

  const { data: slots } = await db
    .from("elite_checkin_slots")
    .select("*")
    .in("day_id", dayList.map((d) => d.id))
    .order("starts_at", { ascending: true });
  const all = (slots as CheckinSlot[] | null) ?? [];

  // Months already held count even when that call is on a past day that
  // has dropped out of the day list above.
  const { data: held } = await db
    .from("elite_checkin_slots")
    .select("starts_at, month_key")
    .eq("player_id", playerId);
  const bookedMonths = ((held as { starts_at: string; month_key: string | null }[] | null) ?? []).map(
    (h) => h.month_key ?? monthKeyNY(h.starts_at)
  );

  const mine = all
    .filter((s) => s.player_id === playerId && new Date(s.starts_at).getTime() > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const booked = mine && dayById.get(mine.day_id) ? { slot: mine, day: dayById.get(mine.day_id)! } : null;

  const open = bookableSlots(all, bookedMonths, now)
    .map((slot) => ({ slot, day: dayById.get(slot.day_id)! }))
    .filter((x) => x.day);
  return { booked, open };
}
