// Everything unlockable or browsable: operators, halos, emblems, titles, service badges, plus the codex (weapons, power-ups, maps, modes).
import { Profile } from './profile.js';
import { WEAPONS, ICONS } from './weapons.js';
import { MODES } from './modes.js';
import { MEDAL_ICONS } from './hud.js';

const svgp = (d) => d;
// 24-unit single-stroke emblem glyphs
export const GLYPH = {
  chevron: 'M5 14l7-8 7 8M5 20l7-8 7 8',
  wings: 'M12 6v14M12 9C9 5 5 6 3 9c3 0 5 1 6 3-2-1-4-1-6 0 3 1 5 3 6 8M12 9c3-4 7-3 9 0-3 0-5 1-6 3 2-1 4-1 6 0-3 1-5 3-6 8',
  skull: MEDAL_ICONS.skull, crown: MEDAL_ICONS.crown, star: MEDAL_ICONS.star, shield: MEDAL_ICONS.shield, flame: MEDAL_ICONS.flame, blade: MEDAL_ICONS.blade,
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  bolt: 'M13 2L5 14h6l-1 8 8-12h-6z',
  hex: 'M12 3l8 4.500v9L12 21l-8-4.500v-9zM12 8l4 2.300v4.500L12 17l-4-2.300v-4.500z',
  spear: 'M4 20L18 6M15 4h5v5M7 17l-3 3',
  moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  snow: 'M12 2v20M4 7l16 10M20 7L4 17M9 4l3 2 3-2M9 20l3-2 3 2',
  orbit: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 12c0-4 4-7 9-7M21 12c0 4-4 7-9 7M6 18c-3-3 0-9 6-12M18 6c3 3 0 9-6 12',
  diamond: 'M12 2l7 10-7 10-5-10zM12 7l3 5-3 5-3-5z',
  target: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  fangs: 'M4 7c4 2 12 2 16 0M7 9l2 8 2-7M13 10l2 7 2-8',
  halo: 'M12 12a5 5 0 1 0 0 .01zM5 6c4-3 10-3 14 0M8 3c3-1.500 5-1.500 8 0',
  flag: MEDAL_ICONS.flag, perfect: MEDAL_ICONS.perfect, fist: MEDAL_ICONS.fist, crosshair: MEDAL_ICONS.crosshair, grenade: MEDAL_ICONS.grenade, rocket: MEDAL_ICONS.rocket,
};
export const glyphSvg = (id, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}"><path d="${GLYPH[id] || GLYPH.star}"/></svg>`;

// tier styles for emblem rings
export const TIER = [
  { id: 'common', name: 'COMMON', color: '#b8b8b2' }, { id: 'rare', name: 'RARE', color: '#6ab8ff' },
  { id: 'epic', name: 'EPIC', color: '#c58cff' }, { id: 'legend', name: 'LEGENDARY', color: '#ffd84a' },
];

export const HALOS = [
  { id: 'team', name: 'CLASSIC', color: 0xfff0c4, lvl: 1, price: 0, blurb: 'The warm-white ring every operator starts with.' },
  { id: 'ice', name: 'FROSTBITE', color: 0x9fe8ff, lvl: 4, price: 0, blurb: 'Cold cyan. Reads clean against snow.' },
  { id: 'gold', name: 'AUREOLE', color: 0xffc94a, lvl: 8, price: 0, blurb: 'Solid gold. Looks expensive because it is.' },
  { id: 'violet', name: 'NIGHT CHOIR', color: 0xc58cff, lvl: 12, price: 250, blurb: 'Violet ring for the late shift.' },
  { id: 'crimson', name: 'RED WATCH', color: 0xff4a58, lvl: 16, price: 400, blurb: 'Burns red. Enemies will notice.' },
  { id: 'mint', name: 'VERDANT', color: 0x5df2be, lvl: 20, price: 500, blurb: 'Mint glow with a soft trail.' },
  { id: 'solar', name: 'SOLAR FLARE', color: 0xff9a3c, lvl: 28, price: 800, blurb: 'Hot orange. Burns through fog.' },
  { id: 'void', name: 'THE VOID', color: 0xffffff, lvl: 38, price: 1500, blurb: 'Pure white. Nothing else in the room is this bright.' },
];

const E = (id, name, glyph, tier, lvl, price = 0, blurb = '') => ({ id, name, glyph, tier, lvl, price, blurb });
export const EMBLEMS = [
  E('chevron', 'VANGUARD', 'chevron', 0, 1), E('halo', 'HALOED', 'halo', 0, 1), E('target', 'SIGHTLINE', 'target', 0, 2),
  E('bolt', 'SURGE', 'bolt', 0, 4), E('snow', 'WHITEOUT', 'snow', 0, 6), E('shield', 'AEGIS', 'shield', 1, 8),
  E('blade', 'EDGE', 'blade', 1, 10, 150), E('eye', 'WATCHER', 'eye', 1, 12, 150), E('moon', 'LUNAR', 'moon', 1, 15, 200),
  E('hex', 'FORERUNNER', 'hex', 1, 18, 250), E('wings', 'WINGED', 'wings', 2, 20, 350), E('flame', 'EMBER', 'flame', 2, 24, 400),
  E('fangs', 'FANGS', 'fangs', 2, 27, 450), E('orbit', 'ORBITAL', 'orbit', 2, 30, 500), E('spear', 'LANCE', 'spear', 2, 33, 550),
  E('sun', 'SOLARIS', 'sun', 3, 36, 800), E('diamond', 'FACET', 'diamond', 3, 40, 900), E('skull', 'REAPER', 'skull', 3, 44, 1000),
  E('star', 'CONSTELLATION', 'star', 3, 47, 1200), E('crown', 'CROWNED', 'crown', 3, 50, 2000),
];

