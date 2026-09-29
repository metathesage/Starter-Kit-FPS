/**
 * Character movement — the Quake-lineage acceleration model that Halo inherits.
 *
 * Why not lerp toward a target velocity: with a plain lerp, strafing kills
 * momentum and air-strafing does not work. Halo/Quake strafe-jumping only feels
 * right with `accelerate()`, which adds speed along the *wish direction* up to a
 * per-tick cap and projects out the excess. That single function is the
 * difference between "a shooter" and "this shooter".
 *
 * All timings are tuned against the spec in DESIGN.md, and every value that
 * affects feel is named here rather than inlined at the call site.
 */

import * as THREE from '../../vendor/three/build/three.module.js';
import { makeContact } from '../world/collision.js';

export const MOVE = {
  // Ground
  maxSpeed: 6.4,          // m/s walk/run
  sprintSpeed: 8.4,
  crouchSpeed: 3.2,
  adsSpeed: 3.6,
  groundAccel: 62,        // m/s^2 — high, so direction changes feel immediate
  airAccel: 9.0,          // ~14% of ground; still enough for air-strafe
  friction: 8.2,          // higher = stops faster
  stopSpeed: 2.4,         // below this, friction is applied at full strength
  // Jump
  // Apex is v^2 / 2g. v=7.35, g=19.6 -> 1.38m, but the capsule's contact skin
  // and the frame in which it leaves the floor cost ~0.3m, so the measured apex
  // is ~1.1m. Tuned against tools/test-movement.mjs, which asserts the band.
  jumpSpeed: 7.35,
  gravity: 19.6,
  coyoteTime: 0.11,       // grace period to jump after leaving ground
  jumpBuffer: 0.13,       // grace period for a jump pressed just before landing
  // Slide
  slideSpeed: 9.2,        // launch speed
  slideMinTime: 0.22,
  slideFriction: 1.4,
  slideBoost: 1.6,        // forward boost when sliding
  // Crouch
  standHeight: 1.80,
  crouchHeight: 1.10,
  crouchLerp: 12.0,       // how fast the capsule height changes
  // Body
  radius: 0.36,
  stepHeight: 0.62,
  // Feel
  viewBobAmp: 0.028,
  viewBobFreq: 1.55,
  sprintFovBoost: 7.0,
  adsFovScale: 0.62,
  landDipAmount: 0.09,
};

const UP = new THREE.Vector3(0, 1, 0);
const _probe = new THREE.Vector3();
const _probeDir = new THREE.Vector3();

export class Character {
  constructor(collision) {
    this.collision = collision;

    this.pos = new THREE.Vector3();       // foot position
    this.vel = new THREE.Vector3();
    this.height = MOVE.standHeight;
    this.wantCrouch = false;
    this.grounded = false;
    this.wasGrounded = false;
    this.groundNormal = new THREE.Vector3(0, 1, 0);

    this.yaw = 0;
    this.pitch = 0;

    this.coyote = 0;
    this.jumpBuffered = 0;
    this.sliding = false;
    this.slideTime = 0;
    this.slideDir = new THREE.Vector3();
    this.justLanded = 0;                   // impact speed, decays
    this.airTime = 0;
    this.lastWish = new THREE.Vector3();
    this.speed = 0;
    this.sprinting = false;

    this._contact = makeContact();
    this._wish = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._delta = new THREE.Vector3();
    this.events = [];                      // consumed by the game each tick
  }

  spawn(x, y, z, yaw = 0) {
    // Drop onto the surface so the first frame is grounded. Spawn points are
    // nav-grid cell centres and can be a few cm above or below the real mesh;
    // without settling here, a spawn can start a frame airborne and the very
    // first jump press falls inside coyote time and is swallowed.
    const gy = this.collision.groundHeight(x, z, y + 3, 8);
    this.pos.set(x, gy === null ? y : gy, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.height = MOVE.standHeight;
    this.grounded = true;
    this.wasGrounded = true;
    this.coyote = MOVE.coyoteTime;
    this.sliding = false;
    this.justLanded = 0;
    this.airTime = 0;
    this.events.length = 0;
    this.collision.resolveCapsule(this.pos, MOVE.radius, this.height, this._contact);
  }

  get eyeHeight() { return this.height * 0.88; }
  get eyePosition() { return this._tmp.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z); }
  get isCrouching() { return this.height < (MOVE.standHeight + MOVE.crouchHeight) * 0.5; }

