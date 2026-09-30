// SANCTUM visuals: utopian art-deco plaza. White marble, gold inlay, fluted columns, sunburst arches, reflecting pool with fountains,
// marble goddesses (the operator model carved in stone) and armoured guardians, a deco skyline and an orbital ring.
import * as THREE from 'three';
import { mergeStatic } from './merge.js';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js';
import { bevelGeo, normalMap, tufts, vines, mossRock, trunkGeo, glowSprite, wind, rnd, seedKit, grassCard, barkSet } from './mapkit.js';
import { POI } from './hubmap.js';
import { buildWaifu, animateRig } from './rig.js';
import { syncAngel } from './angel.js';

const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rr = (a, b) => a + rnd() * (b - a);
const cvs = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
const ctex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
const damp2 = (a, b, k) => { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * Math.min(1, k); };

// ------------------------------------------------------------ textures
function marbleCanvas(base = '#ece8e0', gold = true, size = 256) {
  return cvs(size, size, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '120,120,130' : '255,255,255'},${Math.random() * 0.06})`; g.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 6, 1 + Math.random() * 3); }
    g.strokeStyle = 'rgba(96,98,112,.17)'; g.lineWidth = 1.3;
    for (let i = 0; i < 7; i++) { g.beginPath(); let x = Math.random() * s, y = 0; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 60; y += s / 6; g.lineTo(x, y); } g.stroke(); }
    if (gold) { g.strokeStyle = '#d6ae66'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, s - 3, s - 3); g.lineWidth = 1.4; g.strokeRect(9, 9, s - 18, s - 18); g.beginPath(); g.moveTo(s / 2, 9); g.lineTo(s / 2, s - 9); g.moveTo(9, s / 2); g.lineTo(s - 9, s / 2); g.stroke(); }
  });
}
function lawnCanvas() {
  return cvs(256, 256, (g, s) => {
    g.fillStyle = '#5f9560'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 64) { g.fillStyle = 'rgba(255,255,255,.055)'; g.fillRect(0, y, s, 32); }
    for (let i = 0; i < 2400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '30,80,40' : '170,210,120'},${Math.random() * 0.14})`; g.fillRect(Math.random() * s, Math.random() * s, 1, 2 + Math.random() * 3); }
  });
}
function sunburstCanvas() {
  return cvs(1024, 1024, (g, s) => {
    g.translate(s / 2, s / 2);
    const disc = (r, c) => { g.fillStyle = c; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); };
    disc(510, '#e9e4da'); disc(470, '#d9b26a'); disc(462, '#f2eee6'); disc(300, '#d9b26a'); disc(294, '#efe9de'); disc(120, '#d9b26a'); disc(112, '#1c2230');
    g.fillStyle = '#d9b26a'; for (let i = 0; i < 24; i++) { g.save(); g.rotate((i / 24) * TAU); g.beginPath(); g.moveTo(130, -9); g.lineTo(290, -18); g.lineTo(290, 18); g.lineTo(130, 9); g.closePath(); g.fill(); g.restore(); }
    g.fillStyle = '#1c2230'; for (let i = 0; i < 24; i++) { g.save(); g.rotate(((i + 0.5) / 24) * TAU); g.beginPath(); g.moveTo(310, -6); g.lineTo(456, -22); g.lineTo(456, 22); g.lineTo(310, 6); g.closePath(); g.fill(); g.restore(); }
    g.strokeStyle = '#d9b26a'; g.lineWidth = 6; for (let i = 0; i < 48; i++) { g.save(); g.rotate((i / 48) * TAU); g.beginPath(); g.moveTo(472, 0); g.lineTo(500, 0); g.stroke(); g.restore(); }
  });
}
const sigilTex = () => ctex(cvs(256, 256, (g, s) => {
  g.fillStyle = '#10141c'; g.fillRect(0, 0, s, s); g.translate(s / 2, s / 2); g.strokeStyle = '#e7c27a'; g.lineWidth = 4;
  for (let r = 100; r > 30; r -= 22) { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); }
  g.lineWidth = 3; for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.beginPath(); g.moveTo(34, 0); g.lineTo(100, 0); g.stroke(); }
  g.fillStyle = '#7fe6ff'; g.beginPath(); g.arc(0, 0, 18, 0, TAU); g.fill(); g.lineWidth = 6; g.strokeStyle = '#7fe6ff'; g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.lineTo(Math.cos(a) * 46, Math.sin(a) * 46); } g.closePath(); g.stroke();
}));
function fishCard() {
  return ctex(cvs(64, 128, (g, w, h) => {
    const body = ['#ff8a3a', '#f5f0e8', '#e8552a'][(Math.random() * 3) | 0];
    g.fillStyle = body; g.beginPath(); g.ellipse(w / 2, h * 0.42, 15, 36, 0, 0, TAU); g.fill();
    g.fillStyle = '#f5f0e8'; g.beginPath(); g.ellipse(w / 2 - 4, h * 0.36, 8, 14, 0.2, 0, TAU); g.fill();
    g.fillStyle = body; g.beginPath(); g.moveTo(w / 2, h * 0.72); g.quadraticCurveTo(w / 2 - 22, h * 0.95, w / 2 - 12, h); g.lineTo(w / 2 + 12, h); g.quadraticCurveTo(w / 2 + 22, h * 0.95, w / 2, h * 0.72); g.fill();
  }));
}
function blossomCard() {
  return ctex(cvs(128, 128, (g, w, h) => {
    for (let i = 0; i < 110; i++) {
      const x = 14 + Math.random() * (w - 28), y = 14 + Math.random() * (h - 28), d = Math.hypot(x - w / 2, y - h / 2); if (d > 56) continue;
      const r = 5 + Math.random() * 6; g.fillStyle = ['#ffd3e1', '#ffb7cf', '#fff0f5', '#ffc4d8'][i % 4]; g.globalAlpha = 0.85 + Math.random() * 0.15;
      for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + i; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55, r * 0.4, a, 0, TAU); g.fill(); }
      g.globalAlpha = 1; g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill();
    }
  }));
}

