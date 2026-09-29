// Map data, collision, raycasts, nav graph and meshes.
// Layout is symmetric under a 180 degree turn about the origin: Red holds -X, Blue holds +X.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';
import { mergeStatic } from './merge.js';

export const STEP = 0.42;
export const solids = [];
export const BOUNDS = { x: 30, z: 27 };
export const KILL_Y = -12;

const add = (o) => { solids.push(o); return o; };
const box = (x0, x1, z0, z1, y0, y1, mat = 'wall', extra = {}) => add({ x0, x1, z0, z1, y0, y1, ramp: null, mat, ...extra });
const ramp = (x0, x1, z0, z1, y0, axis, a, b, ya, yb, extra = {}) =>
  add({ x0, x1, z0, z1, y0, y1: Math.max(ya, yb), ramp: { axis, a, b, ya, yb }, mat: 'ramp', ...extra });
const pBox = (x0, x1, z0, z1, y0, y1, mat, extra = {}) => {
  box(x0, x1, z0, z1, y0, y1, mat, { side: 1, ...extra });
  box(-x1, -x0, -z1, -z0, y0, y1, mat, { side: -1, ...extra });
};
const pRamp = (x0, x1, z0, z1, y0, axis, a, b, ya, yb, mat = 'ramp') => {
  ramp(x0, x1, z0, z1, y0, axis, a, b, ya, yb, { side: 1, mat });
  ramp(-x1, -x0, -z1, -z0, y0, axis, -a, -b, ya, yb, { side: -1, mat });
};
const T = 0.6;

// ---- level: a Forerunner outpost hanging over a snowy void ---------------------------------
// Rotationally symmetric about the origin. Blue holds +X, Red holds -X. There is NO floor: fall and you die.
// Levels: L0 bottom deck y=0 | L1 mid corridor + bases y=4 | L2 top-mid deck + tower decks y=8 | L3 sniper ledges y=12
box(-29, 29, -7, 7, -T, 0, 'deck');                                   // L0 bottom deck (bottom rooms + bottom mid)
box(-8, 8, -5.5, 5.5, 4 - T, 4, 'deck');                              // L1 under-glass corridor
pBox(8, 16, -2, 5.5, 4 - T, 4, 'deck');                               // L1 with the ramp hole cut out
pBox(16, 29, -5.5, 5.5, 4 - T, 4, 'deck');
pBox(19, 29, -6.4, 6.4, 4 - T, 4, 'base');                            // base slab (spawn)
pBox(28.4, 29, -6.4, 6.4, 4, 8.5, 'wall');                            // base back wall
pBox(19, 22.4, 6, 6.4, 4, 6.4, 'wall'); pBox(25.6, 29, 6, 6.4, 4, 6.4, 'wall');       // base side walls (south door for the elbow)
pBox(19, 29, -6.4, -6, 4, 6.4, 'wall');
pBox(26.4, 28.2, -5.6, -4.4, 4, 5.2, 'post'); pBox(26.4, 28.2, 4.4, 5.6, 4, 5.2, 'post');      // base cover
pRamp(8, 16, -5.5, -2, -T, 'x', 8, 16, 0, 4);                         // bottom -> mid ramp
pRamp(12, 20, -2, 2, 4, 'x', 20, 12, 4, 8);                           // mid -> top-mid ramp
// top-mid deck with crenellated cover posts (the glass panel is drawn in buildWorld)
box(-12, 12, -6.5, 6.5, 8 - T, 8, 'deck');
for (const x of [-9, -4.5, 0, 4.5, 9]) { box(x - 0.45, x + 0.45, -6.4, -5.6, 8, 9.5, 'post'); box(x - 0.45, x + 0.45, 5.6, 6.4, 8, 9.5, 'post'); }
// tower bridge, tower deck, snipe ramp, sniper ledge
pBox(12, 21, -10, -4.5, 8 - T, 8, 'deck');
pBox(21, 29, -17, -7, 0, 8, 'tower');
pBox(22.2, 23, -16.6, -15.8, 8, 9.4, 'post'); pBox(27.6, 28.4, -16.6, -15.8, 8, 9.4, 'post');
pRamp(24.5, 27.5, -16, -8, 8, 'z', -8, -16, 8, 12, 'ramp');
pBox(22, 29, -21, -16, 12 - T, 12, 'deck');
pBox(29, 29.6, -21, -16, 12, 14.4, 'wall');
pBox(22, 22.6, -20.9, -20.3, 12, 15, 'post'); pBox(28.4, 29, -20.9, -20.3, 12, 15, 'post'); pBox(22, 22.6, -16.4, -15.8, 12, 15, 'post'); pBox(28.4, 29, -16.4, -15.8, 12, 15, 'post');
// elbow: long railed ramp from the base door down to the bottom, then an L-shaped landing back to the bottom deck
pRamp(22.4, 25.6, 6.4, 15, -T, 'z', 6.4, 15, 4, 0);
pRamp(22.4, 22.8, 6.4, 15, -T, 'z', 6.4, 15, 5, 1, 'rail'); pRamp(25.2, 25.6, 6.4, 15, -T, 'z', 6.4, 15, 5, 1, 'rail');
pBox(12, 26, 15, 19, -T, 0, 'deck'); pBox(12, 15, 7, 15, -T, 0, 'deck');
pBox(12, 26, 18.6, 19, 0, 0.9, 'rail'); pBox(25.6, 26, 15, 19, 0, 0.9, 'rail'); pBox(12, 22.4, 15, 15.4, 0, 0.9, 'rail'); pBox(12, 12.4, 7.4, 15, 0, 0.9, 'rail'); pBox(14.6, 15, 7.4, 15, 0, 0.9, 'rail');

