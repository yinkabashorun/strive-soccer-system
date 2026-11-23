// Review screenshots of the native app's screens, drawn by the browser
// build with the example data (src/api/fixtures.ts). The iPhone itself
// cannot be run on Linux, so this checks layout only, at iPhone 15 size.
//
//   EXPO_PUBLIC_FIXTURES=1 EXPO_PUBLIC_MEDIA_BASE=http://localhost:8766 \
//     npx expo export --platform web --output-dir dist-web
//   PLAYWRIGHT=/path/to/playwright node scripts/screenshots.mjs
//
// Serves dist-web (every path falls back to index.html, like an app) and
// the site's public/ folder for the drill clips and stills, then saves one
// PNG per screen to ../marketing/app-redesign/native-app/.
import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, "../dist-web");
const pub = path.resolve(here, "../../public");
const out = path.resolve(here, "../../marketing/app-redesign/native-app");
const PORT = 8766;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".ttf": "font/ttf", ".ico": "image/x-icon", ".json": "application/json", ".wav": "audio/wav" };

const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const candidates = [path.join(web, p), path.join(pub, p)];
  let file = candidates.find((f) => existsSync(f) && statSync(f).isFile() && (f.startsWith(web) || f.startsWith(pub)));
  if (!file) file = path.join(web, "index.html");
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "access-control-allow-origin": "*" });
  res.end(await readFile(file));
});

const SHOTS = [
  ["01-sign-in", "/sign-in?state=signedout"],
  ["02-agreement", "/agreement?state=consent"],
  ["03-door", "/onboarding?state=onboarding"],
  ["04-quiz-team", "/onboarding/team?state=onboarding"],
  ["05-quiz-on-ball", "/onboarding/onBall?state=onboarding"],
  ["06-quiz-space", "/onboarding/space?state=onboarding"],
  ["07-username", "/profile-setup?state=setup"],
  ["08-photo", "/profile-setup?state=setup&edit=photo"],
  ["09-building", "/onboarding/building?state=onboarding&spot=your%20weak%20foot&sessions=four", 1150],
  ["10-home", "/"],
  ["11-drop", "/drop", 1800],
  ["12-session-count-in", "/session/4", 1300],
  ["13-session-drill", "/session/3", 4600],
  ["13b-next-drill", "/session/3", 4600, async (p) => {
    await p.getByLabel("Done", { exact: true }).click();
    await p.waitForTimeout(900);
  }],
  ["13c-set-timer", "/session/3", 4600, async (p) => {
    await p.getByLabel("Done", { exact: true }).click();
    await p.waitForTimeout(900);
    await p.getByLabel("Start the set timer").click();
    await p.waitForTimeout(2200);
  }],
  ["13d-finish", "/session/3", 4600, async (p) => {
    for (let i = 0; i < 4; i++) {
      await p.getByLabel("Done", { exact: true }).click();
      await p.waitForTimeout(800);
    }
    await p.waitForTimeout(1600);
  }],
  ["14-week", "/week"],
  ["15-you", "/you", 1500],
  ["16-extra", "/extra"],
  ["17-checkin", "/checkin"],
  ["18-settings", "/settings"],
  ["19-delete-account", "/delete-account"],
  ["20-gate", "/gate?state=membership"],
];

const pwPath = process.env.PLAYWRIGHT ?? "playwright";
const { chromium } = await import(pwPath.startsWith("/") ? pathToFileURL(path.join(pwPath, "index.mjs")).href : pwPath);
await mkdir(out, { recursive: true });
server.listen(PORT);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const fresh = () => browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
for (const [name, url, wait = 900, act] of SHOTS) {
  const ctx = await fresh(); // nothing cached from the screen before
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error(name, "page error:", e.message));
  await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(wait);
  if (act) await act(page);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log("saved", name);
  await ctx.close();
}
await browser.close();
server.close();
