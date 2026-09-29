// Post pipeline: HDR scene target -> soft-knee bright pass -> 4-level bloom chain (blurred) -> composite with grade, vignette,
// chromatic fringe and the renderer's ACES tone mapping. One code path, toggled from settings; falls back to a direct render.
import * as THREE from 'three';

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BRIGHT = `uniform sampler2D tScene; uniform float thr; varying vec2 vUv;
void main() { vec3 c = texture2D(tScene, vUv).rgb; float l = max(c.r, max(c.g, c.b)); float k = clamp((l - thr) / (thr * 0.8 + 0.001), 0.0, 1.0); k = k * k * (3.0 - 2.0 * k); gl_FragColor = vec4(min(c, vec3(24.0)) * k, 1.0); }`;
const DOWN = `uniform sampler2D tIn; uniform vec2 texel; varying vec2 vUv;
void main() { vec3 c = texture2D(tIn, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tIn, vUv + texel * vec2(1.0, -1.0)).rgb + texture2D(tIn, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tIn, vUv + texel * vec2(1.0, 1.0)).rgb; gl_FragColor = vec4(c * 0.25, 1.0); }`;
const BLUR = `uniform sampler2D tIn; uniform vec2 dir; varying vec2 vUv;
void main() { vec3 c = texture2D(tIn, vUv).rgb * 0.2270270; c += texture2D(tIn, vUv + dir * 1.3846153).rgb * 0.3162162; c += texture2D(tIn, vUv - dir * 1.3846153).rgb * 0.3162162; c += texture2D(tIn, vUv + dir * 3.2307692).rgb * 0.0702702; c += texture2D(tIn, vUv - dir * 3.2307692).rgb * 0.0702702; gl_FragColor = vec4(c, 1.0); }`;
const COMP = `uniform sampler2D tScene; uniform sampler2D tB0; uniform sampler2D tB1; uniform sampler2D tB2; uniform sampler2D tB3;
uniform float bloom; uniform vec3 tint; uniform float sat; uniform float con; uniform float vig; uniform float ca; uniform vec2 res; varying vec2 vUv;
float lum(vec3 c) { c = c / (1.0 + dot(c, vec3(0.3333))); return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 fxaa(vec2 uv, vec2 px) {
  vec3 rgbM = texture2D(tScene, uv).rgb;
  float lNW = lum(texture2D(tScene, uv + vec2(-px.x, -px.y)).rgb), lNE = lum(texture2D(tScene, uv + vec2(px.x, -px.y)).rgb), lSW = lum(texture2D(tScene, uv + vec2(-px.x, px.y)).rgb), lSE = lum(texture2D(tScene, uv + vec2(px.x, px.y)).rgb), lM = lum(rgbM);
  float mn = min(lM, min(min(lNW, lNE), min(lSW, lSE))), mx = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (mx - mn < max(0.03, mx * 0.12)) return rgbM;
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float dr = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0), rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + dr);
  dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * px;
  vec3 a = 0.5 * (texture2D(tScene, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tScene, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture2D(tScene, uv + dir * -0.5).rgb + texture2D(tScene, uv + dir * 0.5).rgb);
  float lB = lum(b); return (lB < mn || lB > mx) ? a : b;
}
void main() {
  vec2 d = vUv - 0.5; float r2 = dot(d, d);
  vec2 off = d * ca * (0.4 + r2 * 3.0);
  vec3 col = fxaa(vUv, 1.0 / res);
  col.r = mix(col.r, texture2D(tScene, vUv + off).r, 0.85); col.b = mix(col.b, texture2D(tScene, vUv - off).b, 0.85);
  vec3 b = texture2D(tB0, vUv).rgb * 0.36 + texture2D(tB1, vUv).rgb * 0.30 + texture2D(tB2, vUv).rgb * 0.22 + texture2D(tB3, vUv).rgb * 0.16;
  col += b * bloom;
  col *= tint;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, sat);
  col = (col - 0.18) * con + 0.18; col = max(col, 0.0);
  col *= 1.0 - vig * smoothstep(0.18, 0.62, r2 * 1.6);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Post {
  constructor(renderer, { samples = 0 } = {}) {
    this.r = renderer; this.on = true; this.samples = samples; this.w = 0; this.h = 0;
    this.grade = { tint: new THREE.Vector3(1, 1, 1), sat: 1.06, con: 1.05, bloom: 0.55, vig: 0.22, ca: 0.0008, thr: 1.1 };
    this.qs = new THREE.Scene(); this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); this.quad.frustumCulled = false; this.qs.add(this.quad);
    const M = (frag, u, tm = false) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms: u, depthTest: false, depthWrite: false, toneMapped: tm });
    this.mBright = M(BRIGHT, { tScene: { value: null }, thr: { value: 1.1 } });
    this.mDown = M(DOWN, { tIn: { value: null }, texel: { value: new THREE.Vector2() } });
    this.mBlur = M(BLUR, { tIn: { value: null }, dir: { value: new THREE.Vector2() } });
    this.mComp = M(COMP, { tScene: { value: null }, tB0: { value: null }, tB1: { value: null }, tB2: { value: null }, tB3: { value: null }, bloom: { value: 0.5 }, tint: { value: this.grade.tint }, sat: { value: 1 }, con: { value: 1 }, vig: { value: 0.2 }, ca: { value: 0.0007 }, res: { value: new THREE.Vector2(1, 1) } }, true);
    this.ok = true; this.k = 0; this.kt = performance.now();
  }
  kick(a) { this.k = Math.min(1.6, this.k + a); }
  setGrade(g) { Object.assign(this.grade, g); if (g.tint) this.grade.tint = new THREE.Vector3(...g.tint); }
  _rt(w, h, depth = false, samples = 0) {
    const hf = this.r.extensions.has('EXT_color_buffer_float') || this.r.extensions.has('EXT_color_buffer_half_float');
    return new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), { type: hf ? THREE.HalfFloatType : THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: depth, samples, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  }
  resize(w, h) {
    if (w === this.w && h === this.h && this.rt) return;
    this.w = w; this.h = h; this.dispose();
    try {
      this.rt = this._rt(w, h, true, this.samples);
      this.lv = []; this.tmp = [];
      for (let i = 1; i <= 4; i++) { this.lv.push(this._rt(w / 2 ** i, h / 2 ** i)); this.tmp.push(this._rt(w / 2 ** i, h / 2 ** i)); }
      this.ok = true;
    } catch (e) { console.warn('post pipeline unavailable', e); this.ok = false; }
  }
  dispose() { for (const t of [this.rt, ...(this.lv || []), ...(this.tmp || [])]) if (t) t.dispose(); this.rt = null; }
  pass(mat, u, target) {
    for (const k in u) mat.uniforms[k].value = u[k];
    this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.qc);
  }
  render(scene, camera) {
    const r = this.r;
    if (!this.on || !this.ok || !this.rt) { r.setRenderTarget(null); r.render(scene, camera); return; }
    const g = this.grade, now = performance.now(); this.k = Math.max(0, this.k - (now - this.kt) / 1000 * 1.8); this.kt = now; const k = this.k * this.k;
    r.setRenderTarget(this.rt); r.clear(); r.render(scene, camera);
    this.pass(this.mBright, { tScene: this.rt.texture, thr: g.thr }, this.lv[0]);
    for (let i = 1; i < 4; i++) this.pass(this.mDown, { tIn: this.lv[i - 1].texture, texel: this.mDown.uniforms.texel.value.set(0.5 / this.lv[i - 1].width, 0.5 / this.lv[i - 1].height) }, this.lv[i]);
    for (let i = 0; i < 4; i++) {
      const A = this.lv[i], B = this.tmp[i];
      this.pass(this.mBlur, { tIn: A.texture, dir: this.mBlur.uniforms.dir.value.set(1 / A.width, 0) }, B);
      this.pass(this.mBlur, { tIn: B.texture, dir: this.mBlur.uniforms.dir.value.set(0, 1 / A.height) }, A);
    }
    r.setRenderTarget(null);
    const u = this.mComp.uniforms;
    u.tScene.value = this.rt.texture; u.tB0.value = this.lv[0].texture; u.tB1.value = this.lv[1].texture; u.tB2.value = this.lv[2].texture; u.tB3.value = this.lv[3].texture;
    u.res.value.set(this.w, this.h); u.bloom.value = g.bloom + k * 0.55; u.tint.value = g.tint; u.sat.value = g.sat; u.con.value = g.con; u.vig.value = g.vig; u.ca.value = g.ca + k * 0.007;
    this.quad.material = this.mComp; r.render(this.qs, this.qc);
  }
}
