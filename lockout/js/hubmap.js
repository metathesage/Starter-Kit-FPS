// SANCTUM: the solo hub. A cherry-blossom zen garden with a pond, tea house, mission pavilion, pagoda, bamboo grove, a void altar and,
// at the north end, the Vault: a stone archive with exhibits, dioramas, a medal wall and a sealed deep vault.
// Collision is axis-aligned solids (defineSanctum); everything you see is built in buildSanctumVisuals.
import * as THREE from 'three';
import { mergeStatic } from './merge.js';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js';
import { bevelGeo, concreteSet, floorSet, barkSet, normalMap, tex, tufts, vines, scaffold, mossRock, trunkGeo, glowSprite, wind, rnd, seedKit, grassCard, vineCard } from './mapkit.js';

const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rr = (a, b) => a + rnd() * (b - a);
const T = 0.6;

// points of interest shared with hub.js (positions are world metres, y is the floor height there)
export const POI = {
  spawn: { x: 0, y: 0, z: 34, yaw: 0 },
  board: { x: -10, y: 0, z: 25.6 },
  teaCounter: { x: -25, y: 0.7, z: 5.4 }, tea: { x: -22.6, y: 0.7, z: 10.6 }, record: { x: -21.2, y: 0.7, z: 12.6 }, save: { x: -28.6, y: 0.7, z: 12.6 },
  bell: { x: 25, y: 0, z: 20.2 }, altar: { x: 31, y: 0.4, z: -11 }, koi: { x: 11.8, y: 0, z: -2 }, sit: { x: -27, y: 0, z: -3.2 }, sit2: { x: 13.5, y: 0, z: 9.5 },
  vaultDoor: { x: 0, y: 1.6, z: -22.6 }, deepDoor: { x: 0, y: 1.6, z: -42.6 }, orb: { x: 0, y: 1.6, z: -30 }, relic: { x: 0, y: 1.6, z: -47.5 },
  medalWall: { x: 0, y: 1.6, z: -41.4 }, torii: { x: 0, y: 0, z: 24 }, sand: { x: -28, y: 0, z: -10 }, lantern: { x: -3.6, y: 0, z: 15 },
  weapons: [], operators: [], maps: [],
};
// weapon plinths: 11 along the west wing
{
  const ids = ['br', 'magnum', 'smg', 'shotgun', 'sniper', 'rocket', 'carbine', 'plasmarifle', 'needler', 'hammer', 'sword'];
  ids.forEach((id, i) => { const col = i < 6 ? 0 : 1, row = col ? i - 6 : i; POI.weapons.push({ id, x: col ? -8.4 : -12.8, y: 2.7, z: -27.4 - row * 2.7 - (col ? 1.35 : 0) }); });
  const ops = ['aoi', 'kira', 'nova', 'yuna', 'mira', 'ivy', 'hana', 'zero', 'eos'];
  ops.forEach((id, i) => POI.operators.push({ id, x: 7.4 + (i % 3) * 2.9, y: 2.0, z: -27.4 - Math.floor(i / 3) * 4.6 }));
  ['lockout', 'cryostat', 'mesa', 'overgrowth', 'warsat', 'sanctum'].forEach((id, i) => POI.maps.push({ id, x: i < 3 ? -11 + i * 3.4 : 4.6 + (i - 3) * 3.4, y: 2.62, z: -40.9 }));
}

