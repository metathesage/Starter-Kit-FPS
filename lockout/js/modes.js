// Game modes: definitions + the objective layer (CTF flags, Oddball ball). Team Slayer and Rumble Pit are pure kill modes.
import * as THREE from 'three';
import * as W from './world.js';
import { TEAM } from './rig.js';

export const P_TEAMS = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
export const MODES = {
  slayer: { id: 'slayer', short: 'SLAYER', name: 'TEAM SLAYER', unit: 'KILLS', limits: [15, 25, 50], teams: true, blurb: 'Four on four. Kills score for the team. First to the limit wins.' },
  rumble: { id: 'rumble', short: 'RUMBLE', name: 'RUMBLE PIT', unit: 'KILLS', limits: [15, 25, 40], teams: false, blurb: 'Eight operators, no teams. Every gun is pointed at you. The kill leader wears a crown.' },
  hunt: { id: 'hunt', short: 'HUNT', name: 'WARLOCK HUNT', unit: 'KILLS', limits: [20, 30, 50], teams: true, hunt: true, blurb: 'Void warlocks against Spartans. Warlocks glide, blink and charge a Nova Bomb. Spartans have the guns and the numbers. Break the cast.' },
  ctf: { id: 'ctf', short: 'CTF', name: 'CAPTURE THE FLAG', unit: 'CAPTURES', limits: [3, 5, 8], teams: true, obj: true, blurb: 'Steal the enemy flag and bring it home while yours is safe. The carrier moves slower and cannot hide.' },
  oddball: { id: 'oddball', short: 'ODDBALL', name: 'ODDBALL', unit: 'SECONDS', limits: [60, 100, 150], teams: true, obj: true, blurb: 'Hold the ball to score. The carrier is armed with nothing but a fist. Protect them.' },
};

const R2 = (v) => Math.round(v * 100) / 100;
const beamMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
const glowMat = (c, i = 2.2) => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: c, emissiveIntensity: i, roughness: 0.4 });

function makeFlag(team) {
  const c = TEAM[team].glow, g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0xdfe6f2, metalness: 0.6, roughness: 0.3 }));
  pole.position.y = 1.3; g.add(pole);
  const banner = new THREE.Group(); banner.position.set(0.04, 2.15, 0); g.add(banner);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.75, 4, 1), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, side: THREE.DoubleSide, roughness: 0.6 }));
  cloth.position.x = 0.58; banner.add(cloth);
  const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), glowMat(0xffffff, 1.5)); tip.position.y = 2.68; g.add(tip);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.035, 6, 30), glowMat(c, 2.6)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 18, 12, 1, true), beamMat(c)); beam.position.y = 9; g.add(beam);
  g.userData = { banner, ring, beam, tip };
  return g;
}
function makeBall() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 1.7, roughness: 0.3 }));
  g.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.02, 5, 26), glowMat(0xffd84a, 2.6)); g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.02, 5, 26), glowMat(0xffd84a, 2.6)); ring2.rotation.y = Math.PI / 2; g.add(ring2);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 18, 12, 1, true), beamMat(0xffe27a)); beam.position.y = 9; g.add(beam);
  g.userData = { core, ring, ring2, beam };
  return g;
}

export class Objectives {
  constructor(m) {
    this.m = m; this.mode = m.mode; this.t = 0; this.acc = 0;
    const o = W.MAP.obj || {}; this.g = new THREE.Group(); m.scene.add(this.g);
    const P = (a) => ({ x: a[0], y: a[1], z: a[2] });
    if (this.mode === 'ctf') {
      this.flags = {};
      for (const team of ['red', 'blue']) {
        const home = P(o.flags[team]);
        const f = { team, home, pos: { ...home }, carrier: null, dropped: false, dropT: 0, mesh: makeFlag(team) };
        this.g.add(f.mesh); this.flags[team] = f;
      }
    } else {
      const home = P(o.ball);
      this.ball = { home, pos: { ...home }, carrier: null, idle: 0, mesh: makeBall(), atHome: true };
      this.g.add(this.ball.mesh);
    }
  }

  dispose() {
    this.m.scene.remove(this.g);
    this.g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }

  say(text, team) { this.m.bus.emit('announce', text, team); }
  who(a) { return a.isPlayer ? 'YOU' : a.name; }
  near(a, p, r = 1.6) { return a.alive && Math.hypot(a.x - p.x, a.z - p.z) < r && Math.abs(a.y - p.y) < 2.4; }
  ground(x, y, z) { const g = W.groundAt(x, z, y + 1); return Number.isFinite(g) && g > y - 7 ? g : null; }

  // ---------- host logic ----------
  update(dt, live) {
    this.t += dt;
    if (live && !this.m.replica) (this.mode === 'ctf' ? this.ctf(dt) : this.oddball(dt));
    this.sync(dt);
  }

  ctf(dt) {
    const m = this.m;
    for (const f of Object.values(this.flags)) {
      if (f.carrier) {
        if (!f.carrier.alive) this.dropFlag(f);
        else f.pos = { x: f.carrier.x, y: f.carrier.y, z: f.carrier.z };
        continue;
      }
      if (f.dropped) { f.dropT += dt; if (f.dropT > 20 || this.ground(f.pos.x, f.pos.y, f.pos.z) === null) { this.returnFlag(f, null); continue; } }
      for (const a of m.actors) {
        if (!this.near(a, f.pos)) continue;
        if (a.team !== f.team) { if (!a.carry) { this.takeFlag(f, a); break; } }
        else if (f.dropped) { this.returnFlag(f, a); break; }
      }
    }
    for (const a of m.actors) {
      if (a.carry !== 'flag' || !a.alive) continue;
      const own = this.flags[a.team];
      if (!own.carrier && !own.dropped && this.near(a, own.home, 2.0)) this.capture(a);
    }
  }

  takeFlag(f, a) {
    f.carrier = a; f.dropped = false; a.carry = 'flag';
    this.say(`${this.who(a)} ${a.isPlayer ? 'HAVE' : 'HAS'} THE ${TEAM[f.team].name} FLAG`, a.team);
    this.m.sfx('power', a, 0.9); this.m.bus.emit('obj', 'take', a);
  }
  dropFlag(f) {
    const c = f.carrier; f.carrier = null; if (!c) return;
    c.carry = null;
    const g = this.ground(c.x, c.y, c.z);
    if (g === null) { this.returnFlag(f, null); return; }
    f.dropped = true; f.dropT = 0; f.pos = { x: c.x, y: g, z: c.z };
    this.say(`${TEAM[f.team].name} FLAG DROPPED`, f.team);
  }
  returnFlag(f, a) {
    f.carrier = null; f.dropped = false; f.dropT = 0; f.pos = { ...f.home };
    this.say(`${TEAM[f.team].name} FLAG RETURNED`, f.team);
    if (a) { this.m.bus.emit('medal', a, 'FLAG RETURN', 'shield'); this.m.bus.emit('obj', 'return', a); }
  }
  capture(a) {
    const enemy = Object.values(this.flags).find((f) => f.carrier === a); if (!enemy) return;
    enemy.carrier = null; enemy.dropped = false; enemy.pos = { ...enemy.home }; a.carry = null;
    const m = this.m; m.score[a.team]++;
    this.say(`${TEAM[a.team].name} TEAM CAPTURES THE FLAG`, a.team);
    m.bus.emit('medal', a, 'FLAG CAPTURE', 'flag'); m.bus.emit('obj', 'cap', a);
    m.sfx('power', a, 1); m.checkLead(a);
    if (m.score[a.team] >= m.limit) m.end();
  }

  oddball(dt) {
    const m = this.m, b = this.ball;
    if (b.carrier) {
      const c = b.carrier;
      if (!c.alive) { this.dropBall(); return; }
      b.pos = { x: c.x, y: c.y, z: c.z };
      m.score[c.team] += dt; this.acc += dt;
      if (this.acc >= 1) { this.acc -= 1; m.checkLead(c); m.bus.emit('obj', 'ballsec', c); }
      if (m.score[c.team] >= m.limit) m.end();
      return;
    }
    b.idle += dt;
    if (!b.atHome && (b.idle > 12 || this.ground(b.pos.x, b.pos.y, b.pos.z) === null)) { b.pos = { ...b.home }; b.atHome = true; b.idle = 0; this.say('BALL RESET', null); }
    for (const a of m.actors) {
      if (!a.carry && this.near(a, b.pos, 1.5)) {
        b.carrier = a; a.carry = 'ball'; b.atHome = false; a.zoomLevel = 0;
        this.say(`${this.who(a)} ${a.isPlayer ? 'HAVE' : 'HAS'} THE BALL`, a.team); m.sfx('power', a, 0.9); m.bus.emit('obj', 'take', a);
        break;
      }
    }
  }
  dropBall() {
    const b = this.ball, c = b.carrier; b.carrier = null; b.idle = 0; if (!c) return;
    c.carry = null;
    const g = this.ground(c.x, c.y, c.z);
    if (g === null) { b.pos = { ...b.home }; b.atHome = true; this.say('BALL RESET', null); return; }
    b.pos = { x: c.x, y: g, z: c.z }; this.say('BALL DROPPED', null);
  }