// ---- collision --------------------------------------------------------------
export function topAt(s, x, z) {
  const r = s.ramp;
  if (!r) return s.y1;
  const c = r.axis === 'x' ? x : z;
  return r.ya + (r.yb - r.ya) * clamp((c - r.a) / (r.b - r.a), 0, 1);
}

export function groundAt(x, z, refY) {
  let best = -Infinity;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
    const t = topAt(s, x, z);
    if (t <= refY + STEP && t > best) best = t;
  }
  return best;
}

export function blocked(x, z, y, r, h) {
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (s.y0 >= y + h) continue;
    const cx = x < s.x0 ? s.x0 : x > s.x1 ? s.x1 : x;
    const cz = z < s.z0 ? s.z0 : z > s.z1 ? s.z1 : z;
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz >= r * r) continue;
    if (topAt(s, cx, cz) > y + STEP) return true;
  }
  return false;
}

// lowest overhead underside between yFrom and yTo above (x,z)
export function ceilingBetween(x, z, yFrom, yTo) {
  let best = Infinity;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (x < s.x0 - 0.3 || x > s.x1 + 0.3 || z < s.z0 - 0.3 || z > s.z1 + 0.3) continue;
    if (s.y0 >= yFrom - 0.02 && s.y0 <= yTo && s.y0 < best) best = s.y0;
  }
  return best;
}

export function pointSolid(x, y, z) {
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1 || y < s.y0) continue;
    if (y <= topAt(s, x, z)) return true;
  }
  return false;
}

// distance along ray to first solid hit, or Infinity
export function rayWorld(ox, oy, oz, dx, dy, dz, max = 120) {
  const step = 0.2;
  let t = 0, prev = 0;
  while (t < max) {
    if (pointSolid(ox + dx * t, oy + dy * t, oz + dz * t)) {
      let lo = prev, hi = t;
      for (let i = 0; i < 6; i++) {
        const m = (lo + hi) * 0.5;
        if (pointSolid(ox + dx * m, oy + dy * m, oz + dz * m)) hi = m; else lo = m;
      }
      return hi;
    }
    prev = t; t += step + t * 0.004;
  }
  return Infinity;
}

export function los(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const d = Math.hypot(dx, dy, dz);
  if (d < 0.01) return true;
  return rayWorld(ax, ay, az, dx / d, dy / d, dz / d, d - 0.3) === Infinity;
}

// ---- nav graph ---------------------------------------------------------------
export const nav = { nodes: [], built: false };

