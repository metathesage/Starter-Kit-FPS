// Procedural Web Audio: every sound is synthesized, nothing to download.
import { rand } from './util.js';

let ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null, comp = null;
let musicTimer = null, musicMode = 'off', beat = 0;
const vol = { master: 0.8, sfx: 1, music: 0.5 };
// licensed guitar-driven score (see audio/music/CREDITS.txt); the procedural music below is the fallback
const TRACKS = { menu: ['aries'], zen: ['aries'], match: ['atheria', 'calamity', 'messengers', 'vilified'] };
let trackEl = null, trackKind = null, trackI = 0, trackOK = true, trackGain = null;
function stopTrack() {
  const el = trackEl; trackEl = null; if (!el) return;
  if (trackGain && ctx) { const g = trackGain; g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(0, ctx.currentTime, 0.25); trackGain = null; }
  setTimeout(() => { try { el.pause(); el.src = ''; } catch { /* gone */ } }, 900);
}
function startTrack(kind, keep) {
  if (!ctx) return;
  const list = TRACKS[kind]; trackKind = kind;
  if (!keep) trackI = kind === 'match' ? (Math.random() * list.length) | 0 : 0;
  const el = new Audio(); el.preload = 'auto'; el.loop = list.length === 1; el.src = `audio/music/${list[trackI % list.length]}.mp3`;
  try {
    const src = ctx.createMediaElementSource(el), g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(musBus);
    g.gain.setTargetAtTime(kind === 'menu' || kind === 'zen' ? 2.6 : 2.3, ctx.currentTime, 1.2);
    trackEl = el; trackGain = g;
    el.addEventListener('ended', () => { if (trackEl === el && trackKind === kind) { trackI++; stopTrack(); startTrack(kind, true); } });
    el.addEventListener('error', () => { if (trackEl === el) { trackOK = false; trackEl = null; Sound.music(musicMode); } });
    el.play().catch(() => { if (trackEl === el) { trackOK = false; trackEl = null; Sound.music(musicMode); } });
  } catch { trackOK = false; }
}

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

