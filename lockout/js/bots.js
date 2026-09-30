// Bot brains: perception, nav-graph pathing, strafing, target leading, weapon choice, grenades.
import * as W from './world.js';
import { WEAPONS } from './weapons.js';
import { clamp, rand, chance, angDiff, forward, pick } from './util.js';

const RANGE = { g7scout: 110, r99: 34, volt: 38, hawkmoon: 95, lastword: 44, felwinter: 16, gjallarhorn: 52, thorn: 90, ace: 95, izanagi: 130, chaperone: 40, vex: 60, outbreak: 85, br: 85, magnum: 55, smg: 34, shotgun: 12, sniper: 120, rocket: 50, sword: 3, hammer: 3.2, carbine: 90, plasmarifle: 38, needler: 42 };

export class Brain {
  constructor(actor, match, diff) { this.a = actor; this.m = match; this.d = diff; this.reset(); }

  reset() {
    this.t = 0; this.think = 0; this.path = []; this.pi = 0; this.goal = null;
    this.target = null; this.visible = false; this.lastSeen = null; this.lastSeenAt = -99; this.react = 0;
    this.strafeDir = chance(0.5) ? 1 : -1; this.strafeT = rand(0.4, 1.2);
    this.stuckT = 0; this.chk = { x: this.a.x, z: this.a.z, t: 0 };
    this.errT = 0; this.eY = 0; this.eP = 0; this.fireOn = 0; this.fireOff = 0; this.edgeT = 0;
    this.state = 'roam'; this.retreatT = 0; this.gCool = rand(3, 8); this.repathT = 0; this.hear = null; this.hearAt = -99; this.meleeCd = 0; this.wpT = 0; this.roamLook = 0;
  }

  wantsPickup(p) {
    const a = this.a;
    if (p.isPower) return true;
    const def = WEAPONS[p.id], cur = a.def;
    if (a.weapons.some((w) => w.id === p.id)) return true;
    if (a.weapons.length < 2) return true;
    return def.power > (cur ? cur.power : 0) && def.power >= 2;
  }

  score(id, dist) {
    switch (id) {
      case 'hawkmoon': return dist > 12 ? 8.6 : 7;
      case 'lastword': return dist < 24 ? 8.4 : 3;
      case 'felwinter': return dist < 12 ? 9.6 : dist < 18 ? 3 : 0.5;
      case 'gjallarhorn': return dist > 8 && dist < 48 ? 8.8 : 2;
      case 'thorn': return dist > 8 ? 7.6 : 5.5;
      case 'ace': return dist > 12 ? 8.6 : 7;
      case 'izanagi': return dist > 30 ? 9.2 : dist > 18 ? 3 : 0.5;
      case 'chaperone': return dist < 28 ? 8.4 : 3;
      case 'vex': return dist < 40 ? 8 : 4;
      case 'outbreak': return dist > 10 ? 7.8 : 5.5;
      case 'sword': return dist < 9 ? 9 : 0;
      case 'hammer': return dist < 6 ? 9 : 0;
      case 'carbine': return dist > 25 ? 6.5 : 5;
      case 'plasmarifle': return dist < 30 ? 5.5 : 2;
      case 'needler': return dist < 30 ? 5.8 : 2;
      case 'shotgun': return dist < 10 ? 8 : dist < 16 ? 2 : 0;
      case 'sniper': return dist > 32 ? 9 : dist > 20 ? 3 : 0.5;
      case 'rocket': return dist > 8 && dist < 45 ? 7 : dist >= 45 ? 3 : 1;
      case 'smg': return dist < 22 ? 6 : dist < 32 ? 3 : 1;
      case 'br': return dist > 12 ? 6 : 4;
      case 'magnum': return 3.5;
      default: return 1;
    }
  }

