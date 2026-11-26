import { publicAppRoute } from "@/lib/elite/app-api";
import { getAppVersion } from "@/lib/elite/tracker-server";

// The oldest build of the iPhone app that still works, and the one link
// to the app (lib/elite/app-version.ts). Asked by the app each time it
// opens, signed in or not. It answers "every build works" whenever the
// setting cannot be read, so it can never lock a player out by mistake.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const GET = publicAppRoute({ name: "version" }, async () => getAppVersion());
