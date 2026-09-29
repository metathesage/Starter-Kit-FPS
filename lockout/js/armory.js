// Armory (browse + equip + shop) and Service Record (profile, stats, badges).
import * as THREE from 'three';
import { $ } from './util.js';
import { UI } from './ui.js';
import { Sound } from './audio.js';
import { WAIFUS } from './rig.js';
import { WEAPONS, ICONS } from './weapons.js';
import * as World from './world.js';
import { MODES } from './modes.js';
import { svg, MEDAL_ICONS } from './hud.js';
import { Profile, rankOf, xpToNext, MAX_LEVEL, rollCallsign } from './profile.js';
import * as C from './catalog.js';
import { Challenges } from './challenges.js';

const hex = (n) => '#' + new THREE.Color(n).getHexString();
const fmtN = (n) => Math.round(n).toLocaleString('en-US');

// small circular emblem badge
export function emblemHtml(id, size = 44) {
  const e = C.EMBLEMS.find((x) => x.id === id) || C.EMBLEMS[0], t = C.TIER[e.tier];
  return `<span class="emb" style="--tc:${t.color};width:${size}px;height:${size}px">${C.glyphSvg(e.glyph)}</span>`;
}
export const titleText = (id) => (C.TITLES.find((x) => x.id === id) || C.TITLES[0]).text;

let tab = 'operator', sel = 0, ctx = null;
const cols = () => Math.max(2, Math.floor(($('#armGrid').clientWidth || 700) / 150));

function items(cat) {
  const L = Profile.level;
  switch (cat) {
    case 'operator': return WAIFUS.map((w) => ({ cat, id: w.id, name: w.name, sub: w.role, lvl: C.OPERATOR_UNLOCK[w.id] || 1, price: 0, blurb: w.blurb, color: hex(w.hair), w }));
    case 'halo': return C.HALOS.map((h) => ({ ...h, cat, sub: h.price ? fmtN(h.price) + ' CR' : 'LEVEL ' + h.lvl, color: hex(h.color) }));
    case 'emblem': return C.EMBLEMS.map((e) => ({ ...e, cat, sub: C.TIER[e.tier].name, color: C.TIER[e.tier].color }));
    case 'title': return C.TITLES.map((t) => ({ ...t, cat, name: t.text, sub: t.stat ? 'ACHIEVEMENT' : 'LEVEL ' + t.lvl, price: 0, blurb: t.stat ? 'Earned by play: ' + C.unlockText(t) : 'Unlocks at level ' + t.lvl + '.' }));
    case 'weapons': return Object.values(WEAPONS).map((w) => ({ cat, id: w.id, name: w.short, sub: w.melee ? 'MELEE' : w.power >= 3 ? 'POWER' : 'STANDARD', state: 'info', blurb: C.WEAPON_INFO[w.id] || '', w }));
    case 'power': return C.POWER_INFO.map((p) => ({ cat, id: p.id, name: p.name, sub: 'POWER-UP', state: 'info', blurb: p.blurb, color: p.color }));
    case 'maps': return World.MAP_LIST.map((m) => ({ cat, id: m.id, name: m.name, sub: 'SYMMETRICAL', state: 'info', blurb: m.tag }));
    case 'modes': return Object.values(MODES).map((m) => ({ cat, id: m.id, name: m.name, sub: m.unit + ' TO ' + m.limits[1], state: 'info', blurb: m.blurb }));
    default: return [];
  }
  void L;
}
const stateOf = (it) => it.state || C.state({ ...it, cat: it.cat });
const isEq = (it) => Profile.d.eq[it.cat] === it.id;

function tileVisual(it) {
  switch (it.cat) {
    case 'operator': return `<i class="sw" style="--c:${it.color}"></i>`;
    case 'halo': return `<i class="hl" style="--c:${it.color}"></i>`;
    case 'emblem': return emblemHtml(it.id, 52);
    case 'title': return `<i class="tt">${C.glyphSvg('chevron')}</i>`;
    case 'weapons': return `<img class="wimg" alt="" src="models/weapons/thumb/${it.id}.webp" onerror="this.style.display='none'">`;
    case 'power': return `<span style="color:${it.color}">${svg(ICONS[it.id], 'wi')}</span>`;
    case 'maps': return `<i class="tt">${C.glyphSvg('hex')}</i>`;
    case 'modes': return `<i class="tt">${C.glyphSvg(it.id === 'ctf' ? 'flag' : it.id === 'oddball' ? 'orbit' : it.id === 'rumble' ? 'skull' : 'crosshair')}</i>`;
    default: return '';
  }
}

