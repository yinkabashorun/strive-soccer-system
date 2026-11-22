// Extra Work, picked by the player (Nov 22 2026). Coach Yinka: "when they
// ask for extra work it also needs to be a practical system where they can
// select drills."
//
// The one-tap shelves stay (composeExtraSession builds the session for
// them). This is the other way in: the player sees every filmed drill they
// can actually do, grouped by area, ticks 1 to EXTRA_PICK_MAX of them, and
// gets a session of exactly those drills in the order they tapped. Pure,
// so the list the player sees and the check the server runs are the same
// rule (tests/extra-pick.test.ts):
//
//   - pickable = active, filmed, fits the player (drillFitsPlayer: wall,
//     goal, a few yards, course drills only when the coach offered them),
//     never a plyo (the warm-up is always ours to add)
//   - the warm-up is added first, every time, as on every session
//   - strength drills can be picked; they always sit last (a finisher is
//     always last). When the player's note requires strengthening and
//     they picked none, one finisher is added for them
//   - the server never trusts the list it is sent: every id is checked
//     against this same rule, duplicates and over-cap lists are refused

import { drillPoster } from "./drill-poster";
import { stripLabel } from "./courses";
import { drillFitsPlayer, extraFinisher, extraWarmUp, type PlayerEnv, type StrengthMode } from "./bank-conform";
import { PLYO_PILLAR, STRENGTH_PILLAR, type Drill } from "./types";

// The most drills one picked session holds, warm-up and any added
// finisher not counted. One constant, the coach's to change.
export const EXTRA_PICK_MAX = 6;

// The areas a player picks from, in the order they are shown, with the
// names a player would use. Every bank pillar except the plyo warm-up.
export const PICK_GROUPS: { key: string; label: string; pillar: string }[] = [
  { key: "ball_mastery", label: "Ball mastery", pillar: "Ball Mastery" },
  { key: "weak_foot", label: "Weak foot", pillar: "Weak Foot" },
  { key: "one_v_one", label: "1v1 moves", pillar: "Confidence" },
  { key: "passing", label: "Passing", pillar: "Passing" },
  { key: "shooting", label: "Shooting", pillar: "Shooting" },
  { key: "scanning", label: "Scanning", pillar: "Scanning" },
  { key: "decisions", label: "Decision making", pillar: "Decision Making" },
  { key: "speed", label: "Speed", pillar: "Speed" },
  { key: "strength", label: "Strength", pillar: STRENGTH_PILLAR },
];

export type PickRow = {
  id: string;
  title: string; // the drill's own name, without the bank's label prefix
  minutes: number;
  poster: string | null; // a still for clips on our own domain, else none
  doneBefore: boolean;
};

export type PickGroup = { key: string; label: string; drills: PickRow[] };

export function isPickable(d: Drill, env: PlayerEnv | null | undefined): boolean {
  if (d.active === false) return false;
  if (!d.video_url) return false;
  if (d.pillar === PLYO_PILLAR) return false;
  if (!PICK_GROUPS.some((g) => g.pillar === d.pillar)) return false;
  return drillFitsPlayer(d, env);
}

// What the player sees: every drill they can pick, grouped, in the bank's
// own order inside each group; a group with nothing in it is left out.
export function pickGroups(
  bank: Drill[],
  env: PlayerEnv | null | undefined,
  doneDrillIds: ReadonlySet<string> = new Set()
): PickGroup[] {
  const pickable = bank.filter((d) => isPickable(d, env));
  return PICK_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    drills: pickable
      .filter((d) => d.pillar === g.pillar)
      .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title))
      .map((d) => ({
        id: d.id,
        title: stripLabel(d.title),
        minutes: d.minutes,
        poster: drillPoster(d.video_url),
        doneBefore: doneDrillIds.has(d.id),
      })),
  })).filter((g) => g.drills.length > 0);
}

export type PickCheck = { ok: true; drills: Drill[] } | { ok: false; error: string };

// The server's check of what the player sent. Order is the tap order.
export function checkPicks(raw: unknown, bank: Drill[], env: PlayerEnv | null | undefined): PickCheck {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "Pick at least one drill." };
  if (raw.length > EXTRA_PICK_MAX) {
    return { ok: false, error: `Pick up to ${EXTRA_PICK_MAX} drills for one session.` };
  }
  if (!raw.every((x) => typeof x === "string" && x.length > 0 && x.length <= 64)) {
    return { ok: false, error: "Pick your drills again." };
  }
  const ids = raw as string[];
  if (new Set(ids).size !== ids.length) return { ok: false, error: "Pick each drill once." };
  const byId = new Map(bank.map((d) => [d.id, d]));
  const drills: Drill[] = [];
  for (const id of ids) {
    const d = byId.get(id);
    if (!d || !isPickable(d, env)) {
      return { ok: false, error: "One of those drills is not available to you right now. Pick again." };
    }
    drills.push(d);
  }
  return { ok: true, drills };
}

// The session, in the order it is trained: the warm-up, the skill drills
// as tapped, the strength drills as tapped, then the finisher we add when
// one is required and none was picked.
export function composePickedSession(opts: {
  bank: Drill[];
  player: PlayerEnv | null | undefined;
  picks: unknown;
  doneTitles: string[]; // every title the player has completed, most recent first
  weekTitles: string[]; // every title in this week's plan
  strength?: StrengthMode;
}): { ok: true; drills: Drill[] } | { ok: false; error: string } {
  const check = checkPicks(opts.picks, opts.bank, opts.player);
  if (!check.ok) return check;
  const skills = check.drills.filter((d) => d.pillar !== STRENGTH_PILLAR);
  const strength = check.drills.filter((d) => d.pillar === STRENGTH_PILLAR);
  const warmUp = extraWarmUp(opts.bank, opts.weekTitles);
  const finisher =
    opts.strength === "required" && strength.length === 0
      ? extraFinisher(opts.bank, opts.player, opts.doneTitles, opts.weekTitles)
      : null;
  return {
    ok: true,
    drills: [...(warmUp ? [warmUp] : []), ...skills, ...strength, ...(finisher ? [finisher] : [])],
  };
}

// The line under the picker's button, so the player knows what we add
// around their drills before they tap it.
export function pickBookendsLine(opts: { warmUp: boolean; finisherAdded: boolean }): string {
  if (opts.warmUp && opts.finisherAdded) return "We add a warm-up first and a strength finisher last.";
  if (opts.warmUp) return "We add a warm-up first.";
  if (opts.finisherAdded) return "We add a strength finisher last.";
  return "";
}

export function pickButtonLabel(count: number): string {
  if (count <= 0) return "Pick a drill";
  return count === 1 ? "Add 1 drill" : `Add ${count} drills`;
}
