// Bootstrap, screen flow, camera, main loop.
import * as THREE from 'three';
import { $, $$, clamp, lerp, damp, nextFrame, store, save, forward, TAU, angDiff } from './util.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import * as World from './world.js';
import { WAIFUS, TEAM, buildWaifu, animateRig, disposeRig } from './rig.js';
import { WEAPONS, loadWeaponModels } from './weapons.js';
import { FX } from './fx.js';
import { Viewmodel } from './fps.js';
import { Match, DIFFICULTY } from './match.js';
import { HUD, glyph, svg, MEDAL_ICONS } from './hud.js';
import { UI } from './ui.js';

const Q = new URLSearchParams(location.search);
const settings = Object.assign({ sens: 1, padSens: 1, invertY: false, fov: 66, master: 0.8, sfx: 1, music: 0.5, shadows: true }, store('settings', {}));
const loadout = Object.assign({ waifu: 0, team: 'blue', diff: 'normal', limit: 25, helmet: true }, store('loadout', {}));
const persist = () => { save('settings', settings); save('loadout', loadout); };

const TIPS = [
  'Shields recharge after a few seconds out of fire. Break line of sight, then re-peek.',
  'The sniper spawns on the center tower. Whoever holds the tower holds the yard.',
  'Grenade, then melee. The old combo still works.',
  'Hit the head. Every gun in the yard pays out extra for it.',
  'Plasma sticks. Frags bounce. Learn which one to throw around a corner.',
  'The overshield sits behind the catwalk. Bots know where it is. So should you.',
  'An energy sword lunge can cross the room. Do not lunge into a shotgun.',
  'Melee from behind ends the argument.',
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
  document.documentElement.style.setProperty('--ui', clamp(Math.min(W / 1600, H / 900), 0.7, 1.4));
}
addEventListener('resize', resize);

// ---- state ----------------------------------------------------------------------------
let state = 'splash', world = null, fx = null, viewmodel = null, hud = null, match = null, showcase = null;
let trauma = 0, camKick = 0, fovCur = 62, menuT = 0, last = performance.now(), padCrouch = false, fpsAcc = 0, fpsN = 0, showFps = Q.has('fps'), muted = false;
let lastDevice = 'kbm', endShown = false, quick = Q.has('quick');
const shakeN = { t: 0 };
window.__game = { renderer, get fx() { return fx; }, get match() { return match; }, get state() { return state; }, get scene() { return scene; }, get camera() { return camera; }, start: () => startMatch(), Input, THREE };

function applySettings() {
  Input.sens = settings.sens; Input.padSens = settings.padSens; Input.invertY = settings.invertY;
  Sound.setVolume(muted ? 0 : settings.master, settings.sfx, settings.music);
  renderer.shadowMap.enabled = settings.shadows;
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
  resize(); applySettings();
  Input.init(canvas);
  Input.onLockChange = (locked) => { if (!locked && state === 'playing' && !Input.fallback) pauseGame(); };
  Input.onPadLost = () => { if (state === 'playing') pauseGame(); };
  const unlock = () => Sound.unlock();
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) => addEventListener(e, unlock, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pauseGame(); });
  addEventListener('blur', () => { if (state === 'playing') pauseGame(); });
  $$('.splash-word span').forEach((s, i) => s.style.setProperty('--i', i));
  requestAnimationFrame(loop);
  UI.show('splash');
  if (!quick) {
    const t0 = performance.now();
    await new Promise((res) => { const chk = () => { if ((performance.now() - t0 > 3600) || (performance.now() - t0 > 900 && (Input.any() || skipSplash))) res(); else setTimeout(chk, 50); }; chk(); });
  }
  state = 'loading';
  UI.show('loading');
  $('#loadTip').textContent = TIPS[(Math.random() * TIPS.length) | 0];
  const tipTimer = setInterval(() => { $('#loadTip').textContent = TIPS[(Math.random() * TIPS.length) | 0]; }, 3200);
  await setProg(0.02, 'Igniting renderer');
  world = await World.buildWorld(scene, renderer, (p, l) => setProg(0.02 + p * 0.5, l));
  await setProg(0.55, 'Charting nav mesh');
  World.buildNav();
  await setProg(0.62, 'Checking weapon models');
  try { const got = await loadWeaponModels((l) => setProg(0.64, l)); if (got.length) console.info('custom weapon models:', got.join(', ')); } catch (e) { console.warn(e); }
  await setProg(0.7, 'Rigging operators');
  fx = new FX(scene);
  viewmodel = new Viewmodel();
  hud = new HUD($('#hud'));
  rebuildShowcase();
  await setProg(0.86, 'Compiling shaders');
  camera.position.set(-30.6, 6.4, 4.6); camera.lookAt(-24.6, 6.15, 0.8);
  try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
  renderer.render(scene, camera);
  await setProg(1, 'Ready');
  applySettings();
  clearInterval(tipTimer);
  await new Promise((r) => setTimeout(r, quick ? 0 : 350));
  buildMenus();
  if (quick) { showTitle(); startMatch(); } else showTitle();
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

