// Wow layer: short, loud, rewarding moments. Everything here is fire-and-forget DOM/canvas plus a kick into the post pipeline.
import { Sound } from './audio.js';

const el = (cls, html = '', ttl = 3400) => {
  const d = document.createElement('div'); d.className = cls; d.innerHTML = html; document.body.appendChild(d);
  setTimeout(() => d.remove(), ttl); return d;
};

export const Wow = {
  post: null,
  init(post) { this.post = post; },
  kick(a) { if (this.post) this.post.kick(a); },
  shake() { document.body.classList.remove('wow-shake'); void document.body.offsetWidth; document.body.classList.add('wow-shake'); },

  // cinematic title card: letterbox bars open while the name resolves out of a blur
  intro(kicker, title, sub = '') {
    el('wow-letter t', '', 2700); el('wow-letter b', '', 2700);
    el('wow-card', `<small>${kicker}</small><b>${title}</b><i></i>${sub ? `<span>${sub}</span>` : ''}`, 3400);
    this.kick(0.5);
  },

  // exotic acquisition: golden flash, god rays, banner class handled by hud, bloom surge
  exotic() {
    el('wow-flash', '', 1000); el('wow-rays', '', 2700);
    this.kick(1.2); this.shake();
  },

  // big level card + confetti
  levelUp(level) {
    el('wow-flash', '', 1000);
    el('wow-lvl', `<small>LEVEL UP</small><b>${level}</b><span>NEW REWARDS UNLOCKED</span>`, 3900);
    this.confetti(); this.kick(0.9);
    Sound.play('win', { vol: 0.5 });
  },

  confetti(n = 170) {
    const cv = document.createElement('canvas'); cv.className = 'wow-confetti';
    const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    document.body.appendChild(cv); const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const COL = ['#ffe2a8', '#ffc46b', '#ffffff', '#6ee7ff', '#a78bfa', '#ff8ad4'];
    const P = Array.from({ length: n }, () => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5, v = 9 + Math.random() * 13;
      return { x: innerWidth / 2, y: innerHeight * 0.55, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.4, w: 5 + Math.random() * 7, h: 3 + Math.random() * 5, c: COL[(Math.random() * COL.length) | 0], life: 1 };
    });
    let t0 = performance.now();
    const step = (t) => {
      const dt = Math.min(0.05, (t - t0) / 1000) * 60; t0 = t; g.clearRect(0, 0, innerWidth, innerHeight); let alive = 0;
      for (const p of P) {
        p.vy += 0.34 * dt; p.vx *= 0.992; p.vy *= 0.992; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; if (p.y > innerHeight + 30) continue; alive++;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, Math.abs(Math.sin(p.r * 1.7)) * 0.9 + 0.1); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
      }
      if (alive) requestAnimationFrame(step); else cv.remove();
    };
    requestAnimationFrame(step); setTimeout(() => cv.remove(), 6000);
  },
};
