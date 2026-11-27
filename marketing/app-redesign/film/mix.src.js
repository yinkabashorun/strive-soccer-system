// The cut films: the same app, edited like a mixtape. Every shot starts on
// the beat (120 BPM), plays a stretch of the master walkthrough at its own
// speed so the taps land on the beat, and carries its own camera and one
// slammed line. ?cut=long (about a minute) or ?cut=short (15 seconds).
// ?cut=short-song is the short cut laid on the song Coach Yinka sent: a cut
// with `song` counts in that song's measured beats (song-beats.json, 172 BPM),
// beat 0 = the song's beat `from`, and every time below follows those beats.
import { setup as setupApp, renderApp } from "./film.src.js";
import { setupFull, renderFull, FULL_FROM } from "./full.src.js";
import SONG1 from "./song-beats.json" with { type: "json" };
import SONGL from "./song-beats-loop.json" with { type: "json" };

const $ = (s, r = document) => r.querySelector(s);
const cl = (x) => Math.max(0, Math.min(1, x));
const lin = (t, a, b) => cl((t - a) / (b - a));
const out3 = (x) => 1 - Math.pow(1 - x, 3);
const outExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const inout = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const mix = (a, b, k) => a + (b - a) * k;
const st = (el, css) => { for (const k in css) el.style[k] = css[k]; };

export const BPM = 120;
const B = 60 / BPM;

