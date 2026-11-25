import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { forgetClock, hearClockStart } from "@/lib/elite/training-clock-server";
import { CLOCK_CAP_MINUTES, CLOCK_GRACE_MINUTES } from "@/lib/elite/training-clock";

// The training clock's start, as the server hears of it (training-clock.ts).
// The phone takes the start photo, starts its clock and says so here. No
// photo is sent: this is only "a clock started, this long ago", so the
// server can measure the session with its own clock. Best effort: training
// with no signal still counts, by the phone's own time.
//   POST   { started, ago }   started: the phone's clock at the start photo (ms)
//                             ago: seconds since then, by the phone's clock
//   DELETE                    the clock was stopped without posting
export const dynamic = "force-dynamic";

const LONGEST = (CLOCK_CAP_MINUTES + CLOCK_GRACE_MINUTES) * 60;

export const POST = appRoute({ name: "free-clock", access: "free_app", limit: 30 }, async ({ req, viewer }) => {
  const body = await readJson(req);
  const started = body?.started;
  const ago = body?.ago;
  if (typeof started !== "number" || !Number.isSafeInteger(started) || started <= 0 || typeof ago !== "number" || !(ago >= 0) || ago > LONGEST) {
    return appJson({ ok: false, error: "That clock could not be read." }, 400);
  }
  return { ok: await hearClockStart(viewer.profile.id, started, ago) };
});

export const DELETE = appRoute({ name: "free-clock", access: "free_app", limit: 30 }, async ({ viewer }) => {
  await forgetClock(viewer.profile.id);
  return { ok: true };
});
