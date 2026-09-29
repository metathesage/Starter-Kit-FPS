/**
 * Weapons: hitscan firing, deterministic recoil patterns, live spread, ADS.
 *
 * Two design rules make this feel like a real shooter rather than a raycast demo:
 *
 * 1. RECOIL IS TWO SYSTEMS. The camera kicks (the view moves) and the viewmodel
 *    kicks (the gun moves) with different curves, different springs and
 *    different recovery. Gun games that drive both from one value feel mushy.
 *
 * 2. THE PATTERN IS DETERMINISTIC. Shot N always goes the same place, so the
 *    player can learn to control the gun. Random per-shot recoil reads as
 *    broken aim, not as difficulty. Spread is separate and IS random: spread is
 *    about inaccuracy, recoil is about learning.
 */

import * as THREE from '../../vendor/three/build/three.module.js';

/* ---------------------------------------------------------------- tuning */

export const WEAPONS = {
  ace: {
    name: 'Ace of Spades',
    archetype: 'EXOTIC HAND CANNON',
    model: 'ace_of_spades_rigged',
    damage: 70,
    headMult: 2.2,
    limbMult: 0.85,
    rpm: 140,
    auto: false,
    burst: 0,
    magSize: 13,
    reserve: 91,
    reloadTime: 1.6,
    adsTime: 0.16,
    spreadBase: 0.12,
    spreadMax: 2.2,
    spreadMove: 1.2,
    spreadAir: 2.8,
    spreadAdsScale: 0.28,
    spreadRecover: 5.5,
    spreadBloom: 0.35,
    recoilCamPitch: 1.45,
    recoilCamYaw: 0.25,
    recoilRecover: 6.8,
    recoilKickBack: 0.045,
    recoilKickRot: 6.5,
    range: 140,
    pellets: 1,
    adsFov: 0.55,
    sound: 'ace',
    scale: 0.9,
    pos: [0.18, -0.15, -0.32],
    adsPos: [0, -0.115, -0.24],
    rot: [0, Math.PI / 2, 0]
  },
  outbreak: {
    name: 'Outbreak Perfected',
    archetype: 'EXOTIC PULSE RIFLE',
    model: 'outbreak_perfected_rigged',
    damage: 34,
    headMult: 2.0,
    limbMult: 0.9,
    rpm: 640,
    auto: true,
    burst: 0,
    magSize: 32,
    reserve: 160,
    reloadTime: 2.0,
    adsTime: 0.2,
    spreadBase: 0.18,
    spreadMax: 3.0,
    spreadMove: 1.6,
    spreadAir: 3.2,
    spreadAdsScale: 0.18,
    spreadRecover: 6.5,
    spreadBloom: 0.15,
    recoilCamPitch: 0.48,
    recoilCamYaw: 0.18,
    recoilRecover: 8.5,
    recoilKickBack: 0.024,
    recoilKickRot: 3.8,
    range: 160,
    pellets: 1,
    adsFov: 0.45,
    sound: 'outbreak',
    scale: 0.55,
    pos: [0.16, -0.15, -0.36],
    adsPos: [0, -0.125, -0.28],
    rot: [0, Math.PI / 2, 0]
  },
  chaperone: {
    name: 'The Chaperone',
    archetype: 'EXOTIC PRECISION SLUG',
    model: 'the_chaperone_rigged',
    damage: 140,
    headMult: 2.3,
    limbMult: 0.85,
    rpm: 90,
    auto: false,
    burst: 0,
    magSize: 6,
    reserve: 36,
    reloadTime: 2.2,
    adsTime: 0.18,
    spreadBase: 0.10,
    spreadMax: 1.8,
    spreadMove: 0.9,
    spreadAir: 2.2,
    spreadAdsScale: 0.20,
    spreadRecover: 5.5,
    spreadBloom: 0.65,
    recoilCamPitch: 2.6,
    recoilCamYaw: 0.4,
    recoilRecover: 5.2,
    recoilKickBack: 0.085,
    recoilKickRot: 10.0,
    range: 48,
    pellets: 1,
    adsFov: 0.60,
    sound: 'chaperone',
    scale: 0.85,
    pos: [0.18, -0.17, -0.38],
    adsPos: [0, -0.13, -0.28],
    rot: [0, 0, 0]
  },
  sword: {
    name: 'Type-1 Energy Sword',
    archetype: 'HALO PLASMA BLADES',
    model: 'energy_sword_rigged',
    damage: 180,
    headMult: 1.5,
    limbMult: 1.0,
    rpm: 120,
    auto: false,
    burst: 0,
    magSize: 100,
    reserve: 100,
    reloadTime: 0.1,
    adsTime: 0.1,
    isMelee: true,
    spreadBase: 0.1,
    spreadMax: 0.1,
    spreadMove: 0,
    spreadAir: 0,
    spreadAdsScale: 1.0,
    spreadRecover: 10,
    spreadBloom: 0,
    recoilCamPitch: 0.8,
    recoilCamYaw: 0.4,
    recoilRecover: 8.0,
    recoilKickBack: 0.12,
    recoilKickRot: 14.0,
    range: 6.5,
    pellets: 1,
    adsFov: 0.75,
    sound: 'sword',
    scale: 0.65,
    pos: [0.22, -0.24, -0.36],
    adsPos: [0.08, -0.18, -0.30],
    rot: [-Math.PI / 2.2, 0.25, -0.2]
  },
  lament: {
    name: 'The Lament',
    archetype: 'EXOTIC CHAINSWORD',
    model: 'the_lament_rigged',
    damage: 165,
    headMult: 1.5,
    limbMult: 1.0,
    rpm: 130,
    auto: false,
    burst: 0,
    magSize: 60,
    reserve: 60,
    reloadTime: 0.1,
    adsTime: 0.1,
    isMelee: true,
    spreadBase: 0.1,
    spreadMax: 0.1,
    spreadMove: 0,
    spreadAir: 0,
    spreadAdsScale: 1.0,
    spreadRecover: 10,
    spreadBloom: 0,
    recoilCamPitch: 1.0,
    recoilCamYaw: 0.6,
    recoilRecover: 7.5,
    recoilKickBack: 0.14,
    recoilKickRot: 16.0,
    range: 6.0,
    pellets: 1,
    adsFov: 0.75,
    sound: 'lament',
    scale: 0.55,
    pos: [0.22, -0.24, -0.40],
    adsPos: [0.08, -0.16, -0.34],
    rot: [0, 0, 0]
  },
  hawkmoon: {
    name: 'Hawkmoon',
    archetype: 'EXOTIC HAND CANNON',
    model: 'hawkmoon_rigged',
    damage: 70,
    headMult: 2.1,
    limbMult: 0.85,
    rpm: 140,
    auto: false,
    burst: 0,
    magSize: 8,
    reserve: 64,
    reloadTime: 1.55,
    adsTime: 0.16,
    spreadBase: 0.16,
    spreadMax: 2.4,
    spreadMove: 1.5,
    spreadAir: 3.2,
    spreadAdsScale: 0.32,
    spreadRecover: 5.0,
    spreadBloom: 0.28,
    recoilCamPitch: 1.35,
    recoilCamYaw: 0.2,
    recoilRecover: 7.0,
    recoilKickBack: 0.040,
    recoilKickRot: 5.5,
    range: 130,
    pellets: 1,
    adsFov: 0.55,
    sound: 'hawkmoon',
    scale: 0.85,
    pos: [0.18, -0.15, -0.32],
    adsPos: [0, -0.115, -0.24],
    rot: [0, 0, 0]
  },
  smg: {
    name: 'Hanami SMG',
    archetype: 'RAPID SUBMACHINE GUN',
    model: 'hanami_smg_rigged',
    damage: 18,
    headMult: 1.7,
    limbMult: 0.9,
    rpm: 780,
    auto: true,
    burst: 0,
    magSize: 32,
    reserve: 192,
    reloadTime: 1.9,
    adsTime: 0.14,
    spreadBase: 0.5,
    spreadMax: 4.0,
    spreadMove: 1.9,
    spreadAir: 3.6,
    spreadAdsScale: 0.4,
    spreadRecover: 7.5,
    spreadBloom: 0.20,
    recoilCamPitch: 0.34,
    recoilCamYaw: 0.20,
    recoilRecover: 9.0,
    recoilKickBack: 0.016,
    recoilKickRot: 3.2,
    range: 85,
    pellets: 1,
    adsFov: 0.6,
    sound: 'smg',
    scale: 0.85,
    pos: [0.16, -0.15, -0.34],
    adsPos: [0, -0.12, -0.26],
    rot: [0, Math.PI / 2, 0]
  },
  shotgun: {
    name: 'Sakura Shotgun',
    archetype: 'PUMP-ACTION COMBAT SHOTGUN',
    model: 'sakura_shotgun_rigged',
    damage: 14,
    headMult: 1.4,
    limbMult: 0.9,
    rpm: 95,
    auto: false,
    burst: 0,
    magSize: 8,
    reserve: 48,
    reloadTime: 2.4,
    adsTime: 0.2,
    spreadBase: 3.0,
    spreadMax: 5.2,
    spreadMove: 0.8,
    spreadAir: 2.0,
    spreadAdsScale: 0.7,
    spreadRecover: 6.0,
    spreadBloom: 0.5,
    recoilCamPitch: 2.4,
    recoilCamYaw: 0.5,
    recoilRecover: 5.0,
    recoilKickBack: 0.075,
    recoilKickRot: 9.0,
    range: 32,
    pellets: 9,
    adsFov: 0.66,
    sound: 'shotgun',
    scale: 0.78,
    pos: [0.18, -0.17, -0.38],
    adsPos: [0, -0.13, -0.28],
    rot: [0, Math.PI / 2, 0]
  },
  launcher: {
    name: 'Lotus Launcher',
    archetype: 'HEAVY ORDNANCE LAUNCHER',
    model: 'lotus_launcher_rigged',
    damage: 280,
    headMult: 1.2,
    limbMult: 1.0,
    rpm: 60,
    auto: false,
    burst: 0,
    magSize: 2,
    reserve: 8,
    reloadTime: 2.8,
    adsTime: 0.28,
    spreadBase: 0.08,
    spreadMax: 1.2,
    spreadMove: 0.5,
    spreadAir: 1.5,
    spreadAdsScale: 0.3,
    spreadRecover: 4.5,
    spreadBloom: 0.8,
    recoilCamPitch: 3.2,
    recoilCamYaw: 0.7,
    recoilRecover: 4.5,
    recoilKickBack: 0.12,
    recoilKickRot: 12.0,
    range: 220,
    pellets: 1,
    adsFov: 0.62,
    sound: 'launcher',
    scale: 0.75,
    pos: [0.20, -0.18, -0.42],
    adsPos: [0, -0.14, -0.32],
    rot: [0, 0, 0]
  },
  ak47: {
    name: 'AK-47 Kalashnikov',
    archetype: '7.62mm ASSAULT RIFLE',
    model: 'ak47',
    damage: 36,
    headMult: 2.7,
    limbMult: 0.85,
    rpm: 600,
    auto: true,
    burst: 0,
    magSize: 30,
    reserve: 90,
    reloadTime: 2.1,
    adsTime: 0.18,
    spreadBase: 0.20,
    spreadMax: 3.2,
    spreadMove: 1.8,
    spreadAir: 3.5,
    spreadAdsScale: 0.25,
    spreadRecover: 6.5,
    spreadBloom: 0.18,
    recoilCamPitch: 0.65,
    recoilCamYaw: 0.28,
    recoilRecover: 7.5,
    recoilKickBack: 0.035,
    recoilKickRot: 4.5,
    range: 160,
    pellets: 1,
    adsFov: 0.55,
    sound: 'outbreak',
    scale: 3.8,
    pos: [0.18, -0.16, -0.38],
    adsPos: [0, -0.125, -0.28],
    rot: [0, Math.PI / 2, 0]
  },
  m4a1: {
    name: 'M4A1 / ACR Carbine',
    archetype: '5.56mm TACTICAL RIFLE',
    model: 'm4a1_acr',
    damage: 30,
    headMult: 2.3,
    limbMult: 0.9,
    rpm: 700,
    auto: true,
    burst: 0,
    magSize: 30,
    reserve: 90,
    reloadTime: 1.9,
    adsTime: 0.16,
    spreadBase: 0.15,
    spreadMax: 2.6,
    spreadMove: 1.5,
    spreadAir: 3.0,
    spreadAdsScale: 0.20,
    spreadRecover: 7.2,
    spreadBloom: 0.14,
    recoilCamPitch: 0.45,
    recoilCamYaw: 0.18,
    recoilRecover: 8.5,
    recoilKickBack: 0.026,
    recoilKickRot: 3.6,
    range: 170,
    pellets: 1,
    adsFov: 0.52,
    sound: 'outbreak',
    scale: 0.9,
    pos: [0.18, -0.16, -0.38],
    adsPos: [0, -0.125, -0.28],
    rot: [0, 0, 0]
  },
  // Backward-compatibility aliases for existing test suite
  rifle: null,
  pistol: null,
};

