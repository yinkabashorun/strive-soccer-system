// The walkthrough film, frame by frame. render(t) draws the whole frame for
// time t (seconds). Nothing runs on its own clock, so every frame of the
// export is exact and the motion is smooth at any frame rate.
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const cl = (x) => Math.max(0, Math.min(1, x));
const lin = (t, a, b) => cl((t - a) / (b - a));
const out3 = (x) => 1 - Math.pow(1 - x, 3);
const inout = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const E = (t, a, d) => out3(lin(t, a, a + d));
const mix = (a, b, k) => a + (b - a) * k;
const st = (el, css) => { for (const k in css) el.style[k] = css[k]; };

export const DURATION = 59.0;
const INS = 8.0, ADD = 1.5;
const real = (x) => (x <= INS ? x : x + ADD);

const S = {}; // screens
let heroRect;
const DR = [
  { img: "plyo-squat-jumps", kind: "Warm-up", t: "Squat jumps", set: "3 × 8", rest: "30 sec" },
  { img: "weak-foot-tap-pull-push", kind: "Weak foot", t: "Weak foot tap,<br>pull, push", set: "3 × 1 min", rest: "30 sec" },
  { img: "wall-pass-touch-stepover", kind: "Weak foot", t: "Wall pass,<br>touch, stepover", set: "3 × 90 sec", rest: "30 sec" },
  { img: "l-turn-roll-touch", kind: "Ball mastery", t: "L turn,<br>roll, touch", set: "3 × 1 min", rest: "30 sec" },
];

// captions: [start, end, eyebrow, line]
const CAP = [
  [3.3, 7.4, "Day one", "You're in."],
  [7.6, 8.75, "Day one", "A quick quiz. One tap each."],
  [9.15, 12.45, "Day one", "Tell us what holds you back."],
  [11.2, 14.2, "Day one", "Your week gets built around it."],
  [14.4, 18.4, "Day one", "Your week arrives. Every Monday."],
  [18.7, 21.4, "Every session", "One card. One button."],
  [21.6, 25.2, "Every session", "3, 2, 1. Grab your ball."],
  [25.4, 30.9, "Every session", "One drill at a time. Tap Done."],
  [31.1, 34.9, "Every session", "The timer runs every set."],
  [35.8, 41.7, "Every session", "Session done. Your time only goes up."],
  [41.9, 45.2, "Every session", "One circle filled."],
  [45.4, 47.7, "Between sessions", "Your whole week."],
  [47.8, 50.0, "Between sessions", "Courses on top of your week."],
  [50.1, 52.6, "Between sessions", "Your card. Your time."],
];
// taps: [time, selector-or-[x,y] in screen px]
const TAPS = [
  [7.0, "#welcome .wbtn"], [9.4, "#quiz .tile"], [7.05, "#quiz2 .opt:nth-child(2)"], [18.0, "#drop .wbtn"], [21.0, "#start"],
  [26.6, "#done"], [28.1, "#done"], [29.6, "#done"], [30.85, "#drill .timer"],
  [34.65, "#timer .tbtns .w"], [35.6, "#done"], [41.5, "#backhome"],
  [45.5, "#home [data-tab=week]"], [47.8, "#week .tab:nth-child(3)"], [50.1, "#courses .tab:nth-child(4)"],
];
const tapPos = {};
const REAL_TAPS = [];

