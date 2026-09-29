/**
 * Retargeting UE-mannequin animations onto Mixamo-rigged characters.
 *
 * THE PROBLEM (measured, see DESIGN.md): every rigged character in the library
 * uses the Mixamo bone vocabulary (Hips, LeftUpLeg, Spine, Chest...), while the
 * only CC0 animation pack (Mesh2Motion human-base-animations) uses the UE4
 * mannequin vocabulary (pelvis, thigh_l, spine_01, ball_l...). The names do not
 * overlap at all, so Three's AnimationMixer will happily play a clip in which
 * every bone is static.
 *
 * THE APPROACH
 * A three.js AnimationClip targets named nodes. Rather than rewrite the clip's
 * channel data, we retarget ONCE at load by building a proxy: a parallel object
 * holding one Object3D per UE bone name, fed the original clip, and a set of
 * rules that copy the proxy's world transforms onto the Mixamo skeleton each
 * frame. That keeps the original clips untouched and reusable across every rig.
 *
 * The copy is done in WORLD space via bone matrices, which is what makes it
 * robust: the two skeletons have different rest poses and different bone
 * counts, and world-space copying plus a rest-pose correction is the only
 * approach that does not require hand-tuning every rig.
 */

import * as THREE from '../../vendor/three/build/three.module.js';

/**
 * UE mannequin -> Mixamo. Keys are the UE bone names present in
 * human-base-animations.glb; values are the Mixamo names used by the character
 * rigs. `null` marks a bone with no counterpart (root, twist bones, fingers).
 */
export const UE_TO_MIXAMO = {
  // spine chain
  pelvis: 'Hips',
  spine_01: 'Spine',
  spine_02: 'Spine1',
  spine_03: 'Spine2',
  spine_04: 'Chest',
  spine_05: 'UpperChest',
  // neck / head
  neck_01: 'Neck',
  head: 'Head',
  // clavicles + arms (UE _l/_r -> Mixamo Left/Right)
  clavicle_l: 'LeftShoulder',
  upperarm_l: 'LeftArm',
  lowerarm_l: 'LeftForeArm',
  hand_l: 'LeftHand',
  clavicle_r: 'RightShoulder',
  upperarm_r: 'RightArm',
  lowerarm_r: 'RightForeArm',
  hand_r: 'RightHand',
  // legs
  thigh_l: 'LeftUpLeg',
  calf_l: 'LeftLeg',
  foot_l: 'LeftFoot',
  ball_l: 'LeftToeBase',
  thigh_r: 'RightUpLeg',
  calf_r: 'RightLeg',
  foot_r: 'RightFoot',
  ball_r: 'RightToeBase',
};

/** Extra Mixamo bones we can derive rather than map directly. */
const DERIVED = {
  // Mixamo has no separate clavicle twist; the shoulder bone absorbs it.
  LeftShoulder: ['LeftArm'],
  RightShoulder: ['RightArm'],
};

const UPPER_ARM_L = new THREE.Vector3(1, 0, 0);
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();

/**
 * Build a retargeting bridge for one skeleton.
 * @param {THREE.Object3D} root   the skinned character root
 * @param {THREE.Skeleton} skeleton
 * @param {Map<string,THREE.Bone>} ueBones  proxy bones fed by the UE clip
 */
export class Retargeter {
  /**
   * @param {THREE.Object3D} root       character root (scene graph node)
   * @param {THREE.Skeleton} skeleton   character skeleton
   * @param {Map<string,THREE.Object3D>} ueBones  proxy bones for the UE clip
   * @param {THREE.Skeleton} ueSkeleton            the UE skeleton (for rest pose)
   */
  constructor(root, skeleton, ueBones, ueSkeleton) {
    this.root = root;
    this.skeleton = skeleton;
    this.bones = skeleton.bones;
    this.byName = new Map();
    for (const b of this.bones) this.byName.set(b.name, b);

    this.root.updateMatrixWorld(true);
    this.hip = this.byName.get('Hips') ?? this.bones[0];
    this.hipRestY = this.hip ? this.hip.position.y : 0;

    // The UE proxy must be at rest before we read its local rotations, otherwise
    // the rest-pose delta is measured against whatever pose it is currently in.
    const ueRoot = ueBones.get('root') ?? ueBones.values().next().value?.parent;
    if (ueRoot) {
      // Reset to the bind pose recorded on the source skeleton.
      resetToBind(ueRoot, ueSkeleton);
      ueRoot.updateMatrixWorld(true);
    }

    // Limb length ratio, so vertical motion (crouch depth) scales with the rig
    // rather than being copied verbatim from a differently-proportioned source.
    this.hipScaleY = 1;
    if (this.hip) {
      const dstH = this.hipRestY;
      const srcHips = ueBones.get('pelvis');
      if (srcHips && Math.abs(dstH) > 1e-4) this.hipScaleY = dstH / Math.max(0.05, Math.abs(srcHips.position.y));
    }

    this.pairs = [];
    for (const [ueName, mixName] of Object.entries(UE_TO_MIXAMO)) {
      const src = ueBones.get(ueName);
      const dst = this.byName.get(mixName);
      if (!src || !dst) continue;
      // delta = the rotation that maps the destination's rest local rotation
      // onto the source's rest local rotation, expressed in the parent frame.
      // Conjugating the animated source rotation by this makes the two rigs
      // agree at rest and diverge only by the animation itself.
      const delta = new THREE.Quaternion()
        .copy(src.quaternion)
        .multiply(_qA.copy(dst.quaternion).invert());
      this.pairs.push({ src, dst, delta, deltaInv: delta.clone().invert() });
    }

    this.derived = [];
    for (const [mixName, sources] of Object.entries(DERIVED)) {
      const dst = this.byName.get(mixName);
      if (!dst) continue;
      for (const srcName of sources) {
        const src = this.byName.get(srcName);
        if (src) this.derived.push({ dst, src });
      }
    }
  }