export function buildNav() {
  const N = nav.nodes; N.length = 0;
  const G = 2;
  for (let x = -30; x <= 30; x += G) {
    for (let z = -26; z <= 26; z += G) {
      const ys = new Set();
      for (const s of solids) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) ys.add(Math.round(topAt(s, x, z) * 100) / 100);
      for (const y of ys) {
        if (y > 12.5 || y < -0.5) continue;
        if (blocked(x, z, y, 0.5, 1.75)) continue;
        if (Math.abs(groundAt(x, z, y) - y) > 0.06) continue;
        // headroom
        let head = false;
        for (const s of solids) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && s.y0 > y + 0.05 && s.y0 < y + 1.8) head = true;
        if (head) continue;
        N.push({ id: N.length, x, y, z, nb: [] });
      }
    }
  }
  const walk = (a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    const n = Math.ceil(d / 0.25);
    let cy = a.y;
    for (let i = 1; i <= n; i++) {
      const px = a.x + (dx * i) / n, pz = a.z + (dz * i) / n;
      if (blocked(px, pz, cy, 0.42, 1.75)) return false;
      const g = groundAt(px, pz, cy);
      if (Math.abs(g - cy) > 0.3) return false;
      cy = g;
    }
    return Math.abs(cy - b.y) < 0.25;
  };
  for (let i = 0; i < N.length; i++) {
    const a = N[i];
    for (let j = 0; j < N.length; j++) {
      if (i === j) continue;
      const b = N[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      if (dx * dx + dz * dz > 8.5 || Math.abs(b.y - a.y) > 1.3) continue;
      if (walk(a, b)) a.nb.push({ n: j, c: Math.hypot(dx, dz, (b.y - a.y) * 1.5) });
    }
  }
  nav.built = true;
  return N.length;
}

export function nearestNode(x, y, z) {
  let best = -1, bd = Infinity;
  for (const n of nav.nodes) {
    const dy = Math.abs(n.y - y);
    if (dy > 2.2) continue;
    const d = (n.x - x) ** 2 + (n.z - z) ** 2 + dy * dy * 4;
    if (d < bd) { bd = d; best = n.id; }
  }
  return best;
}