// Aliases
WEAPONS.rifle = WEAPONS.outbreak;
WEAPONS.pistol = WEAPONS.hawkmoon;

export const ARENA_ARSENAL = [
  'ace',
  'outbreak',
  'chaperone',
  'ak47',
  'm4a1',
  'sword',
  'lament',
  'hawkmoon',
  'smg',
  'shotgun',
  'launcher'
];

export const WEAPON_ORDER = ['rifle', 'pistol', 'shotgun', 'smg'];

/* ------------------------------------------------- deterministic pattern */

/**
 * A learnable recoil pattern. Values are degrees of camera kick applied at
 * successive shots, then the pattern holds its last value.
 */
const PATTERNS = {
  ace: buildPattern([0.0, 1.4, 1.8, 2.0, 2.2, 2.4, 2.4], [0, 0.1, -0.15, 0.2, -0.2, 0.25, -0.25]),
  outbreak: buildPattern([
    0.0, 0.9, 1.7, 2.3, 2.8, 3.2, 3.5, 3.7, 3.9, 4.0,
    4.0, 3.9, 3.8, 3.7, 3.6, 3.5, 3.4,
    3.3, -0.5, 3.2, 1.6, 3.1, 2.4, 3.0, 1.2,
  ], [0, 0, 0, 0, 0.3, -0.3, 0.5, -0.5, 0.7, -0.7, 0.4, -0.4]),
  chaperone: buildPattern([2.5], [0.3]),
  sword: buildPattern([0.8], [0.4]),
  lament: buildPattern([1.0], [0.5]),
  hawkmoon: buildPattern([0.6], [0.1]),
  smg: buildPattern([0, 0.4, 0.8, 1.1, 1.4, 1.6, 1.8, 1.9, 2.0, 2.0, 2.0, 1.9],
    [0, 0.2, -0.2, 0.35, -0.35, 0.5, -0.5, 0.4, -0.4, 0.3, -0.3]),
  shotgun: buildPattern([2.2], [0.2]),
  launcher: buildPattern([3.0], [0.5]),
  rifle: null,
  pistol: null,
};
PATTERNS.rifle = PATTERNS.outbreak;
PATTERNS.pistol = PATTERNS.hawkmoon;

