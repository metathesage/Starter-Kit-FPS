// Match engine: actors, movement, weapons, projectiles, damage, medals, pickups, rules.
import * as THREE from 'three';
import * as W from './world.js';
import { WEAPONS, makeWeaponMesh, makeGrenadeMesh, makeRocketMesh } from './weapons.js';
import { buildWaifu, animateRig, disposeRig, BOT_STYLES, TEAM } from './rig.js';
import { Sound } from './audio.js';
import { Bus, clamp, rand, pick, forward, lerp, damp, angDiff } from './util.js';
import { Brain } from './bots.js';

export const EYE_STAND = 1.62, EYE_CROUCH = 1.15, H_STAND = 1.78, H_CROUCH = 1.3, RAD = 0.4;
const RUN = 5.4, CROUCH_SPEED = 2.6, GRAV = 21, JUMP = 7.4;
const SHIELD_MAX = 100, HEALTH_MAX = 45, RECHARGE_DELAY = 4.6, RECHARGE_RATE = 30;
const _f = { x: 0, y: 0, z: 0 };

const V3 = () => new THREE.Vector3();
const _mz = V3();

export const DIFFICULTY = {
  easy: { name: 'EASY', react: 0.85, aimErr: 0.075, turn: 3.2, acc: 0.55, grenade: 0.3, dmgIn: 0.75, strafe: 0.5 },
  normal: { name: 'NORMAL', react: 0.55, aimErr: 0.045, turn: 4.6, acc: 0.75, grenade: 0.5, dmgIn: 1.0, strafe: 0.8 },
  heroic: { name: 'HEROIC', react: 0.32, aimErr: 0.026, turn: 6.5, acc: 0.9, grenade: 0.8, dmgIn: 1.1, strafe: 1.0 },
  legendary: { name: 'LEGENDARY', react: 0.16, aimErr: 0.013, turn: 9, acc: 1, grenade: 1, dmgIn: 1.25, strafe: 1.2 },
};

let _uid = 1;
export class Actor {
  constructor(match, { name, team, style, isPlayer = false, id = null, remote = null, helmet }) {
    this.m = match; this.id = id ?? _uid++; if (id !== null && id >= _uid) _uid = id + 1; this.remote = remote; this.netT = null; this.spawnSeq = 0; this.name = name; this.team = team; this.isPlayer = isPlayer; this.style = style;
    this.rig = buildWaifu({ team, hair: style.hair, eye: style.eye, helmet: helmet ?? (isPlayer ? match.cfg.helmet !== false : true) });
    this.rig.root.visible = false;
    match.scene.add(this.rig.root);
    this.cmd = { mx: 0, mz: 0, fire: false, fireEdge: false, zoom: false, jump: false, crouch: false, melee: false, grenade: false, reload: false, swap: false, use: false, gswitch: false };
    this.kills = 0; this.deaths = 0; this.assists = 0; this.streak = 0; this.medals = {}; this.lastKiller = -1; this.multiT = -99; this.multi = 0;
    this.alive = false; this.deadT = 0; this.respawnAt = 0;
    this.x = 0; this.y = 0; this.z = 0; this.vx = 0; this.vy = 0; this.vz = 0; this.yaw = 0; this.pitch = 0;
    this.grounded = true; this.crouch = 0; this.h = H_STAND;
    this.weapons = []; this.cur = 0; this.gren = { frag: 2, plasma: 2 }; this.gtype = 'frag';
    this.shield = SHIELD_MAX; this.health = HEALTH_MAX; this.over = 0; this.overT = 0;
    this.dmgBy = new Map(); this.brain = null; this.kick = 0; this.stepD = 0; this.lastFireT = -9; this.lastMoveSpeed = 0;
    this.resetTimers();
  }
  resetTimers() {
    this.fireT = 0; this.reloadT = 0; this.swapT = 0; this.meleeT = 0; this.throwT = 0; this.pend = null; this.pendThrow = null; this.burstLeft = 0; this.fireBuf = 0;
    this.lastHit = 99; this.spawnProt = 0; this.zoomLevel = 0; this.lunge = null; this.lungeCd = 0; this.bloom = 0; this.gcd = 0;
  }
  get weapon() { return this.weapons[this.cur] || null; }
  get def() { const w = this.weapon; return w ? WEAPONS[w.id] : null; }
  get eye() { return this.y + lerp(EYE_STAND, EYE_CROUCH, this.crouch); }
  get chest() { return this.y + this.h * 0.62; }
  get fovZoom() { const d = this.def; return this.zoomLevel > 0 && d && d.zoom ? d.zoom[this.zoomLevel - 1] : 1; }

  spawn(pt) {
    this.x = pt.x; this.y = pt.y; this.z = pt.z; this.yaw = pt.yaw; this.pitch = 0;
    this.vx = this.vy = this.vz = 0; this.grounded = true; this.crouch = 0; this.h = H_STAND;
    this.alive = true; this.deadT = 0;
    this.shield = SHIELD_MAX; this.health = HEALTH_MAX; this.over = 0; this.overT = 0;
    this.weapons = [{ id: 'br', mag: WEAPONS.br.mag, res: WEAPONS.br.reserve }]; this.cur = 0;
    this.gren = { frag: 2, plasma: 2 }; this.gtype = 'frag';
    this.resetTimers(); this.spawnProt = 2.2; this.dmgBy.clear();
    this.spawnSeq++; this.netT = null;
    this.rig.root.visible = !this.isPlayer || this.m.thirdPerson;
    this.rig.a.dead = 0;
    if (this.brain) this.brain.reset();
    this.m.bus.emit('spawn', this);
  }

  giveWeapon(id, mag, res) {
    const def = WEAPONS[id];
    const have = this.weapons.findIndex((w) => w.id === id);
    if (have >= 0) { const w = this.weapons[have]; w.res = Math.min(def.mag * 5 + def.reserve, w.res + (res ?? def.reserve)) + Math.max(0, (mag ?? 0)); return have; }
    const slot = { id, mag: mag ?? def.mag, res: res ?? def.reserve };
    if (this.weapons.length < 2) { this.weapons.push(slot); this.cur = this.weapons.length - 1; }
    else { this.dropCurrent(); this.weapons[this.cur] = slot; }
    this.reloadT = 0; this.burstLeft = 0; this.swapT = 0.4; this.zoomLevel = 0;
    return this.cur;
  }
  dropCurrent() {
    const w = this.weapon; if (!w) return;
    if (w.id !== 'br' || w.mag + w.res > 0) this.m.addPickup({ id: w.id, x: this.x + rand(-0.4, 0.4), y: this.y, z: this.z + rand(-0.4, 0.4), t: 0, dropped: true, ammo: [w.mag, w.res] });
  }

  // ---- per-frame ----------------------------------------------------------
  update(dt) {
    const m = this.m, c = this.cmd;
    if (m.replica) return this.updateReplica(dt);
    if (this.remote) return this.updateRemote(dt);
    if (!this.alive) {
      this.deadT += dt;
      this.rig.root.visible = this.deadT < 6 && (!this.isPlayer || this.m.thirdPerson || this.deadT >= 0);
      this.physics(dt, 0, 0, true);
      this.animate(dt);
      return;
    }
    const frozen = m.state === 'countdown';
    this.tickVitals(dt);

    this.locomote(dt, frozen);

    if (!frozen) this.weaponsUpdate(dt);
    this.animate(dt);
  }

  tickVitals(dt) {
    this.spawnProt = Math.max(0, this.spawnProt - dt);
    this.lastHit += dt;
    this.lungeCd = Math.max(0, this.lungeCd - dt);
    this.gcd = Math.max(0, this.gcd - dt);
    this.bloom = Math.max(0, this.bloom - dt * 0.05);
    if (this.overT > 0) {
      this.overT -= dt;
      if (this.overT <= 0) { this.over = 0; }
    }
    const shieldCap = SHIELD_MAX + this.over;
    if (this.shield > SHIELD_MAX && this.over <= 0) this.shield = Math.max(SHIELD_MAX, this.shield - 22 * dt);
    if (this.lastHit > RECHARGE_DELAY && this.shield < shieldCap) {
      if (this.shield <= 0.01 && this.isPlayer) Sound.play('charge', { vol: 0.5 });
      this.shield = Math.min(shieldCap, this.shield + RECHARGE_RATE * dt * (this.shield < 1 ? 1.4 : 1));
      if (this.shield >= SHIELD_MAX) this.health = Math.min(HEALTH_MAX, this.health + 20 * dt);
    }

  }

