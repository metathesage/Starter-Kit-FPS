// Procedural Web Audio: every sound is synthesized, nothing to download.
import { rand } from './util.js';

let ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null, comp = null;
let musicTimer = null, musicMode = 'off', beat = 0;
const vol = { master: 0.8, sfx: 1, music: 0.5 };

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = vol.master;
  sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx;
  musBus = ctx.createGain(); musBus.gain.value = vol.music * 0.35;
  sfxBus.connect(comp); musBus.connect(comp); comp.connect(master); master.connect(ctx.destination);
  const len = ctx.sampleRate * 1.5;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

function out(pan, gain) {
  const g = ctx.createGain(); g.gain.value = gain;
  let last = g;
  if (ctx.createStereoPanner && pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); last = p; }
  last.connect(sfxBus);
  return g;
}

function noise(o, { dur = 0.2, f0 = 2000, f1 = 400, q = 1, gain = 0.5, type = 'lowpass', at = 0, atk = 0.002 }) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(o);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}

function tone(o, { type = 'sine', f0 = 440, f1 = f0, dur = 0.2, gain = 0.3, at = 0, atk = 0.005, det = 0 }) {
  const t = ctx.currentTime + at;
  const os = ctx.createOscillator(); os.type = type; os.detune.value = det;
  os.frequency.setValueAtTime(f0, t); os.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  os.connect(g); g.connect(o);
  os.start(t); os.stop(t + dur + 0.05);
}

