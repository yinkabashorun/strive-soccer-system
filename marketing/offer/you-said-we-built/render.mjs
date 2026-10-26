// Full-page screenshot of page.html at 1080 wide through headless Chrome's
// DevTools protocol (no driver). usage: node render.mjs [page.html] [out.png]
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CHROME = [process.env.CHROME,
  "/opt/pw-browsers/chromium", "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome",
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => p && existsSync(p));
if (!CHROME) { console.error("no Chrome found; set CHROME=/path/to/chrome"); process.exit(1); }

const file = process.argv[2] || "page.html", out = process.argv[3] || "you-said-we-built-1080.png";
const port = 9350, w = 1080;
const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${port}`, `--window-size=${w},1920`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
await new Promise((ok) => chrome.stderr.on("data", (d) => { if (String(d).includes("DevTools listening")) ok(); }));
await new Promise((r) => setTimeout(r, 300));
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((ok) => (ws.onopen = ok));
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: w, height: 1920, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "file://" + resolve(file) });
await new Promise((r) => setTimeout(r, 900));
await send("Runtime.evaluate", { expression: "document.fonts.ready.then(()=>true)", awaitPromise: true });
const h = (await send("Runtime.evaluate", { expression: "document.documentElement.scrollHeight" })).result.result.value;
await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
await new Promise((r) => setTimeout(r, 300));
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log(`wrote ${out} ${w}x${h}`);
ws.close(); chrome.kill();
