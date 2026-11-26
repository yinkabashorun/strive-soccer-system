import { publicAppRoute } from "@/lib/elite/app-api";
import { POST as join } from "@/app/api/elite/auth/join/route";
import { JOIN_TRIES_PER_ADDRESS, JOIN_WINDOW_MS } from "@/lib/rate-limit";

// Join free from the iPhone app: the website's own free sign-up route, so
// there is one set of rules (the coaches' switch, 13 and older with
// nothing stored for anyone younger, both agreement boxes, the typed
// details checked by joinProblem, the recorded agreement). The phone then
// signs in with the email and password it just sent.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = publicAppRoute({ name: "free-join", limit: JOIN_TRIES_PER_ADDRESS, windowMs: JOIN_WINDOW_MS }, (req) => join(req));
