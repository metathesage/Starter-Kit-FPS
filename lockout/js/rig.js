// Low-poly armored waifu: hierarchical rig, procedural animation, two-bone arm IK.
import * as THREE from 'three';
import { TAU, clamp, damp, lerp } from './util.js';
import { makeWeaponMesh } from './weapons.js';
import { angelReady, attachAngel, syncAngel, angelCamo } from './angel.js';

export const WAIFUS = [
  { id: 'aoi', name: 'AOI', role: 'VANGUARD', hair: 0xff86c2, eye: 0x5ce1ff, blurb: 'Fearless pusher. Lives on the ramps.' },
  { id: 'kira', name: 'KIRA', role: 'MARKSMAN', hair: 0xdfe9ff, eye: 0xff5b8a, blurb: 'Patient. Owns the tower.' },
  { id: 'nova', name: 'NOVA', role: 'BREACHER', hair: 0x5df2be, eye: 0xffd15b, blurb: 'Close range, no manners.' },
  { id: 'yuna', name: 'YUNA', role: 'PHANTOM', hair: 0xb28cff, eye: 0xff9ab8, blurb: 'Flanks. Always flanks.' },
  { id: 'mira', name: 'MIRA', role: 'ENFORCER', hair: 0xff5b6e, eye: 0xffd15b, blurb: 'Holds the line. Never blinks first.' },
  { id: 'ivy', name: 'IVY', role: 'SENTINEL', hair: 0x2fd6c0, eye: 0xb28cff, blurb: 'Quiet. Counts your reloads.' },
  { id: 'hana', name: 'HANA', role: 'SKIRMISHER', hair: 0xffb347, eye: 0x7cc7ff, blurb: 'Fast hands, faster mouth.' },
  { id: 'zero', name: 'ZERO', role: 'WRAITH', hair: 0xe6e0ff, eye: 0xff4a58, blurb: 'You will not see the second shot.' },
  { id: 'eos', name: 'EOS', role: 'ARCHANGEL', hair: 0xffd166, eye: 0xfff0c4, blurb: 'First light. Last word.' },
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
// free-for-all slots: one hue each
['#4aa0ff', '#ff4a58', '#ffd84a', '#5df2be', '#c58cff', '#ff9a3c', '#ff7ac8', '#e8f0ff'].forEach((css, i) => {
  const c = parseInt(css.slice(1), 16);
  TEAM['p' + i] = { name: 'P' + (i + 1), armor: c, armor2: 0x2a2f3a, glow: c, css };
});

// ---- geometry merging: many primitives -> one mesh per material ------------
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const BUCKET = { skin: 'body', suit: 'body', armor: 'body', armor2: 'body', gold: 'body', glow: 'body', hair: 'body', hair2: 'body', trim: 'skirt' };
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
  const W = 512, H = 308, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const ec = new THREE.Color(eye), light = ec.clone().lerp(new THREE.Color(1, 1, 1), 0.55), dark = ec.clone().multiplyScalar(0.35);
  const hex = (k) => '#' + k.getHexString();
  const ell = (x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); };
  for (const sx of [0.275, 0.725]) {
    const cx = W * sx, cy = 150, s = sx < 0.5 ? -1 : 1;
    g.save(); g.translate(cx, cy + 6); g.scale(1.32, 1.22); g.translate(-cx, -(cy + 6));
    // blush
    const bl = g.createRadialGradient(cx + s * 12, cy + 84, 2, cx + s * 12, cy + 84, 46); bl.addColorStop(0, 'rgba(255,110,140,.42)'); bl.addColorStop(1, 'rgba(255,110,140,0)');
    g.fillStyle = bl; g.fillRect(cx - 60, cy + 30, 130, 110);
    // brow
    g.strokeStyle = '#3a2233'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 44, cy - 92); g.quadraticCurveTo(cx + s * 2, cy - 112, cx + 46, cy - 90); g.stroke();
    // sclera
    const sc = g.createLinearGradient(0, cy - 62, 0, cy + 62); sc.addColorStop(0, '#c9c4d6'); sc.addColorStop(0.35, '#fffdff'); sc.addColorStop(1, '#ffffff');
    g.fillStyle = sc; ell(cx, cy, 52, 62); g.fill();
    // iris
    const ir = g.createLinearGradient(0, cy - 56, 0, cy + 62); ir.addColorStop(0, '#120a24'); ir.addColorStop(0.32, hex(dark.clone().lerp(ec, 0.7))); ir.addColorStop(0.7, hex(ec)); ir.addColorStop(1, hex(light));
    g.fillStyle = ir; ell(cx, cy + 6, 41, 57); g.fill();
    g.strokeStyle = 'rgba(10,4,24,.85)'; g.lineWidth = 4; ell(cx, cy + 6, 41, 57); g.stroke();
    g.fillStyle = '#0a0518'; ell(cx, cy + 8, 15, 29); g.fill();
    // highlights
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - 15, cy - 22, 14, 0, TAU); g.fill(); g.beginPath(); g.arc(cx + 15, cy + 30, 7, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(cx + 18, cy - 14); g.lineTo(cx + 21, cy - 6); g.lineTo(cx + 29, cy - 3); g.lineTo(cx + 21, cy); g.lineTo(cx + 18, cy + 8); g.lineTo(cx + 15, cy); g.lineTo(cx + 7, cy - 3); g.lineTo(cx + 15, cy - 6); g.closePath(); g.fill();
    // upper lash with a flick, lower lash
    g.strokeStyle = '#1b0f22'; g.lineWidth = 12; g.beginPath(); g.moveTo(cx - 58, cy - 20); g.quadraticCurveTo(cx, cy - 100, cx + 58, cy - 24); g.stroke();
    g.lineWidth = 7; g.beginPath(); g.moveTo(cx + s * 56, cy - 24); g.quadraticCurveTo(cx + s * 72, cy - 34, cx + s * 80, cy - 52); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 40, cy + 62); g.quadraticCurveTo(cx, cy + 74, cx + 40, cy + 62); g.stroke();
    g.restore();
  }
  g.fillStyle = 'rgba(160,90,90,.7)'; g.beginPath(); g.arc(W / 2, 214, 3.5, 0, TAU); g.fill();
  g.strokeStyle = '#b0505f'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(W / 2 - 24, 252); g.quadraticCurveTo(W / 2, 274, W / 2 + 24, 252); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2 - 8, 262); g.quadraticCurveTo(W / 2, 266, W / 2 + 8, 262); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
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
  const up = new Parts().add(cyl(0.04 * r, 0.035 * r, L1, 7), 'suit', 0, -L1 / 2, 0);
  up.add(sph(0.098 * r, 7, 5), 'armor2', 0, 0.03, 0, 0, 0, 0, 1.05, 0.8, 1.05).add(cyl(0.1 * r, 0.1 * r, 0.014, 8), 'gold', 0, -0.03 * r, 0).add(bx(0.06 * r, 0.03 * r, 0.05 * r), 'armor', 0, 0.09 * r, 0);
  arm.add(up.build(mats));
  const lo = new Parts().add(cyl(0.034 * r, 0.028 * r, L2, 7), 'suit', 0, -L2 / 2, 0);
  lo.add(cyl(0.05 * r, 0.044 * r, L2 * 0.55, 7), 'armor2', 0, -L2 * 0.42, 0).add(cyl(0.054 * r, 0.054 * r, 0.014, 7), 'gold', 0, -L2 * 0.16, 0).add(cyl(0.05 * r, 0.05 * r, 0.014, 7), 'gold', 0, -L2 * 0.68, 0);
  lo.add(bx(0.075 * r, 0.085 * r, 0.1 * r), 'suit', 0, -L2 - 0.02, 0).add(bx(0.014 * r, 0.014 * r, 0.06 * r), 'glow', 0, -L2 * 0.42, -0.05 * r);
  elbow.add(lo.build(mats));
  return { arm, elbow };
}