const S = {
  br(o) { noise(o, { dur: 0.16, f0: 5200, f1: 500, gain: 0.7, q: 0.8 }); tone(o, { type: 'square', f0: 260, f1: 60, dur: 0.1, gain: 0.25 }); },
  smg(o) { noise(o, { dur: 0.09, f0: 6000, f1: 900, gain: 0.5 }); tone(o, { type: 'square', f0: 300, f1: 90, dur: 0.05, gain: 0.15 }); },
  magnum(o) { noise(o, { dur: 0.28, f0: 4200, f1: 300, gain: 0.9, q: 0.7 }); tone(o, { type: 'sawtooth', f0: 200, f1: 40, dur: 0.22, gain: 0.4 }); },
  shotgun(o) { noise(o, { dur: 0.5, f0: 3500, f1: 150, gain: 1, q: 0.6 }); tone(o, { type: 'sawtooth', f0: 110, f1: 28, dur: 0.4, gain: 0.5 }); noise(o, { dur: 0.15, f0: 1500, f1: 800, gain: 0.3, at: 0.45, type: 'bandpass', q: 3 }); },
  sniper(o) { noise(o, { dur: 0.9, f0: 6500, f1: 120, gain: 1, q: 0.5 }); tone(o, { type: 'sawtooth', f0: 160, f1: 25, dur: 0.6, gain: 0.55 }); tone(o, { type: 'sine', f0: 2400, f1: 500, dur: 0.15, gain: 0.15 }); },
  carbine(o) { noise(o, { dur: 0.14, f0: 4800, f1: 700, gain: 0.55, q: 0.9 }); tone(o, { type: 'sawtooth', f0: 700, f1: 200, dur: 0.12, gain: 0.18 }); },
  plasmar(o) { tone(o, { type: 'sawtooth', f0: 1400, f1: 500, dur: 0.09, gain: 0.16, det: 12 }); noise(o, { dur: 0.06, f0: 6000, f1: 2000, gain: 0.15, type: 'bandpass', q: 3 }); },
  needler(o) { tone(o, { type: 'triangle', f0: 1100, f1: 1700, dur: 0.06, gain: 0.14 }); noise(o, { dur: 0.05, f0: 5000, f1: 3000, gain: 0.1, type: 'highpass' }); },
  thump(o) { tone(o, { type: 'sine', f0: 120, f1: 30, dur: 0.5, gain: 0.7 }); noise(o, { dur: 0.35, f0: 900, f1: 60, gain: 0.5 }); },
  rocket(o) { noise(o, { dur: 0.7, f0: 900, f1: 200, gain: 0.7, type: 'bandpass', q: 2 }); tone(o, { type: 'sawtooth', f0: 90, f1: 40, dur: 0.5, gain: 0.35 }); },
  explode(o) { noise(o, { dur: 1.3, f0: 2200, f1: 60, gain: 1, q: 0.4 }); tone(o, { type: 'sine', f0: 90, f1: 22, dur: 1.0, gain: 0.9 }); noise(o, { dur: 0.4, f0: 8000, f1: 1000, gain: 0.3, type: 'highpass' }); },
  blink(o) { noise(o, { dur: 0.22, f0: 900, f1: 7000, gain: 0.35, type: 'bandpass', q: 1.4 }); tone(o, { type: 'sine', f0: 1800, f1: 240, dur: 0.22, gain: 0.22 }); tone(o, { type: 'triangle', f0: 3200, f1: 900, dur: 0.14, gain: 0.08, at: 0.02 }); },
  novaCharge(o) { tone(o, { type: 'sawtooth', f0: 70, f1: 340, dur: 1.1, gain: 0.32, atk: 0.6, det: 9 }); tone(o, { type: 'sine', f0: 320, f1: 1900, dur: 1.1, gain: 0.16, atk: 0.7 }); noise(o, { dur: 1.1, f0: 300, f1: 6000, gain: 0.25, type: 'bandpass', q: 1.2, atk: 0.8 }); },
  novaLaunch(o) { tone(o, { type: 'sawtooth', f0: 520, f1: 60, dur: 0.6, gain: 0.4 }); noise(o, { dur: 0.5, f0: 6000, f1: 200, gain: 0.5, q: 0.6 }); },
  novaBoom(o) { tone(o, { type: 'sine', f0: 70, f1: 18, dur: 1.8, gain: 1 }); tone(o, { type: 'sawtooth', f0: 220, f1: 30, dur: 1.4, gain: 0.35, det: 14 }); noise(o, { dur: 1.7, f0: 3200, f1: 50, gain: 1, q: 0.4 }); tone(o, { type: 'sine', f0: 1200, f1: 2600, dur: 0.9, gain: 0.12, at: 0.05 }); },
  bell(o) { tone(o, { type: 'sine', f0: 392, f1: 388, dur: 5, gain: 0.34, atk: 0.004 }); tone(o, { type: 'sine', f0: 588, f1: 584, dur: 4, gain: 0.16 }); tone(o, { type: 'sine', f0: 1046, f1: 1040, dur: 3, gain: 0.1 }); tone(o, { type: 'triangle', f0: 196, f1: 194, dur: 5, gain: 0.18 }); noise(o, { dur: 0.08, f0: 3000, f1: 900, gain: 0.2 }); },
  splash(o) { noise(o, { dur: 0.35, f0: 2600, f1: 500, gain: 0.3, type: 'bandpass', q: 1.5 }); tone(o, { type: 'sine', f0: 700, f1: 200, dur: 0.18, gain: 0.12 }); },
  rake(o) { noise(o, { dur: 0.7, f0: 3200, f1: 1800, gain: 0.16, type: 'highpass', atk: 0.12 }); },
  vault(o) { noise(o, { dur: 2.4, f0: 500, f1: 80, gain: 0.5, q: 0.5, atk: 0.4 }); tone(o, { type: 'sawtooth', f0: 52, f1: 34, dur: 2.4, gain: 0.34, atk: 0.3 }); tone(o, { type: 'sine', f0: 900, f1: 300, dur: 1.2, gain: 0.05, at: 0.2 }); },
  discover(o) { [523, 659, 784, 1046].forEach((f, i) => tone(o, { type: 'triangle', f0: f, dur: 0.6, gain: 0.11, at: i * 0.07 })); tone(o, { type: 'sine', f0: 1568, dur: 1.2, gain: 0.05, at: 0.3 }); },
  koto(o, pitch = 1) { const f = 293.7 * pitch; tone(o, { type: 'triangle', f0: f, f1: f * 0.995, dur: 1.8, gain: 0.16, atk: 0.003 }); tone(o, { type: 'sine', f0: f * 2, dur: 1, gain: 0.05, atk: 0.003 }); noise(o, { dur: 0.03, f0: 4000, f1: 1500, gain: 0.05 }); },
  purr(o) { noise(o, { dur: 1.8, f0: 200, f1: 110, gain: 0.2, type: 'lowpass', q: 0.7, atk: 0.35 }); tone(o, { type: 'sine', f0: 36, f1: 32, dur: 1.8, gain: 0.14, atk: 0.35 }); },
  cricket(o) { [0, 0.09, 0.18].forEach((d) => tone(o, { type: 'triangle', f0: 4300, f1: 4100, dur: 0.05, gain: 0.02, at: d })); },
  throw(o) { noise(o, { dur: 0.18, f0: 600, f1: 2500, gain: 0.25, type: 'bandpass', q: 1.5 }); },
  plasmaStick(o) { tone(o, { type: 'sine', f0: 1200, f1: 2600, dur: 0.12, gain: 0.25 }); },
  bounce(o) { tone(o, { type: 'triangle', f0: 320, f1: 140, dur: 0.09, gain: 0.25 }); noise(o, { dur: 0.05, f0: 3000, f1: 1000, gain: 0.15 }); },
  beep(o) { tone(o, { type: 'square', f0: 1500, dur: 0.06, gain: 0.12 }); },
  swing(o) { tone(o, { type: 'sawtooth', f0: 420, f1: 140, dur: 0.22, gain: 0.25, det: 8 }); tone(o, { type: 'sawtooth', f0: 430, f1: 150, dur: 0.22, gain: 0.25, det: -8 }); },
  lunge(o) { tone(o, { type: 'sawtooth', f0: 200, f1: 900, dur: 0.3, gain: 0.3 }); noise(o, { dur: 0.3, f0: 500, f1: 4000, gain: 0.3, type: 'bandpass', q: 2 }); },
  melee(o) { noise(o, { dur: 0.14, f0: 900, f1: 120, gain: 0.8 }); tone(o, { type: 'sine', f0: 140, f1: 45, dur: 0.14, gain: 0.5 }); },
  hit(o) { tone(o, { type: 'square', f0: 1900, f1: 1300, dur: 0.05, gain: 0.14 }); },
  headshot(o) { tone(o, { type: 'square', f0: 2600, f1: 1800, dur: 0.07, gain: 0.16 }); tone(o, { type: 'sine', f0: 3400, f1: 2400, dur: 0.12, gain: 0.12, at: 0.03 }); },
  shieldHit(o) { noise(o, { dur: 0.12, f0: 3000, f1: 600, gain: 0.35, type: 'bandpass', q: 4 }); tone(o, { type: 'sine', f0: 900, f1: 500, dur: 0.1, gain: 0.15 }); },
  shieldBreak(o) { noise(o, { dur: 0.6, f0: 6000, f1: 300, gain: 0.7, type: 'bandpass', q: 1 }); tone(o, { type: 'sawtooth', f0: 900, f1: 90, dur: 0.5, gain: 0.35 }); },
  charge(o) { tone(o, { type: 'sine', f0: 300, f1: 900, dur: 1.4, gain: 0.12, atk: 0.5 }); tone(o, { type: 'triangle', f0: 600, f1: 1800, dur: 1.4, gain: 0.05, atk: 0.5 }); },
  alarm(o) { tone(o, { type: 'square', f0: 880, dur: 0.09, gain: 0.13 }); tone(o, { type: 'square', f0: 880, dur: 0.09, gain: 0.13, at: 0.16 }); },
  pickup(o) { tone(o, { type: 'sine', f0: 500, f1: 1000, dur: 0.18, gain: 0.2 }); tone(o, { type: 'sine', f0: 750, f1: 1500, dur: 0.22, gain: 0.15, at: 0.06 }); },
  power(o) { [392, 523, 659, 784].forEach((f, i) => tone(o, { type: 'triangle', f0: f, dur: 0.5, gain: 0.2, at: i * 0.08 })); },
  reload(o) { noise(o, { dur: 0.06, f0: 2500, f1: 800, gain: 0.35, type: 'bandpass', q: 3 }); noise(o, { dur: 0.08, f0: 2000, f1: 600, gain: 0.4, type: 'bandpass', q: 3, at: 0.5 }); },
  swap(o) { noise(o, { dur: 0.1, f0: 2000, f1: 700, gain: 0.3, type: 'bandpass', q: 2 }); },
  jump(o) { noise(o, { dur: 0.1, f0: 800, f1: 300, gain: 0.15 }); },
  land(o) { noise(o, { dur: 0.14, f0: 500, f1: 90, gain: 0.35 }); },
  step(o) { noise(o, { dur: 0.05, f0: 900, f1: 250, gain: 0.1 }); },
  empty(o) { tone(o, { type: 'square', f0: 220, dur: 0.04, gain: 0.1 }); },
  menuMove(o) { tone(o, { type: 'sine', f0: 900, f1: 1100, dur: 0.06, gain: 0.12 }); },
  menuOk(o) { tone(o, { type: 'triangle', f0: 600, f1: 1200, dur: 0.14, gain: 0.2 }); tone(o, { type: 'sine', f0: 1200, f1: 1800, dur: 0.2, gain: 0.1, at: 0.05 }); },
  menuBack(o) { tone(o, { type: 'triangle', f0: 700, f1: 350, dur: 0.14, gain: 0.18 }); },
  medal(o) { [659, 880, 1318].forEach((f, i) => tone(o, { type: 'triangle', f0: f, dur: 0.35, gain: 0.16, at: i * 0.07 })); },
  count(o) { tone(o, { type: 'sine', f0: 660, dur: 0.25, gain: 0.25 }); },
  go(o) { tone(o, { type: 'sine', f0: 990, dur: 0.6, gain: 0.3 }); tone(o, { type: 'triangle', f0: 495, dur: 0.6, gain: 0.2 }); },
  death(o) { tone(o, { type: 'sawtooth', f0: 300, f1: 40, dur: 0.7, gain: 0.3 }); noise(o, { dur: 0.5, f0: 2000, f1: 100, gain: 0.3 }); },
  spawn(o) { tone(o, { type: 'sine', f0: 200, f1: 1200, dur: 0.5, gain: 0.15 }); },
  win(o) { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(o, { type: 'triangle', f0: f, dur: 0.7, gain: 0.2, at: i * 0.12 })); },
  lose(o) { [392, 330, 262, 196].forEach((f, i) => tone(o, { type: 'sawtooth', f0: f, dur: 0.6, gain: 0.14, at: i * 0.18 })); },
};

