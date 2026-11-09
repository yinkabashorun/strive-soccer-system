import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import path from 'path';
const scale = Number(process.argv[2] || 1), out = process.argv[3] || 'collage.png';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: scale });
await p.goto('file://' + path.resolve('collage.html'));
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
await p.screenshot({ path: out }); await b.close();
