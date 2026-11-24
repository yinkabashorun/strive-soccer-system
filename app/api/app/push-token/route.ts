import { appRoute } from "@/lib/elite/app-api";
import { DELETE as removeToken, POST as saveToken } from "@/app/api/elite/push/native/route";

// This phone's APNs device token (elite_native_push_tokens, 067), saved
// and removed by the existing route: inside an app request its getViewer()
// reads the phone's token, so the one implementation serves both apps.
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "push-token", access: "person", limit: 10 }, ({ req }) => saveToken(req));
export const DELETE = appRoute({ name: "push-token", access: "person", limit: 10 }, ({ req }) => removeToken(req));