export const TITLES = [
  { id: 'rookie', text: 'ROOKIE', lvl: 1 }, { id: 'warden', text: 'WARDEN', lvl: 5 }, { id: 'walker', text: 'HALO WALKER', lvl: 10 },
  { id: 'nightshift', text: 'NIGHT SHIFT', lvl: 15 }, { id: 'frost', text: 'ANGEL OF FROST', lvl: 25 }, { id: 'legend', text: 'LOCKOUT LEGEND', lvl: 35 },
  { id: 'choir', text: 'SEVENTH CHOIR', lvl: 50 },
  { id: 'headhunter', text: 'HEADHUNTER', stat: 'headshots', n: 100, lvl: 1 }, { id: 'cleanhands', text: 'CLEAN HANDS', stat: 'perfects', n: 10, lvl: 1 },
  { id: 'flagrunner', text: 'FLAG RUNNER', stat: 'caps', n: 10, lvl: 1 }, { id: 'ballhog', text: 'BALL HOG', stat: 'ballTime', n: 600, lvl: 1 },
  { id: 'sharp', text: 'SHARPSHOOTER', stat: 'sniper', n: 100, lvl: 1 },
];

export const BADGES = [
  { id: 'contact', name: 'CONTACT', desc: 'Get your first kill.', stat: 'kills', n: 1, glyph: 'crosshair' },
  { id: 'hunter', name: 'HUNTER', desc: '100 kills.', stat: 'kills', n: 100, glyph: 'target' },
  { id: 'reaper', name: 'REAPER', desc: '1,000 kills.', stat: 'kills', n: 1000, glyph: 'skull' },
  { id: 'marksman', name: 'MARKSMAN', desc: '50 headshots.', stat: 'headshots', n: 50, glyph: 'eye' },
  { id: 'deadeye', name: 'DEADEYE', desc: '500 headshots.', stat: 'headshots', n: 500, glyph: 'crosshair' },
  { id: 'untouched', name: 'UNTOUCHED', desc: 'Earn a Perfect.', stat: 'perfects', n: 1, glyph: 'perfect' },
  { id: 'flawless', name: 'FLAWLESS', desc: '25 Perfects.', stat: 'perfects', n: 25, glyph: 'diamond' },
  { id: 'veteran', name: 'VETERAN', desc: 'Finish 10 matches.', stat: 'matches', n: 10, glyph: 'chevron' },
  { id: 'champion', name: 'CHAMPION', desc: 'Win 25 matches.', stat: 'wins', n: 25, glyph: 'crown' },
  { id: 'unbeaten', name: 'UNBEATEN', desc: 'Win 100 matches.', stat: 'wins', n: 100, glyph: 'star' },
  { id: 'runner', name: 'FLAG RUNNER', desc: 'Capture 5 flags.', stat: 'caps', n: 5, glyph: 'flag' },
  { id: 'carrier', name: 'BALL CARRIER', desc: 'Hold the ball for 300 seconds total.', stat: 'ballTime', n: 300, glyph: 'orbit' },
  { id: 'sniper', name: 'LONG GAME', desc: '50 sniper kills.', stat: 'sniper', n: 50, glyph: 'target' },
  { id: 'edge', name: 'EDGE OF THE BLADE', desc: '25 sword kills.', stat: 'sword', n: 25, glyph: 'blade' },
  { id: 'demo', name: 'DEMOLITION', desc: '25 grenade kills.', stat: 'grenade', n: 25, glyph: 'grenade' },
  { id: 'rampage', name: 'RUNNING RIOT', desc: 'Reach a 15 kill streak.', stat: 'streakBest', n: 15, glyph: 'flame' },
];

// ---- operators: base four are defined in rig.js; the rest unlock with level ----
export const OPERATOR_UNLOCK = { aoi: 1, kira: 1, nova: 3, yuna: 6, mira: 10, ivy: 14, hana: 20, zero: 28, eos: 40 };

