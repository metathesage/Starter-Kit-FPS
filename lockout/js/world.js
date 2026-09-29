// Map data, collision, raycasts, nav graph and meshes.
// Layout is symmetric under a 180 degree turn about the origin: Red holds -X, Blue holds +X.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';

export const STEP = 0.42;
export const solids = [];
export const BOUNDS = { x: 32.5, z: 19.5 };

const add = (o) => { solids.push(o); return o; };
const box = (x0, x1, z0, z1, y0, y1, mat = 'wall', extra = {}) => add({ x0, x1, z0, z1, y0, y1, ramp: null, mat, ...extra });
const ramp = (x0, x1, z0, z1, y0, axis, a, b, ya, yb, extra = {}) =>
  add({ x0, x1, z0, z1, y0, y1: Math.max(ya, yb), ramp: { axis, a, b, ya, yb }, mat: 'ramp', ...extra });
const pBox = (x0, x1, z0, z1, y0, y1, mat, extra = {}) => {
  box(x0, x1, z0, z1, y0, y1, mat, { side: 1, ...extra });
  box(-x1, -x0, -z1, -z0, y0, y1, mat, { side: -1, ...extra });
};
const pRamp = (x0, x1, z0, z1, y0, axis, a, b, ya, yb) => {
  ramp(x0, x1, z0, z1, y0, axis, a, b, ya, yb, { side: 1 });
  ramp(-x1, -x0, -z1, -z0, y0, axis, -a, -b, ya, yb, { side: -1 });
};

// ---- level -----------------------------------------------------------------
// perimeter (collision only extends high; visual walls built separately)
box(-36, 36, 19.5, 24, 0, 30, 'rim');
box(-36, 36, -24, -19.5, 0, 30, 'rim');
box(32.5, 37, -24, 24, 0, 30, 'rim');
box(-37, -32.5, -24, 24, 0, 30, 'rim');
// bases (top y=5) with front ramps that come down toward the middle
pBox(20, 32.5, -14, 14, 0, 5, 'base');
pRamp(8, 20, 4, 9, 0, 'x', 8, 20, 0, 5);
// bridges between bases at catwalk height, with support columns
pBox(-21, 21, 10.5, 13.5, 4.6, 5, 'catwalk');
pBox(9.3, 10.7, 11.3, 12.7, 0, 4.6, 'column');
pBox(-10.7, -9.3, 11.3, 12.7, 0, 4.6, 'column');
// center tower (top y=3) with ramps from the ground and down from the catwalks
box(-5, 5, -5, 5, 0, 3, 'tower', { side: 1 });
pRamp(5, 12, -3, 3, 0, 'x', 12, 5, 0, 3);
pRamp(-2, 2, 5, 10.5, 0, 'z', 5, 10.5, 3, 5);
// tower-top cover
pBox(3, 4.2, 3, 4.2, 3, 4.7, 'column');
pBox(-4.2, -3, 3, 4.2, 3, 4.7, 'column');
// ground cover
pBox(12.8, 15.2, -9.2, -6.8, 0, 1.0, 'crate');
pBox(-15.2, -12.8, -9.2, -6.8, 0, 1.0, 'crate');
pBox(20.5, 22.5, -19.5, -16, 0, 2.6, 'wall');
// base-top cover
pBox(25, 27, -9, -6, 5, 6.2, 'crate');
pBox(25, 27, 6, 9, 5, 6.2, 'crate');
pBox(28, 29.5, -0.75, 0.75, 5, 8, 'column');

// ---- collision --------------------------------------------------------------
export function topAt(s, x, z) {
  const r = s.ramp;
  if (!r) return s.y1;
  const c = r.axis === 'x' ? x : z;
  return r.ya + (r.yb - r.ya) * clamp((c - r.a) / (r.b - r.a), 0, 1);
}

export function groundAt(x, z, refY) {
  let best = 0;
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
    if (s.y0 >= yFrom - 0.02 && s.y0 <= yTo && s.y0 > 0.01 && s.y0 < best) best = s.y0;
  }
  return best;
}

