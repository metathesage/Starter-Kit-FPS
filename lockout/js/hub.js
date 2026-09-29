// SANCTUM hub controller: third-person walk, interactions, exhibits, discoveries. Everything combat-free.
import * as THREE from 'three';
import * as W from './world.js';
import { POI } from './hubmap.js';
import { WEAPONS, makeWeaponMesh, ICONS } from './weapons.js';
import { WAIFUS, TEAM, buildWaifu, animateRig } from './rig.js';
import { Sound } from './audio.js';
import { Profile } from './profile.js';
import { Input } from './input.js';
import * as C from './catalog.js';
import { MODES } from './modes.js';
import { svg, glyph, MEDAL_ICONS } from './hud.js';
import { clamp, damp, forward, TAU } from './util.js';
import { applySkin } from './weapons.js';

const RUN = 5.0, GRAV = 21, JUMP = 7.2, RAD = 0.4, H = 1.78;
const DISC_REWARDS = [[5, 100], [12, 200], [20, 300], [30, 500]];
export const DEEP_AT = 20;

const KEEPER = [
  'Welcome to the Sanctum. Nothing here wants to kill you. That is the point.',
  'The board by the pavilion has work for you. Take a mission, earn your keep, come back with stories.',
  'The Vault holds everything we know: every weapon, every operator, every yard we have fought over.',
  'Warlocks pull power from the void. Spartans pull triggers. Both drink tea at the teahouse.',
  'Ring the carillon when you have had a good day. Ring it twice when you have had a bad one.',
  'The statues are older than the plaza. Learn their names and they will tell you the rest.',
  'Some doors only open for the curious. Wander. Sit by the pond. Read the walls.',
  'They say the deep vault keeps something that does not fit on any shelf.',
];
const LORE = [
  ['THE SANCTUM', 'A city built on the lid of an old vault. Marble, gold and open sky. Whoever drew the plans never signed them, and nothing in the plaza has ever needed repair.'],
  ['THE STATUES', 'Goddesses and guardians line the plaza. Study them all: each one has a name, and each name is a small story about the Halo.'],
  ['OPERATORS', 'Nine operators answer to the halo: pushers, marksmen, breachers, ghosts. Each wears the ring differently.'],
  ['THE YARDS', 'Lockout hangs over a void. Cryostat freezes. Mesa burns at dusk. Overgrowth drowns. Warsat waits for a launch that never came.'],
  ['VOID CASTERS', 'Warlocks glide on stolen air and blink between breaths. A charged Nova Bomb ends arguments. Breaking the cast ends the Warlock.'],
  ['THE HALO', 'Every operator carries the ring. It is not armor. It is a promise that someone is still watching.'],
];

