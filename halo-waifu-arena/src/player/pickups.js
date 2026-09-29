/**
 * WAIFU ARENA // Tactical Weapon Pickup System (Halo / Call of Duty Standard)
 *
 * Spawns rotating 3D power weapons and tactical ordnance across the map with:
 * - Holographic pulsing floor pedestals & beacon lights
 * - 3D rotating weapon models hovering in midair
 * - Proximity detection (< 2.2m) with HUD interaction prompt "[E] EQUIP <WEAPON>"
 * - Refills magazines and reserves on pickup
 * - 22-second tactical respawn timer with visual energy charge
 */

import * as THREE from '../../vendor/three/build/three.module.js';
import { GLTFLoader } from '../../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { WEAPONS, ARENA_ARSENAL } from './weapons.js';

export class WeaponPickupManager {
  constructor(scene, hud, audio) {
    this.scene = scene;
    this.hud = hud;
    this.audio = audio;
    this.loader = new GLTFLoader();
    this.pickups = [];
    this.activePromptPickup = null;
    this.group = new THREE.Group();
    this.group.name = 'WeaponPickups';
    this.scene.add(this.group);
  }

  init(mapKey) {
    this.dispose();
    let spawnPoints = [];
    if (mapKey === 'cs_blackhawk') {
      spawnPoints = [
        { weaponKey: 'chaperone', pos: [-13.48, -2.26, 26.5], label: 'BUNKER // THE CHAPERONE' },
        { weaponKey: 'm4a1', pos: [-24.5, -2.26, 12.0], label: 'ALLEY CHOKE // M4A1 CARBINE' },
        { weaponKey: 'outbreak', pos: [2.5, -2.26, 20.0], label: 'PLAZA // OUTBREAK PERFECTED' },
        { weaponKey: 'launcher', pos: [-8.0, -2.26, -18.0], label: 'TERRORIST RUINS // LOTUS LAUNCHER' },
        { weaponKey: 'ace', pos: [-13.48, -2.26, 52.0], label: 'CT PERCH // ACE OF SPADES' },
        { weaponKey: 'sword', pos: [-32.0, -2.26, 0.0], label: 'HELICOPTER TAIL // ENERGY SWORD' }
      ];
    } else if (mapKey === 'lockout') {
      spawnPoints = [
        { weaponKey: 'sword', pos: [0, -4.2, 0], label: 'LOWER LIFT // TYPE-1 ENERGY SWORD' },
        { weaponKey: 'launcher', pos: [0, 9.4, 0], label: 'TOP TOWER // LOTUS LAUNCHER' },
        { weaponKey: 'chaperone', pos: [-9.5, 1.25, -6.0], label: 'LIBRARY WALKWAY // THE CHAPERONE' },
        { weaponKey: 'outbreak', pos: [10.0, 1.25, 4.0], label: 'ELBOW RIDGE // OUTBREAK PERFECTED' },
        { weaponKey: 'm4a1', pos: [-8.5, -4.2, 10.0], label: 'COURTYARD // M4A1 CARBINE' },
        { weaponKey: 'ace', pos: [0, 1.25, -13.5], label: 'SNIPER LEDGE // ACE OF SPADES' }
      ];
    } else if (mapKey === 'rust') {
      spawnPoints = [
        { weaponKey: 'sword', pos: [0, 1.2, 0], label: 'CENTRAL PIPE // TYPE-1 ENERGY SWORD' },
        { weaponKey: 'launcher', pos: [0, 14.5, 0], label: 'CRANE GANTRY // LOTUS LAUNCHER' },
        { weaponKey: 'outbreak', pos: [-12.0, 4.5, -8.0], label: 'CONTAINER ROOF // OUTBREAK PERFECTED' },
        { weaponKey: 'chaperone', pos: [12.0, 1.2, 10.0], label: 'FUEL TANKS // THE CHAPERONE' },
        { weaponKey: 'm4a1', pos: [-10.0, 1.2, 12.0], label: 'LOADING DOCK // M4A1 CARBINE' },
        { weaponKey: 'ak47', pos: [10.0, 1.2, -12.0], label: 'PERIMETER FENCE // AK-47' }
      ];
    } else {
      // Default: Halo Haven
      spawnPoints = [
        { weaponKey: 'sword', pos: [0, 0.1, 0], label: 'CENTRAL HILL // TYPE-1 ENERGY SWORD' },
        { weaponKey: 'launcher', pos: [0, 8.5, -45.0], label: 'TOP BRIDGE // LOTUS LAUNCHER' },
        { weaponKey: 'chaperone', pos: [-22.0, -3.0, 15.0], label: 'WEST POD // THE CHAPERONE' },
        { weaponKey: 'outbreak', pos: [22.0, -3.0, 15.0], label: 'EAST POD // OUTBREAK PERFECTED' },
        { weaponKey: 'smg', pos: [0, -4.5, 35.0], label: 'LOWER TUNNEL // HANAMI SMG' },
        { weaponKey: 'hawkmoon', pos: [0, -4.5, -60.0], label: 'SOUTH CORRIDOR // HAWKMOON' }
      ];
    }

    spawnPoints.forEach((cfg, idx) => {
      this._createPickup(cfg, idx);
    });
  }

