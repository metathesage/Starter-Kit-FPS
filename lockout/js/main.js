// Bootstrap, screen flow, camera, main loop.
import * as THREE from 'three';
import { $, $$, clamp, lerp, damp, nextFrame, store, save, forward, TAU, angDiff } from './util.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import * as World from './world.js';
import { WAIFUS, TEAM, buildWaifu, animateRig, disposeRig } from './rig.js';
import { WEAPONS, loadWeaponModels } from './weapons.js';
import { loadAngel } from './angel.js';
import { Profile, rollCallsign } from './profile.js';
import { MODES } from './modes.js';
import { showArmory, showRecord, emblemHtml, titleText } from './armory.js';
import * as C from './catalog.js';
import { Challenges } from './challenges.js';
import { FX } from './fx.js';
import { Viewmodel } from './fps.js';
import { Match, DIFFICULTY } from './match.js';
import { HUD, glyph, svg, MEDAL_ICONS } from './hud.js';
import { UI } from './ui.js';
import { Net, friendlyError } from './net.js';
import { initTouch } from './touch.js';

const Q = new URLSearchParams(location.search);
const settings = Object.assign({ sens: 1, padSens: 1, invertY: false, fov: 66, master: 0.8, sfx: 1, music: 0.5, shadows: true, quality: 'auto', reticle: '#ffffff', hudScale: 1, announcer: false }, store('settings', {}));
const loadout = Object.assign({ waifu: 0, team: 'blue', diff: 'normal', limit: 25, helmet: false, map: 'lockout', mode: 'slayer', variant: 'standard', limits: {} }, store('loadout', {}));
if (!MODES[loadout.mode]) loadout.mode = 'slayer';
if (Q.get('mode') && MODES[Q.get('mode')]) loadout.mode = Q.get('mode');
if (Q.get('variant')) loadout.variant = Q.get('variant');
const limitOf = () => { const l = MODES[loadout.mode].limits, v = loadout.limits && loadout.limits[loadout.mode]; return l.includes(v) ? v : l[1]; };
const haloHex = (id) => { const h = C.HALOS.find((x) => x.id === (id || Profile.d.eq.halo)); return h ? h.color : undefined; };
const skinHex = (id) => { const s = C.SKINS.find((x) => x.id === (id || Profile.d.eq.skin)); return s ? s.tint : null; };
const VARIANTS = [['standard', 'STANDARD'], ['lowgrav', 'LOW GRAVITY'], ['fiesta', 'FIESTA'], ['snipers', 'SNIPERS'], ['swords', 'SWORDS + MAGNUMS']];
if (!VARIANTS.some((v) => v[0] === loadout.variant)) loadout.variant = 'standard';
const matchCfg = () => ({ variant: loadout.variant, mode: loadout.mode, limit: limitOf(), haloColor: haloHex(), skinTint: skinHex() });
{ const i = WAIFUS.findIndex((w) => w.id === Profile.d.eq.operator); if (i >= 0) loadout.waifu = i; else loadout.waifu = 0; }
if (Q.get('map')) loadout.map = Q.get('map');
if (!['lockout', 'cryostat', 'mesa'].includes(loadout.map)) loadout.map = 'lockout';
const persist = () => { save('settings', settings); save('loadout', loadout); };

const EXPOSURE = { lockout: 1.05, cryostat: 1.3, mesa: 0.95 };
// title-screen framing per map: operator position, camera position, look-at
const MENU = {
  lockout: { show: [-24.6, 4, 2.6], cam: [-27.3, 5.2, 4.7], look: [-22.4, 5.0, -0.2] },
  cryostat: { show: [-29.4, 3, -2.2], cam: [-33.6, 4.5, 2.4], look: [-24.4, 4.3, -4.4] },
  mesa: { show: [-29.6, 3, 1.4], cam: [-32.3, 4.2, 3.5], look: [-27.4, 4.0, -1.4] },
};
const TIPS = [
  'Shields recharge after a few seconds out of fire. Break line of sight, then re-peek.',
  'The sniper spawns on the center tower. Whoever holds the tower holds the yard.',
  'Grenade, then melee. The old combo still works.',
  'Hit the head. Every gun in the yard pays out extra for it.',
  'Plasma sticks. Frags bounce. Learn which one to throw around a corner.',
  'The overshield sits behind the catwalk. Bots know where it is. So should you.',
  'An energy sword lunge can cross the room. Do not lunge into a shotgun.',
  'Melee from behind ends the argument.',
  'Perfect: land every shot, finish on the head, take no damage. It pays 40 XP.',
  'Carrying the flag slows you down. Escort it, or die with it.',
  'The Oddball carrier cannot shoot. Stand near them, not in front of them.',
  'In Rumble Pit the kill leader is marked for everyone. Wear the crown carefully.',
];

// ---- renderer -----------------------------------------------------------------------
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.autoClear = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 700);
camera.rotation.order = 'YXZ';
let resScale = 1, W = 1, H = 1;
function resize() {
  W = innerWidth; H = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2) * resScale);
  renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  document.documentElement.style.setProperty('--ui', clamp(Math.min(W / 1600, H / 900) * (settings.hudScale || 1), 0.6, 1.7));
}
addEventListener('resize', resize);

// ---- state ----------------------------------------------------------------------------
let state = 'splash', world = null, fx = null, viewmodel = null, hud = null, match = null, showcase = null;
let trauma = 0, camKick = 0, fovCur = 62, menuT = 0, last = performance.now(), padCrouch = false, fpsAcc = 0, fpsN = 0, showFps = Q.has('fps'), muted = false;
let hitstop = 0, showWeapon = null, mstats = null, lastDevice = 'kbm', endShown = false, quick = Q.has('quick'), fast = Q.has('fast') || Q.has('quick'), netAcc = 0, netEdges = 0;
const shakeN = { t: 0 };
window.__game = { Net, hostLobby: () => hostLobby(), joinLobby: (c) => joinLobby(c), startOnlineHost: () => startOnlineHost(), renderer, get fx() { return fx; }, get match() { return match; }, get state() { return state; }, get scene() { return scene; }, get camera() { return camera; }, start: () => startMatch(), Input, THREE };

function applySettings() {
  Input.sens = settings.sens; Input.padSens = settings.padSens; Input.invertY = settings.invertY;
  Sound.setVolume(muted ? 0 : settings.master, settings.sfx, settings.music);
  renderer.shadowMap.enabled = settings.shadows;
  document.documentElement.style.setProperty('--ret', settings.reticle);
  Sound.announcer = !!settings.announcer;
  const q = { high: 1, medium: 0.8, low: 0.6 }[settings.quality]; if (q && resScale !== q) { resScale = q; resize(); } else if (!q) resize();
  if (world) world.dir.castShadow = settings.shadows;
}

// ---- boot ------------------------------------------------------------------------------
const setProg = (p, label) => {
  $('#loadPct').textContent = String(Math.round(p * 100)).padStart(3, '0');
  $('#loadBar').style.width = p * 100 + '%';
  if (label) $('#loadStage').textContent = label;
  return nextFrame();
};

