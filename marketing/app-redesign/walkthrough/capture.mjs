// node walkthrough/capture.mjs -> walkthrough/shots/*.jpg (screens for the walkthrough page)
import { createRequire } from "module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
import { fileURLToPath } from "url";
import path from "path";
import { execFileSync } from "child_process";
const here = path.dirname(fileURLToPath(import.meta.url));
const mock = path.join(here, "..", "mock");
const out = path.join(here, "shots");
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const shot = async (name) => { const f = path.join(out, name + ".png"); await p.screenshot({ path: f }); return f; };
const files = [];
// static screens from the approved mock
const m4 = { home: 1, drill: 2, timer: 3, finish: 4, week: 5, courses: 6 };
for (const [n, s] of Object.entries(m4)) {
  await p.goto("file://" + path.join(mock, "mock4.html") + "?s=" + s); await p.waitForTimeout(400);
  files.push(await shot(n));
}
// motion prototype states
const proto = "file://" + path.join(mock, "proto.html");
await p.goto(proto); await p.waitForTimeout(4200); files.push(await shot("door"));
await p.click("#welcome .wbtn"); await p.waitForTimeout(700);
await p.locator("[data-pick]").first().click(); await p.waitForTimeout(300); files.push(await shot("quiz"));
await p.waitForTimeout(2550); files.push(await shot("build"));
await p.waitForTimeout(2900); files.push(await shot("drop"));
await p.click("#drop .wbtn"); await p.waitForTimeout(900);
await p.click("#start"); await p.waitForTimeout(2550); files.push(await shot("countin"));
await p.waitForTimeout(9000);
await p.evaluate(() => { document.querySelectorAll(".scr").forEach(s => { s.classList.remove("on"); s.style.opacity = ""; }); document.querySelector("#you").classList.add("on"); });
await p.waitForTimeout(300); files.push(await shot("you"));
await b.close();
for (const f of files) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", f, "-q:v", "3", f.replace(/\.png$/, ".jpg")]);
for (const f of files) execFileSync("rm", [f]);
console.log("ok");
