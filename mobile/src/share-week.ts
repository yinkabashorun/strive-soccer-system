import { hasWeekToShare, isPngDataUri } from "@shared/week-card";

// SHARE MY WEEK (Nov 25 2026): the small rules of the one row under the
// friends board on the Week tab. Pure, tested in tests/share-week.test.ts.
// The picture itself is drawn on the server (lib/elite/week-card-image.ts)
// and the words come from the server with it (lib/elite/share-link.ts);
// nothing about either is written on the phone.

// What the row says.
export const SHARE_WEEK_ROW = { title: "Share my week", detail: "Put your week on your story." } as const;
// Said under the row when the card could not be made (the website's words).
export const SHARE_WEEK_FAILED = "We couldn't make your card just now. Try again in a minute.";

// The row is there once the player has trained this week, and not before:
// the same rule the server makes the card by.
export function shareWeekShown(trainingMinutes: number): boolean {
  return hasWeekToShare(trainingMinutes);
}

// The picture as the server sends it, or null when what came is not one.
export function cardPicture(image: unknown): string | null {
  return isPngDataUri(image) ? image : null;
}

// The file the phone's image tool wrote: a PNG on this phone. Its name is
// the tool's own (a random id ending in .png, in the app's cache), so the
// ending is what tells the share sheet it is a picture.
export function isCardFile(uri: unknown): uri is string {
  return typeof uri === "string" && /^file:\/\/\/.+\.png$/i.test(uri);
}

// THE SHARE SHEET IS HANDED THE PICTURE ALONE. A share sheet offers an
// app only when the app takes every item it is given, and a story takes a
// picture, not a picture and a line of text. The card carries the join
// address on it; the words with the player's own link go out only when
// there is no picture to hand over. Whether the words can ride with the
// picture and Instagram still shows is a check for a real phone
// (docs/app-store/native-device-checklist.md): if it does, this is the
// one line to change.
export const SHARE_WEEK_WORDS_WITH_PICTURE = false;

export type ShareSheetContent = { url: string } | { url: string; message: string } | { message: string };

export function shareWeekContent(input: { text: string; file: string | null }): ShareSheetContent {
  if (isCardFile(input.file)) return SHARE_WEEK_WORDS_WITH_PICTURE ? { url: input.file, message: input.text } : { url: input.file };
  return { message: input.text };
}
