// node film/render-mix.mjs long|short -> film/strive-elite-iphone-{long,short}.mp4
// Same frame-by-frame render as render.mjs (1080x1920, 60 fps, 4 workers), then
// the beat from beat.py (BEAT=rock for rockbeat.py, file name gets -rock), loudness set to -14 LUFS for Instagram.
// A song cut (node film/render-mix.mjs short-song) takes SONG=/path/to/recording instead: its audio from the
// cut's start beat, faded in and out. That copy is for his eyes only and is never committed (a label's song,
// public repo); the -silent copy is the one to post, with the song added in the Instagram app.
// Needs a server in marketing/app-redesign: python3 -m http.server 8765
import { createRequire } from "module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
import { spawn, execFileSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
const here = path.dirname(fileURLToPath(import.meta.url));
const cut = process.argv[2] || "long";
const URL = `http://localhost:8765/film/mix.html?cut=${cut}`;
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", `mix-${cut}-`));
const FPS = 60, WORKERS = 4;
const b = await chromium.launch();
const p0 = await b.newPage(); await p0.goto(URL); await p0.waitForFunction(() => window.__ready);
const dur = await p0.evaluate(() => window.__dur), info = await p0.evaluate(() => window.__info); await p0.close();
const N = Math.round(dur * FPS), per = Math.ceil(N / WORKERS);
async function worker(w) {
  const from = w * per, to = Math.min(N, from + per);
  const open = async () => { const q = await (await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })).newPage();
    await q.goto(URL); await q.waitForFunction(() => window.__ready, null, { timeout: 30000 }); return q; };
  // p draws the film; g draws only the outgoing shot of each dissolve, so neither page jumps back in time
  const p = await open(), g = await open();
  const seg = path.join(tmp, `seg${w}.mp4`);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-r", String(FPS), seg]);
  for (let i = from; i < to; i++) {
    const t = i / FPS, xf = await p.evaluate((t) => window.__xfade(t), t);
    if (xf) {
      await g.evaluate(([t, s]) => window.__render(t, s), [t, xf.prev]);
      const old = "data:image/jpeg;base64," + (await g.screenshot({ type: "jpeg", quality: 98 })).toString("base64");
      await p.evaluate(([t, s]) => window.__render(t, s), [t, xf.cur]);
      await p.evaluate(([u, o]) => window.__overlay(u, o), [old, 1 - xf.a]);
    } else {
      await p.evaluate(() => window.__overlay(null));
      await p.evaluate((t) => window.__render(t), t);
    }
    const buf = await p.screenshot({ type: "jpeg", quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end(); await new Promise((r) => ff.on("close", r));
  return seg;
}
const segs = await Promise.all([...Array(WORKERS).keys()].map(worker));
await b.close();
fs.writeFileSync(path.join(tmp, "list.txt"), segs.map((s) => `file '${s}'`).join("\n"));
const silent = path.join(tmp, "video.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(tmp, "list.txt"), "-c", "copy", silent]);
if (info.song) {
  if (!process.env.SONG) throw new Error("a song cut needs SONG=/path/to/the recording");
  const silentOut = path.join(here, `strive-elite-iphone-${cut}-silent.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-c", "copy", "-movflags", "+faststart", silentOut]);
  const outFile = path.join(here, `strive-elite-iphone-${cut}.mp4`);
  const s0 = info.song.start + 0.006, fo = (dur - 0.9).toFixed(2);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-ss", s0.toFixed(3), "-i", process.env.SONG, "-filter_complex",
    `[1:a]atrim=0:${dur},asetpts=PTS-STARTPTS,afade=t=in:d=0.04,afade=t=out:st=${fo}:d=0.9,loudnorm=I=-14:TP=-1.5:LRA=9[a]`,
    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", outFile]);
  console.log("done", outFile, silentOut, N, "frames", dur.toFixed(2), "s");
} else {
  fs.writeFileSync(path.join(tmp, "info.json"), JSON.stringify(info));
  const wav = path.join(tmp, "beat.wav");
  const rock = process.env.BEAT === "rock";
  execFileSync("python3", [path.join(here, rock ? "rockbeat.py" : "beat.py"), path.join(tmp, "info.json"), wav]);
  const outFile = path.join(here, `strive-elite-iphone-${cut}${rock ? "-rock" : ""}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-i", wav, "-filter_complex", `[1:a]atrim=0:${dur},loudnorm=I=-14:TP=-1.5:LRA=9[a]`,
    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", outFile]);
  console.log("done", outFile, N, "frames", dur.toFixed(2), "s");
}