// ambient pad + pulse. Minor 9 drifts, restrained.
const CHORDS = [[110, 165, 220, 261.6], [98, 146.8, 196, 233], [87.3, 130.8, 174.6, 220], [98, 146.8, 196, 246.9]];
function musicStep() {
  if (!ctx || musicMode === 'off') return;
  if (musicMode === 'zen') {   // slow pentatonic pad + sparse plucks
    const pad = [[73.4, 110, 146.8, 220], [65.4, 98, 130.8, 196], [87.3, 130.8, 174.6, 261.6], [73.4, 110, 164.8, 220]][((beat / 16) | 0) % 4];
    if (beat % 16 === 0) pad.forEach((f, i) => { tone(musBus, { type: 'sine', f0: f, dur: 9, gain: 0.07, atk: 2.2, det: i * 4 - 6 }); tone(musBus, { type: 'triangle', f0: f * 2, dur: 8, gain: 0.03, atk: 2.6 }); });
    if (beat % 4 === 2 && Math.random() < 0.6) { const sc = [293.7, 349.2, 392, 440, 523.3, 587.3, 698.5]; tone(musBus, { type: 'triangle', f0: sc[(Math.random() * sc.length) | 0], dur: 2.4, gain: 0.05, atk: 0.006 }); }
    beat++; return;
  }
  const chord = CHORDS[((beat / 8) | 0) % CHORDS.length];
  const intense = musicMode === 'match';
  if (beat % 8 === 0) {
    chord.forEach((f, i) => {
      tone(musBus, { type: 'sawtooth', f0: f, dur: 4.2, gain: 0.05, atk: 1.2, det: i * 6 - 9 });
      tone(musBus, { type: 'sine', f0: f * 2, dur: 4.2, gain: 0.05, atk: 1.5 });
    });
  }
  if (intense) {
    if (beat % 2 === 0) tone(musBus, { type: 'sine', f0: 55, f1: 40, dur: 0.35, gain: 0.5, atk: 0.005 });
    if (beat % 4 === 2) noise(musBus, { dur: 0.09, f0: 8000, f1: 5000, gain: 0.08, type: 'highpass' });
    if (beat % 8 === 5 || beat % 8 === 7) tone(musBus, { type: 'triangle', f0: chord[2] * 2, dur: 0.3, gain: 0.05 });
  } else if (beat % 4 === 0) {
    tone(musBus, { type: 'sine', f0: chord[(beat / 4) % 4 | 0] * 4, dur: 1.2, gain: 0.04, atk: 0.02 });
  }
  beat++;
}