async function boot() {
  const touchDevice = initTouch();
  if (touchDevice) { if (store('settings', {}).shadows === undefined) settings.shadows = false; resScale = 0.75; }
  resize(); applySettings();
  Input.init(canvas);
  Input.onLockChange = (locked) => { if (!locked && state === 'playing' && !Input.fallback) pauseGame(); };
  Input.onPadLost = () => { if (state === 'playing') pauseGame(); };
  const unlock = () => Sound.unlock();
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) => addEventListener(e, unlock, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pauseGame(); });
  addEventListener('blur', () => { if (state === 'playing') pauseGame(); });
    requestAnimationFrame(loop);
  UI.show('splash');
  if (!fast) {
    const t0 = performance.now();
    await new Promise((res) => { const chk = () => { if ((performance.now() - t0 > 3600) || (performance.now() - t0 > 900 && (Input.any() || skipSplash))) res(); else setTimeout(chk, 50); }; chk(); });
  }
  state = 'loading';
  UI.show('loading');
  $('#loadTip').textContent = TIPS[(Math.random() * TIPS.length) | 0];
  const tipTimer = setInterval(() => { $('#loadTip').textContent = TIPS[(Math.random() * TIPS.length) | 0]; }, 3200);
  await setProg(0.02, 'Igniting renderer');
  world = await World.loadMap(scene, renderer, loadout.map, (p, l) => setProg(0.02 + p * 0.5, l));
  renderer.toneMappingExposure = EXPOSURE[loadout.map] || 1.05;
  await setProg(0.55, 'Charting nav mesh');
  await setProg(0.62, 'Checking weapon models');
  try { setProg(0.6, 'Operators'); await loadAngel(); } catch (e) { console.warn('angel model unavailable, using classic body', e); }
  try { const got = await loadWeaponModels((l) => setProg(0.64, l)); if (got.length) console.info('custom weapon models:', got.join(', ')); } catch (e) { console.warn(e); }
  await setProg(0.7, 'Rigging operators');
  fx = new FX(scene);
  viewmodel = new Viewmodel();
  hud = new HUD($('#hud'));
  rebuildShowcase();
  await setProg(0.86, 'Compiling shaders');
  { const mc = MENU[loadout.map]; camera.position.set(...mc.cam); camera.lookAt(...mc.look); }
  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
  renderer.render(scene, camera);
  await setProg(1, 'Ready');
  applySettings();
  clearInterval(tipTimer);
  await new Promise((r) => setTimeout(r, quick ? 0 : 350));
  buildMenus(); wireNet();
  const jc = Q.get('join');
  if (quick) { showTitle(); startMatch(); } else if (jc) { showTitle(); openOnline(); const inp = $('#joinCode'); if (inp) inp.value = jc.toUpperCase(); joinLobby(jc); } else showTitle();
}
let skipSplash = false;
addEventListener('click', () => { skipSplash = true; });

// ---- menus ---------------------------------------------------------------------------------
let cardsRow = null, cardEls = [];
function buildMenus() {
  // controls screen
  const K = [['Move', 'W A S D'], ['Look', 'MOUSE'], ['Fire', 'LMB'], ['Zoom', 'RMB'], ['Jump', 'SPACE'], ['Crouch', 'C'], ['Reload', 'R'], ['Pick up / swap', 'E'], ['Swap weapon', 'Q'], ['Grenade', 'G'], ['Switch grenade', 'T'], ['Melee', 'F'], ['Scoreboard', 'TAB'], ['Chase camera', 'V'], ['Pause', 'ESC']];
  const P = [['Move', 'LS'], ['Look', 'RS'], ['Fire', 'RT'], ['Grenade', 'LT'], ['Zoom', 'RS'], ['Jump', 'A'], ['Melee', 'B'], ['Reload / pick up', 'X'], ['Swap weapon', 'Y'], ['Switch grenade', 'LB'], ['Crouch', 'LS'], ['Scoreboard', 'VIEW'], ['Pause', 'MENU']];
  const cap = (t) => t.split(' ').map((x) => `<span class="glyph">${x}</span>`).join('');
  const pad = (t) => `<span class="glyph pad ${['A', 'B', 'X', 'Y'].includes(t) ? t : 'wide'}">${t}</span>`;
  $('#ctrlGrid').innerHTML = `<div class="ctrl-col"><h3>KEYBOARD + MOUSE</h3>${K.map(([a, b]) => `<div class="ctrl-row"><span>${a}</span><span>${cap(b)}</span></div>`).join('')}</div>
    <div class="ctrl-col"><h3>XBOX CONTROLLER</h3>${P.map(([a, b]) => `<div class="ctrl-row"><span>${a}</span><span>${pad(b)}</span></div>`).join('')}</div>`;
}

function refreshPrompts() {
  UI.prompts($('#titlePrompts'), [['up+down', 'NAVIGATE'], ['confirm', 'SELECT'], ['back', 'BACK']]);
  UI.prompts($('#setupPrompts'), [['left+right', 'CHANGE'], ['confirm', 'CONFIRM'], ['back', 'BACK']]);
}

function rebuildShowcase(pv = {}) {
  if (showcase) { scene.remove(showcase.root); disposeRig(showcase); }
  const w = WAIFUS.find((x) => x.id === pv.operator) || WAIFUS[loadout.waifu];
  showcase = buildWaifu({ team: loadout.team, hair: w.hair, eye: w.eye, helmet: loadout.helmet, haloColor: haloHex(pv.halo), skin: skinHex(pv.skin) });
  showcase.root.position.set(...MENU[loadout.map].show); showcase.root.rotation.y = 1.75; scene.add(showcase.root);
}

function setHero() {
  const w = WAIFUS[loadout.waifu];
  $('#hcRole').textContent = w.role; $('#hcName').textContent = w.name; $('#hcBlurb').textContent = w.blurb;
  const c = '#' + new THREE.Color(w.hair).getHexString();
  $('#hcName').style.textShadow = `0 0 40px ${c}88, 0 6px 24px rgba(0,0,0,.5)`;
  if (showcase) { if (fx) fx.sparks(showcase.root.position.x, 6.4, showcase.root.position.z, 0, 1, 0, 14, [(w.hair >> 16 & 255) / 255, (w.hair >> 8 & 255) / 255, (w.hair & 255) / 255], 4); }
}

function showTitle() {
  state = 'menu';
  document.body.classList.remove('playing');
  hud.root.classList.add('hidden');
  const menu = $('#titleMenu'); menu.innerHTML = '';
  const rows = [
    UI.item(menu, 'Quick Play', '01', () => quickPlay()),
    UI.item(menu, 'Custom Game', '02', () => showSetup()),
    UI.item(menu, 'Play Online', '03', () => openOnline()),
    UI.item(menu, 'Armory', '04', () => openArmory()),
    UI.item(menu, 'Service Record', '05', () => openRecord()),
    UI.item(menu, 'Controls', '06', () => showControls('title')),
    UI.item(menu, 'Settings', '07', () => showSettings(() => showTitle())),
  ];
  renderPCard();
  UI.show('title', { rows });
  $('#btnFull').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); };
  $('#btnMute').onclick = () => { muted = !muted; applySettings(); UI.toast(muted ? 'AUDIO MUTED' : 'AUDIO ON'); };
  setHero(); refreshPrompts();
  Sound.music('menu'); Sound.ambience(loadout.map === 'lockout' ? 'hum' : 'wind');
  $('#hero-fallback')?.remove();
}

// random mode + map, saved settings otherwise; does not overwrite your custom-game choices
function quickPlay() {
  const modes = Object.keys(MODES), maps = World.MAP_LIST.map((x) => x.id);
  const keep = { mode: loadout.mode, map: loadout.map, variant: loadout.variant };
  loadout.mode = modes[(Math.random() * modes.length) | 0]; loadout.map = maps[(Math.random() * maps.length) | 0];
  loadout.variant = Math.random() < 0.65 ? 'standard' : VARIANTS[1 + ((Math.random() * (VARIANTS.length - 1)) | 0)][0];
  UI.toast(`${MODES[loadout.mode].name} · ${World.MAP_LIST.find((x) => x.id === loadout.map).name}${loadout.variant !== 'standard' ? ' · ' + VARIANTS.find((v) => v[0] === loadout.variant)[1] : ''}`, 2200);
  startMatch().then(() => { loadout.mode = keep.mode; loadout.map = keep.map; loadout.variant = keep.variant; });
}