export function setup() {
  for (const s of $$(".scr")) S[s.id] = s;
  const scr = $("#screen"), sr = scr.getBoundingClientRect(), k = sr.width / 390;
  const rel = (el) => { const r = el.getBoundingClientRect(); return { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k }; };
  // measure on the screens they live in
  const show = (id) => { for (const s of Object.values(S)) s.style.opacity = s.id === id ? 1 : 0; };
  show("home"); heroRect = rel($("#hero"));
  for (const [t, sel] of TAPS) {
    const id = sel.match(/#(\w+)/)[1]; show(id);
    const el = $(sel); const r = rel(el);
    const rt = sel.startsWith("#quiz2") ? 8.55 : real(t);
    REAL_TAPS.push(rt); tapPos[rt] = [r.x + r.w / 2, r.y + r.h / 2];
  }
  show("welcome");
}

const QUIZCAP = (c) => c[3].startsWith("A quick") || c[3].startsWith("Tell us");
const CAPR = CAP.map((c) => (QUIZCAP(c) ? c : [real(c[0]), real(c[1]), c[2], c[3]]));
function cap(t) {
  const eb = $("#eyebrow"), ln = $("#line");
  let cur = null;
  for (const c of CAPR) if (t >= c[0] - 0.01 && t <= c[1] + 0.35) cur = c;
  if (!cur) { eb.style.opacity = 0; ln.style.opacity = 0; return; }
  const a = E(t, cur[0], 0.45), z = 1 - E(t, cur[1], 0.3);
  const o = Math.min(a, z);
  // the eyebrow only fades when the chapter changes
  const prev = CAPR[CAPR.indexOf(cur) - 1], next = CAPR[CAPR.indexOf(cur) + 1];
  const ebIn = prev && prev[2] === cur[2] ? 1 : a, ebOut = next && next[2] === cur[2] ? 1 : z;
  eb.textContent = cur[2]; ln.textContent = cur[3];
  st(eb, { opacity: Math.min(ebIn, ebOut) });
  st(ln, { opacity: o, transform: `translateY(${(1 - a) * 14}px)`, filter: `blur(${(1 - a) * 6}px)` });
}

function finger(t) {
  const f = $("#finger");
  let o = 0, sc = 1, pos = null;
  for (const tt of REAL_TAPS) {
    const d = t - tt + 0.28;
    if (d >= 0 && d <= 0.75) { pos = tapPos[tt]; const k = d / 0.75; o = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65; sc = 1.35 - 0.4 * Math.min(1, k / 0.4); }
  }
  if (!pos) { f.style.opacity = 0; return; }
  st(f, { opacity: o * 0.9, left: pos[0] + "px", top: pos[1] + "px", transform: `scale(${sc})` });
}
// a pressed control dips while the finger is on it
const press = (t, at) => { const d = t - at; return d > -0.12 && d < 0.2 ? 1 - 0.04 * Math.sin(Math.PI * cl((d + 0.12) / 0.32)) : 1; };

function vis(id, o, tf = "none") { st(S[id], { opacity: o, transform: tf, visibility: o > 0.001 ? "visible" : "hidden" }); }

// The whole walkthrough film: the app, the captions and the stage.
export function render(rt) { renderApp(rt); cap(rt); stage(rt); }

// Just the app inside the phone at master time rt (taps included). The cut
// films (mix.src.js) call this with their own clock and draw their own stage.
export const master = real;
export function renderApp(rt) {
  for (const s of Object.values(S)) vis(s.id, 0);
  finger(rt);
  quiz2(rt);
  const t = rt <= INS ? rt : Math.max(INS, rt - ADD);

  // ---------- 1. the door ----------
  if (t < 8.2) {
    vis("welcome", 1);
    const w = S.welcome;
    const a = E(t, 3.0, 0.7);
    st($(".logo", w), { opacity: a, transform: `scale(${mix(0.9, 1, a)})` });
    st($(".rule", w), { transform: `scaleX(${E(t, 3.4, 0.5)})` });
    const h = E(t, 3.8, 0.45), pp = E(t, 3.95, 0.45);
    st($("h1", w), { opacity: h, transform: `translateY(${(1 - h) * 14}px)` });
    st($("p", w), { opacity: pp, transform: `translateY(${(1 - pp) * 10}px)` });
    const c = lin(t, 4.35, 5.25), cb = back(c);
    st($("#mcard"), { opacity: cl(c * 2), transform: `perspective(900px) translateY(${(1 - cb) * 120}px) rotateX(${(1 - cb) * 24}deg) scale(${mix(0.94, 1, cb)})` });
    st($("#mcard .sheen"), { left: mix(-140, 460, inout(lin(t, 5.2, 6.5))) + "px" });
    const b = E(t, 5.8, 0.45);
    st($(".wbtn", w), { opacity: b, transform: `translateY(${(1 - b) * 10}px) scale(${press(t, 7.0)})` });
    if (t > 7.42) { const k = E(t, 7.42, 0.42); vis("welcome", 1 - k * 0.6, `translateX(${-28 * k}%)`); }
  }
  // ---------- 2. quiz ----------
  if (t >= 7.42 && t < 11.7 && rt >= 9.0) {
    const k = E(rt, 9.0, 0.45); vis("quiz", 1, `translateX(${(1 - k) * 100}%)`);
    if (t > 11.2) vis("quiz", 1 - E(t, 11.2, 0.45));
    const tiles = $$("#quiz .tile"), pk = E(t, 9.45, 0.32), pop = back(lin(t, 9.45, 9.8));
    tiles.forEach((tl, i) => {
      if (i === 0) { st(tl, { boxShadow: `0 0 0 ${2.5 * pk}px var(--bone)`, transform: `scale(${press(t, 9.4)})` }); st($(".ck", tl), { transform: `scale(${pop})` }); }
      else st(tl, { opacity: mix(1, 0.28, pk), transform: `scale(${mix(1, 0.97, pk)})` });
    });
  }
  // ---------- 3. building ----------
  if (t >= 11.2 && t < 14.8) {
    const a = E(t, 11.2, 0.48); vis("build", a, `scale(${mix(1.02, 1, a)})`);
    if (t > 14.3) vis("build", 1 - E(t, 14.3, 0.45));
    $$("#build .step").forEach((s, i) => {
      const at = 11.95 + i * 0.7; s.classList.toggle("ok", t >= at);
      st($("i", s), { transform: `scale(${t >= at ? back(lin(t, at, at + 0.35)) : 1})` });
    });
  }
  // ---------- 4. the drop ----------
  if (t >= 14.3 && t < 19.0) {
    const a = E(t, 14.3, 0.48); vis("drop", a, `scale(${mix(1.02, 1, a)})`);
    if (t > 18.45) vis("drop", 1 - E(t, 18.45, 0.45));
    st($("#drop .dt"), { opacity: E(t, 14.4, 0.5) });
    $$("#drop .sc").forEach((c, i) => { const at = 14.9 + i * 0.13, k = lin(t, at, at + 0.62); st(c, { opacity: cl(k * 2), transform: `translateY(${(1 - back(k)) * 40}px) scale(${mix(0.96, 1, back(k))})` }); });
    const b = E(t, 15.9, 0.45); st($("#drop .wbtn"), { opacity: b, transform: `translateY(${(1 - b) * 10}px) scale(${press(t, 18.0)})` });
  }
  // ---------- 5. home, before ----------
  if (t >= 18.45 && t < 21.4) {
    const a = E(t, 18.45, 0.48); vis("home", a, `scale(${mix(1.02, 1, a)})`);
    homeState(false, t);
    st($("#start"), { transform: `scale(${press(t, 21.0)})` });
  }
  // ---------- 6. the card grows into the session, the count-in ----------
  if (t >= 21.1 && t < 25.6) {
    if (t < 21.8) { vis("home", 1); homeState(false, t); }
    vis("intro", t > 25.15 ? 1 - E(t, 25.15, 0.4) : 1);
    const g = E(t, 21.15, 0.6), r = heroRect;
    const ins = [r.y * (1 - g), (390 - r.x - r.w) * (1 - g), (844 - r.y - r.h) * (1 - g), r.x * (1 - g)];
    st($("#intro .full"), { clipPath: `inset(${ins.map((v) => v + "px").join(" ")} round ${30 * (1 - g)}px)` });
    st($("#intro .full img"), { filter: `brightness(${mix(1, 0.42, g)})` });
    const it = E(t, 21.8, 0.45); st($("#intro .it"), { opacity: it, transform: `translateY(${(1 - it) * 16}px)` });
    const ring = $("#intro .cring"), arc = $(".arc", ring), cnt = $("#count");
    st(ring, { opacity: E(t, 22.5, 0.3) });
    let n = 0, d = 0;
    for (const [i, at] of [[3, 22.6], [2, 23.46], [1, 24.32]]) if (t >= at) { n = i; d = t - at; }
    if (n) {
      cnt.textContent = n; const k = cl(d / 0.82);
      const o = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65;
      st(cnt, { opacity: o, transform: `scale(${mix(1.35, 0.9, out3(k))})` });
      arc.style.strokeDashoffset = 678.6 * ((n - out3(cl(d / 0.82))) / 3);
    } else st(cnt, { opacity: 0 });
  }
  // ---------- 7. drills ----------
  if (t >= 25.15 && t < 36.45) {
    const a = E(t, 25.15, 0.48); vis("drill", a, `scale(${mix(1.02, 1, a)})`);
    // which drill, and the slide between them
    const dones = [26.6, 28.1, 29.6];
    let i = 0; for (const d of dones) if (t >= d + 0.34) i++;
    const body = $("#dbody");
    paint(i, t, dones);
    let tf = "none", op = 1;
    for (const d of dones) {
      const o1 = lin(t, d + 0.34, d + 0.56); // out
      const i1 = E(t, d + 0.56, 0.36); // in
      if (t >= d + 0.12 && t < d + 0.56) { paint(dones.indexOf(d), t, dones, true); tf = `translateX(${-40 * o1}px)`; op = 1 - o1; }
      else if (t >= d + 0.56 && t < d + 0.95) { tf = `translateX(${40 * (1 - i1)}px)`; op = i1; }
    }
    st(body, { transform: tf, opacity: op });
    // the timer opens as a sheet over the last drill, then back
    if (t > 31.0) { const up = E(t, 31.05, 0.5), down = E(t, 34.8, 0.45); vis("timer", 1, `translateY(${(1 - up + down) * 100}%)`); timer(t); }
    if (t > 36.0) vis("drill", 1 - E(t, 36.0, 0.42));
  }
  // ---------- 8. finish ----------
  if (t >= 36.0 && t < 42.0) {
    const a = E(t, 36.0, 0.48); vis("finish", a, `scale(${mix(1.02, 1, a)})`);
    if (t > 41.6) vis("finish", 1 - E(t, 41.6, 0.4));
    const f = S.finish;
    st($(".cp", f), { opacity: E(t, 36.1, 0.9) });
    const r = E(t, 36.3, 1.1);
    $(".arc", f).style.strokeDashoffset = 678.6 * (1 - r);
    const plus = $("#plus"); plus.textContent = "+" + Math.round(22 * r); st(plus, { opacity: E(t, 36.3, 0.3) });
    const pulse = lin(t, 37.4, 37.9); st($(".cring", f), { transform: `scale(${1 + 0.05 * Math.sin(Math.PI * pulse)})` });
    $$(".spark", f).forEach((s, i) => {
      const k = lin(t, 37.4, 38.6), ang = (i / 8) * Math.PI * 2 + 0.3, dd = (150 + (i % 3) * 28) * out3(k);
      const o = k <= 0 ? 0 : k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75;
      st(s, { left: "195px", top: "240px", opacity: o, transform: `translate(${Math.cos(ang) * dd}px,${Math.sin(ang) * dd}px) rotate(${i * 50 * k}deg)` });
    });
    const up = (sel, at, dy = 16) => { const k = E(t, at, 0.5); st($(sel, f), { opacity: k, transform: `translateY(${(1 - k) * dy}px)` }); };
    up(".ctitle", 37.6); up(".cstats", 37.76);
    const m = lin(t, 38.0, 38.6); st($(".medal", f), { opacity: cl(m * 2), transform: `translateY(${(1 - back(m)) * 24}px) scale(${mix(0.96, 1, back(m))})` });
    const c = E(t, 38.3, 0.4); st($(".cta", f), { opacity: c });
    st($("#backhome"), { transform: `scale(${press(t, 41.5)})` });
  }
  // ---------- 9. home, after ----------
  if (t >= 41.6 && t < 46.0) {
    const a = E(t, 41.6, 0.48); vis("home", a, `scale(${mix(1.02, 1, a)})`);
    homeState(true, t);
  }
  // ---------- 10. tabs ----------
  const tab = (id, at) => E(t, at, 0.2);
  if (t >= 45.5 && t < 48.2) { vis("week", tab("week", 45.55)); }
  if (t >= 47.8 && t < 50.5) { vis("courses", tab("courses", 47.85)); }
  if (t >= 50.1) {
    vis("you", tab("you", 50.15));
    st($("#you .sheen"), { left: mix(-140, 460, inout(lin(t, 50.6, 51.9))) + "px" });
  }
}

function stage(t) {
  // ---------- stage: title, phone, end ----------
  const title = $("#title"), end = $("#end"), dev = $("#device"), glow = $("#glow");
  const tin = E(t, 0.3, 0.9), tout = 1 - E(t, 2.3, 0.6);
  st(title, { opacity: Math.min(tin, tout), transform: `translateY(${(1 - tin) * 16}px)` });
  const rise = E(t, 2.4, 1.1), leave = E(t, 54.1, 0.9);
  const float = Math.sin(t * 0.6) * 3;
  st(dev, { opacity: rise * (1 - leave), transform: `translateY(${(1 - rise) * 260 + float + leave * -30}px) scale(${mix(0.9, 1, rise) * mix(1, 0.92, leave)})` });
  st(glow, { opacity: 0.85 * rise * (1 - leave) });
  const e1 = E(t, 54.9, 0.7), e2 = E(t, 55.7, 0.7), e3 = E(t, 56.5, 0.8);
  st(end, { opacity: 1 });
  $$("#end .l").forEach((l, i) => { const k = [e1, e2, e3][i]; st(l, { opacity: k, transform: `translateY(${(1 - k) * 18}px)`, filter: `blur(${(1 - k) * 8}px)` }); });
  const ew = E(t, 57.5, 0.7); st($("#end .wm2"), { opacity: ew });

}

function homeState(after, t) {
  const d1 = $("#d1"), d2 = $$("#home .dot")[1];
  const fill = after && t >= 42.2;
  d1.className = fill ? "dot done" : "dot now"; d1.textContent = fill ? "✓" : "1";
  d2.className = fill ? "dot now" : "dot";
  st(d1, { transform: `scale(${fill ? back(lin(t, 42.2, 42.72)) : 1})` });
  $("#heroEye").textContent = after ? "Up next · Session 2 of 4" : "Today · Session 1 of 4";
  const r = after ? E(t, 42.2, 0.9) : 0;
  $("#homering").style.strokeDashoffset = 163.4 - 40.9 * r;
  $("#tt").textContent = Math.round(22 * (after ? E(t, 42.25, 0.8) : 0)) + "m";
}

function paint(i, t, dones, checked = false) {
  const d = DR[Math.min(i, 3)];
  const img = $("#dimg"), want = `../mock/img/${d.img}.jpg`;
  if (!img.src.endsWith(want.slice(2))) img.src = want;
  $("#dnum").textContent = `Drill ${Math.min(i, 3) + 1} of 4`; $("#dkind").textContent = d.kind;
  $("#dtitle").innerHTML = d.t; $("#dset").textContent = d.set; $("#drest").textContent = d.rest;
  const segs = $$("#seg i");
  segs.forEach((s, j) => (s.className = j < i ? "done" : j === i ? "on" : ""));
  const b = $("#done");
  const tick = checked || dones.concat([35.6]).some((x) => t >= x + 0.12 && t < x + 0.56);
  if (tick) { segs[Math.min(i, 3)].className = "done"; b.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'; }
  else b.textContent = "Done";
  let sc = 1; for (const x of dones.concat([35.6])) sc *= press(t, x);
  for (const x of dones.concat([35.6])) { const k = lin(t, x + 0.12, x + 0.5); if (k > 0 && k < 1) sc *= 1 + 0.03 * Math.sin(Math.PI * k); }
  st(b, { transform: `scale(${sc})` });
  st($("#drill .timer"), { transform: `scale(${press(t, 30.85)})` });
}

function timer(t) {
  // 3 sets of 1 min; set 2 counting down 0:45 -> 0:41 while it is open
  const T = S.timer, secs = 45 - (t - 31.3);
  const s = Math.max(0, Math.ceil(secs));
  $("b", $(".big-ring .c", T)).textContent = `0:${String(s).padStart(2, "0")}`;
  $(".big-ring circle:nth-child(2)", T).style.strokeDashoffset = 854.5 * (1 - Math.max(0, secs) / 60);
  st($(".tbtns .w", T), { transform: `scale(${press(t, 34.65)})` });
}

function quiz2(t) {
  if (t < 7.42 || t > 9.5) return;
  const q = S.quiz2, k = E(t, 7.42, 0.42), out = E(t, 9.0, 0.45);
  vis("quiz2", 1 - out * 0.6, `translateX(${(1 - k) * 100 - out * 28}%)`);
  const opts = $$(".opt", q), pk = E(t, 8.6, 0.3), pop = back(lin(t, 8.6, 8.95));
  opts.forEach((o, i) => {
    if (i === 1) { st(o, { boxShadow: `inset 0 0 0 ${1 + 1.5 * pk}px rgba(242,239,232,${0.07 + 0.93 * pk})`, transform: `scale(${press(t, 8.55)})` }); st($(".ck", o), { transform: `scale(${pop})` }); }
    else st(o, { opacity: 1 - 0.65 * pk });
  });
}
