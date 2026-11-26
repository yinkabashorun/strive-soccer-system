// EVERY STRIVE PRO MEMBER HAS THE WHOLE APP: the server side of
// getsFreeApp (lib/elite/one-app.ts has the rule and why).
//
// A Strive Pro member with no free account behind them gets one made
// here, once, the first time the app's API or the website's member shell
// reads who they are. From then on they are exactly a free player who
// upgraded: Train, Friends, Week, Clubs, You.
//
// What the row holds: their own code to share (drawn like everyone's),
// the season their member quiz gave (how often their team trains), and
// the coaches' own weekly target for that season, theirs to change from
// Week. No grade is known, so gym stays off until they say; no quiz of
// the free app is asked of them (they answered the member's).
//
// The row itself is made by the free account's own server file
// (lib/elite/tracker-server.ts makeTrackerForMember), the only place that
// writes that table.
import { getTargetTable, makeTrackerForMember, type Tracker } from "./tracker-server";
import { recommendation, type Season } from "./tracker";
import { getsFreeApp } from "./one-app";

type MemberRow = {
  tier?: string | null;
  subscription_status?: string | null;
  onboarded_at?: string | null;
  age?: number | null;
  training_load?: string | null;
};

export function seasonOfMember(load: string | null | undefined): Season {
  return load === "off_season" ? "off_season" : "in_season";
}

export async function ensureFreeApp(profileId: string, player: MemberRow | null): Promise<Tracker | null> {
  if (
    !player ||
    !getsFreeApp({
      tier: player.tier,
      status: player.subscription_status,
      onboarded: Boolean(player.onboarded_at),
      age: player.age,
    })
  ) {
    return null;
  }
  try {
    const season = seasonOfMember(player.training_load);
    const target = recommendation(await getTargetTable().catch(() => []), season).minutes;
    return await makeTrackerForMember(profileId, season, target);
  } catch {
    // a member is never kept out of Train because this could not be made
    return null;
  }
}
