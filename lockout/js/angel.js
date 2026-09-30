// Scanned "angel" operator: a SAM 3D mesh skinned at load time and driven by the procedural rig's joint values.
// The classic procedural body stays as the animation driver (and IK solver); this mesh replaces its visible parts.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js';
import { toonGradient, outlineSkinned } from './toon.js';
import { loadRigged, attachClipped, syncClipped } from './clipped.js';

// Skinned operators. Every model is a static mesh normalised to height 1 (y -0.5..0.5, character-left = +x, front = +z).
// Landmarks below place the joints; weights come from distance to bone segments at load time. The procedural rig drives the motion.
const J_ANGEL = {
  hips: [0, 0.02], spine: [0, 0.09], chest: [0, 0.19], head: [0, 0.31],
  sh: [0.093, 0.265], el: [0.163, 0.15], wr: [0.2, 0.04], hand: [0.212, 0.0],
  hip: [0.066, 0.0], kn: [0.07, -0.21], an: [0.075, -0.44], toe: [0.075, -0.5],
  tail0: [0.128, 0.44], tail1: [0.22, 0.22], tail2: [0.268, 0.0],
  wing: [0.1, 0.285], wingTip: [0.29, 0.33],
};
export const OPERATOR_MODELS = {
  angel: { url: 'models/operator/angel.glb', J: J_ANGEL, S: 1.78, tails: true, wings: true, recolor: true, shScale: 1.14, glow: 0.42 },
  mualani: { url: 'models/operator/mualani.glb', S: 1.74, shScale: 1.0, glow: 0.36,
    J: { hips: [0, 0.0], spine: [0, 0.09], chest: [0, 0.2], head: [0, 0.31], sh: [0.075, 0.27], el: [0.17, 0.15], wr: [0.245, 0.06], hand: [0.28, 0.03], hip: [0.055, -0.02], kn: [0.065, -0.22], an: [0.05, -0.44], toe: [0.05, -0.5] } },
  lucy: { url: 'models/operator/lucy.glb', S: 1.74, shScale: 1.0, glow: 0.22,
    J: { hips: [0, 0.03], spine: [0, 0.12], chest: [0, 0.22], head: [0, 0.335], sh: [0.09, 0.285], el: [0.1, 0.15], wr: [0.09, 0.02], hand: [0.085, -0.02], hip: [0.045, 0.0], kn: [0.05, -0.24], an: [0.05, -0.45], toe: [0.05, -0.5] } },
  // authored, rigged and animated (real clips). S = height in rig units; gun* place the weapon in the right hand
  loba: { url: 'models/operator/loba.glb', rigged: true, S: 1.74, glow: 0.3, gunPos: [0, 0, 0], gunRot: [0, 0, 0] },
  revenant: { url: 'models/operator/revenant.glb', rigged: true, S: 1.86, glow: 0.3, gunPos: [0, 0, 0], gunRot: [0, 0, 0] },
  wraith: { url: 'models/operator/wraith.glb', rigged: true, S: 1.7, glow: 0.3, gunPos: [0, 0, 0], gunRot: [0, 0, 0] },
  kagome: { url: 'models/operator/kagome.glb', S: 1.76, shScale: 1.0, glow: 0.34,
    J: { hips: [0, -0.02], spine: [0, 0.07], chest: [0, 0.2], head: [0, 0.33], sh: [0.08, 0.29], el: [0.24, 0.29], wr: [0.34, 0.29], hand: [0.4, 0.29], hip: [0.045, -0.03], kn: [0.05, -0.24], an: [0.05, -0.46], toe: [0.05, -0.5] } },
};

// Bone table: name, parent, joint, and the skin segments that belong to it (a->b, radius scale)
const seg = (a, b, r = 1) => ({ a, b, r });
const mir = (p) => [-p[0], p[1]];
function table(J, cfg) {
  const B = [];
  const add = (name, parent, joint, segs) => B.push({ name, parent, joint, segs });
  add('hips', null, J.hips, [seg([0, -0.005], [0, 0.06], 1.6)]);
  add('spine', 'hips', J.spine, [seg([0, 0.06], [0, 0.17], 1.3)]);
  add('chest', 'spine', J.chest, [seg([0, 0.17], [0, 0.29], 1.4)]);
  add('head', 'chest', J.head, [seg([0, 0.3], [0, 0.5], 1.6)]);
  for (const s of [1, -1]) {
    const m = (p) => (s > 0 ? p : mir(p)), n = s > 0 ? 'L' : 'R';
    add('sh' + n, 'chest', m(J.sh), [seg(m(J.sh), m(J.el), 0.9)]);
    add('el' + n, 'sh' + n, m(J.el), [seg(m(J.el), m(J.wr), 0.9), seg(m(J.wr), m(J.hand), 0.9)]);
    add('th' + n, 'hips', m(J.hip), [seg(m(J.hip), m(J.kn), 1.1)]);
    add('sk' + n, 'th' + n, m(J.kn), [seg(m(J.kn), m(J.an), 1), seg(m(J.an), m(J.toe), 1)]);
    if (cfg.tails) { add('ta' + n, 'head', m(J.tail0), [seg(m(J.tail0), m(J.tail1), 1.3)]); add('tb' + n, 'ta' + n, m(J.tail1), [seg(m(J.tail1), m(J.tail2), 1.3)]); }
    if (cfg.wings) add('wg' + n, 'chest', m(J.wing), [seg(m(J.wing), m(J.wingTip), 1.6)]);
  }
  return B;
}

