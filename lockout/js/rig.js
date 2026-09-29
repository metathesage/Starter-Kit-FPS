// Low-poly armored waifu: hierarchical rig, procedural animation, two-bone arm IK.
import * as THREE from 'three';
import { TAU, clamp, damp, lerp } from './util.js';
import { makeWeaponMesh } from './weapons.js';

export const WAIFUS = [
  { id: 'aoi', name: 'AOI', role: 'VANGUARD', hair: 0xff86c2, eye: 0x5ce1ff, blurb: 'Fearless pusher. Lives on the ramps.' },
  { id: 'kira', name: 'KIRA', role: 'MARKSMAN', hair: 0xdfe9ff, eye: 0xff5b8a, blurb: 'Patient. Owns the tower.' },
  { id: 'nova', name: 'NOVA', role: 'BREACHER', hair: 0x5df2be, eye: 0xffd15b, blurb: 'Close range, no manners.' },
  { id: 'yuna', name: 'YUNA', role: 'PHANTOM', hair: 0xb28cff, eye: 0xff9ab8, blurb: 'Flanks. Always flanks.' },
];
export const BOT_STYLES = [
  { name: 'HIKARI', hair: 0xffd166, eye: 0x6ab8ff }, { name: 'RIN', hair: 0xff5b5b, eye: 0xffe36a },
  { name: 'YUZU', hair: 0xff9f43, eye: 0x7cf0c9 }, { name: 'MIO', hair: 0x4fd1ff, eye: 0xff8fb8 },
  { name: 'KAEDE', hair: 0xe8567f, eye: 0xfff09a }, { name: 'SUZU', hair: 0xc8f26a, eye: 0xb28cff },
  { name: 'AKANE', hair: 0xff6f91, eye: 0x9df2ff }, { name: 'TSUKI', hair: 0x9aa7ff, eye: 0xffb86b },
  { name: 'MOMO', hair: 0xffb3d9, eye: 0x7cc7ff }, { name: 'SORA', hair: 0x7de0ff, eye: 0xff7a9c },
  { name: 'NANA', hair: 0xf2f2f8, eye: 0x82ffb0 }, { name: 'EMI', hair: 0xff7f50, eye: 0x8fd4ff },
];
export const TEAM = {
  red: { name: 'RED', armor: 0xd93a48, armor2: 0x2a2f3a, glow: 0xff4a58, css: '#ff4a58' },
  blue: { name: 'BLUE', armor: 0x2f6df0, armor2: 0x2a2f3a, glow: 0x4aa0ff, css: '#4aa0ff' },
};

// ---- geometry merging: many primitives -> one mesh per material ------------
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const BUCKET = { skin: 'body', suit: 'body', armor: 'body', armor2: 'body', glow: 'body', trim: 'skirt' };
const GLOW_KEYS = new Set(['glow', 'trim']);
const partColor = (mats, key) => (key === 'glow' || key === 'trim' ? mats[key].emissive : key === 'skirt' ? mats._skirtColor.color : mats[key].color);
class Parts {
  constructor() { this.items = []; }
  add(geo, key, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz); _q.setFromEuler(_e);
    this.items.push({ geo, key, m: new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz)) });
    return this;
  }
  build(mats, cast = true) {
    const g = new THREE.Group(), by = {};
    for (const it of this.items) (by[BUCKET[it.key] || it.key] ||= []).push(it);
    for (const k of Object.keys(by)) {
      const P = [], N = [], U = [], C = [], vc = k === 'body' || k === 'skirt';
      for (const it of by[k]) {
        const ng = it.geo.index ? it.geo.toNonIndexed() : it.geo.clone();
        ng.applyMatrix4(it.m);
        P.push(...ng.attributes.position.array); N.push(...ng.attributes.normal.array); U.push(...ng.attributes.uv.array);
        if (vc) { const c = partColor(mats, it.key), e = GLOW_KEYS.has(it.key) ? 2.2 : 1, n = ng.attributes.position.count; for (let i = 0; i < n; i++) C.push(c.r * e, c.g * e, c.b * e); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      if (vc) geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      const m = new THREE.Mesh(geo, mats[k]);
      m.castShadow = cast;
      g.add(m);
    }
    return g;
  }
}
const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sph = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);

