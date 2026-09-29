// Screen manager + controller-navigable menu rows.
import { Input } from './input.js';
import { Sound } from './audio.js';
import { $, $$ } from './util.js';
import { glyph, svg } from './hud.js';

const CHEV = '<svg class="arrow" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';
const L = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>', R = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';

export const UI = {
  cur: null, rows: [], fi: 0, onBack: null, locked: false,

  show(name, { rows = [], onBack = null, focus = 0 } = {}) {
    const prev = this.cur;
    if (prev && prev !== name) { const e = $(`#${prev}`); if (e) { e.classList.remove('active'); e.classList.remove('leaving'); } }
    this.cur = name;
    const el = $(`#${name}`); el.classList.remove('leaving'); el.classList.add('active');
    this.setRows(rows, focus); this.onBack = onBack;
    document.body.classList.remove('is-splash');
  },
  hide(name) { const e = $(`#${name}`); if (e) e.classList.remove('active'); if (this.cur === name) { this.cur = null; this.rows = []; } },

  setRows(rows, focus = 0) {
    this.rows = rows; this.fi = Math.min(focus, Math.max(0, rows.length - 1));
    rows.forEach((r, i) => {
      r.addEventListener('mouseenter', () => { if (this.fi !== i) { this.focus(i); Sound.play('menuMove', { vol: 0.5 }); } });
    });
    this.focus(this.fi, true);
  },
  focus(i, silent) {
    this.rows.forEach((r, k) => r.classList.toggle('focus', k === i));
    this.fi = i;
    const r = this.rows[i]; if (r && r.scrollIntoView) r.scrollIntoView({ block: 'nearest' });
  },

  // called every frame while a menu is up
  tick() {
    if (!this.cur || !this.rows.length) return;
    if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;   // typing a save code
    const N = Input.nav;
    const cur = this.rows[this.fi];
    if (N.up) { if (cur && cur._vert && cur._vert(-1)) Sound.play('menuMove', { vol: 0.6 }); else { this.focus((this.fi + this.rows.length - 1) % this.rows.length); Sound.play('menuMove', { vol: 0.6 }); } }
    else if (N.down) { if (cur && cur._vert && cur._vert(1)) Sound.play('menuMove', { vol: 0.6 }); else { this.focus((this.fi + 1) % this.rows.length); Sound.play('menuMove', { vol: 0.6 }); } }
    const r = this.rows[this.fi];
    if (r) {
      if (N.left && r._adj) { r._adj(-1); Sound.play('menuMove', { vol: 0.6 }); }
      if (N.right && r._adj) { r._adj(1); Sound.play('menuMove', { vol: 0.6 }); }
      if (Input.pressed.confirm && r._act) { r._act(); Sound.play('menuOk', { vol: 0.7 }); }
    }
    if ((Input.pressed.back || Input.pressed.pause && this.cur !== 'pause') && this.onBack) { this.onBack(); Sound.play('menuBack', { vol: 0.7 }); }
  },

  // ---- row builders ----
  item(parent, label, n, fn) {
    const b = document.createElement('button'); b.className = 'menu-item';
    b.innerHTML = `<span class="n">${n}</span><span>${label}</span>${CHEV}`;
    b._act = fn; b.addEventListener('click', () => { Sound.unlock(); Sound.play('menuOk', { vol: 0.7 }); fn(); });
    parent.appendChild(b); return b;
  },
  button(el, fn) {
    el._act = fn; el.onclick = () => { Sound.unlock(); Sound.play('menuOk', { vol: 0.7 }); fn(); }; return el;
  },
  choice(parent, label, values, idx, onChange) {
    const row = document.createElement('div'); row.className = 'opt';
    row.innerHTML = `<span class="lbl">${label}</span><span class="val"><button aria-label="Previous">${L}</button><span class="txt"></span><button aria-label="Next">${R}</button></span>`;
    const t = row.querySelector('.txt'), [bl, br] = row.querySelectorAll('button');
    let i = idx;
    const set = (v, fire = true) => { i = (v + values.length) % values.length; t.textContent = values[i].label ?? values[i]; if (fire) onChange(values[i].value ?? values[i], i); };
    row._adj = (d) => set(i + d); row._act = () => set(i + 1);
    bl.onclick = (e) => { e.stopPropagation(); row._adj(-1); Sound.play('menuMove', { vol: 0.6 }); };
    br.onclick = (e) => { e.stopPropagation(); row._adj(1); Sound.play('menuMove', { vol: 0.6 }); };
    row.onclick = () => { row._adj(1); Sound.unlock(); Sound.play('menuMove', { vol: 0.6 }); };
    set(idx, false); parent.appendChild(row); return row;
  },
  slider(parent, label, min, max, step, val, fmt, onChange) {
    const row = document.createElement('div'); row.className = 'opt';
    row.innerHTML = `<span class="lbl">${label}</span><span class="val"><button aria-label="Decrease">${L}</button><span class="bar"><i></i></span><span class="txt" style="min-width:52px"></span><button aria-label="Increase">${R}</button></span>`;
    const bar = row.querySelector('.bar i'), t = row.querySelector('.txt'), [bl, br] = row.querySelectorAll('button');
    let v = val;
    const set = (x, fire = true) => { v = Math.min(max, Math.max(min, Math.round(x / step) * step)); bar.style.width = ((v - min) / (max - min)) * 100 + '%'; t.textContent = fmt(v); if (fire) onChange(v); };
    row._adj = (d) => set(v + d * step);
    bl.onclick = (e) => { e.stopPropagation(); row._adj(-1); }; br.onclick = (e) => { e.stopPropagation(); row._adj(1); };
    row.querySelector('.bar').onclick = (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); set(min + ((e.clientX - r.left) / r.width) * (max - min)); };
    set(val, false); parent.appendChild(row); return row;
  },
  toast(msg, ms = 1800) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('on'), ms);
  },
  prompts(el, list) {
    el.innerHTML = list.map(([a, t]) => `<span class="pr">${a.split('+').map((x) => glyph(x)).join('')}<span>${t}</span></span>`).join('');
  },
};
export { svg };