// ------------------------------------------------------------ statues
export function makeMarbles() {
  const map = ctex(marbleCanvas('#f1eee8', false, 256));
  return {
    marble: new THREE.MeshStandardMaterial({ color: 0xf4f1ec, map, roughness: 0.26, metalness: 0.04, envMapIntensity: 1.3 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd8b060, roughness: 0.28, metalness: 0.95, envMapIntensity: 1.5 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xf4f1ec, roughness: 0.3, metalness: 0.02 }),
  };
}
// the operator model, carved: marble skin, gold halo, no outline, frozen in a pose
export function marbleize(rig, M, pose = 'still') {
  for (let i = 0; i < 24; i++) animateRig(rig, 0.05, { speed: 0, lx: 0, lz: 1, grounded: true, crouch: 0, pitch: 0, weaponId: null });
  if (rig.sam) {
    const A = rig.aR.arm, B = rig.aL.arm;
    if (pose === 'raise') { A.rotation.set(-2.5, 0, -0.35); B.rotation.set(-0.5, 0, 0.35); }
    else if (pose === 'offer') { A.rotation.set(-1.3, 0, -0.25); B.rotation.set(-1.3, 0, 0.25); }
    else if (pose === 'reach') { A.rotation.set(-1.9, 0, -0.9); B.rotation.set(0.1, 0, 0.3); }
    if (pose !== 'still') syncAngel(rig, {});
    rig.sam.mesh.material = M.marble; if (rig.sam.ink) rig.sam.ink.visible = false;
  }
  rig.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.userData.outline) o.visible = false; } });
  if (rig.halo) { rig.halo.traverse((o) => { if (o.isMesh) { o.material = new THREE.MeshBasicMaterial({ color: 0xffe2a0, fog: false }); } }); }
  return rig;
}
function goddess(M, pose, scale = 1.7) {
  const rig = buildWaifu({ team: 'blue', hair: 0xffffff, eye: 0xffffff, helmet: false, haloColor: 0xffdf9a }); rig.setWeapon(null);
  marbleize(rig, M, pose); rig.root.scale.setScalar(scale); rig.root.userData.kind = 'goddess'; return rig.root;
}
// guardian: cuirass, greaves, crested helm, tower shield and spear, all marble with gold trim
function guardian(M) {
  const g = new THREE.Group(), m = M.marble, au = M.gold;
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; };
  const B = (w, h, d, r = 0.03) => bevelGeo(-w / 2, w / 2, -h / 2, h / 2, -d / 2, d / 2, r, 2);
  const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
  for (const sx of [-1, 1]) {
    add(B(0.3, 0.16, 0.5, 0.05), m, sx * 0.2, 0.08, -0.06);                              // sabaton
    add(cyl(0.11, 0.15, 1.05, 10), m, sx * 0.2, 0.7, 0);                                  // greave
    add(new THREE.SphereGeometry(0.15, 10, 8), au, sx * 0.2, 1.26, 0.03);                 // knee cop
    add(cyl(0.17, 0.12, 0.95, 10), m, sx * 0.2, 1.8, 0);                                  // thigh
  }
  const skirt = add(new THREE.CylinderGeometry(0.34, 0.56, 0.75, 16, 1, true), m, 0, 2.28, 0); skirt.material = new THREE.MeshStandardMaterial({ color: 0xf4f1ec, roughness: 0.28, side: THREE.DoubleSide });
  add(B(0.62, 0.16, 0.36, 0.05), au, 0, 2.3, 0);                                         // belt
  add(cyl(0.3, 0.36, 0.95, 10), m, 0, 2.95, 0).scale.set(1, 1, 0.68);                    // waist taper
  add(B(0.78, 0.66, 0.42, 0.14), m, 0, 3.32, 0);                                         // chest plate
  add(B(0.16, 1.05, 0.05, 0.015), au, 0, 3.0, -0.23);                                    // sternum trim
  for (const sx of [-1, 1]) {
    add(new THREE.SphereGeometry(0.22, 12, 8, 0, TAU, 0, Math.PI * 0.62), m, sx * 0.5, 3.58, 0);   // pauldron
    add(new THREE.TorusGeometry(0.2, 0.025, 6, 20), au, sx * 0.5, 3.5, 0, Math.PI / 2, 0, 0);
    add(cyl(0.085, 0.07, 0.78, 8), m, sx * 0.58, 3.08, 0.03, 0, 0, sx * 0.04);              // arm
    add(new THREE.SphereGeometry(0.085, 8, 6), au, sx * 0.6, 2.66, 0.04);                    // gauntlet
  }
  add(cyl(0.11, 0.13, 0.22, 8), m, 0, 3.78, 0);                                          // neck
  add(new THREE.SphereGeometry(0.2, 14, 10), m, 0, 4.02, 0).scale.set(0.95, 1.18, 1.08);   // helm
  add(B(0.28, 0.045, 0.05, 0.01), au, 0, 4.04, -0.2);                                    // visor slit
  add(B(0.03, 0.42, 0.62, 0.01), au, 0, 4.3, 0.04, 0.18, 0, 0);                          // crest
  add(B(0.6, 0.06, 0.05, 0.01), au, 0, 3.98, -0.2);                                      // brow
  const cape = add(B(0.72, 1.7, 0.05, 0.02), m, 0, 2.95, 0.3, 0.08, 0, 0);                // cloak
  cape.scale.set(1, 1, 1);
  add(B(0.72, 1.7, 0.1, 0.05), m, -0.86, 2.65, -0.34, 0, 0.35, 0);                       // tower shield
  add(B(0.44, 1.32, 0.05, 0.02), au, -0.88, 2.65, -0.42, 0, 0.35, 0);
  add(new THREE.CircleGeometry(0.16, 6), au, -0.9, 3.0, -0.455, 0, 0.35, 0);
  add(cyl(0.03, 0.03, 5.2, 6), au, 0.86, 2.6, -0.14);                                    // spear
  add(new THREE.ConeGeometry(0.08, 0.6, 4), au, 0.86, 5.5, -0.14);
  g.userData.kind = 'guardian'; g.scale.setScalar(0.88); return g;
}

// sculpted guardians (Blender, models/hub/*.glb): marble warlock-mages, materials swapped by name
const GUARD_IDS = ['aurelia', 'seraph', 'vesta', 'tempest'];
async function loadGuardians(M) {
  const out = [];
  try {
    const { GLTFLoader } = await import('../vendor/jsm/loaders/GLTFLoader.js'); const loader = new GLTFLoader();
    const stone2 = M.stone.clone(); stone2.color.set(0xe4dfd6);
    const glow = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x9fe8ff, emissiveIntensity: 2.6, roughness: 0.3 });
    const SW = { marble: M.stone, marble2: stone2, gold: M.gold, glow, dark: new THREE.MeshStandardMaterial({ color: 0x16171d, roughness: 0.5 }) };
    for (const id of GUARD_IDS) {
      const url = `models/hub/${id}.glb`; let gltf;
      try { gltf = await loader.loadAsync(url); }
      catch (e0) {
        const r = await fetch(url.replace(/\.glb$/, '.b64.txt')); if (!r.ok) throw e0;
        const bin = atob((await r.text()).trim()), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        gltf = await new Promise((res, rej) => loader.parse(buf.buffer, '', res, rej));
      }
      const g = gltf.scene;
      g.traverse((o) => { if (o.isMesh) { o.material = SW[o.material.name] || M.stone; o.castShadow = true; } });
      g.userData.kind = 'guardian'; out.push(g);
    }
  } catch (e) { console.warn('guardian models unavailable, using procedural', e); return []; }
  return out;
}

