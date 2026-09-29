// Weapon data + low-poly meshes. Meshes face -Z, origin at the grip.
import * as THREE from 'three';
import { mergeStatic } from './merge.js';

export const WEAPONS = {
  br: { name: 'BR55 Battle Rifle', short: 'BATTLE RIFLE', mag: 36, reserve: 144, reload: 2.0, cycle: 0.46, burst: 3, gap: 0.07, dmg: 12.5, head: 1.9, spread: 0.0035, range: 130, zoom: [2.2], kick: 0.011, snd: 'br', tracer: 0xffe6a0, ret: 'br', slot: 0, power: 0 },
  magnum: { name: 'M6 Magnum', short: 'MAGNUM', mag: 12, reserve: 60, reload: 1.5, cycle: 0.26, burst: 1, gap: 0, dmg: 46, head: 2.0, spread: 0.002, range: 90, zoom: [1.6], kick: 0.02, snd: 'magnum', tracer: 0xfff2c0, ret: 'dot', slot: 0, power: 0 },
  smg: { name: 'SMG', short: 'SMG', mag: 60, reserve: 240, reload: 1.7, cycle: 0.068, burst: 1, gap: 0, auto: true, dmg: 6.6, head: 1.5, spread: 0.028, range: 45, zoom: [1.2], kick: 0.004, snd: 'smg', tracer: 0xffd28a, ret: 'ring', slot: 0, power: 0 },
  shotgun: { name: 'M90 Shotgun', short: 'SHOTGUN', mag: 6, reserve: 24, reload: 2.3, cycle: 0.95, burst: 1, gap: 0, pellets: 10, dmg: 15.5, head: 1.0, spread: 0.06, range: 22, falloff: [4, 14], zoom: [1.2], kick: 0.06, snd: 'shotgun', tracer: 0xffc070, ret: 'ring', slot: 0, power: 2 },
  sniper: { name: 'SRS99 Sniper Rifle', short: 'SNIPER', mag: 4, reserve: 12, reload: 3.4, cycle: 1.45, burst: 1, gap: 0, dmg: 78, head: 3.2, spread: 0.0005, spreadHip: 0.03, range: 220, zoom: [3.5, 9], kick: 0.05, snd: 'sniper', tracer: 0xbfe8ff, ret: 'dot', slot: 0, power: 3 },
  rocket: { name: 'M41 Rocket Launcher', short: 'ROCKETS', mag: 2, reserve: 4, reload: 3.2, cycle: 1.3, burst: 1, gap: 0, dmg: 135, radius: 5.5, speed: 34, spread: 0.002, range: 200, zoom: [1.8], kick: 0.05, snd: 'rocket', proj: 'rocket', ret: 'ring', slot: 0, power: 3 },
  sword: { name: 'Energy Sword', short: 'ENERGY SWORD', mag: 100, reserve: 0, reload: 0, cycle: 0.6, burst: 1, gap: 0, dmg: 150, range: 2.6, lungeRange: 7.5, melee: true, kick: 0, snd: 'swing', ret: 'none', slot: 0, power: 3 },
};

for (const [k, v] of Object.entries(WEAPONS)) v.id = k;

// Silhouette icons (24-unit grid, single stroke) for HUD + pickups
export const ICONS = {
  br: 'M2 13h4l2-3h9l1 2h4v3h-6l-1 4H9l-1-4H2z M9 10V8h6v2',
  magnum: 'M3 10h13l3 1v3h-6l-1 5H9l1-5H3z',
  smg: 'M2 12h5l2-3h8l1 2h4v3h-7l-1 5h-3l1-5H2z',
  shotgun: 'M1 12h14l2-2h5v3h-5l-2 1H8l-2 3H4l1-3H1z',
  sniper: 'M1 14h10l2-2h9v2h-8l-2 2H8l-1 3H5l1-3H1z M10 9h6v2h-6z',
  rocket: 'M3 9h14l4 3-4 3H3z M7 15v4h3v-4 M3 12h6',
  sword: 'M4 20l4-4 M8 16l2 2 M9 15L20 4v3L11 16',
  frag: 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M10 3h4v3h-4z M9 12h6',
  plasma: 'M12 5l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z',
  overshield: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z M12 7v10 M8 11h8',
};

const _mats = {};
function mat(name, o) { return (_mats[name] ||= new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.25, ...o })); }
const dark = () => mat('dark', { color: 0x39414c });
const steel = () => mat('steel', { color: 0x59636f, metalness: 0.4, roughness: 0.4 });
const olive = () => mat('olive', { color: 0x5b6a4e, metalness: 0.3 });
const glow = (c) => mat('glow' + c, { color: 0x111111, emissive: c, emissiveIntensity: 2.4, metalness: 0, roughness: 0.3 });

