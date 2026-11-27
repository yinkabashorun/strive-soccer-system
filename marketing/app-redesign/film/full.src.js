// The full-app cut: the scenes drawn from the real iPhone app (full.screens.html,
// full.css). Like film.src.js, renderFull(m) draws one exact frame for master time m
// and nothing runs on its own clock. Each scene owns twenty seconds of master time
// from SCENE.x, so a dissolve that runs a moment past a shot stays in the same scene.
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const cl = (x) => Math.max(0, Math.min(1, x));
const lin = (t, a, b) => cl((t - a) / (b - a));
const out3 = (x) => 1 - Math.pow(1 - x, 3);
const inout = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const E = (t, a, d) => out3(lin(t, a, a + d));
const mix = (a, b, k) => a + (b - a) * k;
const st = (el, css) => { for (const k in css) el.style[k] = css[k]; };
const fmt = (m) => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h ${String(r).padStart(2, "0")}m` : `${r}m`; };
const rise = (el, k, dy = 18) => st(el, { opacity: k, transform: `translateY(${(1 - k) * dy}px)` });
const pop = (el, k, from = 0.86) => st(el, { opacity: cl(k * 2.5), transform: `scale(${mix(from, 1, back(k))})` });
const press = (t, at) => { const d = t - at; return d > -0.12 && d < 0.2 ? 1 - 0.045 * Math.sin(Math.PI * cl((d + 0.12) / 0.32)) : 1; };

export const FULL_FROM = 100;
export const SCENE = { friends: 100, clock: 120, ready: 140, feed: 160, week: 180, clubs: 200, club: 220, pro: 240, you: 260, code: 280, squad: 300 };

// ---------- the iPhone's own tab bar ----------
const ICON = {
  train: '<svg viewBox="0 0 24 24"><circle cx="14.5" cy="4.5" r="2"/><path d="M6 21l3.5-5 2-3.5-3-2.5 1.5-4.5 4 1.5 2.5 3.5 3.5.5M11.500 12.500l3.500 3v5.500M5 12.500l2.500-5"/></svg>',
  friends: '<svg viewBox="0 0 24 24"><circle cx="8.500" cy="8" r="3.300"/><path d="M2 20c.6-3.800 3.200-5.800 6.500-5.800s5.900 2 6.500 5.800z"/><circle cx="16.800" cy="8.600" r="2.700"/><path d="M17 14.300c2.800.2 4.500 2 5 5.700h-4"/></svg>',
  week: '<svg viewBox="0 0 24 24"><rect x="3.500" y="5" width="17" height="15.500" rx="3"/><path class="cut" d="M7 12h2M11 12h2M15 12h2M7 16h2M11 16h2M15 16h2"/><path d="M3.500 9h17M8 3v3.500M16 3v3.500"/></svg>',
  clubs: '<svg viewBox="0 0 24 24"><path d="M12 2.800 19.500 5v6.300c0 4.600-3 8.200-7.500 10-4.500-1.800-7.500-5.400-7.500-10V5z"/></svg>',
  you: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7.800" r="3.800"/><path d="M4.500 20.500c.8-4.200 3.700-6.300 7.500-6.300s6.700 2.100 7.500 6.300z"/></svg>',
};
const NAMES = { train: "Train", friends: "Friends", week: "Week", clubs: "Clubs", you: "You" };
export function barHtml(on, five) {
  const tabs = (five ? ["train"] : []).concat(["friends", "week", "clubs", "you"]);
  return '<i class="pill"></i>' + tabs.map((t) => `<div class="nt${t === on ? " on" : ""}" data-t="${t}">${ICON[t]}${NAMES[t]}</div>`).join("");
}
function placePill(bar) {
  const on = $(".nt.on", bar), pill = $(".pill", bar);
  if (!on) { pill.style.opacity = 0; return; }
  st(pill, { left: on.offsetLeft + "px", width: on.offsetWidth + "px", opacity: 1 });
}

const S = {};
let K = 1, SR = null;
const P = {}; // tap points, screen px
function at(el) { const r = el.getBoundingClientRect(); return [(r.left - SR.left) / K + r.width / K / 2, (r.top - SR.top) / K + r.height / K / 2]; }
function showOnly(id) { for (const s of $$(".scr")) st(s, { opacity: s.id === id ? 1 : 0, visibility: s.id === id ? "visible" : "hidden", transform: "none" }); }

// Swap the old flat tab bars on the walkthrough's own screens for the app's real bar,
// five tabs with Train lit: by then in this cut the player has Strive Pro.
export function setupFull() {
  let names = {};
  try { const x = new XMLHttpRequest(); x.open("GET", "faces/names.json", false); x.send(); if (x.status === 200) names = JSON.parse(x.responseText); } catch (e) {}
  for (const el of $$("[data-n1]")) if (names[el.dataset.n1]) el.textContent = names[el.dataset.n1].split(" ")[0];
  for (const b of $$(".nb")) { b.innerHTML = barHtml(b.dataset.on, b.dataset.five === "1"); }
  for (const id of ["home", "week", "courses", "you"]) {
    const old = $(`#${id} .tabs`); if (!old) continue;
    const nb = document.createElement("div"); nb.className = "nb"; nb.innerHTML = barHtml("train", true);
    old.replaceWith(nb);
  }
  // the Pro scene shows the same feed the player just opened
  const body = $("#xfeed").cloneNode(true);
  for (const el of $$("[id]", body)) el.removeAttribute("id");
  for (const el of $$(".nb,.xfadebar,.xburst", body)) el.remove();
  for (const el of $$(".xlockv", body)) el.remove();
  $("#xprobody").append(...body.childNodes);
  $("#xprobar").innerHTML = barHtml("friends", true);

  for (const s of $$(".scr")) S[s.id] = s;
  const scr = $("#screen"); SR = scr.getBoundingClientRect(); K = SR.width / 390;
  const tap = (id, sel) => { showOnly(id); P[sel] = at($(sel)); };
  tap("xfr", "#xstart"); tap("xcam", "#xsht"); tap("xclock", "#xfin"); tap("xready", "#xpost");
  tap("xclubs", "#xcc1"); tap("xcode", "#xsend");
  showOnly("xfeed"); P.props = at($("#xprops")); P.propsTop = $("#xprops").closest(".xp").offsetTop; P.p3Top = $$("#xfeed .xp")[2].offsetTop;
  for (const id of Object.keys(S)) { showOnly(id); for (const b of $$(".nb", S[id])) placePill(b); }
  showOnly("xclub"); P.champ = at($("#xchamp"));
  showOnly("xsquad"); P.earn = at($("#xearn"));
  showOnly("welcome");
}

