// node render2.mjs  -> 5-profile.png ... 12-my-week-lower.png and all2.png
import { createRequire } from "module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
import { fileURLToPath } from "url";
import path from "path";
const dir = path.dirname(fileURLToPath(import.meta.url));
const names = { 5: "5-profile", 6: "6-post-menu", 7: "7-club", 8: "8-club-ranking", 9: "9-invite", 10: "10-sign-up-step", 11: "11-settings", 12: "12-my-week-lower" };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
for (const [n, name] of Object.entries(names)) {
  await p.goto("file://" + path.join(dir, "mock2.html") + "?s=" + n);
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(dir, name + ".png") });
}
const all = await b.newContext({ viewport: { width: 1780, height: 900 }, deviceScaleFactor: 1.5 });
const q = await all.newPage();
await q.goto("file://" + path.join(dir, "mock2.html"));
await q.waitForTimeout(400);
await q.screenshot({ path: path.join(dir, "all2.png"), fullPage: true });
await b.close();
