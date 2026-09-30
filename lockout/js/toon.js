// Cel-shading kit: banded toon lighting + inverted-hull ink outline. Hides scan-quality meshes, sells the anime look.
import * as THREE from 'three';

let _grad = null;
export function toonGradient() {
  if (_grad) return _grad;
  const d = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 225, 225, 225, 255, 255, 255, 255, 255]);   // shade / mid / lit / spec
  _grad = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); _grad.minFilter = _grad.magFilter = THREE.NearestFilter; _grad.needsUpdate = true;
  return _grad;
}

let _soft = null;   // gentler bands for hard-surface props: more steps, brighter shadows, still reads as cel
export function softGradient() {
  if (_soft) return _soft;
  const v = [120, 165, 205, 235, 252, 255], d = new Uint8Array(v.flatMap((x) => [x, x, x, 255]));
  _soft = new THREE.DataTexture(d, v.length, 1, THREE.RGBAFormat); _soft.minFilter = _soft.magFilter = THREE.NearestFilter; _soft.needsUpdate = true;
  return _soft;
}

const _inkCache = new Map();
export function inkMaterial(color, width) {
  const key = color + ':' + width; if (_inkCache.has(key)) return _inkCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, fog: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uInk = { value: width };
    sh.vertexShader = 'uniform float uInk;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n transformed += normalize(normal) * uInk / length(modelMatrix[0].xyz);');
  };
  m.customProgramCacheKey = () => 'ink' + width;
  _inkCache.set(key, m); return m;
}

// hard-edge meshes have split normals, which tear the hull open: average normals of coincident vertices
export function smoothNormals(geo) {
  const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal;
  if (!n) return g;
  const acc = new Map(), k = (i) => Math.round(p.getX(i) * 2e3) + ',' + Math.round(p.getY(i) * 2e3) + ',' + Math.round(p.getZ(i) * 2e3);
  for (let i = 0; i < p.count; i++) { const key = k(i); let a = acc.get(key); if (!a) acc.set(key, a = [0, 0, 0]); a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); }
  const out = new THREE.BufferAttribute(new Float32Array(n.count * 3), 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { const a = acc.get(k(i)); v.set(a[0], a[1], a[2]).normalize(); out.setXYZ(i, v.x, v.y, v.z); }
  g.setAttribute('normal', out); return g;
}

// convert every standard material under `root` to toon and add an outline shell. Idempotent per mesh.
export function toonify(root, { ink = 0x07080d, width = 0.006, glow = null, saturate, soft = false } = {}) {
  saturate ??= soft ? 1.04 : 1.12;
  const grad = soft ? softGradient() : toonGradient(), swap = new Map(), inks = [];
  root.traverse((m) => {
    if (!m.isMesh || m.userData.toon || m.userData.outline || !m.material) return;
    m.userData.toon = true;
    if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();   // stripped-normal meshes would shade black
    const src = m.material;
    if (!swap.has(src)) {
      const t = new THREE.MeshToonMaterial({ map: src.map || null, color: src.color ? src.color.clone() : 0xffffff, gradientMap: grad, side: src.side, transparent: src.transparent, opacity: src.opacity, alphaTest: src.alphaTest, vertexColors: src.vertexColors });
      if (src.color && saturate !== 1) { const h = {}; t.color.getHSL(h); t.color.setHSL(h.h, Math.min(1, h.s * saturate), h.l); }
      if (src.emissive && (src.emissiveIntensity > 0.01 || src.emissiveMap)) {
        t.emissive.copy(src.emissive); t.emissiveIntensity = src.emissiveIntensity; t.emissiveMap = src.emissiveMap;
        if (src.emissiveMap && glow != null) t.emissive.setScalar(glow);
      }
      swap.set(src, t);
    }
    m.material = swap.get(src);
    if (m.isSkinnedMesh || m.material.transparent || (m.material.emissive && m.material.emissiveIntensity > 1.2)) return;   // glow parts stay unoutlined
    inks.push(m);
  });
  const shells = new Map();
  for (const m of inks) {
    if (!shells.has(m.geometry)) shells.set(m.geometry, smoothNormals(m.geometry));
    const o = new THREE.Mesh(shells.get(m.geometry), inkMaterial(ink, width));
    o.userData.outline = true; o.frustumCulled = false; o.renderOrder = -1; o.castShadow = false; o.receiveShadow = false;
    m.add(o);
  }
  return root;
}

// outline shell for a skinned mesh: same skeleton, hull pushed along averaged normals in bind space
export function outlineSkinned(mesh, { ink = 0x07080d, width = 0.008 } = {}) {
  mesh.geometry.userData.hull ||= smoothNormals(mesh.geometry);
  const o = new THREE.SkinnedMesh(mesh.geometry.userData.hull, inkMaterial(ink, width));
  o.userData.outline = true; o.frustumCulled = false; o.renderOrder = -1;
  mesh.parent.add(o); o.bind(mesh.skeleton, mesh.bindMatrix);
  return o;
}
