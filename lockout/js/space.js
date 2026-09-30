// Menu stage: a living planet, a Milky Way band, twinkling stars and shooting stars. The operator stands on a deco disc in front of it.
// Everything is procedural (no textures). Built once, parked far from the maps, shown while a menu is up.
import * as THREE from 'three';

const NOISE = `
float h31(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + 11.7; a *= .5; } return s; }
`;

const SKY_V = 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }';
const SKY_F = NOISE + `varying vec3 vD; uniform float t;
void main(){
  vec3 d = normalize(vD);
  vec3 bn = normalize(vec3(.35, .82, -.45));                       // galactic plane normal
  float lat = dot(d, bn);
  float band = exp(-pow(lat / .21, 2.));
  float core = exp(-pow(lat / .09, 2.)) * smoothstep(.2, 1., dot(d, normalize(vec3(-.6, .1, -.8))) * .5 + .5);
  float n = fbm(d * 5.5), n2 = fbm(d * 13. + 3.);
  float lane = smoothstep(.42, .72, fbm(d * 8. + vec3(0., 4., 0.))) * band;       // dust lanes
  vec3 col = vec3(.008, .012, .03);
  col += vec3(.16, .2, .42) * band * (.55 + n * 1.3);
  col += vec3(.9, .6, .34) * core * (.5 + n2) * .9;
  col += vec3(.35, .18, .42) * exp(-pow((lat - .18) / .16, 2.)) * n2 * .22;         // violet nebula haze
  col *= 1. - lane * .72;
  // dense faint stars riding the band
  vec3 g = d * 260.; vec3 id = floor(g); float r = h31(id); float m = step(.9925 - band * .035, r);
  float tw = .65 + .35 * sin(t * (1.2 + r * 5.) + r * 40.);
  col += m * tw * vec3(.85, .9, 1.) * (.35 + r) * smoothstep(.5, 0., length(fract(g) - .5));
  gl_FragColor = vec4(col, 1.);
}`;

const PLANET_V = 'varying vec3 vN; varying vec3 vP; varying vec3 vW; void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position, 1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }';
const PLANET_F = NOISE + `varying vec3 vN; varying vec3 vP; varying vec3 vW; uniform vec3 sun; uniform float t; uniform vec3 cam;
void main(){
  vec3 n = normalize(vN), p = normalize(vP);
  float rot = t * .02;
  vec3 q = vec3(p.x * cos(rot) - p.z * sin(rot), p.y, p.x * sin(rot) + p.z * cos(rot));
  float h = fbm(q * 2.6) * .7 + fbm(q * 7.) * .3;
  float sea = smoothstep(.49, .53, h);
  vec3 ocean = mix(vec3(.01, .04, .16), vec3(.03, .22, .42), smoothstep(.3, .5, h));
  vec3 land = mix(vec3(.10, .32, .12), vec3(.46, .38, .22), smoothstep(.55, .72, h));
  land = mix(land, vec3(.9), smoothstep(.72, .85, h));
  float lat = abs(q.y); float ice = smoothstep(.78, .93, lat + (fbm(q * 5.) - .5) * .18);
  vec3 alb = mix(ocean, land, sea); alb = mix(alb, vec3(.92, .95, 1.), ice);
  // clouds drift faster than the ground
  float cr = t * .035; vec3 cq = vec3(p.x * cos(cr) - p.z * sin(cr), p.y, p.x * sin(cr) + p.z * cos(cr));
  float cl = smoothstep(.52, .78, fbm(cq * 3.4 + vec3(0., 3., 0.)) * .8 + fbm(cq * 9.) * .25);
  alb = mix(alb, vec3(1.), cl * .85);
  float ndl = dot(n, normalize(sun)), day = smoothstep(-.08, .22, ndl);
  vec3 c = alb * (.03 + day * 1.25);
  // ocean glint
  vec3 v = normalize(cam - vW); vec3 hh = normalize(normalize(sun) + v); float spec = pow(max(dot(n, hh), 0.), 90.) * (1. - sea) * (1. - cl) * day; c += vec3(1., .95, .8) * spec * .9;
  // night: city lights on the land, aurora at the poles
  float night = 1. - smoothstep(-.12, .12, ndl);
  float city = smoothstep(.72, .9, fbm(q * 26.)) * sea * (1. - ice) * (1. - cl * .8);
  c += vec3(1., .72, .35) * city * night * 1.6;
  float au = smoothstep(.72, .92, lat) * smoothstep(.6, 1., fbm(q * vec3(6., 1.5, 6.) + t * .1)) * night;
  c += vec3(.1, 1., .6) * au * .9;
  // terminator warm edge + rim
  float rim = pow(1. - max(dot(n, v), 0.), 3.);
  c += vec3(.25, .5, 1.) * rim * (.15 + day * .55);
  c += vec3(1., .5, .2) * smoothstep(.0, .2, 1. - abs(ndl - .02) * 6.) * .06 * rim;
  gl_FragColor = vec4(c, 1.);
}`;
const ATMO_F = 'varying vec3 vN; varying vec3 vW; uniform vec3 sun; uniform vec3 cam; void main(){ vec3 v = normalize(cam - vW); float f = pow(1. - abs(dot(normalize(vN), v)), 2.4); float d = smoothstep(-.35, .5, dot(normalize(vN), normalize(sun))); gl_FragColor = vec4(mix(vec3(.05, .2, .6), vec3(.35, .65, 1.), d) * f * (.25 + d * 1.6), f * (.35 + d * .65)); }';

