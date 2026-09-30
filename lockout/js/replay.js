// Replay layer: a 30 Hz ring buffer of every actor's pose, kill scoring, and a ghost-rig player used for the killcam and the top-kill cinematic.
import * as W from './world.js';
import { buildWaifu, animateRig, disposeRig } from './rig.js';
import { clamp, lerp, angDiff } from './util.js';

const STRIDE = 11, HZ = 30, KEEP = 7.5;
const POWER_W = new Set(['sniper', 'rocket', 'sword', 'hammer', 'gjallarhorn', 'nova', 'izanagi', 'lockpulse']);
const EXOTIC = new Set(['hawkmoon', 'lastword', 'felwinter', 'thorn', 'ace', 'chaperone', 'vex', 'outbreak', 'gjallarhorn', 'izanagi']);

export class Recorder {
  constructor(match) {
    this.m = match; this.frames = []; this.shots = []; this.booms = []; this.acc = 0; this.pending = []; this.wl = []; this.wmap = new Map();
    this.death = null;    // latest clip in which the local player was the victim (killcam source)
    this.best = null;     // highest scoring kill of the match (top kill)
    this.bestMine = null; // best kill made by the local player
  }
  widx(id) { if (!id) return -1; let i = this.wmap.get(id); if (i === undefined) { i = this.wl.length; this.wl.push(id); this.wmap.set(id, i); } return i; }
  sample(dt) {
    const m = this.m; if (m.state === 'countdown') return;
    this.acc += dt;
    if (this.acc >= 1 / HZ) {
      this.acc %= 1 / HZ;
      const A = m.actors, f = new Float32Array(A.length * STRIDE);
      for (let i = 0; i < A.length; i++) {
        const a = A[i], o = i * STRIDE, w = a.weapon;
        f[o] = a.x; f[o + 1] = a.y; f[o + 2] = a.z; f[o + 3] = a.yaw; f[o + 4] = a.pitch; f[o + 5] = a.crouch; f[o + 6] = a.alive ? 1 : 0; f[o + 7] = a.vx; f[o + 8] = a.vz; f[o + 9] = a.grounded ? 1 : 0; f[o + 10] = this.widx(w ? w.id : null);
      }
      this.frames.push({ t: m.time, f });
      while (this.frames.length && this.frames[0].t < m.time - KEEP) this.frames.shift();
      while (this.shots.length && this.shots[0].t < m.time - KEEP) this.shots.shift();
      while (this.booms.length && this.booms[0].t < m.time - KEEP) this.booms.shift();
    }
    for (let i = this.pending.length - 1; i >= 0; i--) { const p = this.pending[i]; if (m.time >= p.t1) { this.pending.splice(i, 1); this.finish(p); } }
  }
  shot(a, from, to, col, thick, len) { this.shots.push({ t: this.m.time, id: a.id, fx: from.x, fy: from.y, fz: from.z, tx: to.x, ty: to.y, tz: to.z, col, thick, len }); }
  boom(x, y, z, R) { this.booms.push({ t: this.m.time, x, y, z, R }); }

  // rate a kill: distance, skill, weapon and streak all count; the local player's kills get a bump so the top kill is usually yours
  score(rec) {
    const k = rec.killer, v = rec.victim; if (!k || rec.suicide) return 0;
    const d = Math.hypot(k.x - v.x, k.z - v.z);
    let s = 10 + Math.min(d, 90) / 4 + (rec.head ? 9 : 0) + (POWER_W.has(rec.weapon) ? 6 : 0) + (EXOTIC.has(rec.weapon) ? 5 : 0) + (k.multi >= 2 ? 11 * (k.multi - 1) : 0) + Math.min(k.streak, 10) * 1.6;
    if (rec.kind === 'melee' || rec.weapon === 'sword' || rec.weapon === 'hammer' || rec.weapon === 'dash') s += 8;
    if (rec.kind === 'explosion' || rec.kind === 'frag' || rec.kind === 'plasma') s += 4;
    if (!k.grounded) s += 5; if (!v.grounded) s += 4; if (k.shield <= 0) s += 8;
    if (v.streak >= 0 && v.kills >= 5) s += 6;
    if (v.novaT > 0) s += 14;
    if (k.isPlayer) s += 12;
    return s;
  }