  locomote(dt, frozen) {
    const m = this.m, c = this.cmd;
    // locomotion
    const crouching = c.crouch && this.grounded;
    this.crouch = damp(this.crouch, crouching ? 1 : 0, 14, dt);
    this.h = lerp(H_STAND, H_CROUCH, this.crouch);
    let spd = crouching ? CROUCH_SPEED : RUN;
    if (this.zoomLevel > 0) spd *= 0.65;
    if (this.reloadT > 0 && this.def && (this.def.id === 'sniper')) spd *= 0.85;
    let wx = frozen ? 0 : c.mx * spd, wz = frozen ? 0 : c.mz * spd;
    if (this.lunge) { wx = wz = 0; }
    if (c.jump && this.grounded && !frozen) { this.vy = JUMP; this.grounded = false; if (this.isPlayer) Sound.play('jump', { vol: 0.5 }); }
    this.physics(dt, wx, wz, false);
    this.separate();
    // embedded in geometry (knockback, spawn overlap, edge cases): pop out to the nearest walkable spot
    if (W.blocked(this.x, this.z, this.y, RAD * 0.55, this.h)) {
      this.embedT = (this.embedT || 0) + dt;
      if (this.embedT > 0.35) {
        const n = W.nav.nodes[W.nearestNode(this.x, this.y, this.z)];
        if (n) { this.x = n.x; this.y = n.y; this.z = n.z; this.vx = this.vz = this.vy = 0; this.grounded = true; }
        this.embedT = 0;
      }
    } else this.embedT = 0;
    this.lastMoveSpeed = Math.hypot(this.vx, this.vz);

    // footsteps
    if (this.grounded && this.lastMoveSpeed > 1.5 && !crouching) {
      this.stepD += this.lastMoveSpeed * dt;
      if (this.stepD > 2.2) { this.stepD = 0; m.sfx('step', this, this.isPlayer ? 0.5 : 0.7); }
    }

  }

  updateRemote(dt) {
    const m = this.m;
    if (!this.alive) {
      this.deadT += dt; this.rig.root.visible = this.deadT < 6;
      this.physics(dt, 0, 0, true); this.animate(dt); return;
    }
    this.tickVitals(dt);
    const T = this.netT;
    if (T) {
      const k = 1 - Math.exp(-18 * dt);
      this.x += (T.x - this.x) * k; this.y += (T.y - this.y) * k; this.z += (T.z - this.z) * k;
      this.yaw += angDiff(this.yaw, T.yaw) * Math.min(1, k * 1.5); this.pitch += (T.pitch - this.pitch) * k;
      this.vx = T.vx; this.vz = T.vz; this.vy = T.vy; this.grounded = T.g; this.zoomLevel = T.zl;
      this.crouch = damp(this.crouch, T.cr, 14, dt); this.h = lerp(H_STAND, H_CROUCH, this.crouch);
    }
    this.lastMoveSpeed = Math.hypot(this.vx, this.vz);
    this.rig.root.visible = true;
    if (m.state !== 'countdown') this.weaponsUpdate(dt);
    this.animate(dt);
  }

  updateReplica(dt) {
    const m = this.m, mine = this === m.player;
    if (this.alive && mine) {
      this.locomote(dt, m.state === 'countdown');
      const c = this.cmd, def = this.def;
      if (c.zoom && def && def.zoom && this.reloadT <= 0) this.zoomLevel = (this.zoomLevel + 1) % (def.zoom.length + 1);
      if ((def && !def.zoom) || this.reloadT > 0 || this.swapT > 0.1) this.zoomLevel = 0;
      this.kick = damp(this.kick, 0, 14, dt);
      this.rig.root.visible = m.thirdPerson;
      this.animate(dt); return;
    }
    const T = this.netT;
    if (T) {
      const k = 1 - Math.exp(-16 * dt);
      this.x += (T.x - this.x) * k; this.y += (T.y - this.y) * k; this.z += (T.z - this.z) * k;
      this.yaw += angDiff(this.yaw, T.yaw) * Math.min(1, k * 1.5); this.pitch += (T.pitch - this.pitch) * k;
      this.vx = T.vx; this.vz = T.vz; this.grounded = T.g;
      this.crouch = damp(this.crouch, T.cr, 14, dt); this.h = lerp(H_STAND, H_CROUCH, this.crouch);
    }
    if (!this.alive) { this.deadT += dt; this.rig.root.visible = this.deadT < 6; } else { this.deadT = 0; this.rig.root.visible = mine ? m.thirdPerson : this.first !== true; }
    this.lastMoveSpeed = Math.hypot(this.vx, this.vz);
    this.kick = damp(this.kick, 0, 14, dt);
    this.animate(dt);
  }

  physics(dt, wx, wz, dead) {
    const acc = dead ? 20 : this.grounded ? 58 : 7;
    this.vx += clamp(wx - this.vx, -acc * dt, acc * dt);
    this.vz += clamp(wz - this.vz, -acc * dt, acc * dt);
    if (this.lunge) this.lungeStep(dt);
    const h = this.h;
    const nx = this.x + this.vx * dt;
    if (!W.blocked(nx, this.z, this.y, RAD, h)) this.x = nx; else this.vx = 0;
    const nz = this.z + this.vz * dt;
    if (!W.blocked(this.x, nz, this.y, RAD, h)) this.z = nz; else this.vz = 0;
    if (this.grounded) {
      const g = W.groundAt(this.x, this.z, this.y);
      if (g >= this.y - W.STEP * 1.1) this.y = g; else this.grounded = false;
    }
    if (!this.grounded) {
      this.vy -= GRAV * dt;
      let ny = this.y + this.vy * dt;
      if (this.vy > 0) {
        const cl = W.ceilingBetween(this.x, this.z, this.y + h, ny + h);
        if (cl < Infinity) { ny = cl - h - 0.001; this.vy = 0; }
      } else {
        const g = W.groundAt(this.x, this.z, this.y);
        if (ny <= g) {
          ny = g;
          if (this.vy < -7 && !dead) { this.m.sfx('land', this, 0.8); if (this.isPlayer) this.m.bus.emit('shake', 0.12); }
          this.vy = 0; this.grounded = true;
        }
      }
      this.y = ny;
    }
    if (this.y < W.KILL_Y && this.alive && !dead && !this.m.replica) { this.health = 0; this.m.kill(this, null, { weapon: 'fall', kind: 'fall' }); }
    if (this.y < -60) { this.y = -60; this.vy = 0; }
  }

  separate() {
    for (const o of this.m.actors) {
      if (o === this || !o.alive) continue;
      const dx = this.x - o.x, dz = this.z - o.z, d2 = dx * dx + dz * dz;
      if (d2 < 0.64 && d2 > 1e-6 && Math.abs(this.y - o.y) < 1.5) {
        const d = Math.sqrt(d2), push = (0.8 - d) * 0.5;
        const nx = this.x + (dx / d) * push, nz = this.z + (dz / d) * push;
        if (!W.blocked(nx, nz, this.y, RAD, this.h)) { this.x = nx; this.z = nz; }
      }
    }
  }

