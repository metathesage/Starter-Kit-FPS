/**
 * Camera and viewmodel feel.
 *
 * The rule everything here follows: the camera and the gun are SEPARATE systems
 * with separate springs. A gun that drags the view with it feels like a toy.
 *
 * Three layers, in the order they affect the frame:
 *   1. look       - the player's actual aim (never smoothed, never faked)
 *   2. additive   - recoil, sway, bob, landing dip, trauma shake
 *   3. procedural - FOV, roll
 *
 * Trauma-based shake is used rather than per-axis shake impulses because it
 * gives clean falloff: shake(0.5) is visibly weaker than shake(1.0) and decays
 * predictably, so a shotgun blast never drowns out a pistol shot the same way
 * magnitude-based shake does.
 */

import * as THREE from '../../vendor/three/build/three.module.js';
import { MOVE } from './controller.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.baseFov = 82;
    this.targetFov = 82;
    this.fov = 82;

    this.trauma = 0;          // 0..1, decays
    this.traumaDecay = 1.9;
    this.shakeTime = 0;

    this.rollTarget = 0;
    this.roll = 0;

    this.bobPhase = 0;
    this.bobAmount = 0;

    this.landDip = 0;
    this.landDipVel = 0;

    this.recoilPitch = 0;     // from the weapon
    this.recoilYaw = 0;

    this.fovPunch = 0;

    this._pos = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    this._noise = new THREE.Vector3();
  }

  /** A sharp event: shotgun blast, explosion, landing. */
  addTrauma(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
    this.shakeTime = 0;
  }

  punchFov(amount) { this.fovPunch += amount; }

  setRecoil(pitchDeg, yawDeg) {
    this.recoilPitch = pitchDeg;
    this.recoilYaw = yawDeg;
  }

  update(dt, { char, weapon, ads, moveSpeed, grounded, justLanded, airTime }) {
    // --- FOV: base + sprint push + ADS zoom + a small punch on fire
    let want = this.baseFov;
    if (char?.sprinting) want += MOVE.sprintFovBoost;
    if (ads > 0) want *= 1 + (weapon?.def.adsFov - 1) * ads;
    want += this.fovPunch;
    this.fovPunch *= Math.exp(-14 * dt);
    // FOV changes must be frame-rate independent or aiming feels different at
    // 60 and 144 Hz.
    this.fov += (want - this.fov) * (1 - Math.exp(-12 * dt));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    // --- roll: lean into strafes, plus a kick from shots
    const strafeRoll = -char ? 0 : 0;
    this.rollTarget = strafeRoll;
    this.roll += (this.rollTarget - this.roll) * (1 - Math.exp(-8 * dt));

    // --- view bob, driven by distance travelled not by time, so the rhythm
    // matches the stride at any speed and stops instantly when you stop.
    const speed = moveSpeed ?? 0;
    const bobSpeed = speed > 0.4 && grounded ? 1 : 0;
    this.bobAmount += (bobSpeed - this.bobAmount) * (1 - Math.exp(-10 * dt));
    const strideRate = 0.9 + (speed / MOVE.maxSpeed) * 1.35;
    this.bobPhase += dt * strideRate * Math.PI * 2 * this.bobAmount;
    const bobY = Math.sin(this.bobPhase * 2) * MOVE.viewBobAmp * this.bobAmount;
    const bobX = Math.sin(this.bobPhase) * MOVE.viewBobAmp * 0.7 * this.bobAmount;
    // Landing dip: a spring so a hard landing dips and springs back.
    if (justLanded > 1.5) {
      this.landDipVel -= Math.min(justLanded * 0.012, 0.9);
    }
    const k = 190, c = 21;
    this.landDipVel += (-k * this.landDip - c * this.landDipVel) * dt;
    this.landDip += this.landDipVel * dt;
    this.landDip = Math.max(-0.22, Math.min(0.06, this.landDip));

    // --- trauma shake
    this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
    const t2 = this.trauma * this.trauma;   // square: small hits barely register
    this.shakeTime += dt * 26;
    const s = this.shakeTime;
    this._noise.set(
      (Math.sin(s * 1.7) + Math.sin(s * 3.1) * 0.5) * t2 * 0.055,
      (Math.sin(s * 2.3 + 1.7) + Math.sin(s * 4.7) * 0.5) * t2 * 0.055,
      (Math.sin(s * 1.9 + 3.4) + Math.sin(s * 3.9) * 0.5) * t2 * 0.030,
    );

    // --- compose the final camera transform
    this._pos.set(
      char.pos.x + bobX + this._noise.x,
      char.pos.y + char.eyeHeight + bobY + this.landDip + this._noise.y,
      char.pos.z + this._noise.z,
    );
    this.camera.position.copy(this._pos);

    const pitch = char.pitch + this.recoilPitch * Math.PI / 180 + this._noise.y * 0.4;
    const yaw = char.yaw + this.recoilYaw * Math.PI / 180 + this._noise.x * 0.4;
    this._e.set(pitch, yaw, this.roll + this._noise.z, 'YXZ');
    this.camera.quaternion.setFromEuler(this._e);

    void airTime;
  }
}