  onKill(rec) {
    const m = this.m; if (!rec.killer || rec.suicide || m.time < 3) return;
    rec.sc = this.score(rec);
    const t = rec.t;
    // killcam: only the pre-death window is needed, so it is cut immediately
    if (rec.victim.isPlayer) this.death = this.cut(rec, t - 3.4, t, false);
    this.pending.push({ rec, t0: t - 4.2, t1: t + 1.5 });
  }
  finish(p) {
    const clip = this.cut(p.rec, p.t0, p.t1, true); if (!clip || clip.frames.length < 8) return;
    if (!this.best || clip.score > this.best.score) this.best = clip;
    if (p.rec.killer.isPlayer && (!this.bestMine || clip.score > this.bestMine.score)) this.bestMine = clip;
  }
  cut(rec, t0, t1, withShots) {
    const m = this.m, fr = this.frames.filter((f) => f.t >= t0 && f.t <= t1); if (fr.length < 4) return null;
    const A = m.actors, ids = A.map((a) => a.id), players = {};
    for (const a of A) players[a.id] = { name: a.name, team: a.team, model: a.style.model, look: a.style.look, hair: a.style.hair, eye: a.style.eye, helmet: a.rig.helmet, warlock: a.cls === 'warlock' };
    return {
      frames: fr, ids, players, wl: this.wl.slice(), kt: rec.t, killer: rec.killer.id, victim: rec.victim.id, weapon: rec.weapon, head: rec.head, kind: rec.kind, score: rec.sc || 0, multi: rec.killer.multi || 1,
      killerName: rec.killer.name, victimName: rec.victim.name, killerTeam: rec.killer.team, dist: Math.round(Math.hypot(rec.killer.x - rec.victim.x, rec.killer.z - rec.victim.z)), mine: rec.killer.isPlayer,
      shots: withShots ? this.shots.filter((s) => s.t >= t0 && s.t <= t1) : this.shots.filter((s) => s.t >= t0 && s.t <= t1), booms: this.booms.filter((b) => b.t >= t0 && b.t <= t1),
    };
  }
}