  onDeath(v, a) {
    if (!v.carry) return;
    if (this.mode === 'ctf') { const f = Object.values(this.flags).find((x) => x.carrier === v); if (f) this.dropFlag(f); }
    else if (this.ball.carrier === v) this.dropBall();
    if (a && a !== v && this.m.foe(a, v)) this.m.bus.emit('medal', a, this.mode === 'ctf' ? 'CARRIER KILL' : 'BALL CARRIER KILL', 'skull');
    v.carry = null;
  }

  // ---------- visuals (host + replica) ----------
  sync(dt) {
    const t = this.t;
    if (this.mode === 'ctf') {
      for (const f of Object.values(this.flags)) {
        const c = f.carrier, u = f.mesh.userData;
        if (c) f.mesh.position.set(c.x, c.y + (c.h || 1.7) * 0.5 - 0.1, c.z); else f.mesh.position.set(f.pos.x, f.pos.y, f.pos.z);
        u.banner.rotation.y = Math.sin(t * 3 + (f.team === 'red' ? 0 : 1.7)) * 0.28; u.ring.rotation.z += dt * 1.2; u.tip.rotation.y += dt * 2;
        u.beam.visible = !c; u.ring.visible = !c;
        f.mesh.scale.setScalar(c ? 0.8 : 1);
        // home stand marker when the flag is away
        f.mesh.visible = true;
      }
    } else {
      const b = this.ball, u = b.mesh.userData, c = b.carrier;
      if (c) b.mesh.position.set(c.x, c.y + (c.h || 1.7) + 0.65 + Math.sin(t * 4) * 0.05, c.z); else b.mesh.position.set(b.pos.x, b.pos.y + 0.9 + Math.sin(t * 2.4) * 0.12, b.pos.z);
      u.ring.rotation.x += dt * 2.2; u.ring2.rotation.z += dt * 1.6; u.beam.visible = !c;
      const pulse = 1.4 + Math.sin(t * 5) * 0.4; u.core.material.emissiveIntensity = pulse;
    }
  }

  // ---------- HUD ----------
  markers() {
    const out = [];
    if (this.mode === 'ctf') {
      for (const f of Object.values(this.flags)) {
        const st = f.carrier ? 'CARRIED' : f.dropped ? `DROPPED ${Math.max(0, Math.ceil(20 - f.dropT))}` : 'HOME';
        const p = f.carrier ? { x: f.carrier.x, y: f.carrier.y + (f.carrier.h || 1.7) + 0.9, z: f.carrier.z } : { x: f.pos.x, y: f.pos.y + 3.3, z: f.pos.z };
        out.push({ key: 'flag' + f.team, ...p, html: `<i></i><span>${TEAM[f.team].name} FLAG · ${st}</span>`, cls: 'objm', team: f.team });
        if (f.carrier || f.dropped) out.push({ key: 'home' + f.team, x: f.home.x, y: f.home.y + 2.4, z: f.home.z, html: `<i></i><span>${TEAM[f.team].name} BASE</span>`, cls: 'objm base', team: f.team });
      }
    } else {
      const b = this.ball, p = b.carrier ? { x: b.carrier.x, y: b.carrier.y + (b.carrier.h || 1.7) + 1.3, z: b.carrier.z } : { x: b.pos.x, y: b.pos.y + 2.4, z: b.pos.z };
      out.push({ key: 'ball', ...p, html: `<i></i><span>${b.carrier ? 'BALL · ' + b.carrier.name : 'ODDBALL'}</span>`, cls: 'objm', team: b.carrier ? b.carrier.team : null });
    }
    return out;
  }