  weaponsUpdate(dt) {
    const m = this.m, c = this.cmd, w = this.weapon, def = this.def;
    this.fireT -= dt; this.swapT -= dt; this.fireBuf = c.fireEdge ? 0.16 : this.fireBuf - dt;
    if (this.meleeT > 0) this.meleeT -= dt;
    if (this.throwT > 0) this.throwT -= dt;
    this.kick = damp(this.kick, 0, 14, dt);

    // pending hits (melee) and throws
    if (this.pend) { this.pend.t -= dt; if (this.pend.t <= 0) { this.resolveMelee(this.pend); this.pend = null; } }
    if (this.pendThrow) { this.pendThrow.t -= dt; if (this.pendThrow.t <= 0) { m.throwGrenade(this, this.pendThrow.kind); this.pendThrow = null; } }

    if (c.gswitch) { this.gtype = this.gtype === 'frag' ? 'plasma' : 'frag'; if (this.isPlayer) Sound.play('menuMove', { vol: 0.6 }); }
    if (c.zoom && def && def.zoom && this.reloadT <= 0) { this.zoomLevel = (this.zoomLevel + 1) % (def.zoom.length + 1); Sound.play('menuMove', { vol: this.isPlayer ? 0.5 : 0 }); }
    if (def && !def.zoom && this.zoomLevel) this.zoomLevel = 0;

    if (c.swap && this.weapons.length > 1 && this.swapT <= 0.15) {
      this.cur ^= 1; this.swapT = 0.5; this.reloadT = 0; this.burstLeft = 0; this.zoomLevel = 0;
      m.sfx('swap', this, 0.6); m.bus.emit('swap', this);
      return;
    }
    if (c.grenade && this.throwT <= 0 && this.gren[this.gtype] > 0 && !this.pendThrow && this.gcd <= 0) {
      this.throwT = 0.55; this.gcd = 0.9; this.pendThrow = { t: 0.22, kind: this.gtype }; this.gren[this.gtype]--; this.zoomLevel = 0;
      m.sfx('throw', this, 0.7);
    }
    if (c.melee && this.meleeT <= 0 && this.throwT <= 0) {
      if (def && def.melee) this.swordAttack(); else { this.meleeT = 0.5; this.pend = { t: 0.17, dmg: 55, range: 2.2, kind: 'punch' }; this.zoomLevel = 0; m.sfx('swing', this, 0.4); }
    }

    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0 && w) {
        const n = Math.min(def.mag - w.mag, w.res); w.mag += n; w.res -= n;
      }
      return;
    }
    if (!w || !def) return;
    if (c.reload && !def.melee && w.mag < def.mag && w.res > 0 && this.swapT <= 0) { this.startReload(); return; }
    if (w.mag <= 0 && w.res > 0 && this.fireT <= 0 && !def.melee && this.swapT <= 0) { this.startReload(); return; }

    if (this.burstLeft > 0 && this.fireT <= 0) { this.fireOne(def, w); return; }
    const want = def.auto ? c.fire : (c.fire && this.fireBuf > 0) || (def.burst > 1 && c.fire);
    if (want && this.fireT <= 0 && this.swapT <= 0 && this.throwT <= 0.2 && this.meleeT <= 0.3) {
      if (def.melee) { this.swordAttack(); return; }
      if (w.mag <= 0) { if (this.isPlayer && c.fireEdge) Sound.play('empty'); return; }
      this.burstLeft = def.burst;
      this.fireOne(def, w);
    }
  }

  startReload() {
    const def = this.def; if (!def || this.reloadT > 0) return;
    this.reloadT = def.reload; this.zoomLevel = 0; this.burstLeft = 0;
    this.m.sfx('reload', this, 0.6); this.m.bus.emit('reload', this);
  }

  fireOne(def, w) {
    const m = this.m;
    w.mag--; this.burstLeft--;
    this.fireT = this.burstLeft > 0 ? def.gap : Math.max(0.05, def.cycle - def.gap * (def.burst - 1));
    if (w.mag <= 0) this.burstLeft = 0;
    this.lastFireT = m.time; this.kick = 1;
    this.zoomHold = this.zoomLevel;
    m.shoot(this, def);
  }

  swordAttack() {
    const m = this.m, def = this.def;
    this.meleeT = def.cycle; this.fireT = def.cycle * 0.9; this.zoomLevel = 0;
    // lunge if an enemy sits in a tight cone within lunge range
    if (this.lungeCd <= 0) {
      let best = null, bd = def.lungeRange;
      const f = forward(this.yaw, 0, { x: 0, y: 0, z: 0 });
      for (const o of m.actors) {
        if (!o.alive || o.team === this.team) continue;
        const dx = o.x - this.x, dz = o.z - this.z, d = Math.hypot(dx, dz);
        if (d < 2.7 || d > bd) continue;
        if ((dx * f.x + dz * f.z) / d < 0.93) continue;
        if (Math.abs(o.y - this.y) > 2) continue;
        if (!W.los(this.x, this.eye, this.z, o.x, o.chest, o.z)) continue;
        best = o; bd = d;
      }
      if (best) {
        this.lunge = { t: 0.5, target: best }; this.lungeCd = 2.5; m.sfx('lunge', this, 1);
        this.pend = { t: 0.38, dmg: 999, range: 3.0, kind: 'sword', lunge: true };
        return;
      }
    }
    m.sfx('swing', this, 0.9);
    this.pend = { t: 0.16, dmg: 999, range: 2.9, kind: 'sword' };
  }

  lungeStep(dt) {
    const L = this.lunge; L.t -= dt;
    const o = L.target;
    if (!o.alive || L.t <= 0) { this.lunge = null; return; }
    const dx = o.x - this.x, dz = o.z - this.z, d = Math.hypot(dx, dz) || 1;
    const s = d > 1.6 ? 21 : 0;
    this.vx = (dx / d) * s; this.vz = (dz / d) * s;
    this.yaw = Math.atan2(-dx, -dz);
    if (o.y > this.y + 0.3 && this.grounded) { this.vy = 5; this.grounded = false; }
  }

  resolveMelee(p) {
    const m = this.m;
    const f = forward(this.yaw, 0, { x: 0, y: 0, z: 0 });
    let hit = false;
    for (const o of m.actors) {
      if (!o.alive || o.team === this.team) continue;
      const dx = o.x - this.x, dz = o.z - this.z, d = Math.hypot(dx, dz);
      if (d > p.range + 0.4 || Math.abs(o.y - this.y) > 1.6) continue;
      if (d > 0.5 && (dx * f.x + dz * f.z) / d < (p.lunge ? 0.2 : 0.35)) continue;
      // hit from behind = one-hit kill
      const of = forward(o.yaw, 0, { x: 0, y: 0, z: 0 });
      const back = d > 0.1 && (-dx / d) * of.x + (-dz / d) * of.z < -0.35;
      m.damage(o, back ? 999 : p.dmg, { attacker: this, weapon: p.kind === 'sword' ? 'sword' : 'melee', kind: p.kind, back, dir: { x: f.x, y: 0.2, z: f.z }, point: { x: o.x, y: o.chest, z: o.z } });
      o.vx += f.x * 5; o.vz += f.z * 5;
      hit = true;
    }
    m.sfx(hit ? 'melee' : 'swing', this, hit ? 1 : 0.5);
    if (hit && this.isPlayer) Sound.play('melee', { vol: 0.5 });
  }

  animate(dt) {
    const speed = Math.hypot(this.vx, this.vz), yaw = this.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const lz = speed > 0.2 ? (this.vx * fx + this.vz * fz) / speed : 1, lx = speed > 0.2 ? (this.vx * rx + this.vz * rz) / speed : 0;
    const w = this.weapon;
    animateRig(this.rig, dt, {
      speed, lx, lz, grounded: this.grounded, crouch: this.crouch, pitch: this.pitch, dead: !this.alive,
      weaponId: w ? w.id : null, firing: this.kick, melee: this.meleeT > 0 ? 1 - this.meleeT / 0.5 : 0,
      throwT: this.throwT > 0 ? 1 - this.throwT / 0.55 : 0, reloading: this.reloadT > 0,
    });
    this.rig.root.position.set(this.x, this.y, this.z);
    this.rig.root.rotation.y = yaw;
  }
}

// ---- projectile visuals/ray helpers ----------------------------------------------
function rayActor(ox, oy, oz, dx, dy, dz, a, maxT) {
  // head sphere
  const hx = a.x, hy = a.y + a.h - 0.2, hz = a.z, hr = 0.23;
  let tHead = Infinity, tBody = Infinity;
  {
    const ex = ox - hx, ey = oy - hy, ez = oz - hz;
    const b = ex * dx + ey * dy + ez * dz, c = ex * ex + ey * ey + ez * ez - hr * hr, disc = b * b - c;
    if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t > 0 && t < maxT) tHead = t; }
  }
  {
    const ex = ox - a.x, ez = oz - a.z, A = dx * dx + dz * dz;
    if (A > 1e-8) {
      const B = 2 * (ex * dx + ez * dz), C = ex * ex + ez * ez - 0.36 * 0.36, disc = B * B - 4 * A * C;
      if (disc >= 0) {
        const t = (-B - Math.sqrt(disc)) / (2 * A);
        const y = oy + dy * t;
        if (t > 0 && t < maxT && y >= a.y && y <= a.y + a.h - 0.32) tBody = t;
      }
    }
  }
  if (tHead === Infinity && tBody === Infinity) return null;
  return tHead <= tBody ? { t: tHead, head: true } : { t: tBody, head: false };
}

