/* Maker Hip: the 16-bit island. One drawing for the intro (time t, 0..INTRO_END s), the main page's living
 * background (loop), and the video (tools render it frame by frame through the same code). Deterministic: no
 * Math.random, everything is a function of t. Canvas 320 x 180. */
"use strict";
const W = 320, H = 180;
const INTRO_END = 21.0;
const BPM = 120, BEAT = 60 / BPM, SIX = BEAT / 4;

const P = {
  sky: ["#1b1238", "#2b1a4f", "#47276a", "#6e3479", "#a3437c", "#d65d74", "#f2845f", "#ffb35a"],
  sun: "#ffd86b", sun2: "#fff1a8",
  sea: ["#14305e", "#1d3f7a", "#25579a", "#2f73b8"], foam: "#bfe8ff", glint: "#ffe4a0",
  sand: "#f2d08a", sand2: "#d9a95b", sand3: "#b07c3d", wet: "#c79a5a",
  trunk: "#8a5a2b", trunk2: "#5e3a1a", leaf: "#2f9e44", leaf2: "#1f6e30", leaf3: "#62c35b",
  skin: "#f1c27d", skin2: "#c98f52", hair: "#6b3e1e", hair2: "#4a2a12", band: "#ff5ca8",
  shirt: "#ffcc33", flower: "#ff5c5c", flower2: "#5cc8ff", pants: "#3c5aa6", pants2: "#2a4080",
  ink: "#1a1020", white: "#ffffff", note: "#ffe066", cloud: "#f7c6d9", cloud2: "#d98fb3",
  metal: "#c0c7d6", metal2: "#7c8597", metal3: "#4b5263", orange: "#ff7a2f", orange2: "#ffb070",
  wood: "#a0703c", wood2: "#6e4a24", glass: "#7fe3c8", fish: "#ff9a3c", fish2: "#ffd36b",
  dolphin: "#6f8fb8", dolphin2: "#9fb9d9", ship: "#e8e0d0", ship2: "#8a3a2a",
};

let cx = null;
function setCtx(c) { cx = c; cx.imageSmoothingEnabled = false; }
function R(x, y, w, h, c) { cx.fillStyle = c; cx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function px(x, y, c) { R(x, y, 1, 1, c); }
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

/* ---------------- a 5 x 7 pixel font (what the titles need) ---------------- */
const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  P: ["11110", "10001", "10001", "10001", "11110", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};
function textW(s, sc) { return s.length * 6 * sc - sc; }
function text(s, x, y, sc, c, shadow) {
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] || FONT[" "];
    for (let r = 0; r < 7; r++) for (let k = 0; k < 5; k++) if (g[r][k] === "1") {
      if (shadow) R(x + (i * 6 + k) * sc + sc, y + r * sc + sc, sc, sc, shadow);
      R(x + (i * 6 + k) * sc, y + r * sc, sc, sc, c);
    }
  }
}

/* ---------------- the world ---------------- */
function sky(t) {
  const bands = P.sky.length, top = 0, hz = 104;
  for (let i = 0; i < bands; i++) {
    const y0 = top + Math.floor(i * hz / bands), y1 = top + Math.floor((i + 1) * hz / bands);
    R(0, y0, W, y1 - y0, P.sky[i]);
    if (i > 0) for (let x = (i * 7) % 4; x < W; x += 4) px(x, y0, P.sky[i - 1]);   // dithered band edges
  }
  for (let s = 0; s < 28; s++) {                                                   // the first stars
    const x = Math.floor(hash(s) * W), y = Math.floor(hash(s + 50) * 40);
    if ((Math.floor(t * 2 + s) % 5) !== 0) px(x, y, s % 3 ? "#ffffff" : "#ffd6f0");
  }
}

