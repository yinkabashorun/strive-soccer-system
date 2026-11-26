// Reads what the launch numbers are counted from and hands it to the one
// calculator (lib/elite/launch-numbers.ts). Coach side only: a player's
// session, the example tour and a signed-out visitor all get nothing. It
// only reads; no row anywhere is changed.
//
// It reads across every free account, so every read is a page at a time
// (lib/elite/supabase/every-row.ts), in an order that never ties. A read
// that fails ends the whole thing with nothing: the card is left off the
// page rather than drawn from part of a table.
//
// What it reads:
//   elite_trackers              profile_id, created_at, avatar_path
//   elite_profiles              id, avatar_path, username
//   elite_training_logs         profile_id, trained_on, kind, proof,
//                               ended_at, created_at
//   elite_tracker_clubs         id, name, archived_at
//   elite_tracker_club_members  club_id, profile_id
//   elite_tracker_friends       a, b
import { getViewer } from "./session";
import { createServiceClient } from "./supabase/server";
import { everyRow } from "./supabase/every-row";
import { launchNumbers, type LaunchNumbers } from "./launch-numbers";
import type { Kind } from "./tracker";
import { TYPED, type Proof } from "./training-clock";

type Page = PromiseLike<{ data: unknown; error?: unknown }>;

export async function getLaunchNumbers(): Promise<LaunchNumbers | null> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || viewer.role === "player") return null;
  const admin = createServiceClient();
  if (!admin) return null;

  // everyRow keeps what came before a failed page. Here part of a table
  // is worse than none, so a failed page is remembered and ends the read.
  let failed = false;
  const every = <T>(page: (from: number, to: number) => Page) =>
    everyRow<T>(async (from, to) => {
      const result = await page(from, to);
      if (result.error) failed = true;
      return result;
    });

  type AccountRow = { profile_id: string; created_at: string; avatar_path: string | null };
  type ProfileRow = { id: string; avatar_path: string | null; username: string | null };
  type LogRow = {
    profile_id: string;
    trained_on: string;
    kind: Kind;
    proof: Proof | null;
    ended_at: string | null;
    created_at: string;
  };
  type ClubRow = { id: string; name: string; archived_at: string | null };
  type MemberRow = { club_id: string; profile_id: string };
  type PairRow = { a: string; b: string };

  const [accounts, profiles, logs, clubs, members, pairs] = await Promise.all([
    every<AccountRow>((from, to) =>
      admin.from("elite_trackers").select("profile_id, created_at, avatar_path").order("profile_id").range(from, to)
    ),
    every<ProfileRow>((from, to) =>
      admin.from("elite_profiles").select("id, avatar_path, username").order("id").range(from, to)
    ),
    every<LogRow>((from, to) =>
      admin
        .from("elite_training_logs")
        .select("profile_id, trained_on, kind, proof, ended_at, created_at")
        .eq("kind", "training") // gym is its own count, never a board's
        .neq("proof", TYPED) // typed time counts on the player's own week only
        .order("id")
        .range(from, to)
    ),
    every<ClubRow>((from, to) =>
      admin.from("elite_tracker_clubs").select("id, name, archived_at").order("id").range(from, to)
    ),
    every<MemberRow>((from, to) =>
      admin.from("elite_tracker_club_members").select("club_id, profile_id").order("club_id").order("profile_id").range(from, to)
    ),
    every<PairRow>((from, to) =>
      admin.from("elite_tracker_friends").select("a, b").order("a").order("b").range(from, to)
    ),
  ]);
  if (failed) return null;

  const profileOf = new Map(profiles.map((p) => [p.id, p]));
  return launchNumbers(
    {
      accounts: accounts.map((a) => {
        const p = profileOf.get(a.profile_id);
        return {
          id: a.profile_id,
          joinedAt: a.created_at,
          // The one profile photo of an account (081); an account from
          // before it may still hold its pointer on its free-app row.
          hasPhoto: Boolean(p?.avatar_path || a.avatar_path),
          hasUsername: Boolean(p?.username),
        };
      }),
      logs: logs.map((l) => ({
        profileId: l.profile_id,
        day: l.trained_on,
        // A timed session is posted the moment its finish photo is taken,
        // even when the phone had no signal and sent it later.
        at: l.ended_at ?? l.created_at,
        kind: l.kind,
        proof: l.proof,
      })),
      clubs: clubs.map((c) => ({ id: c.id, name: c.name, archived: Boolean(c.archived_at) })),
      members: members.map((m) => ({ clubId: m.club_id, profileId: m.profile_id })),
      friendships: pairs,
    },
    new Date()
  );
}