const ptSeg = (px, py, pz, a, b) => {
  const abx = b[0] - a[0], aby = b[1] - a[1], apx = px - a[0], apy = py - a[1];
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / (abx * abx + aby * aby || 1)));
  const dx = px - (a[0] + abx * t), dy = py - (a[1] + aby * t);
  return Math.sqrt(dx * dx + dy * dy + pz * pz * 0.25);   // depth counts half: front/back of a limb belong to it
};

const caches = {};   // model id -> { geo, mats (source), bones (table), cfg, img, tex }
export const angelReady = (id = 'angel') => !!caches[id];
export const operatorReady = angelReady;

async function fetchGltf(loader, url) {
  try { return await loader.loadAsync(url); }
  catch (e) {
    // hosts that only serve text/media types (e.g. the artifact preview): fall back to a base64 copy
    const r = await fetch(url.replace(/\.glb$/, '.b64.txt')); if (!r.ok) throw e;
    const bin = atob((await r.text()).trim()), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return new Promise((res, rej) => loader.parse(buf.buffer, '', res, rej));
  }
}

export async function loadOperator(id = 'angel') {
  if (caches[id]) return caches[id];
  if (OPERATOR_MODELS[id] && OPERATOR_MODELS[id].rigged) return (caches[id] = await loadRigged(id, OPERATOR_MODELS[id], fetchGltf));
  const cfg = OPERATOR_MODELS[id], BONES = table(cfg.J, cfg), S = cfg.S, loader = new GLTFLoader();
  const g = await fetchGltf(loader, cfg.url);
  const meshes = []; g.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const geos = [], mats = [], tmp = new Float32Array(BONES.length);
  for (const mesh of meshes) {
    const src = mesh.geometry, P = src.attributes.position, n = P.count, geo = new THREE.BufferGeometry();
    // bake: flip to rig frame (front = -z, character-left = -x), scale, feet on the ground
    const pos = new Float32Array(n * 3), idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      pos[i * 3] = -x * S; pos[i * 3 + 1] = (y + 0.5) * S; pos[i * 3 + 2] = -z * S;
      for (let b = 0; b < BONES.length; b++) {
        let best = 9;
        for (const sg of BONES[b].segs) { const d = ptSeg(x, y, z, sg.a, sg.b) / sg.r; if (d < best) best = d; }
        tmp[b] = 1 / Math.pow(best * best + 0.0006, 2);
      }
      let top = []; for (let b = 0; b < BONES.length; b++) top.push(b);
      top.sort((a, b) => tmp[b] - tmp[a]); top = top.slice(0, 4);
      let sum = 0; for (const b of top) sum += tmp[b];
      for (let k = 0; k < 4; k++) { idx[i * 4 + k] = top[k]; wt[i * 4 + k] = tmp[top[k]] / sum; }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', src.attributes.uv || new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (src.attributes.normal) { const nm = src.attributes.normal.clone(); for (let i = 0; i < nm.count; i++) nm.setXYZ(i, -nm.getX(i), nm.getY(i), -nm.getZ(i)); geo.setAttribute('normal', nm); }
    else geo.computeVertexNormals();
    geo.setIndex(src.index ? new THREE.BufferAttribute(new Uint32Array(src.index.array), 1) : null);
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(wt, 4));
    geos.push(geo); mats.push(mesh.material);
  }
  const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos.map((q) => q.index ? q : q), true);
  geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.6; geo.userData.shared = true;
  caches[id] = { id, cfg, geo, srcMats: mats, bones: BONES, img: mats[0] && mats[0].map ? mats[0].map.image : null, tex: new Map() };
  return caches[id];
}
export const loadAngel = () => loadOperator('angel');