  perceive() {
    const a = this.a, m = this.m, f = forward(a.yaw, 0, { x: 0, y: 0, z: 0 });
    let best = null, bd = 1e9;
    for (const o of m.actors) {
      if (!o.alive || !m.foe(a, o)) continue;
      const dx = o.x - a.x, dz = o.z - a.z, dist = Math.hypot(dx, dz);
      if (dist > 75) continue;
      if (m.time - o.lastFireT < 0.6 && dist < 38) { this.hear = { x: o.x, y: o.y, z: o.z }; this.hearAt = m.time; }
      const cos = (dx * f.x + dz * f.z) / (dist || 1);
      if (cos < 0.25 && dist > 6) continue;
      if (o.camoT > 0 && dist > 9 && o.lastMoveSpeed < 3.5) continue;   // camo hides a still target
      if (!W.los(a.x, a.eye, a.z, o.x, o.chest, o.z)) continue;
      const wd = o.novaT > 0 ? dist * 0.35 : dist;   // a warlock mid-cast is priority one
      if (wd < bd) { bd = wd; best = o; }
    }
    if (best) {
      if (this.target !== best) { this.react = this.d.react * rand(0.8, 1.3); }
      this.target = best; this.visible = true;
      this.lastSeen = { x: best.x, y: best.y, z: best.z }; this.lastSeenAt = m.time;
    } else {
      this.visible = false;
      if (m.time - this.lastSeenAt > 7) this.target = null;
    }
  }

  setGoal(x, y, z) {
    const a = this.a;
    const from = W.nearestNode(a.x, a.y, a.z), to = W.nearestNode(x, y, z);
    this.path = W.findPath(from, to); this.pi = 0; this.goal = { x, y, z };
    if (this.path.length > 1) {
      // skip the first node if we've already passed it
      const n0 = W.nav.nodes[this.path[0]], n1 = W.nav.nodes[this.path[1]];
      if ((a.x - n1.x) ** 2 + (a.z - n1.z) ** 2 < (n0.x - n1.x) ** 2 + (n0.z - n1.z) ** 2) this.pi = 1;
    }
  }

  pickRoamGoal() {
    const a = this.a, m = this.m;
    this.objGoal = false;
    const og = m.obj && m.obj.goal(a);
    if (og && (og.hard || chance(0.55))) { this.objGoal = true; return { w: 1, x: og.x, y: og.y, z: og.z }; }
    const opts = [];
    const hasPower = a.weapons.some((w) => WEAPONS[w.id].power >= 2);
    for (const p of m.pickups) {
      if (!p.active) continue;
      const need = p.isPower ? 3 : (!hasPower && WEAPONS[p.id].power >= 2 ? 5 : p.dropped ? 1.2 : a.weapons.length < 2 ? 1.6 : 0.4);
      const d = Math.hypot(p.x - a.x, p.z - a.z);
      opts.push({ w: need * (d < 40 ? 1.2 : 0.8), x: p.mesh.position.x, y: p.mesh.position.y, z: p.mesh.position.z });
    }
    // contested ground: enemy side of the map, the middle, hunt the last known foe
    const nodes = W.nav.nodes;
    for (let i = 0; i < 3; i++) { const n = pick(nodes); opts.push({ w: 1.4, x: n.x, y: n.y, z: n.z }); }
    const foe = a.team === 'red' ? 1 : -1;
    const push = nodes.filter((n) => n.x * foe > 8 && n.y >= 0);
    if (push.length) { const n = pick(push); opts.push({ w: 1.8, x: n.x, y: n.y, z: n.z }); }
    const enemies = m.actors.filter((o) => o.alive && m.foe(a, o));
    if (enemies.length && chance(0.5)) { const o = pick(enemies); opts.push({ w: 2.2, x: o.x, y: o.y, z: o.z }); }
    let tot = 0; opts.forEach((o) => (tot += o.w));
    let r = rand(0, tot);
    for (const o of opts) { r -= o.w; if (r <= 0) return o; }
    return opts[0];
  }