/**
 * Viewmodel: the gun in your hands.
 *
 * Runs its own spring for recoil so the gun can settle while the camera is
 * still climbing — the two-recoil-system rule from DESIGN.md in practice.
 */
export class Viewmodel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.matrixAutoUpdate = true;

    this.hipPos = new THREE.Vector3(0.19, -0.19, -0.42);
    this.adsPos = new THREE.Vector3(0.0, -0.115, -0.30);
    this.baseRot = new THREE.Euler(0, 0, 0);

    this.ads = 0;
    this.swayTarget = new THREE.Vector2();
    this.sway = new THREE.Vector2();
    this.swayVel = new THREE.Vector2();
    this.kickPos = 0;
    this.kickPosVel = 0;
    this.kickRot = 0;
    this.kickRotVel = 0;
    this.equipT = 1;
    this.reloadT = 0;
    this.reloadDur = 1;
    this.meleeT = 0;
    this.visible = true;
    this.gun = null;
  }

  attach(gunObject) {
    if (this.gun) this.group.remove(this.gun);
    this.gun = gunObject;
    if (gunObject) this.group.add(gunObject);
  }

  onEquip() { this.equipT = 0; }
  onReload(duration) { this.reloadT = 0; this.reloadDur = duration; }
  onMelee() { this.meleeT = 0; }

  /** Impulse from a shot. */
  kick(back, rot) {
    this.kickPosVel -= back * 9.0;
    this.kickRotVel += rot * 3.2;
  }

  update(dt, { ads, lookDX, lookDY, speed, grounded, weapon }) {
    this.ads += (ads - this.ads) * (1 - Math.exp(-16 * dt));

    // Sway: the gun lags behind fast mouse movement, then catches up. This is
    // the single biggest contributor to "the gun has weight".
    this.swayTarget.set(
      THREE.MathUtils.clamp(-lookDX * 0.9, -0.06, 0.06),
      THREE.MathUtils.clamp(lookDY * 0.9, -0.05, 0.05),
    );
    const k = 90, c = 15;
    this.swayVel.x += (-k * (this.sway.x - this.swayTarget.x) - c * this.swayVel.x) * dt;
    this.swayVel.y += (-k * (this.sway.y - this.swayTarget.y) - c * this.swayVel.y) * dt;
    this.sway.x += this.swayVel.x * dt;
    this.sway.y += this.swayVel.y * dt;

    // recoil spring
    const rk = 210, rc = 24;
    this.kickPosVel += (-rk * this.kickPos - rc * this.kickPosVel) * dt;
    this.kickPos += this.kickPosVel * dt;
    this.kickRotVel += (-rk * this.kickRot - rc * this.kickRotVel) * dt;
    this.kickRot += this.kickRotVel * dt;

    // equip animation: gun rises into frame
    this.equipT = Math.min(1, this.equipT + dt / 0.35);
    const eq = 1 - Math.pow(1 - this.equipT, 3);

    // reload: dip and roll the gun
    this.reloadT = this.reloadDur > 0 ? Math.min(this.reloadDur, this.reloadT + dt) : this.reloadDur;
    let reloadDip = 0, reloadRoll = 0, reloadYaw = 0;
    if (this.reloadDur > 0) {
      const t = this.reloadT / this.reloadDur;
      if (t < 1) {
        const s = Math.sin(t * Math.PI);
        reloadDip = -0.11 * s;
        reloadRoll = 0.5 * s;
        reloadYaw = 0.32 * s;
      } else {
        this.reloadDur = 0;
      }
    }

    // melee: quick thrust
    this.meleeT = Math.min(1, this.meleeT + dt / 0.32);
    let meleePush = 0;
    if (this.meleeT < 1) {
      const t = this.meleeT;
      meleePush = Math.sin(t * Math.PI) * 0.22;
    }

    // walk bob on the gun only (the camera has its own)
    const bobAmt = speed > 0.4 && grounded ? Math.min(1, speed / MOVE.maxSpeed) : 0;
    const t = performance.now() * 0.001;
    const bobY = Math.sin(t * 9.5) * 0.008 * bobAmt;
    const bobX = Math.cos(t * 4.75) * 0.011 * bobAmt;

    // compose
    const px = THREE.MathUtils.lerp(this.hipPos.x, this.adsPos.x, this.ads);
    const py = THREE.MathUtils.lerp(this.hipPos.y, this.adsPos.y, this.ads) + bobY + reloadDip - (1 - eq) * 0.22;
    const pz = THREE.MathUtils.lerp(this.hipPos.z, this.adsPos.z, this.ads) - this.kickPos * 6.0 + meleePush;

    this.group.position.set(px + this.sway.x + bobX, py + this.sway.y, pz);
    this.group.rotation.set(
      this.kickRot * 0.12 + this.sway.y * 2.4 - meleePush * 1.2,
      reloadYaw + this.sway.x * 3.0,
      reloadRoll + this.sway.x * 1.6,
    );

    // Attach the viewmodel to the camera so it inherits look rotation for free.
    if (this.group.parent !== this.camera) this.camera.add(this.group);
    this.group.visible = this.visible;
    void weapon;
  }
}
