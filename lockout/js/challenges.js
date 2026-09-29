// Daily + weekly challenges. Deterministic per date, progress stored in the profile.
import { Profile } from './profile.js';

// key = a per-match stat the match summary provides
const POOL = [
  { id: 'kills', text: 'Get {n} kills', key: 'kills', n: [15, 25, 40], wk: [80, 140] },
  { id: 'heads', text: 'Land {n} headshot kills', key: 'heads', n: [5, 10, 16], wk: [40, 70] },
  { id: 'perfect', text: 'Earn {n} Perfect', key: 'perfects', n: [1, 2, 3], wk: [5, 8] },
  { id: 'sniper', text: 'Get {n} sniper kills', key: 'sniper', n: [3, 5, 8], wk: [15, 25] },
  { id: 'sword', text: 'Get {n} energy sword kills', key: 'sword', n: [2, 3, 5], wk: [8, 14] },
  { id: 'grenade', text: 'Get {n} grenade kills', key: 'grenade', n: [2, 3, 5], wk: [8, 14] },
  { id: 'wins', text: 'Win {n} matches', key: 'wins', n: [1, 2, 3], wk: [5, 9] },
  { id: 'matches', text: 'Finish {n} matches', key: 'matches', n: [2, 3, 5], wk: [10, 16] },
  { id: 'caps', text: 'Capture {n} flags', key: 'caps', n: [1, 2, 3], wk: [5, 9] },
  { id: 'ball', text: 'Hold the ball for {n} seconds', key: 'ballSec', n: [30, 60, 90], wk: [240, 420] },
  { id: 'medals', text: 'Earn {n} medals', key: 'medals', n: [6, 10, 15], wk: [40, 70] },
  { id: 'streak', text: 'Reach a {n} kill streak', key: 'streak', n: [4, 6, 8], wk: [8, 12] },
];

const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const dayKey = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const weekKey = (d = new Date()) => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return dayKey(t); };

function make(seed, count, weekly) {
  const r = rng(seed), pool = [...POOL], out = [];
  for (let i = 0; i < count && pool.length; i++) {
    const t = pool.splice((r() * pool.length) | 0, 1)[0];
    const tier = weekly ? (i % 2) : (r() * 3) | 0, n = weekly ? t.wk[tier] : t.n[tier];
    out.push({ id: t.id + ':' + n, text: t.text.replace('{n}', n), key: t.key, goal: n, prog: 0, done: false, xp: weekly ? 500 + tier * 300 : 150 + tier * 120, cr: weekly ? 300 + tier * 150 : 60 + tier * 60, weekly });
  }
  return out;
}

export const Challenges = {
  get() {
    const d = Profile.d, dk = dayKey(), wk = weekKey();
    d.ch = d.ch || {};
    if (d.ch.day !== dk) { d.ch.day = dk; d.ch.daily = make(dk, 3, false); }
    if (d.ch.week !== wk) { d.ch.week = wk; d.ch.weekly = make(wk * 7 + 1, 2, true); }
    return d.ch;
  },
  all() { const c = this.get(); return [...c.daily, ...c.weekly]; },
  // apply a finished match; returns the challenges completed by it
  apply(S) {
    const done = [], vals = { ...S };
    for (const ch of this.all()) {
      if (ch.done) continue;
      const v = ch.key === 'streak' ? S.streakBest : (vals[ch.key] || 0);
      ch.prog = ch.key === 'streak' ? Math.max(ch.prog, v) : Math.min(ch.goal, ch.prog + v);
      if (ch.prog >= ch.goal) { ch.done = true; ch.prog = ch.goal; done.push(ch); }
    }
    Profile.save();
    return done;
  },
  resetIn() { const n = new Date(), t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); const s = Math.max(0, (t - n) / 1000) | 0; return `${(s / 3600) | 0}H ${(((s % 3600) / 60) | 0)}M`; },
};
