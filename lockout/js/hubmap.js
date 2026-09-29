// SANCTUM: the solo hub. A utopian art-deco plaza: reflecting pool with fountains, marble goddesses and guardians, gold-inlaid promenades,
// a mission colonnade, a cafe, a carillon tower, a void obelisk and, at the north end, the Vault archive with exhibits, dioramas and a sealed deep vault.
// Collision is axis-aligned solids (defineSanctum); everything you see is built in hubdeco.js.
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
  weapons: [], exotics: [], operators: [], maps: [], statues: [],
};
// weapon plinths: 11 along the west wing
{
  const ids = ['br', 'magnum', 'smg', 'shotgun', 'sniper', 'rocket', 'carbine', 'plasmarifle', 'needler', 'hammer', 'sword'];
  ids.forEach((id, i) => { const col = i < 6 ? 0 : 1, row = col ? i - 6 : i; POI.weapons.push({ id, x: col ? -8.4 : -12.8, y: 2.7, z: -27.4 - row * 2.7 - (col ? 1.35 : 0) }); });
  ['hawkmoon', 'lastword', 'felwinter', 'gjallarhorn', 'thorn'].forEach((id, i) => POI.exotics.push({ id, x: [-3.6, 3.6, -3.6, 3.6, 0][i], y: 2.7, z: [-45.8, -45.8, -49.6, -49.6, -50.3][i] }));
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
  [...POI.weapons, ...POI.exotics].forEach((w) => box(w.x - 0.6, w.x + 0.6, w.z - 0.6, w.z + 0.6, 1.6, 2.7, 'plinth'));
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
  // marble statues: goddesses and guardians on pedestals (colliders here, figures built in hubdeco)
  {
    const S = POI.statues, face = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
    S.push({ k: 'goddess', x: -6.5, z: 32, y: 0, top: 1.5, hw: 0.9, yaw: -1.9, name: 'AURORA', epi: 'First Light', lore: 'She stands where the city wakes. The story goes that the first dawn in the Sanctum began at her raised hand.' });
    S.push({ k: 'goddess', x: 6.5, z: 32, y: 0, top: 1.5, hw: 0.9, yaw: 1.9, name: 'SELENE', epi: 'Keeper of Night', lore: 'The city never fully sleeps because she does not. Her ring brightens for the ones still awake.' });
    S.push({ k: 'goddess', x: -6.2, z: -2, y: 0, top: 1.7, hw: 1.0, yaw: -Math.PI / 2, name: 'THALASSA', epi: 'Mother of Still Water', lore: 'Every fountain in the plaza is her breath. Feed the koi and she is said to smile.' });
    S.push({ k: 'goddess', x: 6.2, z: -2, y: 0, top: 1.7, hw: 1.0, yaw: Math.PI / 2, name: 'NIKE', epi: 'Quiet Victory', lore: 'No banner, no fanfare. She marks every win on a wall nobody has found.' });
    S.push({ k: 'goddess', x: -31, z: -11, y: 0, top: 1.9, hw: 1.5, yaw: -Math.PI / 2, name: 'EOS', epi: 'Mother of Halos', lore: 'The first operator, the last word. The Archangel unlock is her likeness, and the rest of the choir is arranged around her.' });
    S.push({ k: 'guardian', x: -27.5, z: -14.5, y: 0, top: 1.4, hw: 1.1, yaw: face(-27.5, -14.5, -31, -11), name: 'THE FIRST WARDEN', epi: 'Shield of the Vault', lore: 'Tower shield, no sword. His only order was to stand between the Vault and everything else.' });
    S.push({ k: 'goddess', x: -24, z: -7, y: 0, top: 1.3, hw: 0.9, yaw: -0.9, name: 'IRIS', epi: 'Herald', lore: 'She carries messages that were never written down. Rumor says one of them is about you.' });
    S.push({ k: 'guardian', x: -33, z: -6.5, y: 0, top: 1.3, hw: 1.0, yaw: face(-33, -6.5, -31, -11), name: 'THE SECOND WARDEN', epi: 'Spear of Dusk', lore: 'He walks the wall each evening. The spear has never been thrown, and never needed to be.' });
    S.push({ k: 'goddess', x: -22, z: -13, y: 0, top: 1.1, hw: 0.8, yaw: -2.3, name: 'HESTIA', epi: 'Hearth', lore: 'Warm stone, always. She is why the cafe never feels empty, even at night.' });
    [[25, -4], [25, -11.5], [25, -19], [38, -4], [38, -11.5], [38, -19]].forEach(([x, z], i) => S.push({ k: 'guardian', x, z, y: 0, top: 1.2, hw: 1.0, yaw: face(x, z, 31, -11), name: ['ARES', 'ATLAS', 'AEGIS', 'ORION', 'TITAN', 'VANGUARD'][i], epi: ['Edge of Dawn', 'Bearer', 'The Unbroken', 'Long Watch', 'Ground Held', 'First Through'][i], lore: ['He faces the obelisk with the blade half drawn, as if the void might answer.', 'The sky rests on his shield. He has stopped noticing.', 'Struck by everything, cracked by nothing.', 'He watches the horizon so the rest of the plaza does not have to.', 'You can lean on him. He would tell you to, if he spoke.', 'When the gate opened, he was already through it.'][i] }));
    S.push({ k: 'guardian', x: -9.5, z: -19.4, y: 1.6, top: 1.7, hw: 1.5, yaw: Math.PI + 0.25, big: 1.75, name: 'THE GATEKEEPER OF DAWN', epi: 'Left Hand of the Vault', lore: 'Twice the height of the operators he guards. His shield bears the halo, and the halo bears his name.' });
    S.push({ k: 'guardian', x: 9.5, z: -19.4, y: 1.6, top: 1.7, hw: 1.5, yaw: Math.PI - 0.25, big: 1.75, name: 'THE GATEKEEPER OF DUSK', epi: 'Right Hand of the Vault', lore: 'He and his twin have never spoken. Together they have never lost a door.' });
    for (const q of S) box(q.x - q.hw, q.x + q.hw, q.z - q.hw, q.z + q.hw, q.y, q.y + q.top, 'pedestal');
  }
  box(-28.6, -25.4, -4.4, -3.6, 0, 0.5, 'bench');
  // pagoda + bell frame
  box(22, 28, 12, 18, 0, 2, 'pagoda'); box(23.6, 26.4, 13.6, 16.4, 2, 12, 'pagoda');
  box(23.3, 23.7, 19.4, 20.2, 0, 3, 'post'); box(26.3, 26.7, 19.4, 20.2, 0, 3, 'post'); box(23.3, 26.7, 19.4, 20.2, 2.9, 3.2, 'post');
  // void altar dais
  box(28.5, 33.5, -13.5, -8.5, 0, 0.4, 'altar');
  // clipped hedges along the approach
  for (const sg of [-1, 1]) { box(sg * 4.8 - 0.4, sg * 4.8 + 0.4, 28.5, 36, 0, 0.95, 'hedge'); box(sg * 4.8 - 0.4, sg * 4.8 + 0.4, 7, 15, 0, 0.95, 'hedge'); }
  // trees, lanterns
  A.trees = [[-14, 31], [14, 31], [-16, 8], [15, 4], [17, -10], [-15, -8], [-9, -14.5], [9, -14.5], [-22, 26], [22, 28], [23, -15], [-24, 20], [34, 4], [-38, 10], [40, 26], [-36, -26], [-20, -32], [23, -32], [36, 30], [-38, 34]];
  for (const [x, z] of A.trees) box(x - 0.6, x + 0.6, z - 0.6, z + 0.6, 0, 16, 'trunk');
  A.lanterns = [[-3.6, 20], [3.6, 20], [-3.6, 15], [3.6, 15], [-3.6, 10.5], [3.6, 10.5], [-6.4, -12], [6.4, -12], [-8.4, 3.6], [8.4, 3.6], [-21, -4], [-13, 8], [20, 8], [12.5, 24], [-12.5, 24], [30, 6], [22, -2], [-17, -20], [17, -25]];
  for (const [x, z] of A.lanterns) box(x - 0.35, x + 0.35, z - 0.35, z + 0.35, 0, 1.9, 'lantern');
  return {
    bounds: { x: 43, z: 47 }, kill: -60, spawns: { red: [{ ...POI.spawn }], blue: [{ ...POI.spawn }] }, pickups: [],
    map: { id: 'sanctum', nav: { x0: -43, x1: 43, z0: -53, z1: 43 }, obj: {} }, doors: { main: doorMain, deep: doorDeep },
  };
}

export { buildSanctumVisuals } from './hubdeco.js';
