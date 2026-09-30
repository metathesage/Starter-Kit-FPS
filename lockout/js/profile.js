// Persistent player profile: callsign, XP / level, credits, unlocks, equipped cosmetics, lifetime stats, medals.
import { store, save } from './util.js';

const WORDS_A = ['NIGHT', 'FROST', 'HALO', 'VOID', 'ASH', 'IRON', 'GHOST', 'STORM', 'ONYX', 'LUNAR', 'ECHO', 'RAZOR', 'SABLE', 'NEON', 'COLD', 'VEIL'];
const WORDS_B = ['WARDEN', 'FANG', 'WING', 'SHADE', 'BLADE', 'FALL', 'SEER', 'RUNNER', 'LANCE', 'CROWN', 'VIPER', 'HUNT', 'PULSE', 'KNELL', 'SPIRE', 'DRIFT'];
export const rollCallsign = () => WORDS_A[(Math.random() * WORDS_A.length) | 0] + WORDS_B[(Math.random() * WORDS_B.length) | 0] + String((Math.random() * 90 + 10) | 0);
export const cleanTag = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9_ ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);

export const MAX_LEVEL = 50;
// XP needed to go from level L to L+1
export const xpToNext = (L) => 260 + 90 * (L - 1) + 6 * (L - 1) * (L - 1);
export const RANKS = ['RECRUIT', 'APPRENTICE', 'PRIVATE', 'CORPORAL', 'SERGEANT', 'GUNNERY SGT', 'LIEUTENANT', 'CAPTAIN', 'MAJOR', 'COMMANDER', 'COLONEL', 'BRIGADIER', 'GENERAL', 'ANGEL'];
export const rankOf = (L) => RANKS[Math.min(RANKS.length - 1, Math.floor((L - 1) / 4))];

const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
export const SAVE_VERSION = 2;
// v1 -> v2: stable player id (future cloud key / hub identity), skill slot, look slot (character customizer)
const migrate = (d) => { if (!d.id) d.id = rid(); if (!d.skills) d.skills = {}; if (!d.look) d.look = {}; if (!d.created) d.created = Date.now(); d.v = SAVE_VERSION; return d; };

const DEF = () => ({
  v: SAVE_VERSION, id: rid(), created: Date.now(), updated: 0, skills: {}, look: {}, callsign: rollCallsign(), xp: 0, level: 1, credits: 400,
  owned: {}, eq: { operator: 'aoi', halo: 'team', skin: 'stock', emblem: 'chevron', title: 'rookie' },
  stats: { kills: 0, deaths: 0, assists: 0, headshots: 0, matches: 0, wins: 0, perfects: 0, caps: 0, ballTime: 0, sniper: 0, sword: 0, grenade: 0, streakBest: 0, shots: 0, hits: 0, playSec: 0, losses: 0, draws: 0, winStreak: 0, winStreakBest: 0, bestKills: 0, medalsTotal: 0, xpTotal: 0 },
  wk: {}, maps: {}, modes: {}, hist: [],
  medals: {}, badges: {}, seen: {},
});

const fill = (o) => { const d = migrate(Object.assign(DEF(), o)); d.eq = Object.assign(DEF().eq, d.eq); d.stats = Object.assign(DEF().stats, d.stats); return d; };
let data = fill(store('profile', {}));
if (!data.callsign) data.callsign = rollCallsign();
const persist = () => { data.updated = Date.now(); save('profile', data); };
persist();

export const Profile = {
  get d() { return data; },
  get callsign() { return data.callsign; },
  setCallsign(s) { const t = cleanTag(s); data.callsign = t.length >= 2 ? t : data.callsign; persist(); return data.callsign; },
  get level() { return data.level; },
  get xp() { return data.xp; },
  get credits() { return data.credits; },
  get rank() { return rankOf(data.level); },
  progress() { return data.level >= MAX_LEVEL ? 1 : data.xp / xpToNext(data.level); },
  save: persist,
  get id() { return data.id; },
  // portable save: paste it on another device or keep it as a backup. Checksummed so a truncated paste is rejected.
  exportCode() {
    const j = JSON.stringify({ p: data, l: store('loadout', {}) });
    return `NEWLIGHT${SAVE_VERSION}.${hash(j)}.${btoa(unescape(encodeURIComponent(j)))}`;
  },
  importCode(str) {
    try {
      const [tag, h, b] = String(str).trim().split('.');
      if (!tag || !(tag.startsWith('NEWLIGHT') || tag.startsWith('LOCKOUT')) || !b) return { ok: false, err: 'Not a Nu Light save code' };
      const j = decodeURIComponent(escape(atob(b)));
      if (hash(j) !== h) return { ok: false, err: 'Code is damaged or cut off' };
      const o = JSON.parse(j);
      if (!o.p || typeof o.p.level !== 'number') return { ok: false, err: 'Save data is empty' };
      data = fill(o.p); persist(); if (o.l) save('loadout', o.l);
      return { ok: true, level: data.level, callsign: data.callsign };
    } catch { return { ok: false, err: 'Could not read that code' }; }
  },
  owns(id) { return !!data.owned[id]; },
  own(id) { data.owned[id] = 1; persist(); },
  spend(n) { if (data.credits < n) return false; data.credits -= n; persist(); return true; },
  equip(cat, id) { data.eq[cat] = id; persist(); },
  // returns { levels: [newLevel...], xp, credits }
  addXp(n, credits = 0) {
    data.xp += n; data.credits += credits; const ups = [];
    while (data.level < MAX_LEVEL && data.xp >= xpToNext(data.level)) { data.xp -= xpToNext(data.level); data.level++; data.credits += 100 + data.level * 10; ups.push(data.level); }
    if (data.level >= MAX_LEVEL) data.xp = 0;
    persist(); return { levels: ups };
  },
  // one finished match: lifetime totals, per-weapon / per-map / per-mode books, streaks and a rolling history
  logMatch(r) {
    const s = data.stats;
    s.shots += r.shots || 0; s.hits += r.hits || 0; s.playSec += r.dur || 0; s.medalsTotal += r.medals || 0; s.xpTotal += r.xp || 0;
    s.bestKills = Math.max(s.bestKills, r.k || 0);
    if (r.tie) s.draws++; else if (r.won) { s.winStreak++; s.winStreakBest = Math.max(s.winStreakBest, s.winStreak); } else { s.losses++; s.winStreak = 0; }
    for (const [w, n] of Object.entries(r.wk || {})) data.wk[w] = (data.wk[w] || 0) + n;
    const M = (o, k) => (o[k] ||= { p: 0, w: 0, k: 0 }); const m = M(data.maps, r.map), q = M(data.modes, r.mode);
    for (const t of [m, q]) { t.p++; if (r.won) t.w++; t.k += r.k || 0; }
    data.hist.unshift({ t: Date.now(), map: r.map, mode: r.mode, won: !!r.won, tie: !!r.tie, k: r.k, d: r.d, a: r.a, sc: r.sc, xp: r.xp, dur: r.dur });
    if (data.hist.length > 30) data.hist.length = 30;
    persist();
  },
  addStat(k, n = 1) { data.stats[k] = (data.stats[k] || 0) + n; },
  addMedal(name) { data.medals[name] = (data.medals[name] || 0) + 1; },
};
