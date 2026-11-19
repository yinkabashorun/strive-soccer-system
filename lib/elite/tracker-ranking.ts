// This week's club ranking (the free app, migration 069): every club of
// three or more, ranked by the average training a member logged this
// week. It is the one read in the free app that looks across all players,
// and what leaves this file is club names and averages only: no player's
// name, no member list, no player's own minutes. Players are still only
// ever ranked next to their friends.
import { createServiceClient } from "./supabase/server";
import type { Viewer } from "./session";
import { clubRanking, weekOf, type RankingRow } from "./tracker";

const PAGE = 1000;

export async function clubRankingFor(viewer: Viewer, today: string): Promise<RankingRow[]> {
  if (viewer.demo) return demoRanking();
  const admin = createServiceClient();
  if (!admin) return [];

  type Club = { id: string; name: string };
  type Member = { club_id: string; profile_id: string };
  type Log = { profile_id: string; minutes: number };
  async function every<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown }>): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data } = await page(from, from + PAGE - 1);
      const batch = (data as T[] | null) ?? [];
      out.push(...batch);
      if (batch.length < PAGE) return out;
    }
  }

  const { monday, sunday } = weekOf(today);
  const [clubs, members, logs] = await Promise.all([
    every<Club>((from, to) =>
      admin.from("elite_tracker_clubs").select("id, name").is("archived_at", null).order("id").range(from, to)
    ),
    every<Member>((from, to) =>
      admin.from("elite_tracker_club_members").select("club_id, profile_id").order("club_id").order("profile_id").range(from, to)
    ),
    every<Log>((from, to) =>
      admin
        .from("elite_training_logs")
        .select("profile_id, minutes")
        .eq("kind", "training")
        .gte("trained_on", monday)
        .lte("trained_on", sunday)
        .order("id")
        .range(from, to)
    ),
  ]);
  const memberIds = new Map<string, string[]>();
  for (const m of members) memberIds.set(m.club_id, [...(memberIds.get(m.club_id) ?? []), m.profile_id]);
  const weekMinutes = new Map<string, number>();
  for (const l of logs) weekMinutes.set(l.profile_id, (weekMinutes.get(l.profile_id) ?? 0) + l.minutes);
  const mine = new Set(members.filter((m) => m.profile_id === viewer.profile.id).map((m) => m.club_id));

  return clubRanking({
    clubs: clubs.map((c) => ({ id: c.id, name: c.name, memberIds: memberIds.get(c.id) ?? [] })),
    weekMinutes,
    myClubIds: mine,
  });
}

// The example account's ranking: club names and averages, nothing else.
function demoRanking(): RankingRow[] {
  return clubRanking({
    clubs: [
      { id: "r1", name: "Strive Elite 5v5: Team 3", memberIds: ["a", "b", "c"] },
      { id: "demo-club-1", name: "Strive Elite 5v5: Team 7", memberIds: ["d", "e", "f", "g"] },
      { id: "r2", name: "Loudoun 2009 Pre-ECNL", memberIds: ["h", "i", "j"] },
      { id: "demo-club-2", name: "Bull Run 2010s", memberIds: ["k", "l", "m"] },
      { id: "r3", name: "Saturday Pickup", memberIds: ["n", "o", "p"] },
    ],
    weekMinutes: new Map(
      Object.entries({ a: 260, b: 220, c: 190, d: 200, e: 180, f: 150, g: 130, h: 170, i: 160, j: 90, k: 120, l: 75, m: 60, n: 80, o: 40, p: 30 })
    ),
    myClubIds: new Set(["demo-club-1", "demo-club-2"]),
  });
}
