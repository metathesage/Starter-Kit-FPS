// HUD: shield/health, grenades, ammo, radar, reticle, medals, feed, scoreboard, death cam text.
import { ICONS, WEAPONS } from './weapons.js';
import { TEAM } from './rig.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { clamp, angDiff, TAU } from './util.js';

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
};
const WEAPON_ICON = { br: ICONS.br, magnum: ICONS.magnum, smg: ICONS.smg, shotgun: ICONS.shotgun, sniper: ICONS.sniper, rocket: ICONS.rocket, sword: ICONS.sword, frag: ICONS.frag, plasma: ICONS.plasma, melee: MEDAL_ICONS.fist, explosion: ICONS.frag };
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
      <div class="h-over"></div><div class="h-warn"></div><div class="h-flash"></div><div class="h-dmg"></div><div class="h-scope"><div class="zt"></div></div>
      <div class="h-shield">
        <div class="sh-row"><div class="sh-ghost"></div><div class="sh-fill"></div><div class="sh-over"></div><div class="sh-lbl">SHIELD</div></div>
        <div class="hp-row"></div>
        <div class="gr-row"><div class="gr frag on">${svg(ICONS.frag)}<b>2</b></div><div class="gr plasma">${svg(ICONS.plasma)}<b>2</b></div></div>
      </div>
      <div class="h-score">
        <div class="sc-row blue"><div class="sc-bar"><i></i></div><div class="sc-n">0</div></div>
        <div class="sc-row red"><div class="sc-bar"><i></i></div><div class="sc-n">0</div></div>
        <div class="sc-meta"><span class="sc-mode">SLAYER</span><span class="sc-clock">12:00</span></div>
      </div>
      <div class="feed"></div>
      <div class="h-radar"><canvas width="336" height="336"></canvas></div>
      <div class="h-weapon"><div class="wp-icon"></div><div class="wp-name"></div><div class="wp-ammo"><div class="wp-mag">36</div><div class="wp-res">/ 144</div></div><div class="wp-reload"></div></div>
      <div class="h-reticle"><svg viewBox="-40 -40 80 80"></svg></div>
      <div class="h-hit"><svg viewBox="-20 -20 40 40"><path d="M-14-14L-6-6M14-14L6-6M-14 14L-6 6M14 14L6 6"/></svg></div>
      <div class="h-announce"></div><div class="h-count"></div><div class="h-mode"></div>
      <div class="h-medals"></div><div class="h-prompt"></div>
      <div class="h-cam"></div>
      <div class="h-death"><div class="dd"><div class="k">ELIMINATED BY</div><div class="nm"></div><div class="rs"></div></div></div>
      <div class="h-board"></div><div class="h-fps"></div>`;
    const q = (s) => root.querySelector(s);
    this.el = { fill: q('.sh-fill'), ghost: q('.sh-ghost'), over: q('.sh-over'), hp: q('.hp-row'), frag: q('.gr.frag'), plasma: q('.gr.plasma'),
      sc: { blue: q('.sc-row.blue'), red: q('.sc-row.red') }, clock: q('.sc-clock'), mode: q('.sc-mode'), feed: q('.feed'), radar: q('.h-radar canvas'),
      wIcon: q('.wp-icon'), wName: q('.wp-name'), wMag: q('.wp-mag'), wRes: q('.wp-res'), wRel: q('.wp-reload'), ret: q('.h-reticle'), retSvg: q('.h-reticle svg'),
      hit: q('.h-hit'), ann: q('.h-announce'), count: q('.h-count'), modeBig: q('.h-mode'), medals: q('.h-medals'), prompt: q('.h-prompt'), cam: q('.h-cam'),
      death: q('.h-death'), dName: q('.dd .nm'), dRes: q('.dd .rs'), board: q('.h-board'), fps: q('.h-fps'), flash: q('.h-flash'), dmg: q('.h-dmg'), scope: q('.h-scope'), zt: q('.h-scope .zt') };
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
    B('kill', (r) => this.feed(r));
    B('medal', (a, name, icon) => { if (a === this.p) this.medal(name, icon); });
    B('announce', (t, team) => this.announce(t, team));
    B('count', (n) => { const c = this.el.count; c.textContent = n > 0 ? n : 'GO'; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); if (n === 3) this.modeIntro(); });
    B('shot', (a) => { if (a === this.p) Input.rumble(0.25, 0.5, 60); });
    B('explosion', (pos, R) => { const d = Math.hypot(this.p.x - pos.x, this.p.z - pos.z); if (d < R * 2.5) Input.rumble(1, 0.7, 260); });
    this.el.feed.innerHTML = ''; this.el.medals.innerHTML = '';
    this.el.sc.blue.querySelector('.sc-n').textContent = '0'; this.el.sc.red.querySelector('.sc-n').textContent = '0';
    this.el.sc[this.p.team].classList.add('mine'); this.el.sc[this.p.team === 'red' ? 'blue' : 'red'].classList.remove('mine');
    this.el.sc.blue.parentNode.insertBefore(this.el.sc[this.p.team], this.el.sc.blue.parentNode.firstChild);
    this.el.mode.textContent = 'SLAYER · FIRST TO ' + match.limit;
  }
  unbind() { this.subs.forEach((u) => u()); this.subs = []; }

  modeIntro() {
    const m = this.el.modeBig; m.innerHTML = `TEAM SLAYER<br><span style="color:var(--gold)">FIRST TO ${this.match.limit}</span>`; m.classList.remove('on'); void m.offsetWidth; m.classList.add('on');
  }

  announce(text, team) {
    const a = this.el.ann; a.style.color = team ? TEAM[team].css : '#fff'; a.innerHTML = text; a.classList.remove('on'); void a.offsetWidth; a.classList.add('on');
  }

  medal(name, icon) {
    const d = document.createElement('div'); d.className = 'medal'; d.innerHTML = svg(MEDAL_ICONS[icon] || MEDAL_ICONS.star) + `<span>${name}</span>`;
    this.el.medals.appendChild(d); Sound.play('medal', { vol: 0.8 }); setTimeout(() => d.remove(), 2950);
    while (this.el.medals.children.length > 3) this.el.medals.firstChild.remove();
  }

  feed(r) {
    const d = document.createElement('div');
    const mine = r.killer === this.p || r.victim === this.p;
    d.className = 'feed-item' + (mine ? ' me' : '');
    d.style.setProperty('--tc', TEAM[(r.killer || r.victim).team].css);
    if (r.suicide) d.innerHTML = `<span class="${r.victim.team}">${r.victim.name}</span>${svg(MEDAL_ICONS.skull)}`;
    else d.innerHTML = `<span class="${r.killer.team}">${r.killer.name}</span>${wIcon(r.kind === 'punch' ? 'melee' : r.weapon)}<span class="${r.victim.team}">${r.victim.name}</span>`;
    this.el.feed.appendChild(d); setTimeout(() => d.remove(), 5600);
    while (this.el.feed.children.length > 5) this.el.feed.firstChild.remove();
  }

  showBoard(on) {
    const b = this.el.board;
    if (!on) { b.classList.remove('on'); this.boardT = 0; return; }
    if (this.boardT > performance.now() - 250) return;
    this.boardT = performance.now();
    const m = this.match, rows = (team) => m.ranking().filter((a) => a.team === team).map((a) =>
      `<tr class="${a.team}${a === this.p ? ' me' : ''}${a.alive ? '' : ' dead'}"><td class="nm">${a.name}</td><td>${a.kills}</td><td>${a.assists}</td><td>${a.deaths}</td><td>${a.streak}</td></tr>`).join('');
    const head = '<tr><th>OPERATOR</th><th>KILLS</th><th>AST</th><th>DEATHS</th><th>STREAK</th></tr>';
    const order = m.score.blue >= m.score.red ? ['blue', 'red'] : ['red', 'blue'];
    b.innerHTML = order.map((t) => `<h4 class="${t}">${TEAM[t].name} TEAM — ${m.score[t]}</h4><table class="tbl">${head}${rows(t)}</table>`).join('');
    b.classList.add('on');
  }

  update(dt, ctx) {
    const { match: m, player: p } = ctx; this.camYaw = ctx.camYaw;
    const E = this.el;
    // shield + health
    const tot = 100, sh = clamp(p.shield / tot, 0, 1), ov = clamp((p.shield - tot) / 200, 0, 1);
    E.fill.style.width = `calc(${sh * 100}% - 6px * ${sh})`;
    this.ghost = Math.max(sh, this.ghost - dt * 0.0); E.ghost.style.width = E.fill.style.width;
    E.over.style.width = `calc(${ov * 100}% - 6px * ${ov})`; E.over.style.opacity = p.over > 0 ? 1 : 0;
    const hpOn = Math.ceil((clamp(p.health, 0, 45) / 45) * 5);
    [...E.hp.children].forEach((c, i) => c.classList.toggle('on', i < hpOn));
    const low = p.alive && p.shield <= 0.5;
    document.body.classList.toggle('low-shield', low);
    document.body.classList.toggle('overshield', p.alive && p.over > 0);
    if (low) { this.alarmT -= dt; if (this.alarmT <= 0) { Sound.play('alarm', { vol: 0.7 }); this.alarmT = 0.85; } }
    // grenades
    E.frag.querySelector('b').textContent = p.gren.frag; E.plasma.querySelector('b').textContent = p.gren.plasma;
    E.frag.classList.toggle('on', p.gtype === 'frag'); E.plasma.classList.toggle('on', p.gtype === 'plasma');
    // score
    for (const t of ['red', 'blue']) {
      const r = E.sc[t]; r.querySelector('.sc-n').textContent = m.score[t];
      r.querySelector('i').style.width = clamp((m.score[t] / m.limit) * 100, 0, 100) + '%';
    }
    const s = Math.ceil(m.clock); E.clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    // weapon
    const w = p.weapon, def = p.def;
    if (w) {
      const key = w.id + (p.weapons[1 - p.cur] ? p.weapons[1 - p.cur].id : '');
      if (this.wKey !== key) {
        this.wKey = key;
        E.wIcon.innerHTML = svg(WEAPON_ICON[w.id]) + (p.weapons.length > 1 ? svg(WEAPON_ICON[p.weapons[1 - p.cur].id], 'sec') : '');
        E.wName.textContent = def.short;
      }
      const melee = def.melee;
      E.wMag.textContent = melee ? '' : w.mag; E.wRes.textContent = melee ? 'ENERGY' : '/ ' + w.res;
      E.wMag.classList.toggle('low', !melee && w.mag <= Math.max(1, def.mag * 0.25));
      E.wRel.textContent = p.reloadT > 0 ? 'RELOADING' : (!melee && w.mag === 0 && w.res === 0 ? 'NO AMMO' : (!melee && w.mag <= def.mag * 0.25 && w.res > 0 ? `${glyphText('reload')} RELOAD` : ''));
    }
    E.wIcon.parentNode.style.display = p.alive ? '' : 'none';
    // reticle
    const retId = def ? def.ret : 'none';
    const zoomScope = p.alive && def && def.id === 'sniper' && p.zoomLevel > 0;
    if (retId !== this.retId) { this.retId = retId; E.retSvg.innerHTML = RETICLES[retId] || ''; E.ret.classList.toggle('none', retId === 'none'); }
    E.ret.style.display = p.alive && !zoomScope && !m.thirdPerson ? '' : 'none';
    E.ret.classList.toggle('enemy', !!ctx.aimEnemy);
    const tk = E.retSvg.querySelector('.tk');
    if (tk && def) { const sp = (def.spread + p.bloom + (p.lastMoveSpeed / 5.4) * def.spread * 0.6) * 22; tk.style.transform = `scale(${1 + clamp(sp, 0, 1.2)})`; }
    E.scope.classList.toggle('on', zoomScope); if (zoomScope) E.zt.textContent = def.zoom[p.zoomLevel - 1].toFixed(1) + 'X';
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
    E.cam.style.display = Input.last === 'pad' ? 'none' : '';
    // death
    if (!p.alive && m.state !== 'countdown') {
      E.death.classList.add('on');
      const killer = m.lastKillRec && m.lastKillRec.victim === p ? m.lastKillRec.killer : null;
      E.dName.textContent = killer ? killer.name : 'YOUR OWN HAND';
      E.dName.style.color = killer ? TEAM[killer.team].css : '#fff';
      E.dRes.textContent = m.state === 'live' ? `REDEPLOY IN ${Math.max(0, Math.ceil(p.respawnAt - m.time))}` : '';
    } else E.death.classList.remove('on');
    this.radar(m, p);
  }

  radar(m, p) {
    const c = this.rctx, W = 336, R = 150, cx = W / 2, range = 26;
    c.clearRect(0, 0, W, W);
    c.save(); c.translate(cx, cx);
    c.strokeStyle = 'rgba(98,228,255,.28)'; c.lineWidth = 2;
    for (const r of [R, R * 0.66, R * 0.33]) { c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); }
    c.beginPath(); c.moveTo(-R, 0); c.lineTo(R, 0); c.moveTo(0, -R); c.lineTo(0, R); c.globalAlpha = 0.5; c.stroke(); c.globalAlpha = 1;
    const yaw = this.camYaw ?? p.yaw;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    for (const o of m.actors) {
      if (o === p || !o.alive) continue;
      const friend = o.team === p.team;
      const moving = o.lastMoveSpeed > 1.6 || m.time - o.lastFireT < 1.2;
      if (!friend && !moving) continue;
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
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -12); c.lineTo(9, 10); c.lineTo(0, 5); c.lineTo(-9, 10); c.closePath(); c.fill();
    c.restore();
  }
}

function glyphText(action) { return Input.glyph(action); }