// ---- codex ----
const W = WEAPONS;
export const WEAPON_INFO = {
  br: 'The workhorse. Three-round bursts, honest headshots, no tricks.',
  magnum: 'Sidearm with a mean streak. Two head hits finish a shielded target at range.',
  smg: 'Fast and forgiving up close. Loses every argument past twenty metres.',
  shotgun: 'Pellet spread that ends fights at corners. Falls off quickly with range.',
  sniper: 'Two-stage scope, one-shot headshots. Tower spawns.',
  rocket: 'Splash damage and a long reload. Lead your shots.',
  carbine: 'Precise single shots with a fast cycle. The plasma-era answer to the BR.',
  plasmarifle: 'Fast plasma stream that strips shields quickly.',
  needler: 'Homing needles. Seven stuck needles supercombine into a blast.',
  hammer: 'One swing, one kill. The knockback is a feature.',
  sword: 'Lunge across the room and finish it. Silent up close.',
};
export const POWER_INFO = [
  { id: 'overshield', name: 'OVERSHIELD', blurb: 'Adds a second shield layer for 30 seconds.', color: '#b28cff' },
  { id: 'camo', name: 'ACTIVE CAMO', blurb: 'Bends light around you. Hides you from radar. Sprinting flickers it.', color: '#7fe6ff' },
  { id: 'boost', name: 'DAMAGE BOOST', blurb: 'Double damage output for the duration.', color: '#ff8a3a' },
];
export const MEDAL_INFO = [
  ['PERFECT', 'Headshot finish, every shot landed, no damage taken.', 'perfect'], ['HEADSHOT', 'Kill with a headshot.', 'crosshair'], ['DOUBLE KILL', 'Two kills in quick succession.', 'burst'],
  ['KILLING SPREE', 'Five kills without dying.', 'flame'], ['SWORD KILL', 'Kill with the energy sword.', 'blade'], ['GRENADE KILL', 'Kill with a grenade.', 'grenade'],
  ['SNIPER KILL', 'Kill with the sniper rifle.', 'crosshair'], ['REVENGE', 'Kill the player who just killed you.', 'skull'], ['FLAG CAPTURE', 'Return the enemy flag to your base.', 'flag'],
  ['CARRIER KILL', 'Kill an enemy flag or ball carrier.', 'skull'],
];

// ---- rules ----
export const levelOf = () => Profile.level;
export const cats = () => [
  { id: 'operator', name: 'OPERATORS' }, { id: 'halo', name: 'HALOS' }, { id: 'emblem', name: 'EMBLEMS' }, { id: 'title', name: 'TITLES' },
  { id: 'weapons', name: 'WEAPONS' }, { id: 'power', name: 'POWER-UPS' }, { id: 'maps', name: 'MAPS' }, { id: 'modes', name: 'MODES' },
];
export function state(item) {
  const d = Profile.d, L = Profile.level;
  if (item.stat) { const v = d.stats[item.stat] || 0; return v >= item.n ? 'open' : 'locked'; }
  if (L < item.lvl) return 'locked';
  if (item.price && !Profile.owns(item.cat + ':' + item.id)) return 'buy';
  return 'open';
}
export function unlockText(item) {
  if (item.stat) return `${item.n} ${item.stat.replace(/([A-Z])/g, ' $1').toUpperCase()}  (${Math.min(item.n, Profile.d.stats[item.stat] || 0)}/${item.n})`;
  return `REACH LEVEL ${item.lvl}`;
}
export function newlyUnlocked(fromLevel, toLevel, operators) {
  const out = [];
  const tag = (list, cat, label) => list.forEach((i) => { if (!i.stat && i.lvl > fromLevel && i.lvl <= toLevel) out.push({ cat: label, name: i.name || i.text, glyph: i.glyph }); });
  tag(HALOS, 'halo', 'HALO'); tag(EMBLEMS, 'emblem', 'EMBLEM'); tag(TITLES, 'title', 'TITLE');
  for (const o of operators) { const l = OPERATOR_UNLOCK[o.id] || 1; if (l > fromLevel && l <= toLevel) out.push({ cat: 'OPERATOR', name: o.name }); }
  return out;
}
export function newBadges() {
  const got = [], d = Profile.d;
  for (const b of BADGES) { if (!d.badges[b.id] && (d.stats[b.stat] || 0) >= b.n) { d.badges[b.id] = 1; got.push(b); } }
  if (got.length) Profile.save();
  return got;
}
export const weaponStats = (id) => {
  const w = W[id], dps = w.melee ? null : Math.round((w.dmg * (w.pellets || 1) * (w.burst || 1)) / (w.cycle + (w.burst > 1 ? w.gap * (w.burst - 1) : 0)));
  return [['DAMAGE', w.melee ? (w.dmg >= 999 ? 'LETHAL' : w.dmg) : Math.round(w.dmg * (w.pellets || 1)) + (w.pellets ? ' x' + w.pellets : '')], ['HEADSHOT', w.head ? 'x' + w.head : '-'], ['MAGAZINE', w.melee ? '-' : w.mag], ['RESERVE', w.melee ? '-' : w.reserve], ['RANGE', w.range + ' M'], ['ZOOM', w.zoom ? w.zoom.map((z) => z + 'X').join(' / ') : '-'], ['DPS', dps ?? '-']];
};
export { ICONS, MODES, svgp };