function rebuildShowcase() {
  if (showcase) { scene.remove(showcase.root); disposeRig(showcase); }
  const w = WAIFUS[loadout.waifu];
  showcase = buildWaifu({ team: loadout.team, hair: w.hair, eye: w.eye, helmet: loadout.helmet });
  showcase.root.position.set(-26.6, 5, 3.4); showcase.root.rotation.y = 1.75; scene.add(showcase.root);
}

function setHero() {
  const w = WAIFUS[loadout.waifu];
  $('#hcRole').textContent = w.role; $('#hcName').textContent = w.name; $('#hcBlurb').textContent = w.blurb;
  const c = '#' + new THREE.Color(w.hair).getHexString();
  $('#hcName').style.textShadow = `0 0 40px ${c}88, 0 6px 24px rgba(0,0,0,.5)`;
  if (showcase) { showcase.setStyle(w.hair, w.eye); if (fx) fx.sparks(showcase.root.position.x, 6.4, showcase.root.position.z, 0, 1, 0, 14, [(w.hair >> 16 & 255) / 255, (w.hair >> 8 & 255) / 255, (w.hair & 255) / 255], 4); }
}

function showTitle() {
  state = 'menu';
  document.body.classList.remove('playing');
  hud.root.classList.add('hidden');
  const menu = $('#titleMenu'); menu.innerHTML = '';
  const rows = [
    UI.item(menu, 'Play Match', '01', () => showSetup()),
    UI.item(menu, 'Controls', '02', () => showControls('title')),
    UI.item(menu, 'Settings', '03', () => showSettings(() => showTitle())),
  ];
  UI.show('title', { rows });
  $('#btnFull').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); };
  $('#btnMute').onclick = () => { muted = !muted; applySettings(); UI.toast(muted ? 'AUDIO MUTED' : 'AUDIO ON'); };
  setHero(); refreshPrompts();
  Sound.music('menu');
  $('#hero-fallback')?.remove();
}

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
  rows.push(UI.choice(box, 'Shadows', [{ label: 'ON', value: true }, { label: 'OFF', value: false }], settings.shadows ? 0 : 1, (v) => { settings.shadows = v; applySettings(); persist(); }));
  const b = $('#btnSetBack'); UI.button(b, backFn); rows.push(b);
  UI.show('settings', { rows, onBack: backFn });
}

function showSetup() {
  const cards = $('#waifuCards'); cards.innerHTML = '';
  cardEls = WAIFUS.map((w, i) => {
    const c = document.createElement('div'); c.className = 'card'; c.style.setProperty('--c', '#' + new THREE.Color(w.hair).getHexString());
    c.innerHTML = `<div class="cr">${w.role}</div><div class="cn">${w.name}</div><div class="cb">${w.blurb}</div>`;
    c.onclick = (e) => { e.stopPropagation(); select(i); Sound.unlock(); Sound.play('menuMove', { vol: 0.6 }); };
    cards.appendChild(c); return c;
  });
  const select = (i) => { loadout.waifu = (i + WAIFUS.length) % WAIFUS.length; cardEls.forEach((c, k) => c.classList.toggle('sel', k === loadout.waifu)); setHero(); persist(); };
  const box = $('#setupOpts'); box.innerHTML = '';
  cardsRow = document.createElement('div'); cardsRow.className = 'opt cardsrow'; cardsRow.appendChild(cards); box.appendChild(cardsRow);
  cardsRow._adj = (d) => select(loadout.waifu + d);
  select(loadout.waifu);
  const rows = [cardsRow];
  rows.push(UI.choice(box, 'Team', [{ label: 'BLUE', value: 'blue' }, { label: 'RED', value: 'red' }], loadout.team === 'blue' ? 0 : 1, (v) => { loadout.team = v; rebuildShowcase(); persist(); }));
  rows.push(UI.choice(box, 'Armor', [{ label: 'SPARTAN HELM', value: true }, { label: 'BARE FACE', value: false }], loadout.helmet ? 0 : 1, (v) => { loadout.helmet = v; rebuildShowcase(); setHero(); persist(); }));
  const dk = Object.keys(DIFFICULTY);
  rows.push(UI.choice(box, 'Bot difficulty', dk.map((k) => ({ label: DIFFICULTY[k].name, value: k })), dk.indexOf(loadout.diff), (v) => { loadout.diff = v; persist(); }));
  rows.push(UI.choice(box, 'Score to win', [15, 25, 50].map((n) => ({ label: n + ' KILLS', value: n })), [15, 25, 50].indexOf(loadout.limit), (v) => { loadout.limit = v; persist(); }));
  const drop = $('#btnDrop'); UI.button(drop, () => startMatch()); rows.push(drop);
  UI.show('setup', { rows, onBack: () => showTitle(), focus: rows.length - 1 });
  refreshPrompts();
}

