// Environment art kit: bevelled architecture, normal-mapped panel textures, scaffolds, pylons, moss rock, foliage, vines, trees.
// Everything here is visual only; collision stays on the AABB solids in world.js.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
let _s = 7;
export const rnd = () => ((_s = (_s * 16807) % 2147483647) / 2147483647);
export const seedKit = (v) => { _s = v; };
const rr = (a, b) => a + rnd() * (b - a);

// ---------------------------------------------------------------- geometry
// world-space box projection UVs so panel textures run continuously across neighbouring solids
export function boxUV(geo, tile = 4) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// chamfered box between world bounds; hard-surface look, faceted normals
export function bevelGeo(x0, x1, y0, y1, z0, z1, r = 0.14, tile = 4, segs = 1) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
  if (r < 0.02) { const g = new THREE.BoxGeometry(w, h, d); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return boxUV(g, tile); }
  const iw = w - 2 * r, ih = h - 2 * r, c = Math.min(r * 0.9, iw / 2 - 0.001, ih / 2 - 0.001);
  const a = iw / 2, b = ih / 2, sh = new THREE.Shape();
  sh.moveTo(-a + c, -b); sh.lineTo(a - c, -b); sh.lineTo(a, -b + c); sh.lineTo(a, b - c); sh.lineTo(a - c, b); sh.lineTo(-a + c, b); sh.lineTo(-a, b - c); sh.lineTo(-a, -b + c); sh.closePath();
  const depth = Math.max(0.001, d - 2 * r);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: segs, steps: 1, curveSegments: 1 });
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2 - depth / 2);
  g.computeVertexNormals();
  return boxUV(g, tile);
}

// tapered 4/6-sided pylon, base at y0
export function pylonGeo(x, y0, z, rb, rt, h, sides = 6, tile = 4) {
  const g = new THREE.CylinderGeometry(rt, rb, h, sides, 1, false).toNonIndexed();
  g.rotateY(Math.PI / sides); g.translate(x, y0 + h / 2, z); g.computeVertexNormals();
  return boxUV(g, tile);
}

// ---------------------------------------------------------------- textures
const cv = (s, draw) => { const c = document.createElement('canvas'); c.width = c.height = s; draw(c.getContext('2d'), s); return c; };
export function tex(c, srgb = true, rep = 1) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; t.repeat.set(rep, rep); return t;
}
export function normalMap(hc, strength = 2.2) {
  const s = hc.width, src = hc.getContext('2d').getImageData(0, 0, s, s).data;
  const out = document.createElement('canvas'); out.width = out.height = s;
  const og = out.getContext('2d'), id = og.createImageData(s, s);
  const H = (x, y) => src[(((y + s) % s) * s + ((x + s) % s)) * 4] / 255;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * s + x) * 4;
    id.data[i] = (-dx / l * 0.5 + 0.5) * 255; id.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; id.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; id.data[i + 3] = 255;
  }
  og.putImageData(id, 0, 0); return tex(out, false);
}
const speck = (g, s, n, a, dark = true) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${dark && Math.random() < 0.6 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 2); } };

// concrete slab: pores, streaks, horizontal reveal grooves, optional thin vertical trim
export function concreteSet({ base = '#3a3632', groove = 'rgba(0,0,0,.55)', trim = null, streak = 'rgba(20,16,10,.22)', size = 256, cols = 2, rows = 4 } = {}) {
  const color = cv(size, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s); speck(g, s, 1400, 0.16);
    for (let i = 0; i < 26; i++) { g.fillStyle = streak; g.fillRect(Math.random() * s, 0, 1 + Math.random() * 3, s * (0.3 + Math.random() * 0.7)); }
    g.fillStyle = groove; for (let r = 1; r < rows; r++) g.fillRect(0, (r * s) / rows - 2, s, 4);
    for (let c = 0; c < cols; c++) g.fillRect((c * s) / cols - 1, 0, 3, s);
    if (trim) { g.fillStyle = trim; for (let c = 0; c < cols; c++) g.fillRect((c * s) / cols + 8, 0, 5, s); }
  });
  const height = cv(size, (g, s) => {
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, s, s); speck(g, s, 1800, 0.22, false);
    g.fillStyle = '#000'; for (let r = 1; r < rows; r++) g.fillRect(0, (r * s) / rows - 2, s, 4);
    for (let c = 0; c < cols; c++) g.fillRect((c * s) / cols - 1, 0, 3, s);
  });
  return { map: tex(color), normalMap: normalMap(height, 3.2) };
}

