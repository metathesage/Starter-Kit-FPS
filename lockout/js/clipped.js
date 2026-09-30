// Authored, animated operators: a real skeleton with real clips (idle, walk, jog, sprint, crouch, jump, aim, shoot, reload, death).
// Lower body and upper body play separate clip sets, so legs follow locomotion while the arms hold the aim pose.
// The procedural rig stays underneath as the state holder (weapon, flash, camo), exactly like the scanned operators.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from '../vendor/jsm/utils/SkeletonUtils.js';
import { toonGradient, outlineSkinned } from './toon.js';

const LOWER = { idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop', cIdle: 'Crouch_Idle_Loop', cWalk: 'Crouch_Fwd_Loop', jump: 'Jump_Loop' };
const UPPER = { aim: 'Pistol_Aim_Neutral', shoot: 'Pistol_Shoot', reload: 'Pistol_Reload' };
const REF = { walk: 1.7, jog: 5.0, sprint: 7.4, cWalk: 2.4 };   // ground speed each clip roughly matches
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export async function loadRigged(id, cfg, fetchGltf) {
  const g = await fetchGltf(new GLTFLoader(), cfg.url);
  g.scene.updateMatrixWorld(true);
  // units differ per model (cm, m, arbitrary), so size from the skeleton: neck-base height over foot height
  // (the bind pose is not the standing pose in these files, so pose the skeleton on the first frame of Idle first)
  { const idle = g.animations.find((a) => a.name === 'Idle_Loop') || g.animations[0]; if (idle) { const mx = new THREE.AnimationMixer(g.scene); mx.clipAction(idle).play(); mx.update(0); g.scene.updateMatrixWorld(true); mx.stopAllAction(); mx.uncacheRoot(g.scene); } }
  const bn = {}; g.scene.traverse((o) => { if (o.isBone) bn[o.name] = o; });
  const wy = (b) => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).y;
  const headY = bn.Head ? wy(bn.Head) : 1, toeY = Math.min(bn.LeftToes ? wy(bn.LeftToes) : 0, bn.RightToes ? wy(bn.RightToes) : 0, bn.LeftFoot ? wy(bn.LeftFoot) : 0);
  const h = Math.max(1e-3, (headY - toeY) / 0.84), floor = toeY - 0.03 * h;
  const box = { min: { y: floor } };
  const clips = {}; for (const c of g.animations) clips[c.name] = c;
  return { id, cfg, clipped: true, gltf: g, scale: cfg.S / h, feet: floor, clips };
}

function toonFrom(src, tint, glow) {
  const map = src.map || null;
  const m = new THREE.MeshToonMaterial({ map, gradientMap: toonGradient(), side: THREE.DoubleSide, emissive: new THREE.Color(0x000000) });
  if (src.color) m.color.copy(src.color);
  if (src.transparent || src.alphaTest > 0) m.alphaTest = src.alphaTest > 0 ? src.alphaTest : 0.4;
  const em = src.emissiveMap || map; if (em) m.emissiveMap = em; m.emissive.setScalar(src.emissiveMap ? 1 : glow);
  const rimC = new THREE.Color(tint);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: rimC };
    sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n float rimK = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.6);\n totalEmissiveRadiance += uRim * rimK * 0.75;');
  };
  m.customProgramCacheKey = () => 'rimtoon';
  return m;
}

const sub = (clip, keep, suffix) => new THREE.AnimationClip(clip.name + suffix, clip.duration, clip.tracks
  .filter((t) => { const n = t.name.split('.')[0]; if (/rootJoint|^jx_/.test(n) && t.name.endsWith('.position')) return false; return keep(n); })
  .map((t) => t.clone()));