function vis(id, o, tf = "none") { st(S[id], { opacity: o, transform: tf, visibility: o > 0.001 ? "visible" : "hidden" }); }
function finger(t, taps) {
  const f = $("#finger"); let o = 0, sc = 1, pos = null;
  for (const [tt, p] of taps) { const d = t - tt + 0.28; if (d >= 0 && d <= 0.75) { pos = p; const k = d / 0.75; o = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65; sc = 1.35 - 0.4 * Math.min(1, k / 0.4); } }
  if (!pos) { f.style.opacity = 0; return; }
  st(f, { opacity: o * 0.9, left: pos[0] + "px", top: pos[1] + "px", transform: `scale(${sc})` });
}
function burst(els, t, t0, cx, cy, dist = 70, dur = 0.9) {
  const k = lin(t, t0, t0 + dur);
  els.forEach((b, i) => {
    const ang = (i / els.length) * Math.PI * 2 + 0.4, d = (dist * 0.6 + (i % 3) * dist * 0.22) * out3(k);
    const o = k <= 0 || k >= 1 ? 0 : k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
    st(b, { left: cx - 4 + "px", top: cy - 4 + "px", opacity: o, transform: `translate(${Math.cos(ang) * d}px,${Math.sin(ang) * d}px) rotate(${i * 50 * k}deg) scale(${1 + 0.4 * (1 - k)})` });
  });
}

