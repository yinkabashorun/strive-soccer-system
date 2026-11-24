import { HomeScreen } from "@/HomeScreen";

// Train: the ONE tab Strive Pro adds to the free tabs (lib/elite/one-app.ts,
// Coach Yinka, Nov 24 2026: "pro should just add tabs"). Today's session
// and Start, the week, extra work, the Inbox and the Courses shelf: the
// member's Home, with what the member's Week and Courses tabs carry, on
// one screen (src/HomeScreen.tsx). Friends, Week, Clubs and You sit beside
// it exactly as they were before Strive Pro.
export default function Train() {
  return <HomeScreen train />;
}
