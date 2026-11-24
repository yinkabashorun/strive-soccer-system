// This week's club ranking (the free app, migration 069): every club of
// three or more, ranked by the average training a member logged this
// week. It is the one read in the free app that looks across all players,
// and what leaves this file is club names and averages only: no player's
// name, no member list, no player's own minutes. Players are still only
// ever ranked next to their friends.
import { createServiceClient } from "./supabase/server";
import { everyRow } from "./supabase/every-row";
import type { Viewer } from "./session";
import { clubRanking, rankedClubCount, weekOf, type ClubRankingView } from "./tracker";

export async function clubRankingFor(viewer: Viewer, today: string): Promise<ClubRankingView> {
  if (viewer.demo) return demoRanking();
  const admin = createServiceClient();
  if (!admin) return { rows: [], total: 0 };

  type Club = { id: string; name: string };
  type Member = { club_id: string; profile_id: string };
  type Log = { profile_id: string; minutes: number };
  const every = everyRow;

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

  const input = clubs.map((c) => ({ id: c.id, name: c.name, memberIds: memberIds.get(c.id) ?? [] }));
  return { rows: clubRanking({ clubs: input, weekMinutes, myClubIds: mine }), total: rankedClubCount(input) };
}

// The example account's ranking: club names and averages, nothing else.
function demoRanking(): ClubRankingView {
  const club = (id: string, name: string, size: number, average: number) => ({ id, name, size, average });
  const list = [
    club("r1", "Strive Elite 5v5: Team 12", 9, 242),
    club("r2", "Strive Elite 5v5: Team 3", 9, 223),
    club("demo-club-1", "Strive Elite 5v5: Team 7", 5, 165),
    club("r3", "2010 Boys", 8, 140),
    club("demo-club-2", "Bull Run 2010s", 3, 85),
    club("r4", "Saturday Pickup", 11, 50),
  ];
  const weekMinutes = new Map<string, number>();
  const clubs = list.map((c) => {
    const memberIds = [...Array(c.size).keys()].map((i) => `${c.id}-${i}`);
    for (const m of memberIds) weekMinutes.set(m, c.average);
    return { id: c.id, name: c.name, memberIds };
  });
  const rows = clubRanking({ clubs, weekMinutes, myClubIds: new Set(["demo-club-1", "demo-club-2"]) });
  return { rows, total: 24 };
}
