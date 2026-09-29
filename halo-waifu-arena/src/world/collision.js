/**
 * Static world collision against the baked BVH.
 *
 * Provides:
 *   raycast(origin, dir, maxDist)     - hitscan / line of sight
 *   queryBox(min, max, out)           - BVH range query (candidate triangles)
 *   resolveCapsule(pos, r, h)         - depenetrate a vertical capsule
 *   groundProbe(pos, r)               - standing check
 *   groundHeight(x, z, fromY)         - surface height under a point
 *
 * The BVH is the arena's real triangle data, so what you see is what you hit.
 * Character hitboxes are NOT here — those are capsules tested in weapons.js, so
 * a hitscan is never blocked by a target's own skinned mesh.
 */

import * as THREE from '../../vendor/three/build/three.module.js';

const NF = 13;   // floats per BVH node: bmin3 bmax3 start count axis leftChild pad

/* scratch — the collision path is allocation-free on purpose */
const _v0 = new THREE.Vector3();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();
const _n = new THREE.Vector3();

/* Direction set for capsule probing: a vertical pair (floor/ceiling) plus an
   8-way horizontal ring, so a body can never slip through a corner. */
const RING_DIRS = (() => {
  const d = [
    { x: 0, y: -1, z: 0 },   // down — ground
    { x: 0, y: 1, z: 0 },    // up   — ceiling
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    d.push({ x: Math.cos(a), y: 0, z: Math.sin(a) });
  }
  return d;
})();
const CAPSULE_SAMPLES = 3;   // feet, waist, head
const _c1 = new THREE.Vector3();
const _c2 = new THREE.Vector3();
const _c3 = new THREE.Vector3();
const _c4 = new THREE.Vector3();
const _c5 = new THREE.Vector3();