function sun(x, y) {
  for (let r = 22; r >= 0; r--) {
    const c = r > 16 ? "#ff9a5a" : r > 8 ? P.sun : P.sun2;
    if (r > 16 && r % 2) continue;
    for (let dy = -r; dy <= 0; dy++) {
      const w = Math.floor(Math.sqrt(r * r - dy * dy));
      if (r === 22 || r === 16 || r === 8) R(x - w, y + dy, w * 2, 1, c);
    }
  }
  for (let dy = -16; dy <= 0; dy++) { const w = Math.floor(Math.sqrt(256 - dy * dy)); R(x - w, y + dy, w * 2, 1, dy > -9 ? P.sun : P.sun2); }
  for (let k = 0; k < 4; k++) R(x - 16, y - 3 - k * 4, 32, 1, "#ff9a5a");          // the stripes of a sunset sun
}

function cloud(x, y, s) {
  R(x, y + 4 * s, 34 * s, 4 * s, P.cloud2);
  R(x + 4 * s, y + 2 * s, 24 * s, 4 * s, P.cloud);
  R(x + 10 * s, y, 12 * s, 3 * s, P.cloud);
  R(x + 2 * s, y + 6 * s, 30 * s, 1 * s, P.cloud2);
}

function sea(t, hz) {
  const rows = H - hz;
  for (let y = 0; y < rows; y++) {
    const k = Math.min(P.sea.length - 1, Math.floor(y / rows * P.sea.length * 1.3));
    R(0, hz + y, W, 1, P.sea[P.sea.length - 1 - k]);
  }
  for (let y = hz + 2; y < H; y += 3 + Math.floor((y - hz) / 18)) {                // wave lines, nearer = longer, faster
    const d = (y - hz) / rows, sp = 6 + 22 * d, len = 3 + Math.floor(10 * d);
    for (let x = -20; x < W + 20; x += 18 + Math.floor(10 * (1 - d))) {
      const xx = (x + t * sp + hash(y) * 40) % (W + 40) - 20;
      R(xx, y, len, 1, d > 0.5 ? P.foam : P.sea[3]);
    }
  }
  for (let i = 0; i < 18; i++) {                                                   // the sun's path on the water
    const y = hz + 2 + i * 2, w = 18 - i * 0.6 + Math.sin(t * 3 + i) * 3;
    if (i % 2 === 0) R(232 - w / 2 + Math.sin(t * 2 + i * 1.7) * 4, y, w, 1, P.glint);
  }
}

function island(cxp, cy, s) {
  const w = 74 * s, h = 13 * s;
  for (let dy = -h; dy <= h; dy++) {                                              // the wet rim, then the sand
    const ww = Math.floor(w * Math.sqrt(1 - (dy * dy) / (h * h)));
    R(cxp - ww - 3 * s, cy + dy, ww * 2 + 6 * s, 1, P.wet);
  }
  for (let dy = -h; dy <= h; dy++) {
    const ww = Math.floor((w - 2 * s) * Math.sqrt(1 - (dy * dy) / (h * h)));
    R(cxp - ww, cy + dy, ww * 2, 1, dy > h * 0.35 ? P.sand2 : P.sand);
  }
  for (let i = 0; i < 26; i++) px(cxp - w + 10 + hash(i + 9) * (w * 2 - 20), cy - h / 2 + hash(i + 3) * h, P.sand3);
}

function palm(x, y, t, s) {
  for (let i = 0; i < 58; i++) {                                                   // a bent trunk, ringed
    const xx = x + Math.sin(i / 58 * 1.2) * 14 * s, yy = y - i * s;
    R(xx - 3 * s, yy, 6 * s, s, i % 6 < 2 ? P.trunk2 : P.trunk);
  }
  const tx = x + Math.sin(1.2) * 14 * s, ty = y - 58 * s, sway = Math.sin(t * 1.6) * 2;
  const fronds = [[-1, -0.25], [-1, 0.35], [1, -0.2], [1, 0.4], [-0.3, -1], [0.4, -0.9]];
  for (const [dx, dy] of fronds) for (let i = 0; i < 26; i++) {
    const u = i / 26, xx = tx + dx * i * 1.3 * s + sway * u, yy = ty + dy * i * 0.8 * s + u * u * 12 * s;
    R(xx - s, yy - s, 3 * s, 2 * s, i % 3 === 0 ? P.leaf3 : u > 0.6 ? P.leaf2 : P.leaf);
  }
  R(tx - 4 * s, ty - 1 * s, 4 * s, 4 * s, P.trunk2);                              // coconuts
  R(tx + 1 * s, ty + 1 * s, 4 * s, 4 * s, P.wood2);
}