  status(p) {
    if (this.mode === 'ctf') {
      return ['red', 'blue'].map((t) => {
        const f = this.flags[t], st = f.carrier ? (f.carrier === p ? 'YOU' : f.carrier.name) : f.dropped ? 'DROPPED' : 'HOME';
        return `<div class="ob ${t}${f.carrier || f.dropped ? ' away' : ''}"><i></i><span>${TEAM[t].name} FLAG</span><b>${st}</b></div>`;
      }).join('');
    }
    const b = this.ball;
    return `<div class="ob ball${b.carrier ? ' away' : ''}"><i></i><span>ODDBALL</span><b>${b.carrier ? (b.carrier === p ? 'YOU' : b.carrier.name) : 'FREE'}</b></div>`;
  }

  // ---------- bot goals ----------
  goal(a) {
    const m = this.m, mates = m.actors.filter((o) => o.team === a.team && o.brain), role = Math.max(0, mates.indexOf(a)) % 2;
    if (this.mode === 'ctf') {
      const own = this.flags[a.team], foe = this.flags[a.team === 'red' ? 'blue' : 'red'];
      if (a.carry === 'flag') return { ...own.home, hard: true };
      if (foe.carrier && foe.carrier.team === a.team) { return role ? { ...foe.carrier, y: foe.carrier.y, hard: false } : { ...foe.pos, hard: true }; }   // escort or keep pushing
      if (own.carrier) return { x: own.carrier.x, y: own.carrier.y, z: own.carrier.z, hard: true };
      if (own.dropped) return { ...own.pos, hard: true };
      if (role === 0) return { ...foe.pos, hard: true };
      const n = W.nav.nodes.filter((q) => Math.hypot(q.x - own.home.x, q.z - own.home.z) < 14 && Math.abs(q.y - own.home.y) < 3);
      if (n.length) { const q = n[(Math.random() * n.length) | 0]; return { x: q.x, y: q.y, z: q.z, hard: false }; }
      return { ...own.home, hard: false };
    }
    const b = this.ball;
    if (a.carry === 'ball') {
      // stay alive: sit somewhere far from the nearest enemy
      const foes = m.actors.filter((o) => o.alive && m.foe(a, o));
      let best = null, bs = -1;
      for (let i = 0; i < 10; i++) { const q = W.nav.nodes[(Math.random() * W.nav.nodes.length) | 0]; if (Math.hypot(q.x - a.x, q.z - a.z) > 14) continue; let d = 99; for (const f of foes) d = Math.min(d, Math.hypot(q.x - f.x, q.z - f.z)); if (d > bs) { bs = d; best = q; } }
      return best ? { x: best.x, y: best.y, z: best.z, hard: true } : null;
    }
    if (!b.carrier) return { ...b.pos, hard: true };
    return { x: b.carrier.x, y: b.carrier.y, z: b.carrier.z, hard: b.carrier.team !== a.team };
  }

  // ---------- net ----------
  snapshot() {
    if (this.mode === 'ctf') return { f: ['red', 'blue'].map((t) => { const f = this.flags[t]; return [f.carrier ? f.carrier.id : -1, f.dropped ? 1 : 0, R2(f.pos.x), R2(f.pos.y), R2(f.pos.z), R2(f.dropT)]; }) };
    const b = this.ball; return { b: [b.carrier ? b.carrier.id : -1, R2(b.pos.x), R2(b.pos.y), R2(b.pos.z), b.atHome ? 1 : 0] };
  }
  apply(s) {
    const m = this.m; for (const a of m.actors) a.carry = null;
    if (s.f) {
      ['red', 'blue'].forEach((t, i) => {
        const f = this.flags[t], [cid, dr, x, y, z, dt] = s.f[i];
        f.carrier = cid >= 0 ? m.byId.get(cid) || null : null; f.dropped = !!dr; f.pos = { x, y, z }; f.dropT = dt;
        if (f.carrier) f.carrier.carry = 'flag';
      });
    } else if (s.b) {
      const b = this.ball, [cid, x, y, z, home] = s.b;
      b.carrier = cid >= 0 ? m.byId.get(cid) || null : null; b.pos = { x, y, z }; b.atHome = !!home;
      if (b.carrier) b.carrier.carry = 'ball';
    }
  }
}