const _face = {};
export function faceTexture(eye) {
  if (_face[eye]) return _face[eye];
  const c = document.createElement('canvas'); c.width = 256; c.height = 154;
  const g = c.getContext('2d');
  const col = '#' + new THREE.Color(eye).getHexString();
  for (const sx of [0.29, 0.71]) {
    const cx = c.width * sx, cy = 74, s = sx < 0.5 ? -1 : 1;
    g.fillStyle = 'rgba(255,120,150,.22)'; g.beginPath(); g.ellipse(cx + s * 6, cy + 40, 16, 6, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx, cy, 27, 37, 0, 0, TAU); g.fill();
    const gr = g.createLinearGradient(0, cy - 30, 0, cy + 30); gr.addColorStop(0, '#1b1230'); gr.addColorStop(0.35, col); gr.addColorStop(1, '#fff');
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy + 2, 21, 33, 0, 0, TAU); g.fill();
    g.fillStyle = '#120a20'; g.beginPath(); g.ellipse(cx, cy + 3, 9, 17, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - 7, cy - 12, 7, 0, TAU); g.fill(); g.beginPath(); g.arc(cx + 8, cy + 14, 3.5, 0, TAU); g.fill();
    g.strokeStyle = '#1b1230'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - 28, cy - 12); g.quadraticCurveTo(cx, cy - 42, cx + 28, cy - 14); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(cx + s * 26, cy - 14); g.lineTo(cx + s * 36, cy - 24); g.stroke();
  }
  g.strokeStyle = '#a84a5a'; g.lineWidth = 3; g.beginPath(); g.moveTo(118, 136); g.quadraticCurveTo(128, 143, 138, 136); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (_face[eye] = t);
}

// ---- two-bone IK, everything in the parent (chest) space -------------------
const DOWN = new THREE.Vector3(0, -1, 0);
const _d = new THREE.Vector3(), _p = new THREE.Vector3(), _E = new THREE.Vector3(), _u = new THREE.Vector3(), _T = new THREE.Vector3(), _f = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
export function solveArm(arm, elbow, target, pole, L1, L2) {
  _d.subVectors(target, arm.position);
  const dist = clamp(_d.length(), 0.08, L1 + L2 - 0.003);
  _d.normalize();
  const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1), A = Math.acos(cosA);
  _p.copy(pole); _p.addScaledVector(_d, -_p.dot(_d)).normalize();
  _E.copy(arm.position).addScaledVector(_d, L1 * cosA).addScaledVector(_p, L1 * Math.sin(A));
  _u.subVectors(_E, arm.position).normalize();
  _T.copy(arm.position).addScaledVector(_d, dist);
  _f.subVectors(_T, _E).normalize();
  _q1.setFromUnitVectors(DOWN, _u);
  arm.quaternion.copy(_q1);
  _q2.setFromUnitVectors(DOWN, _f);
  elbow.quaternion.copy(_q1.invert().multiply(_q2));
}

export function makeArm(mats, L1, L2, r = 1) {
  const arm = new THREE.Group(), elbow = new THREE.Group(); elbow.position.y = -L1; arm.add(elbow);
  const up = new Parts().add(cyl(0.042 * r, 0.037 * r, L1, 6), 'suit', 0, -L1 / 2, 0);
  up.add(sph(0.118 * r, 7, 5), 'armor', 0, 0.03, 0, 0, 0, 0, 1.05, 0.85, 1.05).add(bx(0.13 * r, 0.05 * r, 0.14 * r), 'armor2', 0, -0.05 * r, 0).add(cyl(0.05 * r, 0.045 * r, L1 * 0.4, 6), 'armor2', 0, -L1 * 0.62, 0);
  arm.add(up.build(mats));
  const lo = new Parts().add(cyl(0.037 * r, 0.03 * r, L2, 6), 'suit', 0, -L2 / 2, 0);
  lo.add(cyl(0.062 * r, 0.054 * r, L2 * 0.6, 6), 'armor', 0, -L2 * 0.42, 0);
  lo.add(bx(0.085 * r, 0.095 * r, 0.105 * r), 'suit', 0, -L2 - 0.02, 0).add(bx(0.09 * r, 0.03 * r, 0.11 * r), 'armor2', 0, -L2 * 0.72, 0);
  lo.add(bx(0.02 * r, 0.02 * r, 0.06 * r), 'glow', 0, -L2 * 0.4, -0.05 * r);
  elbow.add(lo.build(mats));
  return { arm, elbow };
}