// ---- match lifecycle --------------------------------------------------------------------------
function startMatch() {
  if (match) { match.dispose(); match = null; }
  UI.hide('title'); UI.hide('setup'); UI.hide('results'); UI.hide('pause'); UI.hide('settings'); UI.hide('controls');
  $$('.screen').forEach((s) => s.classList.remove('active'));
  UI.cur = null; UI.rows = [];
  const w = WAIFUS[loadout.waifu];
  showcase.root.visible = false;
  match = new Match(scene, fx, { waifu: w, name: w.name, team: loadout.team, helmet: loadout.helmet, difficulty: loadout.diff, limit: loadout.limit, autoPlayer: Q.has('bot') });
  viewmodel.setup(loadout.team, w.hair, w.eye);
  hud.root.classList.remove('hidden'); hud.bind(match);
  match.bus.on('shake', (a) => { trauma = Math.min(1, trauma + a); });
  match.bus.on('shot', (a, def) => { if (a === match.player) { viewmodel.kickNow(0.4 + def.kick * 8); camKick = Math.min(0.06, camKick + def.kick * 0.35); } });
  match.bus.on('state', (s) => { if (s === 'ended') onMatchEnd(); });
  match.player.pitch = 0; fovCur = settings.fov; endShown = false; padCrouch = false; trauma = 0;
  state = 'playing'; document.body.classList.add('playing');
  Input.lock(); Sound.music('match');
  // let the 3..2..1 land
  hud.announce('', null);
}

function onMatchEnd() {
  const win = match.winner;
  const mine = match.player.team;
  hud.announce(win === 'tie' ? 'DRAW' : `${TEAM[win].name} TEAM WINS`, win === 'tie' ? null : win);
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
  $('#resKicker').textContent = 'MATCH COMPLETE · TEAM SLAYER';
  $('#resTitle').textContent = title;
  $('#resScore').textContent = `BLUE ${m.score.blue}  —  RED ${m.score.red}`;
  const rows = (t) => m.ranking().filter((a) => a.team === t).map((a) => `<tr class="${a.team}${a === p ? ' me' : ''}"><td class="nm">${a.name}</td><td>${a.kills}</td><td>${a.assists}</td><td>${a.deaths}</td></tr>`).join('');
  const head = '<tr><th>OPERATOR</th><th>KILLS</th><th>AST</th><th>DEATHS</th></tr>';
  const order = m.score.blue >= m.score.red ? ['blue', 'red'] : ['red', 'blue'];
  $('#resTable').innerHTML = `<table class="tbl">${head}${order.map((t) => rows(t)).join('')}</table>`;
  const med = Object.entries(p.medals);
  $('#resMedals').innerHTML = med.length ? med.map(([n, c]) => `<span class="rm">${svg(MEDAL_ICONS.star)}${n}${c > 1 ? ' x' + c : ''}</span>`).join('') : '<span class="rm" style="opacity:.5">NO MEDALS</span>';
  const btns = $('#resBtns'); btns.innerHTML = '';
  const b1 = document.createElement('button'); b1.className = 'btn primary'; b1.innerHTML = '<span>REMATCH</span><i></i>';
  const b2 = document.createElement('button'); b2.className = 'btn'; b2.innerHTML = '<span>LOADOUT</span><i></i>';
  const b3 = document.createElement('button'); b3.className = 'btn'; b3.innerHTML = '<span>MAIN MENU</span><i></i>';
  [b3, b2, b1].forEach((b) => btns.appendChild(b));
  UI.button(b1, () => startMatch()); UI.button(b2, () => { endMatchToMenu(); showSetup(); }); UI.button(b3, () => { endMatchToMenu(); showTitle(); });
  UI.show('results', { rows: [b1, b2, b3], onBack: null });
  Sound.music('menu');
}

function endMatchToMenu() {
  if (match) { match.dispose(); match = null; }
  showcase.root.visible = true;
  UI.hide('pause'); UI.hide('results');
}

