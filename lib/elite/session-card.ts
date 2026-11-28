// THE TRAINING CARD (Coach Yinka, Nov 28 2026: "the card is like strava you
// complete your session and take the picture with text over it. literally
// copy strava with our own spin"; "an option to add a quote to it, then you
// can push it to your story"; "every time you post it must save to camera
// roll"; "just do insta").
//
// A story-size picture, 1080 x 1920, made ON THE PHONE from the player's
// own photo of the session, full bleed, with a dark fall top and bottom so
// the words read:
//   top     STRIVE ELITE, then the day and the player's short name
//   quote   only when the player picked one, with who said it
//   bottom  "Trained today" (or "Gym today"), the time big, their one line
//   row     this week, all time, level: the numbers Week and You show,
//           read from the same answer the You tab reads (never worked out
//           a second way); left off when the phone never loaded them
//   link    thestriveapp.com/join
//   badge   the App Store badge, only once the app is live there
//
// What is never on it: a friend's name, a place on a board, anything not
// done, and nothing that says a typed entry was timed.
//
// The small rules of the screen are here too: which buttons show, and the
// key that saves a card to Photos once per version (same photo and same
// quote is never saved twice). Pure: shared with the phone
// ("@shared/session-card"), tested in tests/session-card.test.ts.
import { quoteById, type Quote } from "./quotes";
import { fmtDuration } from "./time-trained";
import { dayLabel, type Kind } from "./tracker";
import { pickLine } from "./voice";

// ---- the picture ---------------------------------------------------------

export const CARD_PIXELS = { width: 1080, height: 1920 } as const;

// The card is laid out in points, one point for three pixels of the
// picture: on a phone that draws three pixels a point it is drawn at the
// picture's own size.
export const CARD_POINT = 3;
export const CARD_POINTS = { width: CARD_PIXELS.width / CARD_POINT, height: CARD_PIXELS.height / CARD_POINT } as const;

// What react-native-view-shot is asked for: a JPEG file in the app's own
// temporary folder, of EXACTLY 1080 x 1920 pixels on any iPhone.
//
// On iOS its width and height are POINTS, not pixels: it draws the view
// into a picture of that many points at the screen's own scale
// (ios/RNViewShot.mm: UIGraphicsImageRenderer initWithSize:size, format
// scale 0 = the screen's scale). So the size asked for is the picture's
// pixels divided by the phone's pixels a point: 360 x 640 on a phone that
// draws three, 540 x 960 on one that draws two. Asking for 1080 x 1920 on
// a three-a-point phone would hand over 3240 x 5760.
export function cardCapture(pixelRatio: number) {
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : CARD_POINT;
  return { format: "jpg", quality: 0.92, width: CARD_PIXELS.width / ratio, height: CARD_PIXELS.height / ratio, result: "tmpfile" } as const;
}

// "Download on the App Store" goes on the card only once the app is live on
// the App Store: Apple's artwork is licensed only for an app that can be
// downloaded there (docs/app-store/share-kits-research-2026-11-28.md,
// section 7). Off: nothing is drawn in its place.
export const APP_STORE_BADGE_LIVE = false;

export const CARD_LINK = "thestriveapp.com/join";

// The dark falls, as [where 0 to 1 down the card, how dark]. With a quote
// the top fall runs further down, under the quote.
export function cardShade(hasQuote: boolean): [number, number][] {
  return hasQuote
    ? [
        [0, 0.7],
        [0.36, 0.42],
        [0.5, 0],
        [0.56, 0],
        [1, 0.9],
      ]
    : [
        [0, 0.55],
        [0.22, 0],
        [0.48, 0],
        [1, 0.88],
      ];
}

// How big the quote is set, in the picture's pixels: a short quote big, a
// long one smaller, so the longest (160 letters) still sits above the time.
export function quoteSize(text: string): number {
  const n = text.length;
  if (n <= 36) return 66;
  if (n <= 64) return 58;
  if (n <= 100) return 50;
  return 44;
}

// ---- what is on it -------------------------------------------------------

export type CardStats = { weekMinutes: number; allMinutes: number; level: number };

