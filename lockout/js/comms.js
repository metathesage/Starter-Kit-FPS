// Lobby comms: text chat over the existing data channels, push-to-talk voice over PeerJS media calls.
// Voice is a star: guests call the host, the host mixes everyone (minus the listener) back to each guest.
import { Net } from './net.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const MIC = 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6';
const CHAT = 'M4 5h16v11H9l-5 4z M8 9h8M8 12h5';

export const Comms = {
  ctx: null, dst: new Map(), srcs: new Map(), gain: null, micStream: null, talking: false, inMatch: false,
  calls: new Map(), last: 0, myName: () => 'PLAYER', ui: null, open: false,

  // ---- UI ----------------------------------------------------------------------------------
  init(myName) {
    this.myName = myName;
    const d = document.createElement('div'); d.id = 'comms'; d.hidden = true;
    d.innerHTML = `<div class="cm-log"></div>
      <form class="cm-form" hidden><input maxlength="120" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Message the lobby"><button type="submit" aria-label="Send">SEND</button></form>
      <div class="cm-bar"><button type="button" class="cm-chat" aria-label="Chat"><svg viewBox="0 0 24 24"><path d="${CHAT}"/></svg><b>Y</b></button><button type="button" class="cm-mic" aria-label="Push to talk"><svg viewBox="0 0 24 24"><path d="${MIC}"/></svg><b>B</b><i></i></button></div>`;
    document.body.appendChild(d); this.ui = d;
    const inp = d.querySelector('input'), form = d.querySelector('form');
    form.addEventListener('submit', (e) => { e.preventDefault(); const t = inp.value.trim(); if (t) this.send(t); inp.value = ''; this.close(); });
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { inp.value = ''; this.close(); } });
    inp.addEventListener('keyup', (e) => e.stopPropagation());
    d.querySelector('.cm-chat').addEventListener('click', () => (this.open ? this.close() : this.openBox()));
    const mic = d.querySelector('.cm-mic');
    const down = (e) => { e.preventDefault(); this.ptt(true); }, up = (e) => { e.preventDefault(); this.ptt(false); };
    mic.addEventListener('pointerdown', down); mic.addEventListener('pointerup', up); mic.addEventListener('pointercancel', up); mic.addEventListener('pointerleave', up);
    addEventListener('keydown', (e) => {
      if (!this.inMatch || e.repeat || (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName))) return;
      if (e.code === 'KeyY') { e.preventDefault(); this.openBox(); } else if (e.code === 'KeyB') this.ptt(true);
    });
    addEventListener('keyup', (e) => { if (e.code === 'KeyB') this.ptt(false); });
    const wake = () => { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); };
    addEventListener('pointerdown', wake, true); addEventListener('keydown', wake, true);
  },
  show(on) { this.inMatch = on; if (this.ui) this.ui.hidden = !on; if (!on) this.close(); },
  openBox() { if (!this.ui) return; this.open = true; const f = this.ui.querySelector('form'); f.hidden = false; this.ui.classList.add('typing'); setTimeout(() => f.querySelector('input').focus(), 0); },
  close() { if (!this.ui) return; this.open = false; const f = this.ui.querySelector('form'); f.hidden = true; this.ui.classList.remove('typing'); f.querySelector('input').blur(); },
  line(name, text, cls = '') {
    if (!this.ui) return;
    const log = this.ui.querySelector('.cm-log'), el = document.createElement('div'); el.className = 'cm-line ' + cls;
    el.innerHTML = `<b>${esc(name)}</b><span>${esc(text)}</span>`; log.appendChild(el);
    while (log.children.length > 7) log.firstChild.remove();
    setTimeout(() => el.classList.add('old'), 9000);
  },

  // ---- text chat ---------------------------------------------------------------------------
  send(text) {
    const now = performance.now(); if (now - this.last < 500) return; this.last = now;
    text = String(text).slice(0, 120);
    if (Net.isHost) { const m = { t: 'chat', n: this.myName(), x: text }; this.line(m.n, m.x, 'me'); Net.broadcast(m); }
    else if (Net.isClient) Net.send({ t: 'chat', n: this.myName(), x: text });
  },
  // host receives from a guest and fans out; a guest receives the fan-out
  onChat(from, m, nameOf) {
    const n = String((Net.isHost ? nameOf(from) : m.n) || m.n || 'GUEST').slice(0, 12), x = String(m.x || '').slice(0, 120);
    if (!x) return;
    this.line(n, x, Net.isHost ? '' : '');
    if (Net.isHost) Net.broadcast({ t: 'chat', n, x, from });
  },

  // ---- voice ---------------------------------------------------------------------------------
  audio() {
    if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.gain = this.ctx.createGain(); this.gain.gain.value = 0; }
    return this.ctx;
  },
  attachStream(stream) {   // Chrome only pumps a remote stream into WebAudio if an element also holds it
    const a = new Audio(); a.srcObject = stream; a.muted = true; a.play().catch(() => {}); return a;
  },
  hostReady() {
    const peer = Net.peer; if (!peer) return; this.audio();
    peer.on('call', (call) => {
      const id = call.peer, ctx = this.audio(), dst = ctx.createMediaStreamDestination(); this.dst.set(id, dst);
      this.gain.connect(dst);                                   // host mic to this guest
      for (const [oid, os] of this.srcs) os.connect(dst);       // other guests to this guest
      call.answer(dst.stream); this.calls.set(id, call);
      call.on('stream', (s) => {
        this.attachStream(s); const src = ctx.createMediaStreamSource(s); this.srcs.set(id, src);
        src.connect(ctx.destination);                            // host hears the guest
        for (const [oid, d] of this.dst) if (oid !== id) src.connect(d);   // other guests hear this guest
      });
      const gone = () => { const s = this.srcs.get(id); if (s) { try { s.disconnect(); } catch { /* */ } } this.srcs.delete(id); this.dst.delete(id); this.calls.delete(id); };
      call.on('close', gone); call.on('error', gone);
    });
  },
  guestReady() {
    const peer = Net.peer, hostId = Net.host && Net.host.peer; if (!peer || !hostId) return;
    const ctx = this.audio(), dst = ctx.createMediaStreamDestination(); this.gain.connect(dst);
    // a silent-until-you-talk track keeps the call open so you always hear the host mix
    const call = peer.call(hostId, dst.stream); this.calls.set('host', call);
    call.on('stream', (s) => { const a = new Audio(); a.srcObject = s; a.autoplay = true; a.play().catch(() => {}); this.playEl = a; });
  },
  async ensureMic() {
    if (this.micStream) return true;
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      const src = this.audio().createMediaStreamSource(this.micStream); src.connect(this.gain);
      return true;
    } catch (e) { this.line('VOICE', 'Microphone blocked. Allow it in the browser address bar.', 'sys'); return false; }
  },
  async ptt(on) {
    if (!Net.online) return;
    if (on && !this.micStream) { if (!(await this.ensureMic())) return; }
    this.talking = on; this.audio();
    if (this.gain) this.gain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
    const m = this.ui && this.ui.querySelector('.cm-mic'); if (m) m.classList.toggle('live', on);
  },
  stop() {
    this.show(false);
    for (const c of this.calls.values()) { try { c.close(); } catch { /* */ } } this.calls.clear();
    for (const s of this.srcs.values()) { try { s.disconnect(); } catch { /* */ } } this.srcs.clear(); this.dst.clear();
    if (this.micStream) { this.micStream.getTracks().forEach((t) => t.stop()); this.micStream = null; }
    if (this.ctx) { try { this.ctx.close(); } catch { /* */ } this.ctx = null; this.gain = null; }
    this.talking = false; const l = this.ui && this.ui.querySelector('.cm-log'); if (l) l.innerHTML = '';
  },
};
