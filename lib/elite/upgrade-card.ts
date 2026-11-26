// The ONE upgrade prompt inside the free app (Coach Yinka, Nov 24 2026:
// "Not too much CTAs"): a quiet card on the Week tab, under the week. This
// file is the whole rule for whether it shows and what it says, so no
// screen can grow a second one.
//
//   - one place only: the Week tab. Nothing on Friends, nothing on You,
//     nothing after a post, no banner, no badge.
//   - never for a member.
//   - never a pop-up: it is a card in the page, and it never stands in the
//     way of posting, the feed or the week.
//   - "Not now" puts it away for UPGRADE_CARD_REST_DAYS (kept on the phone).
//   - it names the player's own weakest area and the sessions a week their
//     own answers give (lib/elite/training.ts sessionsFor): a card with no
//     area to name does not show at all.
//   - a player who came in by the door (lib/elite/free-door.ts) has not
//     rated their game yet, so there is no area to name: the SAME card, in
//     the same place, asks for a few taps first. It opens the quiz, and
//     the offer follows it. Still one card, never a second one.
import { areaWords } from "./free-intake";
import { sessionsWord } from "./training";

export const UPGRADE_CARD_PLACES = ["week"] as const;
export type UpgradePlace = (typeof UPGRADE_CARD_PLACES)[number];

export const UPGRADE_CARD_REST_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// opens: where the card's one action goes. "quiz" for a player with no
// answers yet (the offer follows the quiz), "offer" for everyone else.
export type UpgradeCardCopy = { title: string; line: string; action: string; dismiss: string; opens: "offer" | "quiz" };

export function upgradeCard(i: {
  place: string;
  member: boolean;
  area: string | null | undefined;
  sessions: number;
  dismissedAt: number | null;
  now: number;
  // the player has not rated their game yet (they came in by the door)
  quiz?: boolean;
}): UpgradeCardCopy | null {
  if (i.member) return null;
  if (!(UPGRADE_CARD_PLACES as readonly string[]).includes(i.place)) return null;
  if (i.dismissedAt !== null && i.now - i.dismissedAt < UPGRADE_CARD_REST_DAYS * DAY_MS) return null;
  if (i.quiz) {
    return {
      title: "A week built around your game.",
      line: "Rate your game in a few taps. Then see what your first week would go after.",
      action: "See what you get",
      dismiss: "Not now",
      opens: "quiz",
    };
  }
  const area = (i.area ?? "").trim();
  if (!area || !Number.isInteger(i.sessions) || i.sessions <= 0) return null;
  const count = sessionsWord(i.sessions);
  return {
    title: `A week built around your ${areaWords(area)}.`,
    line: `${count.charAt(0).toUpperCase()}${count.slice(1)} sessions a week, one drill at a time with the video.`,
    action: "See what you get",
    dismiss: "Not now",
    opens: "offer",
  };
}

// The moment a dismissal was kept on the phone, read back: a number of
// milliseconds, or null for anything else.
export function parseDismissedAt(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const UPGRADE_CARD_KEY = "strive.upgrade.dismissed";