function renderPCard() {
  const d = Profile.d;
  $('#pCard').innerHTML = `${emblemHtml(d.eq.emblem, 58)}<div><div class="rc-tag">${Profile.callsign}</div><div class="rc-title">${titleText(d.eq.title)}</div><div class="rc-rank">${Profile.rank} · LVL ${Profile.level}</div><div class="xp-bar"><i style="width:${Profile.progress() * 100}%"></i></div></div>`;
}
function openArmory() {
  showArmory({
    back: () => { showWeapon = null; rebuildShowcase(); setHero(); showTitle(); },
    preview: (p) => { showWeapon = p.weapon || null; if (p.reset) rebuildShowcase(); else if (p.skin) rebuildShowcase(p); else if (p.weapon) { if (!showcase) rebuildShowcase(); } else rebuildShowcase(p); },
    onEquip: (cat, id) => { if (cat === 'operator') { loadout.waifu = Math.max(0, WAIFUS.findIndex((w) => w.id === id)); persist(); } rebuildShowcase(); renderPCard(); },
  });
}
function openRecord() { showRecord({ back: () => showTitle(), onChange: () => renderPCard() }); }

function showControls(from) {
  const b = $('#btnCtrlBack'); UI.button(b, () => back());
  const back = () => (from === 'pause' ? pauseMenu() : showTitle());
  UI.show('controls', { rows: [b], onBack: back });
}

function showSettings(backFn) {
  const box = $('#settingsOpts'); box.innerHTML = '';
  const rows = [];
  rows.push(UI.slider(box, 'Mouse sensitivity', 0.2, 3, 0.1, settings.sens, (v) => v.toFixed(1), (v) => { settings.sens = v; applySettings(); persist(); }));
  rows.push(UI.slider(box, 'Stick sensitivity', 0.3, 2.5, 0.1, settings.padSens, (v) => v.toFixed(1), (v) => { settings.padSens = v; applySettings(); persist(); }));
  rows.push(UI.choice(box, 'Invert Y', [{ label: 'OFF', value: false }, { label: 'ON', value: true }], settings.invertY ? 1 : 0, (v) => { settings.invertY = v; applySettings(); persist(); }));
  rows.push(UI.slider(box, 'Field of view', 50, 90, 2, settings.fov, (v) => v + '°', (v) => { settings.fov = v; persist(); }));
  rows.push(UI.slider(box, 'Master volume', 0, 1, 0.05, settings.master, (v) => Math.round(v * 100) + '%', (v) => { settings.master = v; applySettings(); persist(); }));
  rows.push(UI.slider(box, 'Effects', 0, 1, 0.05, settings.sfx, (v) => Math.round(v * 100) + '%', (v) => { settings.sfx = v; applySettings(); persist(); }));
  rows.push(UI.slider(box, 'Music', 0, 1, 0.05, settings.music, (v) => Math.round(v * 100) + '%', (v) => { settings.music = v; applySettings(); persist(); }));
  rows.push(UI.choice(box, 'Render quality', [{ label: 'AUTO', value: 'auto' }, { label: 'HIGH', value: 'high' }, { label: 'MEDIUM', value: 'medium' }, { label: 'LOW', value: 'low' }], ['auto', 'high', 'medium', 'low'].indexOf(settings.quality), (v) => { settings.quality = v; applySettings(); persist(); }));
  rows.push(UI.slider(box, 'HUD size', 0.7, 1.4, 0.1, settings.hudScale, (v) => Math.round(v * 100) + '%', (v) => { settings.hudScale = v; resize(); persist(); }));
  rows.push(UI.choice(box, 'Reticle colour', [{ label: 'WHITE', value: '#ffffff' }, { label: 'CYAN', value: '#7fe6ff' }, { label: 'GREEN', value: '#7dff9b' }, { label: 'GOLD', value: '#ffd84a' }], ['#ffffff', '#7fe6ff', '#7dff9b', '#ffd84a'].indexOf(settings.reticle), (v) => { settings.reticle = v; applySettings(); persist(); }));
  rows.push(UI.choice(box, 'Announcer voice', [{ label: 'OFF', value: false }, { label: 'ON', value: true }], settings.announcer ? 1 : 0, (v) => { settings.announcer = v; applySettings(); persist(); if (v) Sound.say('Announcer online'); }));
  rows.push(UI.choice(box, 'Shadows', [{ label: 'ON', value: true }, { label: 'OFF', value: false }], settings.shadows ? 0 : 1, (v) => { settings.shadows = v; applySettings(); persist(); }));
  const b = $('#btnSetBack'); UI.button(b, backFn); rows.push(b);
  UI.show('settings', { rows, onBack: backFn });
}

function callsignRow(box) {
  const row = document.createElement('div'); row.className = 'opt';
  row.innerHTML = '<span class="lbl">Callsign</span><span class="val"><input class="join-input tag" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Callsign"><button aria-label="Roll a new callsign" class="roll"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 4v5h-5M4 20v-5h5"/></svg></button></span>';
  box.appendChild(row);
  const inp = row.querySelector('input'); inp.value = Profile.callsign;
  const commit = () => { inp.value = Profile.setCallsign(inp.value); };
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); commit(); inp.blur(); } });
  inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9_ ]/g, ''); });
  inp.addEventListener('blur', commit);
  const roll = () => { inp.value = Profile.setCallsign(rollCallsign()); };
  row.querySelector('.roll').onclick = (e) => { e.stopPropagation(); roll(); };
  row._act = () => { roll(); }; row.onclick = () => inp.focus();
  return row;
}

function variantRow(box) {
  return UI.choice(box, 'Variant', VARIANTS.map(([v, l]) => ({ label: l, value: v })), VARIANTS.findIndex((v) => v[0] === loadout.variant), (v) => { loadout.variant = v; persist(); });
}
function modeRow(box, rebuild) {
  const ids = Object.keys(MODES);
  const row = UI.choice(box, 'Game mode', ids.map((k) => ({ label: MODES[k].name, value: k })), ids.indexOf(loadout.mode), (v) => { if (v !== loadout.mode) { loadout.mode = v; persist(); rebuild(); } });
  return row;
}
function limitRow(box) {
  const md = MODES[loadout.mode], ls = md.limits;
  return UI.choice(box, md.unit === 'SECONDS' ? 'Hold time' : md.unit === 'CAPTURES' ? 'Captures to win' : 'Score to win', ls.map((n) => ({ label: n + ' ' + md.unit, value: n })), ls.indexOf(limitOf()), (v) => { loadout.limits = loadout.limits || {}; loadout.limits[loadout.mode] = v; persist(); });
}