function buildPattern(pitch, yaw) {
  const out = [];
  const n = Math.max(pitch.length, yaw.length);
  for (let i = 0; i < n; i++) out.push([pitch[i % pitch.length], yaw[i % yaw.length]]);
  return out;
}

/* ------------------------------------------------------------- hitboxes */

/**
 * Character hitbox model. Deliberately simple capsules rather than skinned
 * meshes: a hitscan against a 40k-triangle animated mesh is both slow and
 * wrong (you would hit the arm in front of the torso). Three capsules give a
 * readable, fair, Halo-like target.
 */
export const HITBOX = {
  head: { y: 1.58, r: 0.14, h: 0.26, mult: 'headMult' },
  torso: { y: 0.95, r: 0.30, h: 0.72, mult: null },
  legs: { y: 0.30, r: 0.26, h: 0.66, mult: 'limbMult' },
};

const _perp = new THREE.Vector3();
const _perp2 = new THREE.Vector3();

/** Ray vs a vertical capsule at (pos.x, pos.z) spanning y0..y1. */
function rayCapsuleAt(o, d, pos, y0, y1, radius, maxT) {
  // Infinite cylinder in XZ.
  const ox = o.x - pos.x, oz = o.z - pos.z;
  const a = d.x * d.x + d.z * d.z;
  const b = 2 * (ox * d.x + oz * d.z);
  const c = ox * ox + oz * oz - radius * radius;
  let best = -1;
  if (a > 1e-12) {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
        if (t < 0.01 || t > maxT) continue;
        const y = o.y + d.y * t;
        if (y >= y0 && y <= y1) { best = t; break; }
      }
    }
  } else if (c <= 0 && Math.abs(d.x) < 1e-9 && Math.abs(d.z) < 1e-9) {
    // Vertical ray already inside the cylinder radius.
    const t = d.y > 0 ? (y0 - o.y) / d.y : (y1 - o.y) / d.y;
    if (t > 0.01 && t <= maxT) best = t;
  }
  if (best >= 0) return best;
  // Cap spheres at both ends.
  for (const cy of [y0, y1]) {
    const ex = o.x - pos.x, ey = o.y - cy, ez = o.z - pos.z;
    const bb = 2 * (ex * d.x + ey * d.y + ez * d.z);
    const cc = ex * ex + ey * ey + ez * ez - radius * radius;
    const disc = bb * bb - 4 * cc;
    if (disc < 0) continue;
    const sq = Math.sqrt(disc);
    for (const t of [(-bb - sq) / 2, (-bb + sq) / 2]) {
      if (t < 0.01 || t > maxT) continue;
      const y = o.y + d.y * t;
      if (y >= y0 - radius && y <= y1 + radius && (best < 0 || t < best)) best = t;
    }
  }
  return best;
}