// armoured quilt: raised diamond pyramids with baked light/dark facets
export function quiltSet({ base = '#4a4640', cell = 48, size = 256 } = {}) {
  const col = new THREE.Color(base);
  const shade = (k) => `rgb(${Math.min(255, col.r * 255 * k) | 0},${Math.min(255, col.g * 255 * k) | 0},${Math.min(255, col.b * 255 * k) | 0})`;
  const color = cv(size, (g, s) => {
    g.fillStyle = shade(0.7); g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += cell) for (let x = 0; x < s; x += cell) {
      const cx = x + cell / 2, cy = y + cell / 2, tri = (a, b, c2, d2, e, f, k) => { g.fillStyle = shade(k); g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d2); g.lineTo(e, f); g.closePath(); g.fill(); };
      tri(x, y, x + cell, y, cx, cy, 1.25); tri(x, y, x, y + cell, cx, cy, 0.95); tri(x + cell, y, x + cell, y + cell, cx, cy, 0.62); tri(x, y + cell, x + cell, y + cell, cx, cy, 0.45);
    }
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2; for (let i = 0; i <= s; i += cell) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }
    speck(g, s, 900, 0.14);
  });
  const height = cv(size, (g, s) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += cell) for (let x = 0; x < s; x += cell) {
      const cx = x + cell / 2, cy = y + cell / 2;
      for (const [ax, ay, bx, by] of [[x, y, x + cell, y], [x + cell, y, x + cell, y + cell], [x + cell, y + cell, x, y + cell], [x, y + cell, x, y]]) {
        const gr = g.createLinearGradient((ax + bx) / 2, (ay + by) / 2, cx, cy); gr.addColorStop(0, '#000'); gr.addColorStop(1, '#fff');
        g.fillStyle = gr; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.closePath(); g.fill();
      }
    }
  });
  return { map: tex(color), normalMap: normalMap(height, 4.5) };
}

export function floorSet({ base = '#2b2a2d', line = 'rgba(0,0,0,.6)', size = 256, tiles = 2 } = {}) {
  const color = cv(size, (g, s) => { g.fillStyle = base; g.fillRect(0, 0, s, s); speck(g, s, 2200, 0.14); g.strokeStyle = line; g.lineWidth = 3; const t = s / tiles; for (let i = 0; i <= tiles; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, s); g.moveTo(0, i * t); g.lineTo(s, i * t); g.stroke(); } });
  const height = cv(size, (g, s) => { g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, s, s); speck(g, s, 2600, 0.2, false); g.fillStyle = '#000'; const t = s / tiles; for (let i = 0; i < tiles; i++) { g.fillRect(i * t - 1, 0, 3, s); g.fillRect(0, i * t - 1, s, 3); } });
  return { map: tex(color), normalMap: normalMap(height, 2.6) };
}

