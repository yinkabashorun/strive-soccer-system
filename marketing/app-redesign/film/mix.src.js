// The cut films: the same app, edited like a mixtape. Every shot starts on
// the beat (120 BPM), plays a stretch of the master walkthrough at its own
// speed so the taps land on the beat, and carries its own camera and one
// slammed line. ?cut=long (about a minute) or ?cut=short (15 seconds).
// ?cut=short-song is the short cut laid on the song Coach Yinka sent: a cut
// with `song` counts in that song's measured beats (song-beats.json, 172 BPM),
// beat 0 = the song's beat `from`, and every time below follows those beats.
import { setup as setupApp, renderApp } from "./film.src.js";
import SONG1 from "./song-beats.json" with { type: "json" };
import SONGL from "./song-beats-loop.json" with { type: "json" };

const $ = (s, r = document) => r.querySelector(s);
const cl = (x) => Math.max(0, Math.min(1, x));
const lin = (t, a, b) => cl((t - a) / (b - a));
const out3 = (x) => 1 - Math.pow(1 - x, 3);
const inout = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const mix = (a, b, k) => a + (b - a) * k;
const st = (el, css) => { for (const k in css) el.style[k] = css[k]; };

export const BPM = 120;
const B = 60 / BPM;

// screen points the camera can push into (screen px, 390 x 844)
const P = { card: [195, 525], tiles: [195, 480], steps: [195, 420], cards: [195, 430], hero: [195, 400], count: [195, 430],
  drill: [195, 560], ring: [195, 320], fring: [195, 240], dots: [110, 600], ycard: [195, 190], mid: [195, 422],
  kyou: [195, 260], kpod: [195, 300], kprops: [110, 600], kstar: [150, 250] };
const C = (s = 1, f = "mid", y = 0, ry = 0) => ({ s, f: P[f], y, ry });