/* ------------------------------------------------------------ the weapon */

export class WeaponSystem {
  constructor(collision, weaponKeys = WEAPON_ORDER) {
    this.collision = collision;
    this.slots = weaponKeys.map((k) => ({
      key: k,
      def: WEAPONS[k],
      ammo: WEAPONS[k].magSize,
      reserve: WEAPONS[k].reserve,
      shotIndex: 0,          // index into the recoil pattern
    }));
    this.current = 0;

    // camera recoil accumulator, in degrees
    this.camPitch = 0;
    this.camYaw = 0;
    this.camPitchVel = 0;

    // viewmodel recoil spring
    this.kickPos = 0;
    this.kickPosVel = 0;
    this.kickRot = 0;
    this.kickRotVel = 0;

    this.spread = 0;          // current cone half-angle, degrees
    this.bloom = 0;           // accumulated bloom while firing
    this.ads = 0;             // 0..1 blend
    this._reloading = 0;      // remaining reload seconds
    this._reloadTotal = 0;
    this._pressActive = false; // semi-auto trigger is down
    this._pressSpent = false;  // this press has already fired a shot
    this.burstLeft = 0;
    this.burstTimer = 0;
    this.shotsFired = 0;      // for the HUD
    this.lastFire = -99;
    this.heat = 0;            // 0..1, drives crosshair bloom
    this.owner = null;        // set by the game so we never hit ourselves

    this.events = [];
  }

