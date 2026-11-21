// node record-proto.mjs -> proto-walkthrough.mp4 (the motion prototype, tapped through)
import { createRequire } from "module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { execFileSync } from "child_process";
const dir = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "proto-"));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, recordVideo: { dir: tmp, size: { width: 780, height: 1688 } } });
const p = await ctx.newPage();
await p.goto("file://" + path.join(dir, "proto.html") + "?play=1");
await p.waitForFunction(() => document.title === "done", null, { timeout: 120000, polling: 250 });
const v = await p.video().path();
await ctx.close(); await b.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", v, "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", "-an", path.join(dir, "proto-walkthrough.mp4")]);
console.log("ok");