export function attachClipped(rig, cache, { tint = 0x4aa0ff } = {}) {
  const cfg = cache.cfg, root = SkeletonUtils.clone(cache.gltf.scene);
  const holder = new THREE.Group(); holder.rotation.y = Math.PI; holder.scale.setScalar(cache.scale); holder.position.y = -cache.feet * cache.scale;
  holder.add(root); rig.model.add(holder);
  const meshes = []; root.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  const mats = [], ink = new THREE.Group();
  for (const m of meshes) {
    const src = m.material; const t = toonFrom(src, tint, cfg.glow ?? 0.3);
    m.material = t; mats.push(t); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = false;
  }
  root.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) o.visible = false; });
  const inks = [];
  for (const m of meshes) if (m.geometry.index && m.geometry.index.count > 2400) { try { inks.push(outlineSkinned(m, { width: cfg.ink ?? 0.006 })); } catch (e) { /* outline is cosmetic */ } }
  // hide the classic body (weapon root and halo handled below)
  rig.model.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && !o.userData.outline && !holder.children.includes(o)) { let p = o, inside = false; while (p) { if (p === holder) inside = true; p = p.parent; } if (!inside) o.visible = false; } });
  rig.halo.visible = false;
  // skeleton split: everything under Spine is upper body
  const bones = {}; root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const upper = new Set(); if (bones.Spine) bones.Spine.traverse((o) => upper.add(o.name));
  const mixer = new THREE.AnimationMixer(root), A = { lo: {}, up: {} };
  for (const [k, n] of Object.entries(LOWER)) { const c = cache.clips[n]; if (c) A.lo[k] = mixer.clipAction(sub(c, (b) => !upper.has(b), '_lo')); }
  for (const [k, n] of Object.entries(UPPER)) { const c = cache.clips[n]; if (c) A.up[k] = mixer.clipAction(sub(c, (b) => upper.has(b), '_up')); }
  const dc = cache.clips.Death01; if (dc) { A.death = mixer.clipAction(sub(dc, () => true, '_full')); A.death.setLoop(THREE.LoopOnce, 1); A.death.clampWhenFinished = true; }
  for (const a of Object.values(A.lo)) { a.setEffectiveWeight(0); a.play(); }
  for (const a of Object.values(A.up)) { a.setEffectiveWeight(0); a.play(); }
  if (A.up.aim) A.up.aim.setEffectiveWeight(1);
  if (A.lo.idle) A.lo.idle.setEffectiveWeight(1);
  // weapon: re-parent the procedural weapon root to the right hand
  const hand = bones.ja_r_propHand || bones.ja_c_propGun || bones.RightHand;
  if (hand && rig.wRoot) {
    hand.add(rig.wRoot); rig.wRoot.position.set(...(cfg.gunPos || [0, 0, 0])); rig.wRoot.rotation.set(...(cfg.gunRot || [0, 0, 0])); rig.wRoot.scale.setScalar((cfg.gunScale || 1) / (cache.scale || 1));
  }
  rig.crown.position.y = cfg.S * 0.6;
  rig.sam = { clip: { mixer, A, cur: 'idle', dead: false, rw: 0, bones, root, holder, hand }, mesh: meshes[0], ink: { set visible(v) { for (const o of inks) o.visible = v; }, get visible() { return inks.length ? inks[0].visible : true; } }, mats, mat: mats[0], base: cfg.glow ?? 0.3, cfg, model: cache.id };
  return true;
}

const qP = new THREE.Quaternion(), AX = new THREE.Vector3(1, 0, 0);
export function syncClipped(rig, s, dt) {
  const S = rig.sam, C = S.clip, A = C.A;
  const speed = s.speed || 0;
  if (s.dead && !C.dead && A.death) {
    C.dead = true;
    for (const a of [...Object.values(A.lo), ...Object.values(A.up)]) a.fadeOut(0.12);
    A.death.reset().setEffectiveWeight(1).fadeIn(0.08).play();
  } else if (!s.dead && C.dead) {
    C.dead = false; if (A.death) A.death.fadeOut(0.15);
    for (const a of Object.values(A.lo)) a.setEffectiveWeight(0); for (const a of Object.values(A.up)) a.setEffectiveWeight(0);
    C.cur = ''; if (A.up.aim) A.up.aim.reset().setEffectiveWeight(1).play();
  }
  if (!C.dead) {
    let want;
    if (!s.grounded && A.lo.jump) want = 'jump';
    else if (s.crouch > 0.5) want = speed > 0.4 ? 'cWalk' : 'cIdle';
    else if (speed < 0.35) want = 'idle'; else if (speed < 3.4) want = 'walk'; else if (speed < 6.4) want = 'jog'; else want = 'sprint';
    if (want !== C.cur && A.lo[want]) {
      const prev = A.lo[C.cur], next = A.lo[want];
      if (prev) prev.fadeOut(0.16);
      next.reset().setEffectiveWeight(1).fadeIn(0.16).play(); C.cur = want;
    }
    const cur = A.lo[C.cur];
    if (cur && REF[C.cur]) cur.timeScale = Math.max(0.6, Math.min(1.6, speed / REF[C.cur])) * (s.lz < -0.35 ? -1 : 1);
    C.rw = damp(C.rw, s.reloading ? 1 : 0, 10, dt);
    if (A.up.aim) A.up.aim.setEffectiveWeight(Math.max(0.001, 1 - C.rw));
    if (A.up.reload) A.up.reload.setEffectiveWeight(C.rw);
    if (A.up.shoot) A.up.shoot.setEffectiveWeight(Math.min(1, (s.firing || 0) * 1.4) * (1 - C.rw));
  }
  C.mixer.update(dt);
  // aim: tilt the torso toward the view pitch after the clips have posed it
  if (!C.dead) {
    const p = (s.pitch || 0) * 0.34;
    for (const n of ['Spine', 'Chest', 'UpperChest']) { const b = C.bones[n]; if (b) { qP.setFromAxisAngle(AX, -p); b.quaternion.multiply(qP); } }
  }
  const e = rig.mats.body.emissive; for (const m of S.mats) m.emissive.setRGB(S.base + e.r, S.base + e.g, S.base + e.b);
}