  _createPickup(cfg, id) {
    const def = WEAPONS[cfg.weaponKey] || WEAPONS.ak47;
    const root = new THREE.Group();
    root.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);

    // 1. Holographic Floor Pedestal Ring
    const isPower = (cfg.weaponKey === 'sword' || cfg.weaponKey === 'launcher');
    const ringColor = isPower ? 0xfbbf24 : 0x00f3ff;
    const ringGeo = new THREE.RingGeometry(0.55, 0.72, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.04;
    root.add(ringMesh);

    // Inner glowing disc
    const discGeo = new THREE.CircleGeometry(0.52, 24);
    const discMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.rotation.x = -Math.PI / 2;
    discMesh.position.y = 0.03;
    root.add(discMesh);

    // Subtle upward beacon light column
    const beaconGeo = new THREE.CylinderGeometry(0.12, 0.50, 2.4, 16, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.y = 1.2;
    root.add(beaconMesh);

    // Point Light
    const pLight = new THREE.PointLight(ringColor, 0.8, 3.5);
    pLight.position.y = 0.85;
    root.add(pLight);

    // 2. Weapon Model Carrier Group (animates with spin and bob)
    const weaponCarrier = new THREE.Group();
    weaponCarrier.position.y = 0.82;
    root.add(weaponCarrier);

    // Load actual GLTF weapon mesh
    const file = def.model.endsWith('.glb') ? def.model : `${def.model}.glb`;
    const weaponPath = `./assets/weapons/${file}`;

    this.loader.load(weaponPath, (gltf) => {
      const model = gltf.scene;
      const baseScale = (def.scale || 1.0) * 0.75;
      model.scale.set(baseScale, baseScale, baseScale);
      if (def.rot) {
        model.rotation.set(def.rot[0], def.rot[1], def.rot[2]);
      }
      model.traverse((c) => {
        if (c.isMesh) {
          c.frustumCulled = false;
          c.castShadow = true;
          c.receiveShadow = true;
          if (c.material) {
            c.material.roughness = 0.35;
            c.material.metalness = 0.75;
          }
        }
      });
      weaponCarrier.add(model);
    }, undefined, () => {
      // Fallback placeholder diamond if file fails
      const fallbackGeo = new THREE.OctahedronGeometry(0.28, 0);
      const fallbackMat = new THREE.MeshStandardMaterial({
        color: ringColor,
        roughness: 0.2,
        metalness: 0.9,
        emissive: ringColor,
        emissiveIntensity: 0.3
      });
      const fallbackMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
      weaponCarrier.add(fallbackMesh);
    });

    const pickup = {
      id,
      weaponKey: cfg.weaponKey,
      def,
      root,
      pos: root.position,
      ringMesh,
      discMesh,
      beaconMesh,
      pLight,
      weaponCarrier,
      active: true,
      respawnTimer: 0,
      respawnDuration: 22.0,
      ringColor
    };

    this.pickups.push(pickup);
    this.group.add(root);
  }

  update(dt, playerPos, isInteractPressed, onEquipWeapon) {
    const time = performance.now() * 0.001;
    let closestPickup = null;
    let closestDist = 2.4; // 2.4 meters pickup interaction radius

    for (const p of this.pickups) {
      if (!p.active) {
        // Handling respawn timer
        p.respawnTimer -= dt;
        const progress = Math.max(0, 1 - (p.respawnTimer / p.respawnDuration));
        p.discMesh.scale.set(progress, progress, progress);
        p.ringMesh.material.opacity = 0.25 + progress * 0.6;
        if (p.respawnTimer <= 0) {
          p.active = true;
          p.weaponCarrier.visible = true;
          p.beaconMesh.visible = true;
          p.pLight.intensity = 0.8;
          p.discMesh.scale.set(1, 1, 1);
          p.ringMesh.material.color.setHex(p.ringColor);
        }
        continue;
      }

      // Floating bob & rotation
      p.weaponCarrier.rotation.y += dt * 1.5;
      p.weaponCarrier.position.y = 0.82 + Math.sin(time * 2.8 + p.id) * 0.07;
      p.ringMesh.rotation.z += dt * 0.5;

      // Distance to player
      const dx = playerPos.x - p.pos.x;
      const dy = playerPos.y - p.pos.y;
      const dz = playerPos.z - p.pos.z;
      const dist = Math.hypot(dx, dy, dz);

      if (dist < closestDist) {
        closestDist = dist;
        closestPickup = p;
      }
    }

    // Update HUD interaction prompt
    const promptEl = document.getElementById('pickup-prompt');
    if (closestPickup && closestPickup.active) {
      this.activePromptPickup = closestPickup;
      if (promptEl) {
        const slotIdx = ARENA_ARSENAL.indexOf(closestPickup.weaponKey);
        const slotText = slotIdx >= 0 ? `[SLOT ${slotIdx + 1}]` : '';
        promptEl.innerHTML = `
          <div style="font-family:'Share Tech Mono', monospace; font-size:11px; color:#00f3ff; letter-spacing:2px;">// TACTICAL WEAPON PICKUP</div>
          <div style="font-size:18px; font-weight:800; color:#ffffff; margin: 2px 0;">[E] EQUIP ${closestPickup.def.name.toUpperCase()}</div>
          <div style="font-family:'Share Tech Mono', monospace; font-size:11px; color:#94a3b8;">${closestPickup.def.archetype || 'ORDNANCE'} ${slotText}</div>
        `;
        promptEl.style.display = 'block';
        promptEl.style.opacity = '1';
      }

      // Check if user pressed interact key [E] or controller X
      if (isInteractPressed) {
        this._collectPickup(closestPickup, onEquipWeapon);
      }
    } else {
      this.activePromptPickup = null;
      if (promptEl) {
        promptEl.style.opacity = '0';
        setTimeout(() => { if (!this.activePromptPickup) promptEl.style.display = 'none'; }, 150);
      }
    }
  }

  _collectPickup(pickup, onEquipWeapon) {
    if (!pickup.active) return;
    pickup.active = false;
    pickup.weaponCarrier.visible = false;
    pickup.beaconMesh.visible = false;
    pickup.pLight.intensity = 0.15;
    pickup.respawnTimer = pickup.respawnDuration;
    pickup.discMesh.scale.set(0.01, 0.01, 0.01);
    pickup.ringMesh.material.color.setHex(0x64748b);

    if (this.audio) {
      this.audio.playGunshot('snap');
    }

    const slotIdx = ARENA_ARSENAL.indexOf(pickup.weaponKey);
    if (onEquipWeapon && slotIdx >= 0) {
      onEquipWeapon(slotIdx);
    }

    if (this.hud) {
      this.hud.addFeedMessage('ARSENAL', pickup.def.name.toUpperCase(), 'EQUIPPED', true);
    }
  }

  dispose() {
    this.activePromptPickup = null;
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      child.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material.dispose();
        }
      });
    }
    this.pickups = [];
  }
}