// ---------------------------------------------------------------- collision
export function defineSanctum(A) {
  const { box, ramp } = A, ss = [];
  const B = (...a) => { const s = box(...a); ss.push(s); return s; };
  box(-44, 44, -54, 44, -T, 0, 'ground');
  box(-44, 44, 44, 45, 0, 40, 'invis'); box(-44, 44, -55, -54, 0, 40, 'invis'); box(44, 45, -55, 45, 0, 40, 'invis'); box(-45, -44, -55, 45, 0, 40, 'invis');
  // torii gate
  box(-4.2, -3, 23.6, 24.4, 0, 7.2, 'torii'); box(3, 4.2, 23.6, 24.4, 0, 7.2, 'torii');
  // pond rim (low invisible walls; the visual is a ring of rocks) with a gap for the bridge
  for (const z of [5.6, -10.4]) { box(-11.4, -1.8, z, z + 0.8, 0, 1.2, 'rim'); box(1.8, 11.4, z, z + 0.8, 0, 1.2, 'rim'); }
  box(-11.4, -10.6, -10, 5.6, 0, 1.2, 'rim'); box(10.6, 11.4, -10, 5.6, 0, 1.2, 'rim');
  // arched bridge: ramp up, deck, ramp down, rails
  ramp(-1.6, 1.6, 3, 6.6, 0, 'z', 6.6, 3, 0, 1.4, { mat: 'bridge' }); box(-1.6, 1.6, -7, 3, 0, 1.4, 'bridge'); ramp(-1.6, 1.6, -10.6, -7, 0, 'z', -7, -10.6, 1.4, 0, { mat: 'bridge' });
  box(-1.7, -1.5, -7, 3, 1.4, 2.2, 'rail'); box(1.5, 1.7, -7, 3, 1.4, 2.2, 'rail');
  // vault terrace + stairs
  ramp(-5, 5, -14, -11, 0, 'z', -11, -14, 0, 1.6, { mat: 'stairs' });
  box(-18, 18, -23, -14, 0, 1.6, 'terrace');
  // the vault: floor, walls, roof with a skylight, doors
  box(-17, 17, -43, -23, 0, 1.6, 'vfloor');
  box(-17, -16, -43, -23, 1.6, 10, 'vwall'); box(16, 17, -43, -23, 1.6, 10, 'vwall');
  box(-17, -3.5, -24, -23, 1.6, 10, 'vwall'); box(3.5, 17, -24, -23, 1.6, 10, 'vwall'); box(-3.5, 3.5, -24, -23, 7.6, 10, 'vwall');
  box(-17, -1.8, -44, -43, 1.6, 10, 'vwall'); box(1.8, 17, -44, -43, 1.6, 10, 'vwall'); box(-1.8, 1.8, -44, -43, 5, 10, 'vwall');
  box(-17, 17, -43, -33, 10, 10.6, 'vroof'); box(-17, 17, -27, -23, 10, 10.6, 'vroof'); box(-17, -4, -33, -27, 10, 10.6, 'vroof'); box(4, 17, -33, -27, 10, 10.6, 'vroof');
  const doorMain = B(-3.5, 3.5, -24.4, -23.4, 1.6, 7.6, 'vdoor');
  // deep vault
  box(-5, 5, -51, -44, 0, 1.6, 'vfloor'); box(-6, -5, -52, -44, 1.6, 8, 'vwall'); box(5, 6, -52, -44, 1.6, 8, 'vwall'); box(-6, 6, -52, -51, 1.6, 8, 'vwall'); box(-6, 6, -52, -43, 8, 8.6, 'vroof');
  const doorDeep = B(-1.8, 1.8, -44.4, -43.4, 1.6, 5, 'vdoor');
  // exhibits
  POI.weapons.forEach((w) => box(w.x - 0.6, w.x + 0.6, w.z - 0.6, w.z + 0.6, 1.6, 2.7, 'plinth'));
  POI.operators.forEach((o) => box(o.x - 1.1, o.x + 1.1, o.z - 1.1, o.z + 1.1, 1.6, 2.0, 'dais'));
  box(-1, 1, -31, -29, 1.6, 2.6, 'plinth');
  box(-12.6, -3, -42.6, -39.4, 1.6, 2.6, 'table'); box(3, 12.6, -42.6, -39.4, 1.6, 2.6, 'table');
  box(-1, 1, -48.6, -46.4, 1.6, 2.5, 'plinth');
  // tea house
  box(-31, -19, 3, 15, 0, 0.7, 'deck'); for (const [x, z] of [[-30.6, 3.4], [-19.4, 3.4], [-30.6, 14.6], [-19.4, 14.6]]) box(x - 0.25, x + 0.25, z - 0.25, z + 0.25, 0.7, 3.6, 'post');
  box(-33, -17, 1, 17, 3.6, 4.2, 'roof');
  ramp(-19, -17.6, 7, 11, 0, 'x', -17.6, -19, 0, 0.7, { mat: 'stairs' });
  box(-23.8, -21.4, 8.6, 9.8, 0.7, 1.35, 'counter'); box(-26.6, -23.4, 4.4, 5.2, 0.7, 1.7, 'counter'); box(-22.6, -19.8, 13.4, 14.4, 0.7, 2.6, 'counter'); box(-29.6, -27.6, 13.4, 14.4, 0.7, 2.6, 'counter');
  // mission pavilion
  for (const [x, z] of [[-14.5, 20], [-5.5, 20], [-14.5, 26], [-5.5, 26]]) box(x - 0.25, x + 0.25, z - 0.25, z + 0.25, 0, 3.6, 'post');
  box(-16, -4, 18.5, 27.5, 3.6, 4.2, 'roof'); box(-12.6, -7.4, 26.4, 27.2, 0, 3, 'board');
  // zen garden rocks, bench
  for (const [x, z, s] of [[-31, -11, 1.5], [-27.5, -14.5, 1.1], [-24, -7, 0.9], [-33, -6.5, 1.0], [-22, -13, 0.8]]) box(x - s, x + s, z - s, z + s, 0, s * 1.3, 'rock');
  box(-28.6, -25.4, -4.4, -3.6, 0, 0.5, 'bench');
  // pagoda + bell frame
  box(22, 28, 12, 18, 0, 2, 'pagoda'); box(23.6, 26.4, 13.6, 16.4, 2, 12, 'pagoda');
  box(23.3, 23.7, 19.4, 20.2, 0, 3, 'post'); box(26.3, 26.7, 19.4, 20.2, 0, 3, 'post'); box(23.3, 26.7, 19.4, 20.2, 2.9, 3.2, 'post');
  // void altar dais
  box(28.5, 33.5, -13.5, -8.5, 0, 0.4, 'altar');
  // bamboo clumps
  seedKit(88); for (let i = 0; i < 26; i++) { const x = rr(25, 41), z = rr(-22, -3); if (Math.hypot(x - 31, z + 11) < 6.5) continue; box(x - 0.3, x + 0.3, z - 0.3, z + 0.3, 0, 12, 'bamboo'); }
  // trees, lanterns
  A.trees = [[-9, 30], [10, 30], [-16, 8], [15, 4], [17, -10], [-15, -8], [-9, -14.5], [9, -14.5], [-22, 26], [22, 28], [23, -15], [-24, 20], [34, 4], [-38, 10], [40, 26], [-36, -26], [-20, -32], [23, -32], [36, 30], [-38, 34]];
  for (const [x, z] of A.trees) box(x - 0.6, x + 0.6, z - 0.6, z + 0.6, 0, 16, 'trunk');
  A.lanterns = [[-3.6, 20], [3.6, 20], [-3.6, 15], [3.6, 15], [-3.6, 10.5], [3.6, 10.5], [-6.4, -12], [6.4, -12], [-8.4, 3.6], [8.4, 3.6], [-21, -4], [-13, 8], [20, 8], [12.5, 24], [-12.5, 24], [30, 6], [22, -2], [-17, -20], [17, -25]];
  for (const [x, z] of A.lanterns) box(x - 0.35, x + 0.35, z - 0.35, z + 0.35, 0, 1.9, 'lantern');
  return {
    bounds: { x: 43, z: 47 }, kill: -60, spawns: { red: [{ ...POI.spawn }], blue: [{ ...POI.spawn }] }, pickups: [],
    map: { id: 'sanctum', nav: { x0: -43, x1: 43, z0: -53, z1: 43 }, obj: {} }, doors: { main: doorMain, deep: doorDeep },
  };
}

// ---------------------------------------------------------------- visuals
const cvs = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
const ctex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };

function blossomCard() {
  return ctex(cvs(128, 128, (g, w, h) => {
    for (let i = 0; i < 110; i++) {
      const x = 14 + Math.random() * (w - 28), y = 14 + Math.random() * (h - 28), d = Math.hypot(x - w / 2, y - h / 2); if (d > 56) continue;
      const r = 5 + Math.random() * 6; g.fillStyle = ['#ffc1d6', '#ff9fc2', '#ffe0ea', '#ffb0ca'][i % 4]; g.globalAlpha = 0.85 + Math.random() * 0.15;
      for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + i; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55, r * 0.4, a, 0, TAU); g.fill(); }
      g.globalAlpha = 1; g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill();
    }
  }));
}
function fishCard() {
  return ctex(cvs(64, 128, (g, w, h) => {
    const body = ['#ff7a30', '#f5f0e8', '#e8452a'][(Math.random() * 3) | 0];
    g.fillStyle = body; g.beginPath(); g.ellipse(w / 2, h * 0.42, 15, 36, 0, 0, TAU); g.fill();
    g.fillStyle = '#f5f0e8'; g.beginPath(); g.ellipse(w / 2 - 4, h * 0.36, 8, 14, 0.2, 0, TAU); g.fill();
    g.fillStyle = '#14100c'; g.beginPath(); g.ellipse(w / 2 + 5, h * 0.5, 6, 9, -0.2, 0, TAU); g.fill();
    g.fillStyle = body; g.beginPath(); g.moveTo(w / 2, h * 0.72); g.quadraticCurveTo(w / 2 - 22, h * 0.95, w / 2 - 12, h); g.lineTo(w / 2 + 12, h); g.quadraticCurveTo(w / 2 + 22, h * 0.95, w / 2, h * 0.72); g.fill();
    g.fillStyle = '#12100e'; g.beginPath(); g.arc(w / 2 - 6, h * 0.14, 1.8, 0, TAU); g.arc(w / 2 + 6, h * 0.14, 1.8, 0, TAU); g.fill();
  }));
}
const sigilTex = () => ctex(cvs(256, 256, (g, s) => {
  g.fillStyle = '#0b0e12'; g.fillRect(0, 0, s, s); g.translate(s / 2, s / 2); g.strokeStyle = '#ffd88a'; g.lineWidth = 4;
  for (let r = 100; r > 30; r -= 22) { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); }
  g.lineWidth = 3; for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.beginPath(); g.moveTo(34, 0); g.lineTo(100, 0); g.stroke(); }
  g.fillStyle = '#7fe6ff'; g.beginPath(); g.arc(0, 0, 18, 0, TAU); g.fill(); g.lineWidth = 6; g.strokeStyle = '#7fe6ff'; g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.lineTo(Math.cos(a) * 46, Math.sin(a) * 46); } g.closePath(); g.stroke();
}));

