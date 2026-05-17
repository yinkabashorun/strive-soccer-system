#!/usr/bin/env node
// Fire one Fal.ai text-to-video job using the Strive Soccer house prompt,
// poll until it's done, print the video URL. Run from your local machine:
//
//   node scripts/test-fal-video.mjs
//
// Loads FAL_KEY (and optional FAL_MODEL) from .env.local in the repo root.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  console.error(`Couldn't read ${envPath}. Make sure you ran this from the repo root.`);
  process.exit(1);
}

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  console.error("FAL_KEY missing from .env.local");
  process.exit(1);
}

const MODEL = process.env.FAL_MODEL || "fal-ai/kling-video/v1.6/standard/text-to-video";
const BASE = "https://queue.fal.run";

const PROMPT =
  "a young male soccer player in a Strive Soccer jersey doing an advanced dribbling move on a professional pitch, cinematic close-up, golden hour lighting, UGC style vertical video 9:16";

const headers = {
  Authorization: `Key ${FAL_KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

console.log(`→ Submitting to ${MODEL}`);
console.log(`  Prompt: ${PROMPT}\n`);

const submitRes = await fetch(`${BASE}/${MODEL}`, {
  method: "POST",
  headers,
  body: JSON.stringify({ prompt: PROMPT, duration: "5", aspect_ratio: "9:16" }),
});

if (!submitRes.ok) {
  console.error(`Submit failed: HTTP ${submitRes.status}`);
  console.error(await submitRes.text());
  process.exit(1);
}

const submit = await submitRes.json();
const requestId = submit.request_id;
console.log(`  request_id: ${requestId}`);
console.log(`  initial status: ${submit.status}\n`);

const started = Date.now();
const timeoutMs = 10 * 60 * 1000;

while (Date.now() - started < timeoutMs) {
  await new Promise((r) => setTimeout(r, 5000));
  const sRes = await fetch(`${BASE}/${MODEL}/requests/${requestId}/status`, { headers });
  if (!sRes.ok) {
    console.error(`Status check failed: HTTP ${sRes.status}`);
    console.error(await sRes.text());
    process.exit(1);
  }
  const s = await sRes.json();
  const elapsed = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`  [${elapsed}s] ${s.status}`);

  if (s.status === "COMPLETED") {
    const rRes = await fetch(`${BASE}/${MODEL}/requests/${requestId}`, { headers });
    const r = await rRes.json();
    const url = r?.video?.url ?? r?.output?.video?.url;
    console.log("\n✓ Video ready");
    console.log(`  URL: ${url}`);
    console.log(`  Full result:\n${JSON.stringify(r, null, 2)}`);
    process.exit(0);
  }

  if (s.status === "FAILED" || s.status === "ERROR") {
    console.error("\n✗ Generation failed");
    console.error(JSON.stringify(s, null, 2));
    process.exit(1);
  }
}

console.error(`\nTimed out after ${timeoutMs / 1000}s waiting for completion.`);
process.exit(1);
