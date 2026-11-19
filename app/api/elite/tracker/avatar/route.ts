import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/elite/session";
import { isSupabaseConfigured } from "@/lib/elite/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { saveAvatar, trackerFor } from "@/lib/elite/tracker-server";
import { writeDemoState } from "@/lib/elite/tracker-demo";
import { AVATAR_MAX_BYTES, AVATAR_MESSAGE, FREE_HOME, FREE_WEEK, looksLikeJpeg } from "@/lib/elite/tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

// Add or change the signed-in player's profile photo. The phone crops it
// to a square and shrinks it first; the server checks who is signed in,
// that the file is a small JPEG, and only then stores it in that
// account's own folder of the private bucket (tracker-server.ts
// saveAvatar), replacing the old one. The account and the path come from
// the server, never from the form.
//
// POST multipart { photo } -> { ok } | { ok: false, error }
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "player") return no("Sign in first.", 401);
  const tracker = await trackerFor(viewer);
  if (!tracker) return no("Sign in first.", 403);
  if (!rateLimit(`avatar:${viewer.profile.id}`, 10, 10 * 60_000)) {
    return no("That is a lot of photos in a few minutes. Wait a little and try again.", 429);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return no(AVATAR_MESSAGE, 400);
  }
  const file = form.get("photo");
  if (!(file instanceof Blob) || file.size === 0 || file.size > AVATAR_MAX_BYTES) return no(AVATAR_MESSAGE, 400);
  const photo = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeJpeg(photo)) return no(AVATAR_MESSAGE, 400);

  // The example account (no database): nothing is stored; the cookie
  // remembers that a photo was added so the example shows one.
  if (viewer.demo || !isSupabaseConfigured()) {
    writeDemoState({ avatar: true });
    return NextResponse.json({ ok: true });
  }

  if (!(await saveAvatar(viewer.profile.id, photo))) {
    return no("Your photo was not saved. Check your connection and try again.", 502);
  }
  revalidatePath(FREE_HOME);
  revalidatePath(FREE_WEEK);
  return NextResponse.json({ ok: true });
}