  update(dt) {
    const a = this.a, m = this.m, d = this.d, c = a.cmd;
    this.t += dt; this.think -= dt; this.gCool -= dt; this.meleeCd -= dt; this.repathT -= dt; this.wpT -= dt;
    c.fire = false; c.crouch = false;
    if (this.think <= 0) { this.think = 0.11 + rand(0, 0.05); this.perceive(); }
    if (this.visible) this.react -= dt;

    // ---- state ----
    const seenAgo = m.time - this.lastSeenAt;
    const prev = this.state;
    if (this.retreatT > 0) { this.retreatT -= dt; this.state = 'retreat'; }
    else if (this.target && (this.visible || seenAgo < 1.0)) this.state = 'combat';
    else if (this.target && seenAgo < 7) this.state = 'hunt';
    else this.state = 'roam';
    if (this.state === 'combat' && a.shield < 22 && a.lastHit < 2.5 && chance(dt * 1.4) && a.health < 40) { this.retreatT = rand(3, 5); this.state = 'retreat'; this.goal = null; this.path = []; }

    // ---- goals ----
    const needPath = !this.path.length || this.pi >= this.path.length;
    if (this.state === 'roam') {
      if (needPath || this.repathT <= 0 && (!this.goal || this.objGoal)) { const g = this.pickRoamGoal(); this.setGoal(g.x, g.y, g.z); this.repathT = this.objGoal ? 1.4 : 8; }
    } else if (this.state === 'hunt') {
      if (needPath || this.repathT <= 0) { const t = this.lastSeen || this.hear; if (t) this.setGoal(t.x, t.y, t.z); this.repathT = 1.2; }
    } else if (this.state === 'retreat') {
      if (needPath) {
        const foe = this.lastSeen || { x: 0, z: 0 };
        const cands = []; for (let i = 0; i < 8; i++) cands.push(pick(W.nav.nodes));
        cands.sort((p, q) => Math.hypot(q.x - foe.x, q.z - foe.z) - Math.hypot(p.x - foe.x, p.z - foe.z));
        const n = cands[0]; this.setGoal(n.x, n.y, n.z);
      }
    } else if (this.state === 'combat' && this.target) {
      const t = this.target, dist = Math.hypot(t.x - a.x, t.z - a.z);
      const def = a.def || WEAPONS.br;
      const close = a.weapon && (a.weapon.id === 'shotgun' || a.weapon.id === 'sword' || a.weapon.id === 'felwinter');
      if ((dist > (close ? 3 : RANGE[a.weapon ? a.weapon.id : 'br'] * 0.6) || !this.visible) && this.repathT <= 0) { this.setGoal(t.x, t.y, t.z); this.repathT = 0.7; }
      void def;
    }

    // ---- weapon choice ----
    if (this.target && this.wpT <= 0 && a.weapons.length > 1 && a.swapT <= 0 && a.reloadT <= 0) {
      const dist = Math.hypot(this.target.x - a.x, this.target.z - a.z);
      const cur = this.score(a.weapon.id, dist), oth = this.score(a.weapons[1 - a.cur].id, dist);
      const otherHas = a.weapons[1 - a.cur].mag + a.weapons[1 - a.cur].res > 0;
      if (oth > cur + 1.5 && otherHas) { c.swap = true; this.wpT = 1.5; }
      else this.wpT = 0.6;
    }
    if (a.weapon && a.weapon.mag <= 0 && a.weapon.res <= 0 && a.weapons.length > 1 && a.swapT <= 0) c.swap = true;

    // ---- aim ----
    let wantYaw = a.yaw, wantPitch = 0, aiming = false;
    const moveTarget = this.nextPathPoint(dt);
    if (this.state === 'combat' && this.target) {
      const t = this.target;
      const wid = a.weapon ? a.weapon.id : 'br';
      let ax = t.x, ay = t.chest, az = t.z;
      const dist = Math.hypot(t.x - a.x, t.z - a.z);
      if (wid === 'rocket' || wid === 'gjallarhorn') { ay = t.y + 0.2; const tt = dist / 34; ax += t.vx * tt; az += t.vz * tt; }
      else if (wid === 'sniper' || wid === 'br') { const tt = dist / 400; ax += t.vx * tt; az += t.vz * tt; }
      if (wid !== 'rocket' && wid !== 'gjallarhorn' && chance(0.002 * d.acc / (this.d.aimErr * 20 + 0.2))) ay = t.y + t.h - 0.2;
      if (this.visible) {
        wantYaw = Math.atan2(-(ax - a.x), -(az - a.z));
        wantPitch = Math.atan2(ay - a.eye, Math.max(0.1, Math.hypot(ax - a.x, az - a.z)));
        aiming = true;
      } else if (moveTarget) { wantYaw = Math.atan2(-(moveTarget.x - a.x), -(moveTarget.z - a.z)); }
      this.errT -= dt;
      if (this.errT <= 0) { this.errT = rand(0.2, 0.5); this.eY = rand(-1, 1) * d.aimErr * (1 + a.lastMoveSpeed * 0.06); this.eP = rand(-1, 1) * d.aimErr * 0.7; }
      wantYaw += this.eY; wantPitch += this.eP;
    } else {
      // look where we are heading, glance toward gunfire
      if (this.hear && m.time - this.hearAt < 1.2 && this.state !== 'retreat') wantYaw = Math.atan2(-(this.hear.x - a.x), -(this.hear.z - a.z));
      else if (moveTarget) wantYaw = Math.atan2(-(moveTarget.x - a.x), -(moveTarget.z - a.z));
      wantPitch = 0;
    }
    if (!a.lunge) {
      const dy = angDiff(a.yaw, wantYaw), turn = d.turn * (aiming ? 1 : 0.6);
      a.yaw += clamp(dy * 9 * dt, -turn * dt, turn * dt);
      a.pitch += clamp((wantPitch - a.pitch) * 9 * dt, -turn * dt, turn * dt);
      a.pitch = clamp(a.pitch, -1.2, 1.2);
    }

    // ---- fire ----
    if (aiming && this.react <= 0 && a.weapon) {
      const t = this.target, wid = a.weapon.id, def = a.def;
      const dist = Math.hypot(t.x - a.x, t.z - a.z);
      const errY = Math.abs(angDiff(a.yaw, wantYaw)), errP = Math.abs(wantPitch - a.pitch);
      const tol = 0.05 + 1.2 / (dist + 8) * 0.25;
      if (errY < tol && errP < tol * 1.3 && dist < (RANGE[wid] || 40)) {
        // trigger discipline
        if (this.fireOff > 0) this.fireOff -= dt;
        else {
          c.fire = true;
          this.fireOn += dt;
          if (this.fireOn > rand(0.9, 2.2)) { this.fireOn = 0; this.fireOff = rand(0.15, 0.55) / d.acc; }
        }
        this.edgeT -= dt;
        if (c.fire && this.edgeT <= 0 && !def.auto) { c.fireEdge = true; this.edgeT = def.cycle * rand(1.0, 1.35) / d.acc; }
        if ((wid === 'sniper' || wid === 'izanagi') && a.zoomLevel === 0 && dist > 25) c.zoom = true;
        if (wid !== 'sniper' && wid !== 'izanagi' && a.zoomLevel > 0) c.zoom = true;
      }
      // melee at close range
      if (dist < 2.1 && this.meleeCd <= 0 && (wid !== 'shotgun' || chance(0.1)) && errY < 0.4) { c.melee = true; this.meleeCd = 1.1; }
      // grenades
      if (this.gCool <= 0 && dist > 7 && dist < 26 && chance(dt * d.grenade * 0.35) && a.gren.frag + a.gren.plasma > 0 && this.visible) {
        const kind = dist < 15 && a.gren.plasma > 0 ? 'plasma' : a.gren.frag > 0 ? 'frag' : 'plasma';
        if (a.gtype !== kind) c.gswitch = true; else { c.grenade = true; this.gCool = rand(6, 11); a.pitch = clamp(wantPitch + dist * 0.008, -1, 1); }
      }
    } else if (a.zoomLevel > 0) c.zoom = true;
    if (!aiming && this.state !== 'combat' && a.weapon && a.weapon.mag < a.def.mag * 0.5 && a.weapon.res > 0 && !a.def.melee) c.reload = true;

    // ---- movement ----
    let mx = 0, mz = 0;
    const dirTo = (p) => { const dx = p.x - a.x, dz = p.z - a.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
    if (this.state === 'combat' && this.target && this.visible) {
      const t = this.target, dist = Math.hypot(t.x - a.x, t.z - a.z);
      const wid = a.weapon ? a.weapon.id : 'br';
      const [tx, tz] = dirTo(t);
      const closeWeapon = wid === 'shotgun' || wid === 'sword' || wid === 'felwinter';
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = rand(0.5, 1.5) / d.strafe; this.strafeDir = chance(0.5) ? 1 : -1; if (chance(0.25 * d.strafe) && a.grounded && dist < 22) this.hopNext = true; }
      let fwd = 0;
      if (closeWeapon) fwd = dist > 2.5 ? 1 : 0;
      else if (wid === 'sniper') fwd = dist < 25 ? -1 : 0;
      else fwd = dist < 7 ? -0.8 : dist > 26 ? 0.8 : 0;
      const sx = -tz * this.strafeDir, sz = tx * this.strafeDir;
      mx = tx * fwd + sx * 0.9 * d.strafe * (wid === 'sniper' ? 0.2 : 1); mz = tz * fwd + sz * 0.9 * d.strafe * (wid === 'sniper' ? 0.2 : 1);
      if (this.hopNext) { this.hopNext = false; if (this.safeHop(mx, mz)) c.jump = true; }
      // don't step off ledges or into walls
      const l = Math.hypot(mx, mz) || 1;
      const px = a.x + (mx / l) * 1.3, pz = a.z + (mz / l) * 1.3;
      if (W.blocked(px, pz, a.y, 0.45, 1.7) || W.groundAt(px, pz, a.y) < a.y - 0.7) { this.strafeDir *= -1; mx = -sx * 0.8; mz = -sz * 0.8; this.strafeT = rand(0.3, 0.8); }
      if (dist > 30 && moveTarget) { const [px2, pz2] = dirTo(moveTarget); mx = px2; mz = pz2; }
    } else if (moveTarget) {
      const [dx, dz] = dirTo(moveTarget); mx = dx; mz = dz;
      // sprint-like urgency when far from goal; small chance to jump obstacles when blocked
    }
    const l = Math.hypot(mx, mz);
    if (l > 1) { mx /= l; mz /= l; }
    const speedScale = this.state === 'combat' ? 1 : 0.95;
    c.mx = mx * speedScale; c.mz = mz * speedScale;
    this.classAI(dt, moveTarget);

    // ---- stuck handling ----
    this.chk.t += dt;
    if (this.chk.t > 1.1) {
      const moved = Math.hypot(a.x - this.chk.x, a.z - this.chk.z);
      if (moved < 0.5 && (Math.abs(mx) + Math.abs(mz)) > 0.3) {
        this.stuckT++;
        if (a.grounded && this.safeHop(mx, mz)) c.jump = true;
        if (this.stuckT >= 2) { this.path = []; this.goal = null; this.stuckT = 0; this.strafeDir *= -1; }
      } else this.stuckT = 0;
      this.chk.x = a.x; this.chk.z = a.z; this.chk.t = 0;
    }
  }

