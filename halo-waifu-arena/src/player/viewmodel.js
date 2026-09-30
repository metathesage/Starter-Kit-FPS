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
    this.flashLight = new THREE.PointLight(0xffb74d, 0, 7);
    this.flashLight.position.set(0, 0, -0.6);
    this.root.add(this.flashLight);

    const flashTex = this._createMuzzleFlashTexture();
    const flashMat = new THREE.SpriteMaterial({
      map: flashTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false
    });
    this.flashMesh = new THREE.Sprite(flashMat);
    this.flashMesh.scale.set(0.24, 0.24, 1);
    this.flashMesh.position.set(0, 0, -0.6);
    this.root.add(this.flashMesh);
    this.flashTimer = 0;
  }

  _createMuzzleFlashTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // 1. Warm plasma fiery radial core
    const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 60);
    grad.addColorStop(0.0, 'rgba(255, 255, 245, 1.0)');
    grad.addColorStop(0.18, 'rgba(255, 215, 80, 0.95)');
    grad.addColorStop(0.42, 'rgba(255, 110, 20, 0.50)');
    grad.addColorStop(0.70, 'rgba(210, 45, 5, 0.15)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    // 2. Crisp 4-point star spike flare
    ctx.save();
    ctx.translate(64, 64);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 4);
      const spikeGrad = ctx.createLinearGradient(0, -56, 0, 56);
      spikeGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
      spikeGrad.addColorStop(0.5, 'rgba(255, 240, 190, 0.85)');
      spikeGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = spikeGrad;
      ctx.fillRect(-2, -56, 4, 112);
    }
    ctx.restore();

    return new THREE.CanvasTexture(canvas);
  }

  loadWeapon(key, def) {
    if (this.weaponGroups[key]) return;

    const group = new THREE.Group();
    group.visible = false;
    this.root.add(group);
    this.weaponGroups[key] = { group, ready: false, def, mixer: null, actions: {}, currentAction: null };

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

        // Initialize AnimationMixer if model contains animation clips
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          const actions = {};
          for (const clip of gltf.animations) {
            const action = mixer.clipAction(clip);
            actions[clip.name] = action;
            actions[clip.name.toLowerCase()] = action;
          }
          this.weaponGroups[key].mixer = mixer;
          this.weaponGroups[key].actions = actions;

          // Default to looping Idle
          const idleAction = actions['Idle'] || actions['idle'] || actions['Idle_Loop'];
          if (idleAction) {
            idleAction.setLoop(THREE.LoopRepeat);
            idleAction.play();
            this.weaponGroups[key].currentAction = idleAction;
          }
        }

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
      const entry = this.weaponGroups[key];
      entry.group.visible = true;
      if (entry.actions) {
        const idle = entry.actions['Idle'] || entry.actions['idle'] || entry.actions['Idle_Loop'];
        if (idle && !idle.isRunning()) {
          idle.reset().setLoop(THREE.LoopRepeat).play();
        }
      }
    }
  }

  playAnimation(name, loop = false, timeScale = 1.0) {
    if (!this.activeKey || !this.weaponGroups[this.activeKey]) return;
    const entry = this.weaponGroups[this.activeKey];
    if (!entry.mixer || !entry.actions) return;

    const action = entry.actions[name] || entry.actions[name.toLowerCase()];
    if (!action) return;

    if (!loop) {
      action.reset();
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = false;
      action.timeScale = timeScale;
      action.play();
    } else {
      action.reset();
      action.setLoop(THREE.LoopRepeat);
      action.timeScale = timeScale;
      action.play();
    }
  }

  triggerFlash() {
    this.flashLight.intensity = 2.8;
    this.flashMesh.material.opacity = 0.95;
    this.flashMesh.material.rotation = Math.random() * Math.PI * 2;
    const s = this.adsFactor > 0.5 ? 0.14 : 0.24;
    this.flashMesh.scale.set(s, s, 1);
    this.flashTimer = 0.045;
  }

  update(dt, playerSpeed, isGrounded, isSprinting, adsTarget, kickPos, kickRot, mouseDX, mouseDY) {
    if (!this.activeKey || !this.weaponGroups[this.activeKey]) return;
    const entry = this.weaponGroups[this.activeKey];
    const def = entry.def;
    const group = entry.group;

    // Advance weapon skeletal / model animations
    if (entry.mixer) {
      entry.mixer.update(dt);
    }

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