// ------------------------------------------------------------ build
export async function buildSanctumVisuals(A, scene, renderer, onProgress) {
  const { solids, prismGeo, boxGeo, haloTex, makeSnow } = A;
  const root = new THREE.Group(); scene.add(root); seedKit(101);
  await onProgress(0.08, 'Polishing the marble');
  const M = makeMarbles();
  const WM = { marble: M.marble.clone(), gold: M.gold.clone() };   // world set gets vertexColors when merged; statues keep the plain set
  const marbleTex = ctex(marbleCanvas('#ece8e0', true)), marbleTexPlain = ctex(marbleCanvas('#e6e2da', false));
  const lawnTex = ctex(lawnCanvas()); lawnTex.repeat.set(16, 16);
  const S = (o) => new THREE.MeshStandardMaterial({ roughness: 0.34, metalness: 0.04, envMapIntensity: 1.2, ...o });
  const blackMarbleTex = ctex(cvs(256, 256, (g, s) => { g.fillStyle = '#15181f'; g.fillRect(0, 0, s, s); for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 6, 1); } g.strokeStyle = 'rgba(214,174,102,.32)'; g.lineWidth = 1.3; for (let i = 0; i < 5; i++) { g.beginPath(); let x = Math.random() * s; g.moveTo(x, 0); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 50; g.lineTo(x, (k + 1) * s / 6); } g.stroke(); } g.strokeStyle = '#d6ae66'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, s - 3, s - 3); }));
  const vfloorTex = ctex(cvs(256, 256, (g, s) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#e6e1d6' : '#171a21'; g.fillRect(x * 128, y * 128, 128, 128); } g.strokeStyle = '#d6ae66'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 253, 253); g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.moveTo(0, 128); g.lineTo(256, 128); g.stroke(); for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(120,120,130,${Math.random() * 0.05})`; g.fillRect(Math.random() * s, Math.random() * s, 3, 1); } }));
  const flute = cvs(256, 256, (g, s) => { g.fillStyle = '#e6e1d8'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(60,60,80,.16)'); g.fillStyle = gr; g.fillRect(x, 0, 32, s); } g.fillStyle = '#d6ae66'; g.fillRect(0, 0, s, 6); g.fillRect(0, s - 6, s, 6); g.fillRect(0, s / 2 - 2, s, 3); for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(90,90,100,${Math.random() * 0.05})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); } });
  const fluteH = cvs(256, 256, (g, s) => { for (let x = 0; x < s; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, '#222'); gr.addColorStop(0.5, '#eee'); gr.addColorStop(1, '#222'); g.fillStyle = gr; g.fillRect(x, 0, 32, s); } g.fillStyle = '#888'; g.fillRect(0, 0, s, 6); g.fillRect(0, s - 6, s, 6); });
  const fluteTex = ctex(flute), fluteNorm = normalMap(fluteH, 2.4);
  const windowTex = ctex(cvs(128, 256, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let y = 6; y < h; y += 14) for (let x = 6; x < w; x += 16) { if (Math.random() < 0.72) { g.fillStyle = Math.random() < 0.7 ? '#ffd58a' : '#9ae6ff'; g.fillRect(x, y, 9, 7); } } }));
  const towerTex = ctex(cvs(128, 256, (g, w, h) => { g.fillStyle = '#efe9de'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(214,174,102,.9)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h); for (let y = 6; y < h; y += 14) for (let x = 6; x < w; x += 16) { g.fillStyle = 'rgba(40,52,80,.85)'; g.fillRect(x, y, 9, 7); } }));
  const mats = {
    ground: new THREE.MeshStandardMaterial({ map: lawnTex, roughness: 1 }),
    terrace: S({ map: marbleTex }), stairs: S({ map: marbleTexPlain }), bridge: S({ map: marbleTexPlain }), rail: S({ map: marbleTexPlain }), deck: S({ map: marbleTex }), roof: S({ map: marbleTexPlain, roughness: 0.4 }), counter: S({ map: marbleTexPlain }), bench: S({ map: marbleTexPlain }),
    pedestal: S({ map: marbleTexPlain }), plinth: S({ map: marbleTexPlain }), dais: S({ map: blackMarbleTex, roughness: 0.22, metalness: 0.15 }), table: S({ map: blackMarbleTex, roughness: 0.22, metalness: 0.15 }),
    hedge: new THREE.MeshStandardMaterial({ color: 0x3f7a48, roughness: 1, flatShading: true }),
    vwall: S({ map: fluteTex, normalMap: fluteNorm, roughness: 0.4 }), vfloor: S({ map: vfloorTex, roughness: 0.16, metalness: 0.25 }), vroof: S({ map: marbleTexPlain }), trunk: S({ map: barkSet({ base: '#5a4a3e', ivy: ['#8a9a6a', '#9aaa7a'] }).map, roughness: 1 }),
  };
  const world = new THREE.Group(); root.add(world);
  const glow = (c, i = 2.4) => new THREE.MeshStandardMaterial({ color: 0x050505, emissive: c, emissiveIntensity: i, roughness: 0.4 });
  const gold = WM.gold, gGold = glow(0xffc46a, 2.4), gCyan = glow(0x5ad8e0, 2.6), gViolet = glow(0xb08cff, 3), gWarm = glow(0xffe2a8, 2.2);
  const strip = (m, x, y, z, w, h, d) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); world.add(b); return b; };
  const bev = (m, x0, x1, y0, y1, z0, z1, r = 0.05) => { const o = new THREE.Mesh(bevelGeo(x0, x1, y0, y1, z0, z1, r, 3), m); o.castShadow = o.receiveShadow = true; world.add(o); return o; };
  const glowList = [], gl = (x, y, z, c, s) => glowList.push({ x, y, z, c, s });
  const glowTex = haloTex();
  const facet = (geo) => { const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); return g; };
  const column = (x, y0, z, h, r = 0.26) => {   // fluted column: base, faceted shaft, gold collars, capital
    const sh = new THREE.Mesh(facet(new THREE.CylinderGeometry(r, r * 1.05, h, 14)), WM.marble); sh.position.set(x, y0 + h / 2, z); sh.castShadow = true; world.add(sh);
    bev(WM.marble, x - r * 1.6, x + r * 1.6, y0, y0 + 0.16, z - r * 1.6, z + r * 1.6, 0.03); bev(WM.marble, x - r * 1.5, x + r * 1.5, y0 + h - 0.2, y0 + h, z - r * 1.5, z + r * 1.5, 0.03);
    for (const yy of [y0 + 0.2, y0 + h - 0.24]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.14, r * 1.14, 0.06, 14), gold); c.position.set(x, yy, z); world.add(c); }
  };
  await onProgress(0.15, 'Laying the plaza');

  // ---- solids
  const trunks = [], stairsList = [], dropped = new Set(['invis', 'rim', 'vdoor', 'trunk', 'lantern', 'post', 'torii', 'pagoda', 'altar', 'board', 'hedge', 'bamboo', 'rock']);
  for (const so of solids) {
    if (so.mat === 'trunk') { trunks.push(so); continue; }
    if (so.mat === 'post') {
      if (so.x1 - so.x0 > 1) { bev(gold, so.x0, so.x1, so.y0, so.y1, so.z0, so.z1, 0.04); continue; }
      column((so.x0 + so.x1) / 2, so.y0, (so.z0 + so.z1) / 2, so.y1 - so.y0, 0.24); continue;
    }
    if (so.mat === 'hedge') { const o = new THREE.Mesh(bevelGeo(so.x0, so.x1, so.y0, so.y1, so.z0, so.z1, 0.16, 3), mats.hedge); o.castShadow = o.receiveShadow = true; world.add(o); continue; }
    if (dropped.has(so.mat)) continue;
    let g;
    if (so.ramp) {
      if (so.mat === 'stairs') {
        const r = so.ramp, n = Math.max(3, Math.round(Math.abs(r.yb - r.ya) / 0.2)), along = r.axis === 'x' ? so.x1 - so.x0 : so.z1 - so.z0, dir = Math.sign(r.b - r.a) || 1;
        for (let i = 0; i < n; i++) {
          const h = r.ya + ((r.yb - r.ya) * (i + 1)) / n, c0 = r.a + (dir * along * i) / n, c1 = r.a + (dir * along * (i + 1)) / n, lo = Math.min(c0, c1), hi = Math.max(c0, c1);
          const m = new THREE.Mesh(r.axis === 'x' ? bevelGeo(lo, hi, 0, h, so.z0, so.z1, 0.03, 3) : bevelGeo(so.x0, so.x1, 0, h, lo, hi, 0.03, 3), mats.stairs); m.castShadow = m.receiveShadow = true; world.add(m);
        }
        continue;
      }
      g = prismGeo(so, 4);
    } else if (so.mat === 'ground') { g = boxGeo(so, 8); g.translate((so.x0 + so.x1) / 2, (so.y0 + so.y1) / 2, (so.z0 + so.z1) / 2); }
    else g = bevelGeo(so.x0, so.x1, so.y0, so.y1, so.z0, so.z1, so.mat === 'roof' || so.mat === 'vroof' ? 0.07 : 0.05, 3);
    const m = new THREE.Mesh(g, mats[so.mat] || mats.terrace); m.castShadow = m.receiveShadow = true; world.add(m);
  }
  // ---- marble paving with gold inlay over the lawn
  const paveMat = S({ map: marbleTex, roughness: 0.22, envMapIntensity: 1.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const pave = (x0, x1, z0, z1, y = 0.03) => { const w = x1 - x0, d = z1 - z0, g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 4, uv.getY(i) * d / 4); const m = new THREE.Mesh(g, paveMat); m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true; root.add(m); };
  pave(-4.2, 4.2, -15, 37); pave(-19, 19, 16.5, 29.5); pave(-37, -14.5, -3, 19); pave(16.5, 33, 8.5, 25); pave(-38, -17, -21, -2); pave(21, 43, -25, -1);
  pave(-19, 19, -14.4, -12.6, 0.031);
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(15, 15).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: ctex(sunburstCanvas()), roughness: 0.25, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })); sun.position.set(0, 0.04, 22.6); sun.receiveShadow = true; root.add(sun);
  const sun2 = sun.clone(); sun2.scale.setScalar(1.2); sun2.position.set(-28, 0.04, -11); root.add(sun2);
  const sun3 = sun.clone(); sun3.scale.setScalar(1.1); sun3.position.set(31, 0.04, -11); root.add(sun3);
  // gold inlay lines along promenades
  for (const x of [-4.05, 4.05]) strip(gGold, x, 0.05, 10, 0.08, 0.02, 54); strip(gGold, 0, 0.05, 17, 38, 0.02, 0.08);

  // ---- reflecting pool: dark bed, mirror water, coping, fountains
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(22, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0f2c38, roughness: 1 })); bed.position.set(0, 0.05, -2); root.add(bed);
  const wnH = cvs(128, 128, (g, s) => { for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const v = 128 + 44 * Math.sin(x * 0.2 + Math.sin(y * 0.13) * 2) + 34 * Math.sin(y * 0.27 + x * 0.05) + 16 * Math.sin((x + y) * 0.4); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1); } });
  const wn = normalMap(wnH, 0.8); wn.repeat.set(5, 4);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(22, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a86a0, normalMap: wn, roughness: 0.02, metalness: 0.65, transparent: true, opacity: 0.74, envMapIntensity: 2.0 })); water.position.set(0, 0.12, -2); root.add(water);
  const coping = (x0, x1, z0, z1) => { bev(WM.marble, x0, x1, 0, 0.28, z0, z1, 0.05); strip(gGold, (x0 + x1) / 2, 0.285, (z0 + z1) / 2, Math.max(0.05, x1 - x0 - 0.3), 0.012, Math.max(0.05, z1 - z0 - 0.3)); };
  for (const z of [5.6, -10.4]) { coping(-11.4, -1.9, z, z + 0.8); coping(1.9, 11.4, z, z + 0.8); }
  coping(-11.4, -10.6, -9.6, 5.6); coping(10.6, 11.4, -9.6, 5.6);
  // pad the statue pedestals in the pool with a gold ring
  const jets = [], JN = 26;
  const jetPos = [[-3.6, -6.5], [3.6, -6.5], [-3.6, 2.5], [3.6, 2.5], [-8.6, -7], [8.6, -7], [-8.6, 3], [8.6, 3]];
  const jetGeo = new THREE.BufferGeometry(), jp = new Float32Array(jetPos.length * JN * 3); jetGeo.setAttribute('position', new THREE.BufferAttribute(jp, 3));
  const jetPts = new THREE.Points(jetGeo, new THREE.PointsMaterial({ map: glowTex, color: 0xdff6ff, size: 0.4, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); jetPts.frustumCulled = false; root.add(jetPts);
  jetPos.forEach(([x, z], j) => { const nz = bev(WM.marble, x - 0.35, x + 0.35, 0.05, 0.4, z - 0.35, z + 0.35, 0.05); void nz; strip(gGold, x, 0.41, z, 0.5, 0.01, 0.5); for (let i = 0; i < JN; i++) jets.push({ j, ph: i / JN, a: rnd() * TAU, sp: rr(0.5, 1.2), x, z }); });

  // ---- bridge lamps, gate, lamp posts
  for (const sx of [-1.6, 1.6]) for (const z of [3, -0.5, -4, -7]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), gWarm); c.position.set(sx, 2.42, z); world.add(c); bev(gold, sx - 0.12, sx + 0.12, 2.2, 2.32, z - 0.12, z + 0.12, 0.02); gl(sx, 2.42, z, 0xffdca0, 1.6); }
  strip(gGold, 0, 1.43, -2, 0.06, 0.012, 10);
  // art deco arch: stepped pillars, lintel, sunburst fan
  for (const sx of [-1, 1]) {
    const x = sx * 3.6;
    bev(WM.marble, x - 0.9, x + 0.9, 0, 0.5, 23.2, 24.8, 0.05); bev(WM.marble, x - 0.7, x + 0.7, 0.5, 1.0, 23.4, 24.6, 0.05); bev(WM.marble, x - 0.5, x + 0.5, 1.0, 6.6, 23.6, 24.4, 0.05);
    bev(gold, x - 0.53, x - 0.43, 1.0, 6.6, 23.55, 24.45, 0.01); bev(gold, x + 0.43, x + 0.53, 1.0, 6.6, 23.55, 24.45, 0.01);
    bev(WM.marble, x - 0.72, x + 0.72, 6.6, 7.1, 23.4, 24.6, 0.05); strip(gGold, x, 4, 23.58, 0.06, 5, 0.02); strip(gGold, x, 4, 24.42, 0.06, 5, 0.02);
    gl(x, 7.3, 24, 0xffd890, 3);
  }
  bev(WM.marble, -4.4, 4.4, 6.6, 7.5, 23.5, 24.5, 0.06); bev(gold, -4.5, 4.5, 7.5, 7.62, 23.45, 24.55, 0.02);
  { const fan = new THREE.Group(); fan.position.set(0, 7.62, 24);
    for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI, len = i % 2 ? 1.8 : 2.6; const r = new THREE.Mesh(new THREE.BoxGeometry(0.12, len, 0.1), gold); r.position.set(Math.cos(a) * (0.8 + len / 2), Math.sin(a) * (0.8 + len / 2), 0); r.rotation.z = a - Math.PI / 2; fan.add(r); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.07, 6, 30, Math.PI), gold); fan.add(ring); const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24, 0, Math.PI), gWarm); fan.add(disc); world.add(fan); }
  strip(gWarm, 0, 6.5, 24, 6.4, 0.06, 0.06);
  // lamp posts
  for (const [x, z] of A.lanterns) {
    bev(WM.marble, x - 0.3, x + 0.3, 0, 0.3, z - 0.3, z + 0.3, 0.04); const sh = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.09, 0.13, 3.4, 8)), WM.marble); sh.position.set(x, 2.0, z); sh.castShadow = true; world.add(sh);
    for (const yy of [0.5, 3.5]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.07, 10), gold); c.position.set(x, yy, z); world.add(c); }
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), gWarm); globe.position.set(x, 3.9, z); world.add(globe); gl(x, 3.9, z, 0xffe0a8, 3.2);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 4), gold); leaf.position.set(x + Math.cos(a) * 0.2, 3.55, z + Math.sin(a) * 0.2); leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); world.add(leaf); }
  }
  await onProgress(0.3, 'Raising the colonnades');

  // ---- roofs: gold cornice, stepped tier, recessed ceiling glow
  for (const so of solids.filter((q) => q.mat === 'roof')) {
    const cx = (so.x0 + so.x1) / 2, cz = (so.z0 + so.z1) / 2, w = so.x1 - so.x0, d = so.z1 - so.z0;
    bev(gold, so.x0 - 0.05, so.x1 + 0.05, so.y0, so.y0 + 0.08, so.z0 - 0.05, so.z1 + 0.05, 0.02); bev(gold, so.x0 - 0.05, so.x1 + 0.05, so.y1 - 0.06, so.y1 + 0.02, so.z0 - 0.05, so.z1 + 0.05, 0.02);
    bev(WM.marble, cx - w * 0.36, cx + w * 0.36, so.y1, so.y1 + 0.35, cz - d * 0.36, cz + d * 0.36, 0.05); bev(gold, cx - w * 0.36, cx + w * 0.36, so.y1 + 0.35, so.y1 + 0.4, cz - d * 0.36, cz + d * 0.36, 0.01);
    bev(WM.marble, cx - w * 0.16, cx + w * 0.16, so.y1 + 0.4, so.y1 + 0.8, cz - d * 0.16, cz + d * 0.16, 0.05);
    strip(gWarm, cx, so.y0 - 0.02, cz, w * 0.6, 0.03, d * 0.6);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.2, 4), gold); fin.position.set(cx, so.y1 + 1.4, cz); fin.rotation.y = Math.PI / 4; world.add(fin); gl(cx, so.y1 + 2, cz, 0xffd890, 3);
  }
  // mission board: glass display in a gold frame
  const boardCanvas = cvs(512, 256, (g, w, h) => {
    g.fillStyle = '#0c1220'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(127,230,255,.35)'; g.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const x = 22 + (i % 5) * 96, y = 24 + Math.floor(i / 5) * 110; g.strokeRect(x, y, 80, 94); g.fillStyle = 'rgba(127,230,255,.5)'; g.fillRect(x + 8, y + 10, 40, 5); g.fillStyle = 'rgba(255,214,140,.8)'; g.fillRect(x + 8, y + 24, 60, 3); g.fillStyle = 'rgba(255,255,255,.18)'; for (let k = 0; k < 4; k++) g.fillRect(x + 8, y + 40 + k * 12, 56, 3); }
    g.fillStyle = 'rgba(255,214,140,.9)'; g.font = '700 16px monospace'; g.fillText('MISSIONS', 22, 16);
  });
  bev(WM.marble, -12.9, -7.1, 0, 3.2, 26.35, 27.25, 0.05); bev(gold, -12.3, -7.7, 0.55, 2.75, 26.3, 26.36, 0.01);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.4), new THREE.MeshBasicMaterial({ map: ctex(boardCanvas), fog: false })); board.position.set(-10, 1.75, 26.3); board.rotation.y = Math.PI; world.add(board);
  gl(-10, 3.5, 25.4, 0xb8ecff, 4);
  // counters get a gold edge
  for (const so of solids.filter((q) => q.mat === 'counter' || q.mat === 'bench')) strip(gold, (so.x0 + so.x1) / 2, so.y1 + 0.01, (so.z0 + so.z1) / 2, so.x1 - so.x0 + 0.02, 0.03, so.z1 - so.z0 + 0.02);
  // stairs get a gold nosing on the top step
  // ---- carillon tower (was the pagoda): setbacks, gold fins, glowing crown
  { const cx = 25, cz = 15;
    bev(WM.marble, cx - 4.4, cx + 4.4, 0, 0.5, cz - 4.4, cz + 4.4, 0.06); bev(WM.marble, cx - 3.6, cx + 3.6, 0.5, 1.1, cz - 3.6, cz + 3.6, 0.06); bev(gold, cx - 3.7, cx + 3.7, 1.1, 1.18, cz - 3.7, cz + 3.7, 0.02);
    bev(WM.marble, cx - 1.6, cx + 1.6, 1.18, 12, cz - 1.6, cz + 1.6, 0.1);
    for (const [dx, dz, sx, sz] of [[1.62, 0, 0.06, 0.5], [-1.62, 0, 0.06, 0.5], [0, 1.62, 0.5, 0.06], [0, -1.62, 0.5, 0.06]]) { bev(gold, cx + dx - sx / 2, cx + dx + sx / 2, 1.6, 11.6, cz + dz - sz / 2, cz + dz + sz / 2, 0.01); }
    for (const [dx, dz] of [[1.62, 0], [-1.62, 0], [0, 1.62], [0, -1.62]]) { const s = (dx ? 0.03 : 0.9), t = (dz ? 0.03 : 0.9); strip(gCyan, cx + dx, 6.5, cz + dz, dx ? 0.05 : 0.14, 9, dz ? 0.05 : 0.14); void s; void t; }
    bev(WM.marble, cx - 1.3, cx + 1.3, 12, 13.2, cz - 1.3, cz + 1.3, 0.08); bev(gold, cx - 1.36, cx + 1.36, 13.2, 13.3, cz - 1.36, cz + 1.36, 0.02); bev(WM.marble, cx - 0.9, cx + 0.9, 13.3, 14.4, cz - 0.9, cz + 0.9, 0.08); bev(WM.marble, cx - 0.5, cx + 0.5, 14.4, 15.4, cz - 0.5, cz + 0.5, 0.06);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.28, 4.4, 4), gold); sp.position.set(cx, 17.6, cz); sp.rotation.y = Math.PI / 4; world.add(sp);
    for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.62 - i * 0.1, 0.035, 5, 20), gold); r.rotation.x = Math.PI / 2; r.position.set(cx, 15.7 + i * 0.5, cz); world.add(r); }
    gl(cx, 19.6, cz, 0xffe0a0, 5); gl(cx, 12.6, cz, 0xffd090, 3.6);
    // bell arch
    bev(WM.marble, 23.2, 26.8, 2.9, 3.35, 19.3, 20.3, 0.04); bev(gold, 23.2, 26.8, 3.35, 3.43, 19.3, 20.3, 0.01); }
  // ---- void obelisk (the altar): stepped drum, tapered shaft, glowing edges
  { const cx = 31, cz = -11;
    for (const [r, h, y0] of [[2.7, 0.3, 0], [2.2, 0.3, 0.3], [1.7, 0.35, 0.6]]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.05, h, 24), h > 0.3 ? WM.marble : mats.dais); st.position.set(cx, y0 + h / 2, cz); st.receiveShadow = true; world.add(st); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.72, 0.04, 6, 48), gold); ring.rotation.x = Math.PI / 2; ring.position.set(cx, 0.32, cz); world.add(ring);
    const ob = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.34, 0.62, 4.2, 4)), mats.dais); ob.rotation.y = Math.PI / 4; ob.position.set(cx, 3.1, cz); ob.castShadow = true; world.add(ob);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 4), gold); tip.rotation.y = Math.PI / 4; tip.position.set(cx, 5.55, cz); world.add(tip);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 4.0, 0.04), gViolet); e.position.set(cx + Math.cos(a) * 0.48, 3.1, cz + Math.sin(a) * 0.48); world.add(e); } }
  mergeStatic(world);
  await onProgress(0.45, 'Carving the statues');

  // ---- statues on the pedestals
  const statues = new THREE.Group(); root.add(statues);
  const poses = ['raise', 'offer', 'reach', 'still'];
  const GU = await loadGuardians(M); let gi = 0;
  POI.statues.forEach((q, i) => {
    const top = q.y + q.top, f = q.k === 'goddess' ? goddess(M, poses[i % 4], 1.55 + (q.hw > 1.2 ? 0.25 : 0)) : GU.length ? (() => { const k = gi++, t = GU[(q.big ? k % 2 : k) % GU.length].clone(); t.scale.setScalar(1.75); if (k >= GU.length && !q.big) t.scale.x *= -1; return t; })() : guardian(M);
    if (q.big) f.scale.multiplyScalar(q.big * (GU.length ? 0.8 : 1));
    f.position.set(q.x, top, q.z); f.rotation.y = q.yaw; statues.add(f);
    // gold band + sunburst backdrop
    strip(gold, q.x, top - 0.09, q.z, q.hw * 2 + 0.06, 0.06, q.hw * 2 + 0.06);
    if (q.k === 'goddess') {
      const bx = q.x - Math.sin(q.yaw) * -0.0, back = new THREE.Group(); back.position.set(q.x + Math.sin(q.yaw) * 0.9, top + 2.35, q.z + Math.cos(q.yaw) * 0.9); back.rotation.y = q.yaw + Math.PI; void bx;
      for (let k = 0; k <= 10; k++) { const a = (k / 10) * Math.PI, len = k % 2 ? 1.0 : 1.5, r = new THREE.Mesh(new THREE.BoxGeometry(0.06, len, 0.04), M.gold); r.position.set(Math.cos(a) * (1.0 + len / 2), Math.sin(a) * (1.0 + len / 2) - 0.3, 0); r.rotation.z = a - Math.PI / 2; back.add(r); }
      statues.add(back);
    }
    gl(q.x, top + 0.2, q.z, 0xffe2a8, 2.2);
  });
  // spotlights on the colossi + court goddess
  for (const q of POI.statues.filter((s) => s.big || s.hw > 1.4)) { const l = new THREE.SpotLight(0xfff0d0, 40, 24, 0.5, 0.6, 1.2); l.position.set(q.x - Math.sin(q.yaw) * 6, q.y + 8, q.z - Math.cos(q.yaw) * 6); l.target.position.set(q.x, q.y + q.top + 3, q.z); root.add(l, l.target); }
  await onProgress(0.6, 'Trees, hedges, water');

  // ---- trees: blossoms near the plaza, slim cypress elsewhere
  const bl = blossomCard(), blossoms = [], sak = [], cyp = [];
  for (const so of trunks) { const cx = (so.x0 + so.x1) / 2, cz = (so.z0 + so.z1) / 2; (Math.abs(cx) <= 24 && cz > -16 && cz < 33 ? sak : cyp).push([cx, cz]); }
  const barkM = mats.trunk, cypM = new THREE.MeshStandardMaterial({ color: 0x386a44, roughness: 1, flatShading: true }), potG = [];
  for (const [cx, cz] of sak) {
    const h = rr(6.5, 8.5), tm = new THREE.Mesh(trunkGeo(cx, 0, cz, h, rr(0.45, 0.6)), barkM); tm.castShadow = true; world.add(tm);
    bev(WM.marble, cx - 1.4, cx + 1.4, 0, 0.22, cz - 1.4, cz + 1.4, 0.04); strip(gold, cx, 0.23, cz, 2.6, 0.01, 2.6);
    const nb = 5;
    for (let b = 0; b < nb; b++) { const a = (b / nb) * TAU + rnd(), len = rr(2.4, 4.0), y0 = h * rr(0.62, 0.9), tilt = rr(0.75, 1.1), bg2 = new THREE.CylinderGeometry(0.06, 0.15, len, 6); bg2.translate(0, len / 2, 0); bg2.rotateZ(-tilt); bg2.rotateY(a); bg2.translate(cx, y0, cz); const bm = new THREE.Mesh(bg2, barkM); world.add(bm);
      const ex = cx + Math.cos(a) * Math.sin(tilt) * len, ez = cz - Math.sin(a) * Math.sin(tilt) * len, ey = y0 + Math.cos(tilt) * len; for (let k = 0; k < 8; k++) blossoms.push({ x: ex + rr(-1.5, 1.5), y: ey + rr(-0.6, 1.3), z: ez + rr(-1.5, 1.5), s: rr(1.8, 2.9) }); }
    for (let k = 0; k < 12; k++) blossoms.push({ x: cx + rr(-2, 2), y: h + rr(-0.5, 2), z: cz + rr(-2, 2), s: rr(2.1, 3.2) });
  }
  for (const [cx, cz] of cyp) {
    const h = rr(7, 10); const g = new THREE.ConeGeometry(1.0, h, 8).toNonIndexed(); g.scale(1, 1, 1); g.translate(cx, h / 2 + 0.6, cz); g.computeVertexNormals(); const m = new THREE.Mesh(g, cypM); m.castShadow = true; world.add(m);
    const g2 = new THREE.SphereGeometry(0.75, 8, 6).toNonIndexed(); g2.scale(1, 0.7, 1); g2.translate(cx, h + 0.4, cz); g2.computeVertexNormals(); void g2;
    bev(WM.marble, cx - 0.8, cx + 0.8, 0, 0.7, cz - 0.8, cz + 0.8, 0.05); bev(gold, cx - 0.84, cx + 0.84, 0.5, 0.58, cz - 0.84, cz + 0.84, 0.02); potG.push([cx, cz]);
  }
  mergeStatic(world);
  const blossomMat = new THREE.MeshLambertMaterial({ map: bl, alphaTest: 0.35, side: THREE.DoubleSide, emissive: 0x552030, emissiveIntensity: 0.3 });
  const bIm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), blossomMat, Math.max(1, blossoms.length * 2)), mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), cc = new THREE.Color();
  blossoms.forEach((p, i) => { for (let k = 0; k < 2; k++) { e4.set(rr(-0.6, 0.6), rnd() * TAU, 0); q4.setFromEuler(e4); mtx.compose(new THREE.Vector3(p.x, p.y, p.z), q4, new THREE.Vector3(p.s, p.s, p.s)); bIm.setMatrixAt(i * 2 + k, mtx); bIm.setColorAt(i * 2 + k, cc.set(0xffffff).offsetHSL(rr(-0.02, 0.02), 0, rr(-0.05, 0.03))); } });
  bIm.frustumCulled = false; root.add(bIm);
  // clean turf tufts only on lawn
  const gtex = grassCard(['#78ad64', '#8cc070', '#67a058']), gp = [];
  for (let i = 0; i < 1500; i++) {
    const x = (rnd() - 0.5) * 86, z = rr(-52, 42), y = A.groundAt(x, z, 20); if (!Number.isFinite(y) || y > 0.05) continue; if (A.blocked(x, z, y, 0.2, 0.3)) continue;
    if (Math.abs(x) < 4.6 && z > -15 && z < 37) continue; if (x > -19 && x < 19 && z > 16 && z < 30) continue; if (x < -14 && x > -38 && z > -3 && z < 19) continue; if (x > 16 && x < 34 && z > 8 && z < 26) continue; if (x < -17 && x > -39 && z > -22 && z < -2) continue; if (x > 20 && x < 44 && z > -26 && z < -1) continue; if (Math.abs(x) < 12 && z > -11 && z < 7) continue;
    gp.push({ x, y, z, s: rr(0.6, 1.1) });
  }
  tufts(root, gp, gtex, { w: 0.6, h: 0.42, tint: ['#7fb36a', '#8ec572', '#6fa25e'] });
  // koi
  const koi = [], fishGeo = new THREE.PlaneGeometry(0.55, 1.15).rotateX(-Math.PI / 2);
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(fishGeo, new THREE.MeshBasicMaterial({ map: fishCard(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })); m.position.y = 0.085; root.add(m); koi.push({ m, a: rnd() * TAU, r: rr(2, 5.2), sp: rr(0.18, 0.4) * (rnd() < 0.5 ? -1 : 1), ph: rnd() * 9, lure: 0 }); }
  await onProgress(0.72, 'The Vault');

  // ---- vault facade: pilasters, sunburst crown, ziggurat, door
  for (const sx of [-1, 1]) for (const x of [5.4, 8.4, 11.4, 14.4]) { bev(WM.marble, sx * x - 0.38, sx * x + 0.38, 1.6, 9.9, -23.02, -22.62, 0.04); strip(gGold, sx * x, 5.7, -22.6, 0.05, 8.2, 0.02); bev(gold, sx * x - 0.44, sx * x + 0.44, 9.6, 9.9, -23.1, -22.55, 0.02); bev(gold, sx * x - 0.44, sx * x + 0.44, 1.6, 1.85, -23.1, -22.55, 0.02); }
  { const fan = new THREE.Group(); fan.position.set(0, 4.6, -22.94);
    for (let i = 0; i <= 36; i++) { const a = (i / 36) * Math.PI, len = i % 2 ? 0.55 : 1.05, r = new THREE.Mesh(new THREE.BoxGeometry(0.08, len, 0.06), gold); r.position.set(Math.cos(a) * (4.35 + len / 2), Math.sin(a) * (4.35 + len / 2), 0); r.rotation.z = a - Math.PI / 2; fan.add(r); }
    world.add(fan); }
  for (const [x0, x1, z0, z1, y0, y1] of [[-14, 14, -41, -25, 10.6, 12.4], [-10, 10, -39, -27, 12.4, 14.2], [-6, 6, -37, -29, 14.2, 16]]) { bev(WM.marble, x0, x1, y0, y1, z0, z1, 0.08); bev(gold, x0 - 0.05, x1 + 0.05, y1 - 0.08, y1, z0 - 0.05, z1 + 0.05, 0.02); }
  { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.5, 7, 4), gold); sp.position.set(0, 19.5, -33); sp.rotation.y = Math.PI / 4; world.add(sp); gl(0, 23, -33, 0xffe0a0, 6); }
  // the door: gold-rimmed discs with sigil
  const vaultG = new THREE.Group(); root.add(vaultG);
  const rimGold = new THREE.MeshStandardMaterial({ color: 0xd8b060, metalness: 0.95, roughness: 0.3 }), doorMat = new THREE.MeshStandardMaterial({ map: blackMarbleTex, metalness: 0.5, roughness: 0.25 });
  const halves = [];
  for (const sg of [-1, 1]) {
    const half = new THREE.Group(); half.position.set(0, 4.6, -23.2);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.5, 40, 1, false, sg > 0 ? 0 : Math.PI, Math.PI), doorMat); disc.rotation.x = Math.PI / 2; disc.castShadow = true; half.add(disc);
    const sig = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32, sg > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI), new THREE.MeshBasicMaterial({ map: sigilTex(), fog: false })); sig.position.z = 0.27; half.add(sig);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI - Math.PI / 2 + (sg > 0 ? 0 : Math.PI); const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.16), rimGold); spoke.position.set(Math.cos(a) * 1.7, Math.sin(a) * 1.7, 0.3); spoke.rotation.z = a - Math.PI / 2; half.add(spoke); }
    half.userData.sg = sg; vaultG.add(half); halves.push(half);
  }
  const vRing = new THREE.Mesh(new THREE.TorusGeometry(3.85, 0.22, 10, 48), rimGold); vRing.position.set(0, 4.6, -23.05); vaultG.add(vRing);
  const doorGlow = glowSprite(glowTex, 0xffe4b0, 9, 0, 4.6, -22.6, 0.22); root.add(doorGlow);
  const deep = new THREE.Group(); deep.position.set(0, 3.4, -43.7);
  const dd = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.4, 32), doorMat); dd.rotation.x = Math.PI / 2; deep.add(dd);
  const ds = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), new THREE.MeshBasicMaterial({ map: sigilTex(), fog: false })); ds.position.z = 0.21; deep.add(ds);
  deep.add(new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.14, 8, 40), rimGold)); vaultG.add(deep);
  const deepLock = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.03, 6, 48), new THREE.MeshBasicMaterial({ color: 0xff5b6e })); deepLock.position.set(0, 3.4, -43.2); vaultG.add(deepLock);
  // interior
  strip(gGold, 0, 1.63, -33, 0.12, 0.03, 20); strip(gCyan, -6.4, 1.63, -33, 0.06, 0.03, 20); strip(gCyan, 6.4, 1.63, -33, 0.06, 0.03, 20);
  for (const sx of [-1, 1]) for (let z = -26; z > -42; z -= 4) { bev(WM.marble, sx * 16.5 - 0.4, sx * 16.5 + 0.4, 1.6, 9.9, z - 0.4, z + 0.4, 0.04); strip(gGold, sx * 16.15, 5.7, z, 0.04, 8, 0.05); }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 8.4, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); beam.position.set(0, 6, -30); root.add(beam);
  for (const [x, z, c] of [[-10, -30, 0xfff0d8], [10, -30, 0xfff0d8], [0, -38, 0xd8f4ff]]) { const l = new THREE.PointLight(c, 40, 24, 1.4); l.position.set(x, 7, z); root.add(l); }
  for (const p of [...POI.weapons, ...POI.exotics]) { strip(gGold, p.x, 2.72, p.z, 1.0, 0.02, 1.0); gl(p.x, 3.2, p.z, p.id && POI.exotics.includes(p) ? 0xffd25a : 0xffe0a8, p.id && POI.exotics.includes(p) ? 4 : 2.4); }
  for (const p of POI.operators) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.03, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffe0a8, fog: false })); r.rotation.x = Math.PI / 2; r.position.set(p.x, 2.03, p.z); root.add(r); }
  mergeStatic(world);
  await onProgress(0.85, 'Skyline');

  // ---- sky, deco skyline, orbital ring
  const skyGeo = new THREE.SphereGeometry(320, 18, 12), col = [], pp = skyGeo.attributes.position, c = new THREE.Color();
  const top = new THREE.Color(0x5a8ed0), mid = new THREE.Color(0xa8c6e6), low = new THREE.Color(0xffe8cc);
  for (let i = 0; i < pp.count; i++) { const y = pp.getY(i) / 320; c.copy(y > 0 ? low.clone().lerp(mid, clamp(y * 3.2, 0, 1)).lerp(top, clamp((y - 0.18) * 2.2, 0, 1)) : low); col.push(c.r, c.g, c.b); }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -10; root.add(sky);
  const starPos = []; for (let i = 0; i < 700; i++) { const a = rnd() * TAU, e = 0.12 + rnd() * 1.3, r = 300; starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); root.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 14), new THREE.MeshBasicMaterial({ color: 0xeef4ff, fog: false, transparent: true, opacity: 0 })); moon.position.set(120, 70, -200); root.add(moon);
  const moonGlow = glowSprite(glowTex, 0xa8c4ff, 260, 120, 70, -200, 0); root.add(moonGlow);
  const sunM = new THREE.Mesh(new THREE.SphereGeometry(16, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff6e0, fog: false })); sunM.position.set(-120, 60, -230); root.add(sunM);
  const sunGlow = glowSprite(glowTex, 0xffd8a0, 380, -120, 60, -230, 0.85); root.add(sunGlow);
  // orbital ring: thin gold arc across the sky
  const ringM = new THREE.MeshBasicMaterial({ color: 0xffe6b0, fog: false, transparent: true, opacity: 0.85 }), orbit = new THREE.Group(); orbit.position.set(0, -40, -60); orbit.rotation.set(0.42, 0.2, 0.08);
  orbit.add(new THREE.Mesh(new THREE.TorusGeometry(250, 1.1, 6, 160, Math.PI * 1.15), ringM)); const rg2 = new THREE.Mesh(new THREE.TorusGeometry(250, 4.5, 6, 160, Math.PI * 1.15), new THREE.MeshBasicMaterial({ color: 0xffd890, fog: false, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false })); orbit.add(rg2); root.add(orbit);
  // skyline
  const city = new THREE.Group(), towerMat = new THREE.MeshStandardMaterial({ map: towerTex, emissiveMap: windowTex, emissive: 0xffffff, emissiveIntensity: 0.0, roughness: 0.5, metalness: 0.1 }), goldFar = new THREE.MeshStandardMaterial({ color: 0xe0b868, metalness: 0.9, roughness: 0.3 });
  for (let i = 0; i < 70; i++) {
    const a = rnd() * TAU, r = 95 + rnd() * 150, w = rr(7, 15), h = rr(30, 120), x = Math.cos(a) * r, z = Math.sin(a) * r, tiers = 2 + ((rnd() * 3) | 0);
    let y = -2, ww = w;
    for (let t = 0; t < tiers; t++) { const th = h * (t === 0 ? 0.55 : 0.45 / (tiers - 1)); const m = new THREE.Mesh(bevelGeo(x - ww / 2, x + ww / 2, y, y + th, z - ww / 2, z + ww / 2, 0.5, 8), towerMat); city.add(m); y += th; ww *= 0.68; }
    const sp = new THREE.Mesh(new THREE.ConeGeometry(ww * 0.25, h * 0.22, 4), goldFar); sp.position.set(x, y + h * 0.11, z); sp.rotation.y = Math.PI / 4; city.add(sp);
  }
  root.add(mergeStatic(city));
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 1 })); outer.position.y = -0.7; outer.receiveShadow = true; root.add(outer);
  {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(envScene, 0.03, 0.1, 1000).texture; scene.environmentIntensity = 0.6; pm.dispose();
  }
  scene.fog = new THREE.Fog(0xf0e6d8, 50, 260); scene.background = new THREE.Color(0xf0e4d4);
  const hemi = new THREE.HemisphereLight(0xfff6ea, 0xbdb090, 1.15); root.add(hemi);
  const dir = new THREE.DirectionalLight(0xfff0d0, 2.8); dir.position.set(-40, 44, -50); dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048);
  Object.assign(dir.shadow.camera, { left: -54, right: 54, top: 50, bottom: -50, near: 10, far: 180 }); dir.shadow.bias = -0.0006; dir.shadow.normalBias = 0.04; root.add(dir);
  const petals = makeSnow(root, 600, 76, 24, 0.24, 0xfff0e8);
  { const dot = ctex(cvs(32, 32, (g, s) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); })); petals.pts.material.map = dot; petals.pts.material.alphaTest = 0.05; petals.pts.material.needsUpdate = true; }
  const fireflies = [], ffPos = new Float32Array(40 * 3), ffGeo = new THREE.BufferGeometry(); ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const ffPts = new THREE.Points(ffGeo, new THREE.PointsMaterial({ map: glowTex, color: 0xffe6a0, size: 0.6, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); ffPts.frustumCulled = false; root.add(ffPts);
  for (let i = 0; i < 40; i++) fireflies.push({ a: rnd() * TAU, r: rr(1, 4), cx: rr(-38, 38), cz: rr(-24, 40), y: rr(0.6, 3.6), sp: rr(0.3, 0.9), ph: rnd() * 9 });
  for (const size of [...new Set(glowList.map((q) => q.s))]) { const list = glowList.filter((q) => q.s === size), pos = new Float32Array(list.length * 3), cols = new Float32Array(list.length * 3), cc2 = new THREE.Color(); list.forEach((q, i) => { pos.set([q.x, q.y, q.z], i * 3); cc2.set(q.c); cols.set([cc2.r, cc2.g, cc2.b], i * 3); }); const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g2.setAttribute('color', new THREE.BufferAttribute(cols, 3)); const pt = new THREE.Points(g2, new THREE.PointsMaterial({ map: glowTex, size, vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); pt.frustumCulled = false; root.add(pt); }

  // ---- bell (carillon), obelisk rings
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.62, 0.95, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8b060, metalness: 0.95, roughness: 0.28, side: THREE.DoubleSide })); bell.position.set(25, 1.85, 19.8); world.add(bell);
  const bellTop = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 6, 0, TAU, 0, Math.PI / 2), bell.material); bellTop.position.set(25, 2.32, 19.8); world.add(bellTop);
  const altarRing = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.04, 6, 64), new THREE.MeshBasicMaterial({ color: 0xb98cff, fog: false })); altarRing.rotation.x = Math.PI / 2; altarRing.position.set(31, 2.2, -11); root.add(altarRing);
  const altarRing2 = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.035, 6, 48), altarRing.material); altarRing2.position.set(31, 3.4, -11); root.add(altarRing2);
  const altarCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: 0xe6d4ff, fog: false })); altarCore.position.set(31, 6.3, -11); root.add(altarCore);
  root.add(glowSprite(glowTex, 0x9b6bff, 6, 31, 6.3, -11, 0.6));
  await onProgress(0.95, 'Final polish');

  // ---- time of day (0 bright afternoon .. 1 night)
  const todA = { fogA: new THREE.Color(0xf0e6d8), fogB: new THREE.Color(0x1a2444), bgA: new THREE.Color(0xf0e4d4), bgB: new THREE.Color(0x0e1430), hemA: new THREE.Color(0xfff6ea), hemB: new THREE.Color(0x5a6cb0), dirA: new THREE.Color(0xfff0d0), dirB: new THREE.Color(0x8aa4e0), skyA: new THREE.Color(0xffffff), skyB: new THREE.Color(0x24306a) };
  const glowMats = []; root.traverse((o) => { if (o.isPoints && o.material.blending === THREE.AdditiveBlending && o !== ffPts && o !== jetPts && o.material.vertexColors) glowMats.push(o.material); });
  const tod = (k) => {
    scene.fog.color.lerpColors(todA.fogA, todA.fogB, k); scene.background.lerpColors(todA.bgA, todA.bgB, k); hemi.color.lerpColors(todA.hemA, todA.hemB, k); hemi.intensity = 1.15 - 0.7 * k;
    dir.color.lerpColors(todA.dirA, todA.dirB, k); dir.intensity = 2.8 - 2.2 * k; dir.position.set(-40 + 80 * k, 44 - 12 * k, -50 + 20 * k); sky.material.color.lerpColors(todA.skyA, todA.skyB, k);
    stars.material.opacity = clamp((k - 0.4) * 1.7, 0, 0.95); moon.material.opacity = clamp((k - 0.45) * 1.8, 0, 1); moonGlow.material.opacity = clamp((k - 0.45) * 0.9, 0, 0.55); sunGlow.material.opacity = 0.85 * (1 - k); sunM.visible = k < 0.85;
    for (const m of glowMats) m.opacity = 0.4 + 0.6 * k; ffPts.material.opacity = 0.25 + 0.65 * k; towerMat.emissiveIntensity = 0.05 + 1.4 * k; scene.environmentIntensity = 0.6 - 0.35 * k; ringM.opacity = 0.6 + 0.4 * k;
    hubState.night = k;
  };
  const hubState = { tod, night: 0, lock: null, doorOpen: 0, doorTarget: 0, deepOpen: 0, deepTarget: 0, koi, koiLure: null, bellSwing: 0, bell, bellTop };
  petals.extra = (dt, t) => {
    wind.value = t; { const k = hubState.lock != null ? hubState.lock : clamp((0.5 - 0.5 * Math.cos(t * TAU / 480 - 0.6)) * 1.08 - 0.04, 0, 1); tod(hubState.lock != null ? k : Math.min(k, 0.84)); }
    wn.offset.set(t * 0.01, t * 0.007);
    for (const k of koi) {
      k.a += k.sp * dt; let x = Math.cos(k.a) * k.r * 1.5, z = -2 + Math.sin(k.a * 1.3 + k.ph) * k.r * 0.8;
      if (hubState.koiLure) { const lx = hubState.koiLure.x, lz = hubState.koiLure.z; k.lure = Math.min(1, k.lure + dt * 0.5); x += (lx - x) * 0.6 * k.lure; z += (lz - z) * 0.6 * k.lure; } else k.lure = Math.max(0, k.lure - dt * 0.4);
      x = clamp(x, -10, 10); z = clamp(z, -9, 5);
      const dx = x - k.m.position.x, dz = z - k.m.position.z; if (dx * dx + dz * dz > 1e-6) k.m.rotation.y = damp2(k.m.rotation.y, Math.atan2(dx, dz) + Math.PI, 6 * dt);
      k.m.position.x = x; k.m.position.z = z;
    }
    // fountains: ballistic arcs, each particle on its own phase
    for (let i = 0; i < jets.length; i++) { const p = jets[i]; p.ph = (p.ph + dt * p.sp * 0.55) % 1; const u = p.ph, hgt = 3.4 * (1 - (2 * u - 1) ** 2) + 0.4, rad = 0.05 + u * 0.55 * (i % 3 === 0 ? 0.3 : 1); jp[i * 3] = p.x + Math.cos(p.a) * rad; jp[i * 3 + 1] = 0.4 + hgt * (i % 2 ? 0.75 : 1); jp[i * 3 + 2] = p.z + Math.sin(p.a) * rad; }
    jetGeo.attributes.position.needsUpdate = true;
    fireflies.forEach((f, i) => { f.a += f.sp * dt; ffPos[i * 3] = f.cx + Math.cos(f.a) * f.r; ffPos[i * 3 + 1] = f.y + Math.sin(t * 1.3 + f.ph) * 0.3; ffPos[i * 3 + 2] = f.cz + Math.sin(f.a * 1.2) * f.r; }); ffGeo.attributes.position.needsUpdate = true;
    altarRing.rotation.z += dt * 0.6; altarRing2.rotation.x += dt * 0.9; altarRing2.rotation.y += dt * 0.5; altarCore.rotation.y += dt * 1.2; altarCore.position.y = 6.3 + Math.sin(t * 1.6) * 0.12;
    orbit.rotation.z = 0.08 + Math.sin(t * 0.02) * 0.02;
    beam.material.opacity = 0.085 + Math.sin(t * 0.7) * 0.025;
    const S1 = hubState;
    S1.doorOpen += (S1.doorTarget - S1.doorOpen) * Math.min(1, dt * 1.1); S1.deepOpen += (S1.deepTarget - S1.deepOpen) * Math.min(1, dt * 1.4);
    for (const h of halves) { h.position.x = h.userData.sg * S1.doorOpen * 4.4; h.rotation.z = h.userData.sg * S1.doorOpen * 0.5; }
    vRing.rotation.z += dt * 0.05; doorGlow.material.opacity = 0.2 + Math.sin(t * 1.2) * 0.05 + S1.doorOpen * 0.3;
    deep.position.y = 3.4 + S1.deepOpen * 3.4; deepLock.visible = S1.deepTarget === 0; deepLock.rotation.z += dt * 0.7;
    S1.bellSwing *= Math.exp(-dt * 0.9); const sw = Math.sin(t * 6) * S1.bellSwing * 0.35; bell.rotation.z = sw; bellTop.rotation.z = sw;
  };
  await onProgress(1, 'Ready');
  return { root, sky, dir, hemi, mats, glow, snow: petals, hub: hubState, vaultG, statues };
}