export function findPath(from, to) {
  const N = nav.nodes;
  if (from < 0 || to < 0) return [];
  if (from === to) return [to];
  const g = new Map([[from, 0]]), prev = new Map(), closed = new Set();
  const open = [[0, from]];
  const h = (i) => Math.hypot(N[i].x - N[to].x, N[i].z - N[to].z, (N[i].y - N[to].y) * 1.5);
  const push = (it) => { open.push(it); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
  const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { let l = i * 2 + 1, r = l + 1, m = i; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return top; };
  while (open.length) {
    const [, cur] = pop();
    if (cur === to) {
      const path = [cur]; let c = cur;
      while (prev.has(c)) { c = prev.get(c); path.push(c); }
      return path.reverse();
    }
    if (closed.has(cur)) continue;
    closed.add(cur);
    for (const e of N[cur].nb) {
      const ng = g.get(cur) + e.c;
      if (ng < (g.get(e.n) ?? Infinity)) { g.set(e.n, ng); prev.set(e.n, cur); push([ng + h(e.n), e.n]); }
    }
  }
  return [];
}

// ---- spawn + pickup data ------------------------------------------------------
const RED = [[-27, -4], [-27, 0], [-27, 4], [-24.5, -2.5], [-24.5, 2.5], [-22, -4], [-22, 4], [-22, 0]];
export const SPAWNS = {
  red: RED.map(([x, z]) => ({ x, y: 4, z, yaw: -Math.PI / 2 })),
  blue: RED.map(([x, z]) => ({ x: -x, y: 4, z: -z, yaw: Math.PI / 2 })),
};

// t = respawn seconds; 0 = never comes back once taken. Listed for Blue; mirrored for Red unless single.
const half = [
  { id: 'br', x: 26, y: 4, z: 4.6, t: 25 }, { id: 'br', x: 26, y: 4, z: -4.6, t: 25 },
  { id: 'magnum', x: 25, y: 0, z: 0, t: 30 },
  { id: 'smg', x: 6, y: 4, z: 3, t: 30 },
  { id: 'shotgun', x: 8, y: 8, z: -3, t: 55 },
  { id: 'sniper', x: 25.5, y: 12, z: -18.5, t: 70 },
  { id: 'rocket', x: 19, y: 0, z: 17, t: 90 },
];
export const PICKUPS = [...half, ...half.map((p) => ({ ...p, x: -p.x, z: -p.z })),
  { id: 'sword', x: 0, y: 8, z: 0, t: 90 }, { id: 'overshield', x: 0, y: 4, z: 0, t: 120 }];

// ---- rendering -----------------------------------------------------------------
function canvasTex(size, draw, rep = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.repeat.set(rep, rep);
  return t;
}
const speck = (g, s, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * a})`; g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3); } };

function makeTextures() {
  const weather = (g, s, base, seam, tint) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s); speck(g, s, 700, 0.1);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${tint},${0.04 + Math.random() * 0.06})`; g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, 10 + Math.random() * 40, 6 + Math.random() * 22, Math.random() * 3, 0, TAUC); g.fill(); }
    g.strokeStyle = seam; g.lineWidth = 3; g.strokeRect(1.5, 1.5, s - 3, s - 3);
  };
  const deck = canvasTex(256, (g, s) => { weather(g, s, '#8f9db3', 'rgba(20,30,48,.55)', '40,50,70'); g.strokeStyle = 'rgba(20,30,48,.28)'; g.lineWidth = 2; g.strokeRect(20, 20, s - 40, s - 40); g.beginPath(); g.moveTo(s / 2, 20); g.lineTo(s / 2, s - 20); g.stroke(); });
  const wall = canvasTex(256, (g, s) => { weather(g, s, '#7d8aa0', 'rgba(15,22,38,.6)', '25,35,55'); g.fillStyle = 'rgba(0,0,0,.2)'; for (let y = 24; y < s; y += 48) g.fillRect(0, y, s, 4); g.fillStyle = 'rgba(140,210,240,.28)'; g.fillRect(s / 2 - 2, 30, 4, s - 60); });
  const tower = canvasTex(256, (g, s) => { weather(g, s, '#6c7990', 'rgba(10,16,30,.65)', '20,28,46'); g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 32; x < s; x += 64) g.fillRect(x, 0, 6, s); });
  const base = canvasTex(256, (g, s) => { weather(g, s, '#8898b0', 'rgba(14,22,40,.6)', '30,40,60'); g.fillStyle = 'rgba(14,22,40,.25)'; g.fillRect(s / 2 - 1, 0, 2, s); g.fillRect(0, s / 2 - 1, s, 2); });
  const post = canvasTex(128, (g, s) => { weather(g, s, '#98a5ba', 'rgba(14,22,40,.6)', '30,40,60'); });
  const rampT = canvasTex(256, (g, s) => {
    weather(g, s, '#9cadc4', 'rgba(14,22,40,.5)', '30,40,60'); g.fillStyle = 'rgba(30,50,70,.16)';
    for (let i = -s; i < s * 2; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 32, 0); g.lineTo(i + 32 - s, s); g.lineTo(i - s, s); g.fill(); }
  });
  return { deck, wall, tower, base, post, ramp: rampT };
}
const TAUC = Math.PI * 2;

function boxGeo(s, tile) {
  const w = s.x1 - s.x0, h = s.y1 - s.y0, d = s.z1 - s.z0;
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
  }
  return g;
}

