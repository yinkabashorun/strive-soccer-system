import { oneAppTabs, type OneAppTabKey } from "@shared/one-app";

// The tabs this build of the app has screens for, in the order the server
// lists them, keyed by the names the server's memberTabs uses (home, week,
// courses, coach, you). A tab shows when the server lists it for this
// member (app/(tabs)/_layout.tsx). The Elite "coach" tab joins here with
// its route in app/(tabs) when its screen exists. The icons are SF
// Symbols, drawn by iOS itself.
export const APP_TABS = [
  { key: "home", route: "index", label: "Home", sf: "house", sfSelected: "house.fill" },
  { key: "week", route: "week", label: "Week", sf: "calendar", sfSelected: "calendar" },
  { key: "courses", route: "courses", label: "Courses", sf: "book", sfSelected: "book.fill" },
  { key: "you", route: "you", label: "You", sf: "person", sfSelected: "person.fill" },
] as const;

export type TabKey = (typeof APP_TABS)[number]["key"];

// The one app's tabs (app/(free)), from the one shared rule
// (lib/elite/one-app.ts): a free player has Friends (today and the feed),
// Week, Clubs and You. Strive Pro ADDS Train in front and changes nothing
// else. Which of them a person sees is decided there, never here: this
// file only says which screen and which icon each key is.
export const ONE_APP_SCREENS: Record<OneAppTabKey, { route: string; sf: string; sfSelected: string }> = {
  train: { route: "train", sf: "figure.run", sfSelected: "figure.run" },
  friends: { route: "friends", sf: "person.2", sfSelected: "person.2.fill" },
  week: { route: "my-week", sf: "calendar", sfSelected: "calendar" },
  clubs: { route: "clubs", sf: "shield", sfSelected: "shield.fill" },
  you: { route: "me", sf: "person", sfSelected: "person.fill" },
};

// The tab bar for a free player (train: false) or a Pro member (true).
export function oneAppTabBar(train: boolean) {
  return oneAppTabs(train).map((t) => ({ ...t, ...ONE_APP_SCREENS[t.key] }));
}
