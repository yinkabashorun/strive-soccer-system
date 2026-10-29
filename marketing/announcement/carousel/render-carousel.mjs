// Renders carousel.html slide by slide to slides/NN.png (1080x1350).
// usage: node render-carousel.mjs [count]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CHROME = [process.env.CHROME,
  "/opt/pw-browsers/chromium", "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome",
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => p && existsSync(p));
if (!CHROME) { console.error("no Chrome found; set CHROME=/path/to/chrome"); process.exit(1); }

const count = Number(process.argv[2] || 7), port = 9351, w = 1080, h = 1350;
mkdirSync("slides", { recursive: true });
const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${port}`, `--window-size=${w},${h}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
await new Promise((ok) => chrome.stderr.on("data", (d) => { if (String(d).includes("DevTools listening")) ok(); }));
await new Promise((r) => setTimeout(r, 300));
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((ok) => (ws.onopen = ok));
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
for (let n = 1; n <= count; n++) {
  await send("Page.navigate", { url: "file://" + resolve("carousel.html") + `?slide=${n}` });
  await new Promise((r) => setTimeout(r, 700));
  await send("Runtime.evaluate", { expression: "document.fonts.ready.then(()=>true)", awaitPromise: true });
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`slides/${String(n).padStart(2, "0")}.png`, Buffer.from(shot.result.data, "base64"));
}
console.log(`wrote ${count} slides`);
ws.close(); chrome.kill();
