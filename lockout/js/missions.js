// Sanctum missions: bot matches with a fixed setup, first-clear rewards, optional bonus objectives, one rotating daily.
import { Profile } from './profile.js';

// bonus: stat key from the match stats (S in main.js) or a medal name
export const MISSIONS = [
  { id: 'm1', name: 'FIRST BLOOM', brief: 'Warm up. Win a skirmish in the drowned atrium.', mode: 'slayer', map: 'overgrowth', variant: 'standard', diff: 'easy', limit: 15, team: 'blue', reward: { credits: 150, xp: 220 }, bonus: { text: 'Land 3 headshots', stat: 'heads', n: 3, credits: 60 }, req: 0 },
  { id: 'm2', name: 'IRON CHORD', brief: 'Steal their flag on the launch pad. Bring it home.', mode: 'ctf', map: 'warsat', variant: 'standard', diff: 'normal', limit: 3, team: 'blue', reward: { credits: 220, xp: 320 }, bonus: { text: 'Capture a flag yourself', stat: 'caps', n: 1, credits: 80 }, req: 1 },
  { id: 'm3', name: 'VOID HUNT', brief: 'Play Spartan. The warlocks are casting. Break every Nova you can.', mode: 'hunt', map: 'overgrowth', variant: 'standard', diff: 'normal', limit: 20, team: 'blue', reward: { credits: 260, xp: 360 }, bonus: { text: 'Earn a NOVA BREAKER medal', medal: 'NOVA BREAKER', n: 1, credits: 100 }, req: 1 },
  { id: 'm4', name: 'GLASS CANNON', brief: 'Play Warlock. Glide, blink, and end them with a Nova Bomb.', mode: 'hunt', map: 'warsat', variant: 'standard', diff: 'normal', limit: 20, team: 'red', reward: { credits: 260, xp: 360 }, bonus: { text: 'Get a Nova Bomb kill', medal: 'NOVA BOMB', n: 1, credits: 100 }, req: 2 },
  { id: 'm5', name: 'SILENT HOUR', brief: 'Snipers only, sunset canyon. Breathe out, then shoot.', mode: 'slayer', map: 'mesa', variant: 'snipers', diff: 'normal', limit: 15, team: 'blue', reward: { credits: 300, xp: 400 }, bonus: { text: '5 sniper kills', stat: 'sniper', n: 5, credits: 100 }, req: 3 },
  { id: 'm6', name: 'BLADE DANCE', brief: 'Swords and magnums on the glass deck. Stay close.', mode: 'slayer', map: 'lockout', variant: 'swords', diff: 'heroic', limit: 15, team: 'blue', reward: { credits: 380, xp: 480 }, bonus: { text: '4 sword kills', stat: 'sword', n: 4, credits: 120 }, req: 4 },
  { id: 'm7', name: 'THE LONG NIGHT', brief: 'Eight operators, one snowfield, no friends.', mode: 'rumble', map: 'cryostat', variant: 'standard', diff: 'heroic', limit: 25, team: 'blue', reward: { credits: 420, xp: 520 }, bonus: { text: 'Reach a 5 kill streak', stat: 'streakBest', n: 5, credits: 140 }, req: 5 },
  { id: 'm8', name: 'BALL AND CHAIN', brief: 'Hold the ball above the rocket. Do not die with it.', mode: 'oddball', map: 'warsat', variant: 'standard', diff: 'normal', limit: 60, team: 'blue', reward: { credits: 340, xp: 440 }, bonus: { text: 'Hold the ball for 30 seconds', stat: 'ballSec', n: 30, credits: 120 }, req: 5 },
  { id: 'm9', name: 'FIESTA FALLS', brief: 'Random weapons, low gravity, high spirits.', mode: 'slayer', map: 'mesa', variant: 'fiesta', diff: 'heroic', limit: 25, team: 'blue', reward: { credits: 450, xp: 560 }, bonus: { text: 'Earn any 3 medals', stat: 'medalN', n: 3, credits: 150 }, req: 6 },
  { id: 'm10', name: 'LEGEND OF THE GARDEN', brief: 'Legendary bots. The atrium remembers everyone who left.', mode: 'slayer', map: 'overgrowth', variant: 'standard', diff: 'legendary', limit: 25, team: 'blue', reward: { credits: 900, xp: 1000 }, bonus: { text: 'Earn a PERFECT', stat: 'perfects', n: 1, credits: 400 }, req: 8 },
];

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
export function dailyMission() {
  const d = new Date(), day = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(), r = rng(day + 7);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const mode = pick(['slayer', 'hunt', 'ctf', 'oddball', 'rumble']), map = pick(['lockout', 'cryostat', 'mesa', 'overgrowth', 'warsat']);
  const variant = pick(['standard', 'standard', 'fiesta', 'snipers', 'swords', 'lowgrav']), diff = pick(['normal', 'heroic', 'heroic']);
  const limits = { slayer: 20, hunt: 20, ctf: 3, oddball: 60, rumble: 20 };
  return { id: 'daily' + day, daily: true, name: 'DAILY BLOOM', brief: 'Today only. Doubled first-clear rewards.', mode, map, variant: mode === 'ctf' || mode === 'oddball' ? 'standard' : variant, diff, limit: limits[mode], team: mode === 'hunt' && r() < 0.5 ? 'red' : 'blue', reward: { credits: 500, xp: 700 }, bonus: { text: 'Win by playing clean: 2 headshots', stat: 'heads', n: 2, credits: 150 }, req: 0 };
}
export const missionState = (id) => { const m = Profile.d.missions || (Profile.d.missions = {}); return m[id] || (m[id] = { clears: 0, bonus: 0 }); };
export const clearedCount = () => Object.entries(Profile.d.missions || {}).filter(([id, v]) => !id.startsWith('daily') && v.clears > 0).length;
export const unlocked = (m) => m.req <= clearedCount();

// evaluate a finished match. returns { cleared, first, bonusHit, credits, xp }
export function resolve(m, won, S, medalCount) {
  const st = missionState(m.id), out = { cleared: won, first: false, bonusHit: false, credits: 0, xp: 0 };
  if (!won) return out;
  const first = st.clears === 0; out.first = first; st.clears++;
  if (first) { out.credits += m.reward.credits; out.xp += m.reward.xp; } else { out.credits += Math.round(m.reward.credits * 0.2); out.xp += Math.round(m.reward.xp * 0.2); }
  const b = m.bonus; let hit = false;
  if (b.stat === 'medalN') hit = medalCount >= b.n; else if (b.stat) hit = (S[b.stat] || 0) >= b.n; else if (b.medal) hit = (S.medals[b.medal] || 0) >= b.n;
  if (hit && !st.bonus) { st.bonus = 1; out.bonusHit = true; out.credits += b.credits; }
  if (m.daily) { const now = new Date().toDateString(); if (Profile.d.seen.dailyDone !== now) { Profile.d.seen.dailyDone = now; out.credits += m.reward.credits; out.xp += m.reward.xp; } }
  Profile.d.credits += out.credits; Profile.save();
  return out;
}