function showSetup(focusRow) {
  const cards = $('#waifuCards'); cards.innerHTML = '';
  cardEls = WAIFUS.map((w, i) => {
    const c = document.createElement('div'); c.className = 'card'; c.style.setProperty('--c', '#' + new THREE.Color(w.hair).getHexString());
    const need = C.OPERATOR_UNLOCK[w.id] || 1, locked = Profile.level < need; c.classList.toggle('locked', locked);
    c.innerHTML = `<div class="cr">${w.role}</div><div class="cn">${w.name}</div><div class="cb">${w.blurb}</div>${locked ? `<div class="lk">LEVEL ${need}</div>` : ''}`;
    c.onclick = (e) => { e.stopPropagation(); select(i, 0); Sound.unlock(); Sound.play('menuMove', { vol: 0.6 }); };
    cards.appendChild(c); return c;
  });
  const isLocked = (i) => Profile.level < (C.OPERATOR_UNLOCK[WAIFUS[i].id] || 1);
  const select = (i, dir = 1) => { i = (i + WAIFUS.length) % WAIFUS.length; let n = 0; while (isLocked(i) && n++ < WAIFUS.length) { if (dir === 0) { UI.toast(`LEVEL ${C.OPERATOR_UNLOCK[WAIFUS[i].id]} REQUIRED`); return; } i = (i + dir + WAIFUS.length) % WAIFUS.length; }
    const prev = loadout.waifu; loadout.waifu = i; Profile.equip('operator', WAIFUS[i].id); cardEls.forEach((c, k) => c.classList.toggle('sel', k === loadout.waifu)); if (prev !== loadout.waifu) rebuildShowcase(); setHero(); persist(); };
  const box = $('#setupOpts'); box.innerHTML = '';
  cardsRow = document.createElement('div'); cardsRow.className = 'opt cardsrow'; cardsRow.appendChild(cards); box.appendChild(cardsRow);
  cardsRow._adj = (d) => select(loadout.waifu + d, d);
  select(loadout.waifu);
  const rows = [cardsRow];
  rows.push(modeRow(box, () => showSetup(1)));
  rows.push(variantRow(box));
  rows.push(UI.choice(box, 'Map', World.MAP_LIST.map((m) => ({ label: m.name, value: m.id })), World.MAP_LIST.findIndex((m) => m.id === loadout.map), (v) => { loadout.map = v; persist(); $('#mapTag').textContent = World.MAP_LIST.find((m) => m.id === v).tag; }));
  if (loadout.mode !== 'rumble') rows.push(UI.choice(box, 'Team', [{ label: 'BLUE', value: 'blue' }, { label: 'RED', value: 'red' }], loadout.team === 'blue' ? 0 : 1, (v) => { loadout.team = v; rebuildShowcase(); persist(); }));
  rows.push(UI.choice(box, 'Armor', [{ label: 'SPARTAN HELM', value: true }, { label: 'ANGEL', value: false }], loadout.helmet ? 0 : 1, (v) => { loadout.helmet = v; rebuildShowcase(); setHero(); persist(); }));
  rows.push(callsignRow(box));
  const dk = Object.keys(DIFFICULTY);
  rows.push(UI.choice(box, 'Bot difficulty', dk.map((k) => ({ label: DIFFICULTY[k].name, value: k })), dk.indexOf(loadout.diff), (v) => { loadout.diff = v; persist(); }));
  rows.push(limitRow(box));
  $('#mapTag').textContent = (World.MAP_LIST.find((m) => m.id === loadout.map) || World.MAP_LIST[0]).tag;
  const drop = $('#btnDrop'); UI.button(drop, () => startMatch()); rows.push(drop);
  UI.show('setup', { rows, onBack: () => showTitle(), focus: focusRow ?? rows.length - 1 });
  $('#modeBlurb') && ($('#modeBlurb').textContent = MODES[loadout.mode].blurb);
  refreshPrompts();
}

// ---- online lobby ------------------------------------------------------------------------------
const lobby = { players: new Map(), sameTeam: true };
const isTouch = () => document.body.classList.contains('touch-on');
function goFullscreen() {
  if (!isTouch() || document.fullscreenElement) return;
  try { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch { /* */ }
  try { const o = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (o && o.catch) o.catch(() => {}); } catch { /* */ }
}
const onlineStatus = (msg, err = false) => { const e = $('#onlineStatus'); if (e) { e.textContent = msg || ''; e.classList.toggle('err', err); } };

function openOnline() {
  state = 'menu';
  const box = $('#onlineOpts'); box.innerHTML = ''; onlineStatus('');
  const rows = [];
  rows.push(UI.item(box, 'Host a lobby', 'A', () => hostLobby()));
  const row = document.createElement('div'); row.className = 'opt';
  row.innerHTML = '<span class="lbl">Friend\'s code</span><span class="val"><input id="joinCode" class="join-input" maxlength="5" placeholder="-----" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Lobby code"></span>';
  box.appendChild(row);
  const inp = row.querySelector('input');
  row._act = () => inp.focus(); row.onclick = () => inp.focus();
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); joinLobby(inp.value); } });
  inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  rows.push(row);
  rows.push(UI.item(box, 'Join lobby', 'B', () => joinLobby(inp.value)));
  const back = $('#btnOnlineBack'); UI.button(back, () => { Net.close(); showTitle(); }); rows.push(back);
  UI.show('online', { rows, onBack: () => { Net.close(); showTitle(); } });
}

async function hostLobby() {
  goFullscreen(); onlineStatus('Contacting lobby server...');
  try { await Net.startHost(); } catch (e) { onlineStatus(friendlyError(e), true); return; }
  lobby.players.clear();
  showLobby(true); pushLobby();
}

async function joinLobby(code) {
  goFullscreen(); onlineStatus('Connecting...');
  try { await Net.join(code); } catch (e) { onlineStatus(friendlyError(e), true); Net.close(); return; }
  Net.send({ t: 'hello', name: Profile.callsign, waifu: loadout.waifu, helmet: loadout.helmet, v: 1 });
  showLobby(false);
}

function lobbyList() {
  const list = [{ name: Profile.callsign, host: true, team: loadout.team }];
  for (const [, p] of lobby.players) list.push({ name: p.name, team: lobby.sameTeam ? loadout.team : loadout.team === 'blue' ? 'red' : 'blue' });
  return list;
}
function pushLobby() {
  const list = lobbyList();
  renderLobby(list);
  if (Net.isHost) Net.broadcast({ t: 'lobby', list, sameTeam: lobby.sameTeam });
}
function renderLobby(list) {
  const box = $('#lobbyPlayers'); if (!box) return;
  box.innerHTML = list.map((p) => `<div class="lp" style="--c:${TEAM[p.team].css}"><i></i><span>${p.name}</span><em>${p.host ? 'HOST' : 'GUEST'} / ${TEAM[p.team].name}</em></div>`).join('')
    + (list.length < 4 ? '<div class="lp wait"><i style="--c:#8fa1bd"></i><span>Waiting for friends</span></div>' : '');
}

function showLobby(host) {
  state = 'menu';
  $('#lobbyTitle').textContent = host ? 'YOUR LOBBY' : 'LOBBY';
  $('#lobbySub').textContent = host ? 'Share the code or link. Friends join from any device. Bots fill empty slots.' : 'Connected. Waiting for the host to start the match.';
  $('#lobbyCode').textContent = Net.code || '-----'; $('#lobbyLink').textContent = Net.link();
  const rows = [], opts = $('#lobbyOpts'); opts.innerHTML = '';
  const copy = $('#btnCopy'), share = $('#btnShare');
  const doCopy = async () => { try { await navigator.clipboard.writeText(Net.link()); UI.toast('LINK COPIED'); } catch { UI.toast(Net.link(), 4000); } };
  UI.button(copy, doCopy);
  UI.button(share, async () => { if (navigator.share) { try { await navigator.share({ title: 'LOCKOUT', text: 'Join my LOCKOUT lobby', url: Net.link() }); return; } catch { /* cancelled */ } } doCopy(); });
  rows.push(copy, share);
  const btns = $('#lobbyBtns'); btns.innerHTML = '';
  const leave = document.createElement('button'); leave.className = 'btn'; leave.innerHTML = '<span>LEAVE</span><i></i>';
  UI.button(leave, () => leaveOnline());
  if (host) {
    rows.push(UI.choice(opts, 'Map', World.MAP_LIST.map((m) => ({ label: m.name, value: m.id })), World.MAP_LIST.findIndex((m) => m.id === loadout.map), (v) => { loadout.map = v; persist(); }));
    rows.push(UI.choice(opts, 'Friends join', [{ label: 'MY TEAM', value: true }, { label: 'OTHER TEAM', value: false }], lobby.sameTeam ? 0 : 1, (v) => { lobby.sameTeam = v; pushLobby(); }));
    const dk = Object.keys(DIFFICULTY);
    rows.push(UI.choice(opts, 'Bot difficulty', dk.map((k) => ({ label: DIFFICULTY[k].name, value: k })), dk.indexOf(loadout.diff), (v) => { loadout.diff = v; persist(); }));
    rows.push(modeRow(opts, () => showLobby(true)));
    rows.push(variantRow(opts));
    rows.push(limitRow(opts));
    const go = document.createElement('button'); go.className = 'btn primary'; go.innerHTML = '<span>START MATCH</span><i></i>';
    UI.button(go, () => startOnlineHost());
    btns.appendChild(leave); btns.appendChild(go); rows.push(go, leave);
  } else { btns.appendChild(leave); rows.push(leave); }
  UI.show('lobby', { rows, onBack: () => leaveOnline(), focus: rows.length - (host ? 2 : 1) });
  renderLobby(host ? lobbyList() : []);
}