export function steelSet({ base = '#d6a020', size = 128 } = {}) {
  const color = cv(size, (g, s) => { g.fillStyle = base; g.fillRect(0, 0, s, s); speck(g, s, 600, 0.22); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, s, 3); g.fillRect(0, s - 3, s, 3); for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(70,40,0,.28)'; g.fillRect(Math.random() * s, Math.random() * s, 2, 10 + Math.random() * 30); } });
  return { map: tex(color) };
}

// foliage cards -------------------------------------------------------------
const cvA = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
export function grassCard(colors = ['#8a9a3a', '#b3b04a', '#6f8a30']) {
  return tex(cvA(64, 128, (g, w, h) => {
    for (let i = 0; i < 12; i++) {
      const x0 = 6 + Math.random() * (w - 12), lean = (Math.random() - 0.5) * 30, top = 10 + Math.random() * 50;
      g.strokeStyle = colors[i % colors.length]; g.lineWidth = 2.2 + Math.random() * 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, h); g.quadraticCurveTo(x0 + lean * 0.3, h * 0.55, x0 + lean, top); g.stroke();
    }
  }));
}
export function frondCard(colors = ['#2e6a3a', '#3f8a44', '#245a34']) {
  return tex(cvA(64, 128, (g, w, h) => {
    g.strokeStyle = colors[2]; g.lineWidth = 2.4; g.beginPath(); g.moveTo(w / 2, h); g.quadraticCurveTo(w / 2 + 8, h * 0.5, w / 2 + 4, 6); g.stroke();
    for (let i = 0; i < 12; i++) { const y = h - 10 - i * 9, len = 26 - i * 1.6; for (const sd of [-1, 1]) { g.fillStyle = colors[(i + (sd > 0 ? 1 : 0)) % 2]; g.beginPath(); g.ellipse(w / 2 + sd * len * 0.5 + 4, y - 3, len * 0.5, 3.4, sd * -0.5, 0, TAU); g.fill(); } }
  }));
}
export function vineCard(colors = ['#3f7a3a', '#5f9a44', '#2f5a2c']) {
  return tex(cvA(48, 160, (g, w, h) => {
    g.strokeStyle = '#3a4a24'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, 0); g.bezierCurveTo(w / 2 - 6, h * 0.3, w / 2 + 6, h * 0.6, w / 2, h); g.stroke();
    for (let i = 0; i < 16; i++) { const y = 6 + i * 9.5, sd = i % 2 ? 1 : -1; g.fillStyle = colors[i % 3]; g.beginPath(); g.ellipse(w / 2 + sd * 9, y, 10, 5, sd * 0.6, 0, TAU); g.fill(); }
  }));
}
export function barkSet({ base = '#3c3226', ivy = ['#3f7a3a', '#5f9a44'], size = 256 } = {}) {
  const color = cv(size, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 5 + Math.random() * 6) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '120,100,70'},${0.12 + Math.random() * 0.2})`; g.fillRect(x, 0, 2 + Math.random() * 4, s); }
    for (let i = 0; i < 90; i++) { g.fillStyle = ivy[i % 2]; g.globalAlpha = 0.55 + Math.random() * 0.4; g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, 5 + Math.random() * 8, 3 + Math.random() * 5, Math.random() * 3, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
  });
  const height = cv(size, (g, s) => { g.fillStyle = '#777'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += 6 + Math.random() * 8) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},.45)`; g.fillRect(x, 0, 2 + Math.random() * 5, s); } });
  return { map: tex(color), normalMap: normalMap(height, 3) };
}

// ---------------------------------------------------------------- foliage
export const wind = { value: 0 };
function swayMat(map, { color = 0xffffff, sway = 0.08, alphaTest = 0.4 } = {}) {
  const m = new THREE.MeshLambertMaterial({ map, color, alphaTest, side: THREE.DoubleSide, emissive: 0x1c2812 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
      #else
        vec3 ip = vec3(0.0);
      #endif
      float sw = sin(uTime * 1.7 + ip.x * 0.7 + ip.z * 0.55 + position.x * 2.0) * ${sway.toFixed(3)} * max(0.0, position.y);
      transformed.x += sw; transformed.z += sw * 0.6;`);
  };
  m.customProgramCacheKey = () => 'sway' + sway;
  return m;
}
const crossGeo = (w = 1, h = 1) => {
  const a = new THREE.PlaneGeometry(w, h); a.translate(0, h / 2, 0);
  const b = a.clone(); b.rotateY(Math.PI / 2);
  const c = a.clone(); c.rotateY(Math.PI / 4);
  return mergeGeometries([a, b, c]);
};
// pts: [{x,y,z,s}]  returns InstancedMesh
export function tufts(root, pts, card, { w = 0.9, h = 0.9, color = 0xffffff, tint = null, sway = 0.09, alphaTest = 0.4 } = {}) {
  if (!pts.length) return null;
  const im = new THREE.InstancedMesh(crossGeo(w, h), swayMat(card, { color, sway, alphaTest }), pts.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  pts.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * TAU); const s = (p.s || 1) * rr(0.7, 1.35);
    m.compose(new THREE.Vector3(p.x, p.y - 0.02, p.z), q, new THREE.Vector3(s, s * rr(0.8, 1.25), s)); im.setMatrixAt(i, m);
    if (tint) { c.set(tint[i % tint.length]).offsetHSL(rr(-0.03, 0.03), 0, rr(-0.08, 0.08)); im.setColorAt(i, c); }
  });
  im.frustumCulled = false; root.add(im); return im;
}
// hanging vine ribbons. anchors: [{x,y,z,len,rot}]
export function vines(root, anchors, card, { w = 0.55, sway = 0.12 } = {}) {
  if (!anchors.length) return null;
  const geos = anchors.map((a) => {
    const g = new THREE.PlaneGeometry(w, a.len, 1, 6); g.translate(0, -a.len / 2, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = -p.getY(i) / a.len; p.setZ(i, Math.sin(k * 3 + a.x) * 0.12 * k); }
    g.rotateY(a.rot ?? rnd() * Math.PI); g.translate(a.x, a.y, a.z); return g;
  });
  const m = swayMat(card, { sway });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind;
    sh.vertexShader = 'uniform float uTime;\nvarying float vK;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float hang = max(0.0, -(position.y - ${0}.0));
      transformed.x += sin(uTime * 1.3 + position.x * 0.8 + position.y * 0.4) * ${sway.toFixed(3)} * 0.35;
      transformed.z += cos(uTime * 1.1 + position.z * 0.8 + position.y * 0.35) * ${sway.toFixed(3)} * 0.35;`);
  };
  const mesh = new THREE.Mesh(mergeGeometries(geos), m); mesh.frustumCulled = false; mesh.userData.keep = true; root.add(mesh); return mesh;
}