// shot: [beat, beats, masterFrom, masterTo, camera keys [[frac, cam]...]]
// words: [beat, text]  (*word* is gold); flash: beats; done: beats (a pop on Done)
export const CUTS = {
  long: {
    len: 112,
    open: [[0, "STRIVE"], [1, "*ELITE*"], [2.5, "ON IPHONE."]], openOut: 4,
    shots: [
      [4, 8, 2.9, 7.4, [[0, C(0.9, "mid", 420)], [0.32, C(1)], [0.55, C(1.16, "card")], [0.85, C(1)]]],
      [12, 5, 7.42, 9.45, [[0, C(1)], [1, C(1.06, "mid")]]],
      [17, 5, 9.45, 11.95, [[0, C(1.0)], [0.4, C(1.14, "tiles")], [1, C(1.14, "tiles")]]],
      [22, 5, 13.15, 15.4, [[0, C(1.0)], [1, C(1.2, "steps")]]],
      [27, 7, 16.3, 19.9, [[0, C(1.0)], [1, C(1.06)]]],
      [34, 4, 20.5, 22.65, [[0, C(1.0)], [1, C(1.08, "hero")]]],
      [38, 3, 22.65, 24.05, [[0, C(1.0)], [1, C(1.04)]]],
      [41, 3, 24.1, 26.68, [[0, C(1.18, "count")], [1, C(1.3, "count")]]],
      [44, 11, 26.65, 32.15, [[0, C(1.0)], [1, C(1.05, "drill")]]],
      [55, 7, 32.2, 36.4, [[0, C(1.0)], [0.3, C(1.14, "ring")], [0.9, C(1.14, "ring")], [1, C(1)]]],
      [62, 2, 36.6, 37.6, [[0, C(1.04, "drill")], [1, C(1.0)]]],
      [64, 12, 37.55, 43.3, [[0, C(1.0)], [0.15, C(1.36, "fring")], [0.42, C(1.36, "fring")], [0.6, C(1.0)], [1, C(1.0)]]],
      [76, 6, 43.3, 46.3, [[0, C(1.0)], [0.25, C(1.35, "dots")], [1, C(1.35, "dots")]]],
      [82, 4, 46.85, 48.85, [[0, C(1.0)], [1, C(1.05)]]],
      [86, 4, 49.15, 51.15, [[0, C(1.0)], [1, C(1.05)]]],
      [90, 6, 51.45, 54.45, [[0, C(1.0)], [0.3, C(1.22, "ycard")], [1, C(1.22, "ycard")]]],
    ],
    words: [[5, "YOU'RE *IN.*"], [12, "A QUICK *QUIZ.*"], [17, "WHAT HOLDS YOU *BACK?*"], [22, "BUILT AROUND *YOU.*"],
      [27, "YOUR WEEK IS *HERE.*"], [34, "ONE CARD. ONE *BUTTON.*"], [38, "GRAB YOUR *BALL.*"], [41, ""],
      [44, "ONE DRILL AT A *TIME.*"], [47, "*DONE.*"], [50, "*DONE.*"], [53, "*DONE.*"], [55.5, "THE TIMER RUNS EVERY *SET.*"],
      [62, ""], [63, "*DONE.*"], [64, "SESSION *DONE.*"], [70, "YOUR TIME ONLY GOES *UP.*"], [76, "ONE CIRCLE *FILLED.*"],
      [82, "YOUR WHOLE *WEEK.*"], [86, "COURSES ON *TOP.*"], [90, "YOUR CARD. YOUR *TIME.*"], [96, ""]],
    flash: [28, 67], done: [47, 50, 53, 63], shimmer: [66.8], deviceOut: 96, tension: [38, 44],
    end: [[97, "OPEN STRIVE."], [98, "TAP START."], [99, "*TRAIN.*"]], mark: 101,
  },
  short: {
    len: 31,
    open: [[0, "YOUR WEEK."], [1, "BUILT FOR *YOU.*"]], openOut: 2,
    shots: [
      [2, 2, 4.4, 5.9, [[0, C(1.0, "mid", 300)], [0.35, C(1.1, "card")], [1, C(1.25, "card")]]],
      [4, 2, 10.4, 11.4, [[0, C(1.1, "tiles")], [1, C(1.2, "tiles")]]],
      [6, 2, 16.3, 17.5, [[0, C(1.0)], [1, C(1.08)]]],
      [8, 2, 22.0, 23.3, [[0, C(1.08, "hero")], [1, C(1.0)]]],
      [10, 3, 24.1, 26.68, [[0, C(1.22, "count")], [1, C(1.34, "count")]]],
      [13, 3, 27.35, 31.85, [[0, C(1.0)], [1, C(1.08, "drill")]]],
      [16, 4, 37.7, 40.1, [[0, C(1.0)], [0.2, C(1.38, "fring")], [0.65, C(1.38, "fring")], [1, C(1.05)]]],
      [20, 2, 43.5, 44.7, [[0, C(1.15, "dots")], [1, C(1.4, "dots")]]],
      [22, 2, 52.0, 53.4, [[0, C(1.05, "ycard")], [1, C(1.25, "ycard")]]],
    ],
    words: [[2, "YOU'RE *IN.*"], [4, "ONE *TAP.*"], [6, "YOUR *WEEK.*"], [8, "TAP *START.*"], [10, ""],
      [13.5, "*DONE.*"], [14.5, "*DONE.*"], [15.5, "*DONE.*"], [16, "SESSION *DONE.*"], [20, "ONE CIRCLE *DOWN.*"],
      [22, "YOUR *CARD.*"], [24, ""]],
    flash: [6, 18], done: [13.5, 14.5, 15.5], shimmer: [18], deviceOut: 24, tension: [10, 13],
    end: [[24.5, "OPEN STRIVE."], [25.5, "TAP START."], [26.5, "*TRAIN.*"]], mark: 28,
  },
  // the short cut on his song: one beat = one song beat (172 BPM, ~0.35 s);
  // starts on song beat 3, two intro hits carry the opening words, the band
  // comes in on beat 9 (cut beat 6) with the first shot, every shot on a downbeat
  // or a half bar, the 3 2 1 on three beats in a row, the end words on three.
  "short-song": {
    song: { from: 3, loop: true },
    len: 136,
    open: [[1, "YOUR WEEK."], [4, "BUILT FOR *YOU.*"]], openOut: 6,
    shots: [
      // day one
      [6, 6, 4.0, 7.3, [[0, C(1.0, "mid", 300)], [0.4, C(1.08, "card")], [1, C(1.16, "card")]]],
      [12, 6, 7.4, 11.4, [[0, C(1.06)], [0.5, C(1.06)], [1, C(1.14, "tiles")]]],
      [18, 6, 12.9, 15.6, [[0, C(1.04)], [1, C(1.12, "steps")]]],
      [24, 6, 15.9, 18.6, [[0, C(1.0)], [1, C(1.08, "cards")]]],
      // every session
      [30, 4, 20.3, 22.7, [[0, C(1.04, "hero")], [1, C(1.1, "hero")]]],
      [34, 8, 24.08, 27.52, [[0, C(1.18, "count")], [1, C(1.3, "count")]]],
      [42, 10, 27.1, 32.1, [[0, C(1.0)], [1, C(1.08, "drill")]]],
      [52, 6, 32.6, 35.6, [[0, C(1.0)], [1, C(1.06)]]],
      [58, 8, 37.5, 41.0, [[0, C(1.0)], [0.2, C(1.3, "fring")], [0.6, C(1.3, "fring")], [1, C(1.04)]]],
      [66, 4, 43.4, 44.9, [[0, C(1.12, "dots")], [1, C(1.3, "dots")]]],
      // between sessions
      [70, 4, 47.0, 48.9, [[0, C(1.02)], [1, C(1.08)]]],
      [74, 4, 49.3, 51.3, [[0, C(1.02)], [1, C(1.08)]]],
      [78, 4, 52.0, 53.4, [[0, C(1.05, "ycard")], [1, C(1.2, "ycard")]]],
      // clubs and friends
      [82, 8, 61.4, 64.4, [[0, C(1.06)], [1, C(1.12)]]],
      [90, 8, 64.5, 67.0, [[0, C(1.04)], [1, C(1.12)]]],
      [98, 8, 67.0, 70.2, [[0, C(1.06)], [0.55, C(1.1)], [0.8, C(1.3, "kyou")], [1, C(1.34, "kyou")]]],
      [106, 6, 72.5, 74.9, [[0, C(1.0)], [0.25, C(1.0)], [0.4, C(1.3, "kprops")], [0.7, C(1.3, "kprops")], [1, C(1.05)]]],
      [112, 8, 75.45, 78.09, [[0, C(1.04)], [0.4, C(1.12)], [0.55, C(1.32, "kstar")], [1, C(1.38, "kstar")]]],
      [120, 8, 78.17, 81.13, [[0, C(1.05)], [0.4, C(1.25, "kyou")], [1, C(1.3, "kyou")]]],
    ],
    words: [[6, "YOU'RE *IN.*"], [12, "A QUICK *QUIZ.*"], [15, "WHAT HOLDS YOU *BACK?*"], [18, "BUILT AROUND *YOU.*"],
      [24, "YOUR WEEK. *EVERY MONDAY.*"], [30, "TAP *START.*"], [34, ""], [42, "ONE DRILL AT A *TIME.*"],
      [44, "*DONE.*"], [47, "*DONE.*"], [50, "*DONE.*"], [52, "THE TIMER RUNS *EVERY SET.*"], [58, "SESSION *DONE.*"],
      [62, "YOUR TIME ONLY GOES *UP.*"], [66, "ONE CIRCLE *DOWN.*"], [70, "YOUR WHOLE *WEEK.*"], [74, "COURSES ON *TOP.*"],
      [78, "YOUR *CARD.*"], [82, "YOUR *CLUBS.*"], [84, "YOUR CLUB *TEAM.*"], [86, "YOUR PICKUP *SQUAD.*"],
      [88, "YOUR HIGH *SCHOOL.*"], [90, "AND *STRIVE SOCCER.*"], [98, "COMPETE WITH YOUR *FRIENDS.*"], [104, "MOVE *UP.*"],
      [106, "SHARE YOUR *TRAINING.*"], [108, "GIVE *PROPS.*"], [112, "THE BEST GET A *STAR.*"],
      [116, "WILL YOU BE THE NEXT *STRIVE STAR?*"], [120, "OUTWORK YOUR *COACH.*"], [128, ""]],
    flash: [24, 61, 104, 124], done: [44, 47, 50], shimmer: [61], deviceOut: 128, tension: [34, 42],
    end: [[129, "OPEN STRIVE."], [130, "TAP START."], [131, "*TRAIN.*"]], mark: 132,
  },
};

