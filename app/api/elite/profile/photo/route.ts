import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/elite/session";
import { isSupabaseConfigured } from "@/lib/elite/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { trackerFor } from "@/lib/elite/tracker-server";
import { readProfilePhoto, saveProfilePhoto } from "@/lib/elite/account-profile-server";
import { writeDemoState } from "@/lib/elite/tracker-demo";
import { AVATAR_MAX_BYTES, AVATAR_MESSAGE, cleanJpeg } from "@/lib/elite/tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

// The signed-in account's own photo (a coach: any member's, ?of=<profile
// id>). Served from here rather than as a signed storage address, so the
// address stays the same for as long as the photo does (?v= is the id in
// the file name) and the phone downloads it once and keeps it. Private to
// the browser that asked; never cached by anyone in between.
//
// GET ?v=<photo id>[&of=<profile id>] -> the JPEG | 404
export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return new NextResponse(null, { status: 404 });
  const url = new URL(req.url);
  const of = url.searchParams.get("of");
  const staff = viewer.role === "coach" || viewer.role === "admin";
  const target = of && staff ? of : viewer.profile.id;
  if (of && !staff && of !== viewer.profile.id) return new NextResponse(null, { status: 404 });
  const file = await readProfilePhoto(target);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(file, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "private, max-age=86400, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

// Add or change the signed-in player's profile photo: a member (the
// onboarding step, the one-time screen, You) or a free account (its
// set-up, settings). The phone crops it to a square and shrinks it first;
// the server checks who is signed in, that the file is a small JPEG, takes
// out where and when it was taken, and only then stores it in that
// account's own folder of the private bucket (account-profile-server.ts
// saveProfilePhoto), replacing the old one. The account and the path come
// from the server, never from the form.
//
// POST multipart { photo } -> { ok } | { ok: false, error }
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "player") return no("Sign in first.", 401);
  const free = viewer.playerId ? null : await trackerFor(viewer);
  if (!viewer.playerId && !free) return no("Sign in first.", 403);
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
  // a whole JPEG of a real size, with where and when it was taken removed
  const photo = cleanJpeg(new Uint8Array(await file.arrayBuffer()));
  if (!photo) return no(AVATAR_MESSAGE, 400);

  // The example accounts (no database): nothing is stored; the free
  // example remembers that a photo was added so it shows one.
  if (viewer.demo || !isSupabaseConfigured()) {
    if (free) writeDemoState({ avatar: true });
    return NextResponse.json({ ok: true });
  }

  if (!(await saveProfilePhoto(viewer.profile.id, photo))) {
    return no("Your photo wasn't saved. Check your connection and try again.", 502);
  }
  // Every screen that shows it, and the gate that asked for it.
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