// ---------------------------------------------------------------- structure dressing
// yellow gantry frame: 4 posts, rails every 2.4m, X braces on every face
export function scaffold(x, y, z, w, h, d, t = 0.14) {
  const parts = [], B = (sx, sy, sz, px, py, pz, rot) => { const g = new THREE.BoxGeometry(sx, sy, sz); if (rot) g.rotateZ(rot[0]), g.rotateX(rot[1] || 0); g.translate(px, py, pz); parts.push(g); };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(t, h, t, x + (sx * w) / 2, y + h / 2, z + (sz * d) / 2);
  const levels = Math.max(1, Math.round(h / 2.4));
  for (let i = 0; i <= levels; i++) {
    const py = y + (h * i) / levels;
    B(w, t * 0.8, t * 0.8, x, py, z - d / 2); B(w, t * 0.8, t * 0.8, x, py, z + d / 2); B(t * 0.8, t * 0.8, d, x - w / 2, py, z); B(t * 0.8, t * 0.8, d, x + w / 2, py, z);
    if (i < levels) {
      const sh = h / levels, ang = Math.atan2(sh, w), len = Math.hypot(sh, w);
      for (const sz of [-1, 1]) { const g = new THREE.BoxGeometry(len, t * 0.6, t * 0.6); g.rotateZ(ang * (i % 2 ? 1 : -1)); g.translate(x, py + sh / 2, z + (sz * d) / 2); parts.push(g); }
    }
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}
// flat-shaded lump of rock with moss on top (vertex colors), for organic massing over hard architecture
export function mossRock(x, y, z, sx, sy, sz, { rock = '#6f5a46', moss = ['#8c9230', '#a7a541'], detail = 3 } = {}) {
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, col = new Float32Array(p.count * 3);
  const ph = [rnd() * 9, rnd() * 9, rnd() * 9];
  const nz = (a, b, c) => Math.sin(a * 1.7 + ph[0]) * Math.cos(b * 1.3 + ph[1]) + Math.sin(c * 2.1 + ph[2] + a) * 0.5;
  const v = new THREE.Vector3(), c1 = new THREE.Color(rock), c2 = new THREE.Color(moss[0]), c3 = new THREE.Color(moss[1]), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const k = 1 + nz(v.x, v.y, v.z) * 0.16 + Math.sin(v.x * 5 + v.z * 4) * 0.05; v.multiplyScalar(k); p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  g.computeVertexNormals(); const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { const up = n.getY(i), m = THREE.MathUtils.smoothstep(up, 0.25, 0.6); t.copy(c1).lerp(c2, m); if (m > 0.6) t.lerp(c3, (Math.sin(p.getX(i) * 3 + p.getZ(i) * 2) + 1) * 0.25); col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.translate(x, y, z);
  return g;
}
// buttressed tree trunk with root flare; returns geometry (bark UVs), base at y
export function trunkGeo(x, y, z, h, r0 = 0.8) {
  const g = new THREE.CylinderGeometry(r0 * 0.62, r0, h, 12, 10, true), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const t = (v.y + h / 2) / h, a = Math.atan2(v.z, v.x);
    const flute = 1 + Math.sin(a * 5 + t * 2) * 0.16 * (1 - t) + Math.exp(-t * 7) * 0.9 + Math.sin(a * 3 + t * 6) * 0.05;
    p.setXYZ(i, v.x * flute + Math.sin(t * 3 + x) * 0.15 * t, v.y, v.z * flute);
  }
  g.computeVertexNormals(); g.translate(x, y + h / 2, z);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 3);
  return g;
}
// leaf clump cards for canopy / bushes: instanced later by caller via tufts()

export function glowSprite(map, color, size, x, y, z, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.setScalar(size); s.position.set(x, y, z); return s;
}