// ---- per-hair-colour texture (angel only: recolours the pink hair, keeps armour/skin) ----
function hairTexture(cache, hex) {
  const key = hex >>> 0;
  if (cache.tex.has(key)) return cache.tex.get(key);
  const img = cache.img, W = img.width, H = img.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, W, H), d = id.data;
  const hc = new THREE.Color(hex), hr = hc.r * 255, hg = hc.g * 255, hb = hc.b * 255;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 0 ? (mx - mn) / mx : 0;
    if (sat < 0.07 || mx < 0.22) continue;
    let h = 0; if (mx > mn) { if (mx === r) h = ((g - b) / (mx - mn) + 6) % 6; else if (mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4; h *= 60; }
    if (!(h >= 290 || h < 10)) continue;
    const a = Math.min(1, (sat - 0.07) / 0.14), lum = (0.3 * r + 0.55 * g + 0.15 * b) / 0.62, k = 0.42 + 0.72 * Math.min(1.5, lum + 0.2);
    d[i] += (Math.min(255, hr * k) - d[i]) * a; d[i + 1] += (Math.min(255, hg * k) - d[i + 1]) * a; d[i + 2] += (Math.min(255, hb * k) - d[i + 2]) * a;
  }
  x.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4;
  cache.tex.set(key, t); return t;
}

// palette variants: rotate the hue of the saturated, non-skin parts of a texture (hair, cloth, trim) so one model can be several operators
function variantTexture(cache, i, look) {
  const key = i + ':' + (look.hue || 0) + ':' + (look.sat ?? 1) + ':' + (look.val ?? 1);
  if (cache.tex.has(key)) return cache.tex.get(key);
  const src = cache.srcMats[i].map; if (!src || !src.image) return src;
  const img = src.image, W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, W, H), d = id.data, sh = look.hue || 0, ss = look.sat ?? 1, sv = look.val ?? 1;
  for (let p = 0; p < d.length; p += 4) {
    const r = d[p] / 255, g = d[p + 1] / 255, b = d[p + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn, s = mx ? df / mx : 0;
    if (s < 0.16 || mx < 0.14) { if (sv !== 1) { d[p] *= sv; d[p + 1] *= sv; d[p + 2] *= sv; } continue; }
    let h = 0; if (df) { if (mx === r) h = ((g - b) / df + 6) % 6; else if (mx === g) h = (b - r) / df + 2; else h = (r - g) / df + 4; h *= 60; }
    if (h >= 8 && h <= 48 && s < 0.62 && mx > 0.4) continue;   // skin stays skin
    h = (h + sh + 360) % 360; const s2 = Math.min(1, s * ss), v2 = Math.min(1, mx * sv), k = h / 60, ii = Math.floor(k) % 6, f = k - Math.floor(k), pp = v2 * (1 - s2), q = v2 * (1 - f * s2), t = v2 * (1 - (1 - f) * s2);
    const rgb = [[v2, t, pp], [q, v2, pp], [pp, v2, t], [pp, q, v2], [t, pp, v2], [v2, pp, q]][ii];
    d[p] = rgb[0] * 255; d[p + 1] = rgb[1] * 255; d[p + 2] = rgb[2] * 255;
  }
  x.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; t.needsUpdate = true;
  cache.tex.set(key, t); return t;
}

const D = new THREE.Vector3(0, -1, 0);

// toon copies of the source materials, one set per attached character (hit flash / camo mutate them)
function toonMats(cache, hair, tint, look) {
  const cfg = cache.cfg, out = [];
  cache.srcMats.forEach((src, i) => {
    let map = cfg.recolor && i === 0 ? hairTexture(cache, hair) : src.map;
    if (!cfg.recolor && look && (look.hue || (look.sat ?? 1) !== 1 || (look.val ?? 1) !== 1)) map = variantTexture(cache, i, look) || map;
    const m = new THREE.MeshToonMaterial({ map: map || null, gradientMap: toonGradient(), side: THREE.DoubleSide, emissive: new THREE.Color(0x000000) });
    if (src.color && !cfg.recolor) m.color.copy(src.color);
    if (src.transparent || src.alphaTest > 0) { m.alphaTest = src.alphaTest > 0 ? src.alphaTest : 0.45; }
    if (map) m.emissiveMap = map; m.emissive.setScalar(cfg.glow);
    if (cfg.recolor) m.color.set(0xffffff).lerp(new THREE.Color(tint), 0.3);
    // anime rim light in the team colour: reads as style and as team identification
    const rimC = new THREE.Color(tint);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = { value: rimC };
      sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n float rimK = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.6);\n totalEmissiveRadiance += uRim * rimK * 0.75;');
    };
    m.customProgramCacheKey = () => 'rimtoon';
    out.push(m);
  });
  return out;
}

