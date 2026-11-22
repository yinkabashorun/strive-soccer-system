// Phone-size screenshots of the built member app, for comparing against
// the approved mock (../mock/mock4.html) and the film (../film/film.html).
// Run against a local build in demo mode (no Supabase env):
//   npx next build && npx next start -p 3311
//   node marketing/app-redesign/built-app/capture.mjs [http://localhost:3311]
// Writes one PNG per screen here and sheet.png, the contact sheet.
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
const dir = path.dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || "http://localhost:3311";

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
const p = await ctx.newPage();
const shot = async (name, wait = 900) => {
  await p.waitForTimeout(wait);
  await p.screenshot({ path: path.join(dir, `${name}.png`) });
  console.log("saved", name);
};

// The example player: login -> "See the app as a player".
await p.goto(`${base}/login`);
await p.getByRole("button", { name: /See the app as a player/ }).click();
await p.waitForURL(/dashboard/);
// Skip the in-page tour guide so the screens read as a member sees them.
await p.evaluate(() => {
  try {
    for (const k of Object.keys(localStorage)) if (k.includes("drop_seen")) localStorage.removeItem(k);
  } catch {}
});

// 01 the door, 02 to 04 the quiz, 05 building (the example walk, ?tour=1)
await p.goto(`${base}/onboarding?tour=1`);
await shot("01-door", 2600);
await p.getByRole("button", { name: "Build my week" }).click();
await shot("02-quiz-gender", 700);
await p.getByRole("button", { name: "Boy", exact: true }).click();
await shot("03-quiz-team", 1000);
await p.getByRole("button", { name: "Three or four times" }).click();
await shot("04-quiz-holds-back", 1000);
await p.getByRole("button", { name: /Weak foot\. I only trust one foot/ }).click();
await p.waitForTimeout(800);
await p.getByRole("button", { name: "14", exact: true }).click();
await p.waitForTimeout(700);
await p.getByRole("button", { name: "Winger" }).click();
await p.waitForTimeout(700);
await p.getByRole("button", { name: "Right foot" }).click();
await p.waitForTimeout(700);
await p.getByRole("button", { name: "Competitive" }).click();
await p.waitForTimeout(700);
await shot("05-quiz-space", 200);
await p.getByRole("button", { name: /Room to run/ }).click();
await p.waitForTimeout(700);
await p.getByRole("switch", { name: /A wall I can pass against/ }).click();
await shot("06-quiz-nearby", 300);
await p.getByRole("button", { name: "Next" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Skip" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Skip" }).click();
await p.waitForTimeout(500);
await shot("07-quiz-ratings", 200);
await p.getByRole("button", { name: "Next" }).click();
await p.waitForTimeout(500);
await p.getByLabel("Parent or guardian name").fill("Dana Example");
await shot("08-quiz-parent", 200);
await p.getByRole("button", { name: "Build my week" }).click();
await shot("09-building", 1100);
await p.waitForURL(/dashboard/, { timeout: 15000 });

// 10 the drop. The example week already has drills done, so the drop
// (once per new week, before anything is done) is replayed with ?drop=1.
await p.goto(`${base}/dashboard?drop=1`);
await shot("10-drop", 2000);
const go = p.getByRole("button", { name: "Let's go" });
if (await go.count()) await go.click();
await shot("11-home", 900);
// Scrolled to the end: the last card sits clear of the tab bar.
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await shot("11b-home-scrolled", 600);
await p.evaluate(() => window.scrollTo(0, 0));

// 12 the count-in, 13 a drill, 14 the check, 15 the finish
await p.getByRole("button", { name: /Start session|Continue session/ }).click();
await shot("12-count-in", 1500);
await p.getByRole("button", { name: /Skip the count-in/ }).click().catch(() => undefined);
await shot("13-drill", 1200);
// Tick every drill in the session to reach the finish screen.
for (let i = 0; i < 8; i++) {
  if (await p.getByRole("heading", { name: /done,/i }).count()) break;
  const done = p.getByRole("button", { name: /^Done$/ });
  if (!(await done.count())) break;
  await done.first().click();
  if (i === 0) await shot("14-done-check", 180);
  await p.waitForTimeout(900);
}
await shot("15-finish", 1800);
await p.getByRole("button", { name: /^Done$/ }).click().catch(() => undefined);
await p.waitForTimeout(800);
await shot("16-home-after", 900);

// The tabs
await p.goto(`${base}/homework`);
await shot("17-week", 1200);
await p.goto(`${base}/courses`);
await shot("18-courses", 1500);
await p.goto(`${base}/you`);
await shot("19-you", 1800);
await p.goto(`${base}/messages`);
await shot("20-coach", 1000);

await b.close();

// The contact sheet
const sheet = await chromium.launch();
const sp = await (await sheet.newContext({ viewport: { width: 1700, height: 900 } })).newPage();
const names = [
  "01-door", "02-quiz-gender", "03-quiz-team", "04-quiz-holds-back", "05-quiz-space", "06-quiz-nearby", "07-quiz-ratings",
  "08-quiz-parent", "09-building", "10-drop", "11-home", "12-count-in", "13-drill", "14-done-check", "15-finish",
  "16-home-after", "17-week", "18-courses", "19-you", "20-coach",
];
const html = `<body style="margin:0;background:#1b1b1b;font:600 13px system-ui;color:#ccc;display:flex;flex-wrap:wrap;gap:18px;padding:18px">${names
  .map((n) => `<figure style="margin:0;width:312px"><img src="file://${path.join(dir, n + ".png")}" style="width:312px;border-radius:26px;outline:1px solid #2a2a2a;display:block"><figcaption style="margin-top:6px">${n}</figcaption></figure>`)
  .join("")}</body>`;
const { writeFileSync } = await import("fs");
writeFileSync(path.join(dir, "sheet.html"), html);
await sp.goto("file://" + path.join(dir, "sheet.html"));
await sp.waitForTimeout(500);
await sp.screenshot({ path: path.join(dir, "sheet.png"), fullPage: true });
await sheet.close();
console.log("sheet.png");
