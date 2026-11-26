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
  // the button that uses an earned month: "Start my month" for a free
  // player, "Make my next month free" for a player who pays by card
  start: string;
  // one line for a player who pays: their next month is free
  note: string | null;
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

// A PLAYER WHO ALREADY PAYS (Coach Yinka, Nov 26 2026: "a paying member
// should get their next month free"). Before this the same card promised
// them a month of the membership they already had, and Start my month
// refused. Now three teammates who train make their NEXT MONTH FREE: the
// month's price is put on their account as a credit and their next charge
// is nothing (lib/elite/pro-server.ts creditNextMonth). Same teammates,
// same count, same six months at most.
export const SQUAD_PAID_TITLE = `Bring ${TEAMMATES_PER_PASS} teammates. Your next month is free.`;
export const SQUAD_PAID_READY_TITLE = "You earned a free month.";
export const SQUAD_PAID_READY_BODY = `Three teammates trained. Tap below and your next month of ${PRO_PRODUCT_NAME} costs nothing.`;
export const SQUAD_PAID_START = "Make my next month free";
export const SQUAD_PAID_NOTE = `Your next month of ${PRO_PRODUCT_NAME} is free.`;
// a paid membership that is set to stop: the month waits, and starts the
// usual way once the paid one has ended
export const SQUAD_KEPT_UNTIL_END = `Your earned month is kept. Start it when your paid month of ${PRO_PRODUCT_NAME} ends.`;
// how long the "next month is free" line stays after the tap: one billing
// month, by which time the free charge has gone through
export const PAID_NOTE_DAYS = 31;

// WHAT BRINGING THREE TEAMMATES EARNS, by who the player is. One rule, so
// the card can never again promise a player something they cannot use:
//   "month"            a free player, or one on an earned month: a month of
//                      Strive Pro, started with a tap
//   "next_month_free"  pays for Strive Pro by card: their next month is free
//   "none"             already has the app with nothing to pay (lifetime
//                      access, or a membership the coaches switched on):
//                      there is nothing to give them, so nothing is promised
export type SquadPrize = "month" | "next_month_free" | "none";

export function squadPrize(i: { memberOn: boolean; earnedMonthRunning: boolean; paysByCard: boolean }): SquadPrize {
  if (!i.memberOn || i.earnedMonthRunning) return "month";
  return i.paysByCard ? "next_month_free" : "none";
}

export const SQUAD_NO_PRIZE_TITLE = "Bring your teammates.";
export const SQUAD_NO_PRIZE_BODY = "Every teammate who trains makes your friends board and your club stronger.";

export function paidNote(creditedAt: readonly (string | null | undefined)[], now: Date): string | null {
  const recent = creditedAt.some((at) => {
    const t = at ? new Date(at).getTime() : NaN;
    return Number.isFinite(t) && now.getTime() - t < PAID_NOTE_DAYS * 24 * 60 * 60 * 1000;
  });
  return recent ? SQUAD_PAID_NOTE : null;
}

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
  // what three teammates earn this player (squadPrize); a free player's
  // month when left out
  prize?: SquadPrize;
  // the "next month is free" line (paidNote), for a player who pays
  note?: string | null;
}): Squad {
  const counted = i.trained.length;
  const prize = i.prize ?? "month";
  const paying = prize === "next_month_free";
  // with nothing to give, nothing is "ready": an earned month is kept on
  // the account and the card only shows who has trained
  const ready = prize === "none" ? 0 : i.passes.filter((p) => !p.started).length;
  if (prize === "none") {
    return {
      slots: squadSlots(i.trained, i.joined, counted),
      ready,
      runningUntil: null,
      title: SQUAD_NO_PRIZE_TITLE,
      body: SQUAD_NO_PRIZE_BODY,
      waiting: waitingLine(i.joined),
      canEarnMore: true,
      start: SQUAD_START,
      note: null,
    };
  }
  return {
    slots: squadSlots(i.trained, i.joined, counted),
    ready,
    runningUntil: i.runningUntil,
    title: paying ? (ready > 0 ? SQUAD_PAID_READY_TITLE : SQUAD_PAID_TITLE) : ready > 0 ? SQUAD_READY_TITLE : SQUAD_TITLE,
    body: ready > 0 ? (paying ? SQUAD_PAID_READY_BODY : SQUAD_READY_BODY) : SQUAD_BODY,
    waiting: waitingLine(i.joined),
    canEarnMore: passesEarned(counted) < PASS_MAX,
    start: paying ? SQUAD_PAID_START : SQUAD_START,
    note: paying ? (i.note ?? null) : null,
  };
}
