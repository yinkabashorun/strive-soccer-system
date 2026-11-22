"use client";

// The browser half of My drills (078): a take's length before it goes up,
// and the two shareable videos made ON THE PLAYER'S OWN PHONE. Nothing here
// talks to our server: the takes play into a canvas, the canvas is
// recorded with MediaRecorder, and the file goes to the phone's own share
// sheet (or is saved). The layout numbers, the format pick and the support
// check are pure and tested in lib/elite/my-drills.ts.
import {
  COMPOSITE,
  MARK,
  canComposeVideo,
  duetLayout,
  duetSeconds,
  pickRecorderType,
  reelLayout,
  reelSeconds,
  shareFileName,
} from "./my-drills";
import { SHARE_LINE } from "./share-link";

// The length of a video file in seconds, NaN when the phone cannot say.
export function readVideoSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    let settled = false;
    const done = (n: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(n);
    };
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => done(v.duration);
    v.onerror = () => done(NaN);
    setTimeout(() => done(NaN), 8000);
    v.src = url;
  });
}

// Can this phone make a shareable video? Checked in the browser only.
export function videoShareSupported(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const MR = (window as unknown as { MediaRecorder?: { isTypeSupported?: (t: string) => boolean } }).MediaRecorder;
  const canvas = document.createElement("canvas") as HTMLCanvasElement & { captureStream?: unknown };
  return canComposeVideo({ MediaRecorder: MR ?? null, canvasCaptureStream: typeof canvas.captureStream === "function" });
}

export type ShareTake = { url: string; label: string; count?: number | null };

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    // Signed storage addresses answer with open CORS headers, so the canvas
    // stays readable; a take that does not is refused, not half-recorded.
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("take"));
    v.src = url;
    v.load();
  });
}

const GOLD = "#D4AF37";
const BONE = "#F5F4EF";
const FONT = "'Barlow Condensed', 'Oswald', Arial, sans-serif";

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 18;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, src: { x: number; y: number; w: number; h: number }, dst: typeof src) {
  try {
    ctx.drawImage(v, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h);
  } catch {
    /* a frame not ready yet: black stays */
  }
}

