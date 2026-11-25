import { revalidatePath } from "next/cache";
import { appJson, appRoute } from "@/lib/elite/app-api";
import { noticeFriendPost } from "@/lib/elite/free-notices-server";
import { countTeammate } from "@/lib/elite/squad-pass-server";
import { OFFENSIVE_MESSAGE, isOffensive } from "@/lib/elite/text-filter";
import {
  DAY_CAP_MESSAGE,
  FREE_HOME,
  FREE_WEEK,
  GYM_REFUSED_MESSAGE,
  POST_REFUSED_PHOTO,
  cleanCaption,
  cleanJpeg,
  cleanKind,
  mayLog,
} from "@/lib/elite/tracker";
import { CLOCK_PHOTO_MAX_BYTES, CLOCK_WORDS, cleanClockTimes } from "@/lib/elite/training-clock";
import { nyDayOf, saveClockPost } from "@/lib/elite/training-clock-server";

// A training clock finished (training-clock.ts): the start photo, the
// finish photo, and the phone's own times for both. The server works out
// how long it counts; no length is ever sent. The account, the day and
// both paths come from the server, never from the form.
//   POST multipart { start, finish, started, ended, sent, kind, caption? }
//     -> { ok, id, minutes } | { ok: false, error, reason? }
// Both photos are checked the way a post's photo is: a whole JPEG of a real
// size, with where and when it was taken removed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const no = (error: string, status: number, reason?: string) => appJson({ ok: false, error, ...(reason ? { reason } : {}) }, status);
const NOT_SAVED = "Your training was not saved. Check your connection and try again.";

async function jpegOf(part: FormDataEntryValue | null): Promise<Uint8Array | null | "big"> {
  if (!(part instanceof Blob) || part.size === 0) return null;
  if (part.size > CLOCK_PHOTO_MAX_BYTES) return "big";
  return cleanJpeg(new Uint8Array(await part.arrayBuffer()));
}

export const POST = appRoute({ name: "free-clock-finish", access: "free_app", limit: 20, windowMs: 10 * 60_000 }, async ({ req, viewer, tracker }) => {
  if (!tracker) return no("Sign in first.", 403);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return no("We could not read that. Try again.", 400);
  }
  const times = cleanClockTimes({ started: form.get("started"), ended: form.get("ended"), sent: form.get("sent") });
  const kind = cleanKind(form.get("kind"));
  if (!times || kind === null) return no("That clock could not be read.", 400);
  if (!mayLog(kind, tracker.grade)) return no(GYM_REFUSED_MESSAGE, 403);
  if (isOffensive(form.get("caption"))) return no(OFFENSIVE_MESSAGE, 400);
  const caption = cleanCaption(form.get("caption"));

  const [startPhoto, finishPhoto] = await Promise.all([jpegOf(form.get("start")), jpegOf(form.get("finish"))]);
  if (startPhoto === "big" || finishPhoto === "big") return no("That photo is too big. Take another one.", 413);
  if (!startPhoto || !finishPhoto) return no(POST_REFUSED_PHOTO, 400);

  const saved = await saveClockPost({
    profileId: viewer.profile.id,
    kind,
    caption,
    startPhoto,
    finishPhoto,
    times,
    weekTarget: tracker.target_minutes,
  });
  if (!saved.ok) {
    if (saved.reason === "short") return no(CLOCK_WORDS.short, 400, "short");
    if (saved.reason === "expired") return no(CLOCK_WORDS.expiredBody, 400, "expired");
    if (saved.reason === "overlap") return no(CLOCK_WORDS.overlap, 409, "overlap");
    if (saved.reason === "day_cap") return no(DAY_CAP_MESSAGE, 400, "day_cap");
    if (saved.reason === "bad") return no("That clock could not be read.", 400, "bad");
    return no(NOT_SAVED, 502);
  }
  // said once: only the write that made the entry tells friends and counts
  // a teammate (the same finish sent again changes nothing)
  if (saved.fresh) {
    await noticeFriendPost(viewer.profile.id, nyDayOf(Date.now())).catch(() => 0);
    await countTeammate(viewer.profile.id).catch(() => undefined);
  }
  revalidatePath(FREE_HOME);
  revalidatePath(FREE_WEEK);
  return { ok: true, id: saved.id, minutes: saved.minutes };
});