const cutName = new URLSearchParams(location.search).get("cut") || "long";
const CUT = CUTS[cutName];
// a song cut can run on the looped song (song-loop.py): its beat times, and SONG= points at the looped audio
const SONG = CUT.song && CUT.song.loop ? SONGL : SONG1;

// beat <-> seconds. A plain cut is a straight 120 BPM grid; a song cut follows
// the measured beats of the song, so a beat that comes a hair early or late in
// the recording still gets its cut on it.
const GRID = (() => {
  if (!CUT.song) return null;
  const b = SONG.beats, from = CUT.song.from, p = 60 / SONG.bpm, t0 = b[from], out = [];
  for (let i = 0; i <= CUT.len + 1; i++) { const j = from + i; out.push((j < b.length ? b[j] : b[b.length - 1] + (j - b.length + 1) * p) - t0); }
  return out;
})();
const tb = (beat) => {
  if (!GRID) return beat * B;
  const i = Math.max(0, Math.min(GRID.length - 2, Math.floor(beat)));
  return GRID[i] + (GRID[i + 1] - GRID[i]) * (beat - i);
};
const bt = (t) => {
  if (!GRID) return t / B;
  let i = 0; while (i < GRID.length - 2 && GRID[i + 1] <= t) i++;
  return i + (t - GRID[i]) / (GRID[i + 1] - GRID[i]);
};
export const DURATION = tb(CUT.len);
export const CUT_INFO = { name: cutName, bpm: CUT.song ? SONG.bpm : BPM, song: CUT.song ? { from: CUT.song.from, start: SONG.beats[CUT.song.from] } : null, len: CUT.len, flash: CUT.flash, done: CUT.done, shimmer: CUT.shimmer,
  open: CUT.open.map((w) => w[0]), end: CUT.end.map((w) => w[0]), cuts: CUT.shots.map((s) => s[0]), deviceOut: CUT.deviceOut, tension: CUT.tension, mark: CUT.mark, drop: CUT.shots[0][0] };

