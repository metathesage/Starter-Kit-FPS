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
  rocket(o) { noise(o, { dur: 0.7, f0: 900, f1: 200, gain: 0.7, type: 'bandpass', q: 2 }); tone(o, { type: 'sawtooth', f0: 90, f1: 40, dur: 0.5, gain: 0.35 }); },
  explode(o) { noise(o, { dur: 1.3, f0: 2200, f1: 60, gain: 1, q: 0.4 }); tone(o, { type: 'sine', f0: 90, f1: 22, dur: 1.0, gain: 0.9 }); noise(o, { dur: 0.4, f0: 8000, f1: 1000, gain: 0.3, type: 'highpass' }); },
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

export const Sound = {
  ready: false,
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
  music(mode) {
    musicMode = mode;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (mode === 'off' || !ctx) return;
    beat = 0;
    musicTimer = setInterval(musicStep, 320);
  },
};
