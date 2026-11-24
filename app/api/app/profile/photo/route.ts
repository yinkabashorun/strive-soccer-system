import { appRoute } from "@/lib/elite/app-api";
import { GET as readPhoto, POST as storePhoto } from "@/app/api/elite/profile/photo/route";

// The profile photo (081) from the iPhone app, served and stored by the
// website's own route: inside an app request its getViewer() reads the
// phone's token, so the checks (a small whole JPEG, where and when it was
// taken removed, the account's own folder) are the one implementation.
//   GET  ?v=<photo id>     the signed-in account's own photo
//   POST multipart photo  add or change it
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "photo-read", access: "person", limit: 240 }, ({ req }) => readPhoto(req));
export const POST = appRoute({ name: "photo", access: "person", limit: 10 }, ({ req }) => storePhoto(req));