// ---- the waifu ------------------------------------------------------------------
export function makeMats(team, hair, eye) {
  const T = TEAM[team] || TEAM.blue;
  const M = (o) => new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.55, metalness: 0.15, ...o });
  const h1 = new THREE.Color(hair), hsl = {}; h1.getHSL(hsl);
  const h2 = new THREE.Color().setHSL((hsl.h + 0.06) % 1, Math.min(1, hsl.s * 0.95), Math.min(0.88, hsl.l + 0.17));
  return {
    skin: M({ color: 0xffe0d0, roughness: 0.75 }),
    suit: M({ color: 0x141926, roughness: 0.55, metalness: 0.25 }),
    armor: M({ color: T.armor, roughness: 0.4, metalness: 0.3 }),
    armor2: M({ color: 0xf3f1ec, roughness: 0.35, metalness: 0.3 }),
    gold: M({ color: 0xe9cb7c, roughness: 0.3, metalness: 0.7 }),
    glow: M({ color: 0x111111, emissive: T.glow, emissiveIntensity: 2.4, roughness: 0.3 }),
    hair: M({ color: h1, roughness: 0.45, metalness: 0.1 }),
    hair2: M({ color: h2, roughness: 0.45, metalness: 0.1 }),
    body: M({ vertexColors: true, roughness: 0.5, metalness: 0.2 }),
    skirt: M({ vertexColors: true, roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide }),
    _skirtColor: M({ color: 0xf1efea }),
    trim: M({ color: 0x111111, emissive: T.glow, emissiveIntensity: 2.2, side: THREE.DoubleSide }),
    visor: M({ color: 0xffd25a, metalness: 0.6, roughness: 0.2, emissive: 0xffa010, emissiveIntensity: 0.85 }),
    wing: new THREE.MeshBasicMaterial({ color: T.glow, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    halo: new THREE.MeshBasicMaterial({ color: 0xfff0c4, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    face: new THREE.MeshBasicMaterial({ map: faceTexture(eye), transparent: true, alphaTest: 0.05, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  };
}

const rnd01 = (() => { let sd = 3; return () => ((sd = (sd * 16807) % 2147483647) / 2147483647); })();

export function buildWaifu({ team = 'blue', hair = 0xff86c2, eye = 0x5ce1ff, scale = 1.04, helmet = false, angel = true, haloColor = null } = {}) {
  const mats = makeMats(team, hair, eye);
  if (haloColor != null) mats.halo.color.setHex(haloColor);
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const model = new THREE.Group(); model.scale.setScalar(scale); root.add(model);

  // ---- hips: pelvis, white hip plates with gold edging, belt with team buckle ----
  const hips = new THREE.Group(); hips.position.y = 0.96; model.add(hips);
  hips.add(new Parts().add(bx(0.26, 0.11, 0.18), 'suit')
    .add(bx(0.07, 0.15, 0.2), 'armor2', -0.16, -0.01, 0).add(bx(0.07, 0.15, 0.2), 'armor2', 0.16, -0.01, 0)
    .add(bx(0.075, 0.025, 0.205), 'gold', -0.16, 0.07, 0).add(bx(0.075, 0.025, 0.205), 'gold', 0.16, 0.07, 0)
    .add(bx(0.27, 0.03, 0.19), 'gold', 0, 0.07, 0).add(bx(0.085, 0.085, 0.035), 'armor', 0, 0.06, -0.105).add(bx(0.03, 0.03, 0.02), 'glow', 0, 0.06, -0.125)
    .add(bx(0.11, 0.2, 0.02), 'armor', 0, -0.08, 0.1).build(mats));
  const skirt = new THREE.Group(); skirt.position.y = -0.03; hips.add(skirt);
  skirt.add(new Parts()
    .add(new THREE.CylinderGeometry(0.15, 0.235, 0.13, 10, 1, true), 'skirt', 0, -0.055, 0)
    .add(new THREE.CylinderGeometry(0.225, 0.29, 0.1, 10, 1, true), 'skirt', 0, -0.165, 0)
    .add(new THREE.CylinderGeometry(0.236, 0.241, 0.018, 10, 1, true), 'trim', 0, -0.12, 0)
    .add(new THREE.CylinderGeometry(0.291, 0.296, 0.018, 10, 1, true), 'trim', 0, -0.213, 0).build(mats, false));

  // ---- legs: thigh-high stockings, skin band, white armored boots with gold + glow ----
  const mkLeg = (sd) => {
    const leg = new THREE.Group(); leg.position.set(0.09 * sd, -0.04, 0); hips.add(leg);
    leg.add(new Parts().add(cyl(0.072, 0.07, 0.1, 8), 'skin', 0, -0.06, 0).add(cyl(0.07, 0.056, 0.36, 8), 'suit', 0, -0.29, 0).add(cyl(0.075, 0.075, 0.016, 8), 'gold', 0, -0.115, 0)
      .add(bx(0.045, 0.2, 0.105), 'armor2', 0.068 * sd, -0.22, -0.01).add(bx(0.014, 0.16, 0.02), 'glow', 0.094 * sd, -0.22, -0.01).add(bx(0.05, 0.02, 0.11), 'gold', 0.068 * sd, -0.32, -0.01).build(mats));
    const knee = new THREE.Group(); knee.position.y = -0.45; leg.add(knee);
    knee.add(new Parts().add(cyl(0.055, 0.036, 0.42, 8), 'suit', 0, -0.21, 0).add(sph(0.058, 7, 5), 'armor2', 0, 0.0, -0.035)
      .add(bx(0.088, 0.27, 0.09), 'armor2', 0, -0.2, -0.04).add(bx(0.092, 0.025, 0.094), 'gold', 0, -0.075, -0.04).add(bx(0.068, 0.03, 0.068), 'armor', 0, -0.09, 0.03)
      .add(bx(0.09, 0.07, 0.2), 'armor2', 0, -0.455, -0.045).add(bx(0.055, 0.03, 0.05), 'gold', 0, -0.48, 0.06).add(bx(0.06, 0.012, 0.012), 'glow', 0, -0.435, -0.146).build(mats));
    return { leg, knee };
  };
  const L = mkLeg(-1), R = mkLeg(1);

  // ---- torso: corseted waist, slim white plate with gold trim and a team gem, wing mount ----
  const spine = new THREE.Group(); spine.position.y = 0.06; hips.add(spine);
  spine.add(new Parts().add(cyl(0.082, 0.098, 0.15, 8), 'suit', 0, 0.075, 0).add(bx(0.028, 0.14, 0.02), 'gold', 0, 0.075, -0.085).add(bx(0.2, 0.03, 0.15), 'gold', 0, 0.02, 0).build(mats));
  const chest = new THREE.Group(); chest.position.y = 0.14; spine.add(chest);
  chest.add(new Parts().add(cyl(0.118, 0.108, 0.27, 8), 'suit', 0, 0.13, 0, 0, 0, 0, 1, 1, 0.78)
    .add(bx(0.235, 0.14, 0.07), 'armor2', 0, 0.165, -0.082).add(bx(0.245, 0.018, 0.076), 'gold', 0, 0.238, -0.082).add(bx(0.05, 0.075, 0.02), 'glow', 0, 0.165, -0.12).add(bx(0.09, 0.05, 0.05), 'armor', 0, 0.09, -0.085)
    .add(cyl(0.05, 0.062, 0.05, 8), 'armor2', 0, 0.275, 0).add(cyl(0.03, 0.035, 0.08, 6), 'skin', 0, 0.31, 0)
    .add(bx(0.15, 0.17, 0.05), 'armor2', 0, 0.16, 0.1).add(bx(0.03, 0.12, 0.02), 'glow', -0.045, 0.16, 0.14).add(bx(0.03, 0.12, 0.02), 'glow', 0.045, 0.16, 0.14)
    .add(bx(0.05, 0.035, 0.03), 'armor', -0.035, 0.235, -0.1, 0, 0, 0.3).add(bx(0.05, 0.035, 0.03), 'armor', 0.035, 0.235, -0.1, 0, 0, -0.3).build(mats));

  // wings: blades of light fanned off the back mount
  const wingRig = {};
  for (const sd of [-1, 1]) {
    const grp = new THREE.Group(); grp.position.set(0.055 * sd, 0.2, 0.14); chest.add(grp);
    const wp = new Parts(), lens = [0.7, 0.6, 0.48, 0.36];
    lens.forEach((len, i) => { const g = new THREE.CylinderGeometry(0.004, 0.05 - i * 0.006, len, 4); g.translate(0, len / 2, 0); wp.add(g, 'wing', 0, 0, 0, 0.5, 0, -sd * (0.18 + i * 0.26), 1, 1, 0.22); });
    grp.add(wp.build(mats, false)); wingRig[sd < 0 ? 'L' : 'R'] = grp;
  }

  // ---- head ----
  const head = new THREE.Group(); head.position.y = 0.33; head.scale.setScalar(1.16); chest.add(head);
  const hp = new Parts();
  hp.add(sph(0.122, 12, 10), 'skin', 0, 0.12, 0, 0, 0, 0, 0.94, 1.05, 0.98).add(sph(0.05, 8, 6), 'skin', 0, 0.05, -0.07, 0, 0, 0, 0.9, 0.8, 0.9);
  for (const sd of [-1, 1]) {
    hp.add(new THREE.ConeGeometry(0.02, 0.06, 4), 'skin', 0.118 * sd, 0.115, 0, 0, 0, -sd * Math.PI / 2);
    hp.add(cyl(0.045, 0.045, 0.03, 10), 'armor2', 0.135 * sd, 0.115, 0, 0, 0, Math.PI / 2).add(cyl(0.05, 0.05, 0.008, 10), 'gold', 0.15 * sd, 0.115, 0, 0, 0, Math.PI / 2).add(cyl(0.024, 0.024, 0.02, 8), 'glow', 0.155 * sd, 0.115, 0, 0, 0, Math.PI / 2);
  }
  hp.add(sph(0.14, 10, 8), 'hair', 0, 0.09, 0.065, 0, 0, 0, 1.02, 1.3, 0.95);
  if (!helmet) {
    hp.add(new THREE.SphereGeometry(0.15, 12, 9, 0, TAU, 0, Math.PI * 0.44), 'hair', 0, 0.135, 0.012, -0.12, 0, 0);
    for (let i = -4; i <= 4; i++) {
      const a_ = i * 0.2, len = 0.085 - Math.abs(i) * 0.004 + (i === -3 ? 0.04 : 0), x = Math.sin(a_) * 0.132, y = 0.212 - Math.abs(i) * 0.012, z = -Math.cos(a_) * 0.12;
      hp.add(new THREE.ConeGeometry(0.03, len, 4), 'hair', x, y, z, Math.PI + 0.35, 0, -a_ * 0.5);
      hp.add(new THREE.ConeGeometry(0.018, 0.05, 4), 'hair2', x * 1.02, y - len * 0.6, z - 0.02, Math.PI + 0.35, 0, -a_ * 0.5);
    }
    for (const sd of [-1, 1]) hp.add(bx(0.032, 0.2, 0.05), 'hair', 0.13 * sd, 0.03, -0.03).add(bx(0.03, 0.12, 0.045), 'hair2', 0.13 * sd, -0.13, -0.03);
    hp.add(new THREE.TorusGeometry(0.05, 0.007, 4, 8, Math.PI * 1.3), 'hair2', 0.02, 0.29, -0.02, 0.2, 0, 0.5);
    hp.add(new THREE.TorusGeometry(0.135, 0.006, 4, 16, Math.PI * 0.75), 'gold', 0, 0.12, -0.028, 0.06, 0, Math.PI * 0.125).add(bx(0.03, 0.045, 0.02), 'glow', 0, 0.255, -0.135, 0.5, 0, 0);
    hp.add(new THREE.OctahedronGeometry(0.03, 0), 'gold', 0.108, 0.235, -0.08).add(sph(0.014, 5, 4), 'glow', 0.108, 0.235, -0.11);
  } else {
    hp.add(sph(0.158, 10, 8), 'armor2', 0, 0.125, 0.006, 0, 0, 0, 1.0, 1.02, 1.1);
    hp.add(new THREE.SphereGeometry(0.166, 12, 8, Math.PI * 1.5 - 0.95, 1.9, 1.02, 0.72), 'visor', 0, 0.125, 0.0, 0, 0, 0, 1.0, 1.02, 1.1);
    hp.add(bx(0.17, 0.075, 0.1), 'gold', 0, 0.02, -0.085).add(bx(0.035, 0.06, 0.24), 'gold', 0, 0.29, 0.0).add(bx(0.2, 0.03, 0.05), 'armor', 0, 0.215, -0.11);
    for (const sd of [-1, 1]) hp.add(bx(0.03, 0.07, 0.11), 'armor', 0.155 * sd, 0.06, -0.06);
  }
  head.add(hp.build(mats));
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.1235, 0.1235, 0.145, 16, 1, true, Math.PI - 0.95, 1.9), mats.face);
  face.position.y = 0.118; face.visible = !helmet; head.add(face);
  const halo = new THREE.Group(); halo.position.set(0, 0.44, 0.02); halo.rotation.x = 0.16; head.add(halo);
  halo.add(new Parts().add(new THREE.TorusGeometry(0.17, 0.007, 6, 32), 'halo', 0, 0, 0, Math.PI / 2, 0, 0).add(new THREE.TorusGeometry(0.205, 0.0035, 4, 32), 'halo', 0, 0.012, 0, Math.PI / 2, 0, 0).build(mats, false));

  // kill-leader crown (shown by the match on whoever leads)
  const crown = new THREE.Group(); crown.position.set(0, 0.24, 0); crown.visible = false; head.add(crown);
  { const cp = new Parts().add(new THREE.TorusGeometry(0.088, 0.01, 4, 14), 'gold', 0, 0, 0, Math.PI / 2, 0, 0);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; cp.add(new THREE.ConeGeometry(0.017, 0.07 + (i % 2) * 0.025, 4), 'gold', Math.cos(a) * 0.088, 0.04 + (i % 2) * 0.012, Math.sin(a) * 0.088); }
    cp.add(sph(0.014, 5, 4), 'glow', 0, 0.03, -0.088);
    const cm = new THREE.MeshStandardMaterial({ color: 0xffd84a, emissive: 0xffa010, emissiveIntensity: 1.0, metalness: 0.6, roughness: 0.3, flatShading: true });
    const cg = cp.build(mats, false); cg.traverse((o) => { if (o.isMesh) o.material = cm; }); crown.add(cg); crown.scale.setScalar(1.45); }

  // long back hair + twin tails
  const backHair = new THREE.Group(); backHair.position.set(0, 0.11, 0.09); head.add(backHair);
  backHair.add(new Parts().add(cyl(0.1, 0.085, 0.3, 8), 'hair', 0, -0.15, 0, 0, 0, 0, 1, 1, 0.62).build(mats, false));
  const bh2 = new THREE.Group(); bh2.position.y = -0.3; backHair.add(bh2);
  bh2.add(new Parts().add(cyl(0.085, 0.05, 0.3, 8), 'hair', 0, -0.15, 0, 0, 0, 0, 1, 1, 0.55).add(new THREE.ConeGeometry(0.05, 0.16, 6), 'hair2', 0, -0.36, 0, Math.PI, 0, 0, 1, 1, 0.55).build(mats, false));
  const tails = [];
  for (const sd of [-1, 1]) {
    const t1 = new THREE.Group(); t1.position.set(0.135 * sd, 0.235, 0.06); head.add(t1); t1.rotation.z = -0.5 * sd; t1.rotation.x = 0.15;
    t1.add(new Parts().add(cyl(0.056, 0.05, 0.26, 7), 'hair', 0, -0.13, 0).add(new THREE.OctahedronGeometry(0.05, 0), 'armor', 0, 0.02, 0, 0, 0, 0, 1.5, 0.85, 1).add(sph(0.018, 5, 4), 'gold', 0, 0.02, -0.055).build(mats, false));
    const t2 = new THREE.Group(); t2.position.y = -0.26; t1.add(t2);
    t2.add(new Parts().add(cyl(0.05, 0.042, 0.26, 7), 'hair', 0, -0.13, 0).build(mats, false));
    const t3 = new THREE.Group(); t3.position.y = -0.26; t2.add(t3);
    t3.add(new Parts().add(cyl(0.042, 0.032, 0.14, 7), 'hair', 0, -0.07, 0).add(new THREE.ConeGeometry(0.034, 0.26, 7), 'hair2', 0, -0.27, 0, Math.PI, 0, 0).build(mats, false));
    tails.push({ t1, t2, t3, s: sd });
  }

  const aL = makeArm(mats, 0.28, 0.3), aR = makeArm(mats, 0.28, 0.3);
  aL.arm.position.set(-0.19, 0.2, 0); aR.arm.position.set(0.19, 0.2, 0);
  chest.add(aL.arm, aR.arm);

  const wRoot = new THREE.Group(); wRoot.position.set(0.09, 0.08, -0.06); chest.add(wRoot);
  const rig = {
    root, model, hips, spine, chest, head, skirt, crown, tails, backHair, bh2, halo, wings: wingRig, legL: L.leg, kneeL: L.knee, legR: R.leg, kneeR: R.knee, aL, aR, wRoot, mats,
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
  rig.setStyle = () => {};
  rig.helmet = helmet;
  rig._camo = 0;
  rig.setCamo = (k) => {
    if (rig._camo === k) return; rig._camo = k;
    if (rig.sam) angelCamo(rig, k);
    for (const key of ['body', 'skirt', 'visor', 'face', 'wing', 'halo']) { const m = mats[key]; if (!m) continue; m.transparent = k > 0 || key === 'face' || key === 'wing' || key === 'halo'; m.opacity = key === 'wing' ? (k > 0 ? 0.03 : 0.6) : key === 'halo' ? (k > 0 ? 0.04 : 0.95) : k > 0 ? (k >= 1 ? 0.07 : 0.4) : 1; m.depthWrite = k === 0 && key !== 'wing' && key !== 'halo'; m.needsUpdate = true; }
  };
  rig.setVisible = (v) => { root.visible = v; };
  if (angel && !helmet && angelReady()) attachAngel(rig, { hair, tint: (TEAM[team] || TEAM.blue).glow });
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
    t.t1.rotation.z = -0.5 * t.s + Math.sin(a.t * 1.7 + o) * 0.06 + lx * 0.25 * sp * t.s;
    t.t2.rotation.x = -sp * 0.3 * lz + Math.sin(a.t * 2.6 + o + 0.8) * 0.14 - air * 0.3;
    t.t3.rotation.x = -sp * 0.25 * lz + Math.sin(a.t * 3.1 + o + 1.6) * 0.18;
  }
  rig.skirt.scale.set(1 + sp * 0.06 + cr * 0.1 + air * 0.08, 1 - cr * 0.15, 1 + sp * 0.06 + cr * 0.1 + air * 0.08);
  rig.skirt.rotation.x = 0.05 * sp * lz + Math.sin(ph * 2) * 0.03 * sp;

  // weapon + arms (IK toward weapon grips)
  const w = rig.weapon;
  if (w) {
    const melee = s.melee || 0, throwT = s.throwT || 0;
    rig.wRoot.position.set(0.09, 0.07, -0.06 + a.kick * 0.06 - (s.reloading ? 0.02 : 0));
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

  // cyber-angel extras: floating halo, wings, long hair
  if (rig.halo) { rig.halo.position.y = (rig.haloY ?? 0.44) + Math.sin(a.t * 1.8) * 0.012; rig.halo.rotation.y += dt * 0.9; }
  if (rig.wings) { const sprd = 0.2 + sp * 0.22 + air * 0.35 + Math.sin(a.t * 1.7) * 0.035 + a.dead * 0.3; rig.wings.L.rotation.z = sprd; rig.wings.R.rotation.z = -sprd; rig.wings.L.rotation.x = rig.wings.R.rotation.x = -sp * 0.2 * lz + Math.sin(a.t * 1.3) * 0.03; }
  if (rig.backHair) { rig.backHair.rotation.x = -sp * 0.4 * lz + Math.sin(a.t * 1.9) * 0.05 - air * 0.35 + a.flinch * 0.2; rig.bh2.rotation.x = -sp * 0.3 * lz + Math.sin(a.t * 2.5 + 1) * 0.09; rig.backHair.rotation.z = lx * 0.2 * sp; }
  rig.setCamo(s.camo || 0);
  // hit flash / power-up glow
  if (rig.flash <= 0 && s.boost) { const e = 0.28 + Math.sin(a.t * 6) * 0.1; rig.mats.body.emissive.setRGB(e, e * 0.4, 0.02); }
  else if (rig.flash > 0) {
    rig.flash = Math.max(0, rig.flash - dt * 6);
    const e = rig.flash * 1.4;
    rig.mats.body.emissive.setRGB(e * 0.8, e * 0.8, e * 0.8);
  } else if (rig.mats.body.emissive.r > 0) { rig.mats.body.emissive.setRGB(0, 0, 0); }
  if (rig.sam) syncAngel(rig, s);
}

export function disposeRig(rig) {
  rig.root.traverse((o) => { if (o.isMesh && !o.geometry.userData.shared) o.geometry.dispose(); });
  if (rig.sam) rig.sam.mat.dispose();
  Object.values(rig.mats).forEach((m) => m.dispose && m.dispose());
}