function pauseGame() {
  if (state !== 'playing' || !match) return;
  state = 'paused'; hud.showBoard(false); Input.unlock(); document.body.classList.remove('playing');
  pauseMenu();
}
function pauseMenu() {
  const menu = $('#pauseMenu'); menu.innerHTML = '';
  const resume = () => { UI.hide('pause'); state = 'playing'; document.body.classList.add('playing'); Input.lock(); };
  const rows = [
    UI.item(menu, 'Resume', 'I', resume),
    UI.item(menu, 'Restart match', 'II', () => startMatch()),
    UI.item(menu, 'Controls', 'III', () => showControls('pause')),
    UI.item(menu, 'Settings', 'IV', () => showSettings(() => pauseMenu())),
    UI.item(menu, 'Quit to menu', 'V', () => { endMatchToMenu(); showTitle(); }),
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
    let d = 3.4; const t = World.rayWorld(cx, cy, cz, bx, 0.3, bz, d + 0.4); if (t < Infinity) d = Math.max(1, t - 0.4);
    const tx = cx + bx * d, ty = cy + 1.0 + d * 0.15, tz = cz + bz * d;
    camera.position.x = damp(camera.position.x, tx, 6, dt); camera.position.y = damp(camera.position.y, ty, 6, dt); camera.position.z = damp(camera.position.z, tz, 6, dt);
    const lx = k ? k.x : cx, ly = k ? k.chest : cy, lz = k ? k.z : cz;
    camera.up.set(0, 1, 0); camera.lookAt(lx * 0.6 + cx * 0.4, ly * 0.6 + cy * 0.4, lz * 0.6 + cz * 0.4);
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
  if (p.alive && !p.brain) { playerInput(p); look(p, dt, aimEnemy); }
  else if (!p.alive) { p.cmd.fire = false; }
  // fixed-ish substeps
  const n = Math.max(1, Math.ceil(dt * 60)), sdt = dt / n;
  for (let i = 0; i < n; i++) m.update(sdt);
  fx.update(dt);
  p.rig.root.visible = m.thirdPerson || !p.alive;
  updateCamera(dt);
  // viewmodel
  const scope = p.alive && p.def && p.def.id === 'sniper' && p.zoomLevel > 0;
  const showVM = p.alive && !m.thirdPerson && !scope;
  viewmodel.update(dt, p, Input.look, p.lastMoveSpeed, WEAPONS);
  fx.setScale(H * renderer.getPixelRatio(), camera.fov);
  hud.update(dt, { match: m, player: p, aimEnemy, camYaw: camera.rotation.y, camera });
  render(showVM);
  if (m.state === 'ended' && m.endT > 3.2 && !endShown) showResults();
  if (Input.pressed.score || false) { /* held handled above */ }
}

function render(showVM) {
  renderer.clear();
  renderer.render(scene, camera);
  if (showVM) viewmodel.render(renderer, 62 * (1 - (0) * 0), W / H, scene.environment);
}

function menuFrame(dt) {
  menuT += dt;
  const px = Input.last === 'kbm' ? 0 : 0;
  camera.fov = 44; camera.updateProjectionMatrix();
  camera.position.set(-30.4 + Math.sin(menuT * 0.23) * 0.3 + px, 6.5 + Math.sin(menuT * 0.31) * 0.08, 4.5 + Math.cos(menuT * 0.19) * 0.2);
  camera.up.set(0, 1, 0); camera.lookAt(-22.6, 6.25, -1.9);
  if (showcase) {
    showcase.root.rotation.y = 2.05 + Math.sin(menuT * 0.4) * 0.12;
    animateRig(showcase, dt, { speed: 0, lx: 0, lz: 1, weaponId: 'br', grounded: true, pitch: Math.sin(menuT * 0.5) * 0.05 });
  }
  fx && fx.update(dt);
  fx && fx.setScale(H * renderer.getPixelRatio(), 44);
  render(false);
}

let cool = 0, ftAvg = 16, lastNow = performance.now();
function adaptRes(realDt) {
  ftAvg = ftAvg * 0.95 + Math.min(200, realDt * 1000) * 0.05; cool -= realDt;
  if (cool > 0) return;
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
  else if (state === 'paused') { UI.tick(); render(false); }
  else if (state === 'playing') { play(dt); adaptRes((now - lastNow0) / 1000); }
  else if (state === 'splash' || state === 'loading') { UI.tick(); }
}

addEventListener('keydown', (e) => { if (e.code === 'F3') { showFps = !showFps; if (hud) hud.el.fps.textContent = ''; } });

boot().catch((e) => { console.error(e); UI.toast('ERROR: ' + e.message, 8000); });
