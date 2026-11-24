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

// The free app's tabs (app/(free)): Friends (today and the feed), Week,
// Clubs (your clubs, in the middle: the reason to open the app every day),
// the Courses shelf (every course locked: a state, not a prompt) and You.
// A free account always has all five.
export const FREE_TABS = [
  { route: "friends", label: "Friends", sf: "person.2", sfSelected: "person.2.fill" },
  { route: "my-week", label: "Week", sf: "calendar", sfSelected: "calendar" },
  { route: "clubs", label: "Clubs", sf: "shield", sfSelected: "shield.fill" },
  { route: "courses", label: "Courses", sf: "book", sfSelected: "book.fill" },
  { route: "me", label: "You", sf: "person", sfSelected: "person.fill" },
] as const;