  /**
   * Copy the current pose of the UE proxy bones onto the character skeleton.
   * Call once per frame AFTER the mixer's update, BEFORE the renderer.
   *
   * Method: for each mapped bone, take the source's animated rotation relative
   * to its own parent (its local rotation, which is what the clip animates) and
   * re-express it in the destination's rest-pose frame:
   *
   *     dst.quaternion = delta * srcLocal * delta^-1
   *
   * where `delta` is the rest-pose rotation difference between the two bones
   * expressed in the PARENT's space. Conjugating by the rest difference is what
   * makes a clip authored on one skeleton land correctly on another whose rest
   * pose differs — without it the arms sit at visibly wrong angles.
   */
  apply() {
    for (let i = 0; i < this.pairs.length; i++) {
      const { src, dst, delta, deltaInv } = this.pairs[i];
      _q.copy(src.quaternion);
      // conjugate: delta * q * delta^-1
      _qTmp.copy(delta).multiply(_q).multiply(deltaInv);
      dst.quaternion.copy(_qTmp);
      // Position: only the hips carry translation, and only its Y should move
      // (that is the crouch/vertical bob in the source clips).
      if (dst === this.hip) {
        dst.position.y = this.hipRestY + src.position.y * this.hipScaleY;
      }
    }

    for (let i = 0; i < this.derived.length; i++) {
      const { dst, src } = this.derived[i];
      dst.quaternion.copy(src.quaternion);
    }
  }
}

const _q = new THREE.Quaternion();
const _qTmp = new THREE.Quaternion();
const _qA = new THREE.Quaternion();
const _qB = new THREE.Quaternion();

/** Restore a skeleton hierarchy to its bind pose using inverseBindMatrices. */
function resetToBind(root, skeleton) {
  if (!skeleton) return;
  const map = new Map();
  skeleton.bones.forEach((b, i) => map.set(b, i));
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const i = map.get(o);
    if (i === undefined) return;
    // worldBind = parentWorld * boneLocal  =>  boneLocal = parentWorld^-1 * worldBind
    const wm = skeleton.boneInverses[i].clone().invert();
    const pw = o.parent ? o.parent.matrixWorld : _identityM;
    wm.premultiply(pw.invert());
    wm.decompose(o.position, o.quaternion, o.scale);
  });
}
const _identityM = new THREE.Matrix4().identity();

/**
 * Create a proxy object graph mirroring the UE bone names, so the original
 * clips (which target those names) can be played on it.
 */
export function buildUeboneProxy(ueSkeleton) {
  const root = new THREE.Group();
  root.name = 'UEProxyRoot';
  const map = new Map();
  for (const b of ueSkeleton.bones) {
    const o = new THREE.Object3D();
    o.name = b.name;
    map.set(b.name, o);
  }
  for (const b of ueSkeleton.bones) {
    const o = map.get(b.name);
    if (b.parent && map.has(b.parent.name)) map.get(b.parent.name).add(o);
    else root.add(o);
  }
  return { root, map, skeleton: ueSkeleton };
}

/* ---------------------------------------------------------- clip library */

export const CLIP = {
  idle: ['Idle_A', 'Idle_FoldArms', 'Idle_Talking'],
  walk: ['Walk', 'Jog'],
  sprint: ['Sprint'],
  crouchIdle: ['Crouch_Idle'],
  crouchWalk: ['Crouch_Walk'],
  jumpStart: ['Jump_Start'],
  jumpAir: ['Jump_air'],
  jumpLand: ['Jump_Land'],
  slide: ['Slide', 'Slide_Start'],
  pistolIdle: ['Pistol_Idle'],
  pistolAim: ['Pistol_Aim_Neutral', 'Pistol_Aim_Up', 'Pistol_Aim_Down'],
  pistolShoot: ['Pistol_Shoot'],
  pistolReload: ['Pistol_Reload'],
  hitChest: ['Hit_Chest'],
  hitHead: ['Hit_Head'],
  hitKnock: ['Hit_Knockback'],
  death: ['Death_D'],
  roll: ['Roll'],
  melee: ['Punch_Cross', 'Punch_Jab', 'Melee_Hook'],
};

export const LOOPING = new Set([
  'Idle_A', 'Walk', 'Jog', 'Sprint', 'Crouch_Idle', 'Crouch_Walk',
  'Jump_air', 'Pistol_Idle', 'Pistol_Aim_Neutral', 'Pistol_Aim_Up', 'Pistol_Aim_Down',
]);