// ---- the waifu ------------------------------------------------------------------
export function makeMats(team, hair, eye) {
  const T = TEAM[team] || TEAM.blue;
  const M = (o) => new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.6, metalness: 0.1, ...o });
  return {
    skin: M({ color: 0xffd8c8, roughness: 0.75 }),
    suit: M({ color: 0x1d2430, roughness: 0.6, metalness: 0.15 }),
    armor: M({ color: T.armor, roughness: 0.4, metalness: 0.25 }),
    armor2: M({ color: 0x3a424f, roughness: 0.4, metalness: 0.45 }),
    glow: M({ color: 0x111111, emissive: T.glow, emissiveIntensity: 2.4, roughness: 0.3 }),
    hair: M({ color: hair, roughness: 0.45, metalness: 0.1, emissive: hair, emissiveIntensity: 0.12 }),
    skirt: M({ vertexColors: true, roughness: 0.5, metalness: 0.25, side: THREE.DoubleSide }),
    _skirtColor: M({ color: 0x2f3642 }),
    trim: M({ color: 0x111111, emissive: T.glow, emissiveIntensity: 2.2, side: THREE.DoubleSide }),
    body: M({ vertexColors: true, roughness: 0.5, metalness: 0.2 }),
    visor: M({ color: 0xffd25a, metalness: 0.6, roughness: 0.2, emissive: 0xffa010, emissiveIntensity: 0.85 }),
    face: new THREE.MeshBasicMaterial({ map: faceTexture(eye), transparent: true, alphaTest: 0.05, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  };
}

export function buildWaifu({ team = 'blue', hair = 0xff86c2, eye = 0x5ce1ff, scale = 1.04, helmet = true } = {}) {
  const mats = makeMats(team, hair, eye);
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const model = new THREE.Group(); model.scale.setScalar(scale); root.add(model);

  const hips = new THREE.Group(); hips.position.y = 0.96; model.add(hips);
  hips.add(new Parts().add(bx(0.3, 0.13, 0.2), 'suit').add(bx(0.08, 0.17, 0.2), 'armor', -0.18, -0.01, 0).add(bx(0.08, 0.17, 0.2), 'armor', 0.18, -0.01, 0)
    .add(bx(0.12, 0.09, 0.03), 'armor2', 0, -0.01, -0.11).add(bx(0.04, 0.03, 0.02), 'glow', 0, -0.01, -0.13).build(mats));
  const skirt = new THREE.Group(); skirt.position.y = -0.03; hips.add(skirt);
  skirt.add(new Parts().add(new THREE.CylinderGeometry(0.16, 0.245, 0.15, 8, 1, true), 'skirt', 0, -0.07, 0).add(new THREE.CylinderGeometry(0.246, 0.25, 0.022, 8, 1, true), 'trim', 0, -0.15, 0).build(mats, false));

  const mkLeg = (s) => {
    const leg = new THREE.Group(); leg.position.set(0.095 * s, -0.04, 0); hips.add(leg);
    leg.add(new Parts().add(cyl(0.076, 0.058, 0.45, 6), 'suit', 0, -0.225, 0).add(bx(0.07, 0.27, 0.15), 'armor', 0.066 * s, -0.16, -0.01).add(bx(0.025, 0.22, 0.02), 'glow', 0.104 * s, -0.16, -0.01).build(mats));
    const knee = new THREE.Group(); knee.position.y = -0.45; leg.add(knee);
    knee.add(new Parts().add(cyl(0.056, 0.04, 0.42, 6), 'suit', 0, -0.21, 0).add(bx(0.115, 0.3, 0.115), 'armor', 0, -0.19, -0.05).add(sph(0.08, 6, 4), 'armor', 0, 0, -0.04)
      .add(bx(0.115, 0.1, 0.23), 'armor', 0, -0.44, -0.045).add(bx(0.09, 0.05, 0.05), 'armor2', 0, -0.47, 0.055).add(bx(0.07, 0.02, 0.01), 'glow', 0, -0.435, -0.145).build(mats));
    return { leg, knee };
  };
  const L = mkLeg(-1), R = mkLeg(1);

  const spine = new THREE.Group(); spine.position.y = 0.06; hips.add(spine);
  spine.add(new Parts().add(cyl(0.105, 0.125, 0.15, 8), 'suit', 0, 0.075, 0).add(bx(0.2, 0.05, 0.14), 'armor2', 0, 0.02, 0).build(mats));
  const chest = new THREE.Group(); chest.position.y = 0.14; spine.add(chest);
  chest.add(new Parts().add(cyl(0.155, 0.16, 0.25, 6), 'suit', 0, 0.12, 0, 0, 0, 0, 1, 1, 0.78)
    .add(bx(0.33, 0.2, 0.08), 'armor', 0, 0.15, -0.095).add(bx(0.2, 0.06, 0.07), 'armor2', 0, 0.27, -0.06).add(bx(0.06, 0.1, 0.02), 'glow', 0, 0.16, -0.125).add(bx(0.3, 0.05, 0.05), 'armor2', 0, 0.06, -0.075)
    .add(bx(0.2, 0.22, 0.09), 'armor2', 0, 0.14, 0.11).add(bx(0.03, 0.14, 0.02), 'glow', -0.05, 0.15, 0.16).add(bx(0.03, 0.14, 0.02), 'glow', 0.05, 0.15, 0.16)
    .add(cyl(0.03, 0.035, 0.07, 6), 'skin', 0, 0.27, 0).add(cyl(0.05, 0.06, 0.03, 6), 'armor2', 0, 0.245, 0).build(mats));

  const head = new THREE.Group(); head.position.y = 0.33; chest.add(head);
  const hp = new Parts();
  hp.add(sph(0.13, 10, 8), 'skin', 0, 0.12, 0, 0, 0, 0, 0.95, 1.02, 0.98);
  hp.add(sph(0.14, 8, 6), 'hair', 0, 0.09, 0.06, 0, 0, 0, 1, 1.25, 0.95);
  for (const s_ of [-1, 1]) hp.add(cyl(0.05, 0.05, 0.05, 8), 'armor', 0.145 * s_, 0.11, 0.0, 0, 0, Math.PI / 2).add(cyl(0.032, 0.032, 0.055, 8), 'glow', 0.15 * s_, 0.11, 0, 0, 0, Math.PI / 2);
  if (!helmet) {
    hp.add(new THREE.SphereGeometry(0.153, 10, 8, 0, TAU, 0, Math.PI * 0.6), 'hair', 0, 0.14, 0.008, -0.22, 0, 0);
    for (let i = -3; i <= 3; i++) {
      const a_ = i * 0.27;
      hp.add(new THREE.ConeGeometry(0.036, 0.12 - Math.abs(i) * 0.008, 4), 'hair', Math.sin(a_) * 0.125, 0.205 - Math.abs(i) * 0.02, -Math.cos(a_) * 0.115, Math.PI + 0.35, 0, -a_ * 0.6);
    }
    hp.add(bx(0.035, 0.17, 0.06), 'hair', 0.135, 0.07, -0.035).add(bx(0.035, 0.17, 0.06), 'hair', -0.135, 0.07, -0.035);
    hp.add(new THREE.TorusGeometry(0.158, 0.008, 4, 14, Math.PI), 'armor2', 0, 0.12, 0, 0, 0, 0);
    hp.add(cyl(0.006, 0.006, 0.1, 4), 'armor2', 0.1, 0.06, -0.08, 0.5, 0, -1.0).add(sph(0.014, 5, 4), 'glow', 0.075, 0.035, -0.115);
    hp.add(new THREE.TorusGeometry(0.05, 0.007, 4, 8, Math.PI * 1.3), 'hair', 0, 0.28, -0.02, 0.2, 0, 0.5);
  } else {
    // Mjolnir-style helmet: domed shell, gold visor, jaw guard, side vents, crest
    hp.add(sph(0.158, 10, 8), 'armor', 0, 0.125, 0.006, 0, 0, 0, 1.0, 1.02, 1.1);
    hp.add(new THREE.SphereGeometry(0.166, 12, 8, Math.PI * 1.5 - 0.95, 1.9, 1.02, 0.72), 'visor', 0, 0.125, 0.0, 0, 0, 0, 1.0, 1.02, 1.1);
    hp.add(bx(0.17, 0.075, 0.1), 'armor2', 0, 0.02, -0.085).add(bx(0.09, 0.05, 0.05), 'armor2', 0, -0.005, -0.13);
    hp.add(bx(0.035, 0.06, 0.24), 'armor2', 0, 0.29, 0.0).add(bx(0.2, 0.03, 0.05), 'armor2', 0, 0.215, -0.11);
    for (const s_ of [-1, 1]) hp.add(bx(0.03, 0.07, 0.11), 'armor2', 0.155 * s_, 0.06, -0.06).add(bx(0.012, 0.03, 0.05), 'glow', 0.171 * s_, 0.075, -0.06);
    hp.add(cyl(0.006, 0.006, 0.16, 4), 'armor2', 0.14, 0.32, 0.06, 0, 0, 0).add(sph(0.012, 5, 4), 'glow', 0.14, 0.4, 0.06);
  }
  head.add(hp.build(mats));
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.1335, 0.1335, 0.145, 14, 1, true, Math.PI - 0.95, 1.9), mats.face);
  face.position.y = 0.118; face.visible = !helmet; head.add(face);

  const tails = [];
  for (const s of [-1, 1]) {
    const t1 = new THREE.Group(); t1.position.set((helmet ? 0.13 : 0.13) * s, helmet ? 0.17 : 0.2, helmet ? 0.12 : 0.07); head.add(t1); t1.rotation.z = -(helmet ? 0.75 : 0.4) * s; if (helmet) t1.scale.setScalar(1.35);
    t1.add(new Parts().add(cyl(0.05, 0.042, 0.2, 6), 'hair', 0, -0.1, 0).add(new THREE.OctahedronGeometry(0.045, 0), 'glow', 0, 0.02, 0, 0, 0, 0, 1.4, 0.8, 1).build(mats, false));
    const t2 = new THREE.Group(); t2.position.y = -0.2; t1.add(t2);
    t2.add(new Parts().add(cyl(0.042, 0.03, 0.2, 6), 'hair', 0, -0.1, 0).build(mats, false));
    const t3 = new THREE.Group(); t3.position.y = -0.2; t2.add(t3);
    t3.add(new Parts().add(new THREE.ConeGeometry(0.03, 0.2, 6), 'hair', 0, -0.1, 0, Math.PI, 0, 0).build(mats, false));
    tails.push({ t1, t2, t3, s });
  }

  const aL = makeArm(mats, 0.28, 0.3), aR = makeArm(mats, 0.28, 0.3);
  aL.arm.position.set(-0.2, 0.2, 0); aR.arm.position.set(0.2, 0.2, 0);
  chest.add(aL.arm, aR.arm);

  const wRoot = new THREE.Group(); wRoot.position.set(0.09, 0.13, -0.06); chest.add(wRoot);
  const rig = {
    root, model, hips, spine, chest, head, skirt, tails, legL: L.leg, kneeL: L.knee, legR: R.leg, kneeR: R.knee, aL, aR, wRoot, mats,
    weaponId: null, weapon: null, flash: 0,
    a: { phase: 0, speed: 0, crouch: 0, air: 0, dead: 0, t: Math.random() * 10, flinch: 0, melee: 0, throw: 0, reloading: 0, kick: 0 },
  };
  root.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });
  rig.setWeapon = (id) => {
    if (rig.weaponId === id) return;
    rig.weaponId = id;
    if (rig.weapon) wRoot.remove(rig.weapon);
    rig.weapon = id ? makeWeaponMesh(id) : null;
    if (rig.weapon) wRoot.add(rig.weapon);
  };
  rig.setStyle = (hairC, eyeC) => { mats.hair.color.setHex(hairC); mats.hair.emissive.setHex(hairC); mats.face.map = faceTexture(eyeC); mats.face.needsUpdate = true; };
  rig.helmet = helmet;
  rig.setVisible = (v) => { root.visible = v; };
  return rig;
}

