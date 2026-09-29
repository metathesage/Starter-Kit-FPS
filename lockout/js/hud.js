// HUD: shield/health, grenades, ammo, radar, reticle, medals, feed, scoreboard, death cam text.
import { ICONS, WEAPONS } from './weapons.js';
import { TEAM } from './rig.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { clamp, angDiff, TAU } from './util.js';
import { MODES } from './modes.js';
import { MAP, MAP_LIST } from './world.js';
import { Profile } from './profile.js';

export const svg = (d, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}"><path d="${d}"/></svg>`;
export const MEDAL_ICONS = {
  star: 'M12 2l3 7 7 .8-5.3 4.8 1.6 7.4L12 18l-6.3 4 1.6-7.4L2 9.8 9 9z',
  burst: 'M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4',
  crosshair: 'M12 3v5M12 16v5M3 12h5M16 12h5M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  blade: 'M5 19L19 5M14 5h5v5M5 19l3-1-2-2z',
  fist: 'M7 11V7h3v3h2V6h3v4h2V8h2v7c0 3-2 5-5 5h-3c-3 0-4-2-4-5z',
  grenade: ICONS.frag, rocket: ICONS.rocket,
  skull: 'M12 3a7 7 0 0 0-7 7c0 3 1 4 3 5v4h8v-4c2-1 3-2 3-5a7 7 0 0 0-7-7zM9 11h2M13 11h2',
  flame: 'M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z',
  perfect: 'M12 2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 15.400 6.800 18.200l1-5.900L3.500 8.200l5.900-.8zM7 21h10',
  flag: 'M6 21V3M6 4h11l-2.500 4L17 12H6',
  shield: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z',
  crown: 'M3 8l4.500 4L12 5l4.500 7L21 8l-2 11H5z',
};
const WEAPON_ICON = { br: ICONS.br, magnum: ICONS.magnum, smg: ICONS.smg, shotgun: ICONS.shotgun, sniper: ICONS.sniper, rocket: ICONS.rocket, sword: ICONS.sword, carbine: ICONS.carbine, plasmarifle: ICONS.plasmarifle, needler: ICONS.needler, hammer: ICONS.hammer, frag: ICONS.frag, plasma: ICONS.plasma, melee: MEDAL_ICONS.fist, explosion: ICONS.frag, fall: ICONS.skull, nova: ICONS.nova };
export const wIcon = (id) => svg(WEAPON_ICON[id] || MEDAL_ICONS.skull);

export function glyph(action) {
  const g = Input.glyph(action);
  if (Input.last === 'pad') {
    const cls = ['A', 'B', 'X', 'Y'].includes(g) ? g : 'wide';
    return `<span class="glyph pad ${cls}">${g}</span>`;
  }
  return `<span class="glyph">${g}</span>`;
}

const RETICLES = {
  br: '<g class="tk"><path d="M0-12V-26M0 12V26M-12 0H-26M12 0H26"/></g><circle r="1.8" fill="currentColor" stroke="none"/><path d="M-9 34Q0 40 9 34" stroke-width="1.4"/>',
  dot: '<g class="tk"><path d="M0-10V-18M0 10V18M-10 0H-18M10 0H18"/></g><circle r="2" fill="currentColor" stroke="none"/>',
  ring: '<g class="tk"><circle r="20" stroke-dasharray="14 8" stroke-width="1.8"/></g><circle r="1.6" fill="currentColor" stroke="none"/>',
  none: '',
};

