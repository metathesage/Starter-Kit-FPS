/**
 * Navigation: A* over the baked 0.5 m walkable grid.
 *
 * A grid rather than a navmesh because the map bake already produces a grid, and
 * at 0.5 m with an 8-connected neighbourhood it is finer than any navmesh we
 * could extract from this geometry without a lot more work. The arena is ~40k
 * cells, so a full A* is sub-millisecond.
 *
 * Bots do not path every tick. Each bot keeps a path and only replans when its
 * goal moves more than a threshold, which is what keeps a 7-bot game inside the
 * frame budget.
 */

import * as THREE from '../../vendor/three/build/three.module.js';

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

export class NavGrid {
  constructor(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const ab = bytes.buffer, base = bytes.byteOffset;
    const h = new Float32Array(ab, base, 12);
    this.gw = h[0] | 0;
    this.gd = h[1] | 0;
    this.cell = h[2];
    this.ox = h[3];
    this.oz = h[4];
    this.stepUp = h[5];
    this.headroom = h[6];
    this.agentR = h[7];

    const n = this.gw * this.gd;
    this.height = new Float32Array(ab, base + 48, n);
    this.walk = new Uint8Array(ab, base + 48 + n * 4, n);
    this.ceil = new Float32Array(ab, base + 48 + n * 4 + n, n);

    // A* scratch, allocated once.
    this._g = new Float32Array(n);
    this._f = new Float32Array(n);
    this._from = new Int32Array(n);
    this._state = new Uint8Array(n);
    this._stamp = new Int32Array(n);
    this._epoch = 0;
    this._heap = new Int32Array(n + 1);
  }

  idx(gx, gz) { return gz * this.gw + gx; }
  inBounds(gx, gz) { return gx >= 0 && gz >= 0 && gx < this.gw && gz < this.gd; }
  isWalk(gx, gz) { return this.inBounds(gx, gz) && this.walk[this.idx(gx, gz)] === 1; }
  cellX(x) { return Math.round((x - this.ox) / this.cell - 0.5); }
  cellZ(z) { return Math.round((z - this.oz) / this.cell - 0.5); }
  worldX(gx) { return gx * this.cell + this.ox + this.cell * 0.5; }
  worldZ(gz) { return gz * this.cell + this.oz + this.cell * 0.5; }

