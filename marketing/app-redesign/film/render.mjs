// node film/render.mjs -> film/strive-elite-iphone-walkthrough.mp4
// Renders film.html frame by frame (1080x1920, 60 fps) in 4 parallel workers,
// pipes each worker's frames straight into its own ffmpeg segment, joins them
// and lays the three swishes under it. Needs a server in marketing/app-redesign:
//   python3 -m http.server 8765
import { createRequire } from "module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
import { spawn, execFileSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "film-"));
const FPS = 60, WORKERS = 4;
const b = await chromium.launch();
const dur = await (async () => { const p = await b.newPage(); await p.goto("http://localhost:8765/film/film.html"); await p.waitForFunction(() => window.__ready); const d = await p.evaluate(() => window.__dur); await p.close(); return d; })();
const N = Math.round(dur * FPS), per = Math.ceil(N / WORKERS);
async function worker(w) {
  const from = w * per, to = Math.min(N, from + per);
  const p = await (await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })).newPage();
  await p.goto("http://localhost:8765/film/film.html"); await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
  const seg = path.join(tmp, `seg${w}.mp4`);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-r", String(FPS), seg]);
  for (let i = from; i < to; i++) {
    await p.evaluate((t) => window.__render(t), i / FPS);
    const buf = await p.screenshot({ type: "jpeg", quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (w === 0 && i % 120 === 0) console.log(`frame ${i}/${to}`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on("close", r));
  return seg;
}
const segs = await Promise.all([...Array(WORKERS).keys()].map(worker));
await b.close();
fs.writeFileSync(path.join(tmp, "list.txt"), segs.map((s) => `file '${s}'`).join("\n"));
const silent = path.join(tmp, "video.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(tmp, "list.txt"), "-c", "copy", silent]);
// three soft air swishes: the title, the session finishing, the end card
const sw = (at, len, f0, f1) => `anoisesrc=d=${len}:c=pink:a=0.5,highpass=f=${f0},lowpass=f=${f1},afade=t=in:st=0:d=${(len * 0.45).toFixed(2)},afade=t=out:st=${(len * 0.45).toFixed(2)}:d=${(len * 0.55).toFixed(2)},adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)},apad=whole_dur=${dur}`;
const filt = [sw(2.4, 1.4, 300, 2600), sw(36.2, 1.2, 400, 3200), sw(53.3, 1.6, 250, 2400)].map((s, i) => `${s}[a${i}]`).join(";") + `;[a0][a1][a2]amix=inputs=3:normalize=0,volume=0.55,alimiter=limit=0.2,aformat=channel_layouts=stereo[a]`;
const outFile = path.join(here, "strive-elite-iphone-walkthrough.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-filter_complex", filt, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", outFile]);
console.log("done", outFile, N, "frames");