// Attach a skinned operator to a procedural rig. Hides the classic body, keeps halo + weapon + joints.
export function attachAngel(rig, { hair = 0xff86c2, tint = 0x4aa0ff, model = 'angel', look = null } = {}) {
  const cache = caches[model] || caches.angel; if (!cache) return false;
  if (cache.clipped) return attachClipped(rig, cache, { tint });
  const cfg = cache.cfg, S = cfg.S, J = cfg.J, W = (p) => new THREE.Vector3(-p[0] * S, (p[1] + 0.5) * S, 0);
  const bones = {}, list = [];
  for (const b of cache.bones) {
    const bone = new THREE.Bone(); bone.name = b.name; bone.userData.j = W(b.joint);
    const pj = b.parent ? bones[b.parent].userData.j : new THREE.Vector3();
    bone.position.copy(bone.userData.j).sub(pj);
    if (b.parent) bones[b.parent].add(bone);
    bones[b.name] = bone; list.push(bone);
  }
  const mats = toonMats(cache, hair, tint, look);
  const mesh = new THREE.SkinnedMesh(cache.geo, mats.length === 1 ? mats[0] : mats);
  mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false;
  mesh.add(bones.hips); mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(list), new THREE.Matrix4());
  rig.model.add(mesh);
  const ink = outlineSkinned(mesh);
  // hide classic body meshes (weapon isn't attached yet); keep the halo
  rig.model.traverse((o) => { if (o.isMesh && o !== mesh && !o.userData.outline) { let p = o, keep = false; while (p) { if (p === rig.halo) keep = true; p = p.parent; } if (!keep) o.visible = false; } });
  // arm rest offsets: rotate the classic straight-down arm onto the scanned pose's arm
  const rest = {};
  for (const s of ['L', 'R']) {
    const sg = s === 'L' ? 1 : -1, a = W([J.sh[0] * sg, J.sh[1]]), b = W([J.wr[0] * sg, J.wr[1]]);
    rest[s] = new THREE.Quaternion().setFromUnitVectors(b.sub(a).normalize(), D);
    bones['sh' + s].scale.setScalar(cfg.shScale);
  }
  rig.haloY = 0.335; rig.halo.scale.setScalar(0.78); rig.crown.position.y = 0.27;
  rig.sam = { mesh, ink, bones, mats, mat: mats[0], rest, hipsY: bones.hips.position.y, base: cfg.glow, cfg, model };
  return true;
}

const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), qi = new THREE.Quaternion();
const RESTX = 0.15;
// Copy the procedural rig's animated joints onto the skinned skeleton. Called at the end of animateRig.
export function syncAngel(rig, s, dt = 1 / 60) {
  if (rig.sam.clip) return syncClipped(rig, s, dt);
  const S_ = rig.sam, B = S_.bones;
  B.hips.position.y = S_.hipsY + (rig.hips.position.y - 0.96) * 0.92;
  B.hips.rotation.copy(rig.hips.rotation); B.spine.rotation.copy(rig.spine.rotation); B.chest.rotation.copy(rig.chest.rotation);
  B.chest.scale.y = rig.chest.scale.y; B.head.rotation.copy(rig.head.rotation);
  B.thL.rotation.copy(rig.legL.rotation); B.skL.rotation.copy(rig.kneeL.rotation);
  B.thR.rotation.copy(rig.legR.rotation); B.skR.rotation.copy(rig.kneeR.rotation);
  for (const [n, arm, elb] of [['L', rig.aL.arm, rig.aL.elbow], ['R', rig.aR.arm, rig.aR.elbow]]) {
    const qr = S_.rest[n]; qi.copy(qr).invert();
    B['sh' + n].quaternion.copy(arm.quaternion).multiply(qr);
    B['el' + n].quaternion.copy(qi).multiply(elb.quaternion).multiply(qr);
  }
  if (B.taL) rig.tails.forEach((t, i) => {
    const n = i === 0 ? 'L' : 'R';   // tails[0] is sd=-1
    const sd = t.s;
    B['ta' + n].rotation.set((t.t1.rotation.x - 0.15) * 0.55, 0, (t.t1.rotation.z + 0.5 * sd) * 0.6);
    B['tb' + n].rotation.set((t.t2.rotation.x + t.t3.rotation.x * 0.7) * 0.6, 0, 0);
  });
  const w = rig.wings; if (w && B.wgL) { const k = (w.L.rotation.z - 0.24); B.wgL.rotation.set(w.L.rotation.x, 0, k * 0.8); B.wgR.rotation.set(w.R.rotation.x, 0, -k * 0.8); }
  // hit flash / boost glow ride on the classic body material; mirror them here
  const e = rig.mats.body.emissive; for (const m of S_.mats) m.emissive.setRGB(S_.base + e.r, S_.base + e.g, S_.base + e.b);
  void s; void q1; void q2; void RESTX;
}

export function angelCamo(rig, k) {
  const on = k > 0;
  rig.sam.ink.visible = !on;
  for (const m of rig.sam.mats) { m.transparent = on; m.opacity = on ? (k >= 1 ? 0.07 : 0.4) : 1; m.depthWrite = !on; m.needsUpdate = true; }
}