export function renderFull(m) {
  for (const s of Object.values(S)) vis(s.id, 0);
  $("#finger").style.opacity = 0;
  const base = Math.floor((m - FULL_FROM) / 20) * 20 + FULL_FROM, u = m - base;
  if (base === SCENE.friends) friends(u);
  else if (base === SCENE.clock) clock(u);
  else if (base === SCENE.ready) ready(u);
  else if (base === SCENE.feed) feed(u);
  else if (base === SCENE.week) week(u);
  else if (base === SCENE.clubs) clubs(u);
  else if (base === SCENE.club) club(u);
  else if (base === SCENE.pro) pro(u);
  else if (base === SCENE.you) you(u);
  else if (base === SCENE.code) code(u);
  else if (base === SCENE.squad) squad(u);
}

// 1. Friends, before you post: who trained today, and the one button
function friends(u) {
  vis("xfr", 1); const s = S.xfr;
  rise($(".xh", s), E(u, 0.0, 0.45), 12);
  $$(".xfaces > div", s).forEach((f, i) => pop(f, lin(u, 0.15 + i * 0.12, 0.6 + i * 0.12), 0.5));
  const h = lin(u, 0.35, 1.0);
  st($(".xhero", s), { opacity: cl(h * 2), transform: `translateY(${(1 - back(h)) * 60}px) scale(${mix(0.95, 1, back(h))})` });
  st($(".xhero .bg", s), { transform: `scale(${mix(1.15, 1.02, out3(lin(u, 0.35, 4)))})` });
  $$(".xpair img", s).forEach((f, i) => pop(f, lin(u, 0.8 + i * 0.1, 1.2 + i * 0.1), 0.4));
  rise($(".xhero .xey", s), E(u, 0.95, 0.4), 10); rise($(".xhero h2", s), E(u, 1.05, 0.45)); rise($(".xhero p", s), E(u, 1.2, 0.45), 12);
  const b = E(u, 1.35, 0.45);
  st($("#xstart"), { opacity: b, transform: `translateY(${(1 - b) * 12}px) scale(${press(u, 3.2)})` });
  finger(u, [[3.2, P["#xstart"]]]);
}