async function startOnlineHost() {
  await ensureMap(loadout.map);
  const other = loadout.team === 'blue' ? 'red' : 'blue';
  const humans = [...lobby.players].map(([peer, p]) => ({ peer, name: p.name, waifu: WAIFUS[p.waifu] || WAIFUS[0], team: lobby.sameTeam ? loadout.team : other, helmet: p.helmet }));
  const w = WAIFUS[loadout.waifu];
  const m = new Match(scene, fx, { waifu: w, name: Profile.callsign, team: loadout.team, helmet: loadout.helmet, difficulty: loadout.diff, ...matchCfg(), humans });
  beginMatch(m, w);
  m.enableHost();
  const roster = m.actors.map((a) => ({ id: a.id, name: a.name, team: a.team, hair: a.style.hair, eye: a.style.eye, helmet: a.rig.helmet }));
  for (const h of humans) { const a = m.actors.find((x) => x.remote === h.peer); if (a) Net.sendTo(h.peer, { t: 'start', roster, you: a.id, limit: m.limit, mode: m.mode, variant: m.variant, minutes: 12, map: loadout.map }); }
  m.bus.emit('count', 3);
}

async function startReplica(msg) {
  await ensureMap(msg.map || 'lockout');
  beginMatch(new Match(scene, fx, { replica: true, roster: msg.roster, you: msg.you, limit: msg.limit, mode: msg.mode, variant: msg.variant, minutes: msg.minutes }));
}

function leaveOnline() {
  Net.close(); lobby.players.clear();
  if (match) endMatchToMenu();
  showTitle();
}

function wireNet() {
  Net.bus.on('msg', (from, m) => {
    if (!m || !m.t) return;
    if (Net.isHost) {
      if (m.t === 'hello') {
        if (match && !match.replica && state !== 'menu') { Net.sendTo(from, { t: 'busy' }); return; }
        let name = String(m.name || 'GUEST').slice(0, 12).toUpperCase(); const taken = new Set([WAIFUS[loadout.waifu].name, ...[...lobby.players.values()].map((p) => p.name)]);
        while (taken.has(name)) name += '2';
        lobby.players.set(from, { name, waifu: m.waifu | 0, helmet: m.helmet !== false }); pushLobby();
      } else if (m.t === 'in' && match && match.hosting) match.applyInput(match.actors.find((a) => a.remote === from), m);
    } else if (m.t === 'lobby') renderLobby(m.list);
    else if (m.t === 'start') startReplica(m);
    else if (m.t === 'snap' && match && match.replica) match.applySnapshot(m.s);
    else if (m.t === 'busy' || m.t === 'full') { UI.toast(m.t === 'full' ? 'LOBBY IS FULL' : 'MATCH ALREADY IN PROGRESS', 3500); leaveOnline(); }
  });
  Net.bus.on('leave', (peer) => { lobby.players.delete(peer); if (match && match.hosting) match.convertToBot(peer); if (state === 'menu' && UI.cur === 'lobby') pushLobby(); });
  Net.bus.on('closed', () => { if (Net.isClient) { UI.toast('HOST LEFT THE LOBBY', 3500); leaveOnline(); } });
}

function netTick(dt) {
  netAcc += dt;
  if (Net.isHost && match && match.hosting) {
    if (netAcc >= 0.05) { netAcc = 0; const sn = match.snapshot(); sn.ev = match.takeEvents(); Net.broadcast({ t: 'snap', s: sn }); }
  } else if (Net.isClient && match && match.replica && netAcc >= 0.033) {
    netAcc = 0; const p = match.player, r = (v) => Math.round(v * 100) / 100;
    Net.send({ t: 'in', x: r(p.x), y: r(p.y), z: r(p.z), yw: r(p.yaw), pt: r(p.pitch), vx: r(p.vx), vy: r(p.vy), vz: r(p.vz), g: p.grounded ? 1 : 0, cr: r(p.crouch), zl: p.zoomLevel, f: p.alive && p.cmd.fire ? 1 : 0, e: netEdges, sq: p.spawnSeq });
    netEdges = 0;
  }
}

// ---- match lifecycle --------------------------------------------------------------------------
async function ensureMap(id) {
  if (World.MAP && World.MAP.id === id && world) return;
  state = 'loading'; UI.show('loading'); $('#loadTip').textContent = TIPS[(Math.random() * TIPS.length) | 0];
  await setProg(0.02, 'Loading ' + id.toUpperCase());
  world = await World.loadMap(scene, renderer, id, (p, l) => setProg(0.02 + p * 0.96, l));
  applySettings(); renderer.toneMappingExposure = EXPOSURE[id] || 1.05;
  if (showcase) showcase.root.position.set(...MENU[id].show);
  await setProg(1, 'Ready');
}

async function startMatch() {
  await ensureMap(loadout.map);
  const w = WAIFUS[loadout.waifu];
  beginMatch(new Match(scene, fx, { waifu: w, name: Profile.callsign, team: loadout.team, helmet: loadout.helmet, difficulty: loadout.diff, ...matchCfg(), autoPlayer: Q.has('bot') }), w);
}

function beginMatch(m, w) {
  if (match) { match.dispose(); match = null; }
  fx.clearDecals();
  $$('.screen').forEach((s) => s.classList.remove('active'));
  UI.cur = null; UI.rows = [];
  showcase.root.visible = false;
  match = m;
  const st = w || match.player.style;
  viewmodel.setup(match.player.team, st.hair, st.eye, skinHex());
  hud.root.classList.remove('hidden'); hud.bind(match);
  mstats = { kills: 0, heads: 0, perfects: 0, sniper: 0, sword: 0, grenade: 0, caps: 0, ballSec: 0, medals: {}, streakBest: 0, awarded: false };
  match.bus.on('kill', (r) => { if (r.killer === match.player && !r.suicide) { if (!Net.online) hitstop = r.head || r.weapon === 'sword' || r.weapon === 'hammer' ? 0.1 : 0.06; trauma = Math.min(1, trauma + 0.12); mstats.kills++; if (r.head) mstats.heads++; if (r.weapon === 'sniper') mstats.sniper++; if (r.weapon === 'sword') mstats.sword++; if (r.weapon === 'frag' || r.weapon === 'plasma') mstats.grenade++; mstats.streakBest = Math.max(mstats.streakBest, match.player.streak); } });
  match.bus.on('medal', (a, n) => { if (a === match.player) { mstats.medals[n] = (mstats.medals[n] || 0) + 1; if (n === 'PERFECT') mstats.perfects++; } });
  match.bus.on('obj', (t, a) => { if (a === match.player) { if (t === 'cap') mstats.caps++; else if (t === 'ballsec') mstats.ballSec++; } });
  match.bus.on('shake', (a) => { trauma = Math.min(1, trauma + a); });
  match.bus.on('shot', (a, def) => { if (a === match.player && def) { viewmodel.kickNow(0.4 + def.kick * 8); camKick = Math.min(0.06, camKick + def.kick * 0.35); } });
  match.bus.on('state', (s) => { if (s === 'ended') onMatchEnd(); });
  match.player.pitch = 0; fovCur = settings.fov; endShown = false; padCrouch = false; trauma = 0; netAcc = 0; netEdges = 0;
  state = 'playing'; document.body.classList.add('playing');
  Input.lock(); Sound.music('match'); Sound.ambience(loadout.map === 'lockout' ? 'hum' : 'wind');
  hud.announce('', null);
}

