// node render.mjs  -> 1-friends-locked.png ... 4-my-week.png and all.png
import { createRequire } from "module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
import { fileURLToPath } from "url";
import path from "path";
const dir = path.dirname(fileURLToPath(import.meta.url));
const names = ["1-friends-locked", "2-post", "3-friends", "4-my-week"];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
for (let i = 0; i < 4; i++) {
  await p.goto("file://" + path.join(dir, "mock.html") + "?s=" + (i + 1));
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(dir, names[i] + ".png") });
}
const all = await b.newContext({ viewport: { width: 1728, height: 900 }, deviceScaleFactor: 1.5 });
const q = await all.newPage();
await q.goto("file://" + path.join(dir, "mock.html"));
await q.waitForTimeout(400);
await q.screenshot({ path: path.join(dir, "all.png"), fullPage: true });
await b.close();