export class Collision {
  constructor(buffer) {
    // `buffer` may be a Node Buffer (byteOffset != 0) or a raw ArrayBuffer.
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const ab = bytes.buffer;
    const base = bytes.byteOffset;
    let off = 0;
    const f = new Float32Array(ab, base + off, 12);
    this.vertCount = f[0] | 0;
    this.triCount = f[1] | 0;
    this.nodeCount = f[2] | 0;
    this.matCount = f[3] | 0;
    this.min = new THREE.Vector3(f[4], f[5], f[6]);
    this.max = new THREE.Vector3(f[7], f[8], f[9]);
    off += 48;

    this.positions = new Float32Array(ab, base + off, this.vertCount * 3);
    off += this.vertCount * 12;
    this.indices = new Uint32Array(ab, base + off, this.triCount * 3);
    off += this.triCount * 12;
    this.order = new Uint32Array(ab, base + off, this.triCount);
    off += this.triCount * 4;
    this.matIds = new Uint16Array(ab, base + off, this.triCount);
    off += this.triCount * 2;
    if (off % 4 !== 0) off += (4 - (off % 4));
    this.bvh = new Float32Array(ab, base + off, this.nodeCount * NF);
    off += this.nodeCount * NF * 4;

    const nameLen = new Uint32Array(ab, base + off, 1)[0];
    off += 4;
    this.matNames = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, base + off, nameLen)));

    this._stack = new Int32Array(96);
    this._lastDist = 0;
    this._cand = new Int32Array(4096);
  }

  triAt(t, a, b, c) {
    const i = t * 3, p = this.positions, ix = this.indices;
    const ia = ix[i] * 3, ib = ix[i + 1] * 3, ic = ix[i + 2] * 3;
    a.set(p[ia], p[ia + 1], p[ia + 2]);
    b.set(p[ib], p[ib + 1], p[ib + 2]);
    c.set(p[ic], p[ic + 1], p[ic + 2]);
  }

  /* --------------------------------------------------------------- raycast */

  /**
   * @returns {null | {distance, point, normal, mat, matName, tri}}
   */
  raycast(origin, dir, maxDist = 300, skipStart = 0) {
    // Guard against a zero component producing Infinity in the slab test.
    const ix = 1 / (Math.abs(dir.x) < 1e-9 ? (dir.x < 0 ? -1e-9 : 1e-9) : dir.x);
    const iy = 1 / (Math.abs(dir.y) < 1e-9 ? (dir.y < 0 ? -1e-9 : 1e-9) : dir.y);
    const iz = 1 / (Math.abs(dir.z) < 1e-9 ? (dir.z < 0 ? -1e-9 : 1e-9) : dir.z);
    const b = this.bvh;
    let best = maxDist;
    let bestTri = -1;
    const stack = this._stack;
    let sp = 0;
    stack[sp++] = 0;

    while (sp > 0) {
      const o = stack[--sp] * NF;
      let t0 = (b[o] - origin.x) * ix, t1 = (b[o + 3] - origin.x) * ix;
      let tmin = Math.min(t0, t1), tmax = Math.max(t0, t1);
      t0 = (b[o + 1] - origin.y) * iy, t1 = (b[o + 4] - origin.y) * iy;
      tmin = Math.max(tmin, Math.min(t0, t1)); tmax = Math.min(tmax, Math.max(t0, t1));
      t0 = (b[o + 2] - origin.z) * iz, t1 = (b[o + 5] - origin.z) * iz;
      tmin = Math.max(tmin, Math.min(t0, t1)); tmax = Math.min(tmax, Math.max(t0, t1));
      if (tmax < Math.max(tmin, 0) || tmin > best) continue;

      const count = b[o + 7] | 0;
      if (count === 0) {
        if (sp + 2 <= stack.length) {
          stack[sp++] = b[o + 9] | 0;
          stack[sp++] = b[o + 10] | 0;
        }
        continue;
      }
      const start = b[o + 6] | 0;
      for (let i = 0; i < count; i++) {
        const t = this.order[start + i];
        if (this._rayTri(origin, dir, t, skipStart, best)) {
          best = this._lastDist;
          bestTri = t;
        }
      }
    }

    if (bestTri < 0) return null;
    this.triAt(bestTri, _v0, _v1, _v2);
    _n.crossVectors(_e1.subVectors(_v1, _v0), _e2.subVectors(_v2, _v0));
    if (_n.lengthSq() < 1e-16) _n.set(0, 1, 0); else _n.normalize();
    if (_n.dot(dir) > 0) _n.negate();
    return {
      distance: best,
      point: new THREE.Vector3().copy(origin).addScaledVector(dir, best),
      normal: _n.clone(),
      mat: this.matIds[bestTri],
      matName: this.matNames[this.matIds[bestTri]] ?? 'default',
      tri: bestTri,
    };
  }

  _rayTri(origin, dir, t, skipStart, maxBest) {
    const i = t * 3, p = this.positions, ix = this.indices;
    const ia = ix[i] * 3, ib = ix[i + 1] * 3, ic = ix[i + 2] * 3;
    const ax = p[ia], ay = p[ia + 1], az = p[ia + 2];
    const e1x = p[ib] - ax, e1y = p[ib + 1] - ay, e1z = p[ib + 2] - az;
    const e2x = p[ic] - ax, e2y = p[ic + 1] - ay, e2z = p[ic + 2] - az;

    const px = dir.y * e2z - dir.z * e2y;
    const py = dir.z * e2x - dir.x * e2z;
    const pz = dir.x * e2y - dir.y * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (det > -1e-12 && det < 1e-12) return false;
    const inv = 1 / det;
    const tx = origin.x - ax, ty = origin.y - ay, tz = origin.z - az;
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < -1e-6 || u > 1 + 1e-6) return false;
    const qx = ty * e1z - tz * e1y;
    const qy = tz * e1x - tx * e1z;
    const qz = tx * e1y - ty * e1x;
    const v = (dir.x * qx + dir.y * qy + dir.z * qz) * inv;
    if (v < -1e-6 || u + v > 1 + 1e-6) return false;
    const dist = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (dist < skipStart || dist > maxBest) return false;
    this._lastDist = dist;
    return true;
  }

  occluded(from, to, slack = 0.05) {
    _v3.subVectors(to, from);
    const d = _v3.length();
    if (d < 1e-4) return false;
    _v3.multiplyScalar(1 / d);
    return !!this.raycast(from, _v3, d - slack, 0.02);
  }

  /* ------------------------------------------------------- box range query */

  /** Collect triangle indices whose AABB overlaps the box. Fills this._cand. */
  queryBox(minX, minY, minZ, maxX, maxY, maxZ) {
    let n = 0;
    const cand = this._cand;
    const b = this.bvh;
    const stack = this._stack;
    let sp = 0;
    stack[sp++] = 0;
    while (sp > 0) {
      const o = stack[--sp] * NF;
      if (b[o] > maxX || b[o + 3] < minX) continue;
      if (b[o + 1] > maxY || b[o + 4] < minY) continue;
      if (b[o + 2] > maxZ || b[o + 5] < minZ) continue;
      const count = b[o + 7] | 0;
      if (count === 0) {
        if (sp + 2 <= stack.length) {
          stack[sp++] = b[o + 9] | 0;
          stack[sp++] = b[o + 10] | 0;
        }
        continue;
      }
      const start = b[o + 6] | 0;
      for (let i = 0; i < count; i++) {
        if (n >= cand.length) return n;
        cand[n++] = this.order[start + i];
      }
    }
    return n;
  }

  /* -------------------------------------------------- capsule vs triangle */

  /**
   * Push a vertical capsule out of the world.
   * `pos` is the FOOT position (feet on the ground), mutated in place.
   *
   * Implementation note: this uses raycasts only — no point-triangle distance
   * maths. A closest-point-on-triangle routine is the obvious approach, but a
   * correct one needs five Voronoi region tests with easily-missed sign
   * conventions, and a subtly wrong one makes bodies sink through the floor.
   * Casting rays against the BVH is already fast (~7us) and is exact for
   * "is there a surface within R of this point", which is all a vertical
   * character capsule needs.
   *
   * @param {THREE.Vector3} pos    foot position
   * @param {number} radius
   * @param {number} height
   * @param {object} out            contact report
   */
  resolveCapsule(pos, radius, height, out) {
    out.grounded = false;
    out.ceiling = false;
    out.wall = false;
    out.groundNormal.set(0, 1, 0);
    out.wallNormal.set(0, 0, 0);
    out.wallNormalCount = 0;
    out.pushX = 0;
    out.pushZ = 0;

    // Contact skin: a body resting on a floor sits at distance == radius, and
    // float error would otherwise make that contact flicker.
    const skin = 0.012;
    const reach = radius + skin;

    for (let pass = 0; pass < 3; pass++) {
      // Probe points along the capsule axis. The feet and head are probed at
      // the true cap CENTRES (pos.y + radius, pos.y + height - radius); the
      // horizontal ring is probed at three heights because a body can catch a
      // wall with its shins, waist or shoulders.
      const yBot = pos.y + radius;
      const yTop = pos.y + height - radius;
      let bestDepth = 0, bnx = 0, bny = 0, bnz = 0, bpx = 0, bpy = 0, bpz = 0, rank = -1;

      for (let s = 0; s < CAPSULE_SAMPLES; s++) {
        const sy = yBot + (yTop - yBot) * (s / (CAPSULE_SAMPLES - 1));
        for (let d = 0; d < RING_DIRS.length; d++) {
          const dir = RING_DIRS[d];
          _v3.set(pos.x, sy, pos.z);
          _v4.set(dir.x, dir.y, dir.z);
          const hit = this.raycast(_v3, _v4, reach, 0);
          if (!hit) continue;
          // A surface within `reach` of the axis point means the body overlaps
          // it by the shortfall. Push back along the ray to touch.
          const depth = reach - hit.distance;
          if (depth <= 0) continue;
          const ny = hit.normal.y;
          const r = ny > 0.5 ? 3 : (Math.abs(ny) <= 0.5 ? 2 : 0);
          if (r > rank || (r === rank && depth > bestDepth)) {
            bestDepth = depth; rank = r;
            // Resolve along the surface normal, not the ray direction: on a
            // slope they differ, and pushing along the ray would slide the
            // body sideways instead of lifting it off the surface.
            bnx = hit.normal.x; bny = hit.normal.y; bnz = hit.normal.z;
            bpx = hit.point.x; bpy = hit.point.y; bpz = hit.point.z;
          }
        }
      }

      if (bestDepth <= 0) return out;

      pos.x += bnx * bestDepth;
      pos.y += bny * bestDepth;
      pos.z += bnz * bestDepth;

      if (bny > 0.5) {
        out.grounded = true;
        out.groundNormal.set(bnx, bny, bnz).normalize();
        if (pos.y - bpy < 0.12) pos.y = bpy - skin;
      } else if (bny < -0.5) {
        out.ceiling = true;
      } else {
        out.wall = true;
        out.wallNormalCount++;
        out.wallNormal.set(out.wallNormal.x + bnx, out.wallNormal.y + bny, out.wallNormal.z + bnz);
        out.pushX += bnx;
        out.pushZ += bnz;
      }
      if (bestDepth < 1e-4) return out;
    }
    if (out.wallNormalCount) out.wallNormal.normalize();
    return out;
  }

  /* -------------------------------------------------------------- queries */

  /** Cheap standing check used every frame by the player and bots. */
  groundProbe(pos, radius, probe = 0.22) {
    const skin = 0.03;
    const reach = radius + skin;
    // Down from just above the feet, and outward at knee height, so standing on
    // a lip or a stair edge still registers.
    for (const sy of [pos.y + 0.05, pos.y + 0.45]) {
      for (const dir of RING_DIRS) {
        _v3.set(pos.x, sy, pos.z);
        _v4.set(dir.x, dir.y, dir.z);
        const hit = this.raycast(_v3, _v4, reach + (dir.y < 0 ? probe : 0), 0);
        if (hit && hit.normal.y > 0.6) return true;
      }
    }
    return false;
  }

  /** Surface height under (x,z) at or below fromY, or null. */
  groundHeight(x, z, fromY, maxDrop = 14) {
    _v3.set(x, fromY + 0.4, z);
    _v4.set(0, -1, 0);
    const hit = this.raycast(_v3, _v4, maxDrop + 0.4, 0);
    if (!hit || hit.normal.y < 0.55) return null;
    return hit.point.y;
  }

  /** Is there room for a standing capsule here? (spawn validation) */
  isFree(x, y, z, radius = 0.36, height = 1.8) {
    const test = _freePos.set(x, y, z);
    const res = _freeRes;
    const saveY = y, saveX = x, saveZ = z;
    this.resolveCapsule(test, radius, height, res);
    return Math.hypot(test.x - saveX, test.y - saveY, test.z - saveZ) < 0.15;
  }
}

const _freePos = new THREE.Vector3();
const _freeRes = {
  grounded: false, ceiling: false, wall: false,
  groundNormal: new THREE.Vector3(), wallNormal: new THREE.Vector3(),
  wallNormalCount: 0, pushX: 0, pushZ: 0,
};

export function makeContact() {
  return {
    grounded: false, ceiling: false, wall: false,
    groundNormal: new THREE.Vector3(0, 1, 0),
    wallNormal: new THREE.Vector3(),
    wallNormalCount: 0, pushX: 0, pushZ: 0,
  };
}