function onMatchEnd() {
  const win = match.winner;
  const mine = match.player.team;
  const wn = match.ffa && win !== 'tie' ? match.actors.find((a) => a.team === win) : null;
  hud.announce(win === 'tie' ? 'DRAW' : wn ? (wn.isPlayer ? 'YOU WIN' : `${wn.name} WINS`) : `${TEAM[win].name} TEAM WINS`, win === 'tie' ? null : win);
  Sound.play(win === mine ? 'win' : 'lose', { vol: 0.9 });
}

function showResults() {
  endShown = true; state = 'results';
  document.body.classList.remove('playing');
  hud.showBoard(false); hud.root.classList.add('hidden');
  Input.unlock();
  const m = match, p = m.player, win = m.winner;
  const won = win === p.team;
  const title = win === 'tie' ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT';
  $('#results').style.setProperty('--team', win === 'tie' ? '#8fa1bd' : TEAM[win].css);
  $('#resKicker').textContent = 'MATCH COMPLETE · ' + MODES[m.mode].name;
  $('#resTitle').textContent = title;
  const fmt = (v) => (m.mode === 'oddball' ? Math.floor(v) : v);
  if (m.ffa) { const top = m.ranking().slice(0, 3); $('#resScore').textContent = top.map((a) => `${a.name} ${a.kills}`).join('  /  '); }
  else $('#resScore').textContent = `BLUE ${fmt(m.score.blue)}  —  RED ${fmt(m.score.red)}`;
  const rows = (list) => list.map((a) => `<tr class="${a.team}${a === p ? ' me' : ''}" style="--tc:${TEAM[a.team].css}"><td class="nm">${a.name}</td><td>${a.kills}</td><td>${a.assists}</td><td>${a.deaths}</td></tr>`).join('');
  const head = '<tr><th>OPERATOR</th><th>KILLS</th><th>AST</th><th>DEATHS</th></tr>';
  const order = m.ffa ? null : m.score.blue >= m.score.red ? ['blue', 'red'] : ['red', 'blue'];
  const ranked = m.ranking();
  $('#resTable').innerHTML = `<table class="tbl">${head}${m.ffa ? rows(ranked) : order.map((t) => rows(ranked.filter((a) => a.team === t))).join('')}</table>`;
  award(m, p, won, win === 'tie');
  const med = Object.entries(p.medals);
  $('#resMedals').innerHTML = med.length ? med.map(([n, c]) => `<span class="rm">${svg(MEDAL_ICONS.star)}${n}${c > 1 ? ' x' + c : ''}</span>`).join('') : '<span class="rm" style="opacity:.5">NO MEDALS</span>';
  const btns = $('#resBtns'); btns.innerHTML = '';
  const b1 = document.createElement('button'); b1.className = 'btn primary'; b1.innerHTML = '<span>REMATCH</span><i></i>';
  const b2 = document.createElement('button'); b2.className = 'btn'; b2.innerHTML = '<span>LOADOUT</span><i></i>';
  const b3 = document.createElement('button'); b3.className = 'btn'; b3.innerHTML = '<span>MAIN MENU</span><i></i>';
  [b3, b2, b1].forEach((b) => btns.appendChild(b));
  if (Net.online) {
    b2.remove(); b3.querySelector('span').textContent = 'LEAVE';
    if (Net.isHost) { UI.button(b1, () => startOnlineHost()); b1.querySelector('span').textContent = 'REMATCH'; } else { b1.querySelector('span').textContent = 'WAITING FOR HOST'; b1.disabled = true; b1.style.opacity = .5; UI.button(b1, () => {}); }
    UI.button(b3, () => leaveOnline());
    UI.show('results', { rows: Net.isHost ? [b1, b3] : [b3], onBack: null });
  } else {
    UI.button(b1, () => startMatch()); UI.button(b2, () => { endMatchToMenu(); showSetup(); }); UI.button(b3, () => { endMatchToMenu(); showTitle(); });
    UI.show('results', { rows: [b1, b2, b3], onBack: null });
  }
  Sound.music('menu');
}

// XP, credits, stats, unlocks and badges for a finished match (once)
function award(m, p, won, tie) {
  const box = $('#resXp'); box.innerHTML = '';
  if (!mstats || mstats.awarded) return; mstats.awarded = true;
  const S = mstats, medalN = Object.values(S.medals).reduce((a, b) => a + b, 0);
  const parts = [['KILLS', S.kills * 10], ['HEADSHOTS', S.heads * 5], ['PERFECTS', S.perfects * 40], ['ASSISTS', p.assists * 4], ['MEDALS', medalN * 8], ['CAPTURES', S.caps * 60], ['BALL TIME', Math.round(S.ballSec * 1.5)], [won ? 'VICTORY' : tie ? 'DRAW' : 'COMPLETION', won ? 120 : tie ? 70 : 40]].filter((x) => x[1] > 0);
  const chDone = Challenges.apply({ kills: S.kills, heads: S.heads, perfects: S.perfects, sniper: S.sniper, sword: S.sword, grenade: S.grenade, caps: S.caps, ballSec: S.ballSec, medals: medalN, wins: won ? 1 : 0, matches: 1, streakBest: S.streakBest });
  for (const c of chDone) parts.push(['CHALLENGE', c.xp]);
  const xp = parts.reduce((a, b) => a + b[1], 0), cr = Math.round(xp * 0.55) + chDone.reduce((a, c) => a + c.cr, 0);
  const before = { level: Profile.level, xp: Profile.xp, need: Profile.level >= 50 ? 1 : (function () { return 0; })() };
  const fromLevel = Profile.level;
  const d = Profile.d, st = d.stats;
  st.kills += S.kills; st.deaths += p.deaths; st.assists += p.assists; st.headshots += S.heads; st.perfects += S.perfects; st.sniper += S.sniper; st.sword += S.sword; st.grenade += S.grenade;
  st.caps += S.caps; st.ballTime += S.ballSec; st.matches++; if (won) st.wins++; st.streakBest = Math.max(st.streakBest, S.streakBest);
  for (const [n, c] of Object.entries(S.medals)) d.medals[n] = (d.medals[n] || 0) + c;
  const res = Profile.addXp(xp, cr);
  const news = C.newlyUnlocked(fromLevel, Profile.level, WAIFUS), badges = C.newBadges();
  void before;
  box.innerHTML = `<div class="rx-h"><span>${Profile.callsign} · ${Profile.rank} · LVL ${Profile.level}</span><b>+${xp} XP  +${cr} CR</b></div>`
    + parts.map(([k, v]) => `<div class="rx-r"><span>${k}</span><b>+${v}</b></div>`).join('')
    + `<div class="xp-bar"><i style="width:${Profile.progress() * 100}%"></i></div>`
    + (res.levels.length ? `<div class="rx-up">LEVEL UP  ${fromLevel} > ${Profile.level}</div>` : '')
    + (news.length || badges.length || chDone.length ? `<div class="rx-new">${chDone.map((c) => `<span class="rm">CHALLENGE: ${c.text}</span>`).join('')}${news.map((n) => `<span class="rm">${n.cat}: ${n.name}</span>`).join('')}${badges.map((b) => `<span class="rm">BADGE: ${b.name}</span>`).join('')}</div>` : '');
  if (res.levels.length) Sound.play('win', { vol: 0.6 });
}