function prismGeo(s, tile) {
  const cs = [[s.x0, s.z0], [s.x1, s.z0], [s.x1, s.z1], [s.x0, s.z1]];
  const T = cs.map(([x, z]) => [x, topAt(s, x, z), z]);
  const B = cs.map(([x, z]) => [x, s.y0, z]);
  const tris = [[T[0], T[2], T[1]], [T[0], T[3], T[2]], [B[0], B[1], B[2]], [B[0], B[2], B[3]]];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; tris.push([B[i], B[j], T[j]], [B[i], T[j], T[i]]); }
  const pos = [], uvs = [];
  for (const t of tris) for (const p of t) { pos.push(...p); uvs.push((p[0] + p[2]) / tile, p[1] / tile + (p[2] - p[0]) * 0.02); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

export async function buildWorld(scene, renderer, onProgress = () => {}) {
  const tex = makeTextures();
  await onProgress(0.1, 'Forging surfaces');
  const M = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.88, metalness: 0.04, ...o });
  const mats = {
    deck: M(tex.deck), base: M(tex.base), wall: M(tex.wall), tower: M(tex.tower), post: M(tex.post),
    ramp: M(tex.ramp, { side: THREE.DoubleSide }), rail: M(tex.wall, { color: 0xb4bfd2 }),
  };
  const world = new THREE.Group();
  scene.add(world);
  for (const s of solids) {
    const m = new THREE.Mesh(s.ramp ? prismGeo(s, 5) : boxGeo(s, 5), mats[s.mat] || mats.wall);
    if (!s.ramp) m.position.set((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, (s.z0 + s.z1) / 2);
    m.castShadow = true; m.receiveShadow = true;
    world.add(m);
  }
  await onProgress(0.3, 'Raising the outpost');

  // emissive trim
  const glow = (c, i = 2.4) => new THREE.MeshStandardMaterial({ color: 0x050505, emissive: c, emissiveIntensity: i, roughness: 0.4 });
  const cy = glow(0x7fe6ff, 2.0), red = glow(0xff3b4a, 2.8), blue = glow(0x3b7dff, 2.8), warm = glow(0xffd9a0, 2.6);
  const strip = (m, x, y, z, w, h, d) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); world.add(b); return b; };
  for (const sg of [1, -1]) {
    const tm = sg === 1 ? blue : red;
    strip(tm, sg * 28.35, 6.2, 0, 0.1, 1.6, 8);                       // base back-wall light bar
    strip(tm, sg * 28.35, 4.2, 0, 0.1, 0.12, 12.4);
    strip(tm, sg * 19.05, 5.4, 6.2, 0.1, 1.0, 0.16);                   // door frames
    strip(cy, sg * 16, 8.03, -6.45, 24, 0.04, 0.1);                    // deck edge lines
    strip(cy, sg * 16, 8.03, -4.55, 9, 0.04, 0.08);
    strip(tm, sg * 25.5, 12.03, sg * -20.9, 6.6, 0.05, 0.1);           // sniper ledge edge
    strip(cy, sg * 25.5, 8.03, sg * -7.05, 7.6, 0.04, 0.08);
  }
  strip(cy, 0, 8.03, -6.45, 24, 0.04, 0.1); strip(cy, 0, 8.03, 6.45, 24, 0.04, 0.1);
  strip(warm, 0, 7.36, 0, 5, 0.05, 3.6);                               // warm panel lighting the under-glass room
  strip(warm, -4.5, 7.36, 0, 0.1, 0.05, 6); strip(warm, 4.5, 7.36, 0, 0.1, 0.05, 6);
  // ramp side lines
  for (const s of solids) if (s.ramp && s.mat === 'ramp') {
    const rr = s.ramp, len = Math.hypot(rr.b - rr.a, rr.yb - rr.ya);
    for (const off of rr.axis === 'x' ? [s.z0, s.z1] : [s.x0, s.x1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(rr.axis === 'x' ? len : 0.1, 0.05, rr.axis === 'x' ? 0.1 : len), cy);
      const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, cyy = (rr.ya + rr.yb) / 2 + 0.03;
      const ang = Math.atan2(rr.yb - rr.ya, Math.abs(rr.b - rr.a)) * Math.sign(rr.b - rr.a);
      if (rr.axis === 'x') { b.position.set(cx, cyy, off); b.rotation.z = ang; } else { b.position.set(off, cyy, cz); b.rotation.x = -ang; }
      world.add(b);
    }
  }
  mergeStatic(world);
  await onProgress(0.5, 'Wiring the trim');

  // the glass panel in the top-mid deck + drum canopies over each sniper ledge + cables
  const glass = new THREE.Mesh(new THREE.BoxGeometry(5, 0.06, 3.6), new THREE.MeshStandardMaterial({ color: 0xa8e8ff, transparent: true, opacity: 0.5, emissive: 0x3aa8d8, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.2 }));
  glass.position.set(0, 8.04, 0); scene.add(glass);
  const drumMat = new THREE.MeshStandardMaterial({ map: tex.tower, color: 0xb9c4d6, roughness: 0.8, flatShading: true });
  for (const sg of [1, -1]) {
    const cx = sg * 25.5, cz = sg * -18.5;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.5, 3.4, 12), drumMat); drum.position.set(cx, 16.5, cz); drum.castShadow = true; scene.add(drum);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.3, 0.7, 12), drumMat); cap.position.set(cx, 18.5, cz); scene.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.07, 4, 24), sg === 1 ? blue : red); ring.rotation.x = Math.PI / 2; ring.position.set(cx, 15.2, cz); scene.add(ring);
    const pts = [new THREE.Vector3(cx, 18.6, cz), new THREE.Vector3(cx * 0.55, 13, cz * 0.4), new THREE.Vector3(sg * 4, 10.5, sg * -5)];
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.05, 4), new THREE.MeshStandardMaterial({ color: 0x1b222e, roughness: 0.6 }));
    scene.add(cable);
  }
  await onProgress(0.62, 'Hanging cables');

  // cave rock, snow mist below, pale light
  const mistCol = 0xcfdcec;
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a586e, flatShading: true, roughness: 1 });
  const rocks = new THREE.Group();
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2, r = 42 + rnd() * 50, top = rnd() < 0.4;
    const g = new THREE.IcosahedronGeometry(1, 1); const sc = 9 + rnd() * 20;
    const m = new THREE.Mesh(g, rockMat); m.scale.set(sc, sc * (0.7 + rnd() * 0.9), sc); m.rotation.y = rnd() * 3;
    m.position.set(Math.cos(a) * r * 1.15, top ? 26 + rnd() * 18 : -22 + rnd() * 46, Math.sin(a) * r);
    rocks.add(m);
  }
  for (let i = 0; i < 14; i++) { // ceiling slab so the top of the cave reads as rock
    const a = (i / 14) * Math.PI * 2, m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), rockMat);
    m.scale.set(22, 9, 22); m.position.set(Math.cos(a) * 28, 40 + rnd() * 6, Math.sin(a) * 22); rocks.add(m);
  }
  scene.add(mergeStatic(rocks));
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: mistCol, fog: false }));
  mist.position.y = -26; scene.add(mist);
  const skyGeo = new THREE.SphereGeometry(300, 16, 12);
  const col = [], pp = skyGeo.attributes.position, c = new THREE.Color();
  const top = new THREE.Color(0x56667e), mid = new THREE.Color(0xa9bbd2), low = new THREE.Color(0xe8f0fa);
  for (let i = 0; i < pp.count; i++) { const y = pp.getY(i) / 300; c.copy(y > 0 ? mid.clone().lerp(top, clamp(y * 1.6, 0, 1)) : low); col.push(c.r, c.g, c.b); }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10; scene.add(sky);
  {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(envScene, 0.03).texture;
    scene.environmentIntensity = 1.25;
    pm.dispose();
  }
  scene.fog = new THREE.Fog(mistCol, 28, 150);
  scene.background = new THREE.Color(mistCol);
  const hemi = new THREE.HemisphereLight(0xdbe8ff, 0x8a97ac, 1.2); scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xe6efff, 2.3);
  dir.position.set(-26, 60, 26); dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048);
  Object.assign(dir.shadow.camera, { left: -42, right: 42, top: 36, bottom: -36, near: 10, far: 150 });
  dir.shadow.bias = -0.0006; dir.shadow.normalBias = 0.04; scene.add(dir);
  await onProgress(0.85, 'Letting it snow');

  // snowfall: a drifting point field that follows the camera
  const N = 900, sp = new Float32Array(N * 3), sv = new Float32Array(N);
  for (let i = 0; i < N; i++) { sp[i * 3] = (Math.random() - 0.5) * 60; sp[i * 3 + 1] = Math.random() * 30; sp[i * 3 + 2] = (Math.random() - 0.5) * 60; sv[i] = 0.6 + Math.random() * 1.2; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snowPts = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.13, transparent: true, opacity: 0.85, depthWrite: false, fog: true }));
  snowPts.frustumCulled = false; scene.add(snowPts);
  const snow = {
    update(dt, cam, t) {
      const p = sg.attributes.position.array;
      for (let i = 0; i < N; i++) {
        p[i * 3] += Math.sin(t * 0.7 + i) * 0.25 * dt + 0.5 * dt; p[i * 3 + 1] -= sv[i] * dt;
        if (p[i * 3 + 1] < -2) p[i * 3 + 1] = 28;
      }
      sg.attributes.position.needsUpdate = true;
      snowPts.position.set(Math.round(cam.x / 30) * 30, cam.y - 12, Math.round(cam.z / 30) * 30);
    },
  };
  await onProgress(1, 'Ready');
  return { sky, dir, hemi, mats, glow, snow };
}