export async function buildSanctumVisuals(A, scene, renderer, onProgress) {
  const { solids, prismGeo, boxGeo, haloTex, makeSnow, doors } = A;
  const root = new THREE.Group(); scene.add(root); seedKit(101);
  await onProgress(0.1, 'Raking the sand');
  const stone = concreteSet({ base: '#b8b0a8', rows: 3, cols: 3, groove: 'rgba(60,50,45,.5)', streak: 'rgba(70,90,60,.18)' }), dark = concreteSet({ base: '#3a3d46', rows: 4, cols: 3, groove: 'rgba(0,0,0,.6)' });
  const wood = concreteSet({ base: '#7a4a2e', rows: 1, cols: 8, groove: 'rgba(30,14,6,.7)', streak: 'rgba(20,10,4,.3)' }), lacquer = concreteSet({ base: '#c23a30', rows: 1, cols: 1, groove: 'rgba(60,10,8,.0)' });
  const tile = concreteSet({ base: '#3a4552', rows: 10, cols: 6, groove: 'rgba(0,0,0,.6)' }), vfloorS = floorSet({ base: '#1c1f28', line: 'rgba(230,190,110,.6)', tiles: 4 });
  const bark = barkSet({ base: '#4a3a34', ivy: ['#6a8a4a', '#8aaa5a'] });
  // vault wall: dark stone with glowing gold/cyan grooves
  const masonry = cvs(256, 256, (g, s) => { g.fillStyle = '#4a4a54'; g.fillRect(0, 0, s, s); for (let r = 0; r < 8; r++) { const off = (r % 2) * 32; for (let c = -1; c < 5; c++) { const x = c * 64 + off, sh = 34 + Math.random() * 16; g.fillStyle = `rgb(${sh + 26},${sh + 26},${sh + 34})`; g.fillRect(x + 2, r * 32 + 2, 60, 28); } } for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '200,200,190'},${Math.random() * 0.12})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); } g.fillStyle = 'rgba(90,120,70,.18)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * s, s * 0.6 + Math.random() * s * 0.4, 3, 6 + Math.random() * 20); });
  const masonryH = cvs(256, 256, (g, s) => { g.fillStyle = '#000'; g.fillRect(0, 0, s, s); for (let r = 0; r < 8; r++) { const off = (r % 2) * 32; for (let c = -1; c < 5; c++) { g.fillStyle = `rgb(${150 + Math.random() * 70},${150},${150})`; g.fillRect(c * 64 + off + 3, r * 32 + 3, 58, 26); } } });
  const vwallEm = cvs(256, 256, (g, s) => { g.fillStyle = '#000'; g.fillRect(0, 0, s, s); g.fillStyle = 'rgba(232,184,96,.55)'; g.fillRect(0, 0, s, 3); g.fillRect(0, s - 3, s, 3); });
  const S = (t, o = {}) => new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.85, metalness: 0.03, ...o });
  const groundTex = ctex(cvs(256, 256, (g, s) => { g.fillStyle = '#6f8f58'; g.fillRect(0, 0, s, s); for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,80,40' : '150,190,110'},${Math.random() * 0.22})`; g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 2 + Math.random() * 4); } }));
  groundTex.repeat.set(16, 16);
  const mats = {
    ground: new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }), terrace: S(stone), stairs: S(stone), rock: S(stone, { color: 0x9a948c }), bridge: S(wood), rail: S(lacquer, { roughness: 0.4 }), deck: S(wood), post: S(lacquer, { roughness: 0.45 }),
    roof: S(tile, { roughness: 0.55, metalness: 0.2 }), torii: S(lacquer, { roughness: 0.4 }), pagoda: S(wood), board: S(wood), bench: S(stone), counter: S(wood), altar: S(dark, { metalness: 0.4, roughness: 0.5 }),
    bamboo: new THREE.MeshStandardMaterial({ color: 0x86a850, roughness: 0.6 }), trunk: S(bark, { roughness: 1 }), lantern: S(stone),
    vwall: new THREE.MeshStandardMaterial({ map: ctex(masonry), normalMap: normalMap(masonryH, 3), emissiveMap: ctex(vwallEm), emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.85, metalness: 0.05 }), vfloor: S(vfloorS, { roughness: 0.45, metalness: 0.3 }), vroof: S(dark), vdoor: S(dark, { metalness: 0.6, roughness: 0.4 }),
    plinth: S(dark, { metalness: 0.4, roughness: 0.4 }), dais: S(dark, { metalness: 0.4, roughness: 0.4 }), table: S(dark, { metalness: 0.3, roughness: 0.5 }),
  };
  const world = new THREE.Group(); root.add(world);
  const trunks = [];
  for (const so of solids) {
    if (so.mat === 'invis' || so.mat === 'rim' || so.mat === 'bamboo' || so.mat === 'lantern' || so.mat === 'vdoor') continue;
    if (so.mat === 'trunk') { trunks.push(so); continue; }
    if (so.mat === 'rock') { continue; }
    let g;
    if (so.ramp) {
      if (so.mat === 'stairs') {   // visible steps over a ramp collider
        const r = so.ramp, n = Math.max(3, Math.round(Math.abs(r.yb - r.ya) / 0.22)), parts = [], along = r.axis === 'x' ? so.x1 - so.x0 : so.z1 - so.z0, dir = Math.sign(r.b - r.a) || 1;
        for (let i = 0; i < n; i++) {
          const h = r.ya + ((r.yb - r.ya) * (i + 1)) / n, c0 = r.a + (dir * along * i) / n, c1 = r.a + (dir * along * (i + 1)) / n;
          const lo = Math.min(c0, c1), hi = Math.max(c0, c1);
          parts.push(r.axis === 'x' ? bevelGeo(lo, hi, 0, h, so.z0, so.z1, 0.03, 3) : bevelGeo(so.x0, so.x1, 0, h, lo, hi, 0.03, 3));
        }
        for (const gg of parts) { const m = new THREE.Mesh(gg, mats.stairs); m.castShadow = m.receiveShadow = true; world.add(m); }
        continue;
      }
      g = prismGeo(so, 4);
    } else if (so.mat === 'ground') { g = boxGeo(so, 8); g.translate((so.x0 + so.x1) / 2, (so.y0 + so.y1) / 2, (so.z0 + so.z1) / 2); }
    else g = bevelGeo(so.x0, so.x1, so.y0, so.y1, so.z0, so.z1, so.mat === 'roof' || so.mat === 'vroof' ? 0.08 : 0.06, 3);
    const m = new THREE.Mesh(g, mats[so.mat] || mats.terrace); m.castShadow = m.receiveShadow = true; world.add(m);
  }
  await onProgress(0.25, 'Setting the stones');
  const glow = (c, i = 2.4) => new THREE.MeshStandardMaterial({ color: 0x050505, emissive: c, emissiveIntensity: i, roughness: 0.4 });
  const gold = glow(0xffc46a, 2.4), cyan = glow(0x5ad8e0, 2.8), paper = new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffb060, emissiveIntensity: 1.8, roughness: 0.9 });
  const strip = (m, x, y, z, w, h, d) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); world.add(b); return b; };
  const glowTex = haloTex();
  const glowList = [];   // {x,y,z,c,s}: static additive glows drawn as one Points call per size
  const gl = (x, y, z, c, s) => glowList.push({ x, y, z, c, s });
  // ---- path: stepping slabs from spawn to the bridge and around the pond
  const pathMat = S(stone, { color: 0xd0c8be });
  for (let z = 32; z > 6.5; z -= 1.5) { const w = rr(2.6, 3.4); const m = new THREE.Mesh(bevelGeo(-w / 2 + rr(-0.15, 0.15), w / 2, 0.005, 0.07, z - 0.65, z + 0.65, 0.03, 3), pathMat); m.receiveShadow = true; world.add(m); }
  for (let z = -10.5; z > -14; z -= 1.5) { const m = new THREE.Mesh(bevelGeo(-2, 2, 0.005, 0.07, z - 0.65, z + 0.65, 0.03, 3), pathMat); m.receiveShadow = true; world.add(m); }
  for (const [x0, x1, z] of [[-13, -4, 24.4], [4, 13, 24.4]]) for (let x = x0; x < x1; x += 1.6) { const m = new THREE.Mesh(bevelGeo(x, x + 1.3, 0.005, 0.06, z - 0.65, z + 0.65, 0.03, 3), pathMat); m.receiveShadow = true; world.add(m); }
  // side paths to the tea house, pavilion, pagoda
  for (let x = -6; x > -19; x -= 1.5) { const m = new THREE.Mesh(bevelGeo(x - 0.65, x + 0.65, 0.005, 0.06, 8.5, 10.4, 0.03, 3), pathMat); m.receiveShadow = true; world.add(m); }
  for (let x = 6; x < 22; x += 1.5) { const m = new THREE.Mesh(bevelGeo(x - 0.65, x + 0.65, 0.005, 0.06, 15, 16.9, 0.03, 3), pathMat); m.receiveShadow = true; world.add(m); }
  // ---- pond
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(22, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0c2a34, roughness: 1 })); bed.position.set(0, 0.05, -2); world.add(bed);
  const noiseH = cvs(128, 128, (g, s) => { for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const v = 128 + 50 * Math.sin(x * 0.2 + Math.sin(y * 0.13) * 2) + 40 * Math.sin(y * 0.27 + x * 0.05) + 20 * Math.sin((x + y) * 0.4); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1); } });
  const wn = normalMap(noiseH, 1.4); wn.repeat.set(5, 4);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(22, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a5a72, normalMap: wn, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.6, envMapIntensity: 1.3 })); water.position.set(0, 0.12, -2); root.add(water);
  // pond rim rocks
  const rockGeos = [];
  const rock = (x, y, z, sx, sy, sz, c = '#8a8680') => { rockGeos.push(mossRock(x, y, z, sx, sy, sz, { rock: c, moss: ['#6f9a48', '#8ab058'], detail: 2 })); };
  for (let i = 0; i < 40; i++) { const t = i / 40, per = 2 * (22 + 16); let d = t * per, x, z; if (d < 22) { x = -11 + d; z = 6; } else if (d < 38) { x = 11; z = 6 - (d - 22); } else if (d < 60) { x = 11 - (d - 38); z = -10; } else { x = -11; z = -10 + (d - 60); } if (Math.abs(x) < 2.2 && (z > 5 || z < -9)) continue; rock(x + rr(-0.3, 0.3), 0.25, z + rr(-0.3, 0.3), rr(0.5, 0.9), rr(0.4, 0.7), rr(0.5, 0.9)); }
  for (const s of solids.filter((q) => q.mat === 'rock')) { const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, w = (s.x1 - s.x0) / 2; rock(cx, w * 0.5, cz, w * 1.05, w * 0.95, w * 1.05, '#7d7a76'); rock(cx + w * 0.5, w * 0.3, cz - w * 0.4, w * 0.55, w * 0.5, w * 0.55, '#8a8680'); }
  // lily pads and lotus
  { const padM = new THREE.MeshStandardMaterial({ color: 0x5a9a48, roughness: 0.7, side: THREE.DoubleSide }), lotM = new THREE.MeshStandardMaterial({ color: 0xffb0cc, emissive: 0x552038, roughness: 0.6 });
    for (let i = 0; i < 30; i++) { const x = rr(-9.5, 9.5), z = rr(-8.6, 4.6); if (Math.abs(x) < 2.4) continue; const r = rr(0.3, 0.6); const g = new THREE.CircleGeometry(r, 14, 0.5, TAU - 0.9).rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, padM); m.position.set(x, 0.135, z); m.rotation.y = rnd() * TAU; root.add(m); if (i % 5 === 0) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.28, 8), lotM); f.position.set(x, 0.28, z); f.rotation.x = Math.PI; root.add(f); } } }
  // koi
  const koi = []; const fishGeo = new THREE.PlaneGeometry(0.55, 1.15).rotateX(-Math.PI / 2);
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(fishGeo, new THREE.MeshBasicMaterial({ map: fishCard(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })); m.position.y = 0.085; root.add(m); koi.push({ m, a: rnd() * TAU, r: rr(2, 5.2), sp: rr(0.18, 0.4) * (rnd() < 0.5 ? -1 : 1), ph: rnd() * 9, lure: 0 }); }
  // ---- bridge dressing: red posts and a curved lacquered look
  const post = (x, y, z, h = 1.1) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, h, 8), mats.post); m.position.set(x, y + h / 2, z); m.castShadow = true; world.add(m); const c = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), gold); c.position.set(x, y + h + 0.05, z); world.add(c); };
  for (const sx of [-1.6, 1.6]) for (const z of [3, -0.5, -4, -7]) post(sx, 1.4, z, 1.0);
  // ---- torii gate: two round pillars, kasagi and nuki beams
  const toriiMat = mats.torii;
  for (const sx of [-3.6, 3.6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 7.2, 12), toriiMat); p.position.set(sx, 3.6, 24); p.castShadow = true; world.add(p); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 12), S(dark)); b.position.set(sx, 0.2, 24); world.add(b); }
  const kasagi = new THREE.Mesh(bevelGeo(-6.4, 6.4, 7.2, 7.75, 23.5, 24.5, 0.08, 3), toriiMat); kasagi.castShadow = true; world.add(kasagi);
  for (const sg of [-1, 1]) { const tip = new THREE.Mesh(bevelGeo(0, 1.6, 0, 0.5, -0.5, 0.5, 0.06, 3), toriiMat); tip.position.set(sg * 6.4 + (sg > 0 ? 0 : -1.6), 7.55, 24); tip.rotation.z = sg * 0.18; world.add(tip); }
  const shimaki = new THREE.Mesh(bevelGeo(-6, 6, 6.8, 7.2, 23.6, 24.4, 0.06, 3), S(dark)); world.add(shimaki);
  const nuki = new THREE.Mesh(bevelGeo(-4.6, 4.6, 5.6, 6.1, 23.7, 24.3, 0.06, 3), toriiMat); world.add(nuki);
  // ---- stone lanterns (toro)
  const toroG = [], lightGlows = [];
  for (const [x, z] of A.lanterns) {
    const parts = [bevelGeo(x - 0.34, x + 0.34, 0, 0.16, z - 0.34, z + 0.34, 0.03, 3), bevelGeo(x - 0.13, x + 0.13, 0.16, 1.05, z - 0.13, z + 0.13, 0.02, 3), bevelGeo(x - 0.34, x + 0.34, 1.05, 1.15, z - 0.34, z + 0.34, 0.03, 3), bevelGeo(x - 0.5, x + 0.5, 1.5, 1.72, z - 0.5, z + 0.5, 0.05, 3), bevelGeo(x - 0.22, x + 0.22, 1.72, 1.88, z - 0.22, z + 0.22, 0.03, 3)];
    for (const gg of parts) { const m = new THREE.Mesh(gg, mats.lantern); m.castShadow = true; world.add(m); }
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.34, 0.4), paper); core.position.set(x, 1.32, z); world.add(core);
    gl(x, 1.34, z, 0xffb060, 2.6);
  }
  await onProgress(0.4, 'Teahouse and pagoda');
  // ---- tea house roof: hipped roof with upturned eaves, hanging noren, lanterns
  const roofMat = mats.roof, hip = (cx, cz, w, d, y0, h) => {
    const g = new THREE.ConeGeometry(1, 1, 4, 1).toNonIndexed(); g.rotateY(Math.PI / 4); g.scale(w / 2 * 1.42, h, d / 2 * 1.42); g.translate(cx, y0 + h / 2, cz); g.computeVertexNormals();
    const p = g.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + p.getZ(i)) * 0.4; uv[i * 2 + 1] = p.getY(i) * 0.5; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const m = new THREE.Mesh(g, roofMat); m.castShadow = true; world.add(m); return m;
  };
  hip(-25, 9, 16.4, 16.4, 4.15, 2.4); hip(-10, 23, 13, 10.4, 4.15, 2.0);
  for (const [px, pz, w, d, y] of [[-25, 9, 16.4, 16.4, 12.4], [-10, 23, 13, 10.4, 20]]) { void y; const fin = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), gold); fin.position.set(px, 4.15 + (w > 14 ? 2.5 : 2.1), pz); world.add(fin); void d; }
  // pagoda tiers
  const pg = [[0, 3.2, 8, 8], [2.3, 5.2, 6.6, 6.6], [4.6, 7.2, 5.4, 5.4], [6.9, 9.2, 4.2, 4.2]];
  pg.forEach(([, y, w, d], i) => { hip(25, 15, w, d, 2 + i * 2.5 + 0.2, 1.0); const wall = new THREE.Mesh(bevelGeo(25 - w / 2 + 1, 25 + w / 2 - 1, 2 + i * 2.5, 2 + i * 2.5 + 0.35, 15 - d / 2 + 1, 15 + d / 2 - 1, 0.05, 3), mats.pagoda); world.add(wall); void y; });
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 3, 6), gold); spire.position.set(25, 13.8, 15); world.add(spire);
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.34 - i * 0.03, 0.03, 4, 12), gold); r.rotation.x = Math.PI / 2; r.position.set(25, 12.6 + i * 0.32, 15); world.add(r); }
  // bell
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.62, 0.95, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xc9a05a, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide })); bell.position.set(25, 1.85, 19.8); world.add(bell);
  const bellTop = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 6, 0, TAU, 0, Math.PI / 2), bell.material); bellTop.position.set(25, 2.32, 19.8); world.add(bellTop);
  // ---- mission board
  const boardCanvas = cvs(512, 256, (g, w, h) => { g.fillStyle = '#5a3a24'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8d8b8'; for (let i = 0; i < 9; i++) { const x = 20 + (i % 5) * 96, y = 24 + Math.floor(i / 5) * 110; g.fillRect(x, y, 78, 92); g.fillStyle = '#c23a30'; g.fillRect(x + 30, y + 6, 18, 6); g.fillStyle = 'rgba(40,24,10,.6)'; for (let k = 0; k < 4; k++) g.fillRect(x + 10, y + 22 + k * 14, 58, 3); g.fillStyle = '#e8d8b8'; } });
  const boardM = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshStandardMaterial({ map: ctex(boardCanvas), roughness: 0.9 })); boardM.position.set(-10, 1.9, 26.34); boardM.rotation.y = Math.PI; world.add(boardM);
  gl(-10, 3.4, 25.4, 0xffd090, 4);
  // ---- zen garden: raked sand with concentric rings around the rocks
  const rake = cvs(512, 512, (g, s) => { g.fillStyle = '#e6dcc4'; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(120,104,80,.45)'; g.lineWidth = 2; for (let y = 6; y < s; y += 9) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); } });
  const rakeH = cvs(256, 256, (g, s) => { g.fillStyle = '#888'; g.fillRect(0, 0, s, s); g.fillStyle = '#ccc'; for (let y = 0; y < s; y += 6) g.fillRect(0, y, s, 2); });
  const sandT = ctex(rake), sandN = normalMap(rakeH, 2); sandT.repeat.set(2, 1.4); sandN.repeat.set(4, 4);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(16, 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: sandT, normalMap: sandN, roughness: 1 })); sand.position.set(-28, 0.03, -10); sand.receiveShadow = true; world.add(sand);
  for (const [x, z, s] of [[-31, -11, 1.5], [-27.5, -14.5, 1.1], [-24, -7, 0.9], [-33, -6.5, 1.0], [-22, -13, 0.8]]) {
    const ring = ctex(cvs(256, 256, (g, sz) => { g.clearRect(0, 0, sz, sz); for (let r = 34; r < 126; r += 9) { g.strokeStyle = 'rgba(110,94,70,.6)'; g.lineWidth = 2.5; g.beginPath(); g.arc(sz / 2, sz / 2, r, 0, TAU); g.stroke(); } }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s * 6.2, s * 6.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ring, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); m.position.set(x, 0.05, z); world.add(m);
    rock(x, s * 0.55, z, s * 1.05, s * 0.85, s * 1.05, '#6f6c68'); rock(x + s * 0.55, s * 0.28, z + s * 0.45, s * 0.5, s * 0.4, s * 0.5, '#7d7a76');
  }
  // bench in the zen garden
  const bench = new THREE.Mesh(bevelGeo(-28.6, -25.4, 0.3, 0.55, -4.4, -3.6, 0.03, 3), mats.bench); world.add(bench);
  // ---- void altar: violet runes and a slow ring
  const altarRing = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.05, 6, 64), new THREE.MeshBasicMaterial({ color: 0xb98cff, fog: false })); altarRing.rotation.x = Math.PI / 2; altarRing.position.set(31, 1.2, -11); root.add(altarRing);
  const altarRing2 = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.04, 6, 48), altarRing.material); altarRing2.position.set(31, 1.6, -11); root.add(altarRing2);
  const altarCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: 0xe6d4ff, fog: false })); altarCore.position.set(31, 1.5, -11); root.add(altarCore);
  root.add(glowSprite(glowTex, 0x9b6bff, 6, 31, 1.5, -11, 0.7));
  { const m = new THREE.Mesh(mergeGeometries(rockGeos), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })); m.castShadow = m.receiveShadow = true; root.add(m); }
  mergeStatic(world);
  await onProgress(0.55, 'Planting the blossoms');
  // ---- bamboo
  const bam = []; const bg = new THREE.CylinderGeometry(0.075, 0.09, 1, 6, 1); bg.translate(0, 0.5, 0);
  const bamI = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color: 0x8fb058, roughness: 0.55 }), 700), mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), cc = new THREE.Color();
  for (let i = 0; i < 700; i++) { const x = rr(24, 42), z = rr(-23, -2); if (Math.hypot(x - 31, z + 11) < 5.6) { mtx.makeScale(0, 0, 0); bamI.setMatrixAt(i, mtx); continue; } const h = rr(7, 13); e.set(rr(-0.05, 0.05), rnd() * 6, rr(-0.05, 0.05)); q.setFromEuler(e); mtx.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, h, 1)); bamI.setMatrixAt(i, mtx); bamI.setColorAt(i, cc.set(0x8fb058).offsetHSL(rr(-0.03, 0.03), 0, rr(-0.06, 0.06))); bam.push(i); }
  bamI.castShadow = true; root.add(bamI);
  const leafTex = ctex(cvs(64, 128, (g, w, h) => { for (let i = 0; i < 16; i++) { g.fillStyle = ['#7aa040', '#9ac458', '#6a9038'][i % 3]; g.beginPath(); const x = w / 2 + rr(-6, 6), y = rr(14, h - 8), a = rr(-1.2, 1.2) + (i % 2 ? 0.6 : -0.6); g.ellipse(x, y, 4, 22, a, 0, TAU); g.fill(); } }));
  const lp = []; for (let i = 0; i < 260; i++) { const x = rr(24, 42), z = rr(-23, -2); if (Math.hypot(x - 31, z + 11) < 5.6) continue; lp.push({ x, y: rr(6, 12), z, s: rr(1.4, 2.4) }); }
  tufts(root, lp, leafTex, { w: 2.2, h: 2.2, sway: 0.05, alphaTest: 0.3 });
  // ---- sakura trees
  const bl = blossomCard(), petalGround = [], blossoms = [];
  for (const so of trunks) {
    const cx = (so.x0 + so.x1) / 2, cz = (so.z0 + so.z1) / 2, h = rr(7.5, 10);
    const tg = trunkGeo(cx, 0, cz, h, rr(0.55, 0.75)); const tm = new THREE.Mesh(tg, mats.trunk); tm.castShadow = true; tm.receiveShadow = true; world.add(tm);
    // branches
    const nb = 5 + ((rnd() * 3) | 0);
    for (let b = 0; b < nb; b++) {
      const a = (b / nb) * TAU + rnd(), len = rr(2.6, 4.6), y0 = h * rr(0.62, 0.9), tilt = rr(0.75, 1.1);
      const bg2 = new THREE.CylinderGeometry(0.06, 0.16, len, 6); bg2.translate(0, len / 2, 0); bg2.rotateZ(-tilt); bg2.rotateY(a); bg2.translate(cx, y0, cz);
      const bm = new THREE.Mesh(bg2, mats.trunk); bm.castShadow = true; world.add(bm);
      const ex = cx + Math.cos(a) * Math.sin(tilt) * len, ez = cz - Math.sin(a) * Math.sin(tilt) * len, ey = y0 + Math.cos(tilt) * len;
      for (let k = 0; k < 9; k++) blossoms.push({ x: ex + rr(-1.6, 1.6), y: ey + rr(-0.6, 1.4), z: ez + rr(-1.6, 1.6), s: rr(1.9, 3.1) });
    }
    for (let k = 0; k < 14; k++) blossoms.push({ x: cx + rr(-2, 2), y: h + rr(-0.5, 2), z: cz + rr(-2, 2), s: rr(2.2, 3.4) });
    for (let k = 0; k < 16; k++) { const a = rnd() * TAU, r = rr(0.8, 4.4); petalGround.push({ x: cx + Math.cos(a) * r, y: 0.05, z: cz + Math.sin(a) * r, s: rr(0.6, 1.3) }); }
  }
  mergeStatic(world);
  const blossomMat = new THREE.MeshLambertMaterial({ map: bl, alphaTest: 0.35, side: THREE.DoubleSide, emissive: 0x552030, emissiveIntensity: 0.35 });
  const bIm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), blossomMat, blossoms.length * 2);
  blossoms.forEach((p, i) => { for (let k = 0; k < 2; k++) { e.set(rr(-0.6, 0.6), rnd() * TAU, 0); q.setFromEuler(e); mtx.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s, p.s, p.s)); bIm.setMatrixAt(i * 2 + k, mtx); bIm.setColorAt(i * 2 + k, cc.set(0xffffff).offsetHSL(rr(-0.02, 0.02), 0, rr(-0.06, 0.03))); } });
  bIm.frustumCulled = false; bIm.castShadow = false; root.add(bIm);
  const petalTex = ctex(cvs(64, 64, (g, s) => { g.translate(s / 2, s / 2); for (let i = 0; i < 12; i++) { g.rotate(TAU / 12 + 0.4); g.fillStyle = ['#ffc1d6', '#ff9fc2', '#ffe0ea'][i % 3]; g.beginPath(); g.ellipse(rr(3, 13), 0, 5, 3, 0, 0, TAU); g.fill(); } }));
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), pgI = new THREE.InstancedMesh(flat, new THREE.MeshBasicMaterial({ map: petalTex, transparent: true, alphaTest: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), petalGround.length);
  petalGround.forEach((p, i) => { e.set(0, rnd() * TAU, 0); q.setFromEuler(e); mtx.compose(new THREE.Vector3(p.x, 0.045, p.z), q, new THREE.Vector3(p.s * 2.4, 1, p.s * 2.4)); pgI.setMatrixAt(i, mtx); });
  root.add(pgI);
  await onProgress(0.72, 'Grass, ferns and vines');
  // ground cover
  const gtex = grassCard(['#6f9a48', '#8ab058', '#5a8a3c']), gp = [];
  for (let i = 0; i < 2600; i++) {
    const x = (rnd() - 0.5) * 86, z = rr(-52, 42); const y = A.groundAt(x, z, 20); if (!Number.isFinite(y) || y > 0.05) continue;
    if (A.blocked(x, z, y, 0.2, 0.3)) continue;
    if (Math.abs(x) < 2.6 && z > -14 && z < 33) continue;   // keep the main path clear
    if (x > -36 && x < -20 && z > -18 && z < -3) continue;  // sand
    if (Math.abs(x) < 11.6 && z > -10.5 && z < 6.5) continue; // pond
    if (x > -31.5 && x < -18.5 && z > 2.5 && z < 15.5) continue; // tea house floor
    gp.push({ x, y, z, s: rr(0.7, 1.4) });
  }
  tufts(root, gp, gtex, { w: 0.8, h: 0.55, tint: ['#7aa652', '#8db85a', '#6a9a48'] });
  const vt = vineCard(['#5f8a44', '#7aaa54', '#4a7a38']), va = [];
  for (let i = 0; i < 14; i++) va.push({ x: -16.6, y: 9.6, z: -24 - i * 1.3, len: rr(2, 6), rot: Math.PI / 2 }, { x: 16.6, y: 9.6, z: -24 - i * 1.3, len: rr(2, 6), rot: -Math.PI / 2 });
  for (let i = 0; i < 18; i++) va.push({ x: -16 + i * 1.8, y: 9.9, z: -22.6, len: rr(2, 5), rot: 0 });
  vines(root, va, vt);
  // paper lantern strings between the pavilion posts and the tea house eaves
  const lanternRows = [[-16, 4.0, 18.6, -4, 4.0, 18.6], [-16, 4.0, 27.4, -4, 4.0, 27.4], [-32.6, 3.5, 1.4, -17.4, 3.5, 1.4], [-32.6, 3.5, 16.6, -17.4, 3.5, 16.6]];
  const chain = [];
  for (const [x0, y0, z0, x1, y1, z1] of lanternRows) { const n = 7; for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 - Math.sin(t * Math.PI) * 0.45, z = z0 + (z1 - z0) * t; const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), paper); m.scale.y = 1.25; m.position.set(x, y - 0.3, z); root.add(m); chain.push(m); gl(x, y - 0.3, z, 0xffa860, 1.8); } }
  // ---- the vault: door, sigil, interior lights
  const vaultG = new THREE.Group(); root.add(vaultG);
  const rimGold = new THREE.MeshStandardMaterial({ color: 0xc9a05a, metalness: 0.9, roughness: 0.3 }), doorMat = S(dark, { metalness: 0.7, roughness: 0.35 });
  const halves = [];
  for (const sg of [-1, 1]) {
    const half = new THREE.Group(); half.position.set(0, 4.6, -23.2);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.5, 40, 1, false, sg > 0 ? 0 : Math.PI, Math.PI), doorMat); disc.rotation.x = Math.PI / 2; disc.castShadow = true; half.add(disc);
    const sig = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32, sg > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI), new THREE.MeshBasicMaterial({ map: sigilTex(), fog: false })); sig.position.z = 0.27; half.add(sig);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI - Math.PI / 2 + (sg > 0 ? 0 : Math.PI); const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.16), rimGold); spoke.position.set(Math.cos(a) * 1.7, Math.sin(a) * 1.7, 0.3); spoke.rotation.z = a - Math.PI / 2; half.add(spoke); }
    half.userData.sg = sg; vaultG.add(half); halves.push(half);
  }
  const vRing = new THREE.Mesh(new THREE.TorusGeometry(3.85, 0.22, 10, 48), rimGold); vRing.position.set(0, 4.6, -23.05); vaultG.add(vRing);
  const doorGlow = glowSprite(glowTex, 0x7fe6ff, 9, 0, 4.6, -22.6, 0.25); root.add(doorGlow);
  // deep vault door (small, gold, sealed)
  const deep = new THREE.Group(); deep.position.set(0, 3.4, -43.7);
  const dd = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.4, 32), doorMat); dd.rotation.x = Math.PI / 2; deep.add(dd);
  const ds = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), new THREE.MeshBasicMaterial({ map: sigilTex(), fog: false })); ds.position.z = 0.21; deep.add(ds);
  const dRing = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.14, 8, 40), rimGold); deep.add(dRing); vaultG.add(deep);
  const deepLock = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.03, 6, 48), new THREE.MeshBasicMaterial({ color: 0xff5b6e })); deepLock.position.set(0, 3.4, -43.2); vaultG.add(deepLock);
  // vault interior glow: floor inlay lines, skylight beam, warm/cool lights
  strip(gold, 0, 1.63, -33, 0.12, 0.03, 20); strip(cyan, -6.4, 1.63, -33, 0.06, 0.03, 20); strip(cyan, 6.4, 1.63, -33, 0.06, 0.03, 20);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 8.4, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe4b8, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); beam.position.set(0, 6, -30); root.add(beam);
  for (const [x, z, c] of [[-10, -30, 0xffc890], [10, -30, 0xffc890], [0, -38, 0x8ae8ff]]) { const l = new THREE.PointLight(c, 46, 22, 1.4); l.position.set(x, 7, z); root.add(l); }
  for (const p of POI.weapons) { strip(gold, p.x, 2.72, p.z, 1.0, 0.02, 1.0); gl(p.x, 3.2, p.z, 0xffd890, 2.4); }
  for (const p of POI.operators) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.03, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffd890, fog: false })); r.rotation.x = Math.PI / 2; r.position.set(p.x, 2.03, p.z); root.add(r); }
  // ---- sky: sunset over layered mountains
  const skyGeo = new THREE.SphereGeometry(320, 18, 12), col = [], pp = skyGeo.attributes.position, c = new THREE.Color();
  const top = new THREE.Color(0x6a5a9a), mid = new THREE.Color(0xe89ab0), low = new THREE.Color(0xffd3a0);
  for (let i = 0; i < pp.count; i++) { const y = pp.getY(i) / 320; c.copy(y > 0 ? low.clone().lerp(mid, clamp(y * 3.2, 0, 1)).lerp(top, clamp((y - 0.18) * 2.2, 0, 1)) : low); col.push(c.r, c.g, c.b); }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -10; root.add(sky);
  const starPos = []; for (let i = 0; i < 700; i++) { const a = rnd() * TAU, e = 0.12 + rnd() * 1.3, r = 300; starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); root.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 14), new THREE.MeshBasicMaterial({ color: 0xe8f0ff, fog: false, transparent: true, opacity: 0 })); moon.position.set(120, 70, -200); root.add(moon);
  const moonGlow = glowSprite(glowTex, 0x9ab8ff, 260, 120, 70, -200, 0); root.add(moonGlow);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(16, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff2d8, fog: false })); sun.position.set(-120, 46, -230); root.add(sun);
  const sunGlow = glowSprite(glowTex, 0xffb890, 380, -120, 46, -230, 0.9); root.add(sunGlow);
  const mtn = new THREE.Group();
  const layers = [[210, 0xa89ab8, 46], [170, 0xb8a4bc, 34], [130, 0xc8b0c0, 24]];
  layers.forEach(([r, colr, hh], li) => { const m = new THREE.MeshBasicMaterial({ color: colr, fog: true }); for (let i = 0; i < 14; i++) { const a = -Math.PI * 0.9 + (i / 13) * Math.PI * 1.8 + li * 0.2, h = hh * rr(0.5, 1.2), w = rr(40, 70); const cone = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), m); cone.position.set(Math.sin(a) * r, h / 2 - 4, -Math.cos(a) * r); cone.rotation.y = rnd() * 3; mtn.add(cone); } });
  root.add(mtn);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8fa878, roughness: 1 })); outer.position.y = -0.7; outer.receiveShadow = true; root.add(outer);
  {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(envScene, 0.03).texture; scene.environmentIntensity = 1.0; pm.dispose();
  }
  scene.fog = new THREE.Fog(0xeed0dc, 40, 210); scene.background = new THREE.Color(0xf0c8d0);
  const hemi = new THREE.HemisphereLight(0xffe8f0, 0x8a9a70, 1.55); root.add(hemi);
  const dir = new THREE.DirectionalLight(0xffc890, 3.0); dir.position.set(-40, 34, -50); dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048);
  Object.assign(dir.shadow.camera, { left: -54, right: 54, top: 50, bottom: -50, near: 10, far: 180 }); dir.shadow.bias = -0.0006; dir.shadow.normalBias = 0.04; root.add(dir);
  // petals in the air (reuse the snow system, pink and slow)
  const petals = makeSnow(root, 1200, 76, 24, 0.3, 0xffb7d0);
  { const dot = ctex(cvs(32, 32, (g, s) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); })); petals.pts.material.map = dot; petals.pts.material.alphaTest = 0.05; petals.pts.material.needsUpdate = true; }
  // fireflies for the vault approach and garden dusk
  const fireflies = [], ffPos = new Float32Array(40 * 3), ffGeo = new THREE.BufferGeometry(); ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const ffPts = new THREE.Points(ffGeo, new THREE.PointsMaterial({ map: glowTex, color: 0xfff0a0, size: 0.7, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); ffPts.frustumCulled = false; root.add(ffPts);
  for (let i = 0; i < 40; i++) fireflies.push({ a: rnd() * TAU, r: rr(1, 4), cx: rr(-38, 38), cz: rr(-24, 40), y: rr(0.6, 2.6), sp: rr(0.3, 0.9), ph: rnd() * 9 });
  // static glows: one Points per size bucket
  for (const size of [...new Set(glowList.map((q) => q.s))]) { const list = glowList.filter((q) => q.s === size), pos = new Float32Array(list.length * 3), cols = new Float32Array(list.length * 3), cc2 = new THREE.Color(); list.forEach((q, i) => { pos.set([q.x, q.y, q.z], i * 3); cc2.set(q.c); cols.set([cc2.r, cc2.g, cc2.b], i * 3); }); const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g2.setAttribute('color', new THREE.BufferAttribute(cols, 3)); const pt = new THREE.Points(g2, new THREE.PointsMaterial({ map: glowTex, size, vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); pt.frustumCulled = false; root.add(pt); }
  const paperMats = [paper], todA = { sky: new THREE.Color(), fogA: new THREE.Color(0xeed0dc), fogB: new THREE.Color(0x232c4c), bgA: new THREE.Color(0xf0c8d0), bgB: new THREE.Color(0x141a36), hemA: new THREE.Color(0xffe8f0), hemB: new THREE.Color(0x5a6cb0), dirA: new THREE.Color(0xffc890), dirB: new THREE.Color(0x7a94d8), skyA: new THREE.Color(0xffffff), skyB: new THREE.Color(0x2c3868) };
  const glowMats = []; root.traverse((o) => { if (o.isPoints && o.material.blending === THREE.AdditiveBlending && o !== ffPts && o.material.vertexColors) glowMats.push(o.material); });
  const tod = (k) => {   // 0 golden hour .. 1 deep night
    scene.fog.color.lerpColors(todA.fogA, todA.fogB, k); scene.background.lerpColors(todA.bgA, todA.bgB, k); hemi.color.lerpColors(todA.hemA, todA.hemB, k); hemi.intensity = 1.55 - 1.0 * k;
    dir.color.lerpColors(todA.dirA, todA.dirB, k); dir.intensity = 3.0 - 2.35 * k; dir.position.set(-40 + 80 * k, 34 - 8 * k, -50 + 20 * k); sky.material.color.lerpColors(todA.skyA, todA.skyB, k);
    stars.material.opacity = clamp((k - 0.35) * 1.6, 0, 0.95); moon.material.opacity = clamp((k - 0.4) * 1.8, 0, 1); moonGlow.material.opacity = clamp((k - 0.4) * 0.9, 0, 0.55); sunGlow.material.opacity = 0.9 * (1 - k); sun.visible = k < 0.85;
    for (const m of glowMats) m.opacity = 0.5 + 0.5 * k; ffPts.material.opacity = 0.35 + 0.6 * k; paper.emissiveIntensity = 1.8 + 1.6 * k; scene.environmentIntensity = 1.0 - 0.6 * k;
    hubState.night = k;
  };
  const hubState = { tod, night: 0, lock: null, doorOpen: 0, doorTarget: 0, deepOpen: 0, deepTarget: 0, koi, koiLure: null, bellSwing: 0, bell, bellTop };
  petals.extra = (dt, t) => {
    wind.value = t; { const k = hubState.lock != null ? hubState.lock : clamp((0.5 - 0.5 * Math.cos(t * TAU / 480 - 0.6)) * 1.08 - 0.04, 0, 1); tod(hubState.lock != null ? k : Math.min(k, 0.84)); }
    wn.offset.set(t * 0.012, t * 0.008);
    for (const k of koi) {
      k.a += k.sp * dt; let x = Math.cos(k.a) * k.r * 1.5, z = -2 + Math.sin(k.a * 1.3 + k.ph) * k.r * 0.8;
      if (hubState.koiLure) { const lx = hubState.koiLure.x, lz = hubState.koiLure.z; k.lure = Math.min(1, k.lure + dt * 0.5); x += (lx - x) * 0.6 * k.lure; z += (lz - z) * 0.6 * k.lure; } else k.lure = Math.max(0, k.lure - dt * 0.4);
      x = clamp(x, -10, 10); z = clamp(z, -9, 5);
      const dx = x - k.m.position.x, dz = z - k.m.position.z; if (dx * dx + dz * dz > 1e-6) k.m.rotation.y = damp2(k.m.rotation.y, Math.atan2(dx, dz) + Math.PI, 6 * dt);
      k.m.position.x = x; k.m.position.z = z;
    }
    fireflies.forEach((f, i) => { f.a += f.sp * dt; ffPos[i * 3] = f.cx + Math.cos(f.a) * f.r; ffPos[i * 3 + 1] = f.y + Math.sin(t * 1.3 + f.ph) * 0.3; ffPos[i * 3 + 2] = f.cz + Math.sin(f.a * 1.2) * f.r; }); ffGeo.attributes.position.needsUpdate = true; ffPts.material.opacity = 0.55 + 0.3 * Math.sin(t * 1.7);
    altarRing.rotation.z += dt * 0.6; altarRing2.rotation.x += dt * 0.9; altarRing2.rotation.y += dt * 0.5; altarCore.rotation.y += dt * 1.2; altarCore.position.y = 1.5 + Math.sin(t * 1.6) * 0.12;
    for (const m of chain) m.position.y += Math.sin(t * 1.4 + m.position.x) * 0.0008;
    beam.material.opacity = 0.085 + Math.sin(t * 0.7) * 0.025;
    // doors ease open / shut
    const S1 = hubState;
    S1.doorOpen += (S1.doorTarget - S1.doorOpen) * Math.min(1, dt * 1.1); S1.deepOpen += (S1.deepTarget - S1.deepOpen) * Math.min(1, dt * 1.4);
    for (const h of halves) { h.position.x = h.userData.sg * S1.doorOpen * 4.4; h.rotation.z = h.userData.sg * S1.doorOpen * 0.5; }
    vRing.rotation.z += dt * 0.05; doorGlow.material.opacity = 0.22 + Math.sin(t * 1.2) * 0.06 + S1.doorOpen * 0.3;
    deep.position.y = 3.4 + S1.deepOpen * 3.4; deepLock.visible = S1.deepTarget === 0; deepLock.rotation.z += dt * 0.7;
    S1.bellSwing *= Math.exp(-dt * 0.9); const sw = Math.sin(t * 6) * S1.bellSwing * 0.35; bell.rotation.z = sw; bellTop.rotation.z = sw;
  };
  await onProgress(1, 'Ready');
  return { root, sky, dir, hemi, mats, glow, snow: petals, hub: hubState, vaultG };
}
const damp2 = (a, b, k) => { let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * Math.min(1, k); };