function endMatchToMenu() {
  if (match) { match.dispose(); match = null; }
  showcase.root.visible = true; renderPCard();
  UI.hide('pause'); UI.hide('results');
}

function pauseGame() {
  if (state !== 'playing' || !match) return;
  state = 'paused'; hud.showBoard(false); Input.unlock(); document.body.classList.remove('playing');
  pauseMenu();
}
function pauseMenu() {
  const menu = $('#pauseMenu'); menu.innerHTML = '';
  if (match) {
    const p = match.player, md = MODES[match.mode], mp = World.MAP_LIST.find((x) => x.id === loadout.map);
    const sc = match.ffa ? `YOU ${match.score[p.team]}` : `BLUE ${Math.floor(match.score.blue)} · RED ${Math.floor(match.score.red)}`;
    $('#pauseSub').textContent = `${md.name} · ${mp ? mp.name : ''} · ${sc} · K ${p.kills} D ${p.deaths}`;
  }
  const resume = () => { UI.hide('pause'); state = 'playing'; document.body.classList.add('playing'); Input.lock(); };
  const rows = [
    UI.item(menu, 'Resume', 'I', resume),
    ...(Net.online ? [] : [UI.item(menu, 'Restart match', 'II', () => startMatch())]),
    UI.item(menu, 'Controls', 'III', () => showControls('pause')),
    UI.item(menu, 'Settings', 'IV', () => showSettings(() => pauseMenu())),
    UI.item(menu, Net.online ? 'Leave match' : 'Quit to menu', 'V', () => { if (Net.online) leaveOnline(); else { endMatchToMenu(); showTitle(); } }),
  ];
  UI.show('pause', { rows, onBack: resume });
}

// ---- per-frame ----------------------------------------------------------------------------------
function playerInput(p) {
  const c = p.cmd, mv = Input.move, y = p.yaw;
  const fx_ = -Math.sin(y), fz_ = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
  c.mx = rx * mv.x + fx_ * -mv.y; c.mz = rz * mv.x + fz_ * -mv.y;
  c.fire = Input.held.fire; if (Input.pressed.fire) c.fireEdge = true;
  if (Input.held.jump) c.jump = true;
  if (Input.last === 'pad') { if (Input.pressed.crouch) padCrouch = !padCrouch; c.crouch = padCrouch; } else c.crouch = Input.held.crouch;
  if (Input.pressed.melee) c.melee = true; if (Input.pressed.grenade) c.grenade = true; if (Input.pressed.reload) c.reload = true;
  if (Input.pressed.swap) c.swap = true; if (Input.pressed.use) c.use = true; if (Input.pressed.zoom) c.zoom = true; if (Input.pressed.gswitch) c.gswitch = true;
  // holding use also keeps pickup intent alive for a frame or two
  if (Input.held.use) c.use = true;
}

function look(p, dt, aimEnemy) {
  const zoom = p.fovZoom || 1;
  let lx = Input.look.x / zoom, ly = Input.look.y / zoom;
  if (Input.last === 'pad' && Input.padLookActive) {
    if (aimEnemy) { lx *= 0.55; ly *= 0.55; }
    const t = match.magnet(p);
    if (t && (lx || ly)) {
      const dx = t.x - p.x, dz = t.z - p.z, dy = t.chest - p.eye;
      const wy = Math.atan2(-dx, -dz), wp = Math.atan2(dy, Math.hypot(dx, dz));
      p.yaw += clamp(angDiff(p.yaw, wy), -0.6, 0.6) * dt * 1.6; p.pitch += clamp(wp - p.pitch, -0.6, 0.6) * dt * 1.6;
    }
  }
  p.yaw -= lx; p.pitch = clamp(p.pitch - ly, -1.45, 1.45);
}

const introTmp = new THREE.PerspectiveCamera(), introQ = new THREE.Quaternion(), introP = new THREE.Vector3();
function updateCamera(dt) {
  const p = match.player, m = match;
  trauma = Math.max(0, trauma - dt * 1.4); camKick = damp(camKick, 0, 12, dt);
  const tr = trauma * trauma; shakeN.t += dt * 38;
  const sx = (Math.sin(shakeN.t * 1.3) + Math.sin(shakeN.t * 2.7)) * 0.5 * tr * 0.05, sy = (Math.sin(shakeN.t * 1.7 + 2) + Math.sin(shakeN.t * 3.1)) * 0.5 * tr * 0.05, sr = Math.sin(shakeN.t * 2.1) * tr * 0.05;
  const zoom = p.alive ? p.fovZoom : 1;
  const base = settings.fov;
  const tf = 2 * Math.atan(Math.tan((base * Math.PI) / 360) / zoom) * (180 / Math.PI);
  fovCur = damp(fovCur, tf, 16, dt);
  if (Math.abs(camera.fov - fovCur) > 0.01) { camera.fov = fovCur; camera.updateProjectionMatrix(); }
  if (p.alive && !m.thirdPerson) {
    camera.position.set(p.x, p.eye, p.z);
    camera.rotation.set(p.pitch + camKick + sy, p.yaw + sx, sr);
  } else if (p.alive) {
    const f = forward(p.yaw, p.pitch, { x: 0, y: 0, z: 0 });
    const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    const hx = p.x + rx * 0.5, hy = p.eye + 0.25, hz = p.z + rz * 0.5;
    let d = 2.8; const t = World.rayWorld(hx, hy, hz, -f.x, -f.y, -f.z, d + 0.3); if (t < Infinity) d = Math.max(0.6, t - 0.3);
    camera.position.set(hx - f.x * d, hy - f.y * d, hz - f.z * d);
    camera.rotation.set(p.pitch + sy, p.yaw + sx, sr);
  } else {
    // death cam: pull back from the body and look at whoever did it
    const kr = m.lastKillRec, k = kr && kr.victim === p ? kr.killer : null;
    const cx = p.x, cy = p.y + 1.1, cz = p.z;
    let ax = k ? k.x - cx : -Math.sin(p.yaw), az = k ? k.z - cz : -Math.cos(p.yaw);
    const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
    const ang = Math.min(p.deadT, 3) * 0.12;
    const bx = -ax * Math.cos(ang) + -az * Math.sin(ang), bz = -az * Math.cos(ang) + ax * Math.sin(ang);
    let d = 4.8; const t = World.rayWorld(cx, cy, cz, bx, 0.35, bz, d + 0.4); if (t < Infinity) d = Math.max(1.2, t - 0.4);
    const tx = cx + bx * d, ty = cy + 1.5 + d * 0.2, tz = cz + bz * d;
    camera.position.x = damp(camera.position.x, tx, 6, dt); camera.position.y = damp(camera.position.y, ty, 6, dt); camera.position.z = damp(camera.position.z, tz, 6, dt);
    const lx = k ? k.x : cx, ly = k ? k.chest : cy, lz = k ? k.z : cz;
    camera.up.set(0, 1, 0); camera.lookAt(lx * 0.28 + cx * 0.72, ly * 0.28 + cy * 0.72, lz * 0.28 + cz * 0.72);
  }
  if (m.state === 'countdown' && p.alive && !m.thirdPerson) {   // match intro: orbit from the front of your operator into first person
    const t = clamp(1 - (m.count - 0.2) / 3.5, 0, 1), e = t * t * (3 - 2 * t), a = Math.PI * e, r = 3.1 * (1 - e);
    const fx0 = -Math.sin(p.yaw), fz0 = -Math.cos(p.yaw), ca = Math.cos(a), sa = Math.sin(a);
    introTmp.position.set(p.x + (fx0 * ca - fz0 * sa) * r, p.y + 1.55 + 0.3 * (1 - e), p.z + (fx0 * sa + fz0 * ca) * r);
    introTmp.lookAt(p.x, p.y + 1.5, p.z); introQ.copy(camera.quaternion); introP.copy(camera.position);
    const w = e * e;
    camera.position.lerpVectors(introTmp.position, introP, w); camera.quaternion.copy(introTmp.quaternion).slerp(introQ, Math.min(1, e * 1.4));
  }
  m.listener.x = camera.position.x; m.listener.y = camera.position.y; m.listener.z = camera.position.z; m.listener.yaw = camera.rotation.y;
}

