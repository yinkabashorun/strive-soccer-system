// Strive Elite 5v5, Mon Dec 21 2026 at SoFive Columbia (Coach Yinka,
// Nov 13 and Nov 19 2026). The page at /5v5 reads every fact and the
// price from here, so the poster, the caption and the page cannot drift.
//
// Price rule, his words (Nov 19): "early bird payment at 450", then
// corrected the same day: "November 26th is when the 550 starts. Final
// deadline December 5". So: $450 a team for any payment before Thu Nov
// 26 2026 00:00 ET, $550 from that moment, and registration closes at the
// end of Sat Dec 5 ET (or earlier, when the team cap fills; the cap is
// counted by hand: Registration = payment, a team is in once paid).
import { nyLocalToIso } from "@/lib/elite/film-room";

export const FIVE_V_FIVE = {
  name: "Strive Elite 5v5",
  dateLabel: "Monday, December 21",
  shortDate: "Mon, Dec 21",
  venue: "SoFive Columbia",
  prize: 3000,
  teams: 32, // Coach Yinka, Nov 19 (was 16)
  minGroupGames: 3, // every team plays at least three group games
  coverage: "@yslofficial", // the event is picked up by YSL Official
  earlyBird: 450,
  standard: 550,
  // Early bird ends the instant Dec 2 starts in New York (moved from
  // Nov 26 on Coach Yinka's word Nov 23: "put early bird december 1st").
  earlyBirdEndsIso: nyLocalToIso("2026-12-02", "00:00"),
  // Final deadline: the whole of Dec 5 counts, so it closes as Dec 6 starts.
  registrationClosesIso: nyLocalToIso("2026-12-06", "00:00"),
  dmWord: "5V5",
  instagramDm: "https://ig.me/m/strivesoccerfc",
  instagram: "https://www.instagram.com/strivesoccerfc",
  // The Strive app waitlist (075, 076), tagged so the coach sees who came
  // from the 5v5. A team with its whole roster on it gets its own graphic
  // in the rollout and starts in the app as a club (Coach Yinka, Nov 22).
  waitlist: "/join?src=5v5",
  handle: "@strivesoccerfc",
  // The team registration form (Coach Yinka, Nov 19: first "a google
  // form", then he sent his GHL form). One form for both prices; the page
  // shows the price that applies today. A GHL form is embedded on the page;
  // a Google Form is linked. Empty = the button falls back to the
  // Instagram DM so nothing fake is shown.
  registrationForm: "https://api.leadconnectorhq.com/widget/form/lHiFBnSdihwHaGDbeOBO",
  // From his form (read Nov 19): max 9 players, all 21 and under, two
  // jerseys of contrasting colors.
  rosterMax: 9,
  maxAge: 21,
} as const;

export type FiveV5Phase = "early" | "standard" | "closed";

export function phaseAt(ms: number): FiveV5Phase {
  if (ms >= Date.parse(FIVE_V_FIVE.registrationClosesIso)) return "closed";
  if (ms < Date.parse(FIVE_V_FIVE.earlyBirdEndsIso)) return "early";
  return "standard";
}

export function priceAt(ms: number): number | null {
  const phase = phaseAt(ms);
  if (phase === "early") return FIVE_V_FIVE.earlyBird;
  if (phase === "standard") return FIVE_V_FIVE.standard;
  return null;
}

// Only a real Google Forms or GHL (LeadConnector) form address can become
// the button's href or the embedded form.
export function cleanFormUrl(url: string): string {
  return /^https:\/\/(docs\.google\.com\/forms\/|forms\.gle\/|api\.leadconnectorhq\.com\/widget\/form\/[A-Za-z0-9]+$)/.test(url)
    ? url
    : "";
}

// The GHL form id when the form is a GHL form (it is embedded on the
// page), else null.
export function ghlFormId(url: string = FIVE_V_FIVE.registrationForm): string | null {
  const m = /^https:\/\/api\.leadconnectorhq\.com\/widget\/form\/([A-Za-z0-9]+)$/.exec(url);
  return m ? m[1] : null;
}

// Where the register button goes right now: the Google Form when it is
// set, else the Instagram DM; nothing once registration has closed.
export function registerTarget(
  ms: number,
  form: string = FIVE_V_FIVE.registrationForm,
): { href: string; kind: "embed" | "form" | "dm" } | null {
  if (phaseAt(ms) === "closed") return null;
  const clean = cleanFormUrl(form);
  if (!clean) return { href: FIVE_V_FIVE.instagramDm, kind: "dm" };
  return ghlFormId(clean) ? { href: "#register", kind: "embed" } : { href: clean, kind: "form" };
}

export function money(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

// "Wednesday, Nov 25": the last day before an exclusive NY boundary.
export function lastDayBefore(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(Date.parse(iso) - 1));
}

// "Nov 26": the NY day a boundary starts.
export function dayOf(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(
    new Date(Date.parse(iso)),
  );
}