/* the hippie: pose 0 sitting (arms 0 rest, 1 left up, 2 right up), 1 standing, 2 dancing (frame) */
function hippie(x, y, pose, arms, frame) {
  const sit = pose === 0, b = pose === 2 ? (frame % 2) : 0;
  const top = y - (sit ? 22 : 30) - b;
  // hair (long), headband, face
  R(x - 5, top, 10, 3, P.hair);
  R(x - 6, top + 2, 12, 9, P.hair);
  R(x - 6, top + 11, 3, 6, P.hair2);
  R(x + 3, top + 11, 3, 6, P.hair2);
  R(x - 4, top + 3, 8, 8, P.skin);
  R(x - 5, top + 3, 10, 2, P.band);
  px(x + 5, top + 5, P.band); px(x + 6, top + 6, P.band);
  px(x - 2, top + 6, P.ink); px(x + 2, top + 6, P.ink);
  R(x - 2, top + 9, 4, 1, pose === 0 && arms === 0 ? P.skin2 : P.flower);           // a sigh, or a smile
  R(x - 3, top + 10, 6, 2, P.hair2);                                                // beard
  // shirt with flowers
  const sy = top + 12;
  R(x - 5, sy, 10, 9, P.shirt);
  px(x - 3, sy + 2, P.flower); px(x + 2, sy + 4, P.flower2); px(x - 1, sy + 6, P.flower); px(x + 3, sy + 1, P.flower);
  // arms
  const armL = arms === 1 || (pose === 2 && frame % 4 < 2), armR = arms === 2 || (pose === 2 && frame % 4 >= 2);
  if (armL) { R(x - 8, sy - 4, 3, 7, P.skin); R(x - 9, sy - 6, 3, 3, P.skin); } else R(x - 7, sy + 1, 2, 8, P.skin);
  if (armR) { R(x + 5, sy - 4, 3, 7, P.skin); R(x + 6, sy - 6, 3, 3, P.skin); } else R(x + 5, sy + 1, 2, 8, P.skin);
  // legs
  if (sit) {
    R(x - 6, sy + 8, 13, 4, P.pants);
    R(x + 4, sy + 8, 4, 6, P.pants2);
    R(x + 5, sy + 13, 4, 2, P.skin2);
    R(x - 7, sy + 11, 4, 2, P.skin2);
  } else {
    const l = pose === 2 ? (frame % 2 ? 1 : -1) : 0;
    R(x - 4 + l, sy + 9, 3, 9, P.pants); R(x + 1 - l, sy + 9, 3, 9, P.pants2);
    R(x - 5 + l, sy + 17, 4, 2, P.skin2); R(x + 1 - l, sy + 17, 4, 2, P.skin2);
  }
}

function note(x, y, c) { R(x, y, 3, 2, c); R(x + 2, y - 6, 1, 6, c); R(x + 3, y - 6, 2, 1, c); }
function sparkle(x, y, r, c) { R(x - r, y, r * 2 + 1, 1, c); R(x, y - r, 1, r * 2 + 1, c); px(x - 1, y - 1, c); px(x + 1, y + 1, c); }

