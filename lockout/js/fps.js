// First-person viewmodel: separate scene + camera so the gun never clips into walls.
import * as THREE from 'three';
import { makeWeaponMesh } from './weapons.js';
import { makeArm, makeMats, solveArm } from './rig.js';
import { damp, clamp } from './util.js';

const POLE_R = new THREE.Vector3(0.7, -1, 0.5), POLE_L = new THREE.Vector3(-0.7, -1, 0.5);
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Viewmodel {
  constructor() {
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(62, 1, 0.02, 10);
    this.scene.add(this.cam);
    this.scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x7a6a58, 1.4));
    const d = new THREE.DirectionalLight(0xfff0d8, 2.4); d.position.set(-1, 2, 1); this.scene.add(d);
    this.root = new THREE.Group(); this.cam.add(this.root);
    this.weapons = {};
    this.team = null; this.armR = null; this.armL = null;
    this.sway = { x: 0, y: 0 }; this.t = 0; this.bob = 0; this.kick = 0; this.wid = null; this.swap = 0; this.zoomT = 0; this.melee = 0; this.throwT = 0;
    this.visible = true;
  }

  setup(team, hair, eye) {
    if (this.armR) { this.cam.remove(this.armR.arm); this.cam.remove(this.armL.arm); }
    this.mats = makeMats(team, hair, eye);
    this.armR = makeArm(this.mats, 0.34, 0.36, 1.0); this.armL = makeArm(this.mats, 0.34, 0.36, 1.0);
    this.armR.arm.position.set(0.34, -0.5, 0.12); this.armL.arm.position.set(-0.34, -0.5, 0.12);
    this.cam.add(this.armR.arm, this.armL.arm);
    for (const k of Object.keys(this.weapons)) { this.root.remove(this.weapons[k]); }
    this.weapons = {}; this.team = team; this.wid = null;
  }

  weapon(id) {
    if (!this.weapons[id]) { const w = makeWeaponMesh(id); w.scale.setScalar(0.62); w.visible = false; this.root.add(w); this.weapons[id] = w; }
    return this.weapons[id];
  }

  kickNow(amount = 1) { this.kick = Math.min(1.6, this.kick + amount); }

  update(dt, p, look, speed, defs) {
    this.t += dt;
    const id = p.weapon ? p.weapon.id : null;
    if (id !== this.wid) { this.wid = id; this.swap = 1; }
    for (const k in this.weapons) this.weapons[k].visible = false;
    if (!id) return;
    const w = this.weapon(id); w.visible = true;
    const def = defs[id];
    this.swap = Math.max(0, this.swap - dt * 2.4);
    this.kick = damp(this.kick, 0, 14, dt);
    this.sway.x = damp(this.sway.x + clamp(look.x, -0.06, 0.06) * -0.9, 0, 7, dt);
    this.sway.y = damp(this.sway.y + clamp(look.y, -0.06, 0.06) * -0.9, 0, 7, dt);
    this.bob += dt * (speed > 0.5 && p.grounded ? 7.2 : 0);
    const sp = clamp(speed / 5.4, 0, 1) * (p.grounded ? 1 : 0.2);
    const bobx = Math.sin(this.bob) * 0.012 * sp, boby = Math.abs(Math.cos(this.bob)) * 0.014 * sp;
    const zoomed = p.zoomLevel > 0;
    this.zoomT = damp(this.zoomT, zoomed ? 1 : 0, 14, dt);
    const idle = Math.sin(this.t * 1.5) * 0.002;

    let px = 0.2 - this.zoomT * 0.16 + bobx + this.sway.x, py = -0.22 + this.zoomT * 0.05 + boby + idle + this.sway.y * 0.6, pz = -0.6 + this.kick * 0.05;
    let rx = this.kick * 0.05 + this.sway.y * 0.6, ry = this.sway.x * 0.8 + 0.02, rz = -bobx * 1.2;
    if (id === 'sword') { px = 0.26; py = -0.26; pz = -0.5; ry = 0.35; rz = -0.15; rx += 0.1; }
    
    // reload dip
    if (p.reloadT > 0 && def.reload) {
      const k = 1 - p.reloadT / def.reload, dip = Math.sin(Math.min(1, k) * Math.PI);
      py -= dip * 0.22; rx -= dip * 0.5; rz += dip * 0.35; px += dip * 0.05;
    }
    // weapon swap raise
    py -= this.swap * 0.35; rx += this.swap * 0.5;
    // melee swing
    if (p.meleeT > 0) {
      const k = 1 - p.meleeT / (id === 'sword' ? 0.6 : 0.5), s = Math.sin(Math.min(1, k) * Math.PI);
      if (id === 'sword') { rz += (0.5 - k) * 1.6; ry += (k - 0.5) * 1.5; px += (0.5 - k) * 0.25; pz -= s * 0.2; rx -= s * 0.3; }
      else { pz -= s * 0.34; rx -= s * 0.6; px -= s * 0.08; py += s * 0.03; }
    }
    // grenade throw: hand lifts
    if (p.throwT > 0) { const k = Math.sin((1 - p.throwT / 0.55) * Math.PI); py -= k * 0.16; rx -= k * 0.4; }
    w.position.set(px, py, pz); w.rotation.set(rx, ry, rz);
    w.updateMatrix();

    const [gx, gy, gz] = w.userData.grip, [fx, fy, fz] = w.userData.fore;
    // targets in camera space
    _a.set(gx, gy, gz).applyMatrix4(w.matrix); _b.set(fx, fy, fz).applyMatrix4(w.matrix);
    if (p.throwT > 0) { const k = Math.sin((1 - p.throwT / 0.55) * Math.PI); _a.lerp(new THREE.Vector3(0.22, -0.02, -0.4), k); }
    solveArm(this.armR.arm, this.armR.elbow, _a, POLE_R, 0.34, 0.36);
    solveArm(this.armL.arm, this.armL.elbow, _b, POLE_L, 0.34, 0.36);
  }

  render(renderer, fov, aspect, envMap) {
    this.cam.fov = fov; this.cam.aspect = aspect; this.cam.updateProjectionMatrix();
    if (envMap && this.scene.environment !== envMap) { this.scene.environment = envMap; this.scene.environmentIntensity = 1.2; }
    renderer.clearDepth();
    renderer.render(this.scene, this.cam);
  }
}
