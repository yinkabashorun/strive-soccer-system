// Strive Elite 5v5, Sat Dec 19 2026 at SoFive Columbia (Coach Yinka,
// Nov 13 and Nov 19 2026). The page at /5v5 reads every fact and the
// price from here, so the poster, the caption and the page cannot drift.
//
// Price rule, his words (Nov 19): "early bird payment at 450 then
// December 5th and beyond 550". Read as: $450 a team for any payment
// made before Fri Dec 5 2026 00:00 ET, $550 from that moment on, and
// registration closes when the event starts or when the team cap fills
// (the cap is counted by hand: Registration = payment, so a team is in
// once Stripe has its money).
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
  // Last moment of early bird is the instant Dec 5 starts in New York.
  earlyBirdEndsIso: nyLocalToIso("2026-12-05", "00:00"),
  // Registration stays open until the morning of the event.
  registrationClosesIso: nyLocalToIso("2026-12-19", "08:00"),
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