/* the machine, built from what the sea brings (k = pieces in place, 0..5); on = its screen alight */
function machine(x, y, k, on, t) {
  if (k >= 1) { R(x - 12, y - 8, 24, 8, P.wood); R(x - 12, y - 8, 24, 1, P.wood2); R(x - 12, y - 1, 24, 1, P.wood2); }   // plank: the body
  if (k >= 2) { R(x - 10, y - 18, 20, 10, P.metal2); R(x - 9, y - 17, 18, 8, P.metal); }                                  // tin can: the case
  if (k >= 3) {                                                                                                           // the speaker
    const p = on ? Math.floor((t / SIX) % 2) : 0;
    R(x - 8 - p, y - 16 - p, 7 + 2 * p, 6 + 2 * p, P.metal3); R(x - 6, y - 14, 3, 2, P.ink);
  }
  if (k >= 4) { R(x + 2, y - 16, 6, 3, on ? P.orange : P.metal3); px(x + 3, y - 15, P.white); px(x + 6, y - 15, P.white); R(x + 2, y - 12, 2, 2, P.ink); R(x + 6, y - 12, 2, 2, P.ink); }  // face screen, knobs
  if (k >= 5) { R(x + 7, y - 26, 1, 8, P.metal2); R(x + 6, y - 28, 3, 3, on && Math.floor(t * 4) % 2 ? P.orange2 : P.glass); }  // bottle-top antenna
}

/* a piece flying from the shore to the machine: s 0..1 along its arc */
function flyer(kind, x0, y0, x1, y1, s, t) {
  const x = x0 + (x1 - x0) * s, y = y0 + (y1 - y0) * s - Math.sin(Math.PI * s) * 34;
  if (kind === 0) R(x - 8, y - 2, 16, 4, P.wood);
  if (kind === 1) { R(x - 4, y - 5, 8, 10, P.metal); R(x - 4, y - 5, 8, 1, P.metal2); }
  if (kind === 2) { R(x - 3, y - 3, 6, 6, P.metal3); }
  if (kind === 3) { R(x - 3, y - 2, 6, 4, P.orange); }
  if (kind === 4) { R(x - 1, y - 6, 3, 9, P.glass); R(x - 1, y - 7, 3, 1, P.metal2); }
}

function fish(x, y, f, c, c2) { R(x, y, 6, 3, c); R(x - 2 + (f ? 0 : 1), y - 1, 2, 5, c2); px(x + 4, y + 1, P.ink); }
function dolphin(x, y, a) {
  const dx = Math.cos(a), dy = Math.sin(a);
  for (let i = 0; i < 12; i++) R(x + dx * i - 1, y + dy * i - 1, 3, 3, i > 8 ? P.dolphin2 : P.dolphin);
  R(x + dx * 5 - dy * 3, y + dy * 5 + dx * 3, 2, 3, P.dolphin);
}
function ship(x, y) {
  R(x, y, 26, 5, P.ship2); R(x + 2, y + 5, 22, 1, P.ink);
  R(x + 11, y - 18, 1, 18, P.wood2);
  for (let i = 0; i < 14; i++) R(x + 12, y - 17 + i, Math.floor(i * 0.8) + 1, 1, P.ship);
  for (let i = 0; i < 10; i++) R(x + 10 - Math.floor(i * 0.7), y - 14 + i, Math.floor(i * 0.7) + 1, 1, P.ship);
}
function gull(x, y, t) { const w = Math.floor(t * 6) % 2; R(x - 4, y - w, 4, 1, P.white); R(x + 1, y - w, 4, 1, P.white); px(x, y, P.white); }