function play(dt) {
  const p = match.player, m = match;
  if (Input.pressed.pause) { pauseGame(); return; }
  if (Input.pressed.cam) { m.thirdPerson = !m.thirdPerson; }
  const scoreOn = Input.held.score || m.state === 'ended';
  hud.showBoard(scoreOn && (m.state !== 'ended' || m.endT < 2.4));
  const aimEnemy = p.alive ? m.aimTarget(p) : null;
  if (p.alive && !p.brain) {
    playerInput(p); look(p, dt, aimEnemy);
    if (Net.isClient) { const c = p.cmd; netEdges |= (c.fireEdge ? 1 : 0) | (c.jump ? 2 : 0) | (c.melee ? 4 : 0) | (c.grenade ? 8 : 0) | (c.reload ? 16 : 0) | (c.swap ? 32 : 0) | (c.use ? 64 : 0) | (c.gswitch ? 128 : 0); }
  }
  else if (!p.alive) { p.cmd.fire = false; }
  // fixed-ish substeps
  const n = Math.max(1, Math.ceil(dt * 60)), sdt = dt / n;
  for (let i = 0; i < n; i++) m.update(sdt);
  netTick(dt);
  fx.update(dt); world.snow.update(dt, camera.position, m.time);
  p.rig.root.visible = m.thirdPerson || !p.alive || (m.state === 'countdown' && m.count > 0.6);
  updateCamera(dt);
  // viewmodel
  const scope = p.alive && p.def && p.def.id === 'sniper' && p.zoomLevel > 0;
  const showVM = p.alive && !m.thirdPerson && !scope && !(m.state === 'countdown' && m.count > 0.7);
  viewmodel.update(dt, p, Input.look, p.lastMoveSpeed, WEAPONS);
  fx.setScale(H * renderer.getPixelRatio(), camera.fov);
  hud.update(dt, { match: m, player: p, aimEnemy, camYaw: camera.rotation.y, camera });
  render(showVM);
  if (m.state === 'ended' && m.endT > 3.2 && !endShown) showResults();
  if (Input.pressed.score || false) { /* held handled above */ }
}

function idleOnline(dt) {
  const m = match, p = m.player; p.cmd.mx = p.cmd.mz = 0; p.cmd.fire = false; p.cmd.crouch = false;
  const n = Math.max(1, Math.ceil(dt * 60)); for (let i = 0; i < n; i++) m.update(dt / n);
  netTick(dt); fx.update(dt); world.snow.update(dt, camera.position, m.time); updateCamera(dt); render(false);
}

function render(showVM) {
  renderer.clear();
  renderer.render(scene, camera);
  if (showVM) viewmodel.render(renderer, 62 * (1 - (0) * 0), W / H, scene.environment);
}

const menuPtr = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', (e) => { menuPtr.x = e.clientX / innerWidth - 0.5; menuPtr.y = e.clientY / innerHeight - 0.5; });
function menuFrame(dt) {
  menuT += dt;
  const px = Input.last === 'kbm' ? 0 : 0;
  camera.fov = 44; camera.updateProjectionMatrix();
  const mc = MENU[World.MAP ? World.MAP.id : 'lockout'];
  menuPtr.sx += (menuPtr.x - menuPtr.sx) * Math.min(1, dt * 3); menuPtr.sy += (menuPtr.y - menuPtr.sy) * Math.min(1, dt * 3);
  camera.position.set(mc.cam[0] + Math.sin(menuT * 0.23) * 0.3 + px, mc.cam[1] + Math.sin(menuT * 0.31) * 0.08, mc.cam[2] + Math.cos(menuT * 0.19) * 0.2);
  { // pointer parallax: slide the camera sideways along its right vector
    const dx = mc.look[0] - mc.cam[0], dz = mc.look[2] - mc.cam[2], l = Math.hypot(dx, dz) || 1;
    camera.position.x += (-dz / l) * menuPtr.sx * 1.1; camera.position.z += (dx / l) * menuPtr.sx * 1.1; camera.position.y -= menuPtr.sy * 0.4;
  }
  camera.up.set(0, 1, 0); camera.lookAt(...mc.look);
  if (showcase) {
    showcase.root.rotation.y = 2.05 + Math.sin(menuT * 0.4) * 0.12 + menuPtr.sx * 0.35;
    animateRig(showcase, dt, { speed: 0, lx: 0, lz: 1, weaponId: showWeapon, grounded: true, pitch: Math.sin(menuT * 0.5) * 0.05 });
  }
  fx && fx.update(dt); world && world.snow.update(dt, camera.position, menuT);
  fx && fx.setScale(H * renderer.getPixelRatio(), 44);
  render(false);
}

let cool = 0, ftAvg = 16, lastNow = performance.now();
function adaptRes(realDt) {
  ftAvg = ftAvg * 0.95 + Math.min(200, realDt * 1000) * 0.05; cool -= realDt;
  if (cool > 0 || settings.quality !== 'auto') return;
  if (ftAvg > 24 && resScale > 0.55) { resScale = Math.max(0.55, resScale - 0.1); resize(); cool = 3; }
  else if (ftAvg < 12.5 && resScale < 1) { resScale = Math.min(1, resScale + 0.05); resize(); cool = 6; }
}

function loop(now) {
  requestAnimationFrame(loop);
  const lastNow0 = lastNow;
  const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000)); last = now;
  Input.update(dt);
  if (Input.last !== lastDevice) { lastDevice = Input.last; if (state === 'menu') refreshPrompts(); if (hud && match) { /* hud glyphs re-render each frame */ } }
  if (showFps) { fpsAcc += (now - lastNow) / 1000; fpsN++; if (fpsAcc > 0.5 && hud) { hud.el.fps.textContent = `${Math.round(fpsN / fpsAcc)} FPS · ${resScale.toFixed(2)}x`; fpsAcc = 0; fpsN = 0; } }
  lastNow = now;
  try { frame(now, dt, lastNow0); } catch (e) {
    console.error(e);
    if (!loop.errT || now - loop.errT > 4000) { loop.errT = now; UI.toast('RECOVERED: ' + e.message, 3000); }
    // never leave the player frozen on a bad frame: drop held input and keep rendering
    try { if (state === 'playing') { render(false); } } catch { /* renderer itself failed */ }
  }
}

function frame(now, dt, lastNow0) {
  if (state === 'menu') { UI.tick(); menuFrame(dt); }
  else if (state === 'results') { UI.tick(); if (match) { updateCamera(dt); fx.update(dt); } render(false); }
  else if (state === 'paused') { UI.tick(); if (Net.online && match) idleOnline(dt); else render(false); }
  else if (state === 'playing') { let sdt = dt; if (hitstop > 0) { hitstop -= dt; sdt = dt * 0.12; } play(sdt); adaptRes((now - lastNow0) / 1000); }
  else if (state === 'splash' || state === 'loading') { UI.tick(); }
}

addEventListener('keydown', (e) => { if (e.code === 'F3') { showFps = !showFps; if (hud) hud.el.fps.textContent = ''; } });

boot().catch((e) => { console.error(e); UI.toast('ERROR: ' + e.message, 8000); });
