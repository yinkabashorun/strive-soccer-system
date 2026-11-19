// Strive Elite 5v5, Sat Dec 19 2026 at SoFive Columbia (Coach Yinka,
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
  dateLabel: "Saturday, December 19",
  shortDate: "Sat, Dec 19",
  venue: "SoFive Columbia",
  prize: 3000,
  teams: 16,
  earlyBird: 450,
  standard: 550,
  // Early bird ends the instant Nov 26 starts in New York.
  earlyBirdEndsIso: nyLocalToIso("2026-11-26", "00:00"),
  // Final deadline: the whole of Dec 5 counts, so it closes as Dec 6 starts.
  registrationClosesIso: nyLocalToIso("2026-12-06", "00:00"),
  dmWord: "5V5",
  instagramDm: "https://ig.me/m/strivesoccerfc",
  // Stripe Payment Links, one per price, created by Coach Yinka. Empty =
  // the button falls back to the Instagram DM so nothing fake is shown.
  paymentLinks: {
    earlyBird: "",
    standard: "",
  },
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

// Where the register button goes right now: the Stripe link for the live
// price when it exists, else the Instagram DM.
export function registerTarget(ms: number): { href: string; kind: "pay" | "dm" } | null {
  const phase = phaseAt(ms);
  if (phase === "closed") return null;
  const link = phase === "early" ? FIVE_V_FIVE.paymentLinks.earlyBird : FIVE_V_FIVE.paymentLinks.standard;
  const clean = typeof link === "string" && /^https:\/\/(buy|checkout)\.stripe\.com\//.test(link) ? link : "";
  return clean ? { href: clean, kind: "pay" } : { href: FIVE_V_FIVE.instagramDm, kind: "dm" };
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