let k = 0.789;
export function setup() {
  setupApp();
  k = $("#scrwrap").clientWidth / 390;
}

const gold = (s) => s.replace(/\*(.+?)\*/g, '<span class="metal">$1</span>');

function camAt(keys, f) {
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) if (f >= keys[i][0] && f <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  const p = a === b ? 1 : inout(cl((f - a[0]) / (b[0] - a[0])));
  const A = a[1], Z = b[1];
  return { s: mix(A.s, Z.s, p), fx: mix(A.f[0], Z.f[0], p), fy: mix(A.f[1], Z.f[1], p), y: mix(A.y, Z.y, p), ry: mix(A.ry, Z.ry, p) };
}

function wordOn(beat) { let w = null; for (const x of CUT.words) if (beat >= x[0]) w = x; return !!(w && w[1]); }

export function render(t) {
  const beat = bt(t), dev = $("#device"), glow = $("#glow");
  // the shot on screen
  let shot = null, si = -1;
  CUT.shots.forEach((s, i) => { if (beat >= s[0] && beat < s[0] + s[1]) { shot = s; si = i; } });
  const outK = lin(beat, CUT.deviceOut, CUT.deviceOut + 0.6);
  if (shot) {
    const [b0, n, m0, m1, cam] = shot;
    const f = (beat - b0) / n;
    renderApp(mix(m0, m1, f));
    const c = camAt(cam, f);
    // a hard cut on the beat with a short whip in from alternating sides
    const since = t - tb(b0), dir = si % 2 ? -1 : 1;
    const whip = si === 0 ? 0 : 1 - out3(cl(since / 0.16));
    const until = tb(b0 + n) - t, leaveW = 1 - cl(until / 0.06);
    const pulse = 1 + 0.012 * Math.exp(-((beat % 1) * 8));
    const fx = 11 + c.fx * k, fy = 11 + c.fy * k, cx = 165, cy = 357;
    const pull = cl((c.s - 1) * 2.2);
    // while a line is on screen the phone never rises into it
    let ty = (cy - fy) * pull + c.y;
    if (wordOn(beat)) ty = Math.max(ty, -10 + (11 + c.fy * k) * (c.s - 1));
    st(dev, {
      opacity: 1 - outK,
      transformOrigin: `${fx}px ${fy}px`,
      transform: `translate(${(cx - fx) * pull + whip * 70 * dir}px, ${ty}px) scale(${c.s * pulse * mix(1, 0.92, outK)}) rotateY(${c.ry}deg)`,
      filter: `blur(${(whip + leaveW) * 5}px)`,
    });
  } else {
    st(dev, { opacity: 0 });
  }
  st(glow, { opacity: shot ? 0.55 + 0.35 * Math.exp(-((beat % 1) * 5)) : 0 });

  // the slammed line
  const kin = $("#kin");
  let w = null; for (const x of CUT.words) if (beat >= x[0]) w = x;
  if (w && w[1] && beat < CUT.deviceOut) {
    if (kin.dataset.t !== w[1]) { kin.innerHTML = `<span>${gold(w[1])}</span>`; kin.dataset.t = w[1]; }
    const d = t - tb(w[0]), s = out3(cl(d / 0.14));
    st(kin, { opacity: cl(d / 0.05), transform: `scale(${mix(1.28, 1, s)})`, filter: `blur(${(1 - s) * 7}px)` });
  } else st(kin, { opacity: 0 });

  // open and end words, stacked in the middle
  const big = $("#big");
  const showOpen = beat < CUT.openOut + 0.5, list = showOpen ? CUT.open : CUT.end;
  const fade = showOpen ? 1 - lin(beat, CUT.openOut - 0.1, CUT.openOut + 0.3) : 1;
  const html = list.map((x, i) => `<div class="bl" data-i="${i}">${gold(x[1])}</div>`).join("");
  if (big.dataset.h !== html) { big.innerHTML = html; big.dataset.h = html; }
  [...big.children].forEach((el, i) => {
    const d = t - tb(list[i][0]), s = out3(cl(d / 0.14));
    st(el, { opacity: d < 0 ? 0 : cl(d / 0.05) * fade, transform: `scale(${mix(1.3, 1, s)})`, filter: `blur(${(1 - s) * 8}px)` });
  });
  const mk = $("#mark"), md = t - tb(CUT.mark);
  st(mk, { opacity: md < 0 ? 0 : out3(cl(md / 0.5)), transform: `translateY(${(1 - out3(cl(md / 0.5))) * 10}px)` });

  // the white flash on the big moments
  let fl = 0; for (const fb of CUT.flash) { const d = t - tb(fb); if (d >= 0 && d < 0.16) fl = Math.max(fl, 0.32 * (1 - d / 0.16)); }
  st($("#flash"), { opacity: fl });
}
