import { appRoute } from "@/lib/elite/app-api";
import { POST as storePost } from "@/app/api/elite/tracker/post/route";

// Post my training from the iPhone app, stored by the website's own route:
// inside an app request its getViewer() reads the phone's token, so every
// check is the one implementation (a whole JPEG of a real size, where and
// when it was taken removed, the length, training or gym by grade, the
// word filter on the note, the 8 hours a day, the account's own folder).
//   POST multipart { photo, minutes, kind, caption? }
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "free-post", access: "free_app", limit: 20 }, ({ req }) => storePost(req));
