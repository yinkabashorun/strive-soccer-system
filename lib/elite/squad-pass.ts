// BRING YOUR SQUAD (Nov 24 2026, Coach Yinka: "take deep thought on the
// best referral loops we can implement and do exactly that").
//
// The players are 13 to 21 and most cannot pay for themselves. So the
// strongest loop lets a player pay with what they do have, teammates:
//
//   3 teammates who join with your link and post their first training
//   = a month of Strive Pro, no card.
//
// Why this shape:
//   - a teammate counts only once they TRAIN (a photo post), not when they
//     sign up. A made-up account earns nothing, and the player has a reason
//     to get each teammate to their first post, which is the moment the
//     free app starts working for the teammate too.
//   - the reward is the paid product itself. A month of weeks built around
//     them is what makes a player (and the parent watching) want to keep it.
//   - it can be earned again: every three more teammates is another month.
//   - when an earned month ends the account is a free account again, with
//     its log, friends and clubs untouched (lib/elite/member-gate.ts).
//
// The second loop sits beside it: "Send to a parent" (lib/elite/
// parent-link.ts), because the player is not the one who pays.
//
// Pure: no database here. The numbers are Coach Yinka's to change, one
// constant each. Tested in tests/squad-pass.test.ts.
import { TIER_LABEL } from "./tiers";

// The paid membership's name, from the one pure place that names each
// membership (pro.ts holds the same word but reaches Stripe, which the
// phone must not load; a test holds the two equal).
const PRO_PRODUCT_NAME = TIER_LABEL.pro;

export const TEAMMATES_PER_PASS = 3;
export const PASS_DAYS = 30;
// An account can earn this many months in all (18 teammates who train).
export const PASS_MAX = 6;

// Months earned for a number of teammates who trained.
export function passesEarned(counted: number): number {
  return Math.min(PASS_MAX, Math.floor(Math.max(0, counted) / TEAMMATES_PER_PASS));
}

export type SquadPerson = { id: string; name: string };
export type SquadSlot = { state: "trained" | "joined" | "open"; name: string | null };

// The three places toward the NEXT month: teammates who trained and have
// not been used for a month yet, then teammates who joined and have not
// posted, then the open places.
export function squadSlots(trained: readonly SquadPerson[], joined: readonly SquadPerson[], counted: number): SquadSlot[] {
  const used = passesEarned(counted) * TEAMMATES_PER_PASS;
  const slots: SquadSlot[] = trained.slice(used, used + TEAMMATES_PER_PASS).map((p) => ({ state: "trained", name: p.name }));
  for (const p of joined) {
    if (slots.length >= TEAMMATES_PER_PASS) break;
    slots.push({ state: "joined", name: p.name });
  }
  while (slots.length < TEAMMATES_PER_PASS) slots.push({ state: "open", name: null });
  return slots;
}

// When a month that is started now runs to. One already running is carried
// on from its end, never cut short.
export function passEndsAt(now: Date, runningUntil: Date | null): Date {
  const from = runningUntil && runningUntil.getTime() > now.getTime() ? runningUntil : now;
  return new Date(from.getTime() + PASS_DAYS * 24 * 60 * 60 * 1000);
}

export type Squad = {
  slots: SquadSlot[];
  // months earned and not started yet
  ready: number;
  // an earned month that is running: the day it runs to, as words
  runningUntil: string | null;
  title: string;
  body: string;
  // the line under the places when a teammate joined and has not posted
  waiting: string | null;
  // null once every month an account can earn has been earned
  canEarnMore: boolean;
};

export const SQUAD_TITLE = `Bring ${TEAMMATES_PER_PASS} teammates. Get a month of ${PRO_PRODUCT_NAME}.`;
export const SQUAD_BODY = "A teammate counts when they join with your link and post their first training.";
export const SQUAD_READY_TITLE = `You earned a month of ${PRO_PRODUCT_NAME}.`;
export const SQUAD_READY_BODY = `Three teammates trained. Start it when you are ready: your weeks are built around you for ${PASS_DAYS} days. No card.`;
export const SQUAD_START = "Start my month";
export const SQUAD_SEND = "Send my link";
export const SQUAD_NOT_READY = "There is no earned month to start yet.";
export const SQUAD_ALREADY_MEMBER = `You already have ${PRO_PRODUCT_NAME}. Your earned month is kept for later.`;
export const SQUAD_FAILED = "We could not start your month. Try again in a minute.";

export function waitingLine(joined: readonly SquadPerson[]): string | null {
  if (joined.length === 0) return null;
  const first = joined[0].name;
  if (joined.length === 1) return `${first} joined. They count once they post their first training.`;
  return `${first} and ${joined.length - 1} more joined. Each counts once they post their first training.`;
}

export function runningLine(until: string): string {
  return `Your earned month of ${PRO_PRODUCT_NAME} runs until ${until}.`;
}

export function buildSquad(i: {
  trained: readonly SquadPerson[];
  joined: readonly SquadPerson[];
  passes: readonly { started: boolean; running: boolean }[];
  runningUntil: string | null;
}): Squad {
  const counted = i.trained.length;
  const ready = i.passes.filter((p) => !p.started).length;
  return {
    slots: squadSlots(i.trained, i.joined, counted),
    ready,
    runningUntil: i.runningUntil,
    title: ready > 0 ? SQUAD_READY_TITLE : SQUAD_TITLE,
    body: ready > 0 ? SQUAD_READY_BODY : SQUAD_BODY,
    waiting: waitingLine(i.joined),
    canEarnMore: passesEarned(counted) < PASS_MAX,
  };
}
