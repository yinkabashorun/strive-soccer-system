import { publicAppRoute } from "@/lib/elite/app-api";
import { isFreeSignupOpen } from "@/lib/elite/tracker-server";
import { intakeColumnsReady } from "@/lib/elite/free-intake-server";

// Is free sign-up open right now? The same switch the website's /join
// reads (the coaches' switch at /coach/free). The app shows "Join free" on
// its sign-in screen only while this says yes. It also says no while the
// database cannot yet store a free account's quiz (migration 082): an
// account made then would have nowhere to go inside the app.
export const dynamic = "force-dynamic";

export const GET = publicAppRoute({ name: "free-open" }, async () => ({
  open: (await isFreeSignupOpen()) && (await intakeColumnsReady()),
}));
