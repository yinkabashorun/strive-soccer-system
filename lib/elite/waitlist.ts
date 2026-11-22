// THE WAITLIST FOR THE FREE APP (migration 075). Pure rules, no I/O, so
// the join route, the /join page, the coach card and the tests all read
// the same numbers and the same words.
//
// While free sign-up is closed (069's switch at /coach/free), /join is the
// waitlist. A player 13 or older leaves a name, a phone and, if they want,
// who they play for. They get their own link (/join?w=CODE) to send to
// teammates, one text with that link, and one more text when the app
// opens. Bringing FIRST_GROUP_AT teammates puts them in the first group
// the coaches let in. Nobody is ranked against anybody: a player sees only
// their own count.

import { cleanPlayingFor, cleanReferralCode, newReferralCode } from "./tracker";

export const FIRST_GROUP_AT = 3; // teammates who join with your link
export const WAITLIST_COOKIE = "strive_waitlist"; // the row id, httpOnly, this device only
export const WAITLIST_PARAM = "w"; // /join?w=CODE

export const cleanWaitlistCode = (raw: unknown): string | null => cleanReferralCode(raw);
export const newWaitlistCode = newReferralCode;

export function waitlistLink(appUrl: string, code: string): string {
  return `${appUrl.replace(/\/+$/, "")}/join?${WAITLIST_PARAM}=${code}`;
}

// A US number with its area code, as E.164; anything else is refused.
export function waitlistPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && /^[2-9]/.test(digits)) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1") && /^[2-9]/.test(digits.slice(1))) return `+${digits}`;
  return null;
}

const text = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

export type WaitlistStep = "name" | "phone" | "team";
export type WaitlistProblem = { step: WaitlistStep; message: string };

export const WAITLIST_NAME_MESSAGE = "Enter your first and last name.";
export const WAITLIST_PHONE_MESSAGE = "Enter a US phone number with the area code, 10 digits.";
export const WAITLIST_TEAM_MESSAGE = "Up to 40 letters, with no links and nothing offensive.";
export const WAITLIST_EXISTS_MESSAGE =
  "That number is already on the list. Your link is in the text we sent you.";

// The same rule on the form (each screen before Next) and on the server.
export function waitlistProblem(
  input: { firstName?: unknown; lastName?: unknown; phone?: unknown; team?: unknown },
  only?: WaitlistStep
): WaitlistProblem | null {
  const check = (s: WaitlistStep) => !only || only === s;
  if (check("name")) {
    const first = text(input.firstName);
    const last = text(input.lastName);
    if (!first || !last) return { step: "name", message: WAITLIST_NAME_MESSAGE };
    if (first.length > 60 || last.length > 60)
      return { step: "name", message: "Your first and last name can be 60 letters each at most." };
    if (/https?:|www\.|\.com\b/i.test(first + " " + last)) return { step: "name", message: WAITLIST_NAME_MESSAGE };
  }
  if (check("phone") && !waitlistPhone(input.phone)) return { step: "phone", message: WAITLIST_PHONE_MESSAGE };
  if (check("team")) {
    const team = text(input.team);
    if (team && !cleanPlayingFor(team)) return { step: "team", message: WAITLIST_TEAM_MESSAGE };
  }
  return null;
}

export type WaitlistFields = { firstName: string; lastName: string; phone: string; team: string | null };

export function cleanWaitlist(input: Parameters<typeof waitlistProblem>[0]): WaitlistFields | null {
  if (waitlistProblem(input)) return null;
  const team = text(input.team);
  return {
    firstName: text(input.firstName),
    lastName: text(input.lastName),
    phone: waitlistPhone(input.phone) as string,
    team: team ? cleanPlayingFor(team) : null,
  };
}

// Where the visit came from, for the coach's list: "5v5", "ig", a short
// word only. Anything else is dropped.
export function cleanSource(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(s) ? s : null;
}

// ---- What the player sees after joining ---------------------------------

export function inFirstGroup(teammates: number): boolean {
  return teammates >= FIRST_GROUP_AT;
}

// "1 of 3 teammates joined", then the line for the first group.
export function teammatesLine(teammates: number): string {
  if (inFirstGroup(teammates)) {
    return teammates === FIRST_GROUP_AT
      ? `${FIRST_GROUP_AT} teammates joined with your link. You're in the first group.`
      : `${teammates} teammates joined with your link. You're in the first group.`;
  }
  return `${teammates} of ${FIRST_GROUP_AT} teammates joined with your link.`;
}

