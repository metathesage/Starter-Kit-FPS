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

const DEF = () => ({
  v: 1, callsign: rollCallsign(), xp: 0, level: 1, credits: 400,
  owned: {}, eq: { operator: 'aoi', halo: 'team', skin: 'stock', emblem: 'chevron', title: 'rookie' },
  stats: { kills: 0, deaths: 0, assists: 0, headshots: 0, matches: 0, wins: 0, perfects: 0, caps: 0, ballTime: 0, sniper: 0, sword: 0, grenade: 0, streakBest: 0 },
  medals: {}, badges: {}, seen: {},
});

let data = Object.assign(DEF(), store('profile', {}));
data.eq = Object.assign(DEF().eq, data.eq); data.stats = Object.assign(DEF().stats, data.stats);
if (!data.callsign) data.callsign = rollCallsign();
const persist = () => save('profile', data);
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
  addStat(k, n = 1) { data.stats[k] = (data.stats[k] || 0) + n; },
  addMedal(name) { data.medals[name] = (data.medals[name] || 0) + 1; },
};
