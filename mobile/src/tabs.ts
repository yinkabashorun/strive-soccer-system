// The tabs this build of the app has screens for, keyed by the names the
// server's memberTabs uses (home, week, courses, coach, you). Phase 2 adds
// "courses" and "coach" here with their routes in app/(tabs). The icons
// are SF Symbols, drawn by iOS itself.
export const PHASE_ONE_TABS = [
  { key: "home", route: "index", label: "Home", sf: "house", sfSelected: "house.fill" },
  { key: "week", route: "week", label: "Week", sf: "calendar", sfSelected: "calendar" },
  { key: "you", route: "you", label: "You", sf: "person", sfSelected: "person.fill" },
] as const;

export type TabKey = (typeof PHASE_ONE_TABS)[number]["key"];
