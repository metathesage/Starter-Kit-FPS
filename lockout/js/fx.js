// Pooled particles, tracers, flashes, explosions. No per-frame allocation in hot paths.
import * as THREE from 'three';
import { rand } from './util.js';

const N = 1400;
const VERT = `
attribute float size; attribute vec4 acolor; varying vec4 vC; uniform float uScale;
void main(){ vC = acolor; vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = max(1.0, size * uScale / max(0.1, -mv.z)); gl_Position = projectionMatrix * mv; }`;
const FRAG = `
varying vec4 vC;
void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d); gl_FragColor = vec4(vC.rgb * vC.a, vC.a * a); }`;

function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,220,150,.7)'); gr.addColorStop(1, 'rgba(255,150,50,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 4); this.siz = new Float32Array(N);
    this.vel = new Float32Array(N * 3); this.life = new Float32Array(N); this.max = new Float32Array(N); this.s0 = new Float32Array(N); this.s1 = new Float32Array(N);
    this.alp = new Float32Array(N); this.grav = new Float32Array(N); this.rgb = new Float32Array(N * 3);
    this.pos.fill(-999);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('acolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.siz, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.head = 0;

    // tracers
    this.tracers = [];
    const tg = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      m.visible = false; m.frustumCulled = false; scene.add(m);
      this.tracers.push({ m, t: 0, dur: 0.08 });
    }
    // dynamic lights (fixed count so shaders never recompile)
    this.lights = [];
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffaa55, 0, 14, 1.6); scene.add(l); this.lights.push({ l, t: 0, dur: 0.1, i0: 0 }); }
    // explosion shells
    this.boom = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; scene.add(m); this.boom.push({ m, t: 0, R: 1 });
    }
    // muzzle sprites
    this.flashTex = glowTex();
    this.flashes = [];
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
      s.visible = false; scene.add(s); this.flashes.push({ s, t: 0 });
    }
    this._v = new THREE.Vector3();
    // bullet holes / scorch marks: one instanced draw, oldest overwritten
    const dc = document.createElement('canvas'); dc.width = dc.height = 64; const dg = dc.getContext('2d');
    const gr = dg.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(0,0,0,.95)'); gr.addColorStop(0.28, 'rgba(8,8,10,.8)'); gr.addColorStop(0.55, 'rgba(20,20,24,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    dg.fillStyle = gr; dg.fillRect(0, 0, 64, 64); dg.strokeStyle = 'rgba(0,0,0,.6)'; dg.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.283 + 0.3, r0 = 6, r1 = 15 + (i % 3) * 5; dg.beginPath(); dg.moveTo(32 + Math.cos(a) * r0, 32 + Math.sin(a) * r0); dg.lineTo(32 + Math.cos(a + 0.12) * r1, 32 + Math.sin(a + 0.12) * r1); dg.stroke(); }
    const dt = new THREE.CanvasTexture(dc); dt.colorSpace = THREE.SRGBColorSpace;
    this.DN = 128;
    this.decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: dt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), this.DN);
    this.decals.frustumCulled = false; this.decals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dData = Array.from({ length: this.DN }, () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), s: 0, age: 999 }));
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion(); this._n = new THREE.Vector3(); this._one = new THREE.Vector3(); this._Z = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < this.DN; i++) { this._m.makeScale(0, 0, 0); this.decals.setMatrixAt(i, this._m); }
    this.dHead = 0; scene.add(this.decals);
  }

  decal(x, y, z, nx, ny, nz, size = 0.1) {
    const d = this.dData[this.dHead], i = this.dHead; this.dHead = (this.dHead + 1) % this.DN;
    this._n.set(nx, ny, nz).normalize();
    d.p.set(x + this._n.x * 0.014, y + this._n.y * 0.014, z + this._n.z * 0.014);
    d.q.setFromUnitVectors(this._Z, this._n); this._q2.setFromAxisAngle(this._Z, rand(0, 6.283)); d.q.multiply(this._q2);
    d.s = size * rand(0.8, 1.3); d.age = 0;
    this._m.compose(d.p, d.q, this._one.setScalar(d.s)); this.decals.setMatrixAt(i, this._m); this.decals.instanceMatrix.needsUpdate = true;
  }

  clearDecals() { for (let i = 0; i < this.DN; i++) { this.dData[i].age = 999; this._m.makeScale(0, 0, 0); this.decals.setMatrixAt(i, this._m); } this.decals.instanceMatrix.needsUpdate = true; }

  // spent brass: small bright sparks that arc out to the right and bounce
  eject(x, y, z, rx, rz, big = false) {
    this.emit(x, y, z, rx * rand(1.6, 2.6) + rand(-0.3, 0.3), rand(1.6, 2.8), rz * rand(1.6, 2.6) + rand(-0.3, 0.3), rand(0.7, 1.0), big ? 0.075 : 0.05, 0.04, 1, 0.78, 0.3, 1, 13);
  }

  setScale(h, fov) { this.mat.uniforms.uScale.value = h / (2 * Math.tan((fov * Math.PI) / 360)); }

  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a = 1, grav = 0) {
    const i = this.head; this.head = (this.head + 1) % N;
    const p = i * 3;
    this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z;
    this.vel[p] = vx; this.vel[p + 1] = vy; this.vel[p + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.grav[i] = grav;
    this.rgb[p] = r; this.rgb[p + 1] = g; this.rgb[p + 2] = b; this.alp[i] = a;
  }

  sparks(x, y, z, dx, dy, dz, n = 8, c = [1, 0.75, 0.35], spd = 5) {
    for (let i = 0; i < n; i++) {
      const s = rand(0.3, 1) * spd;
      this.emit(x, y, z, dx * s + rand(-1.5, 1.5), dy * s + rand(0, 2.5), dz * s + rand(-1.5, 1.5), rand(0.2, 0.5), 0.09, 0.02, c[0], c[1], c[2], 1, 9);
    }
    this.emit(x, y, z, 0, 0, 0, 0.12, 0.35, 0.05, 1, 0.95, 0.8, 1, 0);
  }

  dust(x, y, z, n = 4) {
    for (let i = 0; i < n; i++) this.emit(x, y, z, rand(-0.8, 0.8), rand(0.2, 1.2), rand(-0.8, 0.8), rand(0.35, 0.7), 0.2, 0.6, 0.35, 0.42, 0.5, 0.5, 0);
  }

  blood(x, y, z, c) { // shield fizz / armor chips in team color
    for (let i = 0; i < 10; i++) this.emit(x, y, z, rand(-2.5, 2.5), rand(0, 3), rand(-2.5, 2.5), rand(0.25, 0.6), 0.1, 0.02, c[0], c[1], c[2], 1, 6);
  }

  tracer(a, b, color = 0xffe6a0, w = 0.02, dur = 0.08) {
    const t = this.tracers.find((q) => q.t <= 0); if (!t) return;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz);
    if (len < 0.5) return;
    t.m.position.set(a.x + dx / 2, a.y + dy / 2, a.z + dz / 2);
    t.m.lookAt(b.x, b.y, b.z); t.m.scale.set(w, w, len);
    t.m.material.color.setHex(color); t.t = t.dur = dur; t.m.visible = true; t.m.material.opacity = 0.9;
  }

  light(x, y, z, color, intensity, dur, dist = 14) {
    const L = this.lights.find((q) => q.t <= 0) || this.lights[0];
    L.l.position.set(x, y, z); L.l.color.setHex(color); L.l.distance = dist; L.i0 = intensity; L.t = L.dur = dur; L.l.intensity = intensity;
  }

  flash(x, y, z, size = 0.5, color = 0xffffff) {
    const f = this.flashes.find((q) => q.t <= 0); if (!f) return;
    f.s.material.color.setHex(color);
    f.s.position.set(x, y, z); f.s.scale.setScalar(size); f.t = 0.05; f.s.visible = true; f.s.material.opacity = 1; f.s.material.rotation = rand(0, 6);
  }

  explosion(x, y, z, R = 5) {
    const b = this.boom.find((q) => q.t <= 0) || this.boom[0];
    b.m.position.set(x, y, z); b.t = 0.001; b.R = R; b.m.visible = true;
    for (let i = 0; i < 46; i++) {
      const a = rand(0, 6.28), e = rand(-0.4, 1), s = rand(2, 13);
      this.emit(x, y, z, Math.cos(a) * s * (1 - e * 0.3), e * s * 0.9 + 2, Math.sin(a) * s * (1 - e * 0.3), rand(0.4, 1.0), rand(0.5, 1.3), 0.1, 1, rand(0.35, 0.65), 0.15, 1, 4);
    }
    for (let i = 0; i < 26; i++) this.emit(x, y, z, rand(-9, 9), rand(0, 11), rand(-9, 9), rand(0.5, 1.1), 0.12, 0.02, 1, 0.85, 0.5, 1, 14);
    this.emit(x, y, z, 0, 0, 0, 0.25, R * 0.9, R * 0.2, 1, 0.9, 0.7, 1, 0);
    this.light(x, y + 0.5, z, 0xffa050, 60, 0.45, R * 4);
  }

  update(dt) {
    for (let i = 0; i < N; i++) {
      const L = this.life[i];
      if (L <= 0) { this.col[i * 4 + 3] = 0; this.siz[i] = 0; continue; }
      const p = i * 3, nl = L - dt; this.life[i] = nl;
      if (nl <= 0) { this.col[i * 4 + 3] = 0; this.siz[i] = 0; this.pos[p + 1] = -999; continue; }
      this.vel[p + 1] -= this.grav[i] * dt;
      this.pos[p] += this.vel[p] * dt; this.pos[p + 1] += this.vel[p + 1] * dt; this.pos[p + 2] += this.vel[p + 2] * dt;
      if (this.pos[p + 1] < 0.02 && this.grav[i] > 0) { this.pos[p + 1] = 0.02; this.vel[p + 1] *= -0.3; this.vel[p] *= 0.6; this.vel[p + 2] *= 0.6; }
      const k = nl / this.max[i];
      this.siz[i] = this.s1[i] + (this.s0[i] - this.s1[i]) * k;
      const c = i * 4;
      this.col[c] = this.rgb[p]; this.col[c + 1] = this.rgb[p + 1]; this.col[c + 2] = this.rgb[p + 2];
      this.col[c + 3] = Math.min(1, k * 1.6) * this.alp[i];
    }
    const g = this.points.geometry.attributes;
    g.position.needsUpdate = true; g.acolor.needsUpdate = true; g.size.needsUpdate = true;
    for (const t of this.tracers) if (t.t > 0) { t.t -= dt; t.m.material.opacity = Math.max(0, t.t / t.dur) * 0.9; if (t.t <= 0) t.m.visible = false; }
    for (const L of this.lights) if (L.t > 0) { L.t -= dt; L.l.intensity = Math.max(0, (L.t / L.dur) * L.i0); if (L.t <= 0) L.l.intensity = 0; }
    for (const b of this.boom) if (b.t > 0) {
      b.t += dt; const k = b.t / 0.4;
      if (k >= 1) { b.t = 0; b.m.visible = false; continue; }
      b.m.scale.setScalar(b.R * (0.3 + 0.7 * (1 - Math.pow(1 - k, 3))) * 0.55);
      b.m.material.opacity = (1 - k) * 0.55;
    }
    let dirty = false;
    for (let i = 0; i < this.DN; i++) {
      const d = this.dData[i]; if (d.age > 900) continue;
      d.age += dt;
      if (d.age > 26) { const k = Math.max(0, 1 - (d.age - 26) / 2); this._m.compose(d.p, d.q, this._one.setScalar(d.s * k)); this.decals.setMatrixAt(i, this._m); dirty = true; if (k <= 0) d.age = 999; }
    }
    if (dirty) this.decals.instanceMatrix.needsUpdate = true;
    for (const f of this.flashes) if (f.t > 0) { f.t -= dt; if (f.t <= 0) { f.s.visible = false; } else f.s.material.opacity = 1; }
  }
}
