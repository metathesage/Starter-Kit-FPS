// Collapse many static meshes that share a material into one draw call.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js';

export function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map(), doomed = [];
  group.traverse((o) => {
    if (!o.isMesh || o.userData.keep) return;
    const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] }));
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    if (g.attributes.color) { b.color = true; (mergeStatic.cm ||= new Set()).add(o.material.uuid); }
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(n)) g.deleteAttribute(n);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    b.geos.push(g); doomed.push(o);
  });
  for (const o of doomed) { o.parent.remove(o); }
  for (const b of buckets.values()) {
    if (b.color || b.mat.vertexColors || (mergeStatic.cm && mergeStatic.cm.has(b.mat.uuid))) { for (const g of b.geos) if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)); if (!b.mat.vertexColors) { b.mat.vertexColors = true; b.mat.needsUpdate = true; } }
    else for (const g of b.geos) if (g.attributes.color) g.deleteAttribute('color');
    const merged = mergeGeometries(b.geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, b.mat);
    m.castShadow = b.cast; m.receiveShadow = b.recv;
    group.add(m);
  }
  // drop emptied sub-groups
  for (const c of [...group.children]) if (c.isGroup && c.children.length === 0) group.remove(c);
  return group;
}