// Record a canvas while `paint` draws it, for `seconds`. Null when this
// phone cannot.
function record(
  canvas: HTMLCanvasElement,
  seconds: number,
  start: () => Promise<void>,
  paint: (elapsed: number) => void,
  fileName: (ext: string) => string
): Promise<File | null> {
  const type = pickRecorderType(
    typeof MediaRecorder !== "undefined" ? MediaRecorder.isTypeSupported.bind(MediaRecorder) : null
  );
  if (!type) return Promise.resolve(null);
  const stream = (canvas as HTMLCanvasElement & { captureStream(fps: number): MediaStream }).captureStream(COMPOSITE.fps);
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 6_000_000 });
  } catch {
    return Promise.resolve(null);
  }
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  return new Promise((resolve) => {
    let raf = 0;
    let t0 = 0;
    recorder.onstop = () => {
      cancelAnimationFrame(raf);
      if (chunks.length === 0) return resolve(null);
      const blob = new Blob(chunks, { type: type.mime.split(";")[0] });
      resolve(new File([blob], fileName(type.ext), { type: blob.type }));
    };
    const loop = (now: number) => {
      if (!t0) t0 = now;
      paint((now - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    start()
      .then(() => {
        recorder.start(500);
        raf = requestAnimationFrame(loop);
        setTimeout(() => recorder.state !== "inactive" && recorder.stop(), seconds * 1000);
      })
      .catch(() => resolve(null));
  });
}

function canvasOf() {
  const canvas = document.createElement("canvas");
  canvas.width = COMPOSITE.width;
  canvas.height = COMPOSITE.height;
  return { canvas, ctx: canvas.getContext("2d") };
}

// Then and now as one 1080 x 1920 video: the earlier take on top, the
// later below, the label of each on its half, the drill's name and the
// STRIVE mark at the top.
export async function composeDuet(input: { name: string; top: ShareTake; bottom: ShareTake }): Promise<File | null> {
  let a: HTMLVideoElement, b: HTMLVideoElement;
  try {
    [a, b] = await Promise.all([loadVideo(input.top.url), loadVideo(input.bottom.url)]);
  } catch {
    return null;
  }
  const { canvas, ctx } = canvasOf();
  if (!ctx) return null;
  const L = duetLayout({ width: a.videoWidth, height: a.videoHeight }, { width: b.videoWidth, height: b.videoHeight });
  const sides = [
    { v: a, t: input.top },
    { v: b, t: input.bottom },
  ];
  return record(
    canvas,
    duetSeconds(a.duration, b.duration),
    async () => {
      a.currentTime = 0;
      b.currentTime = 0;
      await Promise.all([a.play(), b.play()]);
    },
    () => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      L.halves.forEach((h, i) => {
        draw(ctx, sides[i].v, h.src, h.dst);
        text(ctx, sides[i].t.label.toUpperCase(), h.label.x, h.label.y, `800 52px ${FONT}`, BONE, "left");
        const count = sides[i].t.count;
        if (count !== null && count !== undefined) {
          text(ctx, String(count), h.label.x, h.label.y - 70, `900 120px ${FONT}`, GOLD, "left");
        }
      });
      ctx.fillStyle = GOLD;
      ctx.fillRect(0, COMPOSITE.half - 2, canvas.width, 4);
      text(ctx, input.name.toUpperCase(), L.name.x, L.name.y, `800 38px ${FONT}`, BONE, "left");
      text(ctx, MARK, L.mark.x, L.mark.y, `900 38px ${FONT}`, GOLD, "right");
      text(ctx, SHARE_LINE, canvas.width - 48, canvas.height - 48, `700 32px ${FONT}`, BONE, "right");
    },
    (ext) => shareFileName("then-and-now", input.name, ext)
  ).finally(() => {
    a.pause();
    b.pause();
  });
}

// The progress reel as one 1080 x 1920 video: every take in order, about
// 3 seconds each, its label on it, the latest held longer.
export async function composeReel(input: { name: string; takes: ShareTake[] }): Promise<File | null> {
  let videos: HTMLVideoElement[];
  try {
    videos = await Promise.all(input.takes.map((t) => loadVideo(t.url)));
  } catch {
    return null;
  }
  if (videos.length === 0) return null;
  const { canvas, ctx } = canvasOf();
  if (!ctx) return null;
  const slots = reelSeconds(videos.map((v) => v.duration));
  const ends = slots.map((_, i) => slots.slice(0, i + 1).reduce((s, n) => s + n, 0));
  let current = -1;
  return record(
    canvas,
    ends[ends.length - 1],
    async () => undefined,
    (elapsed) => {
      const i = Math.min(videos.length - 1, ends.findIndex((e) => elapsed < e) === -1 ? videos.length - 1 : ends.findIndex((e) => elapsed < e));
      const v = videos[i];
      if (i !== current) {
        videos[current]?.pause();
        current = i;
        v.currentTime = 0;
        void v.play().catch(() => undefined);
      }
      const L = reelLayout({ width: v.videoWidth, height: v.videoHeight });
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      draw(ctx, v, L.src, L.dst);
      text(ctx, input.takes[i].label.toUpperCase(), L.label.x, L.label.y, `900 120px ${FONT}`, BONE, "left");
      text(ctx, input.name.toUpperCase(), L.name.x, L.name.y, `800 38px ${FONT}`, BONE, "left");
      text(ctx, MARK, L.mark.x, L.mark.y, `900 38px ${FONT}`, GOLD, "right");
      text(ctx, SHARE_LINE, canvas.width - 48, canvas.height - 48, `700 32px ${FONT}`, BONE, "right");
    },
    (ext) => shareFileName("progress-reel", input.name, ext)
  ).finally(() => videos.forEach((v) => v.pause()));
}

// The phone's own share sheet, else a download. We never post anything.
// `text` carries the player's own join link (share-link.ts); where the
// phone cannot share a file, it is copied so it can be pasted.
export async function shareOrSave(file: File, title: string, text: string): Promise<"shared" | "saved" | "cancelled"> {
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title, text });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  await nav.clipboard?.writeText(text).catch(() => undefined);
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "saved";
}