export type CardInput = {
  day: string; // the entry's day, YYYY-MM-DD (New York)
  today: string; // today in New York, YYYY-MM-DD
  name: string; // "Marcus B."
  minutes: number; // the entry's own minutes
  kind: Kind;
  note: string | null; // the player's one line
  quoteId: string | null;
  stats: CardStats | null; // null: never loaded on this phone, so the row is left off
};

export type CardFace = {
  dateLine: string; // "Sat, Nov 28 · Marcus B."
  quote: Quote | null;
  eyebrow: string;
  time: string;
  note: string | null;
  stats: { value: string; label: string }[] | null;
  link: string;
  badge: boolean;
};

function whole(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export function cardFace(i: CardInput): CardFace {
  const name = i.name.trim();
  const note = i.note?.replace(/\s+/g, " ").trim() || null;
  const isToday = i.day === i.today;
  // a card made later from an older post says the day, not "today"
  const eyebrow = i.kind === "gym" ? (isToday ? "Gym today" : "Gym") : isToday ? "Trained today" : "Trained";
  const s = i.stats;
  const week = whole(s?.weekMinutes);
  const all = whole(s?.allMinutes);
  const level = whole(s?.level);
  const stats =
    week === null || all === null || level === null || level < 1
      ? null
      : [
          { value: fmtDuration(week), label: "this week" },
          { value: fmtDuration(all), label: "all time" },
          { value: `LVL ${level}`, label: "level" },
        ];
  return {
    dateLine: name ? `${dayLabel(i.day)} · ${name}` : dayLabel(i.day),
    quote: quoteById(i.quoteId),
    eyebrow,
    time: fmtDuration(Math.max(0, i.minutes)),
    note,
    stats,
    link: CARD_LINK,
    badge: APP_STORE_BADGE_LIVE,
  };
}

// What a screen reader says for the card: the picture's words, in order.
export function cardSaid(f: CardFace): string {
  return [
    "Strive Elite",
    f.dateLine,
    f.quote ? `${f.quote.text} ${f.quote.by}` : null,
    `${f.eyebrow}, ${f.time}`,
    f.note,
    f.stats ? f.stats.map((s) => `${s.value} ${s.label}`).join(", ") : null,
    f.link,
  ]
    .filter(Boolean)
    .join(". ");
}

// ---- the screen ----------------------------------------------------------

export type CardButton = "instagram" | "save" | "more";

// "Instagram story" only when Instagram is on the phone AND a Meta app ID is
// set (Instagram refuses a story from an app without one); then Save to
// Photos, then More (the phone's own share sheet).
export function cardButtons(input: { instagram: boolean; metaAppId: string | null | undefined }): CardButton[] {
  const id = typeof input.metaAppId === "string" ? input.metaAppId.trim() : "";
  return [...(input.instagram && /^\d{5,20}$/.test(id) ? (["instagram"] as const) : []), "save", "more"];
}

// One card version: the photo (the post's own key) and the quote. Sharing
// it again, or Save to Photos after a share, does not put a second copy in
// Photos; a new quote is a new card and is saved once more.
export function cardKey(photoKey: string, quoteId: string | null): string {
  return `${photoKey}|${quoteId ?? "none"}`;
}

export const SAVED_KEEP = 40;

export function savedAlready(saved: readonly string[], key: string): boolean {
  return saved.includes(key);
}

// The list of saved card versions kept on this phone, newest last.
export function rememberSaved(saved: readonly string[], key: string, keep = SAVED_KEEP): string[] {
  return [...saved.filter((k) => k !== key), key].slice(-keep);
}

// The words on the screen. Buttons are plain labels. The line at the top
// is one of three, each true of any post (lib/elite/voice.ts pickLine).
export const CARD_WORDS = {
  eyebrow: "Your card",
  titles: ["In the books.", "That one's yours.", "Locked in."],
  quoteRow: "Add a quote",
  quoteChange: "Change the quote",
  quoteSheet: "Pick a quote",
  quoteNone: "No quote",
  instagram: "Instagram story",
  save: "Save to Photos",
  more: "More",
  saved: "Saved to Photos.",
  notSaved: "Your card wasn't saved to Photos. To save it, let Strive Elite add photos in Settings.",
  openSettings: "Open Settings",
  failed: "We couldn't make your card just now. Try again.",
  make: "Make my card",
  close: "Close",
} as const;

export function cardTitle(seed: string): string {
  return pickLine(CARD_WORDS.titles, `${seed}:card`);
}