/* ---------------- the intro ---------------- */
const LAND = [11.5, 12.2, 12.9, 13.6, 14.3];                 // the pieces land (the "chup")
function drawIntro(t) {
  // 0 .. 3 s: far away; then the island close
  if (t < 3.2) {
    sky(t);
    sun(232, 104);
    cloud(30 + t * 3, 30, 1); cloud(180 - t * 2, 18, 1); cloud(250 + t * 2, 46, 1);
    sea(t, 104);
    const s = 1 + ease((t - 1.2) / 2) * 0.0;
    island(130, 118, 0.25 * s); palm(134, 118, t, 0.25);
    if (t > 2.4) { const k = ease((t - 2.4) / 0.8); R(0, 0, W, H * k * 0.5, "#000"); R(0, H - H * k * 0.5, W, H * k * 0.5, "#000"); }
    return;
  }
  const tl = t;
  sky(tl);
  sun(232, 104);
  cloud(20 + tl * 2, 26, 2); cloud(200 - tl * 1.5, 12, 1);
  sea(tl, 104);
  if (tl > 15 && tl < 21) ship(W + 10 - (tl - 15) * 22, 101);                       // a ship turns to the island
  island(160, 146, 1);
  palm(206, 140, tl, 1);
  if (tl < 3.7) { const k = 1 - ease((tl - 3.2) / 0.5); R(0, 0, W, H * k * 0.5, "#000"); R(0, H - H * k * 0.5, W, H * k * 0.5, "#000"); }
  gull(((tl * 18) % (W + 40)) - 20, 34 + Math.sin(tl) * 4, tl);

  const hx = 140, hy = 146;
  const beat = Math.floor(tl / SIX);
  // 3 .. 7: alone; a sigh bubble
  if (tl < 7) {
    hippie(hx, hy, 0, 0, 0);
    if (tl > 4 && tl < 6.6) {
      R(hx + 6, hy - 40, 20, 10, P.white); R(hx + 8, hy - 31, 3, 3, P.white); px(hx + 6, hy - 29, P.white);
      for (let k = 0; k < 3; k++) if (tl > 4.4 + k * 0.4) R(hx + 9 + k * 5, hy - 36, 2, 2, P.ink);
    }
  } else if (tl < 11) {
    // 7 .. 11: he taps a coconut and a shell; notes rise
    const hit = beat % 2 === 0 ? 1 : 2;
    hippie(hx, hy, 0, hit, 0);
    R(hx - 13, hy - 12, 6, 5, P.wood2);                                              // the coconut
    R(hx + 8, hy - 11, 5, 3, "#f5e1c8");                                             // the shell
    for (let k = 0; k < 8; k++) {
      const t0 = 7 + k * 0.5, a = tl - t0;
      if (a >= 0 && a < 1.6) note(hx - 14 + (k % 2) * 24 + Math.sin(a * 6) * 3, hy - 20 - a * 26, a < 1.2 ? P.note : P.white);
    }
  } else if (tl < 15) {
    // 11 .. 15: the sea brings pieces, they fly to the machine one by one
    hippie(hx, hy, 1, (beat % 4 === 0) ? 1 : 0, 0);
    const mx = 176, my = 146;
    let k = 0;
    for (let i = 0; i < 5; i++) {
      const st = LAND[i] - 0.6, s = (tl - st) / 0.6;
      if (tl >= LAND[i]) k = i + 1;
      else if (s >= 0) flyer(i, 236 + i * 6, 158, mx, my - 6, s, tl);
      else if (tl > st - 0.8) { const bob = Math.sin(tl * 5 + i) * 1; flyer(i, 236 + i * 6, 162 + bob, 236 + i * 6, 162 + bob, 0, tl); }
      const sinceLand = tl - LAND[i];
      if (sinceLand >= 0 && sinceLand < 0.35) sparkle(mx + (i - 2) * 4, my - 14 - i * 2, 2 + Math.floor(sinceLand * 12), P.white);
    }
    machine(mx, my, k, false, tl);
  } else {
    // 15 ..: it plays; rings across the sea, fish and dolphins jump, he dances
    const f = Math.floor(tl / SIX);
    hippie(hx, hy, 2, 0, f);
    machine(176, 146, 5, true, tl);
    for (let r = 0; r < 4; r++) {
      const a = ((tl - 15) / BEAT - r * 0.5) % 2;
      if (a < 0 || tl < 15 + r * 0.25) continue;
      const rad = 10 + a * 70;
      for (let ang = 0; ang < 64; ang++) {
        const th = ang / 64 * Math.PI * 2, xx = 176 + Math.cos(th) * rad * 1.6, yy = 132 + Math.sin(th) * rad * 0.45;
        if (yy > 104 && (ang + Math.floor(tl * 8)) % 3) px(xx, yy, a < 1.2 ? P.orange2 : P.foam);
      }
    }
    for (let i = 0; i < 4; i++) {
      const per = 1.6 + i * 0.3, a = ((tl - 15 + i * 0.4) % per) / 0.7;
      if (a < 1) fish(40 + i * 70 + a * 10, 160 - Math.sin(Math.PI * a) * 18, Math.floor(tl * 8) % 2, i % 2 ? P.fish : P.fish2, P.flower);
    }
    const da = ((tl - 15.5) % 3) / 1.2;
    if (da > 0 && da < 1) dolphin(26 + da * 40, 128 - Math.sin(Math.PI * da) * 16, -Math.PI / 2 + da * Math.PI);
  }
  // 18 ..: the title drops in
  if (tl > 18) {
    const d = ease((tl - 18) / 0.7), bounce = Math.abs(Math.sin((tl - 18) * 9)) * (1 - d) * 10;
    const s = 4, tw = textW("MAKER HIP", s);
    const y = -40 + d * 64 - bounce;
    R(0, y - 8, W, 7 * s + 16, "rgba(20,10,40,0.55)");
    text("MAKER HIP", (W - tw) / 2, y, s, P.orange, P.ink);
    if (tl > 18.7) {
      const s2 = 1, tw2 = textW("BY HIPPIE MAKER", s2);
      text("BY HIPPIE MAKER", (W - tw2) / 2, y + 7 * s + 4, s2, P.white, P.ink);
    }
    if (tl > 19.5 && Math.floor(tl * 2.5) % 2 === 0) {
      const tw3 = textW("PRESS START", 1);
      text("PRESS START", (W - tw3) / 2, 92, 1, P.note, P.ink);
    }
  }
}