export function buildSpace(scene, center = new THREE.Vector3(0, 3000, 0)) {
  const root = new THREE.Group(); root.position.copy(center); root.visible = false; scene.add(root);
  const T = { value: 0 };
  // sky dome (renders behind everything, follows the camera)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 32), new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, uniforms: { t: T }, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false }));
  sky.renderOrder = -10; sky.frustumCulled = false; root.add(sky);
  // bright stars: sized points with twinkle
  { const n = 1800, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sz = new Float32Array(n), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), R = 420;
      pos.set([r * Math.cos(a) * R, u * R, r * Math.sin(a) * R], i * 3);
      const k = Math.random(), c = new THREE.Color().setHSL(k < .6 ? 0.6 : k < .85 ? 0.1 : 0.02, 0.5, 0.75 + Math.random() * 0.25); col.set([c.r, c.g, c.b], i * 3);
      sz[i] = 1 + Math.pow(Math.random(), 6) * 4.5; ph[i] = Math.random() * 10;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('size', new THREE.BufferAttribute(sz, 1)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
    const m = new THREE.ShaderMaterial({ uniforms: { t: T, px: { value: 1 } }, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
      vertexShader: 'attribute float size; attribute float ph; attribute vec3 color; varying vec3 vC; varying float vT; uniform float t; uniform float px; void main(){ vC = color; vT = .6 + .4 * sin(t * (1. + ph * .3) + ph * 7.); vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_Position.z = gl_Position.w * .999; gl_PointSize = size * px * (.8 + vT * .5); }',
      fragmentShader: 'varying vec3 vC; varying float vT; void main(){ vec2 c = gl_PointCoord - .5; float d = length(c); float a = smoothstep(.5, 0., d); a = a * a; gl_FragColor = vec4(vC * a * (1.4 + vT), a); }' });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = -9; root.add(pts); root.userData.starMat = m;
  }
  // the planet: 3 shells (surface, glow) + a small moon
  const sun = new THREE.Vector3(-0.55, 0.35, 0.6).normalize();
  const planet = new THREE.Group(); root.add(planet);
  const pm = new THREE.ShaderMaterial({ vertexShader: PLANET_V, fragmentShader: PLANET_F, uniforms: { sun: { value: sun }, t: T, cam: { value: new THREE.Vector3() } }, fog: false, toneMapped: false });
  const body = new THREE.Mesh(new THREE.SphereGeometry(60, 96, 64), pm); planet.add(body);
  const am = new THREE.ShaderMaterial({ vertexShader: PLANET_V, fragmentShader: ATMO_F, uniforms: { sun: { value: sun }, cam: pm.uniforms.cam }, transparent: true, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(63.5, 64, 48), am); planet.add(atmo);
  const moonMat = new THREE.ShaderMaterial({ uniforms: { sun: { value: sun } }, fog: false, toneMapped: false, vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix) * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }', fragmentShader: NOISE + 'varying vec3 vN; varying vec3 vP; uniform vec3 sun; void main(){ float d = max(dot(normalize(vN), normalize(sun)), 0.); float c = fbm(normalize(vP) * 5.) * .5 + .35; gl_FragColor = vec4(vec3(.72, .7, .66) * c * (.04 + d * 1.5), 1.); }' });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(4.2, 32, 24), moonMat); root.add(moon);
  // lights for the operator + platform
  const key = new THREE.DirectionalLight(0xfff0dc, 1.5); key.position.set(-4, 5, 6); const rim = new THREE.DirectionalLight(0x6fa8ff, 1.2); rim.position.set(6, 3, -5);
  root.add(key, rim, new THREE.HemisphereLight(0x5a78c0, 0x0a0a14, 0.35));
  // deco platform under the operator
  const plat = new THREE.Group(); root.add(plat);
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.35, metalness: 0.85 }), gold = new THREE.MeshStandardMaterial({ color: 0xe8bd62, roughness: 0.25, metalness: 1, emissive: 0x3a2808 }), glow = new THREE.MeshBasicMaterial({ color: 0xffe2a8, fog: false });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.18, 64), dark); disc.position.y = -0.11; plat.add(disc);
  for (const [r, w] of [[0.98, 0.016], [0.72, 0.01], [0.42, 0.01]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, w, 8, 96), r > 0.9 ? gold : glow); ring.rotation.x = Math.PI / 2; ring.position.y = 0.006; plat.add(ring); }
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, tick = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, i % 3 === 0 ? 0.14 : 0.07), gold); tick.position.set(Math.cos(a) * 0.86, 0.008, Math.sin(a) * 0.86); tick.rotation.y = -a; plat.add(tick); }
  const under = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.6, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.08, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); under.position.y = -0.85; under.rotation.x = Math.PI; plat.add(under);
  // shooting stars
  const shoots = []; const sm = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, fog: false, depthWrite: false });
  for (let i = 0; i < 3; i++) { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 14)]); const l = new THREE.Line(g, sm.clone()); l.frustumCulled = false; l.visible = false; l.userData = { t: -1 }; root.add(l); shoots.push(l); }
  let nextShoot = 2;
  const S = { root, plat, planet, sun, moon, T: 0 };
  // the ring: a Halo-scale megastructure arcing across the sky (models/space/halo_ring.glb)
  S.loadRing = async () => {
    const { GLTFLoader } = await import('../vendor/jsm/loaders/GLTFLoader.js'), loader = new GLTFLoader(), url = 'models/space/halo_ring.glb'; let gltf;
    try { gltf = await loader.loadAsync(url); }
    catch (e0) { const r = await fetch(url.replace(/\.glb$/, '.b64.txt')); if (!r.ok) throw e0; const bin = atob((await r.text()).trim()), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); gltf = await new Promise((res, rej) => loader.parse(buf.buffer, '', res, rej)); }
    const ring = gltf.scene, holder = new THREE.Group(); holder.add(ring);
    ring.traverse((o) => { if (!o.isMesh) return; o.frustumCulled = false; const m = o.material; const nm = new THREE.MeshBasicMaterial({ map: m.map || null, color: m.map ? 0xffffff : m.color, fog: false, toneMapped: true, side: THREE.DoubleSide, transparent: !!m.transparent, opacity: m.opacity, alphaTest: m.alphaTest }); o.material = nm; });
    const R = 520; ring.scale.setScalar(R * 2);
    holder.position.set(40, -318, -760);
    holder.rotation.set(0.42, 0, 0);
    root.add(holder); S.ring = holder; return holder;
  };
  S.place = (facing) => { // planet sits behind the operator, low and to the right of frame; `facing` = camera→operator direction
    const f = new THREE.Vector3(facing.x, 0, facing.z).normalize(), r = new THREE.Vector3(-f.z, 0, f.x);
    planet.position.copy(f.clone().multiplyScalar(230).add(r.clone().multiplyScalar(74)).add(new THREE.Vector3(0.55, -58, 0)));
    S.moonBase = f.clone().multiplyScalar(170).add(r.clone().multiplyScalar(-6)).add(new THREE.Vector3(0.55, 46, 0));
    S.f = f; S.r = r;
  };
  S.update = (dt, camera) => {
    S.T += dt; T.value = S.T; sky.position.copy(camera.position).sub(root.position);
    pm.uniforms.cam.value.copy(camera.position);
    root.userData.starMat.uniforms.px.value = Math.min(2.2, camera.userData.dpr || 1) * 1.2;
    if (S.ring) S.ring.rotation.z = S.T * 0.003;
    planet.rotation.y = 0;   // shader spins the surface; the shell stays put so the terminator holds
    if (S.moonBase) moon.position.copy(S.moonBase).add(S.r.clone().multiplyScalar(Math.sin(S.T * 0.05) * 8)).add(new THREE.Vector3(0, Math.cos(S.T * 0.05) * 2, 0));
    nextShoot -= dt;
    if (nextShoot < 0) { const l = shoots.find((q) => !q.visible); if (l) { const a = Math.random() * Math.PI * 2; l.position.set(Math.cos(a) * 200, 60 + Math.random() * 120, Math.sin(a) * 200); l.lookAt(l.position.clone().add(new THREE.Vector3(-Math.sin(a), -0.35, Math.cos(a)))); l.userData.t = 0; l.visible = true; } nextShoot = 3 + Math.random() * 6; }
    for (const l of shoots) if (l.visible) { l.userData.t += dt; const k = l.userData.t / 1.1; l.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.9; l.translateZ(dt * 140); if (k >= 1) l.visible = false; }
  };
  return S;
}