  /**
   * @param {number} dt        fixed timestep
   * @param {object} cmd       { moveX, moveZ, jump, jumpPressed, crouch, sprint, ads, yaw }
   */
  update(dt, cmd) {
    this.events.length = 0;
    this.wasGrounded = this.grounded;

    if (cmd.yaw !== undefined) this.yaw = cmd.yaw;

    this._buildWish(cmd);

    // crouch state and capsule height
    this.wantCrouch = !!cmd.crouch;
    const targetH = this.wantCrouch ? MOVE.crouchHeight : MOVE.standHeight;
    if (this.height < targetH) {
      // Only stand up if there is room.
      const want = Math.min(targetH, this.height + MOVE.crouchLerp * dt);
      if (this._canStand(want)) this.height = want;
    } else {
      this.height = Math.max(targetH, this.height - MOVE.crouchLerp * dt);
    }

    this.sprinting = !!cmd.sprint && !this.wantCrouch && cmd.moveZ > 0.1 && this.grounded;

    // jump: buffered + coyote
    if (cmd.jumpPressed) this.jumpBuffered = MOVE.jumpBuffer;
    this.jumpBuffered = Math.max(0, this.jumpBuffered - dt);
    this.coyote = this.grounded ? MOVE.coyoteTime : Math.max(0, this.coyote - dt);

    if (this.jumpBuffered > 0 && this.coyote > 0) {
      this.vel.y = MOVE.jumpSpeed;
      this.jumpBuffered = 0;
      this.coyote = 0;
      this.grounded = false;
      this.sliding = false;
      this.events.push({ type: 'jump' });
    }

    // slide start
    const wantSlide = this.wantCrouch && this.grounded && this.vel.lengthSq() > 36 && !this.sliding;
    if (wantSlide) {
      this.sliding = true;
      this.slideTime = 0;
      this.slideDir.copy(this.vel).setY(0);
      if (this.slideDir.lengthSq() > 1e-6) this.slideDir.normalize();
      this.vel.y = 0;
      const boost = Math.max(this.vel.length(), MOVE.slideSpeed) * 0.55 + MOVE.slideBoost;
      this.vel.set(this.slideDir.x * boost, 0, this.slideDir.z * boost);
      this.events.push({ type: 'slide' });
    }
    if (this.sliding) {
      this.slideTime += dt;
      const canEnd = !this.wantCrouch || this.slideTime > MOVE.slideMinTime;
      if (canEnd) this.sliding = false;
    }

    this._accelerate(dt, cmd);

    // integrate
    this._delta.copy(this.vel).multiplyScalar(dt);
    const before = this.pos.y;
    this.pos.add(this._delta);
    this.vel.y -= MOVE.gravity * dt;

    // resolve
    const c = this.collision.resolveCapsule(this.pos, MOVE.radius, this.height, this._contact);
    this.grounded = c.grounded;
    this.groundNormal.copy(c.groundNormal);

    if (c.wall && this.vel.lengthSq() > 0) {
      // Project velocity onto the wall plane so we slide instead of sticking.
      const n = c.wallNormal;
      const d = this.vel.dot(n);
      if (d < 0) this.vel.addScaledVector(n, -d);
    }
    if (c.ceiling && this.vel.y > 0) this.vel.y = 0;
    if (c.grounded && this.vel.y < 0) this.vel.y = 0;

    if (this.grounded && !this.wasGrounded) {
      const impact = Math.max(0, (before - this.pos.y) / Math.max(dt, 1e-5));
      this.justLanded = impact;
      this.events.push({ type: 'land', impact });
    }
    if (!this.grounded) this.airTime += dt; else this.airTime = 0;
    this.justLanded *= Math.max(0, 1 - dt * 8);

    this.speed = Math.hypot(this.vel.x, this.vel.z);
  }

  _buildWish(cmd) {
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // forward = (-sin, 0, -cos) for a Y-up right-handed frame
    this._fwd.set(-sin, 0, -cos);
    this._right.set(cos, 0, -sin);
    this._wish.set(0, 0, 0)
      .addScaledVector(this._fwd, cmd.moveZ)
      .addScaledVector(this._right, cmd.moveX);
    if (this._wish.lengthSq() > 1) this._wish.normalize();
    this.lastWish.copy(this._wish);
  }

  _accelerate(dt, cmd) {
    const wish = this._wish;
    const wishLen = wish.length();

    if (this.sliding) {
      // Slides ignore steering: friction only.
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0.01) {
        const drop = sp * MOVE.slideFriction * dt;
        const scale = Math.max(0, sp - drop) / sp;
        this.vel.x *= scale;
        this.vel.z *= scale;
      }
      return;
    }

    // Friction first (Quake order: friction, then accelerate).
    if (this.grounded) {
      const sp = this.speed;
      if (sp > 0.01) {
        const control = sp < MOVE.stopSpeed ? MOVE.stopSpeed : sp;
        const drop = control * MOVE.friction * dt;
        const newSp = Math.max(0, sp - drop);
        const scale = newSp / sp;
        this.vel.x *= scale;
        this.vel.z *= scale;
      } else {
        this.vel.x = 0;
        this.vel.z = 0;
      }
    }

    if (wishLen < 1e-4) return;

    let maxSpeed = MOVE.maxSpeed;
    if (this.sprinting) maxSpeed = MOVE.sprintSpeed;
    else if (this.isCrouching) maxSpeed = MOVE.crouchSpeed;
    if (cmd.ads) maxSpeed = Math.min(maxSpeed, MOVE.adsSpeed);

    // Cap the existing speed along the wish direction; accelerate up to it.
    const current = this.vel.x * wish.x + this.vel.z * wish.z;
    const addSpeed = maxSpeed - current;
    if (addSpeed <= 0) return;

    let accel = this.grounded ? MOVE.groundAccel : MOVE.airAccel;
    // Air control is boosted when moving along existing momentum (air-strafe).
    if (!this.grounded && cmd.moveZ > 0) accel *= 1.55;

    let accelSpeed = accel * wishLen * dt;
    if (accelSpeed > addSpeed) accelSpeed = addSpeed;

    this.vel.x += wish.x * accelSpeed;
    this.vel.z += wish.z * accelSpeed;
  }

  /**
   * Would a capsule of `height` fit at the current position?
   * Probes upward from the head; a ceiling within reach means we must stay
   * crouched. Restores the position exactly — this is a pure query.
   */
  _canStand(height) {
    const headY = this.pos.y + height;
    _probe.set(this.pos.x, headY - 0.05, this.pos.z);
    _probeDir.set(0, 1, 0);
    const hit = this.collision.raycast(_probe, _probeDir, height - (headY - this.pos.y) + 0.05, 0);
    return !hit;
  }

  /** Write the camera basis for this frame. */
  applyToCamera(camera) {
    camera.position.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(this.yaw);
    camera.rotateX(this.pitch);
  }
}