export class Match {
  constructor(scene, fx, cfg) {
    this.scene = scene; this.fx = fx; this.cfg = cfg; this.bus = new Bus();
    this.diff = DIFFICULTY[cfg.difficulty] || DIFFICULTY.normal;
    this.actors = []; this.projs = []; this.pickups = [];
    this.time = 0; this.state = 'countdown'; this.count = 3.99; this.limit = cfg.limit || 25; this.timeLimit = (cfg.minutes || 12) * 60; this.clock = this.timeLimit;
    this.score = { red: 0, blue: 0 }; this.thirdPerson = false; this.winner = null; this.endT = 0; this.firstBlood = false;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.lead = null; this.feed = [];
    this.pgroup = new THREE.Group(); scene.add(this.pgroup);
    this.replica = !!cfg.replica; this.hosting = false; this.ev = []; this.puid = 0; this.byId = new Map(); this.rp = new Map(); this.nStatic = 0;
    if (this.replica) {
      this.timeLimit = (cfg.minutes || 12) * 60;
      for (const r of cfg.roster) {
        const a = new Actor(this, { name: r.name, team: r.team, style: { hair: r.hair, eye: r.eye }, isPlayer: r.id === cfg.you, id: r.id, helmet: r.helmet });
        a.alive = true; a.rig.root.visible = false; a.first = true; a.weapons = [{ id: 'br', mag: 36, res: 108 }];
        this.actors.push(a); this.byId.set(a.id, a);
        if (r.id === cfg.you) this.player = a;
      }
      for (const p of W.PICKUPS) this.addPickup({ ...p });
      this.nStatic = this.pickups.length;
      return;
    }

    const pt = cfg.team || 'blue', et = pt === 'blue' ? 'red' : 'blue';
    const humans = cfg.humans || [], hb = (t) => humans.filter((h) => h.team === t).length;
    this.player = new Actor(this, { name: cfg.name || 'AOI', team: pt, style: cfg.waifu, isPlayer: true });
    this.actors.push(this.player);
    for (const h of humans) this.actors.push(new Actor(this, { name: h.name, team: h.team, style: h.waifu, remote: h.peer, helmet: h.helmet !== false }));
    let si = 0;
    const mk = (team) => { const s = BOT_STYLES[(si++ * 5 + 1) % BOT_STYLES.length]; const b = new Actor(this, { name: s.name, team, style: s }); this.actors.push(b); };
    for (let i = 0; i < Math.max(0, 3 - hb(pt)); i++) mk(pt);
    for (let i = 0; i < Math.max(0, 4 - hb(et)); i++) mk(et);
    // unique names
    const seen = new Set();
    this.actors.forEach((a) => { while (seen.has(a.name)) a.name += '2'; seen.add(a.name); });
    for (const a of this.actors) if ((!a.isPlayer || cfg.autoPlayer) && !a.remote) a.brain = new Brain(a, this, this.diff);
    this.actors.forEach((a) => this.byId.set(a.id, a));

    for (const p of W.PICKUPS) this.addPickup({ ...p });
    const used = { red: 0, blue: 0 };
    for (const a of this.actors) { a.spawn(W.SPAWNS[a.team][used[a.team]++ % 8]); }
    this.bus.emit('state', 'countdown');
  }

  sfx(name, src, vol = 1) {
    Sound.at(name, { x: src.x, y: src.y ?? 0, z: src.z }, this.listener, vol);
    if (this.hosting && name !== 'beep') this.ev.push(['s', name, +src.x.toFixed(1), +(src.y ?? 0).toFixed(1), +src.z.toFixed(1), vol]);
  }