export class HUD {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="h-over"></div><div class="h-novaw"><b>NOVA INCOMING</b><span></span></div><div class="h-warn"></div><div class="h-flash"></div><div class="h-dmg"></div><div class="h-scope"><i class="sb t"></i><i class="sb b"></i><i class="sh"></i><i class="sv"></i><i class="sv2"></i><div class="zt"></div><div class="rg"><small>RANGE</small><b>---</b></div><div class="am"><small>ROUNDS</small><b>4</b></div><div class="rc"></div></div>
      <div class="h-markers"></div>
      <div class="h-top">
        <div class="compass"><div class="cmp-track"></div><b class="cmp-hd">000</b><i class="cmp-tick"></i></div>
        <div class="trap"><div class="trap-in"><div class="sh-ghost"></div><div class="sh-fill"></div><div class="sh-over"></div></div></div>
        <div class="hp-row"></div>
        <div class="pu-row"></div>
      </div>
      <div class="h-weapon">
        <div class="wp-top"><div class="wp-icon"></div><div class="wp-mag">36</div><div class="wp-res">/ 144</div></div>
        <div class="wp-name"></div><div class="wp-reload"></div>
        <div class="gr-row"><div class="gr frag on">${svg(ICONS.frag)}<b>2</b></div><div class="gr plasma">${svg(ICONS.plasma)}<b>2</b></div></div>
      </div>
      <div class="h-abil">
        <div class="ab nova"><svg class="ring" viewBox="0 0 64 64"><circle class="tr" cx="32" cy="32" r="28"/><circle class="pg" cx="32" cy="32" r="28" pathLength="100"/></svg>${svg(ICONS.nova, 'ic')}<span class="kd"></span><b class="pct">0%</b><em>NOVA BOMB</em></div>
        <div class="ab blink">${svg(ICONS.blink, 'ic')}<span class="kd"></span><div class="pips"><i></i><i></i></div><em>BLINK</em></div>
      </div>
      <div class="feed"></div>
      <div class="h-radar"><div class="rd-tilt"><canvas width="360" height="360"></canvas></div><div class="rd-place">LOCKOUT</div></div>
      <div class="h-score">
        <div class="sc-meta"><span class="sc-mode">TEAM SLAYER</span><span class="sc-clock">12:00</span></div>
        <div class="sc-row red"><i class="sq"></i><em class="sc-nm">RED</em><div class="sc-bar"><i></i></div><div class="sc-n">0</div></div>
        <div class="sc-row blue"><i class="sq"></i><em class="sc-nm">BLUE</em><div class="sc-bar"><i></i></div><div class="sc-n">0</div></div>
        <div class="h-obj"></div><div class="sc-lead"></div>
      </div>
      <div class="h-reticle"><svg viewBox="-40 -40 80 80"></svg></div>
      <div class="h-hit"><svg viewBox="-20 -20 40 40"><path d="M-14-14L-6-6M14-14L6-6M-14 14L-6 6M14 14L6 6"/></svg></div>
      <div class="h-announce"></div><div class="h-count"></div><div class="h-mode"></div>
      <div class="h-elim"></div><div class="h-skull"></div><div class="h-tut"></div>
      <div class="h-medals"></div><div class="h-prompt"></div>
      <div class="h-cam"></div>
      <div class="h-death"><div class="dd"><div class="k">ELIMINATED BY</div><div class="nm"></div><div class="rs"></div></div></div>
      <div class="h-board"></div><div class="h-fps"></div>`;
    // compass strip: ticks every 5 degrees across three turns so it wraps
    const cmp = root.querySelector('.cmp-track'); let ch = '';
    const CARD = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    for (let d = -360; d <= 720; d += 5) {
      const dd = ((d % 360) + 360) % 360, major = dd % 15 === 0;
      ch += `<i class="${major ? 'mj' : ''}" style="left:${(d + 360) * 3}px">${CARD[dd] ? `<b class="cd">${CARD[dd]}</b>` : dd % 30 === 0 ? `<b>${dd}</b>` : ''}</i>`;
    }
    cmp.innerHTML = ch;
    const q = (s) => root.querySelector(s);
    this.el = { fill: q('.sh-fill'), ghost: q('.sh-ghost'), over: q('.sh-over'), hp: q('.hp-row'), frag: q('.gr.frag'), plasma: q('.gr.plasma'),
      sc: { blue: q('.sc-row.blue'), red: q('.sc-row.red') }, clock: q('.sc-clock'), mode: q('.sc-mode'), feed: q('.feed'), radar: q('.h-radar canvas'),
      wIcon: q('.wp-icon'), wName: q('.wp-name'), wMag: q('.wp-mag'), wRes: q('.wp-res'), wRel: q('.wp-reload'), ret: q('.h-reticle'), retSvg: q('.h-reticle svg'),
      hit: q('.h-hit'), ann: q('.h-announce'), count: q('.h-count'), modeBig: q('.h-mode'), medals: q('.h-medals'), prompt: q('.h-prompt'), cam: q('.h-cam'),
      death: q('.h-death'), dName: q('.dd .nm'), dRes: q('.dd .rs'), board: q('.h-board'), fps: q('.h-fps'), flash: q('.h-flash'), dmg: q('.h-dmg'), scope: q('.h-scope'), zt: q('.h-scope .zt'), rg: q('.h-scope .rg b'), am: q('.h-scope .am b'),
      tut: q('.h-tut'), obj: q('.h-obj'), lead: q('.sc-lead'), elim: q('.h-elim'), skull: q('.h-skull'), pu: q('.pu-row'), cmpTrack: cmp, cmpHd: q('.cmp-hd'), markers: q('.h-markers'), weaponBox: q('.h-weapon'), abil: q('.h-abil'), novaw: q('.h-novaw'), novawD: q('.h-novaw span'), novaBox: q('.ab.nova'), novaPg: q('.ab.nova .pg'), novaPct: q('.ab.nova .pct'), novaKd: q('.ab.nova .kd'), blinkKd: q('.ab.blink .kd'), pips: root.querySelectorAll('.ab.blink .pips i'), grRow: q('.gr-row') };
    this.el.hp.innerHTML = '<i></i>'.repeat(5);
    this.rctx = this.el.radar.getContext('2d');
    this.ghost = 1; this.retId = null; this.alarmT = 0; this.subs = [];
    this.lastAnn = 0;
  }

  bind(match) {
    this.unbind();
    this.match = match; this.p = match.player;
    document.body.style.setProperty('--team', TEAM[this.p.team].css);
    const B = (e, f) => this.subs.push(match.bus.on(e, f));
    B('hit', (a, v, head, dead) => {
      if (a !== this.p) return;
      const h = this.el.hit; h.classList.remove('on', 'head', 'kill'); void h.offsetWidth;
      h.innerHTML = head ? svg(ICONS.skull) : '<svg viewBox="-20 -20 40 40"><path d="M-14-14L-6-6M14-14L6-6M-14 14L-6 6M14 14L6 6"/></svg>';
      h.classList.add('on'); if (head) h.classList.add('head'); if (dead) h.classList.add('kill');
      Sound.play(head ? 'headshot' : 'hit', { vol: 0.8 });
    });
    B('hurt', (v, a, amt, src) => {
      if (v !== this.p) return;
      const f = this.el.flash; f.classList.remove('on', 'hurt'); void f.offsetWidth; if (v.shield <= 0) f.classList.add('hurt'); f.classList.add('on');
      if (src && src.x !== undefined) {
        const yaw = Math.atan2(-(src.x - v.x), -(src.z - v.z)), rel = angDiff(this.camYaw ?? v.yaw, yaw);
        const d = document.createElement('div'); d.className = 'dmg-arc'; d.style.transform = `rotate(${-rel}rad)`; d.innerHTML = '<i></i>';
        this.el.dmg.appendChild(d); setTimeout(() => d.remove(), 1000);
      }
      Input.rumble(0.6, 0.8, 140);
    });
    B('kill', (r) => { this.feed(r); if (r.killer === this.p && !r.suicide) this.elim(r); });
    B('medal', (a, name, icon) => { if (a === this.p) this.medal(name, icon); });
    B('announce', (t, team) => this.announce(t, team));
    B('count', (n) => { const c = this.el.count; c.textContent = n > 0 ? n : 'GO'; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); if (n === 3) this.modeIntro(); });
    B('shot', (a) => { if (a === this.p) Input.rumble(0.25, 0.5, 60); });
    B('explosion', (pos, R) => { const d = Math.hypot(this.p.x - pos.x, this.p.z - pos.z); if (d < R * 2.5) Input.rumble(1, 0.7, 260); });
    this.el.feed.innerHTML = ''; this.el.medals.innerHTML = '';
    this.el.sc.blue.querySelector('.sc-n').textContent = '0'; this.el.sc.red.querySelector('.sc-n').textContent = '0';
    const md = MODES[match.mode], ffa = match.ffa;
    // two score rows: your side / the other side (team modes keep RED + BLUE, rumble shows you vs the leading rival)
    this.rowA = ffa ? 'blue' : this.p.team; this.rowB = ffa ? 'red' : this.p.team === 'red' ? 'blue' : 'red';
    this.el.sc.blue.classList.toggle('mine', this.rowA === 'blue'); this.el.sc.red.classList.toggle('mine', this.rowA === 'red');
    this.el.mode.textContent = md.short + ' · ' + match.limit;
    const rp = this.root.querySelector('.rd-place'); if (rp && MAP) rp.textContent = (MAP_LIST.find((x) => x.id === MAP.id) || { name: '' }).name;
    this.el.sc.red.querySelector('.sc-nm').textContent = TEAM.red.name; this.el.sc.blue.querySelector('.sc-nm').textContent = TEAM.blue.name;
    this.el.obj.innerHTML = ''; this.objKey = '';
    this.tut = !Profile.d.seen.tutorial;
    if (this.tut) {
      const wl2 = this.p.cls === 'warlock';
      const rows = [['fire', 'FIRE'], ['zoom', 'ZOOM'], ['jump', wl2 ? 'JUMP / HOLD TO GLIDE' : 'JUMP'], wl2 ? ['blink', 'BLINK'] : ['grenade', 'GRENADE'], ...(wl2 ? [['nova', 'NOVA BOMB']] : []), ['melee', 'MELEE'], ['reload', 'RELOAD'], ['swap', 'SWAP WEAPON'], ['score', 'SCOREBOARD']];
      this.el.tut.innerHTML = `<div class="tt-h">FIELD MANUAL</div>${rows.map(([a, t]) => `<div class="tt-r">${glyph(a)}<span>${t}</span></div>`).join('')}<div class="tt-f">Kill to score. Break line of sight to recharge shields.</div>`;
      this.el.tut.classList.add('on');
    } else this.el.tut.classList.remove('on');
    this.mk = new Map();
  }
  unbind() { this.subs.forEach((u) => u()); this.subs = []; document.body.classList.remove('is-warlock'); }

  modeIntro() {
    const md = MODES[this.match.mode], m = this.el.modeBig;
    const vn = { lowgrav: 'LOW GRAVITY', fiesta: 'FIESTA', snipers: 'SNIPERS', swords: 'SWORDS + MAGNUMS' }[this.match.variant];
    m.innerHTML = `${vn ? vn + ' · ' : ''}${md.name}<br><span style="color:var(--gold)">FIRST TO ${this.match.limit} ${md.unit}</span>`; m.classList.remove('on'); void m.offsetWidth; m.classList.add('on');
  }

  announce(text, team) {
    if (text) Sound.say(text);
    const a = this.el.ann; a.style.color = team ? TEAM[team].css : '#fff'; a.innerHTML = text; a.classList.remove('on'); void a.offsetWidth; a.classList.add('on');
  }

  medal(name, icon) {
    const d = document.createElement('div'); d.className = 'medal' + (name === 'PERFECT' ? ' perfect' : ''); d.innerHTML = svg(MEDAL_ICONS[icon] || MEDAL_ICONS.star) + `<span>${name}</span>`;
    this.el.medals.appendChild(d); Sound.play('medal', { vol: 0.8 }); Sound.say(name); setTimeout(() => d.remove(), 2950);
    while (this.el.medals.children.length > 3) this.el.medals.firstChild.remove();
  }

  feed(r) {
    const d = document.createElement('div');
    const mine = r.killer === this.p || r.victim === this.p;
    d.className = 'feed-item' + (mine ? ' me' : '');
    d.style.setProperty('--tc', TEAM[(r.killer || r.victim).team].css);
    const nm = (a) => `<span style="color:${TEAM[a.team].css}">${a.name}</span>`;
    if (r.suicide) d.innerHTML = `${nm(r.victim)}${svg(MEDAL_ICONS.skull)}`;
    else d.innerHTML = `${nm(r.killer)}${wIcon(r.kind === 'punch' ? 'melee' : r.weapon)}${r.perfect ? svg(MEDAL_ICONS.perfect, 'pf') : ''}${r.head ? svg(ICONS.skull, 'sk') : ''}${nm(r.victim)}`;
    this.el.feed.appendChild(d); setTimeout(() => d.remove(), 5600);
    while (this.el.feed.children.length > 5) this.el.feed.firstChild.remove();
  }

  // noir elimination banner + headshot skull
  elim(r) {
    const e = this.el.elim, w = WEAPONS[r.weapon];
    const sub = [w ? w.short : r.weapon === 'nova' ? 'NOVA BOMB' : r.kind === 'punch' ? 'MELEE' : 'GRENADE', r.perfect ? 'PERFECT' : '', r.head ? 'HEADSHOT' : '', this.p.streak > 1 ? `STREAK ${this.p.streak}` : ''].filter(Boolean).join('  /  ');
    e.innerHTML = `<div class="eb"><div class="eb-line"></div><div class="eb-k">ELIMINATED</div><div class="eb-n">${wIcon(r.kind === 'punch' ? 'melee' : r.weapon)}<span>${r.victim.name}</span>${r.head ? svg(ICONS.skull, 'sk') : ''}</div><div class="eb-m">${sub}</div><div class="eb-line"></div></div>`;
    e.classList.remove('on'); void e.offsetWidth; e.classList.add('on');
    if (r.head) { const k = this.el.skull; k.innerHTML = svg(ICONS.skull); k.classList.remove('on'); void k.offsetWidth; k.classList.add('on'); }
  }

  showBoard(on) {
    const b = this.el.board;
    if (!on) { b.classList.remove('on'); this.boardT = 0; return; }
    if (this.boardT > performance.now() - 250) return;
    this.boardT = performance.now();
    const m = this.match, crown = (a) => (m.leader === a ? svg(MEDAL_ICONS.crown, 'cr') : '');
    const row = (a) => `<tr class="${a.team}${a === this.p ? ' me' : ''}${a.alive ? '' : ' dead'}" style="--tc:${TEAM[a.team].css}"><td class="nm">${crown(a)}${a.name}${a.carry ? svg(MEDAL_ICONS[a.carry === 'flag' ? 'flag' : 'star'], 'cr') : ''}</td><td>${a.kills}</td><td>${a.assists}</td><td>${a.deaths}</td><td>${a.streak}</td></tr>`;
    const head = '<tr><th>OPERATOR</th><th>KILLS</th><th>AST</th><th>DEATHS</th><th>STREAK</th></tr>';
    if (m.ffa) { b.innerHTML = `<h4 class="ffa">${MODES.rumble.name}</h4><table class="tbl">${head}${m.ranking().map(row).join('')}</table>`; }
    else {
      const order = m.score.blue >= m.score.red ? ['blue', 'red'] : ['red', 'blue'];
      const fmt = (v) => (m.mode === 'oddball' ? Math.floor(v) : v);
      b.innerHTML = order.map((t) => `<h4 class="${t}">${TEAM[t].name} TEAM — ${fmt(m.score[t])}</h4><table class="tbl">${head}${m.ranking().filter((a) => a.team === t).map(row).join('')}</table>`).join('');
    }
    b.classList.add('on');
  }

  update(dt, ctx) {
    const { match: m, player: p } = ctx; this.camYaw = ctx.camYaw;
    if (this.tut && m.time > 18) { this.tut = false; this.el.tut.classList.remove('on'); Profile.d.seen.tutorial = 1; Profile.save(); }
    const E = this.el;
    // shield + health
    const tot = 100, sh = clamp(p.shield / tot, 0, 1), ov = clamp((p.shield - tot) / 200, 0, 1);
    E.fill.style.width = sh * 100 + '%'; E.ghost.style.width = sh * 100 + '%';
    E.over.style.width = ov * 100 + '%'; E.over.style.opacity = p.over > 0 ? 1 : 0;
    const hd = (((-(ctx.camYaw ?? p.yaw) * 180) / Math.PI) % 360 + 360) % 360;
    E.cmpTrack.style.transform = `translateX(${-(hd + 360) * 3}px)`; E.cmpHd.textContent = String(Math.round(hd) % 360).padStart(3, '0');
    const hpOn = Math.ceil((clamp(p.health, 0, 45) / 45) * 5);
    [...E.hp.children].forEach((c, i) => c.classList.toggle('on', i < hpOn));
    const low = p.alive && p.shield <= 0.5;
    document.body.classList.toggle('low-shield', low);
    document.body.classList.toggle('overshield', p.alive && p.over > 0);
    if (low) { this.alarmT -= dt; if (this.alarmT <= 0) { Sound.play('alarm', { vol: 0.7 }); this.alarmT = 0.85; } }
    // active power-ups
    const pus = [];
    if (p.alive && p.over > 0 && p.overT > 0) pus.push(['overshield', p.overT]);
    if (p.alive && p.camoT > 0) pus.push(['camo', p.camoT]);
    if (p.alive && p.boostT > 0) pus.push(['boost', p.boostT]);
    const puKey = pus.map((x) => x[0] + Math.ceil(x[1])).join();
    if (puKey !== this.puKey) { this.puKey = puKey; E.pu.innerHTML = pus.map(([id, t]) => `<div class="pu">${svg(ICONS[id])}<span>${Math.ceil(t)}</span></div>`).join(''); }
    // grenades
    E.frag.querySelector('b').textContent = p.gren.frag; E.plasma.querySelector('b').textContent = p.gren.plasma;
    E.frag.classList.toggle('on', p.gtype === 'frag'); E.plasma.classList.toggle('on', p.gtype === 'plasma');
    // score
    {
      let va, vb, na, nb;
      if (m.ffa) {
        let top = null; for (const o of m.actors) if (o !== p && (!top || m.score[o.team] > m.score[top.team])) top = o;
        va = m.score[p.team]; vb = top ? m.score[top.team] : 0; na = 'YOU'; nb = top ? top.name : '-';
      } else { va = m.score[this.rowA]; vb = m.score[this.rowB]; na = TEAM[this.rowA].name; nb = TEAM[this.rowB].name; }
      const fmt = (v) => (m.mode === 'oddball' ? Math.floor(v) : v);
      for (const [key, v, n] of [[this.rowA, va, na], [this.rowB, vb, nb]]) {
        const r = E.sc[m.ffa ? (key === this.rowA ? 'blue' : 'red') : key];
        r.querySelector('.sc-n').textContent = fmt(v); r.querySelector('.sc-nm').textContent = n;
        r.querySelector('.sc-bar i').style.width = clamp((v / m.limit) * 100, 0, 100) + '%';
      }
      if (m.ffa) { E.sc.blue.style.setProperty('--tc', TEAM[p.team].css); E.sc.red.style.setProperty('--tc', '#ff4a58'); }
      // kill leader line + objective status
      const ld = m.leader; const lk = ld ? ld.id + ':' + ld.kills : '';
      if (lk !== this.lk) { this.lk = lk; E.lead.innerHTML = ld ? `${svg(MEDAL_ICONS.crown)}<span>${ld.isPlayer ? 'YOU LEAD' : ld.name}</span><b>${ld.kills}</b>` : ''; E.lead.classList.toggle('on', !!ld); }
      if (m.obj) { const st = m.obj.status(p); if (st !== this.objKey) { this.objKey = st; E.obj.innerHTML = st; } }
    }
    const s = Math.ceil(m.clock); E.clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    // weapon
    const w = p.weapon, def = p.def;
    if (w) {
      const key = w.id + (p.weapons[1 - p.cur] ? p.weapons[1 - p.cur].id : '');
      if (this.wKey !== key) {
        this.wKey = key;
        const sil = (id, cls) => `<img class="wsil ${cls}" alt="" src="models/weapons/thumb/${id}.webp" onerror="this.outerHTML=''">`;
        E.wIcon.innerHTML = sil(w.id, '') + (p.weapons.length > 1 ? sil(p.weapons[1 - p.cur].id, 'sec') : '');
        E.wName.textContent = def.short;
      }
      const melee = def.melee;
      E.wMag.textContent = melee ? '' : w.mag; E.wRes.textContent = melee ? 'ENERGY' : '/ ' + w.res;
      E.wMag.classList.toggle('low', !melee && w.mag <= Math.max(1, def.mag * 0.25));
      E.wRel.textContent = p.reloadT > 0 ? 'RELOADING' : (!melee && w.mag === 0 && w.res === 0 ? 'NO AMMO' : (!melee && w.mag <= def.mag * 0.25 && w.res > 0 ? `${glyphText('reload')} RELOAD` : ''));
    }
    E.weaponBox.style.display = p.alive ? '' : 'none';
    {
      let nd = 1e9; const pr = m.replica ? [...m.rp.values()].filter((r) => r.type === 'nova').map((r) => ({ x: r.mesh.position.x, y: r.mesh.position.y, z: r.mesh.position.z })) : m.projs.filter((q) => q.alive && q.type === 'nova' && m.foe(q.owner, p));
      for (const q of pr) nd = Math.min(nd, Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z));
      const on = p.alive && nd < 36;
      E.novaw.classList.toggle('on', on);
      if (on) {
        E.novawD.textContent = Math.round(nd) + ' M'; E.novaw.style.setProperty('--u', clamp(1 - nd / 36, 0, 1));
        this.nwT = (this.nwT || 0) - dt; if (this.nwT <= 0) { this.nwT = clamp(nd / 45, 0.16, 0.6); Sound.play('alarm', { vol: 0.35 }); }
      }
    }
    const wl = p.cls === 'warlock';
    document.body.classList.toggle('is-warlock', wl);
    E.grRow.style.display = wl ? 'none' : '';
    E.abil.style.display = wl && p.alive ? '' : 'none';
    if (wl && p.alive) {
      const pct = Math.floor(p.sup * 100);
      E.novaPg.style.strokeDashoffset = 100 - pct;
      E.novaBox.classList.toggle('ready', p.sup >= 1); E.novaBox.classList.toggle('cast', p.novaT > 0);
      E.novaPct.textContent = p.novaT > 0 ? 'CASTING' : p.sup >= 1 ? 'READY' : pct + '%';
      const kn = Input.last + glyphText('nova'); if (this.kn !== kn) { this.kn = kn; E.novaKd.textContent = glyphText('nova'); E.blinkKd.textContent = glyphText('blink'); }
      E.pips.forEach((el, i) => { const full = p.blinkCh > i, part = p.blinkCh === i ? Math.min(1, p.blinkT / 3.6) : 0; el.style.setProperty('--f', full ? 1 : part); el.classList.toggle('full', full); });
    }
    // reticle
    const retId = def ? def.ret : 'none';
    const zoomScope = p.alive && def && def.id === 'sniper' && p.zoomLevel > 0;
    if (retId !== this.retId) { this.retId = retId; E.retSvg.innerHTML = RETICLES[retId] || ''; E.ret.classList.toggle('none', retId === 'none'); }
    E.ret.style.display = p.alive && !zoomScope && !m.thirdPerson ? '' : 'none';
    E.ret.classList.toggle('enemy', !!ctx.aimEnemy);
    const tk = E.retSvg.querySelector('.tk');
    if (tk && def) { const sp = (def.spread + p.bloom + (p.lastMoveSpeed / 5.4) * def.spread * 0.6) * 22; tk.style.transform = `scale(${1 + clamp(sp, 0, 1.2)})`; }
    E.scope.classList.toggle('on', zoomScope);
    if (zoomScope) {
      E.zt.textContent = def.zoom[p.zoomLevel - 1] + 'X'; E.am.textContent = w ? w.mag : 0;
      const t = ctx.aimEnemy; E.rg.textContent = t ? Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z).toFixed(0) + ' M' : '---';
      E.scope.classList.toggle('lock', !!t);
    }
    // prompt
    let prompt = '';
    if (p.alive && m.state === 'live') {
      const pk = m.nearestPickup(p, 1.9);
      if (pk && !pk.isPower) {
        const d2 = WEAPONS[pk.id], has = p.weapons.some((x) => x.id === pk.id);
        prompt = has ? '' : `${glyph('use')}<span>${p.weapons.length < 2 ? 'PICK UP' : 'SWAP FOR'} ${d2.short}</span>`;
      }
    }
    E.prompt.innerHTML = prompt; E.prompt.classList.toggle('on', !!prompt);
    // camera hint
    E.cam.innerHTML = `${glyph('cam')}<span>${m.thirdPerson ? 'FIRST PERSON' : 'CHASE CAM'}</span>`;
    E.cam.style.display = Input.last === 'pad' || Input.last === 'touch' ? 'none' : '';
    // death
    if (!p.alive && m.state !== 'countdown') {
      E.death.classList.add('on');
      const killer = m.lastKillRec && m.lastKillRec.victim === p ? m.lastKillRec.killer : null;
      E.dName.textContent = killer ? killer.name : 'YOUR OWN HAND';
      E.dName.style.color = killer ? TEAM[killer.team].css : '#fff';
      E.dRes.textContent = m.state === 'live' ? `REDEPLOY IN ${Math.max(0, Math.ceil(p.respawnAt - m.time))}` : '';
    } else E.death.classList.remove('on');
    this.radar(m, p);
    this.markers(ctx);
  }

  // teammate nameplates + power-weapon callouts, projected to screen
  markers(ctx) {
    const { match: m, player: p, camera: cam } = ctx; if (!cam) return;
    const box = this.el.markers, live = new Set();
    const W = innerWidth, H = innerHeight, v = this._v || (this._v = new cam.position.constructor());
    const placed = [];
    const put = (key, x, y, z, html, cls, fade) => {
      v.set(x, y, z).project(cam);
      if (cls === 'pick') { const sx = ((v.x + 1) / 2) * W, sy = ((1 - v.y) / 2) * H; if (placed.some(([px, py]) => Math.abs(px - sx) < 90 && Math.abs(py - sy) < 22)) { const e0 = this.mk.get(key); if (e0) e0.style.display = 'none'; live.add(key); return; } placed.push([sx, sy]); }
      let el = this.mk.get(key);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { if (el) el.style.display = 'none'; live.add(key); return; }
      if (!el) { el = document.createElement('div'); el.className = 'mk ' + cls; el.innerHTML = html; box.appendChild(el); this.mk.set(key, el); }
      el.style.display = ''; el.style.opacity = fade;
      el.style.transform = `translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px)`; live.add(key);
    };
    if (m.obj) for (const o of m.obj.markers()) put(o.key, o.x, o.y, o.z, o.html, o.cls + (o.team ? ' t-' + o.team : ''), 1);
    if (m.leader && m.leader !== p && m.leader.alive && !m.obj) { const l = m.leader; put('leader', l.x, l.y + l.h + 0.95, l.z, `${svg(MEDAL_ICONS.crown)}<span>LEADER</span>`, 'leadm', 1); }
    if (p.alive && !m.thirdPerson) {
      for (const o of m.actors) {
        if (o === p || !o.alive || o.team !== p.team) continue;
        const d = Math.hypot(o.x - p.x, o.z - p.z);
        put('a' + o.id, o.x, o.y + o.h + 0.45, o.z, `<i></i><span>${o.name}</span>`, 'ally', d > 55 ? 0.4 : 1);
      }
      for (const [i, pk] of m.pickups.entries()) {
        if (!pk.active || pk.isPower === undefined) continue;
        const def = pk.isPower ? null : WEAPONS[pk.id];
        if (!pk.isPower && (!def || def.power < 3)) continue;
        const d = Math.hypot(pk.mesh.position.x - p.x, pk.mesh.position.z - p.z);
        if (d > 45) continue;
        put('p' + i + pk.id, pk.mesh.position.x, pk.mesh.position.y + 1.7, pk.mesh.position.z, `<i></i><span>${pk.isPower ? { overshield: 'OVERSHIELD', camo: 'ACTIVE CAMO', boost: 'DAMAGE BOOST' }[pk.id] : def.short}</span>`, 'pick', clamp(1.3 - d / 45, 0.35, 1));
      }
    }
    for (const [k, el] of this.mk) if (!live.has(k)) { el.remove(); this.mk.delete(k); }
  }

  radar(m, p) {
    const c = this.rctx, W = 360, R = 160, cx = W / 2, range = 26;
    c.clearRect(0, 0, W, W);
    c.save(); c.translate(cx, cx);
    c.strokeStyle = 'rgba(120,225,255,.35)'; c.lineWidth = 2;
    for (const r of [R, R * 0.66, R * 0.33]) { c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); }
    c.beginPath(); c.moveTo(-R, 0); c.lineTo(R, 0); c.moveTo(0, -R); c.lineTo(0, R); c.globalAlpha = 0.5; c.stroke(); c.globalAlpha = 1;
    const yaw = this.camYaw ?? p.yaw;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    for (const o of m.actors) {
      if (o === p || !o.alive) continue;
      const friend = o.team === p.team;
      const moving = o.lastMoveSpeed > 1.6 || m.time - o.lastFireT < 1.2;
      if (!friend && (!moving || o.camoT > 0)) continue;
      const dx = o.x - p.x, dz = o.z - p.z;
      // rotate so player's forward is up
      let rx = dx * cs - dz * sn, ry = dx * sn + dz * cs;
      let d = Math.hypot(rx, ry); if (d > range) continue;
      const px = (rx / range) * R, py = (ry / range) * R;
      const dy = o.y - p.y;
      c.fillStyle = friend ? TEAM[p.team].css : '#ff4a58'; c.shadowColor = c.fillStyle; c.shadowBlur = 10;
      c.beginPath();
      if (dy > 2.4) { c.moveTo(px, py - 11); c.lineTo(px + 9, py + 7); c.lineTo(px - 9, py + 7); }
      else if (dy < -2.4) { c.moveTo(px, py + 11); c.lineTo(px + 9, py - 7); c.lineTo(px - 9, py - 7); }
      else c.arc(px, py, 8, 0, TAU);
      c.fill(); c.shadowBlur = 0;
    }
    if (m.obj) {
      for (const o of m.obj.markers()) {
        if (o.key.startsWith('home')) continue;
        const dx = o.x - p.x, dz = o.z - p.z;
        let rx = dx * cs - dz * sn, ry = dx * sn + dz * cs; const d = Math.hypot(rx, ry) || 1, k = Math.min(1, (range * 0.96) / d);
        const px = (rx * k / range) * R, py = (ry * k / range) * R, col = o.team ? TEAM[o.team].css : '#ffd84a';
        c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 14; c.strokeStyle = '#fff'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(px, py - 12); c.lineTo(px + 10, py); c.lineTo(px, py + 12); c.lineTo(px - 10, py); c.closePath(); c.fill(); c.stroke(); c.shadowBlur = 0;
      }
    }
    c.fillStyle = 'rgba(120,225,255,.14)'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62); c.closePath(); c.fill();
    c.fillStyle = '#ffd84a'; c.shadowColor = '#ffd84a'; c.shadowBlur = 12; c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fill(); c.shadowBlur = 0;
    c.restore();
  }
}

function glyphText(action) { return Input.glyph(action); }