function B(w, h, d, m, x = 0, y = 0, z = 0, rx = 0) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; return b; }
function C(rt, rb, len, m, x, y, z, seg = 8) { const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, len, seg), m); c.rotation.x = Math.PI / 2; c.position.set(x, y, z); return c; }

const BUILD = {
  br(g) {
    g.add(B(0.07, 0.11, 0.5, olive(), 0, 0.02, -0.15), B(0.06, 0.09, 0.2, dark(), 0, 0.0, 0.2), B(0.05, 0.05, 0.16, steel(), 0, 0.09, -0.05), C(0.03, 0.03, 0.42, steel(), 0, 0.03, -0.62), B(0.05, 0.17, 0.08, dark(), 0, -0.13, -0.1, 0.1), B(0.045, 0.14, 0.05, dark(), 0, -0.1, 0.08, -0.2));
    g.add(C(0.024, 0.024, 0.14, dark(), 0, 0.12, -0.1), B(0.03, 0.01, 0.03, glow(0xff6b3a), 0, 0.11, -0.19));
    g.userData.muzzle = new THREE.Vector3(0, 0.03, -0.85);
    g.userData.grip = [0, -0.08, 0.04]; g.userData.fore = [0, -0.03, -0.42];
  },
  magnum(g) {
    g.add(B(0.05, 0.08, 0.26, steel(), 0, 0.03, -0.1), B(0.045, 0.14, 0.06, dark(), 0, -0.07, 0.03, -0.25), C(0.017, 0.017, 0.22, dark(), 0, 0.045, -0.3), B(0.02, 0.012, 0.16, glow(0xffb03a), 0, 0.077, -0.1));
    g.userData.muzzle = new THREE.Vector3(0, 0.045, -0.42);
    g.userData.grip = [0, -0.06, 0.03]; g.userData.fore = [0.02, -0.05, 0.0];
  },
  smg(g) {
    g.add(B(0.07, 0.11, 0.34, dark(), 0, 0.02, -0.1), B(0.05, 0.05, 0.22, steel(), 0, 0.01, -0.36), B(0.04, 0.19, 0.06, olive(), 0, -0.14, -0.06, 0.15), B(0.05, 0.09, 0.14, olive(), 0, -0.02, 0.15), B(0.02, 0.03, 0.05, glow(0xffb03a), 0, 0.085, -0.08));
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.5);
    g.userData.grip = [0, -0.08, 0.05]; g.userData.fore = [0, -0.04, -0.3];
  },
  shotgun(g) {
    g.add(B(0.07, 0.1, 0.32, dark(), 0, 0.02, -0.02), C(0.024, 0.024, 0.55, steel(), 0, 0.04, -0.42), C(0.028, 0.028, 0.24, olive(), 0, -0.02, -0.34), B(0.06, 0.09, 0.22, olive(), 0, -0.02, 0.25, 0.1));
    g.userData.muzzle = new THREE.Vector3(0, 0.04, -0.72);
    g.userData.grip = [0, -0.07, 0.05]; g.userData.fore = [0, -0.06, -0.34];
  },
  sniper(g) {
    g.add(B(0.06, 0.1, 0.55, olive(), 0, 0.02, -0.1), B(0.06, 0.11, 0.26, dark(), 0, 0.0, 0.32), C(0.022, 0.022, 0.6, steel(), 0, 0.04, -0.7), C(0.038, 0.038, 0.36, dark(), 0, 0.115, -0.08), C(0.05, 0.05, 0.03, glow(0x66e0ff), 0, 0.115, -0.27), B(0.04, 0.12, 0.05, dark(), 0, -0.1, 0.0, 0.1));
    g.userData.muzzle = new THREE.Vector3(0, 0.04, -1.02);
    g.userData.grip = [0, -0.08, 0.1]; g.userData.fore = [0, -0.03, -0.42];
  },
  rocket(g) {
    g.add(C(0.095, 0.095, 0.85, olive(), 0, 0.02, -0.25), C(0.12, 0.09, 0.14, dark(), 0, 0.02, 0.2), C(0.1, 0.1, 0.05, glow(0xff6b3a), 0, 0.02, -0.7), B(0.05, 0.14, 0.06, dark(), 0, -0.13, 0.0, 0.1), B(0.04, 0.05, 0.3, steel(), 0, 0.13, -0.2));
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.75);
    g.userData.grip = [0, -0.1, 0.05]; g.userData.fore = [0, -0.1, -0.35];
  },
  sword(g) {
    const bl = glow(0x6ab8ff), core = glow(0xffffff);
    g.add(B(0.05, 0.05, 0.22, dark(), 0, 0, 0), B(0.12, 0.05, 0.05, steel(), 0, 0, -0.12), B(0.05, 0.02, 0.3, bl, 0.035, 0.0, -0.3), B(0.05, 0.02, 0.3, bl, -0.035, 0.0, -0.3),
      B(0.06, 0.03, 0.9, bl, 0, 0, -0.75), B(0.02, 0.035, 0.9, core, 0, 0, -0.75));
    g.userData.muzzle = new THREE.Vector3(0, 0, -1.1);
    g.userData.grip = [0, -0.01, 0.05]; g.userData.fore = [0, -0.02, -0.05];
  },
};