  get def() { return this.slots[this.current].def; }
  get slot() { return this.slots[this.current]; }
  get ammo() { return this.slot.ammo; }
  set ammo(v) { this.slot.ammo = v; }
  get reloadProgress() { return this._reloadTotal > 0 ? 1 - this._reloading / this._reloadTotal : 0; }
  get isReloading() { return this._reloading > 0; }

  select(i) {
    if (i < 0 || i >= this.slots.length || i === this.current) return false;
    this._cancelReload();
    this.current = i;
    this.slot.shotIndex = 0;
    this.events.push({ type: 'equip', weapon: this.def });
    return true;
  }

  cycle(dir) {
    const n = this.slots.length;
    this.select((this.current + dir + n) % n);
  }

  reset() {
    for (const s of this.slots) { s.ammo = s.def.magSize; s.reserve = s.def.reserve; s.shotIndex = 0; }
    this.current = 0;
    this._reloading = 0;
    this.camPitch = this.camYaw = this.camPitchVel = 0;
    this.kickPos = this.kickPosVel = this.kickRot = this.kickRotVel = 0;
    this.spread = 0;
    this.ads = 0;
    this.heat = 0;
    this.shotsFired = 0;
  }

  _cancelReload() { this._reloading = 0; }

  startReload() {
    const s = this.slot, d = s.def;
    if (this._reloading > 0 || s.ammo >= d.magSize || s.reserve <= 0) return false;
    this._reloading = d.reloadTime;
    this._reloadTotal = d.reloadTime;
    this.events.push({ type: 'reloadStart', weapon: d });
    return true;
  }