/* the main page's background: the island playing, for ever */
function drawLoop(t) {
  const tt = 15 + (t % 12);
  sky(t);
  sun(232, 104);
  cloud(((20 + t * 2) % (W + 80)) - 60, 26, 2); cloud(((200 - t * 1.5) % (W + 80) + W + 80) % (W + 80) - 60, 12, 1);
  sea(t, 104);
  const sx = ((W + 30 - (t * 6) % (W + 80)));
  ship(sx, 101);
  island(160, 146, 1);
  palm(206, 140, t, 1);
  gull(((t * 18) % (W + 40)) - 20, 34 + Math.sin(t) * 4, t);
  const f = Math.floor(t / SIX);
  hippie(140, 146, 2, 0, f);
  machine(176, 146, 5, true, t);
  for (let i = 0; i < 4; i++) {
    const per = 1.6 + i * 0.3, a = ((tt - 15 + i * 0.4) % per) / 0.7;
    if (a < 1) fish(40 + i * 70 + a * 10, 160 - Math.sin(Math.PI * a) * 18, Math.floor(t * 8) % 2, i % 2 ? P.fish : P.fish2, P.flower);
  }
  const da = ((t + 0.5) % 4) / 1.2;
  if (da > 0 && da < 1) dolphin(26 + da * 40, 128 - Math.sin(Math.PI * da) * 16, -Math.PI / 2 + da * Math.PI);
}

/* ---------------- the music (chiptune, original): one scheduler for live and offline ---------------- */
/* 16ths from t = 0; the intro is 42 bars of 16ths at 120 BPM (21 s) */
const BASS = [45, 0, 45, 0, 52, 0, 45, 0, 43, 0, 43, 0, 50, 0, 43, 0, 41, 0, 41, 0, 48, 0, 41, 0, 40, 0, 40, 0, 47, 0, 44, 0];
const LEAD = [69, 0, 72, 0, 76, 0, 74, 72, 71, 0, 67, 0, 71, 0, 74, 0, 72, 0, 69, 0, 65, 0, 69, 72, 71, 0, 68, 0, 64, 0, 0, 0];
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

