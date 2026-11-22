// The example account's drills (the free app's tour). Two drills the
// example player named, with takes spread over weeks. The footage is the
// bank's own drill demos on our domain standing in for a player's phone
// clips, and the counts are example numbers. Nothing here is saved.
import type { MyDrill, Take } from "./my-drills";

const daysAgo = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

type DemoDrill = MyDrill & { list: Take[] };

function drill(id: string, name: string, list: Take[]): DemoDrill {
  const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return {
    id,
    name,
    start_take_id: null,
    takes: sorted.length,
    first_at: sorted[0]?.created_at ?? null,
    latest_at: sorted[sorted.length - 1]?.created_at ?? null,
    list: sorted,
  };
}

export const DEMO_DRILL_ID = "00000000-0000-4000-8000-00000000d001";

export function demoDrills(): DemoDrill[] {
  return [
    drill(DEMO_DRILL_ID, "Weak foot juggles", [
      { id: "00000000-0000-4000-8000-0000000000a1", created_at: daysAgo(52), count: 9, url: "/drills/juggling-one-touch-catch.mp4" },
      { id: "00000000-0000-4000-8000-0000000000a2", created_at: daysAgo(45), count: 14, url: "/drills/juggling-one-touch-keep-it-up.mp4" },
      { id: "00000000-0000-4000-8000-0000000000a3", created_at: daysAgo(31), count: 19, url: "/drills/juggling-one-two-keep-it-up.mp4" },
      { id: "00000000-0000-4000-8000-0000000000a4", created_at: daysAgo(17), count: 26, url: "/drills/juggling-two-touches-each-foot-keep-it-up.mp4" },
      { id: "00000000-0000-4000-8000-0000000000a5", created_at: daysAgo(3), count: 34, url: "/drills/weak-foot-pop-and-juggle.mp4" },
    ]),
    drill("00000000-0000-4000-8000-00000000d002", "Inside, outside touches", [
      { id: "00000000-0000-4000-8000-0000000000b1", created_at: daysAgo(20), count: null, url: "/drills/weak-foot-outside-pull-inside-pull.mp4" },
      { id: "00000000-0000-4000-8000-0000000000b2", created_at: daysAgo(6), count: null, url: "/drills/weak-foot-tap-pull-push.mp4" },
    ]),
  ];
}
