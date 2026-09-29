// Peer-to-peer lobby + transport over PeerJS (WebRTC). The host runs the match; friends send input and render snapshots.
import { Bus } from './util.js';

const Q = new URLSearchParams(location.search);
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 5 }, () => ALPHA[(Math.random() * ALPHA.length) | 0]).join('');
const PREFIX = 'lockout-yard-';

function peerOpts() {
  const o = { debug: 0 };
  if (Q.get('peerhost')) { o.host = Q.get('peerhost'); o.port = +Q.get('peerport') || 9000; o.path = Q.get('peerpath') || '/'; o.secure = Q.get('peersecure') === '1'; }
  return o;
}

async function loadPeerLib() {
  if (window.Peer) return window.Peer;
  await new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'vendor/peerjs.min.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load the netcode library'));
    document.head.appendChild(s);
  });
  return window.Peer;
}

export const Net = {
  role: null, code: null, peer: null, conns: new Map(), host: null, bus: new Bus(), open: false, maxGuests: 3,

  get online() { return this.role !== null; },
  get isHost() { return this.role === 'host'; },
  get isClient() { return this.role === 'client'; },

  link() { return `${location.origin}${location.pathname}?join=${this.code}`; },

  async startHost() {
    this.close();
    const Peer = await loadPeerLib();
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = makeCode();
      try {
        await new Promise((res, rej) => {
          const p = new Peer(PREFIX + code, peerOpts());
          const to = setTimeout(() => { try { p.destroy(); } catch { /* */ } rej(new Error('Lobby server unreachable')); }, 9000);
          p.on('open', () => { clearTimeout(to); this.peer = p; this.code = code; res(); });
          p.on('error', (e) => { clearTimeout(to); try { p.destroy(); } catch { /* */ } rej(e); });
        });
        break;
      } catch (e) {
        if (e && e.type === 'unavailable-id') continue;
        throw e;
      }
    }
    if (!this.peer) throw new Error('Could not create a lobby');
    this.role = 'host';
    this.peer.on('connection', (conn) => {
      if (this.conns.size >= this.maxGuests) { conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); }); return; }
      conn.on('open', () => { this.conns.set(conn.peer, conn); this.bus.emit('join', conn.peer, conn); });
      conn.on('data', (m) => this.bus.emit('msg', conn.peer, m));
      const gone = () => { if (this.conns.delete(conn.peer)) this.bus.emit('leave', conn.peer); };
      conn.on('close', gone); conn.on('error', gone);
    });
    this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch { /* */ } });
    return this.code;
  },

  async join(code) {
    this.close();
    code = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) throw new Error('Enter the 5-letter lobby code');
    const Peer = await loadPeerLib();
    const p = await new Promise((res, rej) => {
      const peer = new Peer(peerOpts());
      const to = setTimeout(() => { try { peer.destroy(); } catch { /* */ } rej(new Error('Lobby server unreachable')); }, 9000);
      peer.on('open', () => { clearTimeout(to); res(peer); });
      peer.on('error', (e) => { clearTimeout(to); rej(e); });
    });
    this.peer = p; this.code = code; this.role = 'client';
    await new Promise((res, rej) => {
      const conn = p.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      const to = setTimeout(() => { try { conn.close(); } catch { /* */ } rej(new Error('No lobby with that code (or the host is offline)')); }, 12000);
      conn.on('open', () => { clearTimeout(to); this.host = conn; res(); });
      conn.on('data', (m) => this.bus.emit('msg', 'host', m));
      conn.on('close', () => { if (this.role === 'client') this.bus.emit('closed'); });
      conn.on('error', () => { if (this.role === 'client') this.bus.emit('closed'); });
      p.on('error', (e) => { clearTimeout(to); rej(e); });
    });
    return true;
  },

  send(m) { try { if (this.host && this.host.open) this.host.send(m); } catch { /* channel busy or closing */ } },
  sendTo(peerId, m) { try { const c = this.conns.get(peerId); if (c && c.open) c.send(m); } catch { /* */ } },
  broadcast(m) { for (const c of this.conns.values()) { try { if (c.open) c.send(m); } catch { /* */ } } },

  close() {
    try { if (this.host) this.host.close(); } catch { /* */ }
    for (const c of this.conns.values()) { try { c.close(); } catch { /* */ } }
    try { if (this.peer) this.peer.destroy(); } catch { /* */ }
    this.role = null; this.code = null; this.peer = null; this.host = null; this.conns.clear();
  },
};

export const friendlyError = (e) => {
  const t = e && e.type;
  if (t === 'peer-unavailable') return 'No lobby with that code. Check it and try again.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Could not reach the lobby server. Check your connection.';
  return (e && e.message) || 'Connection failed';
};