function render() {
  const list = items(tab), grid = $('#armGrid');
  sel = Math.max(0, Math.min(list.length - 1, sel));
  $('#armWallet').innerHTML = `<b>LVL ${Profile.level}</b><span>${rankOf(Profile.level)}</span><em>${fmtN(Profile.credits)} CR</em>`;
  $('#armTabs').innerHTML = C.cats().map((c) => `<button class="at${c.id === tab ? ' on' : ''}" data-t="${c.id}">${c.name}</button>`).join('');
  $('#armTabs').querySelectorAll('.at').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); setTab(b.dataset.t); Sound.play('menuMove', { vol: 0.6 }); }; });
  grid.innerHTML = '';
  list.forEach((it, i) => {
    const st = stateOf(it), d = document.createElement('button');
    d.className = `at-tile ${st}${i === sel ? ' sel' : ''}${isEq(it) ? ' eq' : ''}`; d.style.setProperty('--c', it.color || '#fff');
    d.innerHTML = `<div class="tv">${tileVisual(it)}</div><div class="tn">${it.name}</div><div class="ts">${st === 'locked' ? 'LOCKED' : st === 'buy' ? fmtN(it.price) + ' CR' : isEq(it) ? 'EQUIPPED' : it.sub}</div>${st === 'locked' ? '<svg class="lk" viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z"/></svg>' : ''}`;
    d.onclick = (e) => { e.stopPropagation(); if (sel === i) act(); else { sel = i; render(); Sound.play('menuMove', { vol: 0.6 }); } };
    grid.appendChild(d);
  });
  detail(list[sel]);
  if (list[sel]) preview(list[sel]);
}