// map ambience: wind over the snow / reactor hum, with the odd distant creak
let amb = null, ambKind = null, ambTimer = null;
function buildAmbience(kind) {
  const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(comp);
  const nodes = [];
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const windy = kind === 'wind' || kind === 'garden', amt = kind === 'garden' ? 0.4 : 1;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = windy ? (kind === 'garden' ? 420 : 520) : 160; src.connect(lp);
  const g1 = ctx.createGain(); g1.gain.value = windy ? 0.16 * amt : 0.09; lp.connect(g1); g1.connect(bus);
  const lfo = ctx.createOscillator(); lfo.frequency.value = windy ? 0.07 : 0.03; const lg = ctx.createGain(); lg.gain.value = windy ? 0.09 * amt : 0.03; lfo.connect(lg); lg.connect(g1.gain); lfo.start();
  src.start(); nodes.push(src, lfo);
  if (windy) {
    const s2 = ctx.createBufferSource(); s2.buffer = noiseBuf; s2.loop = true; s2.playbackRate.value = 0.7;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 7; const g2 = ctx.createGain(); g2.gain.value = kind === 'garden' ? 0.012 : 0.02;
    s2.connect(bp); bp.connect(g2); g2.connect(bus);
    const l2 = ctx.createOscillator(); l2.frequency.value = 0.11; const lg2 = ctx.createGain(); lg2.gain.value = 0.018; l2.connect(lg2); lg2.connect(g2.gain); l2.start(); s2.start(); nodes.push(s2, l2);
  } else {
    for (const f of [55, 55.45, 110.3]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = f > 100 ? 0.012 : 0.03; o.connect(g); g.connect(bus); o.start(); nodes.push(o); }
  }
  bus.gain.setTargetAtTime(vol.sfx * 0.9, ctx.currentTime, 1.5);
  return { bus, nodes };
}

