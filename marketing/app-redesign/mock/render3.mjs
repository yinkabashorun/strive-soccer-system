// node render3.mjs  -> 1-home.png ... 7-you.png and all3.png
import { createRequire } from "module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
import { fileURLToPath } from "url";
import path from "path";
const dir = path.dirname(fileURLToPath(import.meta.url));
const names = { 1: "1-home", 2: "2-drill", 3: "3-timer", 4: "4-complete", 5: "5-week", 6: "6-courses", 7: "7-you" };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
for (const [n, name] of Object.entries(names)) {
  await p.goto("file://" + path.join(dir, "mock3.html") + "?s=" + n);
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(dir, name + ".png") });
}
const all = await b.newContext({ viewport: { width: 1780, height: 900 }, deviceScaleFactor: 1 });
const q = await all.newPage();
await q.goto("file://" + path.join(dir, "mock3.html"));
await q.waitForTimeout(400);
await q.screenshot({ path: path.join(dir, "all3.png"), fullPage: true });
await b.close();