// screen points the camera can push into (screen px, 390 x 844)
const P = { card: [195, 525], tiles: [195, 480], steps: [195, 420], cards: [195, 430], hero: [195, 400], count: [195, 430],
  drill: [195, 560], ring: [195, 320], fring: [195, 240], dots: [110, 600], ycard: [195, 190], mid: [195, 422],
  kyou: [195, 260], kpod: [195, 300], kprops: [110, 600], kstar: [150, 250],
  // the full-app cut's screens (full.screens.html)
  xhero: [195, 470], xstart: [195, 630], dig: [195, 365], rt: [130, 450], xpostb: [195, 700], post: [195, 470], xprops: [110, 560],
  wring: [110, 240], wrows: [195, 590], clubs: [195, 330], mu: [195, 530], champ: [150, 350], note: [195, 110],
  procard: [195, 640], bar: [110, 780], ylvl: [170, 300], med: [195, 560], qr: [195, 413], boxes: [195, 400], earn: [195, 560] };
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
    len: 118,
    open: [[1, "YOUR WEEK."], [4, "BUILT FOR *YOU.*"]], openOut: 6,
    shots: [
      // day one, in order: in, the quiz, the build, the week
      [6, 6, 4.2, 6.4, [[0, C(1.0, "mid", 300)], [0.35, C(1.1, "card")], [1, C(1.22, "card")]]],
      [12, 6, 7.3, 9.3, [[0, C(1.04)], [1, C(1.1)]]],
      [18, 4, 9.6, 11.5, [[0, C(1.08, "tiles")], [1, C(1.18, "tiles")]]],
      [22, 4, 12.9, 15.0, [[0, C(1.04)], [1, C(1.12, "steps")]]],
      [26, 4, 16.2, 17.8, [[0, C(1.0)], [1, C(1.08)]]],
      // the first session, start to finish
      [30, 4, 21.8, 23.3, [[0, C(1.08, "hero")], [1, C(1.0)]]],
      [34, 6, 24.08, 26.66, [[0, C(1.22, "count")], [1, C(1.32, "count")]]],
      [40, 8, 26.6, 32.6, [[0, C(1.0)], [1, C(1.08, "drill")]]],
      [48, 6, 37.5, 39.9, [[0, C(1.06)], [0.45, C(1.34, "fring")], [1, C(1.38, "fring")]]],
      [54, 4, 43.4, 44.9, [[0, C(1.15, "dots")], [1, C(1.38, "dots")]]],
      // between sessions
      [58, 6, 49.3, 51.5, [[0, C(1.02)], [1, C(1.1)]]],
      [64, 4, 51.9, 53.5, [[0, C(1.05, "ycard")], [1, C(1.24, "ycard")]]],
      // clubs and friends
      [68, 8, 61.4, 64.4, [[0, C(1.06)], [1, C(1.12)]]],
      [76, 6, 64.5, 66.7, [[0, C(1.04)], [1, C(1.12)]]],
      [82, 8, 67.0, 70.2, [[0, C(1.06)], [0.45, C(1.1)], [0.85, C(1.3, "kyou")], [1, C(1.32, "kyou")]]],
      [90, 6, 72.5, 74.9, [[0, C(1.0)], [0.15, C(1.02)], [0.55, C(1.28, "kprops")], [1, C(1.32, "kprops")]]],
      [96, 8, 75.45, 78.09, [[0, C(1.04)], [0.35, C(1.1)], [0.65, C(1.3, "kstar")], [1, C(1.34, "kstar")]]],
      [104, 6, 78.17, 80.39, [[0, C(1.05)], [0.4, C(1.25, "kyou")], [1, C(1.3, "kyou")]]],
    ],
    words: [[6, "YOU'RE *IN.*"], [12, "A QUICK *QUIZ.*"], [18, "WHAT HOLDS YOU *BACK?*"], [22, "BUILT AROUND *YOU.*"],
      [26, "YOUR WEEK. *EVERY MONDAY.*"], [30, "TAP *START.*"], [34, ""], [40, "ONE DRILL AT A *TIME.*"],
      [42, "*DONE.*"], [44, "*DONE.*"], [46, "*DONE.*"], [48, "SESSION *DONE.*"], [54, "ONE CIRCLE *DOWN.*"],
      [58, "COURSES ON *TOP.*"], [61, "SPEED. STRENGTH. *FIRST TOUCH.*"], [64, "YOUR *CARD.*"],
      [68, "YOUR *CLUBS.*"], [70, "YOUR CLUB *TEAM.*"], [72, "YOUR PICKUP *SQUAD.*"], [74, "YOUR HIGH *SCHOOL.*"],
      [76, "AND *STRIVE SOCCER.*"], [82, "COMPETE WITH YOUR *FRIENDS.*"], [88, "MOVE *UP.*"], [90, "SHARE YOUR *TRAINING.*"],
      [92, "GIVE *PROPS.*"], [96, "THE BEST GET A *STAR.*"], [100, "WILL YOU BE THE NEXT *STRIVE STAR?*"],
      [104, "OUTWORK YOUR *COACH.*"], [110, ""]],
    flash: [26, 51, 88, 108], done: [42, 44, 46], shimmer: [51], deviceOut: 110, tension: [34, 40],
    end: [[111, "OPEN STRIVE."], [112, "TAP START."], [113, "*TRAIN.*"]], mark: 114,
  },
  // THE FULL APP on his song (Nov 26 2026): the same looped song and the same style as short-song,
  // drawn from the real iPhone app. Master times from 100 up are full.src.js scenes; the session,
  // the courses and the starred profile are the walkthrough's own scenes. Every tap, unlock, pass
  // and stamp is placed so it lands on a song beat (the beat is worked out beside each scene's times).
  "full-song": {
    song: { from: 3, loop: true }, full: true,
    len: 144,
    open: [[1, "YOU TRAIN."], [4, "NOW *PROVE IT.*"]], openOut: 6,
    shots: [
      // friends, the clock, the post
      [6, 6, 100.25, 103.6, [[0, C(1.0)], [0.55, C(1.08, "xhero")], [1, C(1.2, "xstart")]]],
      [12, 4, 120.3, 122.9, [[0, C(1.04)], [1, C(1.12, "dig")]]],
      [16, 6, 122.9, 126.5, [[0, C(1.12, "dig")], [0.66, C(1.32, "dig")], [1, C(1.1, "dig")]]],
      [22, 6, 140.15, 144.35, [[0, C(1.04)], [0.35, C(1.08)], [0.62, C(1.28, "rt")], [1, C(1.1, "xpostb")]]],
      [28, 12, 160.05, 166.6, [[0, C(1.0)], [0.25, C(1.1, "post")], [0.5, C(1.06, "post")], [0.7, C(1.28, "xprops")], [1, C(1.06)]]],
      // the week and the friends board
      [40, 12, 180.1, 186.7, [[0, C(1.0)], [0.2, C(1.16, "wring")], [0.42, C(1.2, "wrows")], [1, C(1.26, "wrows")]]],
      // clubs, the matchup, champs of the week
      [52, 6, 200.05, 203.35, [[0, C(1.0)], [1, C(1.1, "clubs")]]],
      [58, 14, 220.05, 227.05, [[0, C(1.0)], [0.2, C(1.22, "mu")], [0.52, C(1.26, "mu")], [0.66, C(1.3, "champ")], [0.8, C(1.12, "note")], [1, C(1.14, "note")]]],
      // Strive Pro adds Train: the week, the session, the courses
      [72, 6, 240.1, 243.6, [[0, C(1.0)], [1, C(1.05)]]],
      [78, 4, 21.8, 23.3, [[0, C(1.08, "hero")], [1, C(1.0)]]],
      [82, 6, 24.08, 26.66, [[0, C(1.22, "count")], [1, C(1.32, "count")]]],
      [88, 8, 26.6, 32.6, [[0, C(1.0)], [1, C(1.08, "drill")]]],
      [96, 6, 37.5, 39.9, [[0, C(1.06)], [0.45, C(1.34, "fring")], [1, C(1.38, "fring")]]],
      [102, 4, 49.5, 51.4, [[0, C(1.02)], [1, C(1.1)]]],
      // you, the star, your teammates
      [106, 8, 260.1, 265.3, [[0, C(1.0)], [0.28, C(1.22, "ylvl")], [0.5, C(1.24, "ylvl")], [0.72, C(1.16, "med")], [1, C(1.2, "med")]]],
      [114, 8, 75.45, 78.09, [[0, C(1.04)], [0.35, C(1.1)], [0.65, C(1.3, "kstar")], [1, C(1.34, "kstar")]]],
      [122, 6, 280.1, 283.4, [[0, C(1.02)], [0.5, C(1.2, "qr")], [1, C(1.24, "qr")]]],
      [128, 8, 300.1, 305.7, [[0, C(1.0)], [0.22, C(1.18, "boxes")], [0.62, C(1.2, "boxes")], [0.8, C(1.12, "earn")], [1, C(1.14, "earn")]]],
    ],
    words: [[6, "YOUR FRIENDS *TRAINED TODAY.*"], [9, "POST YOURS TO SEE *THEIRS.*"], [12, "START THE *CLOCK.*"],
      [16, "PHONE DOWN. *TRAIN.*"], [22, "NO FAKE *HOURS.*"], [28, "POST *IT.*"], [30, "NOW YOU SEE *THEIRS.*"], [36, "GIVE *PROPS.*"],
      [40, "YOUR *WEEK.*"], [43, "COMPETE WITH YOUR *FRIENDS.*"], [46, "MOVE *UP.*"], [50, "OUTWORK YOUR *COACH.*"],
      [52, "YOUR *CLUBS.*"], [53, "YOUR CLUB *TEAM.*"], [54, "YOUR PICKUP *SQUAD.*"], [55, "AND *STRIVE SOCCER.*"],
      [58, "CLUB VS *CLUB.*"], [61, "MOST TRAINING PER PLAYER *WINS.*"], [66, "*STRIVE CHAMPS* OF THE WEEK."],
      [72, "WANT *MORE?*"], [74, "STRIVE PRO ADDS *TRAIN.*"], [78, "A WEEK BUILT AROUND *YOU.*"], [82, ""],
      [88, "ONE DRILL AT A *TIME.*"], [90, "*DONE.*"], [92, "*DONE.*"], [94, "*DONE.*"], [96, "SESSION *DONE.*"],
      [102, "COURSES ON *TOP.*"], [104, "SPEED. STRENGTH. *FIRST TOUCH.*"],
      [106, "YOUR *LEVEL.*"], [109, "LEVEL *UP.*"], [110, "EARN YOUR *MEDALS.*"],
      [114, "THE BEST GET A *STAR.*"], [118, "WILL YOU BE THE NEXT *STRIVE STAR?*"],
      [122, "ADD YOUR *TEAMMATES.*"], [128, "BRING *3.*"], [133, "GET A MONTH OF *PRO.*"], [136, ""]],
    flash: [13, 23, 30, 46, 50, 66, 99, 109, 133], done: [90, 92, 94], shimmer: [99], deviceOut: 136, tension: [82, 88],
    end: [[137, "OPEN STRIVE."], [138, "TAP START."], [139, "*TRAIN.*"]], mark: 140,
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
// master time 100 and up is the full-app cut's own scenes; under it, the walkthrough's
const draw = (m) => (m >= FULL_FROM ? renderFull(m) : renderApp(m));
export function setup() {
  setupApp();
  if (CUT.full) setupFull();
  k = $("#scrwrap").clientWidth / 390;
}

const gold = (s) => s.replace(/\*(.+?)\*/g, '<span class="metal">$1</span>');

// the camera passes through its keys on a smooth curve (monotone cubic): no stop at each key,
// no overshoot, so a push in keeps flowing instead of hitching mid-shot
function smoothAt(xs, ys, x) {
  const n = xs.length;
  if (n === 1 || x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  const d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]));
  for (let i = 0; i < n; i++) {
    if (i === 0) m.push(n > 2 ? d[0] * 0.5 : 0);
    else if (i === n - 1) m.push(n > 2 ? d[n - 2] * 0.5 : 0);
    else m.push(d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]));
  }
  let i = 0; while (x > xs[i + 1]) i++;
  const h = xs[i + 1] - xs[i], u = (x - xs[i]) / h, u2 = u * u, u3 = u2 * u;
  if (n === 2) { const e = inout(u); return ys[0] + (ys[1] - ys[0]) * e; }
  return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
}
function camAt(keys, f) {
  const xs = keys.map((k) => k[0]), g = (fn) => smoothAt(xs, keys.map((k) => fn(k[1])), f);
  return { s: g((c) => c.s), fx: g((c) => c.f[0]), fy: g((c) => c.f[1]), y: g((c) => c.y), ry: g((c) => c.ry) };
}

