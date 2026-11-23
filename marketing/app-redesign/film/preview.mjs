// node film/preview.mjs t1 t2 ... -> single frames for checking.
// Needs a server in marketing/app-redesign: python3 -m http.server 8765
import { createRequire } from "module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
const ts = process.argv.slice(2).map(Number);
const out = process.env.OUT || "/tmp";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 })).newPage();
p.on("pageerror", (e) => console.log("ERR", e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text()); });
await p.goto("http://localhost:8765/film/" + (process.env.PAGE || "film.html"));
await p.waitForFunction(() => window.__ready, null, { timeout: 20000 });
for (const t of ts) { await p.evaluate((t) => window.__render(t), t); await p.screenshot({ path: `${out}/p-${t}.png` }); }
await b.close();