  /**
   * @param {object} cmd { fire, firePressed, aim, reloadPressed, time }
   * @param {object} owner character-like { pos, vel, grounded, isCrouching, speed }
   * @param {Array}  targets  [{ pos, height, alive, team, takeDamage() }]
   * @param {THREE.Camera} camera for the shot direction
   */
  update(dt, cmd, owner, targets, eyePos, baseYaw, basePitch, aimTargetPoint = null, muzzlePos = null) {
    this.events.length = 0;
    const s = this.slot, d = s.def;

    // Semi-auto press latch.
    // The input layer reports `firePressed` as a rising edge, but it re-asserts
    // the flag on every tick while the button is held. A semi-auto weapon must
    // spend exactly one shot per press, so track the press here rather than
    // trusting the caller's flag to be edge-only.
    if (cmd.firePressed) {
      if (!this._pressActive) { this._pressActive = true; this._pressSpent = false; }
    } else {
      this._pressActive = false;
    }

    // reload
    if (this._reloading > 0) {
      this._reloading -= dt;
      if (this._reloading <= 0) {
        this._reloading = 0;
        const need = d.magSize - s.ammo;
        const take = Math.min(need, s.reserve);
        s.ammo += take;
        s.reserve -= take;
        s.shotIndex = 0;
        this.events.push({ type: 'reloadEnd', weapon: d });
      }
    }

    // ADS blend — this is a visual/handling blend, so it should ease
    // asymmetrically: fast in, slightly slower out (feels deliberate).
    const wantAds = cmd.aim && !this._reloading ? 1 : 0;
    const adsSpeed = wantAds ? dt / Math.max(0.01, d.adsTime) : dt / Math.max(0.01, d.adsTime * 1.35);
    this.ads = Math.max(0, Math.min(1, this.ads + Math.sign(adsSpeed) * Math.min(Math.abs(adsSpeed), Math.abs(this.ads - wantAds))));

    // Spread / bloom.
    // Bloom accumulates per shot and is only recovered when the player is NOT
    // firing. Recovering every tick would make recovery (deg/s) always exceed
    // bloom (deg/shot * rpm/60) and the cone could never open, which is why a
    // naive implementation here silently produces a laser.
    const wasFiring = cmd.fire || cmd.firePressed;
    if (wasFiring) {
      this.bloom = Math.min(d.spreadMax, this.bloom + d.spreadBloom * (60 / d.rpm) * 2.0);
    } else {
      this.bloom = Math.max(0, this.bloom - d.spreadRecover * dt);
    }
    // `spread` is the value the HUD reads, so it has to track the cone even on
    // ticks where no shot is fired.
    const mf = Math.min(1, owner.speed / 6.4);
    let cone = d.spreadBase + this.bloom + d.spreadMove * mf * (1 - this.ads * 0.5);
    if (!owner.grounded) cone += d.spreadAir;
    this.spread = Math.min(cone, d.spreadMax) * (1 - this.ads * (1 - d.spreadAdsScale));
    this.heat = Math.max(0, this.heat - dt * (wasFiring ? 0.6 : 2.6));

    // recoil recovery — exponential pull back to zero, not a linear lerp, so
    // the gun "settles" instead of sliding.
    const rec = Math.exp(-d.recoilRecover * dt);
    this.camPitch *= rec;
    this.camYaw *= rec;
    if (Math.abs(this.camPitch) < 1e-4) this.camPitch = 0;
    if (Math.abs(this.camYaw) < 1e-4) this.camYaw = 0;

    // viewmodel spring (critically damped-ish)
    const k = 260, c = 26;
    this.kickPosVel += (-k * this.kickPos - c * this.kickPosVel) * dt;
    this.kickPos += this.kickPosVel * dt;
    this.kickRotVel += (-k * this.kickRot - c * this.kickRotVel) * dt;
    this.kickRot += this.kickRotVel * dt;

    // fire
    const interval = 60 / d.rpm;
    if (cmd.reloadPressed) this.startReload();

    const canFire = s.ammo > 0 && this._reloading === 0;
    const wantFire = d.auto ? cmd.fire : (this._pressActive && !this._pressSpent);
    if (canFire && wantFire && (cmd.time - this.lastFire) >= interval) {
      this._fire(cmd, owner, targets, eyePos, baseYaw, basePitch, aimTargetPoint, muzzlePos);
      if (!d.auto) this._pressSpent = true;   // this press is used up
    }
    return this.events;
  }