const _tr = new THREE.Vector3(), _tl = new THREE.Vector3(), _g = new THREE.Vector3();
const POLE_R = new THREE.Vector3(0.6, -1, 0.3), POLE_L = new THREE.Vector3(-0.6, -1, 0.3);

// s: { speed(m/s), lx, lz (unit move dir in facing frame), grounded, crouch(0..1), pitch, dead, firing(0..1), melee(0..1 progress or 0), throwT(0..1 or 0), reloading, weaponId, hit }
export function animateRig(rig, dt, s) {
  const a = rig.a;
  a.t += dt;
  const spdN = clamp(s.speed / 5.6, 0, 1);
  a.speed = damp(a.speed, spdN, 12, dt);
  a.crouch = damp(a.crouch, s.crouch || 0, 12, dt);
  a.air = damp(a.air, s.grounded ? 0 : 1, 14, dt);
  a.dead = damp(a.dead, s.dead ? 1 : 0, s.dead ? 5 : 30, dt);
  a.flinch = damp(a.flinch, 0, 9, dt);
  if (s.hit) a.flinch = 1;
  a.kick = damp(a.kick, s.firing || 0, 18, dt);
  a.phase += s.speed * dt * (s.crouch ? 1.9 : 1.55);
  rig.setWeapon(s.weaponId);

  const sp = a.speed, ph = a.phase, cr = a.crouch, air = a.air;
  const lz = s.lz ?? 1, lx = s.lx ?? 0;
  const sw = Math.sin(ph) * 0.9 * sp;

  rig.hips.position.y = 0.96 - cr * 0.36 + Math.abs(Math.sin(ph)) * 0.025 * sp - air * 0.03;
  rig.hips.rotation.x = 0.08 * sp * lz + cr * 0.12;
  rig.hips.rotation.y = Math.sin(ph) * 0.12 * sp;
  rig.spine.rotation.x = clamp(s.pitch || 0, -1.2, 1.2) * 0.3 - a.flinch * 0.18 + cr * 0.15;
  rig.spine.rotation.y = -Math.sin(ph) * 0.1 * sp;
  rig.chest.scale.y = 1 + Math.sin(a.t * 1.8) * 0.012;
  rig.head.rotation.x = clamp(s.pitch || 0, -1.2, 1.2) * 0.7 - rig.spine.rotation.x * 0 - a.flinch * 0.1;
  rig.head.rotation.y = Math.sin(a.t * 0.7) * 0.04 * (1 - sp);

  // legs
  const legs = [[rig.legR, rig.kneeR, 1], [rig.legL, rig.kneeL, -1]];
  legs.forEach(([leg, knee, side], i) => {
    const p = ph + (i ? Math.PI : 0);
    const swing = Math.sin(p) * 0.85 * sp;
    const bend = sp * (0.55 + 0.45 * Math.sin(p - 1.3)) * 0.95;
    leg.rotation.x = swing * lz + cr * 1.0 + air * 0.55;
    leg.rotation.z = -Math.sin(p) * 0.4 * sp * lx * -side * 0.0 + Math.sin(p) * 0.35 * sp * lx;
    knee.rotation.x = -(bend + cr * 1.95 + air * 0.9);
  });
  void sw;

  // hair + skirt secondary motion
  for (let i = 0; i < rig.tails.length; i++) {
    const t = rig.tails[i], o = i * 1.7;
    t.t1.rotation.x = -sp * 0.55 * lz + Math.sin(a.t * 2.2 + o) * 0.08 - air * 0.6 + a.flinch * 0.3 - Math.sin(ph * 2) * 0.12 * sp;
    t.t1.rotation.z = -(rig.helmet ? 0.75 : 0.4) * t.s + Math.sin(a.t * 1.7 + o) * 0.06 + lx * 0.25 * sp * t.s;
    t.t2.rotation.x = -sp * 0.3 * lz + Math.sin(a.t * 2.6 + o + 0.8) * 0.14 - air * 0.3;
    t.t3.rotation.x = -sp * 0.25 * lz + Math.sin(a.t * 3.1 + o + 1.6) * 0.18;
  }
  rig.skirt.scale.set(1 + sp * 0.06 + cr * 0.1 + air * 0.08, 1 - cr * 0.15, 1 + sp * 0.06 + cr * 0.1 + air * 0.08);
  rig.skirt.rotation.x = 0.05 * sp * lz + Math.sin(ph * 2) * 0.03 * sp;

  // weapon + arms (IK toward weapon grips)
  const w = rig.weapon;
  if (w) {
    const melee = s.melee || 0, throwT = s.throwT || 0;
    rig.wRoot.position.set(0.09, 0.12, -0.06 + a.kick * 0.06 - (s.reloading ? 0.02 : 0));
    rig.wRoot.rotation.set((s.pitch || 0) * 0.7 + a.kick * 0.08 + (s.reloading ? 0.5 : 0) + Math.sin(a.t * 1.6) * 0.008, 0.1, 0);
    if (melee > 0) {
      const k = Math.sin(melee * Math.PI);
      rig.wRoot.rotation.x += -k * 1.1; rig.wRoot.rotation.y += (0.5 - melee) * 0.9; rig.wRoot.position.z -= k * 0.22;
      rig.spine.rotation.y += (0.5 - melee) * 0.9;
    }
    rig.wRoot.updateMatrix();
    const [gx, gy, gz] = w.userData.grip, [fx, fy, fz] = w.userData.fore;
    _tr.set(gx, gy, gz).applyQuaternion(rig.wRoot.quaternion).add(rig.wRoot.position);
    _tl.set(fx, fy, fz).applyQuaternion(rig.wRoot.quaternion).add(rig.wRoot.position);
    if (throwT > 0) {
      const k = Math.sin(clamp(throwT, 0, 1) * Math.PI);
      _g.set(0.22, 0.05 + 0.5 * k, -0.15 - 0.25 * (throwT > 0.5 ? k : 0));
      _tr.lerp(_g, k);
    }
    if (a.dead < 0.4) {
      solveArm(rig.aR.arm, rig.aR.elbow, _tr, POLE_R, 0.28, 0.3);
      solveArm(rig.aL.arm, rig.aL.elbow, _tl, POLE_L, 0.28, 0.3);
    }
  } else {
    rig.aR.arm.rotation.x = Math.sin(ph) * 0.6 * sp; rig.aL.arm.rotation.x = -Math.sin(ph) * 0.6 * sp;
  }

  // death: topple backward, limbs go slack
  rig.root.rotation.x = a.dead * 1.5;
  rig.model.position.y = -a.dead * 0.08;
  if (a.dead > 0.4) {
    rig.aR.arm.rotation.set(-0.4, 0, -0.9 * a.dead); rig.aL.arm.rotation.set(-0.2, 0, 0.9 * a.dead);
    rig.aR.elbow.rotation.set(-0.5, 0, 0); rig.aL.elbow.rotation.set(-0.3, 0, 0);
  }

  // hit flash
  if (rig.flash > 0) {
    rig.flash = Math.max(0, rig.flash - dt * 6);
    const e = rig.flash * 1.4;
    rig.mats.body.emissive.setRGB(e * 0.8, e * 0.8, e * 0.8);
  } else if (rig.mats.body.emissive.r > 0) { rig.mats.body.emissive.setRGB(0, 0, 0); }
}

export function disposeRig(rig) {
  rig.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  Object.values(rig.mats).forEach((m) => m.dispose && m.dispose());
}