  // ---- pickups --------------------------------------------------------------
  addPickup(p) {
    const isPower = p.id === 'overshield';
    const g = new THREE.Group();
    const tier = isPower ? 4 : WEAPONS[p.id].power;
    const col = [0xffffff, 0xffffff, 0xffb347, 0x6ab8ff, 0xb28cff][tier] || 0xffffff;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.03, 5, 20), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: col, emissiveIntensity: 2.4 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; g.add(disc);
    let obj;
    if (isPower) { obj = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: 0x220a44, emissive: 0xb28cff, emissiveIntensity: 2.6, flatShading: true })); }
    else { obj = makeWeaponMesh(p.id); obj.scale.setScalar(1.5); }
    obj.position.y = 0.95; g.add(obj);
    g.position.set(p.x, p.y, p.z);
    this.pgroup.add(g);
    const pk = { ...p, mesh: g, obj, active: true, back: 0, born: this.time, isPower, ammo: p.ammo || null, uid: p.uid ?? ++this.puid };
    this.pickups.push(pk);
    return pk;
  }

  updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (p.dropped && this.time - p.born > 40) { this.pgroup.remove(p.mesh); this.pickups.splice(i, 1); continue; }
      if (!p.active) {
        if (this.replica) continue;
        p.back -= dt;
        if (p.back <= 0 && p.t > 0) { p.active = true; p.mesh.visible = true; Sound.at('spawn', p, this.listener, 0.5); }
        continue;
      }
      p.obj.rotation.y += dt * 1.6;
      p.obj.position.y = 0.95 + Math.sin(this.time * 2 + p.x) * 0.08;
      if (p.dropped) {
        const g = W.groundAt(p.mesh.position.x, p.mesh.position.z, p.mesh.position.y + 1);
        if (Number.isFinite(g)) p.mesh.position.y = g;
        else { p.mesh.position.y -= dt * 14; if (p.mesh.position.y < -15) { this.pgroup.remove(p.mesh); this.pickups.splice(i, 1); } }
      }
    }
  }

  nearestPickup(a, r = 1.9) {
    let best = null, bd = r;
    for (const p of this.pickups) {
      if (!p.active) continue;
      const d = Math.hypot(p.mesh.position.x - a.x, p.mesh.position.z - a.z);
      if (d < bd && Math.abs(p.mesh.position.y - a.y) < 1.6) { bd = d; best = p; }
    }
    return best;
  }

  takePickup(a, p) {
    if (!p.active) return false;
    if (p.isPower) {
      a.over = 200; a.overT = 30; a.shield = SHIELD_MAX + 200; a.lastHit = 99;
      this.sfx('power', a, 0.9); this.bus.emit('announce', a.isPlayer ? 'OVERSHIELD' : `${a.name} HAS OVERSHIELD`, a.team);
    } else {
      const def = WEAPONS[p.id];
      const idx = a.weapons.findIndex((w) => w.id === p.id);
      if (idx >= 0) {
        const w = a.weapons[idx];
        const cap = def.mag + def.reserve;
        if (w.mag + w.res >= cap) return false;
        const add = p.ammo ? p.ammo[0] + p.ammo[1] : def.mag + def.reserve;
        w.res = Math.min(cap - Math.min(w.mag, def.mag), w.res + add);
      } else if (p.ammo) a.giveWeapon(p.id, p.ammo[0], p.ammo[1]);
      else a.giveWeapon(p.id);
      this.sfx('pickup', a, 0.7);
    }
    this.bus.emit('pickup', a, p);
    if (p.dropped || p.t === 0) { this.pgroup.remove(p.mesh); this.pickups.splice(this.pickups.indexOf(p), 1); }
    else { p.active = false; p.mesh.visible = false; p.back = p.t; }
    return true;
  }

  // ---- shooting ---------------------------------------------------------------
  muzzlePos(a, out) {
    if (a.isPlayer && !this.thirdPerson) {
      const f = forward(a.yaw, a.pitch, _f);
      const rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
      return out.set(a.x + f.x * 0.9 + rx * 0.18, a.eye + f.y * 0.9 - 0.14, a.z + f.z * 0.9 + rz * 0.18);
    }
    const w = a.rig.weapon;
    if (w) { w.updateWorldMatrix(true, false); return out.copy(w.userData.muzzle).applyMatrix4(w.matrixWorld); }
    return out.set(a.x, a.eye, a.z);
  }

  shoot(a, def) {
    const fx = this.fx, eye = a.eye;
    const spreadBase = def.spreadHip && a.zoomLevel === 0 ? def.spreadHip : def.spread;
    const mvBonus = clamp(a.lastMoveSpeed / RUN, 0, 1) * def.spread * 0.6;
    a.bloom = Math.min(0.04, a.bloom + (def.auto || def.burst > 1 ? def.kick * 0.25 : 0));
    let sp = spreadBase + mvBonus + a.bloom * (a.zoomLevel ? 0.3 : 1);
    if (a.brain) sp *= 1 + (1 - this.diff.acc) * 2;
    const base = forward(a.yaw, a.pitch, { x: 0, y: 0, z: 0 });
    const mp = this.muzzlePos(a, _mz);
    const mx = mp.x, my = mp.y, mz = mp.z;
    this.sfx(def.snd, a, def.snd === 'sniper' || def.snd === 'shotgun' ? 1.1 : 0.9);
    fx.flash(mx, my, mz, def.pellets ? 0.9 : def.snd === 'sniper' ? 0.8 : 0.5);
    fx.light(mx, my, mz, 0xffc070, def.pellets ? 9 : 5, 0.06, 9);
    this.bus.emit('shot', a, def);
    a.zoomHold = a.zoomLevel;

    if (def.proj === 'rocket') {
      const p = { type: 'rocket', x: mx, y: my, z: mz, vx: base.x * def.speed, vy: base.y * def.speed, vz: base.z * def.speed, owner: a, uid: ++this.puid, life: 6, mesh: makeRocketMesh(), alive: true, dmg: def.dmg, radius: def.radius };
      p.mesh.position.set(mx, my, mz); this.pgroup.add(p.mesh);
      this.projs.push(p);
      return;
    }
    const n = def.pellets || 1;
    const up = Math.abs(base.y) > 0.98 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    // perpendicular basis
    let rx = base.y * up.z - base.z * up.y, ry = base.z * up.x - base.x * up.z, rz = base.x * up.y - base.y * up.x;
    const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
    const ux = ry * base.z - rz * base.y, uy = rz * base.x - rx * base.z, uz = rx * base.y - ry * base.x;
    let anyHead = false;
    for (let i = 0; i < n; i++) {
      const ang = rand(0, 6.283), rad = sp * Math.sqrt(Math.random());
      const cx = Math.cos(ang) * rad, cy = Math.sin(ang) * rad;
      let dx = base.x + rx * cx + ux * cy, dy = base.y + ry * cx + uy * cy, dz = base.z + rz * cx + uz * cy;
      const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
      const ox = a.x, oy = eye, oz = a.z;
      let tw = W.rayWorld(ox, oy, oz, dx, dy, dz, def.range);
      let hitA = null, hh = false, tt = Math.min(tw, def.range);
      for (const o of this.actors) {
        if (o === a || !o.alive || o.team === a.team) continue;
        const r = rayActor(ox, oy, oz, dx, dy, dz, o, tt);
        if (r && r.t < tt) { tt = r.t; hitA = o; hh = r.head; }
      }
      const hx = ox + dx * tt, hy = oy + dy * tt, hz = oz + dz * tt;
      if (hitA) {
        let dmg = def.dmg * (hh ? def.head : 1);
        if (def.falloff) { const d = tt; dmg *= d <= def.falloff[0] ? 1 : clamp(1 - (d - def.falloff[0]) / (def.falloff[1] - def.falloff[0]), 0.08, 1); }
        if (a.brain) dmg *= 1;
        this.damage(hitA, dmg, { attacker: a, weapon: def.id, head: hh, kind: 'bullet', dir: { x: dx, y: dy, z: dz }, point: { x: hx, y: hy, z: hz } });
        anyHead = anyHead || hh;
      } else if (tw < def.range) {
        fx.sparks(hx - dx * 0.05, hy - dy * 0.05, hz - dz * 0.05, -dx * 0.5, 0.6, -dz * 0.5, def.pellets ? 4 : 7);
        if (Math.random() < 0.5) fx.dust(hx, hy, hz, 2);
      }
      if (i < 3 || !def.pellets) fx.tracer(mp, { x: hx, y: hy, z: hz }, def.tracer, def.snd === 'sniper' ? 0.04 : 0.018, def.snd === 'sniper' ? 0.16 : 0.07);
    }
    void anyHead;
  }

  // ---- grenades / explosions -------------------------------------------------------
  throwGrenade(a, kind) {
    const f = forward(a.yaw, a.pitch + 0.16, { x: 0, y: 0, z: 0 });
    const s = kind === 'plasma' ? 17 : 15.5;
    const p = { type: kind, x: a.x + f.x * 0.5, y: a.eye - 0.1, z: a.z + f.z * 0.5, vx: f.x * s + a.vx * 0.5, vy: f.y * s + 1.5, vz: f.z * s + a.vz * 0.5, owner: a, uid: ++this.puid, life: kind === 'plasma' ? 6 : 2.4, mesh: makeGrenadeMesh(kind), alive: true, stuck: null, beep: 0 };
    p.mesh.position.set(p.x, p.y, p.z); this.pgroup.add(p.mesh);
    this.projs.push(p);
  }

  explode(x, y, z, R, dmg, owner, weapon, direct = null) {
    this.fx.explosion(x, y, z, R);
    this.sfx('explode', { x, y, z }, 1.4);
    this.bus.emit('explosion', { x, y, z }, R);
    const pl = this.player;
    const dp = Math.hypot(pl.x - x, pl.y - y, pl.z - z);
    if (dp < R * 3) this.bus.emit('shake', clamp(1 - dp / (R * 3), 0, 1) * 0.9);
    for (const o of this.actors) {
      if (!o.alive) continue;
      const cx = o.x, cy = o.y + o.h * 0.5, cz = o.z;
      const d = Math.hypot(cx - x, cy - y, cz - z);
      if (d > R) continue;
      const clear = W.los(x, y + 0.2, z, cx, cy, cz);
      if (!clear && d > 1.2) continue;
      let k = 1 - d / R;
      let dm = dmg * (0.2 + 0.8 * k);
      if (direct === o) dm = dmg;
      if (o === owner) dm *= 0.55;
      const dx = cx - x, dz = cz - z, dl = Math.hypot(dx, cy - y, dz) || 1;
      this.damage(o, dm, { attacker: owner, weapon, kind: weapon, explosion: true, dir: { x: dx / dl, y: (cy - y) / dl, z: dz / dl }, point: { x: cx, y: cy, z: cz }, self: o === owner });
      const imp = (0.35 + k) * 11;
      o.vx += (dx / dl) * imp; o.vz += (dz / dl) * imp; o.vy = Math.max(o.vy, 3 + k * 6); o.grounded = false;
    }
  }

  updateProjectiles(dt) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      if (!p.alive) { this.pgroup.remove(p.mesh); this.projs.splice(i, 1); continue; }
      p.life -= dt;
      if (p.y < -30) { p.alive = false; continue; }
      if (p.type === 'rocket') {
        const steps = Math.ceil((Math.hypot(p.vx, p.vy, p.vz) * dt) / 0.4);
        const sdt = dt / steps;
        let boom = false, direct = null;
        for (let s = 0; s < steps && !boom; s++) {
          p.x += p.vx * sdt; p.y += p.vy * sdt; p.z += p.vz * sdt;
          if (W.pointSolid(p.x, p.y, p.z)) { boom = true; break; }
          for (const o of this.actors) {
            if (!o.alive || (o === p.owner && p.life > 5.85)) continue;
            if (o.team === p.owner.team && o !== p.owner) continue;
            if (Math.abs(p.x - o.x) < 0.55 && Math.abs(p.z - o.z) < 0.55 && p.y > o.y && p.y < o.y + o.h) { boom = true; direct = o; break; }
          }
        }
        this.fx.emit(p.x, p.y, p.z, rand(-0.4, 0.4), rand(-0.4, 0.4), rand(-0.4, 0.4), 0.45, 0.32, 0.06, 1, 0.6, 0.25, 0.9, 0);
        p.mesh.position.set(p.x, p.y, p.z); p.mesh.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
        if (boom || p.life <= 0) { p.alive = false; this.explode(p.x, p.y, p.z, p.radius, p.dmg, p.owner, 'rocket', direct); }
        continue;
      }
      // grenades
      if (p.stuck) {
        const o = p.stuck;
        p.x = o.x + p.off.x; p.y = o.y + p.off.y; p.z = o.z + p.off.z;
        if (!o.alive) p.stuck = null;
      } else if (!p.rest) {
        p.vy -= 17 * dt;
        const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
        if (p.type === 'plasma') {
          for (const o of this.actors) {
            if (!o.alive || o === p.owner && p.life > 5.8) continue;
            if (Math.hypot(nx - o.x, nz - o.z) < 0.6 && ny > o.y && ny < o.y + o.h) {
              p.stuck = o; p.off = { x: nx - o.x, y: ny - o.y, z: nz - o.z }; p.life = 1.5; p.stuckOwner = o;
              this.sfx('plasmaStick', o, 0.9); this.bus.emit('stuck', o, p);
              break;
            }
          }
        }
        if (!p.stuck) {
          if (!W.pointSolid(nx, ny, nz)) { p.x = nx; p.y = ny; p.z = nz; }
          else if (p.type === 'plasma') { p.rest = true; p.life = Math.min(p.life, 1.5); this.sfx('plasmaStick', p, 0.6); }
          else {
            const bx = W.pointSolid(nx, p.y, p.z), bz = W.pointSolid(p.x, p.y, nz), by = W.pointSolid(p.x, ny, p.z);
            if (bx || (!by && !bz)) p.vx *= -0.45; else p.vx *= 0.8;
            if (bz || (!by && !bx)) p.vz *= -0.45; else p.vz *= 0.8;
            if (by) { p.vy *= -0.4; p.vx *= 0.8; p.vz *= 0.8; if (Math.abs(p.vy) < 1.4) p.vy = 0; } else p.y = ny;
            if (!bx) p.x = nx; if (!bz) p.z = nz;
            if (Math.random() < 0.7) this.sfx('bounce', p, 0.5);
            if (!W.pointSolid(p.x, p.y - 0.15, p.z) === false && Math.hypot(p.vx, p.vz) < 0.4 && p.vy === 0) p.rest = true;
          }
        }
        p.mesh.rotation.x += dt * 9; p.mesh.rotation.z += dt * 6;
      }
      p.mesh.position.set(p.x, p.y, p.z);
      if (p.type === 'plasma') { p.mesh.rotation.y += dt * 8; this.fx.emit(p.x, p.y, p.z, 0, 0.3, 0, 0.25, 0.22, 0.04, 0.4, 0.8, 1, 0.8, 0); }
      p.beep -= dt;
      if (p.life < 0.9 && p.beep <= 0) { p.beep = 0.18; this.sfx('beep', p, 0.5); }
      if (p.life <= 0) {
        p.alive = false;
        if (p.type === 'frag') this.explode(p.x, p.y, p.z, 6, 120, p.owner, 'frag');
        else this.explode(p.x, p.y, p.z, 3.8, 85, p.owner, 'plasma', p.stuck || null);
      }
    }
  }

  // ---- damage / death / medals ----------------------------------------------------------
  damage(v, amt, info) {
    if (!v.alive || v.spawnProt > 0 || this.state === 'ended') return 0;
    const a = info.attacker;
    if (a && a !== v && a.team === v.team) return 0;
    if (a && a.brain && v.isPlayer && !info.explosion) amt *= this.diff.dmgIn;
    const wasShield = v.shield > 0;
    v.lastHit = 0;
    let rem = amt;
    if (v.shield > 0) { const ab = Math.min(v.shield, amt); v.shield -= ab; rem = amt - ab; }
    if (rem > 0) v.health -= rem;
    if (a && a !== v) v.dmgBy.set(a.id, this.time);
    v.rig.flash = 1;
    const pos = info.point || { x: v.x, y: v.chest, z: v.z };
    if (info.kind === 'bullet') {
      const c = TEAM[v.team];
      this.fx.blood(pos.x, pos.y, pos.z, v.shield > 0 ? [0.4, 0.8, 1] : [1, 0.5, 0.5]);
      void c;
    }
    const dead = v.health <= 0;
    if (wasShield && v.shield <= 0 && !dead) this.sfx('shieldBreak', v, 1);
    else if (!dead) this.sfx(v.shield > 0 ? 'shieldHit' : 'hit', v, 0.8);
    if (a && a !== v) this.bus.emit('hit', a, v, !!info.head, dead, amt);
    this.bus.emit('hurt', v, a, amt, a || pos);
    if (v.isPlayer) this.bus.emit('shake', clamp(amt / 90, 0.08, 0.6));
    if (dead) this.kill(v, a, info);
    return amt;
  }

  kill(v, a, info) {
    v.alive = false; v.deadT = 0; v.deaths++; v.streak = 0;
    v.respawnAt = this.time + (v.isPlayer ? 4 : 3);
    v.zoomLevel = 0; v.burstLeft = 0; v.lunge = null; v.pend = null; v.pendThrow = null;
    v.dropCurrent();
    if (v.weapons[1 - v.cur] && v.weapons.length > 1) { const w = v.weapons[1 - v.cur]; this.addPickup({ id: w.id, x: v.x + 0.5, y: v.y, z: v.z, t: 0, dropped: true, ammo: [w.mag, w.res] }); }
    v.weapons = [];
    const dv = info.dir || { x: 0, y: 0, z: 0 };
    v.vx = dv.x * 4; v.vz = dv.z * 4; v.vy = info.explosion ? 5 : 1.5; v.grounded = false;
    this.sfx('death', v, 0.9);
    const suicide = !a || a === v;
    const wid = info.weapon || 'melee';
    const rec = { killer: suicide ? null : a, victim: v, weapon: wid, head: !!info.head, kind: info.kind, suicide, t: this.time };
    if (suicide) { this.score[v.team] = Math.max(0, this.score[v.team] - 1); }
    else {
      a.kills++; a.streak++; this.score[a.team]++;
      v.lastKiller = a.id;
      // assists
      for (const [id, t] of v.dmgBy) { if (id === a.id || this.time - t > 6) continue; const s = this.actors.find((x) => x.id === id); if (s && s.team === a.team) s.assists++; }
      this.medals(a, v, info, wid);
    }
    this.feed.push(rec);
    if (v.isPlayer) this.lastKillRec = rec;
    this.bus.emit('kill', rec);
    this.checkLead(suicide ? null : a);
    if (this.state === 'live' && (this.score.red >= this.limit || this.score.blue >= this.limit)) this.end();
  }

  medals(a, v, info, wid) {
    const M = (name, icon) => { a.medals[name] = (a.medals[name] || 0) + 1; this.bus.emit('medal', a, name, icon); };
    if (!this.firstBlood) { this.firstBlood = true; M('FIRST BLOOD', 'star'); }
    if (this.time - a.multiT < 4.5) a.multi++; else a.multi = 1;
    a.multiT = this.time;
    const MULTI = ['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'OVERKILL', 'KILLTACULAR', 'KILLTROCITY', 'KILLIMANJARO', 'KILLTASTROPHE'];
    if (a.multi >= 2) M(MULTI[Math.min(a.multi, 8)], 'burst');
    if (info.head && info.kind === 'bullet') M('HEADSHOT', 'crosshair');
    if (info.back) M('ASSASSINATION', 'blade');
    else if (info.kind === 'punch') M('BEATDOWN', 'fist');
    if (wid === 'sword') M('SWORD KILL', 'blade');
    if (wid === 'frag' || wid === 'plasma') M('GRENADE KILL', 'grenade');
    if (wid === 'sniper') M('SNIPER KILL', 'crosshair');
    if (wid === 'rocket') M('ROCKET KILL', 'rocket');
    if (a.lastKiller === v.id) { M('REVENGE', 'skull'); a.lastKiller = -1; }
    if (a.streak === 5) M('KILLING SPREE', 'flame'); if (a.streak === 10) M('KILLING FRENZY', 'flame'); if (a.streak === 15) M('RUNNING RIOT', 'flame'); if (a.streak === 20) M('RAMPAGE', 'flame');
    if (v.streak >= 5) M('SPREE ENDED', 'skull');
  }

  checkLead(a) {
    const { red, blue } = this.score;
    const lead = red === blue ? 'tied' : red > blue ? 'red' : 'blue';
    if (lead !== this.lead && this.state === 'live') {
      const first = this.lead === null; this.lead = lead;
      if (!first) this.bus.emit('announce', lead === 'tied' ? 'TEAMS TIED' : `${TEAM[lead].name} TEAM TAKES THE LEAD`, lead === 'tied' ? null : lead);
    }
    const left = this.limit - Math.max(red, blue);
    if (this.state === 'live' && a && left <= 3 && left > 0 && !this['w' + left]) { this['w' + left] = true; this.bus.emit('announce', `${left} KILL${left > 1 ? 'S' : ''} TO WIN`, red > blue ? 'red' : 'blue'); }
  }

  // ---- flow -------------------------------------------------------------------------------
  spawnPoint(a) {
    const pts = W.SPAWNS[a.team];
    const foes = this.actors.filter((o) => o.alive && o.team !== a.team);
    const mates = this.actors.filter((o) => o.alive && o !== a);
    let best = null, bs = -1;
    const cand = pts.map((p) => {
      let md = 99; for (const f of foes) md = Math.min(md, Math.hypot(f.x - p.x, f.z - p.z) + Math.abs(f.y - p.y) * 2);
      let near = false; for (const o of mates) if (Math.hypot(o.x - p.x, o.z - p.z) < 2.5 && Math.abs(o.y - p.y) < 2) near = true;
      return { p, s: near ? -1 : md + rand(0, 9) };
    }).sort((x, y) => y.s - x.s);
    best = cand[0].p; bs = cand[0].s; void bs;
    return best;
  }

  end() {
    if (this.state === 'ended') return;
    this.state = 'ended'; this.endT = 0;
    const { red, blue } = this.score;
    this.winner = red === blue ? 'tie' : red > blue ? 'red' : 'blue';
    this.bus.emit('state', 'ended');
  }

  update(dt) {
    if (this.replica) return this.replicaUpdate(dt);
    this.time += dt;
    if (this.state === 'countdown') {
      const prev = Math.ceil(this.count);
      this.count -= dt;
      const now = Math.ceil(this.count);
      if (now !== prev && now >= 1) { Sound.play('count'); this.bus.emit('count', now); }
      if (this.count <= 0) { this.state = 'live'; Sound.play('go'); this.bus.emit('state', 'live'); this.bus.emit('count', 0); this.lead = null; }
    } else if (this.state === 'live') {
      this.clock -= dt;
      if (this.clock <= 0) { this.clock = 0; this.end(); }
    } else if (this.state === 'ended') this.endT += dt;

    const live = this.state === 'live';
    for (const a of this.actors) {
      if (a.brain && a.alive && live) a.brain.update(dt);
      else if (a.brain) { a.cmd.mx = a.cmd.mz = 0; a.cmd.fire = a.cmd.fireEdge = a.cmd.jump = a.cmd.melee = a.cmd.grenade = a.cmd.reload = a.cmd.swap = a.cmd.zoom = false; }
      if (this.state === 'countdown') { a.cmd.fire = false; }
      a.update(dt);
      if (live && a.alive) {
        const p = this.nearestPickup(a, 1.3) || (a.cmd.use ? this.nearestPickup(a, 1.9) : null);
        if (p) {
          if (p.isPower || a.weapons.some((w) => w.id === p.id)) this.takePickup(a, p);
          else if (a.cmd.use || (a.brain && a.brain.wantsPickup(p))) this.takePickup(a, p);
        }
      }
      if (!a.alive && live && this.time >= a.respawnAt) a.spawn(this.spawnPoint(a));
      a.cmd.fireEdge = false; a.cmd.jump = false; a.cmd.melee = false; a.cmd.grenade = false; a.cmd.reload = false; a.cmd.swap = false; a.cmd.use = false; a.cmd.gswitch = false; a.cmd.zoom = false;
    }
    this.updateProjectiles(dt);
    this.updatePickups(dt);
  }

  // enemy under the reticle (for red reticle + pad aim assist)
  aimTarget(a, range = 90) {
    const b = forward(a.yaw, a.pitch, { x: 0, y: 0, z: 0 });
    const tw = W.rayWorld(a.x, a.eye, a.z, b.x, b.y, b.z, range);
    let best = null, bt = Math.min(tw, range);
    for (const o of this.actors) {
      if (o === a || !o.alive || o.team === a.team) continue;
      const r = rayActor(a.x, a.eye, a.z, b.x, b.y, b.z, o, bt);
      if (r && r.t < bt) { bt = r.t; best = o; }
    }
    return best;
  }

  // closest visible enemy inside a small cone around the view direction
  magnet(a, cone = 0.07, range = 45) {
    const b = forward(a.yaw, a.pitch, { x: 0, y: 0, z: 0 });
    let best = null, bd = cone;
    for (const o of this.actors) {
      if (o === a || !o.alive || o.team === a.team) continue;
      const dx = o.x - a.x, dy = o.chest - a.eye, dz = o.z - a.z, d = Math.hypot(dx, dy, dz);
      if (d > range) continue;
      const ang = Math.acos(clamp((dx * b.x + dy * b.y + dz * b.z) / d, -1, 1));
      if (ang < bd && W.los(a.x, a.eye, a.z, o.x, o.chest, o.z)) { bd = ang; best = o; }
    }
    return best;
  }


  // ================= networking =================
  // host: mirror fx / sound / bus events so friends see and hear the same match
  enableHost() {
    this.hosting = true;
    const fx = this.fx, cp = (v) => (v && typeof v === 'object' && 'x' in v ? { x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2) } : typeof v === 'number' ? +v.toFixed(3) : v);
    fx._o ||= {};
    for (const m of ['flash', 'tracer', 'sparks', 'dust', 'blood', 'explosion', 'light']) {
      fx._o[m] ||= fx[m].bind(fx);
      fx[m] = (...a) => { fx._o[m](...a); if (this.hosting) this.ev.push(['f', m, ...a.map(cp)]); };
    }
    const oe = this.bus.emit.bind(this.bus), RELAY = new Set(['hit', 'hurt', 'kill', 'medal', 'announce', 'count', 'state', 'explosion', 'spawn', 'shot']);
    this.bus.emit = (e, ...a) => { oe(e, ...a); if (RELAY.has(e)) this.ev.push(['b', e, ...a.map((x) => this.serVal(x))]); };
  }

  serVal(x) {
    if (x instanceof Actor) return { $a: x.id };
    if (x && typeof x === 'object' && x.cycle !== undefined && x.snd) return { $w: x.id };
    if (x && typeof x === 'object' && 'victim' in x) return { ...x, killer: this.serVal(x.killer), victim: this.serVal(x.victim) };
    return x;
  }

  deser(x) {
    if (x && typeof x === 'object' && x.$a !== undefined) return this.byId.get(x.$a) || null;
    if (x && typeof x === 'object' && x.$w) return WEAPONS[x.$w];
    if (x && typeof x === 'object' && 'victim' in x) return { ...x, killer: this.deser(x.killer), victim: this.deser(x.victim) };
    return x;
  }

  convertToBot(peer) {
    const a = this.actors.find((x) => x.remote === peer); if (!a) return;
    a.remote = null; a.netT = null; a.cmd.fire = false; a.brain = new Brain(a, this, this.diff);
    this.bus.emit('announce', `${a.name} LEFT`, null);
  }

  takeEvents() {
    let e = this.ev; this.ev = [];
    // a long stall must not produce an oversized packet: keep game events, drop stale fx/sound
    if (e.length > 140) { const keep = e.filter((x) => x[0] === 'b').slice(-90), rest = e.filter((x) => x[0] !== 'b').slice(-60); e = [...keep, ...rest]; }
    return e;
  }

  snapshot() {
    const r2 = (v) => Math.round(v * 100) / 100;
    return {
      t: r2(this.time), st: this.state, cl: r2(this.clock), cn: r2(this.count), sc: [this.score.red, this.score.blue], w: this.winner,
      a: this.actors.map((a) => ({
        i: a.id, x: r2(a.x), y: r2(a.y), z: r2(a.z), yw: r2(a.yaw), pt: r2(a.pitch), vx: r2(a.vx), vz: r2(a.vz), al: a.alive ? 1 : 0, cr: r2(a.crouch), g: a.grounded ? 1 : 0,
        sh: Math.round(a.shield), hp: Math.round(a.health), ov: Math.round(a.over), cu: a.cur, w: a.weapons.map((w) => [w.id, w.mag, w.res]),
        g1: a.gren.frag, g2: a.gren.plasma, gt: a.gtype === 'frag' ? 0 : 1, k: a.kills, d: a.deaths, as: a.assists, st: a.streak,
        mt: r2(a.meleeT), tt: r2(a.throwT), rt: r2(a.reloadT), sw: r2(a.swapT), zl: a.zoomLevel, sq: a.spawnSeq, ra: r2(Math.max(0, a.respawnAt - this.time)), lm: r2(a.lastMoveSpeed), lf: r2(this.time - a.lastFireT),
      })),
      pk: this.pickups.slice(0, this.nStatic || W.PICKUPS.length).map((p) => (p.active ? 1 : 0)),
      dr: this.pickups.filter((p) => p.dropped).map((p) => ({ u: p.uid, id: p.id, x: r2(p.mesh.position.x), y: r2(p.mesh.position.y), z: r2(p.mesh.position.z), a: p.ammo })),
      pj: this.projs.filter((p) => p.alive).map((p) => [p.uid, p.type, r2(p.x), r2(p.y), r2(p.z), r2(p.vx), r2(p.vy), r2(p.vz)]),
    };
  }

  // host <- friend: their pose + held/edge input. Ignored until they have acknowledged the last spawn.
  applyInput(a, k) {
    if (!a || !a.alive || k.sq !== a.spawnSeq) return;
    a.netT = { x: k.x, y: k.y, z: k.z, yaw: k.yw, pitch: k.pt, vx: k.vx, vy: k.vy, vz: k.vz, g: !!k.g, cr: k.cr, zl: k.zl };
    const c = a.cmd, e = k.e | 0;
    c.fire = !!k.f;
    if (e & 1) c.fireEdge = true; if (e & 2) c.jump = true; if (e & 4) c.melee = true; if (e & 8) c.grenade = true;
    if (e & 16) c.reload = true; if (e & 32) c.swap = true; if (e & 64) c.use = true; if (e & 128) c.gswitch = true;
  }

  // friend <- host
  applySnapshot(s) {
    this.state = s.st; this.clock = s.cl; this.count = s.cn; this.score.red = s.sc[0]; this.score.blue = s.sc[1]; if (s.w) this.winner = s.w;
    this.hostT = s.t;
    for (const o of s.a) {
      const a = this.byId.get(o.i); if (!a) continue;
      const wasAlive = a.alive;
      a.alive = !!o.al; a.shield = o.sh; a.health = o.hp; a.over = o.ov; a.cur = o.cu; a.weapons = o.w.map(([id, mag, res]) => ({ id, mag, res }));
      a.gren.frag = o.g1; a.gren.plasma = o.g2; a.gtype = o.gt ? 'plasma' : 'frag';
      a.kills = o.k; a.deaths = o.d; a.assists = o.as; a.streak = o.st;
      a.meleeT = o.mt; a.throwT = o.tt; a.reloadT = o.rt; a.swapT = o.sw; a.respawnAt = this.time + o.ra; a.lastMoveSpeed = o.lm; a.lastFireT = this.time - o.lf;
      if (a === this.player) {
        if (o.sq !== a.spawnSeq || (!wasAlive && a.alive)) {
          a.spawnSeq = o.sq; a.x = o.x; a.y = o.y; a.z = o.z; a.yaw = o.yw; a.pitch = 0; a.vx = a.vz = a.vy = 0; a.grounded = true; a.deadT = 0; a.first = false;
        } else if (a.alive && Math.hypot(a.x - o.x, a.z - o.z) + Math.abs(a.y - o.y) * 0.5 > 4) { a.x = o.x; a.y = o.y; a.z = o.z; a.vy = 0; }
        if (!a.alive) a.netT = { x: o.x, y: o.y, z: o.z, yaw: o.yw, pitch: o.pt, vx: o.vx, vz: o.vz, g: !!o.g, cr: o.cr };
      } else {
        a.netT = { x: o.x, y: o.y, z: o.z, yaw: o.yw, pitch: o.pt, vx: o.vx, vz: o.vz, g: !!o.g, cr: o.cr };
        if (a.first || (!wasAlive && a.alive) || o.sq !== a.spawnSeq) { a.x = o.x; a.y = o.y; a.z = o.z; a.yaw = o.yw; a.first = false; a.spawnSeq = o.sq; }
      }
      if (a === this.player && a.first) { a.x = o.x; a.y = o.y; a.z = o.z; a.yaw = o.yw; a.first = false; a.spawnSeq = o.sq; }
      if (!a.alive && wasAlive) { a.deadT = 0; a.vy = 1; }
    }
    s.pk.forEach((v, i) => { const p = this.pickups[i]; if (p && p.active !== !!v) { p.active = !!v; p.mesh.visible = !!v; } });
    const have = new Set(s.dr.map((d) => d.u));
    for (const d of s.dr) if (!this.pickups.some((p) => p.uid === d.u)) this.addPickup({ id: d.id, x: d.x, y: d.y, z: d.z, t: 0, dropped: true, ammo: d.a, uid: d.u });
    for (let i = this.pickups.length - 1; i >= 0; i--) { const p = this.pickups[i]; if (p.dropped && !have.has(p.uid)) { this.pgroup.remove(p.mesh); this.pickups.splice(i, 1); } }
    const seen = new Set();
    for (const [u, type, x, y, z, vx, vy, vz] of s.pj) {
      seen.add(u);
      let r = this.rp.get(u);
      if (!r) { r = { mesh: type === 'rocket' ? makeRocketMesh() : makeGrenadeMesh(type), type, first: true }; r.mesh.position.set(x, y, z); this.pgroup.add(r.mesh); this.rp.set(u, r); }
      r.t = { x, y, z }; r.v = { x: vx, y: vy, z: vz };
    }
    for (const [u, r] of this.rp) if (!seen.has(u)) { this.pgroup.remove(r.mesh); this.rp.delete(u); }
    if (s.ev) this.applyEvents(s.ev);
  }

  applyEvents(list) {
    const pl = this.player;
    for (const e of list) {
      if (e[0] === 'f') { const f = this.fx[e[1]]; if (f) f.apply(this.fx, e.slice(2)); }
      else if (e[0] === 's') Sound.at(e[1], { x: e[2], y: e[3], z: e[4] }, this.listener, e[5]);
      else if (e[0] === 'b') {
        const name = e[1], args = e.slice(2).map((x) => this.deser(x));
        if (name === 'kill') { if (args[0].victim === pl) this.lastKillRec = args[0]; this.feed.push(args[0]); }
        else if (name === 'shot' && args[0]) args[0].kick = 1;
        else if (name === 'hurt' && args[0]) { args[0].rig.flash = 1; if (args[0] === pl) this.bus.emit('shake', clamp(args[2] / 90, 0.08, 0.6)); }
        else if (name === 'explosion') { const d = Math.hypot(pl.x - args[0].x, pl.z - args[0].z); if (d < args[1] * 3) this.bus.emit('shake', clamp(1 - d / (args[1] * 3), 0, 1) * 0.9); }
        else if (name === 'spawn') continue;
        this.bus.emit(name, ...args);
      }
    }
  }

  replicaUpdate(dt) {
    this.time += dt;
    if (this.state === 'ended') this.endT += dt;
    for (const a of this.actors) {
      a.update(dt);
      const c = a.cmd; c.fireEdge = false; c.jump = false; c.melee = false; c.grenade = false; c.reload = false; c.swap = false; c.use = false; c.gswitch = false; c.zoom = false;
    }
    const k = 1 - Math.exp(-24 * dt);
    for (const r of this.rp.values()) {
      const m = r.mesh, t = r.t; if (!t) continue;
      m.position.x += (t.x - m.position.x) * k; m.position.y += (t.y - m.position.y) * k; m.position.z += (t.z - m.position.z) * k;
      if (r.type === 'rocket') { m.lookAt(m.position.x + r.v.x, m.position.y + r.v.y, m.position.z + r.v.z); this.fx.emit(m.position.x, m.position.y, m.position.z, rand(-0.4, 0.4), rand(-0.4, 0.4), rand(-0.4, 0.4), 0.45, 0.32, 0.06, 1, 0.6, 0.25, 0.9, 0); }
      else { m.rotation.x += dt * 9; m.rotation.z += dt * 6; if (r.type === 'plasma') this.fx.emit(m.position.x, m.position.y, m.position.z, 0, 0.3, 0, 0.25, 0.22, 0.04, 0.4, 0.8, 1, 0.8, 0); }
    }
    this.updatePickups(dt);
  }

  ranking() {
    return [...this.actors].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  }

  dispose() {
    if (this.hosting && this.fx._o) { for (const m of Object.keys(this.fx._o)) this.fx[m] = this.fx._o[m]; }
    this.hosting = false;
    for (const a of this.actors) { this.scene.remove(a.rig.root); disposeRig(a.rig); }
    this.scene.remove(this.pgroup);
    this.pgroup.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  }
}