function detail(it) {
  const box = $('#armDetail'); if (!it) { box.innerHTML = ''; return; }
  const st = stateOf(it);
  let body = `<p>${it.blurb || ''}</p>`;
  if (it.cat === 'weapons') body = `<img class="wbig" alt="" src="models/weapons/thumb/${it.id}.webp" onerror="this.remove()">` + body;
  if (it.cat === 'weapons') body += `<div class="stat-tbl">${C.weaponStats(it.id).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
  if (it.cat === 'modes') body += `<div class="stat-tbl"><div><span>LIMITS</span><b>${MODES[it.id].limits.join(' / ')} ${MODES[it.id].unit}</b></div><div><span>PLAYERS</span><b>${it.id === 'rumble' ? '8 FFA' : '4 v 4'}</b></div></div>`;
  let action = '', hint = '';
  if (st === 'open') { if (isEq(it)) { hint = 'EQUIPPED'; } else { action = 'EQUIP'; } }
  else if (st === 'buy') { action = Profile.credits >= it.price ? `BUY  ${fmtN(it.price)} CR` : `NEED ${fmtN(it.price)} CR`; }
  else if (st === 'locked') hint = C.unlockText(it);
  else if (st === 'info') hint = it.cat === 'maps' ? 'PICK IN DEPLOYMENT' : it.cat === 'modes' ? 'PICK IN DEPLOYMENT' : '';
  box.innerHTML = `<div class="ad-k">${it.sub || ''}</div><div class="ad-n">${it.name}</div>${body}<div class="ad-hint">${hint}</div>${action ? `<button class="btn primary ad-act"><span>${action}</span><i></i></button>` : ''}`;
  const b = box.querySelector('.ad-act'); if (b) b.onclick = (e) => { e.stopPropagation(); act(); };
}

function act() {
  const list = items(tab), it = list[sel]; if (!it) return;
  const st = stateOf(it);
  if (st === 'locked') { UI.toast(C.unlockText(it), 1800); Sound.play('menuBack', { vol: 0.6 }); return; }
  if (st === 'buy') {
    if (!Profile.spend(it.price)) { UI.toast('NOT ENOUGH CREDITS', 1600); Sound.play('menuBack', { vol: 0.6 }); return; }
    Profile.own(it.cat + ':' + it.id); UI.toast(it.name + ' UNLOCKED'); Sound.play('medal', { vol: 0.7 }); render(); return;
  }
  if (st === 'open' && !isEq(it) && ['operator', 'halo', 'emblem', 'title'].includes(it.cat)) {
    Profile.equip(it.cat, it.id); if (ctx.onEquip) ctx.onEquip(it.cat, it.id); UI.toast(it.name + ' EQUIPPED'); Sound.play('menuOk', { vol: 0.7 }); render();
  }
}

function preview(it) {
  if (!ctx || !ctx.preview) return;
  if (it.cat === 'operator') ctx.preview({ operator: it.id });
  else if (it.cat === 'halo') ctx.preview({ halo: it.id });
  else if (it.cat === 'weapons') ctx.preview({ weapon: it.id });
  else ctx.preview({ weapon: null });
}

function setTab(t) { tab = t; sel = 0; render(); }

export function showArmory(c) {
  ctx = c; if (!tab) tab = 'operator';
  const back = $('#btnArmBack');
  const exit = () => { if (ctx.preview) ctx.preview({ reset: true }); ctx.back(); };
  UI.button(back, exit);
  const tabsRow = document.createElement('div'); tabsRow.className = 'opt arm-tabsrow'; tabsRow.style.display = 'none';
  const tr = { _adj: (d) => { const ids = C.cats().map((x) => x.id); setTab(ids[(ids.indexOf(tab) + d + ids.length) % ids.length]); } };
  // rows: tabs (left/right), grid (left/right/up/down/confirm), back
  const tabsEl = $('#armTabs'), gridEl = $('#armGrid');
  tabsEl._adj = tr._adj; gridEl._adj = (d) => { sel = Math.max(0, Math.min(items(tab).length - 1, sel + d)); render(); };
  gridEl._vert = (d) => { const n = items(tab).length, ns = sel + d * cols(); if (ns < 0 || ns >= n) return false; sel = ns; render(); return true; };
  gridEl._act = () => act();
  render();
  UI.show('armory', { rows: [tabsEl, gridEl, back], onBack: exit, focus: 1 });
  gridEl.scrollTop = 0;
  void tabsRow;
}

// ---------------- Service Record ----------------
export function showRecord({ back, onChange }) {
  const d = Profile.d, s = d.stats, L = Profile.level, need = xpToNext(L);
  $('#recHead').innerHTML = `${emblemHtml(d.eq.emblem, 84)}<div class="rc-id"><div class="rc-tag">${Profile.callsign}</div><div class="rc-title">${titleText(d.eq.title)}</div><div class="rc-rank">${rankOf(L)} · LEVEL ${L}</div></div>`;
  $('#recXp').innerHTML = `<div class="xp-bar"><i style="width:${(L >= MAX_LEVEL ? 1 : d.xp / need) * 100}%"></i></div><div class="xp-n">${L >= MAX_LEVEL ? 'MAX LEVEL' : fmtN(d.xp) + ' / ' + fmtN(need) + ' XP'}<span>${fmtN(Profile.credits)} CR</span></div>`;
  const chs = Challenges.all();
  $('#recReset').textContent = 'RESET IN ' + Challenges.resetIn();
  $('#recCh').innerHTML = chs.map((c) => `<div class="ch${c.done ? ' done' : ''}${c.weekly ? ' wk' : ''}"><div class="ch-t"><em>${c.weekly ? 'WEEKLY' : 'DAILY'}</em><span>${c.text}</span><b>+${c.xp} XP</b></div><div class="xp-bar"><i style="width:${(c.prog / c.goal) * 100}%"></i></div><div class="ch-p">${c.done ? 'COMPLETE' : c.prog + ' / ' + c.goal}</div></div>`).join('');
  const kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2);
  const S = (k, v) => `<div class="rs"><b>${v}</b><span>${k}</span></div>`;
  $('#recStats').innerHTML = [S('KILLS', fmtN(s.kills)), S('DEATHS', fmtN(s.deaths)), S('K/D', kd), S('HEADSHOTS', fmtN(s.headshots)), S('PERFECTS', fmtN(s.perfects)), S('ASSISTS', fmtN(s.assists)), S('MATCHES', fmtN(s.matches)), S('WINS', fmtN(s.wins)), S('CAPTURES', fmtN(s.caps)), S('BEST STREAK', fmtN(s.streakBest))].join('');
  $('#recBadges').innerHTML = C.BADGES.map((b) => { const got = !!d.badges[b.id], v = Math.min(b.n, s[b.stat] || 0); return `<div class="bd${got ? ' got' : ''}" title="${b.desc}"><span class="emb" style="--tc:${got ? '#ffd84a' : '#5a5a56'}">${C.glyphSvg(b.glyph)}</span><b>${b.name}</b><em>${got ? 'EARNED' : v + ' / ' + b.n}</em></div>`; }).join('');
  const medals = Object.entries(d.medals).sort((a, b) => b[1] - a[1]).slice(0, 12);
  $('#recMedals').innerHTML = medals.length ? medals.map(([n, c]) => `<span class="rm">${svg(MEDAL_ICONS.star)}${n} x${c}</span>`).join('') : '<span class="rm" style="opacity:.5">NO MEDALS YET</span>';
  // callsign row
  const box = $('#recOpts'); box.innerHTML = '';
  const row = document.createElement('div'); row.className = 'opt';
  row.innerHTML = '<span class="lbl">Callsign</span><span class="val"><input class="join-input tag" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Callsign"><button class="roll" aria-label="Roll a new callsign"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 4v5h-5M4 20v-5h5"/></svg></button></span>';
  box.appendChild(row);
  const inp = row.querySelector('input'); inp.value = Profile.callsign;
  const commit = () => { inp.value = Profile.setCallsign(inp.value); $('#recHead .rc-tag').textContent = Profile.callsign; if (onChange) onChange(); };
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); commit(); inp.blur(); } });
  inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9_ ]/g, ''); });
  inp.addEventListener('blur', commit);
  const roll = () => { inp.value = Profile.setCallsign(rollCallsign()); $('#recHead .rc-tag').textContent = Profile.callsign; if (onChange) onChange(); };
  row.querySelector('.roll').onclick = (e) => { e.stopPropagation(); roll(); };
  row._act = roll; row.onclick = () => inp.focus();
  const b = $('#btnRecBack'); UI.button(b, back);
  UI.show('record', { rows: [row, b], onBack: back, focus: 0 });
}