const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
function labelSprite(text, sub = '', scale = 1) {
  const c = cv(512, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.textAlign = 'center';
    g.font = '700 34px Syncopate, "JetBrains Mono", sans-serif'; g.fillStyle = 'rgba(255,255,255,.95)'; g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = 8;
    g.fillText(text.toUpperCase(), w / 2, sub ? 58 : 76);
    if (sub) { g.font = '500 20px "JetBrains Mono", monospace'; g.fillStyle = 'rgba(255,220,180,.9)'; g.fillText(sub.toUpperCase(), w / 2, 92); }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
  s.scale.set(3.6 * scale, 0.9 * scale, 1); s.renderOrder = 20; return s;
}

export class Hub {
  constructor(ctx) {
    this.ctx = ctx; this.scene = ctx.scene; this.camera = ctx.camera; this.fx = ctx.fx;
    this.items = []; this.labels = []; this.rigs = []; this.spin = []; this.cards = null; this.t = 0;
    this.p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, grounded: true, gliding: false, blinkCd: 0, walkT: 0 };
    this.cam = { yaw: 0, pitch: -0.28, dist: 5.4, x: 0, y: 0, z: 0 };
    this.sit = null; this.busy = false; this.card = null; this.near = null; this.focus = null; this.focusK = 0; this.photo = false; this.introT = 0; this.stepD = 0; this.dtHold = 0;
    this.build();
  }

  // ------------------------------------------------------------ DOM
  build() {
    const d = document.createElement('div'); d.id = 'hubhud'; d.className = 'hidden';
    d.innerHTML = `<div class="hh-loc"><b>SANCTUM</b><span id="hhRegion">THE PROMENADE</span></div>
      <div class="hh-disc"><span>DISCOVERIES</span><b id="hhDisc">0/0</b><i><u id="hhDiscBar"></u></i></div>
      <div class="hh-prompt" id="hhPrompt"></div><div class="hh-toast" id="hhToast"></div>
      <div class="hh-hints" id="hhHints"></div>
      <div class="hcard" id="hubCard"><div class="hc-k" id="hcK"></div><h2 id="hcT"></h2><div class="hc-s" id="hcS"></div><p class="hc-b" id="hcB"></p><div class="hc-stats" id="hcStats"></div><div class="hc-act" id="hcAct"></div></div>`;
    document.body.appendChild(d); this.el = d;
    this.q = (s) => d.querySelector(s);
  }
  show(on) { this.el.classList.toggle('hidden', !on); }

  // ------------------------------------------------------------ discoveries
  get disc() { const s = Profile.d.seen; s.disc = s.disc || {}; return s.disc; }
  discCount() { return Object.keys(this.disc).length; }
  discTotal() { return this.total; }
  discover(id, label) {
    if (this.disc[id]) return false;
    this.disc[id] = 1; const n = this.discCount(), s = Profile.d.seen;
    let msg = `DISCOVERED  ${label}  ${n}/${this.total}`, bonus = 0;
    for (const [at, cr] of DISC_REWARDS) if (n >= at && !(s.discR >= at)) { s.discR = at; bonus += cr; }
    if (bonus) { Profile.d.credits += bonus; msg += `   +${bonus} CR`; }
    if (n >= DEEP_AT && !s.deepAnnounced) { s.deepAnnounced = 1; setTimeout(() => this.toast('THE DEEP VAULT STIRS'), 2600); }
    Profile.save(); this.toast(msg); Sound.play('discover', { vol: 0.8 }); this.updateDisc();
    return true;
  }
  updateDisc() { const n = this.discCount(); this.q('#hhDisc').textContent = `${n}/${this.total}`; this.q('#hhDiscBar').style.width = (n / this.total) * 100 + '%'; }
  toast(text) { const t = this.q('#hhToast'); t.textContent = text; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); }

  // ------------------------------------------------------------ enter / exit
  async enter(loadout) {
    const ctx = this.ctx;
    this.loadout = loadout;
    if (!this.built) { this.buildWorld(); this.built = true; }
    this.buildAvatar();
    const s = POI.spawn; Object.assign(this.p, { x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, yaw: s.yaw, grounded: true });
    this.cam.yaw = s.yaw; this.cam.pitch = -0.2; this.introT = 0; this.card = null; this.sit = null; this.busy = false;
    this.q('#hubCard').classList.remove('on');
    this.refreshMedals(); this.updateDisc();
    this.show(true); document.body.classList.add('in-hub');
    const dm = W.solids.find((q) => q.mat === 'vdoor');
    this.doorOpen = !dm; this.deepOpen = false; this.codexSeen = null;
    Sound.ambience('garden'); Sound.music('zen');
    { const h = this.q('#hhHints'); const n = (Profile.d.seen.hubHintN || 0); if (n < 4) { Profile.d.seen.hubHintN = n + 1; Profile.save(); h.innerHTML = `<span>${glyph('up')}${glyph('left')}${glyph('down')}${glyph('right')}<em>MOVE</em></span><span>${glyph('jump')}<em>JUMP · HOLD TO GLIDE</em></span><span>${glyph('blink')}<em>BLINK</em></span><span>${glyph('use')}<em>INTERACT</em></span><span>${glyph('pause')}<em>MENU</em></span>`; h.classList.add('on'); clearTimeout(this._hh); this._hh = setTimeout(() => h.classList.remove('on'), 16000); } else h.classList.remove('on'); }
    if (!Profile.d.seen.hubWelcome) { Profile.d.seen.hubWelcome = 1; Profile.save(); setTimeout(() => this.toast('WELCOME TO THE SANCTUM'), 900); }
    void ctx;
  }
  exit() {
    this.show(false); document.body.classList.remove('in-hub'); this.card = null; this.q('#hubCard').classList.remove('on');
    if (this.avatar) { this.scene.remove(this.avatar.root); this.avatar = null; }
    for (const o of this.group ? [this.group] : []) this.scene.remove(o);
    this.built = false; this.items = []; this.labels = []; this.rigs = []; this.spin = []; this.group = null;
  }

  buildAvatar() {
    if (this.avatar) this.scene.remove(this.avatar.root);
    const w = WAIFUS[this.loadout.waifu] || WAIFUS[0], ctx = this.ctx;
    this.avatar = buildWaifu({ team: 'blue', hair: w.hair, eye: w.eye, helmet: this.loadout.helmet, haloColor: ctx.haloHex(), skin: ctx.skinHex() });
    this.avatar.setWeapon(null); this.scene.add(this.avatar.root);
  }
  refreshAvatar(pv = {}) {
    const w = WAIFUS[this.loadout.waifu] || WAIFUS[0], ctx = this.ctx;
    if (this.avatar) this.scene.remove(this.avatar.root);
    this.avatar = buildWaifu({ team: 'blue', hair: w.hair, eye: w.eye, helmet: this.loadout.helmet, haloColor: ctx.haloHex(pv.halo), skin: ctx.skinHex(pv.skin) });
    this.avatar.setWeapon(null); this.scene.add(this.avatar.root);
  }

  // ------------------------------------------------------------ world dressing: exhibits, npc, dioramas, signs
  buildWorld() {
    const g = this.group = new THREE.Group(); this.scene.add(g);
    this.items = []; this.labels = []; this.rigs = []; this.spin = [];
    const ctx = this.ctx, lvl = Profile.level;
    const label = (text, sub, x, y, z, scale, r = 9) => { const s = labelSprite(text, sub, scale); s.position.set(x, y, z); s.userData.r = r; g.add(s); this.labels.push(s); return s; };
    const item = (o) => { this.items.push(o); return o; };
    // signage
    label('SANCTUM', 'City of the Halo', 0, 10.4, 24, 2.2, 30);
    label('MISSION BOARD', 'Take on work', POI.board.x, 5.6, POI.board.z - 1.2, 1.2, 12);
    label('ATRIUM CAFE', 'Armory · Record · Save', -25, 6.6, 8, 1.3, 16);
    label('THE VAULT', 'Everything we know', 0, 12.2, -22.6, 2.2, 26);
    label('CARILLON', 'Ring it', 25, 4.6, 20.2, 1, 12); label('VOID OBELISK', 'Feel the pull', 31, 7.4, -11, 1, 14); label('COURT OF GODDESSES', 'Marble and quiet', -28, 4.8, -3, 1.2, 14); label('GUARDIAN COURT', 'They keep watch', 31, 7, -22, 1.2, 16);
    // main interactables
    item({ id: 'board', x: POI.board.x, y: 0, z: POI.board.z - 0.6, r: 2.6, verb: 'READ THE MISSION BOARD', disc: 'board', name: 'MISSION BOARD', act: () => ctx.openMissions() });
    item({ id: 'armory', x: POI.teaCounter.x, y: 0.7, z: POI.teaCounter.z + 1.3, r: 2.3, verb: 'ARMORY AND LOCKER', disc: 'armory', name: 'THE ARMORY', act: () => ctx.openArmory() });
    item({ id: 'tea', x: POI.tea.x, y: 0.7, z: POI.tea.z, r: 2.3, verb: () => (Profile.d.seen.tea ? 'THE TEA IS STILL WARM' : 'HAVE A CUP OF TEA'), disc: 'tea', name: 'A CUP OF TEA', act: () => { Profile.d.seen.tea = 1; Profile.save(); Sound.play('koto', { vol: 0.6 }); for (let i = 0; i < 18; i++) this.fx.emit(-22.6 + (Math.random() - 0.5) * 0.4, 1.5, 9.2 + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3, 1.6, 0.35, 0.05, 0.95, 0.95, 0.95, 0.5, 0); this.toast('TEA BREWED. +15% XP ON YOUR NEXT MATCH'); } });
    label('TEA', 'Warm buff', -22.6, 3.1, 9.2, 0.6, 7);
    item({ id: 'record', x: POI.record.x, y: 0.7, z: POI.record.z - 1.3, r: 2.3, verb: 'SERVICE RECORD', disc: 'record', name: 'SERVICE RECORD', act: () => ctx.openRecord() });
    item({ id: 'save', x: POI.save.x, y: 0.7, z: POI.save.z - 1.3, r: 2.3, verb: 'SAVE DATA', disc: 'saveterm', name: 'SAVE TERMINAL', act: () => ctx.openSave() });
    item({ id: 'bell', x: POI.bell.x, y: 0, z: POI.bell.z + 1.4, r: 2.6, verb: 'RING THE CARILLON', disc: 'bell', name: 'THE CARILLON', act: () => { Sound.play('bell', { vol: 0.9 }); this.world.hub.bellSwing = 1; this.fx.light(25, 2.3, 19.8, 0xffd890, 12, 0.6, 10); this.toast('THE BELL RINGS ACROSS THE GARDEN'); } });
    item({ id: 'koi', x: POI.koi.x, y: 0, z: POI.koi.z, r: 3.2, verb: 'FEED THE KOI', disc: 'koi', name: 'THE KOI', act: () => { Sound.play('splash', { vol: 0.7 }); this.world.hub.koiLure = { x: 8, z: -2 }; setTimeout(() => { if (this.world && this.world.hub) this.world.hub.koiLure = null; }, 7000); this.toast('THE KOI GATHER'); for (let i = 0; i < 16; i++) this.fx.emit(9.6 + Math.random() * 1.2, 0.2, -2 + (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 0.6, 0.6 + Math.random(), (Math.random() - 0.5) * 0.6, 0.9, 0.16, 0.04, 0.8, 0.9, 1, 0.9, 2); } });
    item({ id: 'sit1', x: POI.sit.x, y: 0, z: POI.sit.z, r: 2.0, verb: 'SIT AND WATCH', disc: 'sit', name: 'A QUIET SEAT', act: () => this.sitDown(POI.sit, Math.PI) });
    item({ id: 'sit2', x: POI.sit2.x, y: 0, z: POI.sit2.z, r: 2.0, verb: 'SIT BY THE POND', disc: 'sit', name: 'A QUIET SEAT', act: () => this.sitDown(POI.sit2, -Math.PI / 2) });
    POI.statues.forEach((q, i) => { item({ id: 'st:' + i, x: q.x - Math.sin(q.yaw) * (q.hw + 1.1), y: q.y, z: q.z - Math.cos(q.yaw) * (q.hw + 1.1), r: q.big ? 3.6 : 2.6, verb: 'STUDY ' + q.name, disc: 'st:' + i, name: q.name, act: () => this.openStatue(i) }); });
    item({ id: 'altar', x: POI.altar.x, y: 0.4, z: POI.altar.z + 2.4, r: 3.4, verb: 'TOUCH THE VOID OBELISK', disc: 'altar', name: 'THE VOID OBELISK', act: () => { this.fx.nova(31, 5.4, -11, 4); Sound.play('novaBoom', { vol: 0.5 }); this.camShake = 0.5; this.toast('THE VOID ANSWERS. BLINK WITH ' + Input.glyph('blink') + ', HOLD JUMP TO GLIDE'); } });
    item({ id: 'vault', x: POI.vaultDoor.x, y: 1.6, z: POI.vaultDoor.z + 2.2, r: 3.6, verb: () => (this.doorOpen ? 'THE VAULT IS OPEN' : 'OPEN THE VAULT'), disc: 'vault', name: 'THE VAULT', act: () => this.openVault() });
    item({ id: 'orb', x: 0, y: 1.6, z: -28.2, r: 2.6, verb: 'READ THE CODEX', disc: 'orb', name: 'THE CODEX', act: () => this.openCodex(0) });
    item({ id: 'deep', x: 0, y: 1.6, z: -42, r: 3.2, verb: () => (this.deepOpen ? 'THE DEEP VAULT IS OPEN' : this.discCount() >= DEEP_AT ? 'UNSEAL THE DEEP VAULT' : 'SEALED DOOR'), disc: null, act: () => this.openDeep() });
    item({ id: 'medals', x: 0, y: 1.6, z: -40, r: 3.6, verb: 'STUDY THE MEDAL WALL', disc: 'medalwall', name: 'THE MEDAL WALL', act: () => this.openMedals() });
    item({ id: 'relic', x: 0, y: 1.6, z: -46.2, r: 2.4, verb: () => (Profile.d.stats.relic ? 'THE RELIC HUMS' : 'CLAIM THE SANCTUM RELIC'), disc: 'relic', name: 'THE SANCTUM RELIC', act: () => this.claimRelic() });
    // weapon plinths
    const wl = [];
    for (const p of [...POI.weapons, ...POI.exotics]) {
      const def = WEAPONS[p.id], m = makeWeaponMesh(p.id); m.scale.setScalar(1.35); const holder = new THREE.Group(); holder.position.set(p.x, p.y + 0.75, p.z); holder.add(m); g.add(holder); this.spin.push({ o: holder, y0: holder.position.y, sp: 0.5, ph: Math.random() * 6 });
      m.rotation.y = 0; wl.push(holder);
      label(def.short, 'Inspect', p.x, p.y + 1.7, p.z, 0.55, 7);
      item({ id: 'w:' + p.id, x: p.x, y: p.y, z: p.z, r: 2.5, verb: 'INSPECT ' + def.short, disc: 'w:' + p.id, act: () => this.openWeapon(p, holder) });
    }
    // operator statues
    for (const p of POI.operators) {
      const idx = WAIFUS.findIndex((w) => w.id === p.id), w = WAIFUS[idx], need = C.OPERATOR_UNLOCK[w.id] || 1, locked = lvl < need;
      const r = buildWaifu({ team: 'blue', hair: w.hair, eye: w.eye, helmet: false }); r.setWeapon(null);
      r.root.position.set(p.x, p.y, p.z); r.root.rotation.y = -0.8 + Math.random() * 0.3; g.add(r.root); r.root.traverse((o) => { o.frustumCulled = false; o.castShadow = false; });
      if (locked) r.root.traverse((o) => { if (o.isMesh && !o.userData.outline) { o.material = new THREE.MeshBasicMaterial({ color: 0x141820, fog: false, transparent: !!o.material.transparent, opacity: o.material.opacity ?? 1 }); } });
      this.rigs.push({ r, base: r.root.rotation.y, locked, id: w.id });
      label(w.name, locked ? 'Sealed · LVL ' + need : w.role, p.x, p.y + 2.5, p.z, 0.6, 8);
      item({ id: 'o:' + w.id, x: p.x, y: p.y, z: p.z + 1.6, r: 2.2, verb: 'MEET ' + w.name, disc: 'o:' + w.id, act: () => this.openOperator(w, idx, need, locked) });
    }
    // map dioramas
    this.dioramas = [];
    for (const p of POI.maps) {
      const info = W.MAP_LIST.find((m) => m.id === p.id);
      const grp = p.id === 'sanctum' ? this.sanctumModel() : this.diorama(p.id);
      grp.position.set(p.x, p.y, p.z); g.add(grp); this.spin.push({ o: grp, y0: grp.position.y, sp: 0.18, ph: Math.random() * 6, bob: 0.02 });
      const nm = info ? info.name : 'SANCTUM';
      label(nm, p.id === 'sanctum' ? 'You are here' : 'Diorama', p.x, p.y + 1.6, p.z, 0.6, 8);
      item({ id: 'm:' + p.id, x: p.x, y: 1.6, z: p.z + 2.2, r: 2.0, verb: 'STUDY ' + nm, disc: 'm:' + p.id, act: () => this.openMap(p.id, info) });
    }
    // the codex orb
    const orb = new THREE.Group(); orb.position.set(0, 3.55, -30);
    orb.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshBasicMaterial({ color: 0xffe6b0, wireframe: true, fog: false })));
    orb.add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })));
    for (const [rx, rz] of [[1.2, 0], [0.4, 1.1]]) { const rg = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: 0x7fe6ff, fog: false })); rg.rotation.set(rx, 0, rz); orb.add(rg); }
    g.add(orb); this.orb = orb; label('CODEX', 'Lore and rules', 0, 4.7, -30, 0.6, 9);
    // the keeper
    const kw = WAIFUS.find((w) => w.id === 'eos'), keeper = buildWaifu({ team: 'blue', hair: kw.hair, eye: kw.eye, helmet: false }); keeper.setWeapon(null);
    keeper.root.position.set(3.4, 0, 29.4); g.add(keeper.root); keeper.root.traverse((o) => { o.frustumCulled = false; }); this.keeper = keeper; this.keeperLine = 0;
    label('THE KEEPER', 'Ask anything', 3.4, 2.9, 29.4, 0.7, 9);
    item({ id: 'keeper', x: 3.4, y: 0, z: 29.4, r: 2.8, verb: 'TALK TO THE KEEPER', disc: 'keeper', name: 'THE KEEPER', act: () => this.talk() });
    // the garden cat
    this.cat = this.makeCat(); g.add(this.cat.g); this.cat.g.position.set(-4, 0, 27); this.cat.st = { mode: 'idle', t: 2, tx: -4, tz: 27, sitT: 0 };
    item({ id: 'cat', x: -4, y: 0, z: 27, r: 2.2, verb: 'PET THE CAT', disc: 'cat', name: 'THE GARDEN CAT', act: () => this.petCat(), dynamic: true }); this.catItem = this.items[this.items.length - 1];
    // torii pass (auto)
    item({ id: 'torii', x: 0, y: 0, z: 24, r: 2.2, auto: true, disc: 'torii', label: 'THE TORII GATE' });
    // medal wall texture
    this.medalCanvas = cv(1024, 384, () => {}); const mt = new THREE.CanvasTexture(this.medalCanvas); mt.colorSpace = THREE.SRGBColorSpace; this.medalTex = mt;
    const mw = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.5), new THREE.MeshBasicMaterial({ map: mt, transparent: true, fog: false })); mw.position.set(0, 6.2, -42.88); g.add(mw); this.medalWall = mw;
    label('THE RELIC', 'Sealed chamber', 0, 5.6, -47.2, 0.6, 8);
    { const rel = new THREE.Group(); rel.position.set(0, 3.6, -47.5); const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), new THREE.MeshBasicMaterial({ color: 0xffb7d0, fog: false })); rel.add(core);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.02, 6, 48), new THREE.MeshBasicMaterial({ color: 0xffe0ea, fog: false })); halo.rotation.x = 1.2; rel.add(halo);
      const halo2 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.015, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffb7d0, fog: false })); halo2.rotation.set(0.3, 0, 1.1); rel.add(halo2); g.add(rel); this.relic = rel; }
    this.discIds = new Set(this.items.filter((i) => i.disc).map((i) => i.disc)); ['deep', 'blink', 'codex10'].forEach((k) => this.discIds.add(k)); this.total = this.discIds.size;
  }
  makeCat() {
    const g = new THREE.Group(), fur = new THREE.MeshStandardMaterial({ color: 0xd88a4a, roughness: 0.95 }), wh = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.95 }), dk = new THREE.MeshBasicMaterial({ color: 0x18110e });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), fur); body.scale.set(0.2, 0.19, 0.4); body.position.y = 0.34; g.add(body);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), wh); chest.scale.set(0.13, 0.14, 0.14); chest.position.set(0, 0.32, -0.28); g.add(chest);
    const head = new THREE.Group(); head.position.set(0, 0.46, -0.4); g.add(head);
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), fur); hm.scale.set(1, 0.9, 0.9); head.add(hm);
    for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.13, 4), fur); ear.position.set(sx * 0.09, 0.13, 0.0); ear.rotation.z = -sx * 0.25; head.add(ear); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), dk); eye.position.set(sx * 0.06, 0.03, -0.13); head.add(eye); }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffa0a8 })); nose.position.set(0, -0.01, -0.145); head.add(nose);
    const legs = []; for (const [x, z] of [[-0.09, -0.24], [0.09, -0.24], [-0.09, 0.24], [0.09, 0.24]]) { const l = new THREE.Group(); l.position.set(x, 0.24, z); const lm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.24, 6), fur); lm.position.y = -0.11; l.add(lm); g.add(l); legs.push(l); }
    const tail = new THREE.Group(); tail.position.set(0, 0.38, 0.36); let prev = tail; for (let i = 0; i < 4; i++) { const seg = new THREE.Group(); const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.16, 6), fur); sm.position.y = 0.08; seg.add(sm); seg.position.y = i ? 0.16 : 0; prev.add(seg); prev = seg; } g.add(tail);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return { g, head, legs, tail, walk: 0 };
  }
  petCat() {
    const c = this.cat, st = c.st; st.mode = 'sit'; st.t = 5; st.sitT = 5; Sound.play('purr', { vol: 0.7 });
    for (let i = 0; i < 10; i++) this.fx.emit(c.g.position.x + (Math.random() - 0.5) * 0.4, 0.9, c.g.position.z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, 0.7 + Math.random() * 0.5, (Math.random() - 0.5) * 0.4, 1.3, 0.28, 0.05, 1, 0.55, 0.7, 0.9, 0);
    const s = Profile.d.seen; s.pets = (s.pets || 0) + 1; Profile.save(); this.toast(s.pets % 5 === 0 ? 'THE CAT LOVES YOU' : 'PURRRR');
  }
  updateCat(dt) {
    const c = this.cat, st = c.st, g = c.g, p = this.p, T = this.t; if (!c) return;
    const dxp = p.x - g.position.x, dzp = p.z - g.position.z, dp = Math.hypot(dxp, dzp);
    st.t -= dt;
    if (st.mode === 'idle' || st.mode === 'sit') {
      if (st.t <= 0) {
        const r = Math.random();
        if (r < 0.4 && dp < 22) { const a = Math.random() * TAU; st.tx = p.x + Math.cos(a) * 2.2; st.tz = p.z + Math.sin(a) * 2.2; }
        else { st.tx = (Math.random() - 0.5) * 60; st.tz = -6 + Math.random() * 40; }
        if (Math.abs(st.tx) < 12.2 && st.tz > -11 && st.tz < 7) { st.tz = 9; }
        st.mode = 'walk'; st.t = 14;
      }
    } else if (st.mode === 'walk') {
      const dx = st.tx - g.position.x, dz = st.tz - g.position.z, d = Math.hypot(dx, dz), sp = dp > 9 ? 3.4 : 1.7;
      if (d < 0.4 || st.t <= 0) { st.mode = Math.random() < 0.5 ? 'sit' : 'idle'; st.t = 3 + Math.random() * 6; }
      else {
        const nx = g.position.x + (dx / d) * sp * dt, nz = g.position.z + (dz / d) * sp * dt, y = W.groundAt(g.position.x, g.position.z, 20);
        if (!W.blocked(nx, nz, Math.max(0, y), 0.22, 0.4)) { g.position.x = nx; g.position.z = nz; } else { st.tx = g.position.x + (Math.random() - 0.5) * 8; st.tz = g.position.z + (Math.random() - 0.5) * 8; }
        let dy = Math.atan2(-dx, -dz) - g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.rotation.y += dy * Math.min(1, dt * 8);
      }
    }
    const y = W.groundAt(g.position.x, g.position.z, 20); g.position.y = Number.isFinite(y) ? y : 0;
    const walking = st.mode === 'walk', sitting = st.mode === 'sit';
    c.walk += dt * (walking ? 9 : 0); c.legs.forEach((l, i) => { l.rotation.x = walking ? Math.sin(c.walk + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI * 0.5 : 0)) * 0.7 : 0; });
    c.g.children[0].position.y = sitting ? 0.27 : 0.34; c.g.children[0].rotation.x = sitting ? -0.5 : 0; c.head.position.y = sitting ? 0.55 : 0.46; c.head.rotation.x = sitting ? 0.2 : Math.sin(T * 1.7) * 0.05;
    c.tail.children[0].rotation.z = Math.sin(T * (walking ? 5 : 2)) * 0.5; let seg = c.tail.children[0].children[1] ? c.tail.children[0].children[1] : null; for (let i = 1; seg && i < 4; i++) { seg.rotation.z = Math.sin(T * 3 + i) * 0.35; seg = seg.children[1] || null; }
    c.tail.rotation.x = 0.6 + (sitting ? 0.5 : 0);
    if (this.catItem) { this.catItem.x = g.position.x; this.catItem.z = g.position.z; }
  }
  sanctumModel() {
    const g = new THREE.Group(), base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.08, 24), new THREE.MeshStandardMaterial({ color: 0x8faa70, roughness: 1 })); g.add(base);
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.09, 20), new THREE.MeshStandardMaterial({ color: 0x1a5a72, roughness: 0.2 })); pond.position.y = 0.01; g.add(pond);
    const red = new THREE.MeshStandardMaterial({ color: 0xc23a30, roughness: 0.5 });
    for (const sx of [-0.28, 0.28]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.6, 8), red); p.position.set(sx, 0.34, 0.9); g.add(p); }
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.08), red); k.position.set(0, 0.66, 0.9); g.add(k);
    const v = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x3a3d46 })); v.position.set(0, 0.24, -0.9); g.add(v);
    for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshStandardMaterial({ color: 0xffb7d0, roughness: 1, flatShading: true })); const a = (i / 5) * TAU; t.position.set(Math.cos(a) * 0.8, 0.42, Math.sin(a) * 0.6); g.add(t); }
    return g;
  }
  diorama(id) {
    const data = W.peekMap(id), g = new THREE.Group();
    const tint = { lockout: [0x6a7a98, 0xb6c8ea], cryostat: [0x4a6a88, 0xa8dcff], mesa: [0x9a5a3a, 0xf0b070], overgrowth: [0x3a5a48, 0x88c088], warsat: [0x6a5a34, 0xe0b830] }[id] || [0x666666, 0xdddddd];
    const k = Math.min(2.7 / (data.bounds.x * 2), 2.2 / (data.bounds.z * 2)), lo = new THREE.Color(tint[0]), hi = new THREE.Color(tint[1]);
    const pos = [], col = [], idx = [];
    const c = new THREE.Color();
    for (const s of data.solids) {
      if (s.y0 < -0.05 || s.y1 - s.y0 < 0.3 || s.mat === 'floor' || s.mat === 'ground' || s.mat === 'invis' || (s.x1 - s.x0 > 60)) continue;
      const y1 = s.ramp ? (s.ramp.ya + s.ramp.yb) / 2 : s.y1, y0 = s.ramp ? s.y0 : s.y0;
      const x0 = s.x0 * k, x1 = s.x1 * k, z0 = s.z0 * k, z1 = s.z1 * k, ya = y0 * k * 1.6, yb = Math.max(ya + 0.01, y1 * k * 1.6);
      const b = pos.length / 3;
      const V = [[x0, ya, z0], [x1, ya, z0], [x1, yb, z0], [x0, yb, z0], [x0, ya, z1], [x1, ya, z1], [x1, yb, z1], [x0, yb, z1]];
      for (const v of V) { pos.push(...v); c.copy(lo).lerp(hi, clamp(v[1] / (12 * k * 1.6), 0, 1)); col.push(c.r, c.g, c.b); }
      for (const f of [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5], [3, 7, 6], [3, 6, 2], [0, 1, 5], [0, 5, 4]]) idx.push(b + f[0], b + f[1], b + f[2]);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 })); g.add(mesh);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, 0.06, 40), new THREE.MeshStandardMaterial({ color: 0x1c2028, metalness: 0.5, roughness: 0.4 })); base.position.y = -0.03; g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.018, 6, 64), new THREE.MeshBasicMaterial({ color: hi, fog: false })); ring.rotation.x = Math.PI / 2; g.add(ring);
    return g;
  }

  refreshMedals() {
    if (!this.medalCanvas) return;
    const g = this.medalCanvas.getContext('2d'), w = 1024, h = 384, d = Profile.d;
    g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(8,10,14,.72)'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,214,140,.7)'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
    g.textAlign = 'left'; g.fillStyle = '#ffd98a'; g.font = '700 26px Syncopate, sans-serif'; g.fillText('WALL OF MEDALS', 34, 52);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '500 17px "JetBrains Mono", monospace'; g.fillText(`${Profile.callsign}  ·  ${Profile.rank}  ·  LVL ${Profile.level}`, 34, 82);
    const list = C.MEDAL_INFO; list.forEach(([name], i) => {
      const cx = 34 + (i % 5) * 196, cy = 112 + Math.floor(i / 5) * 118, n = d.medals[name] || 0;
      g.fillStyle = n ? 'rgba(255,214,140,.16)' : 'rgba(255,255,255,.04)'; g.fillRect(cx, cy, 180, 98);
      g.strokeStyle = n ? '#ffd98a' : 'rgba(255,255,255,.2)'; g.lineWidth = 1.5; g.strokeRect(cx, cy, 180, 98);
      g.fillStyle = n ? '#ffe8b0' : 'rgba(255,255,255,.35)'; g.font = '700 14px "JetBrains Mono", monospace'; g.fillText(name, cx + 10, cy + 26);
      g.font = '700 38px Syncopate, sans-serif'; g.fillText(n ? String(n) : '-', cx + 10, cy + 78);
    });
    this.medalTex.needsUpdate = true;
  }

  // ------------------------------------------------------------ cards
  showCard(o) {
    this.card = o; const el = this.q('#hubCard');
    this.q('#hcK').textContent = o.kicker || ''; this.q('#hcT').textContent = o.title || ''; this.q('#hcS').textContent = o.sub || ''; this.q('#hcB').textContent = o.body || '';
    this.q('#hcStats').innerHTML = (o.stats || []).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    const acts = []; if (o.use) acts.push([glyph('use'), o.use]); if (o.alt) acts.push([glyph(o.altAction || 'fire'), o.alt]); if (o.skin) acts.push([glyph('swap'), 'SKIN']); if (o.focusHint) acts.push([glyph('zoom'), 'LOOK']); if (o.pager) acts.push([glyph('left') + glyph('right'), 'PAGE']); acts.push([glyph('back'), 'CLOSE']);
    this.q('#hcAct').innerHTML = acts.map(([g, t]) => `<span>${g}<em>${t}</em></span>`).join('');
    el.classList.add('on'); Sound.play('menuOk', { vol: 0.5 });
  }
  closeCard() { if (!this.card) return; this.card = null; this.focus = null; this.q('#hubCard').classList.remove('on'); Sound.play('menuBack', { vol: 0.5 }); }

  openWeapon(p, holder) {
    const id = p.id, def = WEAPONS[id]; this.focus = { x: p.x, y: p.y + 0.85, z: p.z, d: 2.6, from: [p.x + 2.3, p.y + 1.15, p.z + 1.2], spin: holder }; this.skinIdx = 0;
    this.showCard({ swapUse: true, kicker: `${def.exotic ? 'EXOTIC' : def.melee ? 'MELEE' : 'FIREARM'} · ${['SIDEARM', 'STANDARD', 'HEAVY', 'POWER', 'RELIC', 'EXOTIC'][clamp(def.power, 0, 5)] || 'ISSUE'}`, title: def.name, body: (def.perk ? def.perk[0] + '. ' + def.perk[1] + '  ' : '') + C.WEAPON_INFO[id], stats: C.weaponStats(id), alt: def.melee ? 'SWING' : 'TEST FIRE', altAction: 'fire',
      onAlt: () => this.testFire(id, def, holder), skin: true, onSkin: () => this.cycleSkin(id, holder) });
  }
  cycleSkin(id, holder) {
    this.skinIdx = ((this.skinIdx || 0) + 1) % C.SKINS.length; const sk = C.SKINS[this.skinIdx], own = C.state({ ...sk, cat: 'skin' }) !== 'locked';
    holder.remove(holder.children[0]); const m = applySkin(makeWeaponMesh(id), sk.tint); m.scale.setScalar(1.35); holder.add(m);
    this.q('#hcS').textContent = `SKIN · ${sk.name}${own ? '' : ' · LOCKED'}`; Sound.play('menuMove', { vol: 0.6 });
  }
  testFire(id, def, holder) {
    const wp = new THREE.Vector3(); holder.getWorldPosition(wp); const f = new THREE.Vector3(0, 0.02, 1);
    if (def.melee) { Sound.play('swing', { vol: 0.8 }); this.fx.light(wp.x, wp.y, wp.z, 0x8ad8ff, 10, 0.25, 6); this.spin.forEach((s) => { if (s.o === holder) s.kick = 1; }); return; }
    Sound.play(def.snd, { vol: 0.7 }); this.fx.flash(wp.x, wp.y + 0.1, wp.z + 0.7, 0.6, def.tracer || 0xffe6a0); this.fx.tracer({ x: wp.x, y: wp.y + 0.1, z: wp.z + 0.7 }, { x: wp.x, y: wp.y + 0.1, z: wp.z + 6 }, def.tracer || 0xffe6a0); this.fx.light(wp.x, wp.y + 0.2, wp.z + 0.7, def.tracer || 0xffc070, 14, 0.12, 6);
    this.spin.forEach((s) => { if (s.o === holder) s.kick = 1; }); void f;
  }
  openStatue(i) {
    const S = POI.statues, n = S.length; i = ((i % n) + n) % n; const q = S[i], top = q.y + q.top, fx = -Math.sin(q.yaw), fz = -Math.cos(q.yaw);
    this.statueI = i; this.focus = { x: q.x, y: top + (q.big ? 3.6 : 2.0), z: q.z, d: q.big ? 8 : 4.2, from: [q.x + fx * (q.big ? 8.5 : 4.6) + fz * 0.9, top + (q.big ? 3.0 : 1.7), q.z + fz * (q.big ? 8.5 : 4.6) - fx * 0.9] };
    this.discover('st:' + i, q.name);
    this.showCard({ kicker: `${q.k === 'goddess' ? 'GODDESS' : 'GUARDIAN'} · ${i + 1}/${n}`, title: q.name, sub: q.epi.toUpperCase(), body: q.lore, pager: true, onPrev: () => this.openStatue(i - 1), onNext: () => this.openStatue(i + 1) });
  }
  openOperator(w, idx, need, locked) {
    const own = Profile.d.eq.operator === w.id;
    const opos = POI.operators.find((q) => q.id === w.id); if (opos) this.focus = { x: opos.x, y: opos.y + 1.05, z: opos.z, d: 3.1, from: [opos.x - 1.2, opos.y + 1.5, opos.z + 3.4] };
    this.showCard({ kicker: `OPERATOR · ${w.role}`, title: w.name, sub: locked ? `SEALED · REACH LEVEL ${need}` : own ? 'EQUIPPED' : 'AVAILABLE', body: w.blurb, stats: [['ROLE', w.role], ['UNLOCK', 'LVL ' + need], ['HAIR', '#' + w.hair.toString(16).toUpperCase()], ['EYES', '#' + w.eye.toString(16).toUpperCase()]],
      use: locked || own ? null : 'EQUIP', onUse: () => { Profile.equip('operator', w.id); this.loadout.waifu = idx; this.ctx.onEquip('operator', w.id); this.buildAvatar(); this.toast(w.name + ' EQUIPPED'); this.closeCard(); } });
  }
  openMap(id, info) {
    const md = { lockout: 'Slayer, Oddball', cryostat: 'Snipers, CTF', mesa: 'Slayer, Fiesta', overgrowth: 'Warlock Hunt, CTF', warsat: 'Warlock Hunt, Oddball', sanctum: 'Nobody fights here' }[id];
    const mp = POI.maps.find((q) => q.id === id); if (mp) this.focus = { x: mp.x, y: mp.y + 0.5, z: mp.z, d: 3.3, from: [mp.x, mp.y + 1.5, mp.z + 3.4] };
    this.showCard({ kicker: 'DIORAMA', title: info ? info.name : 'THE SANCTUM', body: info ? info.tag : 'The garden you are standing in. Cherry trees, a bridge, a vault. Peaceful by design.', stats: [['BEST FOR', md], ['STATUS', id === 'sanctum' ? 'HOME' : 'OPEN']], use: id === 'sanctum' ? null : 'DEPLOY', onUse: () => { this.closeCard(); this.ctx.deployMap(id); } });
  }
  openCodex(page) {
    const pages = [...C.POWER_INFO.map((p) => ['POWER-UP', p.name, p.blurb]), ...Object.values(MODES).map((m) => ['GAME MODE', m.name, m.blurb]), ...C.MEDAL_INFO.map(([n, b]) => ['MEDAL', n, b]), ...LORE.map(([t, b]) => ['LORE', t, b])];
    this.codexPage = ((page % pages.length) + pages.length) % pages.length; const [k, t, b] = pages[this.codexPage];
    this.focus = { x: 0, y: 3.55, z: -30, d: 3.4, from: [0.4, 3.9, -26.8] };
    this.codexSeen = this.codexSeen || new Set(); this.codexSeen.add(this.codexPage); if (this.codexSeen.size >= 10) this.discover('codex10', 'CODEX SCHOLAR');
    this.showCard({ kicker: `${k} · ${this.codexPage + 1}/${pages.length}`, title: t, body: b, pager: true, onPrev: () => this.openCodex(this.codexPage - 1), onNext: () => this.openCodex(this.codexPage + 1) });
  }
  openMedals() {
    const d = Profile.d, s = d.stats, total = Object.values(d.medals).reduce((a, b) => a + b, 0), kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2);
    this.showCard({ kicker: 'SERVICE HISTORY', title: 'WALL OF MEDALS', body: `${Profile.callsign}, ${Profile.rank}. ${total} medals earned across ${s.matches} matches.`, stats: [['KILLS', s.kills], ['K/D', kd], ['HEADSHOTS', s.headshots], ['PERFECTS', s.perfects], ['WINS', s.wins], ['BEST STREAK', s.streakBest]] });
  }
  talk() {
    const s = Profile.d.seen; const lines = KEEPER.slice(); if (this.discCount() >= DEEP_AT) lines.push('You have walked every path. The deep vault will open for you now.');
    if (!s.keeperMet) { s.keeperMet = 1; Profile.save(); this.keeperLine = 0; } else this.keeperLine = (this.keeperLine + 1) % lines.length;
    this.showCard({ kicker: 'THE KEEPER', title: 'KEEPER OF THE GARDEN', body: lines[this.keeperLine], use: 'NEXT WORD', onUse: () => this.talk() });
  }
  claimRelic() {
    const s = Profile.d.stats;
    if (s.relic) { this.showCard({ kicker: 'THE SANCTUM RELIC', title: 'A QUIET PULSE', body: 'You carry its mark already. The relic is content.' }); return; }
    s.relic = 1; Profile.d.credits += 500; Profile.own('halo:sakura'); Profile.save();
    this.showCard({ kicker: 'RELIC CLAIMED', title: 'SAKURA HALO', body: 'The relic dissolves into petals. A new halo and the title KEEPER OF THE GARDEN are yours, plus 500 credits. Equip them in the Armory.', stats: [['HALO', 'SAKURA'], ['TITLE', 'KEEPER'], ['CREDITS', '+500']] });
    Sound.play('win', { vol: 0.7 }); this.fx.nova(0, 2.6, -47.5, 5);
  }
  openVault() {
    if (this.doorOpen) { this.toast('THE VAULT STANDS OPEN'); return; }
    this.doorOpen = true; W.setHubDoor('main', true); this.world.hub.doorTarget = 1; Sound.play('vault', { vol: 0.9 }); this.camShake = 0.35;
    this.toast('THE VAULT DOOR SLIDES OPEN');
  }
  openDeep() {
    if (this.deepOpen) return;
    if (this.discCount() < DEEP_AT) { this.showCard({ kicker: 'SEALED', title: 'THE DEEP VAULT', body: `Nothing opens it by force. Explore the Sanctum: ${DEEP_AT - this.discCount()} more discoveries.`, stats: [['DISCOVERED', `${this.discCount()}/${this.total}`], ['REQUIRED', DEEP_AT]] }); Sound.play('empty', { vol: 0.8 }); return; }
    this.deepOpen = true; W.setHubDoor('deep', true); this.world.hub.deepTarget = 1; Sound.play('vault', { vol: 1 }); this.camShake = 0.4; this.discover('deep', 'THE DEEP VAULT');
  }
  sitDown(spot, yaw) { this.sit = { x: spot.x, z: spot.z, yaw, t: 0 }; this.p.x = spot.x; this.p.z = spot.z; this.p.vx = this.p.vz = 0; this.toast('SIT AND BREATHE. MOVE TO STAND.'); }

  // ------------------------------------------------------------ frame
  setWorld(w) { this.world = w; }
  region() {
    const { x, z } = this.p;
    if (z < -23 && z > -44 && Math.abs(x) < 17) return 'THE VAULT';
    if (z < -44) return 'THE DEEP VAULT';
    if (x < -18 && z > 1 && z < 16) return 'ATRIUM CAFE';
    if (x < -19 && z < -1 && z > -22) return 'COURT OF GODDESSES';
    if (x > 20 && z > 10 && z < 22) return 'CARILLON';
    if (x > 22 && z < -1 && z > -25) return 'GUARDIAN COURT';
    if (Math.abs(x) < 12 && z < 7 && z > -11) return 'REFLECTING POOL';
    if (z < -11 && z > -24) return 'VAULT TERRACE';
    if (z > 16 && z < 30 && Math.abs(x) < 19) return 'GRAND PLAZA';
    return 'THE PROMENADE';
  }

  update(dt) {
    this.t += dt; const p = this.p, c = this.cam, T = this.t;
    const busy = !!this.card || this.busy;
    // input
    let mx = 0, mz = 0, jump = false;
    if (!busy) {
      const mv = Input.move, y = c.yaw, fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
      mx = rx * mv.x + fx * -mv.y; mz = rz * mv.x + fz * -mv.y; jump = Input.held.jump;
      c.yaw -= Input.look.x; c.pitch = clamp(c.pitch - Input.look.y, -1.25, 0.55);
      if (this.sit && (Math.hypot(mx, mz) > 0.3 || jump)) this.sit = null;
    } else if (this.card) {
      const cd = this.card;
      if (this.focus && this.focus.spin) { this.focus.spin.rotation.y -= Input.look.x * 1.6; }
      if (Input.pressed.back || Input.pressed.use && !cd.use) this.closeCard();
      else if (Input.pressed.use && cd.use) { const f = cd.onUse; if (f) f(); }
      else if (cd.alt && (Input.pressed.fire || Input.pressed.melee)) cd.onAlt && cd.onAlt();
      else if (cd.skin && Input.pressed.swap) cd.onSkin();
      else if (cd.pager) { if (Input.nav.left) cd.onPrev(); if (Input.nav.right) cd.onNext(); if (Input.pressed.gswitch) cd.onPrev(); if (Input.pressed.nova) cd.onNext(); }
    }
    // movement
    const speed = Math.hypot(mx, mz), sit = !!this.sit;
    let wx = 0, wz = 0;
    if (!sit && speed > 0.05) { wx = mx * RUN; wz = mz * RUN; }
    if (p.gliding) { wx *= 1.15; wz *= 1.15; }
    const acc = p.grounded ? 46 : p.gliding ? 15 : 7;
    p.vx += clamp(wx - p.vx, -acc * dt, acc * dt); p.vz += clamp(wz - p.vz, -acc * dt, acc * dt);
    if (jump && p.grounded && !sit) { p.vy = JUMP; p.grounded = false; Sound.play('jump', { vol: 0.4 }); }
    p.gliding = !p.grounded && jump && p.vy < 0.4 && !sit;
    p.blinkCd = Math.max(0, p.blinkCd - dt);
    if (Input.pressed.blink && p.blinkCd <= 0 && !busy && !sit) this.blink();
    const nx = p.x + p.vx * dt; if (!W.blocked(nx, p.z, p.y, RAD, H)) p.x = nx; else p.vx = 0;
    const nz = p.z + p.vz * dt; if (!W.blocked(p.x, nz, p.y, RAD, H)) p.z = nz; else p.vz = 0;
    if (p.grounded) { const g = W.groundAt(p.x, p.z, p.y); if (g >= p.y - W.STEP * 1.1) p.y = g; else p.grounded = false; }
    if (!p.grounded) {
      p.vy -= GRAV * dt; if (p.gliding && p.vy < -2.2) p.vy += (-2.2 - p.vy) * Math.min(1, dt * 12);
      let ny = p.y + p.vy * dt;
      if (p.vy > 0) { const cl = W.ceilingBetween(p.x, p.z, p.y + H, ny + H); if (cl < Infinity) { ny = cl - H - 0.001; p.vy = 0; } }
      else { const g = W.groundAt(p.x, p.z, p.y); if (ny <= g) { ny = g; if (p.vy < -7) Sound.play('land', { vol: 0.4 }); p.vy = 0; p.grounded = true; } }
      p.y = ny;
    }
    if (p.y < -20) { const s = POI.spawn; p.x = s.x; p.y = s.y; p.z = s.z; p.vx = p.vz = p.vy = 0; }
    // keep inside the world
    p.x = clamp(p.x, -42.5, 42.5); p.z = clamp(p.z, -52, 42.5);
    const hs = Math.hypot(p.vx, p.vz);
    if (hs > 0.5 && !sit) { const ty = Math.atan2(-p.vx, -p.vz); let d = ty - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * Math.min(1, dt * 10); }
    if (sit) { let d = this.sit.yaw - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * Math.min(1, dt * 4); this.sit.t += dt; if (this.sit.t > 12 && !this.sit.rew) { this.sit.rew = 1; this.toast('CALM. +10 XP'); Profile.addXp(10, 0); } }
    if (p.grounded && hs > 1.5) { this.stepD += hs * dt; if (this.stepD > 2.4) { this.stepD = 0; Sound.play('step', { vol: 0.16 }); } }
    // avatar
    const av = this.avatar;
    if (av) {
      av.root.position.set(p.x, p.y - (sit ? 0.35 : 0), p.z); av.root.rotation.y = p.yaw; av.root.visible = this.focusK < 0.5;
      animateRig(av, dt, { speed: sit ? 0 : hs, lx: 0, lz: 1, grounded: p.grounded, crouch: sit ? 0.95 : 0, pitch: 0, weaponId: null });
    }
    // camera
    const tx = p.x, ty = p.y + (sit ? 0.9 : 1.55), tz = p.z;
    c.x = damp(c.x || tx, tx, 12, dt); c.y = damp(c.y || ty, ty, 8, dt); c.z = damp(c.z || tz, tz, 12, dt);
    const orbit = sit ? this.sit.t * 0.05 : 0, yaw = c.yaw + orbit, f = forward(yaw, c.pitch, { x: 0, y: 0, z: 0 });
    const rx = Math.cos(yaw), rz = -Math.sin(yaw), sx = c.x + rx * 0.45, sy = c.y + 0.2, sz = c.z + rz * 0.45;
    let d = sit ? 3.6 : c.dist; const tc = W.rayWorld(sx, sy, sz, -f.x, -f.y, -f.z, d + 0.3); if (tc < Infinity) d = Math.max(0.7, tc - 0.3);
    const cam = this.camera, sh = this.camShake ? (Math.random() - 0.5) * this.camShake * 0.25 : 0; this.camShake = (this.camShake || 0) * Math.exp(-dt * 5);
    cam.position.set(sx - f.x * d + sh, sy - f.y * d + sh, sz - f.z * d);
    cam.fov = damp(cam.fov, p.gliding ? 74 : 66, 4, dt); cam.updateProjectionMatrix();
    cam.rotation.set(c.pitch, yaw, 0, 'YXZ');
    // exhibit focus: glide the camera in front of whatever the card is about
    this.focusK = damp(this.focusK, this.focus ? 1 : 0, 5, dt);
    if (this.focusK > 0.004 && (this.focus || this.lastFocus)) {
      const F = this.focus || this.lastFocus; this.lastFocus = F; const fk = this.focusK * this.focusK * (3 - 2 * this.focusK);
      const fp = new THREE.Vector3(...(F.from || [F.x, F.y + 0.3, F.z + F.d])), tgt = new THREE.Vector3(F.x, F.y, F.z), dirv = tgt.clone().sub(fp).normalize(), rightv = dirv.clone().cross(new THREE.Vector3(0, 1, 0)).normalize(), look = tgt.clone().add(rightv.multiplyScalar(F.d * 0.3));
      const q0 = cam.quaternion.clone(), pos0 = cam.position.clone(); cam.position.lerp(fp, fk);
      const tmp = new THREE.PerspectiveCamera(); tmp.position.copy(fp); tmp.lookAt(look); cam.quaternion.copy(q0).slerp(tmp.quaternion, fk); void pos0;
      if (!this.focus && this.focusK < 0.02) this.lastFocus = null;
    }
    // ambient-life
    this.updateCat(dt);
    if (Input.pressed.cam && !busy) { this.photo = !this.photo; this.el.classList.toggle('photo', this.photo); }
    Sound.night = this.world && this.world.hub ? this.world.hub.night : 0;
    this.animateWorld(dt); this.interactions(dt, busy);
    this.q('#hhRegion').textContent = this.region();
    if (this.world && this.world.snow) this.world.snow.update(dt, cam.position, T);
    this.fx.update(dt); this.fx.setScale(this.ctx.height() * this.ctx.pixelRatio(), cam.fov);
  }
  blink() {
    const p = this.p, mv = Input.move, y = this.cam.yaw; let dx = Math.cos(y) * mv.x + -Math.sin(y) * -mv.y, dz = -Math.sin(y) * mv.x + -Math.cos(y) * -mv.y; const l = Math.hypot(dx, dz);
    if (l < 0.15) { dx = -Math.sin(p.yaw); dz = -Math.cos(p.yaw); } else { dx /= l; dz /= l; }
    const ox = p.x, oy = p.y, oz = p.z; let dist = 0;
    while (dist < 9) { const nx = p.x + dx * 0.4, nz = p.z + dz * 0.4; if (W.blocked(nx, nz, p.y, RAD, H)) break; p.x = nx; p.z = nz; dist += 0.4; if (p.grounded) { const g = W.groundAt(p.x, p.z, p.y); if (g >= p.y - W.STEP * 1.1) p.y = g; else p.grounded = false; } }
    if (dist < 1.2) { p.x = ox; p.y = oy; p.z = oz; p.grounded = true; return; }
    p.blinkCd = 2.5; p.vx = dx * 6; p.vz = dz * 6; this.fx.blink(ox, oy, oz, p.x, p.y, p.z); Sound.play('blink', { vol: 0.7 }); this.discover('blink', 'BLINK');
  }
  animateWorld(dt) {
    const T = this.t;
    for (const s of this.spin) { if (!(this.focus && this.focus.spin === s.o)) s.o.rotation.y += dt * s.sp; s.o.position.y = s.y0 + Math.sin(T * 1.3 + s.ph) * (s.bob ?? 0.05); if (s.kick) { s.kick = Math.max(0, s.kick - dt * 5); s.o.rotation.z = Math.sin(s.kick * 12) * 0.08 * s.kick; } }
    for (const r of this.rigs) { const near = Math.hypot(r.r.root.position.x - this.p.x, r.r.root.position.z - this.p.z) < 16; r.r.root.visible = Math.abs(r.r.root.position.z - this.p.z) < 40; if (!near) continue; r.r.root.rotation.y = r.base + Math.sin(T * 0.4 + r.base) * 0.18; animateRig(r.r, dt, { speed: 0, lx: 0, lz: 1, grounded: true, crouch: 0, pitch: 0, weaponId: null }); }
    if (this.keeper) { const k = this.keeper, dx = this.p.x - k.root.position.x, dz = this.p.z - k.root.position.z; const want = Math.atan2(-dx, -dz), near = Math.hypot(dx, dz) < 12; let d = (near ? want : Math.PI) - k.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); k.root.rotation.y += d * Math.min(1, dt * 3); animateRig(k, dt, { speed: 0, lx: 0, lz: 1, grounded: true, crouch: 0, pitch: 0.05, weaponId: null }); }
    if (this.relic) { const got = !!Profile.d.stats.relic; this.relic.visible = !got; this.relic.rotation.y += dt * 0.9; this.relic.children[1].rotation.z += dt * 1.2; this.relic.children[2].rotation.x += dt * 1.6; this.relic.position.y = 3.6 + Math.sin(T * 1.4) * 0.12; }
    if (this.orb) { this.orb.rotation.y += dt * 0.8; this.orb.children[2].rotation.z += dt * 1.1; this.orb.children[3].rotation.x += dt * 0.9; this.orb.position.y = 3.55 + Math.sin(T * 1.2) * 0.1; }
    for (const l of this.labels) { const d = Math.hypot(l.position.x - this.p.x, l.position.z - this.p.z), r = l.userData.r || 8; l.material.opacity = clamp((r - d) / (r * 0.4), 0, 1) * 0.95; }
  }
  interactions(dt, busy) {
    const p = this.p; let best = null, bd = 1e9;
    for (const it of this.items) {
      const dx = p.x - it.x, dz = p.z - it.z, d = Math.hypot(dx, dz), dy = Math.abs(p.y - (it.y || 0));
      if (d > it.r || dy > 2.4) continue;
      if (it.auto) { if (it.disc && !this.disc[it.disc]) this.discover(it.disc, it.label || it.disc); continue; }
      if (d < bd) { bd = d; best = it; }
    }
    this.near = busy ? null : best;
    const pr = this.q('#hhPrompt');
    if (this.near) {
      const v = typeof this.near.verb === 'function' ? this.near.verb() : this.near.verb, html = `${glyph('use')}<span>${v}</span>`;
      if (pr.dataset.k !== html) { pr.innerHTML = html; pr.dataset.k = html; } pr.classList.add('on');
      if (Input.pressed.use) { const it = this.near; if (it.disc && this.discIds.has(it.disc) && !it.deferDisc) this.discover(it.disc, it.name || (it.disc.startsWith('w:') ? WEAPONS[it.disc.slice(2)].short : it.disc.startsWith('o:') ? (WAIFUS.find((w) => w.id === it.disc.slice(2)) || {}).name : it.disc.startsWith('m:') ? (W.MAP_LIST.find((mm) => mm.id === it.disc.slice(2)) || { name: 'THE SANCTUM' }).name : it.disc.toUpperCase())); it.act(); }
    } else { pr.classList.remove('on'); pr.dataset.k = ''; }
    void dt;
  }
}
void svg; void MEDAL_ICONS; void TEAM; void ICONS;