  _fire(cmd, owner, targets, eyePos, baseYaw, basePitch, aimTargetPoint = null, muzzlePos = null) {
    const s = this.slot, d = s.def;
    s.ammo--;
    this.lastFire = cmd.time;
    this.shotsFired++;

    // --- camera recoil: deterministic pattern index
    const pat = PATTERNS[d.model] ?? PATTERNS.pistol;
    const [p, y] = pat[Math.min(s.shotIndex, pat.length - 1)];
    s.shotIndex++;
    const adsScale = 1 - this.ads * 0.45;
    this.camPitch += p * d.recoilCamPitch * adsScale;
    this.camYaw += y * d.recoilCamYaw * adsScale;
    this.camPitchVel = 0;

    // --- viewmodel kick: an impulse into a spring
    this.kickPosVel -= d.recoilKickBack * 26;
    this.kickRotVel += d.recoilKickRot * 12;

    // --- the effective cone for THIS shot. It was already computed above
    // (this.spread) including movement and ADS; nothing to recompute here.
    const cone = this.spread;

    // --- aim direction: screen-space target point or base look angles
    const fireOrigin = (muzzlePos || eyePos).clone();
    let dir = _dir;
    if (aimTargetPoint && muzzlePos) {
      dir.copy(aimTargetPoint).sub(fireOrigin).normalize();
      if (Math.abs(this.camPitch) > 1e-4 || Math.abs(this.camYaw) > 1e-4) {
        const right = _tmpRight.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        dir.applyAxisAngle(right, this.camPitch * Math.PI / 180);
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camYaw * Math.PI / 180);
      }
    } else {
      const yaw = baseYaw + this.camYaw * Math.PI / 180;
      const pitch = basePitch + this.camPitch * Math.PI / 180;
      dir.set(
        -Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch),
      );
    }

    const results = [];
    for (let pI = 0; pI < d.pellets; pI++) {
      const dd = _shot.copy(dir);
      if (cone > 0.001) {
        // uniform random point in a cone of half-angle `cone`
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.sqrt(Math.random()) * cone * Math.PI / 180;
        applyCone(dd, ang, rad);
      }
      const r = this._trace(fireOrigin, dd, targets, d.range);
      results.push(r);
    }

    this.events.push({
      type: 'fire',
      weapon: d,
      dir: dir.clone(),
      origin: fireOrigin.clone(),
      spread: cone,
      traces: results,
      muzzle: d.model,
    });

    if (s.ammo === 0) {
      this.events.push({ type: 'empty' });
      this.startReload();
    }
  }

  /** Ray vs world + character hitboxes. Returns the closest thing hit. */
  _trace(origin, dir, targets, maxDist) {
    const world = this.collision.raycast(origin, dir, maxDist, 0);
    let bestT = world ? world.distance : maxDist;
    let victim = null;
    let zone = null;

    for (const tg of targets) {
      if (!tg.alive) continue;
      if (tg === this.owner) continue;
      const base = tg.pos.y;
      for (const key of ['head', 'torso', 'legs']) {
        const hb = HITBOX[key];
        const y0 = base + hb.y - hb.h * 0.5;
        const y1 = base + hb.y + hb.h * 0.5;
        const tt = rayCapsuleAt(origin, dir, tg.pos, y0, y1, hb.r, bestT);
        if (tt >= 0 && tt < bestT) { bestT = tt; victim = tg; zone = key; }
      }
    }

    const point = _point.copy(origin).addScaledVector(dir, bestT);
    if (victim) {
      // The multiplier belongs to the SHOOTER's weapon, not the victim's.
      const multKey = HITBOX[zone].mult;
      const mult = multKey ? (this.def[multKey] ?? 1) : 1;
      const dmg = this.damage * mult;
      victim.takeDamage(dmg, zone, dir, point, this.owner);
      return { type: 'character', t: bestT, point: point.clone(), victim, zone, damage: dmg, mult };
    }
    if (world) {
      return { type: 'world', t: bestT, point: point.clone(), normal: world.normal, mat: world.matName };
    }
    return { type: 'miss', t: bestT, point: point.clone() };
  }

  get damage() { return this.def.damage; }
}

const _dir = new THREE.Vector3();
const _shot = new THREE.Vector3();
const _point = new THREE.Vector3();

function applyCone(dir, angle, radius) {
  // build an orthonormal basis around dir
  _perp.set(0, 1, 0);
  if (Math.abs(dir.y) > 0.95) _perp.set(1, 0, 0);
  _perp.crossVectors(dir, _perp).normalize();
  _perp2.crossVectors(dir, _perp).normalize();
  const cx = Math.cos(angle) * Math.sin(radius);
  const cy = Math.sin(angle) * Math.sin(radius);
  const cz = Math.cos(radius);
  dir.multiplyScalar(cz)
    .addScaledVector(_perp, cx)
    .addScaledVector(_perp2, cy)
    .normalize();
}
