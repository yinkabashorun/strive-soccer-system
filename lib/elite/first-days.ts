// YOUR FIRST DAYS (Nov 24 2026), the free app's short list for a new
// player, as pure rules. It copies the one finding every leader in this
// space reports: a new person who posts, connects with friends and joins a
// group in their first days is far more likely to still be training months
// later (docs/growth/leaders-2026-11-24.md, section 7).
//
// Four things, each one tap from the list. It shows for a player's first
// FIRST_DAYS days and is gone for good the moment all four are done, or the
// days are up, or the player hides it. Nothing is ever shown as late or
// missed, and nothing here asks anybody to pay.

export const FIRST_DAYS = 14;
export const FIRST_FRIENDS = 3;

export type FirstStepKey = "post" | "friends" | "club" | "props";
export type FirstStep = { key: FirstStepKey; label: string; note: string | null; done: boolean };
export type FirstDays = { title: string; steps: FirstStep[]; done: number; total: number };

export const FIRST_DAYS_TITLE = "Your first days";
export const FIRST_DAYS_HIDE = "Hide this list";
// kept on the device only: a per-viewer convenience, never a record
export const FIRST_DAYS_HIDDEN_KEY = "strive_first_days_hidden";

export type FirstFacts = {
  joinedAt: string | null; // when the free account was made
  posted: boolean; // a training photo, ever
  friends: number; // accepted friends
  clubs: number; // clubs the player is on
  gaveProps: boolean; // props given to a friend's post, ever
};

function daysSince(joinedAt: string | null, now: number): number | null {
  if (!joinedAt) return null;
  const t = new Date(joinedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 86_400_000);
}

export function firstDays(facts: FirstFacts, now: number): FirstDays | null {
  const age = daysSince(facts.joinedAt, now);
  if (age === null || age < 0 || age >= FIRST_DAYS) return null;
  const friends = Math.max(0, Math.floor(facts.friends));
  const steps: FirstStep[] = [
    { key: "post", label: "Post your first training", note: null, done: facts.posted },
    {
      key: "friends",
      label: `Add ${FIRST_FRIENDS} friends`,
      note: friends > 0 && friends < FIRST_FRIENDS ? `${friends} of ${FIRST_FRIENDS}` : null,
      done: friends >= FIRST_FRIENDS,
    },
    { key: "club", label: "Join a club or start one", note: null, done: facts.clubs > 0 },
    { key: "props", label: "Give a friend props", note: null, done: facts.gaveProps },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return { title: FIRST_DAYS_TITLE, steps, done, total: steps.length };
}
