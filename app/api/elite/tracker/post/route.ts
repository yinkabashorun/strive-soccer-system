import { noticeFriendPost } from "@/lib/elite/free-notices-server";
import { OFFENSIVE_MESSAGE, isOffensive } from "@/lib/elite/text-filter";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/elite/session";
import { isSupabaseConfigured } from "@/lib/elite/supabase/server";
import { nyToday } from "@/lib/elite/time";
import { rateLimit } from "@/lib/rate-limit";
import { savePost, trackerFor } from "@/lib/elite/tracker-server";
import { tagTogether } from "@/lib/elite/club-teams-server";
import { readDemoState, writeDemoState } from "@/lib/elite/tracker-demo";
import {
  FREE_HOME,
  FREE_WEEK,
  GYM_REFUSED_MESSAGE,
  POST_MAX_BYTES,
  POST_REFUSED_PHOTO,
  cleanCaption,
  cleanKind,
  cleanJpeg,
  mayLog,
  validateMinutes,
  DAY_CAP_MESSAGE,
} from "@/lib/elite/tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

// Post today's training: a photo, how long, training or gym, and one
// optional line. The photo arrives already shrunk by the phone; the
// server checks who is signed in, that the file is a JPEG of a size it
// will take, and only then stores it under the signed-in account's own
// folder in the private bucket (lib/elite/tracker-server.ts savePost).
// The account, the day and the path all come from the server, never from
// the form.
//
// POST multipart { photo, minutes, kind, caption?, with? } -> { ok, id } | { ok: false, error }
// ("with" is the ids of club teammates who trained with them, comma separated)
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "player") return no("Sign in first.", 401);
  const tracker = await trackerFor(viewer);
  if (!tracker) return no("Sign in first.", 403);
  if (!rateLimit(`post:${viewer.profile.id}`, 20, 10 * 60_000)) {
    return no("That is a lot of posts in a few minutes. Wait a little and try again.", 429);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return no("We could not read that. Try again.", 400);
  }
  const minutes = validateMinutes(Number(form.get("minutes")));
  const kind = cleanKind(form.get("kind"));
  if (minutes === null || kind === null) return no("Pick how long you trained.", 400);
  if (!mayLog(kind, tracker.grade)) return no(GYM_REFUSED_MESSAGE, 403);
  // the word filter on what friends will read (text-filter.ts)
  if (isOffensive(form.get("caption"))) return no(OFFENSIVE_MESSAGE, 400);
  const caption = cleanCaption(form.get("caption"));

  const file = form.get("photo");
  if (!(file instanceof Blob) || file.size === 0) return no(POST_REFUSED_PHOTO, 400);
  if (file.size > POST_MAX_BYTES) return no("That photo is too big. Take another one.", 413);
  // a whole JPEG of a real size, with where and when it was taken removed
  const photo = cleanJpeg(new Uint8Array(await file.arrayBuffer()));
  if (!photo) return no(POST_REFUSED_PHOTO, 400);

  const today = nyToday();

  // The example account (no database): nothing is stored. The cookie
  // remembers that a post was made today so the example feed opens.
  if (viewer.demo || !isSupabaseConfigured()) {
    const id = `demo-today-${Date.now()}`;
    const kept = (readDemoState().today ?? []).filter((e) => e.day === today).slice(-5);
    writeDemoState({
      today: [...kept, { id, day: today, minutes, kind, caption, photo: true, at: new Date().toISOString() }],
    });
    return NextResponse.json({ ok: true, id });
  }

  const saved = await savePost({
    profileId: viewer.profile.id,
    today,
    minutes,
    kind,
    caption,
    photo,
    weekTarget: tracker.target_minutes,
  });
  if (!saved.ok && saved.dayCap) return no(DAY_CAP_MESSAGE, 400);
  if (!saved.ok) return no("Your post was not saved. Check your connection and try again.", 502);
  // the club teammates who trained with them, if any were tapped (077):
  // each gets a card to add the same time to their own week. Clubmates
  // only and never across a block, checked on the server.
  await tagTogether({ posterId: viewer.profile.id, logId: saved.id, kind, raw: form.get("with") }).catch(() => 0);
  // Friends who have not posted today hear about it (078): one a day at
  // most, accepted friends only, never across a block, never at night.
  await noticeFriendPost(viewer.profile.id, today).catch(() => 0);
  revalidatePath(FREE_HOME);
  revalidatePath(FREE_WEEK);
  return NextResponse.json({ ok: true, id: saved.id });
}
