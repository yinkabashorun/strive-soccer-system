// node render3.mjs  -> 13-club-team.png ... 18-result.png and all3.png
import { createRequire } from "module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
import { fileURLToPath } from "url";
import path from "path";
const dir = path.dirname(fileURLToPath(import.meta.url));
const names = { 13: "13-club-team", 14: "14-strive-events", 15: "15-pick-roster", 16: "16-clubs-near-you", 17: "17-pick-a-slot", 18: "18-result" };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
for (const [n, name] of Object.entries(names)) {
  await p.goto("file://" + path.join(dir, "mock3.html") + "?s=" + n);
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(dir, name + ".png") });
}
const all = await b.newContext({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 1.5 });
const q = await all.newPage();
await q.goto("file://" + path.join(dir, "mock3.html"));
await q.waitForTimeout(400);
await q.screenshot({ path: path.join(dir, "all3.png"), fullPage: true });
await b.close();
