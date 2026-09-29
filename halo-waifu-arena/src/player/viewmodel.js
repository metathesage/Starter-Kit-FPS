/**
 * WAIFU ARENA // Viewmodel & Weapon Socket System
 *
 * Implements first-person weapon rendering, dual-spring recoil,
 * camera sway/lag, walk/sprint bobbing, and precise ADS sight alignment.
 */

import * as THREE from '../../vendor/three/build/three.module.js';
import { GLTFLoader } from '../../vendor/three/examples/jsm/loaders/GLTFLoader.js';

export class Viewmodel {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.loader = new GLTFLoader();

    // Viewmodel root attached directly to camera
    this.root = new THREE.Group();
    this.camera.add(this.root);

    // Weapon slot containers
    this.weaponGroups = {};
    this.activeKey = null;

    // Procedural Sway & Bob state
    this.swayPos = new THREE.Vector3();
    this.swayRot = new THREE.Euler();
    this.bobTimer = 0;
    this.bobAmount = 0;

    // ADS lerp factor (0 = hip, 1 = ADS)
    this.adsFactor = 0;

    // Dynamic Muzzle Flash
    this.flashLight = new THREE.PointLight(0xffcc66, 0, 8);
    this.flashLight.position.set(0, 0, -0.6);
    this.root.add(this.flashLight);

    const flashGeo = new THREE.PlaneGeometry(0.18, 0.18);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthTest: false
    });
    this.flashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.flashMesh.position.set(0, 0, -0.6);
    this.root.add(this.flashMesh);
    this.flashTimer = 0;
  }

  loadWeapon(key, def) {
    if (this.weaponGroups[key]) return;

    const group = new THREE.Group();
    group.visible = false;
    this.root.add(group);
    this.weaponGroups[key] = { group, ready: false, def };

    const file = def.model.endsWith('.glb') ? def.model : `${def.model}.glb`;
    const path = `./assets/weapons/${file}`;

    this.loader.load(
      path,
      (gltf) => {
        const model = gltf.scene;
        const s = def.scale || 1.0;
        model.scale.set(s, s, s);

        if (def.rot) {
          model.rotation.set(def.rot[0], def.rot[1], def.rot[2]);
        }
        if (def.offset) {
          model.position.set(def.offset[0], def.offset[1], def.offset[2]);
        }

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
            if (child.material) {
              child.material.depthTest = true;
              child.material.depthWrite = true;
            }
          }
        });

        group.add(model);
        this.weaponGroups[key].ready = true;
        if (this.activeKey === key) {
          group.visible = true;
        }
      },
      undefined,
      (err) => console.warn(`Failed loading weapon model ${path}:`, err)
    );
  }

  equip(key, def) {
    if (this.activeKey && this.weaponGroups[this.activeKey]) {
      this.weaponGroups[this.activeKey].group.visible = false;
    }

    this.activeKey = key;
    if (!this.weaponGroups[key]) {
      this.loadWeapon(key, def);
    }
    if (this.weaponGroups[key]) {
      this.weaponGroups[key].group.visible = true;
    }
  }

  triggerFlash() {
    this.flashLight.intensity = 2.4;
    this.flashMesh.material.opacity = 0.95;
    this.flashMesh.rotation.z = Math.random() * Math.PI * 2;
    this.flashTimer = 0.05;
  }

  update(dt, playerSpeed, isGrounded, isSprinting, adsTarget, kickPos, kickRot, mouseDX, mouseDY) {
    if (!this.activeKey || !this.weaponGroups[this.activeKey]) return;
    const entry = this.weaponGroups[this.activeKey];
    const def = entry.def;
    const group = entry.group;

    // Update muzzle flash fade
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flashLight.intensity = 0;
        this.flashMesh.material.opacity = 0;
      }
    }

    // ADS interpolation
    this.adsFactor += (adsTarget - this.adsFactor) * Math.min(1.0, dt * 14.0);

    // Weapon Sway (lag opposite to mouse delta)
    const swaySpeed = 16.0;
    const targetSwayX = THREE.MathUtils.clamp(-mouseDX * 0.0004, -0.04, 0.04);
    const targetSwayY = THREE.MathUtils.clamp(mouseDY * 0.0004, -0.04, 0.04);
    this.swayPos.x += (targetSwayX - this.swayPos.x) * Math.min(1.0, dt * swaySpeed);
    this.swayPos.y += (targetSwayY - this.swayPos.y) * Math.min(1.0, dt * swaySpeed);

    // Movement Bobbing
    if (isGrounded && playerSpeed > 0.4) {
      const freq = isSprinting ? 12.0 : 8.5;
      this.bobTimer += dt * freq;
      const amp = isSprinting ? 0.016 : 0.008;
      const adsDamp = 1.0 - this.adsFactor * 0.85;
      this.bobAmount = Math.sin(this.bobTimer) * amp * adsDamp;
    } else {
      this.bobAmount += (0 - this.bobAmount) * dt * 10.0;
    }

    // Base Hip vs ADS position
    const hipPos = def.pos || [0.18, -0.16, -0.32];
    const adsPos = def.adsPos || [0, -0.12, -0.25];

    const posX = THREE.MathUtils.lerp(hipPos[0], adsPos[0], this.adsFactor) + this.swayPos.x;
    const posY = THREE.MathUtils.lerp(hipPos[1], adsPos[1], this.adsFactor) + this.swayPos.y + this.bobAmount;
    const posZ = THREE.MathUtils.lerp(hipPos[2], adsPos[2], this.adsFactor) - kickPos;

    group.position.set(posX, posY, posZ);

    // Rotation: Muzzle kick + slight sway tilt
    const rotX = THREE.MathUtils.degToRad(kickRot) + this.swayPos.y * 1.5;
    const rotY = this.swayPos.x * 2.0;
    const rotZ = this.swayPos.x * 1.2;
    group.rotation.set(rotX, rotY, rotZ);

    // Place muzzle flash at weapon tip
    this.flashLight.position.set(posX, posY + 0.02, posZ - 0.28);
    this.flashMesh.position.set(posX, posY + 0.02, posZ - 0.28);
  }
}