export const Sound = {
  ready: false, night: 0,
  unlock() {
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    this.ready = true;
  },
  setVolume(m, s, mu) {
    vol.master = m; vol.sfx = s; vol.music = mu;
    if (ctx) { master.gain.value = m; sfxBus.gain.value = s; musBus.gain.value = mu * 0.35; }
  },
  suspend(on) { if (ctx) (on ? ctx.suspend() : ctx.resume()); },
  play(name, { vol: v = 1, pan = 0, pitch = 1 } = {}) {
    if (!ctx || !S[name] || ctx.state !== 'running') return;
    const o = out(pan, v);
    try { S[name](o, pitch); } catch { /* ignore */ }
  },
  // positional: attenuate by distance, pan by relative angle to listener
  at(name, pos, listener, v = 1) {
    if (!ctx) return;
    const dx = pos.x - listener.x, dz = pos.z - listener.z;
    const d = Math.hypot(dx, dz, (pos.y - listener.y) * 0.5);
    const att = Math.min(1, 9 / (d + 3)) * v;
    if (att < 0.04) return;
    // listener right vector = (cos yaw, -sin yaw)
    const pan = d > 0.01 ? ((dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw)) / d) * 0.8 : 0;
    this.play(name, { vol: att, pan, pitch: rand(0.95, 1.05) });
  },
  ambience(kind) {
    if (!ctx || kind === ambKind) return;
    if (amb) { const o = amb; o.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => { for (const n of o.nodes) { try { n.stop(); } catch { /* */ } } o.bus.disconnect(); }, 1800); amb = null; }
    if (ambTimer) { clearInterval(ambTimer); ambTimer = null; }
    ambKind = kind; if (!kind) return;
    amb = buildAmbience(kind);
    ambTimer = setInterval(() => {
      if (kind === 'garden') {
        if (ctx.state !== 'running') return;
        const r = Math.random();
        if (r < 0.45) { const sc = [1, 1.19, 1.34, 1.5, 1.78, 2, 2.38]; S.koto(sfxBus, sc[(Math.random() * sc.length) | 0] * (Math.random() < 0.3 ? 0.5 : 1)); if (Math.random() < 0.4) setTimeout(() => S.koto(sfxBus, sc[(Math.random() * sc.length) | 0]), 380); }
        else if (r < 0.8 && Sound.night > 0.5) { for (let i = 0; i < 3; i++) setTimeout(() => S.cricket(sfxBus), i * 420); }
        else if (r < 0.8) { const f = 2200 + Math.random() * 1400; [0, 0.11, 0.22].forEach((d, i) => { if (Math.random() < 0.8) tone(sfxBus, { type: 'sine', f0: f * (1 + i * 0.06), f1: f * (1.25 + i * 0.05), dur: 0.09, gain: 0.03, at: d }); }); }
        return;
      }
      if (ctx.state !== 'running' || Math.random() > 0.5) return; if (kind === 'wind') tone(sfxBus, { type: 'sine', f0: 240 + Math.random() * 200, f1: 180, dur: 2.4, gain: 0.02, atk: 1 }); else { tone(sfxBus, { type: 'triangle', f0: 90 + Math.random() * 40, f1: 60, dur: 1.4, gain: 0.05, atk: 0.4 }); noise(sfxBus, { dur: 0.5, f0: 900, f1: 200, gain: 0.05, type: 'bandpass', q: 5, at: 0.3 }); } }, kind === 'garden' ? 2600 : 7000);
  },
  announcer: false, _sayT: 0,
  // optional announcer: the browser's own speech synth, pitched low and clipped. Off by default.
  say(text) {
    if (!this.announcer || typeof speechSynthesis === 'undefined' || !text) return;
    const now = performance.now(); if (now - this._sayT < 500) return; this._sayT = now;
    try {
      const u = new SpeechSynthesisUtterance(String(text).replace(/<[^>]*>/g, ' ').toLowerCase());
      const vs = speechSynthesis.getVoices(), v = vs.find((x) => /^en/i.test(x.lang) && /male|daniel|alex|david|fred|google uk english male/i.test(x.name)) || vs.find((x) => /^en/i.test(x.lang));
      if (v) u.voice = v; u.pitch = 0.5; u.rate = 1.12; u.volume = Math.min(1, vol.master * 1.1);
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch { /* no speech support */ }
  },
  music(mode) {
    musicMode = mode;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (mode === 'off' || !ctx) return;
    beat = 0;
    musicTimer = setInterval(musicStep, mode === 'zen' ? 560 : 320);
  },
};