// plays a clip back on ghost rigs. mode 'kill' = the killer's own view, 'top' = a chase cinematic.
export class ReplayPlayer {
  constructor(scene, fx) { this.scene = scene; this.fx = fx; this.ghosts = new Map(); this.clip = null; this.active = false; }
  ghost(id, meta) {
    let g = this.ghosts.get(id); if (g) return g;
    const rig = buildWaifu({ team: meta.team, hair: meta.hair, eye: meta.eye, model: meta.model, look: meta.look, helmet: meta.helmet, warlock: meta.warlock });
    rig.root.visible = false; this.scene.add(rig.root); g = { rig, kick: 0, lastShot: -9 }; this.ghosts.set(id, g); return g;
  }
  start(clip, mode, onDone) {
    this.clip = clip; this.mode = mode; this.onDone = onDone; this.active = true;
    const kt = clip.kt, fr = clip.frames;
    this.t0 = mode === 'kill' ? Math.max(fr[0].t, kt - 3.2) : fr[0].t; this.t1 = mode === 'kill' ? kt + 0.05 : fr[fr.length - 1].t; this.pt = this.t0; this.sIdx = 0; this.bIdx = 0; this.done = 0;
    clip.shots.sort((a, b) => a.t - b.t); clip.booms.sort((a, b) => a.t - b.t);
    const ki = clip.ids.indexOf(clip.killer), vi = clip.ids.indexOf(clip.victim); this.ki = ki; this.vi = vi;
    // ghosts: killer, victim, and the two nearest bystanders at the moment of the kill
    const kf = this.at(kt), o = vi * STRIDE, near = [];
    for (let i = 0; i < clip.ids.length; i++) { if (i === ki || i === vi) continue; const b = i * STRIDE; if (kf.f[b + 6] < 0.5) continue; near.push([Math.hypot(kf.f[b] - kf.f[o], kf.f[b + 2] - kf.f[o + 2]), i]); }
    near.sort((a, b) => a[0] - b[0]); this.show = new Set([ki, vi, ...near.slice(0, 2).filter((n) => n[0] < 30).map((n) => n[1])]);
    for (const i of this.show) this.ghost(clip.ids[i], clip.players[clip.ids[i]]);
    this.w = new Map(); this.time = 0;
  }
  // interpolated state of every actor at time t
  at(t) {
    const fr = this.clip.frames; let lo = 0, hi = fr.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (fr[mid].t <= t) lo = mid; else hi = mid; }
    const a = fr[lo], b = fr[hi], k = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0, out = new Float32Array(a.f.length);
    for (let i = 0; i < a.f.length; i += STRIDE) {
      for (const j of [0, 1, 2, 4, 5, 7, 8]) out[i + j] = lerp(a.f[i + j], b.f[i + j], k);
      out[i + 3] = a.f[i + 3] + angDiff(a.f[i + 3], b.f[i + 3]) * k;
      out[i + 6] = a.f[i + 6]; out[i + 9] = a.f[i + 9]; out[i + 10] = a.f[i + 10];
    }
    return { f: out };
  }
  speedAt(t) {
    const kt = this.clip.kt;
    if (this.mode === 'kill') return t > kt - 0.55 ? 0.32 : 1;
    return t > kt - 0.7 && t < kt + 0.35 ? 0.27 : 1;
  }
  hide() { for (const g of this.ghosts.values()) g.rig.root.visible = false; }
  stop() { this.active = false; this.hide(); this.clip = null; }
  update(dt, camera) {
    if (!this.active) return false;
    const c = this.clip, sp = this.speedAt(this.pt);
    this.pt += dt * sp; this.time += dt;
    if (this.pt >= this.t1) { this.done += dt; if (this.done > (this.mode === 'kill' ? 0.5 : 0.1)) { const cb = this.onDone; this.stop(); if (cb) cb(); return false; } this.pt = this.t1; }
    const pt = this.pt, st = this.at(pt), f = st.f;
    // scripted events inside the window
    while (this.sIdx < c.shots.length && c.shots[this.sIdx].t <= pt) {
      const s = c.shots[this.sIdx++], g = this.ghosts.get(s.id);
      if (g) { g.kick = 1; g.lastShot = pt; }
      this.fx.tracer({ x: s.fx, y: s.fy, z: s.fz }, { x: s.tx, y: s.ty, z: s.tz }, s.col, s.thick, s.len); this.fx.flash(s.fx, s.fy, s.fz, 0.5, 0xffffff);
    }
    while (this.bIdx < c.booms.length && c.booms[this.bIdx].t <= pt) { const b = c.booms[this.bIdx++]; this.fx.explosion(b.x, b.y, b.z, b.R); }
    for (const i of this.show) {
      const id = c.ids[i], g = this.ghosts.get(id), o = i * STRIDE, w = c.wl[f[o + 10]] || null, spd = Math.hypot(f[o + 7], f[o + 8]), yaw = f[o + 3];
      const fx_ = -Math.sin(yaw), fz_ = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      g.kick = Math.max(0, g.kick - dt * 9);
      animateRig(g.rig, dt * sp, { speed: spd, lx: spd > 0.2 ? (f[o + 7] * rx + f[o + 8] * rz) / spd : 0, lz: spd > 0.2 ? (f[o + 7] * fx_ + f[o + 8] * fz_) / spd : 1, grounded: f[o + 9] > 0.5, crouch: f[o + 5], pitch: f[o + 4], dead: f[o + 6] < 0.5, weaponId: w, firing: g.kick, melee: 0, cast: 0, glide: false, throwT: 0, reloading: false, camo: 0, hit: 0 });
      g.rig.root.position.set(f[o], f[o + 1], f[o + 2]); g.rig.root.rotation.y = yaw;
      g.rig.root.visible = this.mode !== 'kill' || i !== this.ki;
      if (g.rig.crown) g.rig.crown.visible = false;
    }
    // camera
    const ko = this.ki * STRIDE, vo = this.vi * STRIDE, kt = c.kt;
    if (this.mode === 'kill') {
      camera.position.set(f[ko], f[ko + 1] + lerp(1.62, 1.15, f[ko + 5]), f[ko + 2]); camera.rotation.set(f[ko + 4], f[ko + 3], 0);
      this.fov = lerp(66, 46, clamp((pt - (kt - 1.1)) / 1.1, 0, 1));
    } else {
      const yaw = f[ko + 3], tt = clamp((pt - (kt - 3.4)) / 3.4, 0, 1), ang = yaw + lerp(0.5, -0.9, tt), dist = lerp(4.6, 2.9, tt);
      const cx = f[ko], cy = f[ko + 1] + 1.5, cz = f[ko + 2], bx = Math.sin(ang), bz = Math.cos(ang);
      let d = dist; const hit = W.rayWorld(cx, cy, cz, bx, 0.18, bz, d + 0.4); if (hit < Infinity) d = Math.max(0.8, hit - 0.4);
      camera.position.set(cx + bx * d, cy + 0.4 + (1 - tt) * 0.9, cz + bz * d);
      const kk = clamp((pt - (kt - 0.8)) / 0.8, 0, 1) * 0.65;
      camera.lookAt(lerp(cx, f[vo], kk), lerp(cy, f[vo + 1] + 1.1, kk), lerp(cz, f[vo + 2], kk));
      this.fov = lerp(60, 42, clamp((pt - (kt - 1.0)) / 1.0, 0, 1));
    }
    return true;
  }
  dispose() { for (const g of this.ghosts.values()) { this.scene.remove(g.rig.root); disposeRig(g.rig); } this.ghosts.clear(); this.active = false; }
}