export function pointSolid(x, y, z) {
  if (y < 0) return true;
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
    for (let z = -18; z <= 18; z += G) {
      const ys = new Set([0]);
      for (const s of solids) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) ys.add(Math.round(topAt(s, x, z) * 100) / 100);
      for (const y of ys) {
        if (y > 12) continue;
        if (blocked(x, z, y, 0.5, 1.75)) continue;
        if (Math.abs(groundAt(x, z, y) - y) > 0.06) continue;
        // headroom
        let head = false;
        for (const s of solids) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && s.y0 > y - 0.01 && s.y0 < y + 1.8 && s.y0 > 0.01) head = true;
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
const RED = [[-29, -10], [-29, 10], [-26, -3.5], [-26, 3.5], [-30.8, 0], [-24, -12], [-24, 12], [-22.5, 0]];
export const SPAWNS = {
  red: RED.map(([x, z]) => ({ x, y: 5, z, yaw: -Math.PI / 2 })),
  blue: RED.map(([x, z]) => ({ x: -x, y: 5, z: -z, yaw: Math.PI / 2 })),
};

// respawn seconds; 0 = never comes back once taken
export const PICKUPS = [
  { id: 'br', x: -23, y: 5, z: -11, t: 25 }, { id: 'br', x: 23, y: 5, z: 11, t: 25 },
  { id: 'br', x: -23, y: 5, z: 11, t: 25 }, { id: 'br', x: 23, y: 5, z: -11, t: 25 },
  { id: 'magnum', x: -24.5, y: 5, z: 0, t: 30 }, { id: 'magnum', x: 24.5, y: 5, z: 0, t: 30 },
  { id: 'smg', x: 16, y: 0, z: -2, t: 30 }, { id: 'smg', x: -16, y: 0, z: 2, t: 30 },
  { id: 'shotgun', x: 6, y: 0, z: 12, t: 55 }, { id: 'shotgun', x: -6, y: 0, z: -12, t: 55 },
  { id: 'sniper', x: 0, y: 3, z: 0, t: 70 },
  { id: 'rocket', x: 10, y: 5, z: 12, t: 90 }, { id: 'rocket', x: -10, y: 5, z: -12, t: 90 },
  { id: 'sword', x: 0, y: 0, z: 16.5, t: 90 },
  { id: 'overshield', x: 0, y: 0, z: -16.5, t: 120 },
];

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
  const floor = canvasTex(256, (g, s) => {
    g.fillStyle = '#6a7d92'; g.fillRect(0, 0, s, s); speck(g, s, 400, 0.08);
    g.strokeStyle = 'rgba(10,20,30,.55)'; g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, s - 3, s - 3);
    g.strokeStyle = 'rgba(160,215,235,.18)'; g.lineWidth = 1;
    g.strokeRect(14, 14, s - 28, s - 28);
    g.beginPath(); g.moveTo(s / 2, 14); g.lineTo(s / 2, s - 14); g.moveTo(14, s / 2); g.lineTo(s - 14, s / 2); g.stroke();
  });
  const wall = canvasTex(256, (g, s) => {
    g.fillStyle = '#a3b0c0'; g.fillRect(0, 0, s, s); speck(g, s, 300, 0.07);
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, 0, 6, s); g.fillRect(s - 6, 0, 6, s);
    g.strokeStyle = 'rgba(20,30,45,.5)'; g.lineWidth = 2; g.strokeRect(20, 20, s - 40, s - 40);
    g.fillStyle = 'rgba(120,230,255,.5)'; g.fillRect(s / 2 - 2, 34, 4, s - 68);
  });
  const rampT = canvasTex(256, (g, s) => {
    g.fillStyle = '#9db0c2'; g.fillRect(0, 0, s, s); speck(g, s, 300, 0.06);
    g.fillStyle = 'rgba(30,50,70,.16)';
    for (let i = -s; i < s * 2; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 32, 0); g.lineTo(i + 32 - s, s); g.lineTo(i - s, s); g.fill(); }
  });
  const base = canvasTex(256, (g, s) => {
    g.fillStyle = '#8496ab'; g.fillRect(0, 0, s, s); speck(g, s, 350, 0.09);
    g.strokeStyle = 'rgba(8,16,26,.6)'; g.lineWidth = 4; g.strokeRect(2, 2, s - 4, s - 4);
    g.fillStyle = 'rgba(8,16,26,.3)'; g.fillRect(s / 2 - 1, 0, 2, s);
  });
  const dark = canvasTex(128, (g, s) => { g.fillStyle = '#4a586a'; g.fillRect(0, 0, s, s); speck(g, s, 120, 0.1); g.strokeStyle = 'rgba(255,255,255,.08)'; g.strokeRect(2, 2, s - 4, s - 4); });
  return { floor, wall, ramp: rampT, base, dark };
}

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
  const M = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.8, metalness: 0.06, ...o });
  const mats = {
    floor: M(tex.floor), wall: M(tex.wall), rim: M(tex.wall, { color: 0xb8c4d2 }),
    ramp: M(tex.ramp, { side: THREE.DoubleSide }), base: M(tex.base), catwalk: M(tex.base, { color: 0xc8d6e6, roughness: 0.6, metalness: 0.2 }),
    column: M(tex.wall, { color: 0xc9d3de }), crate: M(tex.wall, { color: 0xe6c9a0, roughness: 0.75, metalness: 0.05 }), tower: M(tex.base, { color: 0xd2dceb }),
  };

  // ground
  const gg = new THREE.PlaneGeometry(140, 100);
  gg.rotateX(-Math.PI / 2);
  const gu = gg.attributes.uv;
  for (let i = 0; i < gu.count; i++) gu.setXY(i, gu.getX(i) * 140 / 5, gu.getY(i) * 100 / 5);
  const ground = new THREE.Mesh(gg, mats.floor);
  ground.receiveShadow = true;
  scene.add(ground);

  const world = new THREE.Group();
  scene.add(world);
  for (const s of solids) {
    if (s.mat === 'rim') continue;
    const m = new THREE.Mesh(s.ramp ? prismGeo(s, 5) : boxGeo(s, 5), mats[s.mat] || mats.wall);
    if (!s.ramp) m.position.set((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, (s.z0 + s.z1) / 2);
    m.castShadow = true; m.receiveShadow = true;
    world.add(m);
  }
  await onProgress(0.3, 'Raising the walls');

  // perimeter cliffs
  const cliff = (x0, x1, z0, z1, h) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), mats.rim);
    m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); m.receiveShadow = true; m.castShadow = true; world.add(m);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.02, 0.16, z1 - z0 + 0.02), new THREE.MeshStandardMaterial({ color: 0x0, emissive: 0x6be7ff, emissiveIntensity: 2.2 }));
    rim.position.set((x0 + x1) / 2, h + 0.08, (z0 + z1) / 2); world.add(rim);
  };
  cliff(-36, 36, 19.5, 21.5, 11); cliff(-36, 36, -21.5, -19.5, 11);
  cliff(32.5, 34.5, -21.5, 21.5, 15); cliff(-34.5, -32.5, -21.5, 21.5, 15);

  // emissive trim
  const glow = (c, i = 2.4) => new THREE.MeshStandardMaterial({ color: 0x050505, emissive: c, emissiveIntensity: i, roughness: 0.4 });
  const cy = glow(0x62e4ff), red = glow(0xff3b4a, 2.8), blue = glow(0x3b7dff, 2.8), gold = glow(0xffd48a, 2);
  const strip = (m, x, y, z, w, h, d) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); world.add(b); return b; };
  for (const sz of [1, -1]) {
    strip(cy, 0, 5.03, sz * 10.55, 42, 0.05, 0.1); strip(cy, 0, 5.03, sz * 13.45, 42, 0.05, 0.1);
    strip(cy, 0, 4.58, sz * 12, 42, 0.05, 0.5);
    // base front bars in team color
    const m = sz === 1 ? blue : red;
    strip(m, sz * 20.03, 2.6, 11.5, 0.06, 4.2, 0.35); strip(m, sz * 20.03, 2.6, -11.5, 0.06, 4.2, 0.35);
    strip(m, sz * 20.03, 2.6, 0, 0.06, 4.2, 0.35);
    strip(m, sz * 32.4, 6.6, 0, 0.2, 3.4, 8);
    strip(m, sz * 32.4, 8.7, 0, 0.2, 0.2, 26);
    // tower crown
    strip(gold, 0, 3.03, sz * 5.03, 10, 0.05, 0.08);
    strip(cy, sz * 5.03, 1.6, 0, 0.06, 2.2, 0.3);
  }
  // ramp side rails
  for (const s of solids) if (s.ramp && s.mat === 'ramp') {
    const rr = s.ramp; const len = Math.hypot(rr.b - rr.a, rr.yb - rr.ya);
    for (const off of [s.ramp.axis === 'x' ? [s.z0, s.z1] : [s.x0, s.x1]].flat()) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(rr.axis === 'x' ? len : 0.12, 0.05, rr.axis === 'x' ? 0.12 : len), cy);
      const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, cyy = (rr.ya + rr.yb) / 2 + 0.03;
      const ang = Math.atan2(rr.yb - rr.ya, Math.abs(rr.b - rr.a)) * Math.sign(rr.b - rr.a);
      if (rr.axis === 'x') { b.position.set(cx, cyy, off); b.rotation.z = ang; b.scale.x = 1; }
      else { b.position.set(off, cyy, cz); b.rotation.x = -ang; }
      world.add(b);
    }
  }
  await onProgress(0.5, 'Wiring the trim');

  // sky ---------------------------------------------------------------
  const skyGeo = new THREE.SphereGeometry(400, 24, 16);
  const col = [], p = skyGeo.attributes.position;
  const top = new THREE.Color(0x0b1637), mid = new THREE.Color(0x2c7f9e), low = new THREE.Color(0xffc48c), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 400;
    if (y > 0.25) c.copy(mid).lerp(top, clamp((y - 0.25) / 0.7, 0, 1));
    else c.copy(low).lerp(mid, clamp((y + 0.05) / 0.3, 0, 1));
    col.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  scene.add(sky);
  // ring arc
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xcfe8ff, fog: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(330, 6, 4, 72, Math.PI * 1.15), ringMat);
  ring.rotation.set(0.3, 0.5, 0.9); ring.position.set(0, -60, -40);
  scene.add(ring);
  const band = new THREE.Mesh(new THREE.TorusGeometry(330, 1.6, 3, 72, Math.PI * 1.15), new THREE.MeshBasicMaterial({ color: 0x6be7ff, fog: false }));
  band.rotation.copy(ring.rotation); band.position.copy(ring.position); band.scale.set(1.005, 1.005, 1.7); band.position.y -= 0.5;
  scene.add(band);
  // sun
  const sun = new THREE.Mesh(new THREE.SphereGeometry(16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c8, fog: false }));
  sun.position.set(-260, 90, -230); scene.add(sun);
  // mountains
  const mMat = new THREE.MeshStandardMaterial({ color: 0x33506a, flatShading: true, roughness: 1 });
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2, r = 110 + rnd() * 130, h = 25 + rnd() * 70;
    const m = new THREE.Mesh(new THREE.ConeGeometry(18 + rnd() * 30, h, 5 + ((rnd() * 2) | 0)), mMat);
    m.position.set(Math.cos(a) * r, h / 2 - 6, Math.sin(a) * r); m.rotation.y = rnd() * 3;
    scene.add(m);
  }
  // distant monoliths
  const monoMat = new THREE.MeshStandardMaterial({ color: 0x9fb1c4, roughness: 0.6, metalness: 0.3, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3, r = 70 + rnd() * 20, h = 30 + rnd() * 30;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 3.5, h, 4), monoMat);
    m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); m.rotation.y = a;
    scene.add(m);
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), glow(0x62e4ff, 2.6));
    orb.position.set(m.position.x, h + 4, m.position.z); scene.add(orb);
  }
  await onProgress(0.75, 'Painting the sky');

  // image-based light from the sky itself: fills shadows and gives metals something to reflect
  {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const warm = new THREE.Mesh(new THREE.SphereGeometry(60, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9c0 }));
    warm.position.set(-260, 160, -230); warm.scale.setScalar(3); envScene.add(warm);
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5b6b7c }));
    gr.position.y = -3; envScene.add(gr);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(envScene, 0.02).texture;
    scene.environmentIntensity = 1.5;
    pm.dispose();
  }
  scene.fog = new THREE.Fog(0x8fb8c8, 70, 280);
  scene.background = new THREE.Color(0x2c7f9e);
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6a5e50, 1.5);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffe2b8, 2.6);
  dir.position.set(-40, 55, -30);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  Object.assign(dir.shadow.camera, { left: -48, right: 48, top: 34, bottom: -34, near: 10, far: 150 });
  dir.shadow.bias = -0.0006; dir.shadow.normalBias = 0.04;
  scene.add(dir);
  await onProgress(1, 'Ready');
  return { sky, ring, dir, hemi, mats, glow };
}