function voice(ctx, dest, type, f, t0, dur, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.004);
  g.gain.setValueAtTime(vol, t0 + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.02);
}
let noiseBuf = null;
function noise(ctx, dest, t0, dur, vol, hp) {
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); let s = 22222;
    for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
  }
  const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  n.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = hp;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  n.connect(f); f.connect(g); g.connect(dest); n.start(t0); n.stop(t0 + dur + 0.02);
}

/* schedule the intro's sound between intro times a and b (seconds), the context's time at intro t = 0 being base */
function scheduleIntro(ctx, dest, base, a, b) {
  for (let i = Math.ceil(a / SIX); i * SIX < Math.min(b, INTRO_END); i++) {
    const t = i * SIX, at = base + t, s = i % 32;
    if (t < 3) { if (i % 8 === 0) voice(ctx, dest, "triangle", mtof(57 + (i / 8 % 2) * 7), at, 1.2, 0.18); continue; }  // waves: soft pads
    if (t < 7) { if (i % 8 === 0) voice(ctx, dest, "triangle", mtof(i % 16 ? 52 : 45), at, 1.6, 0.16); if (t > 4.4 && t < 5.7 && i % 2 === 0) voice(ctx, dest, "square", mtof(64 - (i % 6)), at, 0.08, 0.05); continue; }
    if (t < 11) {                                                                 // the taps: a coconut, a shell
      if (i % 2 === 0) voice(ctx, dest, "triangle", i % 4 === 0 ? 330 : 523, at, 0.09, 0.32);
      if (i % 8 === 4) noise(ctx, dest, at, 0.05, 0.12, 4000);
      if (t >= 9 && BASS[s]) voice(ctx, dest, "triangle", mtof(BASS[s]), at, SIX * 1.6, 0.22);
      continue;
    }
    if (t < 15) {                                                                 // pieces arrive: chup
      if (BASS[s]) voice(ctx, dest, "triangle", mtof(BASS[s]), at, SIX * 1.6, 0.22);
      if (i % 4 === 0) noise(ctx, dest, at, 0.03, 0.1, 6000);
      for (const L of LAND) if (Math.abs(L - t) < SIX / 2) { voice(ctx, dest, "square", 880, at, 0.06, 0.12); voice(ctx, dest, "square", 1320, at + 0.05, 0.08, 0.1); }
      continue;
    }
    // 15 ..: the full band
    if (BASS[s]) voice(ctx, dest, "triangle", mtof(BASS[s]), at, SIX * 1.6, 0.24);
    if (LEAD[s] && t < 20.5) voice(ctx, dest, "square", mtof(LEAD[s]), at, SIX * 1.8, 0.085);
    if (i % 4 === 0) voice(ctx, dest, "sine", 120, at, 0.12, 0.45);              // kick
    if (i % 8 === 4) noise(ctx, dest, at, 0.12, 0.22, 1500);                       // snare
    if (i % 2 === 1) noise(ctx, dest, at, 0.03, 0.07, 7000);                       // hat
    if (t >= 18 && t < 18.2) [72, 76, 79, 84].forEach((n, k) => voice(ctx, dest, "square", mtof(n), at + k * 0.07, 0.5, 0.07));  // the title
  }
}

/* the main page's loop: the band, quieter, every 16 s */
function scheduleLoop(ctx, dest, base, a, b) {
  for (let i = Math.ceil(a / SIX); i * SIX < b; i++) {
    const at = base + i * SIX, s = i % 32;
    if (BASS[s]) voice(ctx, dest, "triangle", mtof(BASS[s]), at, SIX * 1.6, 0.16);
    if (LEAD[s] && (Math.floor(i / 64) % 2)) voice(ctx, dest, "square", mtof(LEAD[s]), at, SIX * 1.8, 0.05);
    if (i % 4 === 0) voice(ctx, dest, "sine", 120, at, 0.12, 0.3);
    if (i % 8 === 4) noise(ctx, dest, at, 0.1, 0.12, 1500);
    if (i % 2 === 1) noise(ctx, dest, at, 0.03, 0.04, 7000);
  }
}