// ---- futuristic UI palette: FM ticks, glass partials, air sweeps, sub thumps, all through a short bright reverb ----
let verbIn = null;
function verb() {
  if (verbIn) return verbIn;
  const conv = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let prev = 0; for (let i = 0; i < len; i++) { const n = Math.random() * 2 - 1; d[i] = (n - prev * 0.6) * Math.pow(1 - i / len, 2.8); prev = n; } }
  conv.buffer = ir; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500; const wet = ctx.createGain(); wet.gain.value = 0.55;
  verbIn = ctx.createGain(); verbIn.connect(hp); hp.connect(conv); conv.connect(wet); wet.connect(sfxBus);
  return verbIn;
}
function wet(o, amt = 0.35) { const g = ctx.createGain(); g.connect(o); const s = ctx.createGain(); s.gain.value = amt; g.connect(s); s.connect(verb()); return g; }
function fm(o, { f = 1200, ratio = 2, idx = 2, dur = 0.12, gain = 0.12, at = 0, atk = 0.002, f1 }) {
  const t = ctx.currentTime + at, c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
  c.frequency.setValueAtTime(f, t); if (f1) c.frequency.exponentialRampToValueAtTime(f1, t + dur); m.frequency.value = f * ratio;
  mg.gain.setValueAtTime(f * idx, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.05), t + dur); m.connect(mg); mg.connect(c.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  c.connect(g); g.connect(o); c.start(t); m.start(t); c.stop(t + dur + 0.05); m.stop(t + dur + 0.05);
}
function bell(o, { f = 880, dur = 0.7, gain = 0.1, at = 0, parts = [1, 2.76, 5.4], atk = 0.003 }) {
  parts.forEach((r, i) => tone(o, { type: 'sine', f0: f * r, f1: f * r * 0.999, dur: dur / (1 + i * 0.7), gain: gain / (1 + i * 1.3), at, atk }));
}
function air(o, { dur = 0.3, f0 = 2000, f1 = 9000, gain = 0.1, at = 0, type = 'highpass', q = 0.8, atk = 0.02 }) { noise(o, { dur, f0, f1, gain, at, type, q, atk }); }
function sub(o, { f0 = 90, f1 = 42, dur = 0.2, gain = 0.2, at = 0 }) { tone(o, { type: 'sine', f0, f1, dur, gain, at, atk: 0.004 }); }
function pad(o, { notes = [220], dur = 1.4, gain = 0.05, at = 0, f0 = 300, f1 = 2400 }) {
  const t = ctx.currentTime + at, lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(f0, t); lp.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6); lp.frequency.exponentialRampToValueAtTime(f0, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); lp.connect(g); g.connect(o);
  for (const n of notes) for (const d of [-7, 7]) { const os = ctx.createOscillator(); os.type = 'sawtooth'; os.frequency.value = n; os.detune.value = d; os.connect(lp); os.start(t); os.stop(t + dur + 0.05); }
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
  hawk(o) { noise(o, { dur: 0.32, f0: 4800, f1: 260, gain: 0.85, q: 0.7 }); tone(o, { type: 'sawtooth', f0: 170, f1: 36, dur: 0.3, gain: 0.5 }); tone(o, { type: 'sine', f0: 1500, f1: 380, dur: 0.22, gain: 0.16, at: 0.01 }); tone(o, { type: 'triangle', f0: 2200, f1: 1200, dur: 0.5, gain: 0.05, at: 0.04 }); },
  lw(o) { noise(o, { dur: 0.13, f0: 5800, f1: 700, gain: 0.55, q: 0.8 }); tone(o, { type: 'square', f0: 330, f1: 80, dur: 0.08, gain: 0.22 }); tone(o, { type: 'sine', f0: 900, f1: 300, dur: 0.06, gain: 0.08 }); },
  fw(o) { noise(o, { dur: 0.55, f0: 3600, f1: 130, gain: 1, q: 0.55 }); tone(o, { type: 'sawtooth', f0: 100, f1: 24, dur: 0.45, gain: 0.55 }); tone(o, { type: 'square', f0: 240, f1: 60, dur: 0.12, gain: 0.2 }); noise(o, { dur: 0.3, f0: 2200, f1: 500, gain: 0.25, at: 0.05, type: 'bandpass', q: 2 }); },
  gjall(o) { noise(o, { dur: 0.9, f0: 800, f1: 160, gain: 0.8, type: 'bandpass', q: 1.6 }); tone(o, { type: 'sawtooth', f0: 70, f1: 28, dur: 0.7, gain: 0.5 }); tone(o, { type: 'sine', f0: 420, f1: 90, dur: 0.5, gain: 0.25 }); [0, 0.11, 0.22].forEach((d) => tone(o, { type: 'triangle', f0: 620 + d * 400, f1: 300, dur: 0.3, gain: 0.06, at: d })); },
  thorn(o) { noise(o, { dur: 0.22, f0: 5200, f1: 500, gain: 0.6, q: 0.9 }); tone(o, { type: 'sawtooth', f0: 190, f1: 50, dur: 0.2, gain: 0.32 }); tone(o, { type: 'sawtooth', f0: 1800, f1: 700, dur: 0.28, gain: 0.08, det: 20 }); noise(o, { dur: 0.18, f0: 7000, f1: 3000, gain: 0.12, at: 0.02, type: 'highpass' }); },
  luck(o) { [880, 1318, 1760].forEach((f, i) => tone(o, { type: 'triangle', f0: f, dur: 0.35, gain: 0.13, at: i * 0.05 })); },
  exotic(o) { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(o, { type: 'triangle', f0: f, dur: 1.1, gain: 0.16, at: i * 0.09 })); tone(o, { type: 'sine', f0: 98, f1: 196, dur: 1.4, gain: 0.3, atk: 0.4 }); noise(o, { dur: 1.2, f0: 800, f1: 7000, gain: 0.12, type: 'bandpass', q: 1.5, atk: 0.6 }); },
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
  charge(o) { const w = wet(o, 0.5); air(w, { dur: 1.4, f0: 400, f1: 9000, gain: 0.08, atk: 0.9, type: 'bandpass', q: 1.5 }); fm(w, { f: 300, f1: 900, ratio: 1.5, idx: 1, dur: 1.4, gain: 0.05, atk: 0.6 }); },
  alarm(o) { tone(o, { type: 'square', f0: 880, dur: 0.09, gain: 0.13 }); tone(o, { type: 'square', f0: 880, dur: 0.09, gain: 0.13, at: 0.16 }); },
  pickup(o) { tone(o, { type: 'sine', f0: 500, f1: 1000, dur: 0.18, gain: 0.2 }); tone(o, { type: 'sine', f0: 750, f1: 1500, dur: 0.22, gain: 0.15, at: 0.06 }); },
  power(o) { const w = wet(o, 0.5); [392, 523, 659, 784].forEach((f, i) => bell(w, { f, dur: 0.8, gain: 0.08, at: i * 0.07, parts: [1, 2.01, 3.99] })); sub(w, { f0: 90, f1: 48, dur: 0.3, gain: 0.2 }); },
  reload(o) { noise(o, { dur: 0.06, f0: 2500, f1: 800, gain: 0.35, type: 'bandpass', q: 3 }); noise(o, { dur: 0.08, f0: 2000, f1: 600, gain: 0.4, type: 'bandpass', q: 3, at: 0.5 }); },
  swap(o) { noise(o, { dur: 0.1, f0: 2000, f1: 700, gain: 0.3, type: 'bandpass', q: 2 }); },
  jump(o) { noise(o, { dur: 0.1, f0: 800, f1: 300, gain: 0.15 }); },
  land(o) { noise(o, { dur: 0.14, f0: 500, f1: 90, gain: 0.35 }); },
  step(o) { noise(o, { dur: 0.05, f0: 900, f1: 250, gain: 0.1 }); },
  empty(o) { air(o, { dur: 0.04, f0: 3000, f1: 1200, gain: 0.12, type: 'bandpass', q: 4 }); },
  menuMove(o) { const w = wet(o, 0.22); fm(w, { f: 2600, ratio: 3.01, idx: 1.4, dur: 0.05, gain: 0.07 }); air(w, { dur: 0.03, f0: 7000, f1: 9000, gain: 0.05, type: 'bandpass', q: 3 }); },
  menuOk(o) { const w = wet(o, 0.45); sub(w, { f0: 110, f1: 46, dur: 0.18, gain: 0.2 }); bell(w, { f: 1320, dur: 0.6, gain: 0.1, parts: [1, 1.5, 2.01, 4.02] }); fm(w, { f: 2640, ratio: 2, idx: 1.6, dur: 0.09, gain: 0.07, at: 0.03 }); air(w, { dur: 0.3, f0: 2200, f1: 10000, gain: 0.09, atk: 0.06 }); },
  menuOpen(o) { const w = wet(o, 0.5); air(w, { dur: 0.5, f0: 300, f1: 6000, gain: 0.09, atk: 0.16, type: 'bandpass', q: 0.9 }); sub(w, { f0: 60, f1: 40, dur: 0.4, gain: 0.14, at: 0.08 }); bell(w, { f: 990, dur: 0.6, gain: 0.04, at: 0.16, parts: [1, 2.01] }); },
  menuBack(o) { const w = wet(o, 0.35); air(w, { dur: 0.24, f0: 9000, f1: 1600, gain: 0.1, atk: 0.01 }); bell(w, { f: 660, dur: 0.35, gain: 0.08, parts: [1, 1.5, 3.01] }); sub(w, { f0: 80, f1: 38, dur: 0.16, gain: 0.16 }); },
  medal(o) { const w = wet(o, 0.5); [880, 1175, 1568].forEach((f, i) => bell(w, { f, dur: 0.9, gain: 0.09, at: i * 0.07, parts: [1, 2.01, 3.99] })); sub(w, { f0: 100, f1: 50, dur: 0.22, gain: 0.16 }); air(w, { dur: 0.35, f0: 3000, f1: 11000, gain: 0.06 }); },
  count(o) { const w = wet(o, 0.3); fm(w, { f: 880, ratio: 2, idx: 1.2, dur: 0.16, gain: 0.14 }); sub(w, { f0: 70, f1: 45, dur: 0.14, gain: 0.2 }); },
  go(o) { const w = wet(o, 0.55); air(w, { dur: 0.55, f0: 600, f1: 9000, gain: 0.14, atk: 0.3, type: 'bandpass', q: 1.2 }); sub(w, { f0: 90, f1: 36, dur: 0.6, gain: 0.32, at: 0.28 }); bell(w, { f: 1760, dur: 1.1, gain: 0.1, at: 0.28, parts: [1, 1.5, 2.01] }); },
  death(o) { tone(o, { type: 'sawtooth', f0: 300, f1: 40, dur: 0.7, gain: 0.3 }); noise(o, { dur: 0.5, f0: 2000, f1: 100, gain: 0.3 }); },
  spawn(o) { const w = wet(o, 0.5); air(w, { dur: 0.6, f0: 500, f1: 8000, gain: 0.1, atk: 0.35, type: 'bandpass', q: 1 }); bell(w, { f: 1568, dur: 0.8, gain: 0.05, at: 0.3, parts: [1, 2.01] }); },
  win(o) { const w = wet(o, 0.6); sub(w, { f0: 100, f1: 34, dur: 1.2, gain: 0.34 }); pad(w, { notes: [220, 277, 330, 440], dur: 2.2, gain: 0.045 }); [660, 880, 1320, 1760].forEach((f, i) => bell(w, { f, dur: 1.4, gain: 0.08, at: 0.35 + i * 0.13, parts: [1, 2.01, 3.99] })); air(w, { dur: 0.9, f0: 800, f1: 12000, gain: 0.08, atk: 0.4 }); },
  lose(o) { const w = wet(o, 0.6); sub(w, { f0: 70, f1: 28, dur: 1.4, gain: 0.3 }); pad(w, { notes: [196, 233, 294], dur: 2.4, gain: 0.04, f0: 500, f1: 1000 }); bell(w, { f: 440, dur: 1.6, gain: 0.07, at: 0.2, parts: [1, 1.19, 2.4] }); air(w, { dur: 1.1, f0: 5000, f1: 300, gain: 0.07 }); },
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
  if (kind === 'space') {   // drifting sub drone, breathing air, slow shimmering fifths
    const src2 = ctx.createBufferSource(); src2.buffer = noiseBuf; src2.loop = true; const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 900; bp2.Q.value = 0.6; const ga = ctx.createGain(); ga.gain.value = 0.02;
    src2.connect(bp2); bp2.connect(ga); ga.connect(bus); const la = ctx.createOscillator(); la.frequency.value = 0.05; const lga = ctx.createGain(); lga.gain.value = 0.014; la.connect(lga); lga.connect(ga.gain); const lf = ctx.createOscillator(); lf.frequency.value = 0.04; const lfg = ctx.createGain(); lfg.gain.value = 500; lf.connect(lfg); lfg.connect(bp2.frequency);
    la.start(); lf.start(); src2.start(); nodes.push(src2, la, lf);
    for (const [f, gn] of [[41.2, 0.06], [55, 0.04], [82.4, 0.018], [123.5, 0.012]]) { const o = ctx.createOscillator(); o.type = f > 80 ? 'triangle' : 'sine'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = gn; o.connect(g); g.connect(bus); o.start(); nodes.push(o); }
    bus.gain.setTargetAtTime(vol.sfx * 0.9, ctx.currentTime, 2); return { bus, nodes };
  }
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
      if (kind === 'space') {
        if (ctx.state !== 'running' || Math.random() > 0.45) return;
        const w = wet(sfxBus, 0.7), f = [523, 659, 784, 988, 1175, 1568][(Math.random() * 6) | 0] * (Math.random() < 0.3 ? 2 : 1); bell(w, { f, dur: 2.4, gain: 0.018, parts: [1, 2.01, 3.99] }); if (Math.random() < 0.3) air(w, { dur: 1.6, f0: 2000, f1: 9000, gain: 0.02, atk: 0.9, type: 'bandpass', q: 2 });
        return;
      }
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
  trackInfo() { return trackEl ? { src: trackEl.src.split('/').pop(), t: +trackEl.currentTime.toFixed(2), paused: trackEl.paused, ok: trackOK } : { ok: trackOK }; },
  announcer: true, _sayT: 0, _vo: { man: null, buf: new Map(), busy: 0, loading: null },
  // narrator: pre-rendered holographic-AI clips (audio/vo). Text is normalised to a key; unknown lines stay silent.
  async _voLoad() {
    const V = this._vo; if (V.man) return V.man; if (V.loading) return V.loading;
    return (V.loading = fetch('audio/vo/manifest.json').then((r) => r.json()).then((m) => (V.man = m)).catch(() => (V.man = {})));
  },
  say(text) {
    if (!this.announcer || !text) return;
    const c = ensure(); if (!c) return;
    const key = String(text).replace(/<[^>]*>/g, ' ').toUpperCase().replace(/\s+/g, ' ').trim();
    this.vo(key);
  },
  async vo(key) {
    const c = ensure(); if (!c || !this.announcer) return;
    const V = this._vo, man = await this._voLoad();
    let file = man[key]; if (!file) { const vs = Object.keys(man).filter((k) => k.startsWith(key) && /\d$/.test(k)); if (vs.length) file = man[vs[(Math.random() * vs.length) | 0]]; }
    if (!file) return;
    const now = performance.now(); if (V.busy > now && !key.startsWith('@')) return;   // never talk over the narrator, except scene lines
    let b = V.buf.get(file);
    if (!b) { try { const r = await fetch('audio/vo/' + file); b = await c.decodeAudioData(await r.arrayBuffer()); V.buf.set(file, b); } catch { return; } }
    if (!V.bus) { V.bus = c.createGain(); V.bus.gain.value = 1.15; V.bus.connect(comp); }
    const src = c.createBufferSource(); src.buffer = b; src.connect(V.bus); src.start();
    V.busy = performance.now() + b.duration * 1000 + 120;
    const t = c.currentTime; musBus.gain.cancelScheduledValues(t); musBus.gain.setTargetAtTime(vol.music * 0.35 * 0.35, t, 0.05); musBus.gain.setTargetAtTime(vol.music * 0.35, t + b.duration + 0.1, 0.4);
  },
  music(mode) {
    musicMode = mode;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    stopTrack();
    if (mode === 'off' || !ctx) return;
    if (TRACKS[mode] && trackOK) { startTrack(mode); return; }
    beat = 0;
    musicTimer = setInterval(musicStep, mode === 'zen' ? 560 : 320);
  },
};
