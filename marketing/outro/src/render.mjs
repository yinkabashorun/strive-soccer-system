// Renders outro.html frame by frame through headless Chrome's DevTools
// protocol (Node 22 has a global WebSocket, so no driver needed).
// usage: node render.mjs <width> <height> <fps> <seconds> <outDir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [w, h, fps, secs, outDir] = [
  Number(process.argv[2] || 1080), Number(process.argv[3] || 1920),
  Number(process.argv[4] || 30), Number(process.argv[5] || 3.6),
  process.argv[6] || "frames",
];
mkdirSync(outDir, { recursive: true });
const port = Number(process.argv[7] || 9333);
const chrome = spawn("/opt/pw-browsers/chromium-1194/chrome-linux/chrome", [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${port}`, `--window-size=${w},${h}`, "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
await new Promise((ok) => chrome.stderr.on("data", (d) => { if (String(d).includes("DevTools listening")) ok(); }));
await new Promise((r) => setTimeout(r, 300));
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok) => (ws.onopen = ok));
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
await send("Page.enable");
await send("Page.navigate", { url: "file://" + resolve("outro.html") });
await new Promise((r) => setTimeout(r, 800));
await send("Runtime.evaluate", { expression: "window.ready", awaitPromise: true });
await new Promise((r) => setTimeout(r, 200));

const n = Math.round(fps * secs);
for (let i = 0; i < n; i++) {
  const t = i / fps;
  await send("Runtime.evaluate", { expression: `seek(${t})` });
  const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 96 });
  writeFileSync(`${outDir}/f${String(i).padStart(4, "0")}.jpg`, Buffer.from(shot.result.data, "base64"));
}
console.log(`rendered ${n} frames at ${w}x${h}`);
ws.close(); chrome.kill();