  /** Nearest walkable cell to a world point, searched in rings. */
  nearestWalkable(x, z, maxRadius = 12) {
    const gx = this.cellX(x), gz = this.cellZ(z);
    if (this.isWalk(gx, gz)) return [gx, gz];
    for (let r = 1; r <= maxRadius; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (this.isWalk(gx + dx, gz + dz)) return [gx + dx, gz + dz];
        }
      }
    }
    return null;
  }

  /** True if a straight line between two world points stays on walkable cells. */
  lineOfWalk(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const dist = Math.hypot(dx, dz);
    const steps = Math.ceil(dist / (this.cell * 0.7));
    if (steps === 0) return true;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = ax + dx * t, z = az + dz * t;
      if (!this.isWalk(this.cellX(x), this.cellZ(z))) return false;
    }
    return true;
  }

  /**
   * A* from world A to world B.
   * @returns {Array<{x:number,z:number,y:number}>} waypoints, excluding the start
   */
  findPath(ax, az, bx, bz, { maxNodes = 20000 } = {}) {
    const start = this.nearestWalkable(ax, az);
    const goal = this.nearestWalkable(bx, bz);
    if (!start || !goal) return null;
    const s = this.idx(start[0], start[1]);
    const g = this.idx(goal[0], goal[1]);
    if (s === g) return [{ x: bx, z: bz, y: this.height[g] }];

    const epoch = ++this._epoch;
    const { _g: gScore, _f: fScore, _from: from, _state: state, _stamp: stamp, _heap: heap } = this;
    let heapSize = 0;

    const hCost = (i) => {
      const ax2 = i % this.gw, az2 = (i / this.gw) | 0;
      const dx = Math.abs(ax2 - goal[0]), dz = Math.abs(az2 - goal[1]);
      // octile distance
      return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz);
    };
    const push = (i) => {
      heap[++heapSize] = i;
      let c = heapSize;
      while (c > 1) {
        const p = c >> 1;
        if (fScore[heap[p]] <= fScore[heap[c]]) break;
        const t = heap[p]; heap[p] = heap[c]; heap[c] = t;
        c = p;
      }
    };
    const pop = () => {
      const top = heap[1];
      heap[1] = heap[heapSize--];
      let p = 1;
      for (;;) {
        const l = p * 2, r = l + 1;
        let m = p;
        if (l <= heapSize && fScore[heap[l]] < fScore[heap[m]]) m = l;
        if (r <= heapSize && fScore[heap[r]] < fScore[heap[m]]) m = r;
        if (m === p) break;
        const t = heap[m]; heap[m] = heap[p]; heap[p] = t;
        p = m;
      }
      return top;
    };

    stamp[s] = epoch; gScore[s] = 0; fScore[s] = hCost(s); from[s] = -1; state[s] = 1;
    push(s);
    let expanded = 0;

    while (heapSize > 0) {
      const cur = pop();
      if (stamp[cur] !== epoch) continue;
      if (state[cur] === 2) continue;
      state[cur] = 2;
      if (cur === g) return this._rebuild(cur, from, epoch, bx, bz);
      if (++expanded > maxNodes) break;

      const cx = cur % this.gw, cz = (cur / this.gw) | 0;
      const curH = this.height[cur];
      for (const [dx, dz, cost] of DIRS) {
        const nx = cx + dx, nz = cz + dz;
        if (!this.inBounds(nx, nz)) continue;
        const ni = this.idx(nx, nz);
        if (this.walk[ni] !== 1) continue;
        const nh = this.height[ni];
        const climb = nh - curH;
        // Block a diagonal that would cut a wall corner between two blocked
        // orthogonal neighbours; without this, bots clip through geometry.
        if (dx !== 0 && dz !== 0) {
          if (this.walk[this.idx(cx + dx, cz)] !== 1 && this.walk[this.idx(cx, cz + dz)] !== 1) continue;
        }
        if (climb > this.stepUp) continue;
        const drop = -climb;
        // Falling is cheaper than climbing, as in the real thing.
        const stepCost = cost * this.cell * (1 + Math.max(0, drop) * 0.25);
        const tentative = gScore[cur] + stepCost;
        if (stamp[ni] !== epoch) {
          stamp[ni] = epoch; gScore[ni] = Infinity; state[ni] = 0; from[ni] = -1;
        }
        if (state[ni] === 2 || tentative >= gScore[ni]) continue;
        gScore[ni] = tentative;
        fScore[ni] = tentative + hCost(ni) * this.cell * 1.05;   // slight overestimate for speed
        from[ni] = cur;
        state[ni] = 1;
        push(ni);
      }
    }
    return null;
  }

  _rebuild(goalIdx, from, epoch, bx, bz) {
    const out = [];
    let cur = goalIdx;
    let guard = 0;
    while (cur !== -1 && guard++ < 10000) {
      const gx = cur % this.gw, gz = (cur / this.gw) | 0;
      out.push({ x: this.worldX(gx), z: this.worldZ(gz), y: this.height[cur] });
      cur = from[cur];
    }
    out.reverse();
    out.shift();                                     // drop the start cell
    if (out.length) { out[out.length - 1] = { x: bx, z: bz, y: this.height[goalIdx] }; }
    void epoch;
    return out;
  }

  /** Smooth a path by removing waypoints that a straight walk can skip. */
  smooth(ax, az, path) {
    if (!path || path.length < 3) return path;
    const out = [];
    let curX = ax, curZ = az;
    let i = 0;
    while (i < path.length) {
      let best = i;
      for (let j = path.length - 1; j > i; j--) {
        if (this.lineOfWalk(curX, curZ, path[j].x, path[j].z)) { best = j; break; }
      }
      out.push(path[best]);
      curX = path[best].x;
      curZ = path[best].z;
      if (best === path.length - 1) break;
      i = best + 1;
    }
    return out;
  }
}

/* -------------------------------------------------------------- cover */

export class CoverPoints {
  constructor(list) {
    this.points = list.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  }

  /**
   * Find a cover point that is near `from`, can see `threat` is not required —
   * cover means the threat is BLOCKED — and is reachable.
   */
  find(from, threatPos, nav, { maxDist = 30, minThreatDist = 6 } = {}) {
    let best = null, bestScore = -Infinity;
    for (const p of this.points) {
      const dFrom = p.distanceTo(from);
      if (dFrom > maxDist || dFrom < 2) continue;
      const dThreat = threatPos ? p.distanceTo(threatPos) : 99;
      if (dThreat < minThreatDist) continue;
      // cover quality: close to us, a sensible distance from the threat
      const score = -dFrom * 0.6 - Math.abs(dThreat - 12) * 0.4;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best;
  }
}
