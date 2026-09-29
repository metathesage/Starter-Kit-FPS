/**
 * A network character: an animated waifu with a skeleton, a state machine, a
 * health pool, and a nametag. Both the local player and the bots are Actors, so
 * the player sees exactly what the AI sees.
 */

import * as THREE from '../../vendor/three/build/three.module.js';
import { Retargeter, LOOPING } from './retarget.js';

export const TEAM = { RED: 0, BLUE: 1 };

/** Character definitions, keyed by the file under assets/chars. */
export const ROSTER = {
  kagome: { name: 'Kagome', model: 'kagome', teamColor: 0xff4d6d, voice: 1.0 },
  lucy: { name: 'Lucy', model: 'lucy', teamColor: 0x4dc3ff, voice: 0.9 },
  angle: { name: 'Angle', model: 'angle', teamColor: 0xffb03b, voice: 1.1 },
  maid: { name: 'Mai', model: 'maid', teamColor: 0xb388ff, voice: 0.85 },
  ghost: { name: 'Ghost', model: 'ghost', teamColor: 0x7cf5a0, voice: 0.95 },
  wraith: { name: 'Wraith', model: 'wraith', teamColor: 0xff7ae0, voice: 1.05 },
  reaper: { name: 'Reaper', model: 'reaper', teamColor: 0x9aa4b8, voice: 0.8 },
  soldier: { name: 'Scout', model: 'soldier', teamColor: 0xffe066, voice: 0.9 },
};

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class Actor {
  /**
   * @param {object} opts { gltf (loaded template), retargeter, team, isLocal, name }
   */
  constructor(opts) {
    this.name = opts.name;
    this.team = opts.team;
    this.isLocal = !!opts.isLocal;
    this.root = opts.root;
    this.retargeter = opts.retargeter ?? null;
    this.mixer = opts.mixer ?? null;
    this.actions = opts.actions ?? {};

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.height = 1.8;

    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;
    this.kills = 0;
    this.deaths = 0;
    this.score = 0;

    this.deathT = 0;
    this.spawnT = 0;
    this.lastHitT = -99;
    this.lastHitDir = new THREE.Vector3();
    this.hitFlash = 0;

    // animation state
    this.state = 'idle';
    this.stateT = 0;
    this._prevState = '';
    this.aimPitch = 0;
    this.recoilAnim = 0;
    this.reloadAnim = 0;

    this.visible = true;
  }

  setPosition(x, y, z) {
    this.pos.set(x, y, z);
    this.root.position.set(x, y, z);
  }

  /** Blend to a new state if it differs. */
  play(name, { fade = 0.14, force = false, speed = 1 } = {}) {
    if (this.state === name && !force) return;
    const act = this.actions[name];
    if (!act) return;
    this.state = name;
    this.stateT = 0;
    act.reset();
    act.setEffectiveWeight(1);
    act.setEffectiveTimeScale(speed);
    if (this.mixer) {
      for (const key of Object.keys(this.actions)) {
        if (key !== name) this.mixer.stopAllActionOfAction?.(this.actions[key]);
      }
      this.mixer.clipAction(act).play();
    }
    act.setLoop(LOOPING.has(act.getClip()?.userData?.loopName ?? name) ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    act.clampWhenFinished = true;
    act.fadeIn(fade);
  }

  update(dt, ctx) {
    this.stateT += dt;
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 3.2);
    if (!this.alive) this.deathT += dt;

    // face the aim direction
    this.root.rotation.y = this.yaw;

    // The retargeter must run before the renderer's world-matrix update.
    if (this.mixer) this.mixer.update(dt);
    if (this.retargeter) this.retargeter.apply();

    // nametag / body tint
    if (this.hitFlash > 0 && this._flashMats) {
      for (const m of this._flashMats) m.emissiveIntensity = this.hitFlash * 2.2;
    }
    void ctx;
  }

  takeDamage(amount, zone, dir, point, from) {
    if (!this.alive) return;
    this.hp -= amount;
    this.hitFlash = 1;
    this.lastHitT = 0;
    if (dir) this.lastHitDir.copy(dir);
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.deaths++;
      this.deathT = 0;
    }
    void zone; void point; void from;
  }

  respawn(x, y, z, yaw) {
    this.hp = this.maxHp;
    this.alive = true;
    this.deathT = 0;
    this.hitFlash = 0;
    this.setPosition(x, y, z);
    this.yaw = yaw;
    this.vel.set(0, 0, 0);
  }

  get eyeY() { return this.pos.y + this.height * 0.88; }
  get center() { return _v.set(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z); }
  get headY() { return this.pos.y + this.height * 0.88; }
}

/**
 * Build a playable Actor from a loaded, cloned character template.
 * `template` is the parsed GLTF scene plus its skeleton and UE proxy.
 */
export function buildActor(template, { team, isLocal, name, height = 1.8 }) {
  const root = template.root;
  root.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });

  const retargeter = template.retargeter
    ? new Retargeter(root, template.skeleton, template.ueBones, template.ueSkeleton)
    : null;

  const mixer = template.mixer ? new THREE.AnimationMixer(root) : null;
  const actions = {};
  if (mixer) {
    for (const [state, clipName] of Object.entries(template.stateClips)) {
      const clip = template.clips[clipName];
      if (!clip) continue;
      const act = mixer.clipAction(clip);
      act.setLoop(LOOPING.has(clipName) ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      act.clampWhenFinished = true;
      act.enabled = true;
      act.setEffectiveWeight(0);
      actions[state] = act;
    }
  }

  const a = new Actor({ root, retargeter, mixer, actions, team, isLocal, name });
  a.height = height;
  return a;
}