export const WAITLIST_HEADLINE = "You're on the list";
export const WAITLIST_ASK = `Bring ${FIRST_GROUP_AT} teammates and you're in the first group we let in.`;
export const WAITLIST_TEXT_LINE = "We text you the moment the app opens.";

// The last four digits only, for "we text you at ... 0100".
export function maskedPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `the number ending in ${digits.slice(-4)}` : "your number";
}

// ---- The two texts ----------------------------------------------------
// To a player (13 or older) who asked for them. Plain, no sign-off, no
// emoji, one forward-looking close; both stay well under one long SMS.

export function welcomeText(first: string, link: string): string {
  return (
    `You're on the Strive app list, ${first}. ` +
    `Bring ${FIRST_GROUP_AT} teammates with your link and you're in the first group we let in: ${link} ` +
    `We'll text you when it opens. Reply STOP to stop these texts.`
  );
}

export function openText(first: string, joinUrl: string): string {
  return `${first}, the Strive app is open and you're in. Make your account here: ${joinUrl} Let's get to work.`;
}

// How many to text per tap on the coach card, so one tap never runs past
// the server's time limit; the card says how many are left.
export const INVITE_BATCH = 40;

export type WaitlistRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  team: string | null;
  code: string;
  referred_by: string | null;
  invited_at: string | null;
  created_at: string;
};

// Teammates each row brought, by code.
export function teammateCounts(rows: Pick<WaitlistRow, "referred_by">[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) if (r.referred_by) out.set(r.referred_by, (out.get(r.referred_by) ?? 0) + 1);
  return out;
}

// Who gets the "app is open" text on a tap: never anyone already texted;
// the first group before everyone else, oldest sign-up first.
export function inviteOrder(
  rows: WaitlistRow[],
  who: "first_group" | "everyone",
  limit = INVITE_BATCH
): WaitlistRow[] {
  const counts = teammateCounts(rows);
  return rows
    .filter((r) => !r.invited_at)
    .filter((r) => who === "everyone" || inFirstGroup(counts.get(r.code) ?? 0))
    .sort((a, b) => {
      const g = Number(inFirstGroup(counts.get(b.code) ?? 0)) - Number(inFirstGroup(counts.get(a.code) ?? 0));
      return g || a.created_at.localeCompare(b.created_at);
    })
    .slice(0, limit);
}

// ---- What being on the list gets you (Coach Yinka, Nov 22 2026) -------
// Three perks, all real and all delivered by the coaches: the pickup
// head start (the text below), the 5v5 team graphic and club, and the
// first Strive Stars. Shown on /join and on /5v5 from these lines only.

export const PICKUP_HEAD_START_HOURS = 48;

export const WAITLIST_PERKS: readonly { title: string; line: string }[] = [
  {
    title: "Pickup sign-up first",
    line: `The list gets every Strive pickup sign-up ${PICKUP_HEAD_START_HOURS} hours before we post it anywhere else.`,
  },
  {
    title: "Your 5v5 team, in the rollout",
    line: "Get your whole 5v5 roster on the list and your team gets its own graphic in the 5v5 social rollout, and starts in the app as a club on day one.",
  },
  {
    title: "The first Strive Stars",
    line: "The standout players at the 5v5 who are on the list get the first Strive Stars in the app.",
  },
];

// The one line on the welcome screen, before they join.
export const WAITLIST_LANDING_LINE = ` Get on the list: pickup sign-up ${PICKUP_HEAD_START_HOURS} hours before anyone else, and we text you the moment the app opens.`;

// Only an https link of a sensible length can go out in a text.
export function cleanPickupLink(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (s.length > 300 || /\s/.test(s)) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

export function pickupText(first: string, link: string): string {
  return (
    `${first}, Strive pickup sign-up is open to the list first. ` +
    `You have ${PICKUP_HEAD_START_HOURS} hours before we post it anywhere else: ${link} ` +
    `Lock your spot. Reply STOP to stop these texts.`
  );
}

// Who gets a pickup link on a tap: everyone not yet sent this exact
// link, oldest sign-up first, one batch at a time.
export function pickupOrder<R extends Pick<WaitlistRow, "id" | "created_at"> & { pickup_link: string | null }>(
  rows: R[],
  link: string,
  limit = INVITE_BATCH
): R[] {
  return rows
    .filter((r) => r.pickup_link !== link)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, limit);
}

export const OPEN_FIRST_MESSAGE =
  "Open free sign-up first. Until it is open, the link in the text shows the waitlist again.";