// ---- optional real models: drop .glb files in models/weapons (or git-ignored models/private) ----
const MODELS = {};
const DEFAULT_LEN = { br: 0.95, magnum: 0.32, smg: 0.55, shotgun: 0.9, sniper: 1.25, rocket: 1.05, sword: 1.2 };
export async function loadWeaponModels(onStatus = () => {}) {
  let loader = null;
  for (const dir of ['models/private/', 'models/weapons/']) {
    let man;
    try { const r = await fetch(dir + 'manifest.json', { cache: 'no-cache' }); if (!r.ok) continue; man = await r.json(); } catch { continue; }
    if (!Object.keys(man).length) continue;
    if (!loader) { const { GLTFLoader } = await import('../vendor/jsm/loaders/GLTFLoader.js'); loader = new GLTFLoader(); }
    for (const [id, raw] of Object.entries(man)) {
      if (MODELS[id] || !WEAPONS[id]) continue;
      const o = typeof raw === 'string' ? { file: raw } : raw;
      try {
        onStatus('Loading ' + WEAPONS[id].short);
        const gltf = await loader.loadAsync(dir + o.file);
        MODELS[id] = normalizeModel(gltf.scene, id, o);
      } catch (e) { console.warn('weapon model failed', id, e); }
    }
  }
  return Object.keys(MODELS);
}

function normalizeModel(scene, id, o) {
  const len = o.length || DEFAULT_LEN[id] || 0.9;
  const inner = new THREE.Group(); inner.add(scene);
  if (o.rotY) inner.rotation.y = (o.rotY * Math.PI) / 180;
  if (o.rotX) inner.rotation.x = (o.rotX * Math.PI) / 180;
  if (o.rotZ) inner.rotation.z = (o.rotZ * Math.PI) / 180;
  const root = new THREE.Group(); root.add(inner); root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  // longest axis is the barrel: turn it onto Z if the author faced it along X
  if (!o.rotY && !o.rotX && !o.rotZ && size.x > size.z * 1.2) { inner.rotation.y = Math.PI / 2; root.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(root); size = box.getSize(new THREE.Vector3()); }
  const k = len / Math.max(size.z, 0.001);
  root.scale.setScalar(k); root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  // origin at the grip: a third of the way forward of the stock, centred, a little below the barrel line
  const gz = box.max.z - (o.gripFromStock ?? 0.33) * (box.max.z - box.min.z), gy = box.min.y + (box.max.y - box.min.y) * (o.gripHeight ?? 0.35);
  const out = new THREE.Group(); out.add(root);
  root.position.set(-c.x, -gy, -gz);
  const zf = (box.min.z - gz), zb = (box.max.z - gz);
  out.userData = {
    grip: o.grip || [0, 0, 0], fore: o.fore || [0, -0.02, zf * 0.55],
    muzzle: new THREE.Vector3(...(o.muzzle || [0, (box.max.y - gy) * 0.6, zf])),
    model: true, back: zb,
  };
  out.traverse((m) => { if (m.isMesh) { m.frustumCulled = false; if (m.material) m.material.envMapIntensity = 1.2; } });
  return out;
}

const _cache = {};
export function makeWeaponMesh(id) {
  if (MODELS[id]) {
    const g = MODELS[id].clone(true);
    g.userData = { ...MODELS[id].userData, muzzle: MODELS[id].userData.muzzle.clone() };
    return g;
  }
  const g = new THREE.Group();
  (BUILD[id] || BUILD.br)(g);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
  const ud = g.userData; mergeStatic(g); g.userData = ud;
  return g;
}

export function makeGrenadeMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'plasma') {
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), glow(0x66d0ff)));
    const f = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0x66d0ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(f);
  } else {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), olive()));
    g.add(B(0.12, 0.03, 0.12, steel(), 0, 0.02, 0), B(0.03, 0.05, 0.03, dark(), 0, 0.11, 0));
  }
  return g;
}

export function makeRocketMesh() {
  const g = new THREE.Group();
  g.add(C(0.07, 0.07, 0.5, olive(), 0, 0, 0), C(0.0, 0.07, 0.16, dark(), 0, 0, -0.33), C(0.06, 0.05, 0.05, glow(0xff7a3a), 0, 0, 0.27));
  return g;
}
void _cache;

export function makePickupIcon(id) {
  return id;
}
