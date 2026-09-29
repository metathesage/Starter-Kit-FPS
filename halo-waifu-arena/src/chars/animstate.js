/**
 * Animation state machine.
 *
 * Kept separate from Actor so the same table drives the player and the bots.
 * The rule is one clip at a time (this is a shooter, not a fighting game), with
 * crossfades short enough to read as a transition rather than a blend.
 */
import * as THREE from '../../vendor/three/build/three.module.js';

const STATE_TABLE = [
  // state,        conditions
  { state: 'death',    when: (a) => !a.alive },
  { state: 'slide',    when: (a) => a.sliding },
  { state: 'jumpAir',  when: (a) => !a.grounded && a.airTime > 0.14 },
  { state: 'jumpLand', when: (a) => a.justLanded > 3.0 },
  { state: 'hit',      when: (a) => a.hitReact > 0 },
  { state: 'reload',   when: (a) => a.reloadAnim > 0 },
  { state: 'shoot',    when: (a) => a.recoilAnim > 0.02 },
  { state: 'sprint',   when: (a) => a.sprinting },
  { state: 'crouchWalk', when: (a) => a.isCrouching && a.speed > 0.6 },
  { state: 'crouchIdle', when: (a) => a.isCrouching },
  { state: 'walk',     when: (a) => a.speed > 5.2 },
  { state: 'jog',      when: (a) => a.speed > 0.6 },
  { state: 'idle',     when: () => true },
];

const FADE = {
  death: 0.08, slide: 0.10, jumpAir: 0.10, jumpLand: 0.08, hit: 0.05,
  reload: 0.12, shoot: 0.04, sprint: 0.16, crouchWalk: 0.14, crouchIdle: 0.16,
  walk: 0.16, jog: 0.18, idle: 0.22,
};

const SPEED = {
  death: 1, slide: 1, jumpAir: 1, jumpLand: 1, hit: 1, reload: 1,
  shoot: 1, sprint: 1, crouchWalk: 1, crouchIdle: 1, walk: 1, jog: 1, idle: 1,
};

export function pickState(a) {
  for (const row of STATE_TABLE) {
    if (row.when(a)) return row.state;
  }
  return 'idle';
}

export function updateAnimState(actor, dt) {
  if (!actor.mixer) return;
  const want = pickState(actor);
  if (want !== actor.state) {
    actor.play(want, { fade: FADE[want] ?? 0.15, speed: SPEED[want] ?? 1 });
  }
  // decay the transient triggers that fed the state machine
  actor.recoilAnim = Math.max(0, actor.recoilAnim - dt * 4.5);
  actor.reloadAnim = Math.max(0, actor.reloadAnim - dt * 0.7);
  actor.hitReact = Math.max(0, (actor.hitReact ?? 0) - dt * 2.6);

  // Locomotion clips are driven by playback rate so the feet do not skate:
  // match the clip's stride to the actual horizontal speed.
  const act = actor.actions[actor.state];
  if (act && (actor.state === 'walk' || actor.state === 'jog' || actor.state === 'crouchWalk' || actor.state === 'sprint')) {
    const clip = act.getClip();
    const stride = clip?.userData?.stride ?? 1.6;
    const base = actor.state === 'jog' ? 1 : actor.state === 'sprint' ? 1.35 : 0.9;
    const target = THREE.MathUtils.clamp(actor.speed / stride, 0.35, 2.4) * base;
    const cur = act.getEffectiveTimeScale();
    act.setEffectiveTimeScale(cur + (target - cur) * Math.min(1, dt * 10));
  }
}