// 2 and 3. The start photo, then the clock runs
const mmss = (sec) => { sec = Math.max(0, Math.floor(sec)); return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`; };
function clock(u) {
  const SHOT = 0.95;
  if (u < SHOT + 0.5) {
    vis("xcam", 1); const s = S.xcam;
    $("#xcamlab").textContent = "Start photo"; $("#xcamimg").src = $("#xthumb").src; $("#xcamimg").style.objectPosition = "50% 50%";
    st($(".vf", s), { transform: `scale(${mix(1.06, 1, E(u, 0, 0.6))})`, opacity: 1 });
    st($("#xsht"), { transform: `scale(${press(u, SHOT - 0.05)})` });
    const f = u - SHOT; st($("#xfl"), { opacity: f < 0 ? 0 : f < 0.05 ? f / 0.05 : 1 - out3(cl((f - 0.05) / 0.4)) });
    finger(u, [[SHOT - 0.05, P["#xsht"]]]);
  }
  if (u >= SHOT + 0.12) {
    const a = E(u, SHOT + 0.12, 0.4); vis("xclock", a); const s = S.xclock;
    // the photo just taken settles into its place above the clock
    const g = lin(u, SHOT + 0.12, SHOT + 0.7);
    st($("#xthumb"), { transform: `scale(${mix(2.6, 1, back(g))}) translateY(${(1 - out3(g)) * 60}px)`, opacity: cl(g * 3) });
    rise($(".xey", s), E(u, SHOT + 0.45, 0.4), 10);
    // the clock: a second a second at first, then the minutes fly, then it settles
    const run = lin(u, SHOT + 0.5, 5.2), secs = 2772 * Math.pow(inout(run), 1.6);
    const d = $("#xdig"); d.textContent = mmss(secs);
    const land = lin(u, 5.2, 5.6);
    st(d, { opacity: E(u, SHOT + 0.4, 0.35), transform: `scale(${1 + 0.06 * Math.sin(Math.PI * land)})` });
    rise($(".p1", s), E(u, SHOT + 0.6, 0.45), 12); rise($(".p2", s), E(u, SHOT + 0.7, 0.45), 12);
    const b = E(u, SHOT + 0.8, 0.45);
    st($("#xfin"), { opacity: b, transform: `translateY(${(1 - b) * 12}px) scale(${press(u, 6.0)})` });
    rise($(".p3", s), E(u, SHOT + 0.9, 0.45), 8);
    finger(u, [[6.0, P["#xfin"]]]);
  }
}

// 4. The finish photo, then ready to post
function ready(u) {
  const SHOT = 0.75;
  if (u < SHOT + 0.5) {
    vis("xcam", 1); const s = S.xcam;
    $("#xcamlab").textContent = "Finish photo"; $("#xcamimg").src = $("#xrphoto .f").src; $("#xcamimg").style.objectPosition = "50% 50%";
    st($(".vf", s), { transform: `scale(${mix(1.06, 1, E(u, 0, 0.6))})` });
    st($("#xsht"), { transform: `scale(${press(u, SHOT - 0.05)})` });
    const f = u - SHOT; st($("#xfl"), { opacity: f < 0 ? 0 : f < 0.05 ? f / 0.05 : 1 - out3(cl((f - 0.05) / 0.4)) });
    finger(u, [[SHOT - 0.05, P["#xsht"]]]);
  }
  if (u >= SHOT + 0.12) {
    const a = E(u, SHOT + 0.12, 0.4); vis("xready", a); const s = S.xready;
    const g = lin(u, SHOT + 0.12, SHOT + 0.75);
    st($("#xrphoto"), { transform: `scale(${mix(1.5, 1, back(g))})`, opacity: cl(g * 3) });
    pop($("#xrphoto .s"), lin(u, SHOT + 0.55, SHOT + 1.0), 0.3);
    rise($(".xey", s), E(u, SHOT + 0.5, 0.4), 10);
    const c = out3(lin(u, SHOT + 0.55, SHOT + 1.5));
    $("#xrt").textContent = Math.round(46 * c) + "m"; st($("#xrt"), { opacity: E(u, SHOT + 0.5, 0.3), transform: `scale(${1 + 0.07 * Math.sin(Math.PI * lin(u, SHOT + 1.5, SHOT + 1.9))})`, transformOrigin: "0 60%" });
    rise($(".p1", s), E(u, SHOT + 0.7, 0.4), 10);
    rise($(".xseg", s), E(u, SHOT + 0.85, 0.4), 14); rise($(".xline", s), E(u, SHOT + 0.95, 0.4), 14);
    const b = E(u, SHOT + 1.05, 0.45);
    st($("#xpost"), { opacity: b, transform: `translateY(${(1 - b) * 12}px) scale(${press(u, 3.9)})` });
    finger(u, [[3.9, P["#xpost"]]]);
  }
}

// 5. The feed opens: your post lands, theirs unlock, props
function feed(u) {
  vis("xfeed", 1); const s = S.xfeed, UNLOCK = 1.14, PROPS = 4.32;
  const mine = $("#xmine"), g = lin(u, 0.05, 0.55);
  st(mine, { opacity: cl(g * 2.5), transform: `translateY(${(1 - back(g)) * -46}px) scale(${mix(0.94, 1, back(g))})` });
  const k = E(u, UNLOCK, 0.7);
  $$(".xl", s).forEach((p) => {
    st($(".f", p), { filter: `blur(${18 * (1 - k)}px)`, transform: `scale(${mix(1.12, 1, k)})` });
    st($(".tt", p), { opacity: k });
    st($(".xlockv", p), { opacity: 1 - cl(k * 2.2), transform: `scale(${1 + 0.5 * k})` });
    st($(".ac", p), { opacity: mix(0.25, 1, k) });
  });
  // the page moves down to the first friend's post, then on to the next
  const s1 = inout(lin(u, 0.5, 1.12)), s2 = inout(lin(u, 5.4, 6.4));
  const y = s1 * (P.propsTop + 20) + s2 * (P.p3Top - P.propsTop);
  for (const el of [$("#xfeedin"), $(".xh", s), $(".xfaces", s)]) st(el, { transform: `translateY(${-y}px)` });
  const on = u >= PROPS + 0.1, pr = $("#xprops");
  pr.classList.toggle("on", on); $("#xpw").textContent = on ? "Props 6" : "Props 5";
  st(pr, { transform: `scale(${press(u, PROPS) * (1 + 0.12 * Math.sin(Math.PI * lin(u, PROPS + 0.1, PROPS + 0.5)))})` });
  const py = P.props[1] - (P.propsTop + 20);
  burst($$(".xburst", s), u, PROPS + 0.1, P.props[0], py - s2 * (P.p3Top - P.propsTop), 62);
  finger(u, [[PROPS, [P.props[0], py]]]);
}

// 6. Your week: the ring, the days, the board; you pass one coach, then the other
function week(u) {
  vis("xweek", 1); const s = S.xweek, J1 = 2.68, J2 = 4.83;
  rise($(".xh", s), E(u, 0, 0.45), 12);
  const mins = u < J1 ? 165 * out3(lin(u, 0.35, 1.6)) : u < J2 ? mix(165, 211, out3(lin(u, J1, J1 + 0.6))) : mix(211, 281, out3(lin(u, J2, J2 + 0.7)));
  $("#xwt").textContent = fmt(mins);
  $("#xwarc").style.strokeDashoffset = 402.1 * (1 - Math.min(1, mins / 240));
  const full = lin(u, J2 + 0.6, J2 + 1.3);
  st($(".xwring", s), { opacity: E(u, 0.1, 0.4), transform: `scale(${1 + 0.07 * Math.sin(Math.PI * full) + 0.03 * Math.sin(Math.PI * lin(u, J1 + 0.5, J1 + 0.9))})`, filter: `drop-shadow(0 0 ${22 * Math.sin(Math.PI * full)}px rgba(240,220,160,.8))` });
  $("#xwhead").textContent = u >= J2 + 0.6 ? "You hit your week." : "Trained today.";
  rise($(".xwtxt", s), E(u, 0.3, 0.45), 12);
  const days = $$(".xdays > div", s), gold = [[0, 0.5], [1, 0.62], [3, 0.74]];
  days.forEach((d, i) => { rise(d, E(u, 0.3 + i * 0.04, 0.4), 8); });
  for (const [i, t0] of gold) { const k = lin(u, t0, t0 + 0.4), dot = $("i", days[i]); st(dot, { background: k > 0 ? "var(--metal)" : "#161616", transform: `scale(${k > 0 ? back(k) : 1})` }); }
  rise($(".xsec", s), E(u, 0.55, 0.4), 10);
  rise($(".xrows", s), E(u, 0.6, 0.45), 20);
  const rows = $$(".xrow", s), [gary, yinka, you, luis] = rows;
  rows.forEach((r, i) => {
    const grow = out3(lin(u, 0.8 + i * 0.1, 1.9 + i * 0.1));
    const v = r === you ? mins : +r.dataset.m * grow;
    $(".xtm", r).textContent = fmt(v); $(".tr i", r).style.width = Math.min(100, (v / 285) * 100) + "%";
  });
  const s1 = inout(lin(u, J1 + 0.45, J1 + 1.0)), s2 = inout(lin(u, J2 + 0.5, J2 + 1.05));
  st(you, { transform: `translateY(${-66 * (s1 + s2)}px) scale(${1 + 0.03 * Math.sin(Math.PI * s1) + 0.03 * Math.sin(Math.PI * s2)})`, zIndex: 2,
    background: `rgba(200,168,88,${0.2 * Math.max(Math.sin(Math.PI * lin(u, J1 + 0.4, J1 + 1.7)), Math.sin(Math.PI * lin(u, J2 + 0.45, J2 + 1.9)))})` });
  st(yinka, { transform: `translateY(${66 * s1}px)` }); st(gary, { transform: `translateY(${66 * s2}px)` });
  $(".p", you).textContent = s2 > 0.5 ? "1" : s1 > 0.5 ? "2" : "3";
  $(".p", yinka).textContent = s1 > 0.5 ? "3" : "2"; $(".p", gary).textContent = s2 > 0.5 ? "2" : "1";
}

// 7. Clubs: each one on its own group photo
function clubs(u) {
  vis("xclubs", 1); const s = S.xclubs;
  rise($(".xh", s), E(u, 0, 0.45), 12);
  $$(".xcc", s).forEach((c, i) => {
    const k = lin(u, 0.2 + i * 0.55, 0.8 + i * 0.55);
    st(c, { opacity: cl(k * 2.5), transform: `translateY(${(1 - back(k)) * 50}px) scale(${mix(0.93, 1, back(k)) * (i === 0 ? press(u, 3.0) : 1)})` });
    st($(".bg", c), { transform: `scale(${mix(1.14, 1, out3(lin(u, 0.2 + i * 0.55, 5)))})` });
    $$(".r2 img", c).forEach((f, j) => pop(f, lin(u, 0.7 + i * 0.55 + j * 0.07, 1.05 + i * 0.55 + j * 0.07), 0.3));
  });
  finger(u, [[3.0, P["#xcc1"]]]);
}

// 8. A club: this week's matchup runs, your club wins, champs of the week
function club(u) {
  const a = E(u, 0, 0.45); vis("xclub", 1, `translateX(${(1 - a) * 100}%)`); const s = S.xclub, WIN = 3.95, NOTE = 5.3;
  st($("#xkbg"), { transform: `scale(${mix(1.14, 1, out3(lin(u, 0, 8)))})` });
  pop($(".xkh .xcr", s), lin(u, 0.3, 0.7), 0.4); rise($(".xkh h2", s), E(u, 0.38, 0.45)); rise($(".xkh .co", s), E(u, 0.48, 0.45), 10);
  rise($(".xmu", s), E(u, 0.5, 0.5), 30); rise($(".xtw", s), E(u, 0.62, 0.5), 30);
  // the week, raced: they lead early, your club passes them and pulls away
  const k = lin(u, 0.9, 3.5), A = 111 * Math.pow(k, 1.35), B = 99 * Math.pow(k, 0.72);
  const ma = Math.round(A), mb = Math.round(B);
  $("#xma").textContent = fmt(ma); $("#xmb").textContent = fmt(mb);
  const share = k <= 0 ? 0.5 : A / (A + B);
  $("#xmba").style.flex = String(share); $("#xmbb").style.flex = String(1 - share);
  const won = u >= WIN, gap = Math.abs(ma - mb), mw = (n) => `${n} ${n === 1 ? "minute" : "minutes"}`;
  $("#xml").textContent = won ? "Your club won the week." : k <= 0 || gap === 0 ? "It is tied." : ma > mb ? `Your club is ahead by ${mw(gap)} per player.` : `Haymarket 08s is ahead by ${mw(gap)} per player.`;
  $("#xmey").textContent = won ? "Last week's matchup" : "This week's matchup";
  const w = lin(u, WIN, WIN + 0.5);
  st($("#xml"), { transform: `scale(${1 + 0.08 * Math.sin(Math.PI * w)})`, transformOrigin: "0 50%", color: won ? "var(--gold)" : "var(--bone)" });
  st($("#xma"), { color: ma >= mb && k > 0.2 ? "var(--bone)" : "var(--dim)" }); st($("#xmb"), { color: mb > ma ? "var(--bone)" : "var(--dim)" });
  $("#xrecn").textContent = won ? "4-1" : "3-1";
  st($(".xrec", s), { opacity: E(u, 0.6, 0.4), transform: `scale(${1 + 0.16 * Math.sin(Math.PI * lin(u, WIN + 0.1, WIN + 0.6))})` });
  // the gold mark stamps on
  const c = lin(u, WIN + 0.15, WIN + 0.6);
  st($("#xchamp"), { opacity: cl(c * 3), transform: `scale(${mix(1.7, 1, out3(c))})`, transformOrigin: "0 50%", filter: `drop-shadow(0 0 ${14 * Math.sin(Math.PI * lin(u, WIN + 0.3, WIN + 1.8))}px rgba(240,220,160,.9))` });
  burst($$(".xburst", s), u, WIN + 0.4, P.champ[0], P.champ[1], 120, 1.1);
  const n = lin(u, NOTE, NOTE + 0.55);
  st($("#xnote"), { opacity: cl(n * 3), transform: `translateY(${(1 - back(n)) * -120}px) scale(${mix(0.96, 1, back(n))})` });
}

// 9. Strive Pro adds Train: the same app, one more tab, nothing moved
function pro(u) {
  vis("xpro", 1); const s = S.xpro, IN = 1.27, GO = 2.43;
  st($("#xprobody"), { transform: `translateY(${-40 * out3(lin(u, 0, 5))}px)` });
  const c = lin(u, 0.25, 0.8), outc = E(u, GO + 0.2, 0.4);
  st($("#xprocard"), { opacity: cl(c * 2.5) * (1 - outc), transform: `translateY(${(1 - back(c)) * 60 + outc * 20}px) scale(${mix(0.95, 1, back(c))})` });
  const bar = $("#xprobar"), train = $('[data-t="train"]', bar), fr = $('[data-t="friends"]', bar), pill = $(".pill", bar);
  const g = out3(lin(u, IN, IN + 0.55)), glow = Math.sin(Math.PI * lin(u, IN, IN + 1.3));
  st(train, { flex: String(g), opacity: cl(g * 1.6), color: `rgb(${mix(242, 240, glow)},${mix(239, 220, glow)},${mix(232, 160, glow)})`, filter: `drop-shadow(0 0 ${10 * glow}px rgba(240,220,160,.95))`, transform: `scale(${1 + 0.18 * Math.sin(Math.PI * lin(u, IN + 0.1, IN + 0.7))})` });
  const go = inout(lin(u, GO, GO + 0.45)), lit = go > 0.5;
  train.classList.toggle("on", lit); fr.classList.toggle("on", !lit);
  const x0 = fr.offsetLeft, x1 = train.offsetLeft;
  st(pill, { left: mix(x0, x1, go) + "px", width: mix(fr.offsetWidth, Math.max(train.offsetWidth, 1), go) + "px", opacity: 1 });
  // the bar itself swells as the new tab lands, and two gold rings leave the tab
  st(bar, { transform: `scale(${1 + 0.16 * Math.sin(Math.PI * lin(u, IN - 0.05, IN + 0.9))})` });
  $$("#xproring i").forEach((r, i) => { const k = lin(u, IN + 0.1 + i * 0.22, IN + 1.0 + i * 0.22); st(r, { opacity: k <= 0 || k >= 1 ? 0 : 0.9 * (1 - k), transform: `scale(${mix(0.5, 2.4, out3(k))})` }); });
  finger(u, [[GO, [12 + 5 + 30, 844 - 20 - 33]]]);
}

// 10. You: the level fills, turns over, and the medals land
function you(u) {
  vis("xyou", 1); const s = S.xyou, UP = 2.05;
  rise($(".xh", s), E(u, 0, 0.45), 12); rise($(".xyc", s), E(u, 0.12, 0.5), 26);
  $("#xyarc").style.strokeDashoffset = 301.6 * (1 - 0.88 * out3(lin(u, 0.3, 1.6)));
  const c = out3(lin(u, 0.4, 1.6));
  $("#xy1").textContent = fmt(281 * c); $("#xy2").textContent = Math.round(31 * c) + "h";
  const up = u >= UP, f = up ? mix(0, 0.12, E(u, UP + 0.15, 0.5)) : mix(0.55, 1, out3(lin(u, 0.6, UP - 0.1)));
  $("#xybar").style.width = f * 100 + "%";
  const lv = $("#xylvl"); lv.textContent = up ? "Aura level 4" : "Aura level 3";
  const p = lin(u, UP, UP + 0.6);
  st(lv, { transform: `scale(${1 + 0.35 * Math.sin(Math.PI * p)})`, transformOrigin: "0 50%", filter: `drop-shadow(0 0 ${12 * Math.sin(Math.PI * lin(u, UP, UP + 1.4))}px rgba(240,220,160,.95))` });
  $("#xynx").textContent = up ? "6h of training to Level 5" : "A little more training to Level 4";
  st($(".xyring", s), { transform: `scale(${1 + 0.07 * Math.sin(Math.PI * p)})` });
  $$(".xlab", s).forEach((l, i) => rise(l, E(u, 0.5 + i * 0.25, 0.4), 8));
  $$(".xmed > div", s).forEach((m, i) => { const k = lin(u, 2.7 + i * 0.65, 3.15 + i * 0.65); st(m, { opacity: cl(k * 3), transform: `scale(${mix(0.3, 1, back(k))}) rotate(${(1 - out3(k)) * -24}deg)` }); });
  $$(".xycl > div", s).forEach((m, i) => pop(m, lin(u, 0.9 + i * 0.12, 1.35 + i * 0.12), 0.5));
}

// 11. My code: the code draws in under a gold line
function code(u) {
  const a = E(u, 0, 0.45); vis("xcode", 1, `translateX(${(1 - a) * 100}%)`); const s = S.xcode;
  rise($("h1", s), E(u, 0.25, 0.45)); rise($(".p1", s), E(u, 0.35, 0.45), 12);
  const q = lin(u, 0.4, 0.9); st($("#xqr"), { opacity: cl(q * 2.5), transform: `scale(${mix(0.86, 1, back(q))})` });
  const sc = inout(lin(u, 0.8, 2.0));
  st($("#xveil"), { top: sc * 302 + "px" });
  st($("#xscan"), { top: sc * 302 - 60 + "px", opacity: sc > 0 && sc < 1 ? 1 : 0 });
  st($("#xqr"), { boxShadow: `0 0 ${50 * Math.sin(Math.PI * lin(u, 1.9, 3.0))}px rgba(240,220,160,.55)` });
  rise($(".who", s), E(u, 1.9, 0.45), 12);
  const b = E(u, 2.1, 0.45);
  st($("#xsend"), { opacity: b, transform: `translateY(${(1 - b) * 12}px) scale(${press(u, 3.9)})` });
  finger(u, [[3.9, P["#xsend"]]]);
}

// 12. Bring 3 teammates: the boxes fill, the month is earned
function squad(u) {
  vis("xsquad", 1); const s = S.xsquad, EARN = 3.6;
  rise($(".xh", s), E(u, 0, 0.45), 12); rise($(".xsq", s), E(u, 0.1, 0.5), 26);
  $$(".xbox", s).forEach((b, i) => {
    const t0 = 0.8 + i * 0.7, k = lin(u, t0, t0 + 0.5);
    st($(".fill", b), { opacity: cl(k * 2) });
    st($("img", b), { opacity: cl(k * 3), transform: `scale(${mix(0.3, 1, back(k))})` });
    const sp = $("span", b); if (!sp.dataset.nm) sp.dataset.nm = sp.textContent;
    sp.textContent = k > 0 ? sp.dataset.nm : "Open"; st(sp, { color: k > 0 ? "var(--bone)" : "var(--faint)" });
    st($(".ck", b), { transform: `scale(${k > 0.3 ? back(lin(u, t0 + 0.15, t0 + 0.55)) : 0})` });
    st(b, { transform: `scale(${1 + 0.06 * Math.sin(Math.PI * k)})` });
  });
  const e = lin(u, EARN, EARN + 0.6);
  st($("#xearn"), { opacity: cl(e * 2.5), transform: `translateY(${(1 - back(e)) * 50}px) scale(${mix(0.9, 1, back(e))})` });
  burst($$(".xburst", s), u, EARN + 0.15, P.earn[0], P.earn[1] - 40, 150, 1.2);
}