  // warlock kit + spartan answers to it
  classAI(dt, moveTarget) {
    const a = this.a, m = this.m, c = a.cmd, t = this.target;
    this.bCool = (this.bCool || 0) - dt;
    if (m.hunt) {
      // nova inbound: everyone runs from the blast, sideways-and-away, and hops
      for (const p of m.projs) {
        if (p.type !== 'nova' || !m.foe(p.owner, a)) continue;
        const dx = a.x - p.x, dz = a.z - p.z, d = Math.hypot(dx, dz);
        if (d < 17) { const l = d || 1; c.mx = dx / l; c.mz = dz / l; if (a.grounded && chance(dt * 1.2)) c.jump = true; break; }
      }
    }
    if (a.fac === 'spartan') {
      c.novaHeld = false;
      const dist = t ? Math.hypot(t.x - a.x, t.z - a.z) : 99;
      if (a.dashCh > 0 && this.bCool <= 0 && !a.dashing) {
        if (t && a.lastHit < 0.4 && chance(dt * 3)) { const dx = t.x - a.x, dz = t.z - a.z, l = Math.hypot(dx, dz) || 1, sd = chance(0.5) ? 1 : -1; c.mx = (-dz / l) * sd; c.mz = (dx / l) * sd; c.blink = true; this.bCool = rand(1.5, 3); }
        else if (t && this.visible && dist > 5 && dist < 13 && a.dashCh >= 1 && chance(dt * 0.45)) { c.mx = (t.x - a.x) / dist; c.mz = (t.z - a.z) / dist; c.blink = true; this.bCool = rand(2.5, 4.5); }
      }
      if (a.aa === 'lock') {
        if (a.lockT > 0) c.novaHeld = a.lockT > 1.0;
        else if (a.aaCd <= 0 && a.shield < 45 && a.lastHit < 0.35 && chance(dt * 3)) { c.nova = true; c.novaHeld = true; }
      } else if (a.aa === 'jet') {
        if (moveTarget && moveTarget.y > a.y + 1.6 && a.fuel > 0.1 && Math.hypot(moveTarget.x - a.x, moveTarget.z - a.z) < 9) c.novaHeld = true;
        else if (t && a.lastHit < 0.5 && a.fuel > 0.5 && chance(dt * 1.5)) c.novaHeld = true;
      } else if (a.aa === 'drop') {
        if (a.aaCd <= 0 && t && this.visible && (a.shield < 55 || dist < 14) && chance(dt * 1.2)) c.nova = true;
      }
      return;
    }
    if (a.cls !== 'warlock') return;
    if (a.grounded) this.glideOn = chance(0.65);
    else if (this.glideOn && a.vy < 0.4) c.jump = true;
    // big one: charged, target in the open at a good range
    if (a.sup >= 1 && a.novaT <= 0 && t && this.visible && this.react <= 0) {
      const dist = Math.hypot(t.x - a.x, t.z - a.z);
      if (dist > 7 && dist < 34 && chance(dt * 1.6)) c.nova = true;
    }
    if (a.novaT > 0) return;
    if (this.bCool > 0 || a.blinkCh <= 0) return;
    // dodge: just took fire, blink sideways off the line
    if (t && a.lastHit < 0.45 && chance(dt * 4)) {
      const dx = t.x - a.x, dz = t.z - a.z, l = Math.hypot(dx, dz) || 1, sd = chance(0.5) ? 1 : -1;
      c.mx = (-dz / l) * sd; c.mz = (dx / l) * sd; c.blink = true; this.bCool = rand(1.2, 2.4); return;
    }
    // close the gap: far from a known enemy, blink along the path (keeps one charge in reserve)
    if (a.blinkCh >= 2 && moveTarget && (this.state === 'hunt' || (this.state === 'combat' && t && Math.hypot(t.x - a.x, t.z - a.z) > 30)) && chance(dt * 0.6)) {
      const dx = moveTarget.x - a.x, dz = moveTarget.z - a.z, l = Math.hypot(dx, dz) || 1;
      if (l > 4) { c.mx = dx / l; c.mz = dz / l; c.blink = true; this.bCool = rand(2, 3.5); }
    }
  }

  // is there floor under the spot we would land on if we hop this way?
  safeHop(mx, mz) {
    const a = this.a, l = Math.hypot(mx, mz) || 1;
    for (const d of [1.5, 3]) { const g = W.groundAt(a.x + (mx / l) * d, a.z + (mz / l) * d, a.y + 0.6); if (!Number.isFinite(g) || g < a.y - 1.2) return false; }
    return true;
  }

  nextPathPoint() {
    const a = this.a;
    while (this.pi < this.path.length) {
      const n = W.nav.nodes[this.path[this.pi]];
      const d = Math.hypot(n.x - a.x, n.z - a.z);
      if (d < 0.95 && Math.abs(n.y - a.y) < 1.4) { this.pi++; continue; }
      // cut corners when the next-next node is clearly reachable in a straight line
      return n;
    }
    return null;
  }
}