function wordOn(beat) { let w = null; for (const x of CUT.words) if (beat >= x[0]) w = x; return !!(w && w[1]); }
// 0 to 1, how far the phone has moved for a line on screen: eases over 0.35 s each time a line comes or goes
function wordLevel(t) {
  let on = false, at = -1e9;
  for (const x of CUT.words) {
    const tx = tb(x[0]); if (tx > t) break;
    const now = !!x[1]; if (now !== on) { on = now; at = tx; }
  }
  const k = inout(cl((t - at) / 0.35));
  return on ? k : 1 - k;
}

// soft cuts: every cut between two shots that touch is a dissolve centred on the beat. It starts
// XF_PRE s before the beat, the new shot is about half in on the beat and fully in XF_LEN s after
// the start. The renderer draws the outgoing shot on a second page and lays it over this one.
const XF_PRE = 0.08, XF_LEN = 0.35;
export function xfade(t) {
  for (let i = 1; i < CUT.shots.length; i++) {
    const s = CUT.shots[i], p = CUT.shots[i - 1];
    if (p[0] + p[1] !== s[0]) continue;
    const d = t - (tb(s[0]) - XF_PRE);
    if (d >= 0 && d < XF_LEN) return { cur: i, prev: i - 1, a: out3(d / XF_LEN) };
  }
  return null;
}
export function render(t, force) {
  const beat = bt(t), dev = $("#device"), glow = $("#glow");
  // the shot on screen (or the one a dissolve asks for, which may run a moment past its own beats)
  let shot = null, si = -1;
  if (force != null) { si = force; shot = CUT.shots[si]; }
  else CUT.shots.forEach((s, i) => { if (beat >= s[0] && beat < s[0] + s[1]) { shot = s; si = i; } });
  const outK = lin(beat, CUT.deviceOut, CUT.deviceOut + 0.6);
  if (shot) {
    const [b0, n, m0, m1, cam] = shot;
    // the shot runs evenly in time: the song's beats are not all the same length, so stepping the
    // camera and the app by beats made both speed up and slow down from beat to beat
    const t0s = tb(b0), fu = (t - t0s) / (tb(b0 + n) - t0s), f = cl(fu);
    // the app keeps running through a dissolve (fu a little under 0 or over 1), the camera holds
    draw(mix(m0, m1, force != null ? fu : f));
    const c = camAt(cam, f);
    // a cut on the beat lands softly: the new shot starts a touch closer and settles into place
    const since = t - tb(b0), settle = si === 0 ? 0 : 0.5 * (1 - outExpo(cl(since / 0.5)));
    // and the phone is never dead still: a slow, even drift
    const dx = 3 * Math.sin(t * 0.7), dy = 4 * Math.sin(t * 0.53 + 1), rz = 0.35 * Math.sin(t * 0.41 + 2);
    const fx = 11 + c.fx * k, fy = 11 + c.fy * k, cx = 165, cy = 357;
    const pull = cl((c.s - 1) * 2.2);
    // while a line is on screen the phone never rises into it
    let ty = (cy - fy) * pull + c.y;
    // ... and glides out of the way when a line comes on instead of jumping
    const wl = wordLevel(t);
    const floor = -10 + (11 + c.fy * k) * (c.s - 1), smax = (a, b, e = 40) => (a + b + Math.sqrt((a - b) * (a - b) + e * e)) / 2;
    if (wl > 0) ty = mix(ty, smax(ty, floor), wl);
    st(dev, {
      opacity: 1 - outK,
      transformOrigin: `${fx}px ${fy}px`,
      transform: `translate(${(cx - fx) * pull + dx}px, ${ty + dy + 12 * settle}px) scale(${c.s * (1 + 0.04 * settle) * mix(1, 0.92, outK)}) rotateY(${c.ry}deg) rotate(${rz}deg)`,
      filter: "none",
    });
  } else {
    st(dev, { opacity: 0 });
  }
  // the glow breathes once a bar instead of flickering every beat
  st(glow, { opacity: shot ? 0.62 + 0.12 * Math.sin((Math.PI * 2 * beat) / 4) : 0 });

  // the slammed line
  const kin = $("#kin");
  let w = null; for (const x of CUT.words) if (beat >= x[0]) w = x;
  if (w && w[1] && beat < CUT.deviceOut) {
    if (kin.dataset.t !== w[1]) { kin.innerHTML = `<span>${gold(w[1])}</span>`; kin.dataset.t = w[1]; }
    const d = t - tb(w[0]), s = outExpo(cl(d / 0.4));
    st(kin, { opacity: cl(d / 0.12), transform: `translateY(${(1 - s) * 10}px) scale(${mix(1.08, 1, s)})`, filter: `blur(${(1 - s) * 4}px)` });
  } else st(kin, { opacity: 0 });

  // open and end words, stacked in the middle
  const big = $("#big");
  const showOpen = beat < CUT.openOut + 0.5, list = showOpen ? CUT.open : CUT.end;
  const fade = showOpen ? 1 - lin(beat, CUT.openOut - 0.1, CUT.openOut + 0.3) : 1;
  const html = list.map((x, i) => `<div class="bl" data-i="${i}">${gold(x[1])}</div>`).join("");
  if (big.dataset.h !== html) { big.innerHTML = html; big.dataset.h = html; }
  [...big.children].forEach((el, i) => {
    const d = t - tb(list[i][0]), s = outExpo(cl(d / 0.45));
    st(el, { opacity: d < 0 ? 0 : cl(d / 0.14) * fade, transform: `translateY(${(1 - s) * 12}px) scale(${mix(1.1, 1, s)})`, filter: `blur(${(1 - s) * 5}px)` });
  });
  const mk = $("#mark"), md = t - tb(CUT.mark);
  st(mk, { opacity: md < 0 ? 0 : out3(cl(md / 0.5)), transform: `translateY(${(1 - out3(cl(md / 0.5))) * 10}px)` });

  // the white flash on the big moments
  let fl = 0; for (const fb of CUT.flash) { const d = t - tb(fb); if (d >= 0 && d < 0.4) fl = Math.max(fl, 0.16 * cl(d / 0.04) * (1 - out3(cl(d / 0.4)))); }
  st($("#flash"), { opacity: fl });
}
