/**
 * WAIFU ARENA // Master Game Orchestrator
 *
 * Implements Counter-Strike 5v5 Match against Bots on CS Blackhawk Down,
 * Halo Haven Arena KOTH, 120Hz physics simulation, dual-spring recoil,
 * calibrated 1.75m third-person OTS camera, and full 11-weapon arsenal.
 */

import * as THREE from '../vendor/three/build/three.module.js';
import { GLTFLoader } from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { Loop, SIM_DT } from './core/loop.js';
import { Input } from './core/input.js';
import { Collision } from './world/collision.js';
import { Character, MOVE } from './player/controller.js';
import { WeaponSystem, WEAPONS, ARENA_ARSENAL } from './player/weapons.js';
import { Viewmodel } from './player/viewmodel.js';
import { AudioEngine } from './fx/audio.js';
import { BotManager } from './ai/bots.js';
import { HUD } from './ui/hud.js';

class GameApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.audio = new AudioEngine();
    this.hud = new HUD();

    // Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    this.camera = new THREE.PerspectiveCamera(85, window.innerWidth / window.innerHeight, 0.05, 1200);
    this.cameraPivot = new THREE.Group();
    this.scene.add(this.cameraPivot);
    this.cameraPivot.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    // Systems
    this.input = new Input(this.renderer.domElement);
    this.collision = null;
    this.character = null;
    this.weapons = null;
    this.viewmodel = null;
    this.botManager = null;
    this.mapMeta = null;
    this.mapMesh = null;

    // Current Active Map: 'cs_blackhawk' or 'haven'
    this.currentMapKey = 'cs_blackhawk';

    // Perspective: 'FPS' (1st Person) or 'OTS' (3rd Person Over-The-Shoulder)
    this.perspective = 'FPS';

    // Player Heroine Model Container (for 3rd Person)
    this.heroineGroup = new THREE.Group();
    this.heroineGroup.visible = false;
    this.scene.add(this.heroineGroup);
    this.currentHeroineKey = 'mai';
    this.heroineMixer = null;

    // 3rd Person Weapon Socket attached to heroine's right arm
    this.heroineWeaponSocket = new THREE.Group();
    this.heroineWeaponSocket.position.set(0.18, 1.15, 0.28);
    this.heroineGroup.add(this.heroineWeaponSocket);
    this.thirdPersonWeaponMesh = null;

    // Player Vitals (Halo / CS Kevlar: 100 Shield + 100 Health)
    this.playerHealth = 100;
    this.playerShield = 100;
    this.maxHealth = 100;
    this.maxShield = 100;
    this.lastDamageTime = 0;
    this.shieldRecharging = false;

    // Counter-Strike Match State
    this.csMatch = {
      round: 1,
      maxRounds: 13,
      ctScore: 0,
      tScore: 0,
      state: 'FREEZE', // 'FREEZE', 'LIVE', 'ROUND_OVER'
      roundTimer: 105,
      freezeTimer: 4.5,
      roundOverTimer: 0,
      money: 16000
    };

    // Halo KOTH Match State
    this.kothCenter = new THREE.Vector3(-9.68, -3.00, 18.83);
    this.kothRadius = 6.0;
    this.playerScore = 0;
    this.botScore = 0;
    this.kothRingMesh = null;

    // Visual atmosphere elements
    this.stars = null;
    this.planet = null;
    this.aura = null;
    this.ambientLight = null;
    this.hemiLight = null;
    this.sun = null;

    // Tracers pool
    this.tracers = [];

    // Camera recoil smoothing
    this.currentCamRecoilPitch = 0;
    this.currentCamRecoilYaw = 0;

    this.initAsync();
  }

  async initAsync() {
    try {
      this._setupLighting();
      this._setupKothRing();

      // 1. Initialize Controller & Weapons
      this.character = new Character(null);
      this.weapons = new WeaponSystem(null, ARENA_ARSENAL);
      this.weapons.owner = this.character;

      this.viewmodel = new Viewmodel(this.camera, this.scene);
      ARENA_ARSENAL.forEach((key) => {
        this.viewmodel.loadWeapon(key, WEAPONS[key]);
      });
      this.viewmodel.equip('ak47', WEAPONS.ak47);

      // 2. Load Selected Map (defaults to CS Blackhawk Down)
      await this.loadMap(this.currentMapKey);

      // 3. Load 3rd Person Master Heroine & Destiny Ghost Companion
      this._loadHeroine('mai');
      this._loadGhostCompanion();

      // 4. Bind UI Interaction & Resizing
      this._bindEvents();

      // 5. Start Fixed 120Hz Loop
      this.loop = new Loop({
        simulate: (dt) => this.simulate(dt),
        render: (alpha) => this.render(alpha)
      });
      this.loop.start();

      // Update Initial HUD
      this.hud.updateVitals(this.playerShield, this.maxShield, this.playerHealth, this.maxHealth);
      const activeIdx = ARENA_ARSENAL.indexOf('ak47');
      this.hud.updateWeapon(WEAPONS.ak47, this.weapons.ammo, this.weapons.slot.reserve, activeIdx >= 0 ? activeIdx : 0);
    } catch (err) {
      console.error('[CRITICAL INIT ERROR]', err);
      window._lastError = err.message;
      const errBox = document.createElement('div');
      errBox.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(239,68,68,0.92);padding:24px 36px;border-radius:6px;color:#fff;font-family:monospace;font-size:16px;z-index:999999;box-shadow:0 0 40px #ef4444;text-align:center;max-width:550px;';
      errBox.innerHTML = `<strong>ARENA BOOT ERROR:</strong><br><br>${err.message}<br><br><span style="font-size:13px;opacity:0.9;">Ensure http://localhost:8080 is running and assets are reachable.</span>`;
      document.body.appendChild(errBox);
    }
  }

  async loadMap(mapKey) {
    this.currentMapKey = mapKey;
    const isCS = (mapKey === 'cs_blackhawk');

    const mapTxt = document.getElementById('map-txt');
    if (mapTxt) {
      mapTxt.innerText = isCS ? 'MAP // CS BLACKHAWK' : 'MAP // HALO HAVEN';
      mapTxt.style.color = isCS ? '#fbbf24' : '#00f3ff';
    }

    const teamTitle = document.getElementById('vitals-team-name');
    if (teamTitle) {
      teamTitle.innerText = isCS ? 'CT WAIFU SQUAD' : 'SPARTAN WAIFU';
    }
    const teamSub = document.getElementById('vitals-sub-status');
    if (teamSub) {
      teamSub.innerText = isCS ? 'KEVLAR & HELMET // 100' : 'SHIELDS // NOMINAL';
    }

    // 1. Remove previous map mesh
    if (this.mapMesh) {
      this.scene.remove(this.mapMesh);
      this.mapMesh = null;
    }

    // 2. Fetch Map Metadata & Collision BVH
    const dir = isCS ? './assets/map_cs/' : './assets/map/';
    const metaRes = await fetch(`${dir}map.json`);
    if (!metaRes.ok) throw new Error(`HTTP ${metaRes.status} loading ${dir}map.json`);
    this.mapMeta = await metaRes.json();

    const colRes = await fetch(`${dir}collision.bin`);
    if (!colRes.ok) throw new Error(`HTTP ${colRes.status} loading ${dir}collision.bin`);
    const colBuf = await colRes.arrayBuffer();
    this.collision = new Collision(colBuf);

    if (this.character) this.character.collision = this.collision;
    if (this.weapons) this.weapons.collision = this.collision;

    // 3. Configure Lighting & Sky Atmosphere
    if (isCS) {
      this.scene.background = new THREE.Color(0x93c5fd); // Sunny desert sky
      this.scene.fog = new THREE.FogExp2(0xdbeafe, 0.0035);
      if (this.ambientLight) this.ambientLight.color.setHex(0xfef08a);
      if (this.ambientLight) this.ambientLight.intensity = 0.65;
      if (this.hemiLight) this.hemiLight.color.setHex(0x93c5fd);
      if (this.hemiLight) this.hemiLight.groundColor.setHex(0xd97706);
      if (this.sun) {
        this.sun.color.setHex(0xfffbeb);
        this.sun.intensity = 1.6;
        this.sun.position.set(-60, 110, -50);
      }
      if (this.stars) this.stars.visible = false;
      if (this.planet) this.planet.visible = false;
      if (this.aura) this.aura.visible = false;
      if (this.kothRingMesh) this.kothRingMesh.visible = false;
    } else {
      this.scene.background = new THREE.Color(0x060919); // Cosmic Halo night
      this.scene.fog = new THREE.FogExp2(0x0a1024, 0.0075);
      if (this.ambientLight) this.ambientLight.color.setHex(0x283b66);
      if (this.ambientLight) this.ambientLight.intensity = 0.65;
      if (this.hemiLight) this.hemiLight.color.setHex(0x38bdf8);
      if (this.hemiLight) this.hemiLight.groundColor.setHex(0x090d16);
      if (this.sun) {
        this.sun.color.setHex(0xdbeafe);
        this.sun.intensity = 1.45;
        this.sun.position.set(-35, 75, -55);
      }
      if (this.stars) this.stars.visible = true;
      if (this.planet) this.planet.visible = true;
      if (this.aura) this.aura.visible = true;
      if (this.kothRingMesh) this.kothRingMesh.visible = true;
    }

    // 4. Load Visual 3D GLTF Mesh
    const gltfFile = isCS ? `${dir}cs_blackhawk_down.glb` : `${dir}haven.glb`;
    new GLTFLoader().load(
      gltfFile,
      (gltf) => {
        const map = gltf.scene;
        this.mapMesh = map;

        if (isCS) {
          // Black Hawk Down map has identity scale and -12.94 / -4.90 center offset matching BVH
          map.position.set(-12.94, 0, -4.90);
          map.rotation.set(0, 0, 0);
          map.scale.set(1.0, 1.0, 1.0);
        } else {
          // Halo Haven map: -90 deg X, 0.1 scale
          map.position.set(0, 0, 0);
          map.rotation.x = -Math.PI / 2;
          map.scale.set(0.1, 0.1, 0.1);
        }

        map.traverse((c) => {
          if (c.isMesh) {
            c.receiveShadow = true;
            c.castShadow = true;
            if (c.material) {
              c.material.roughness = 0.68;
              c.material.metalness = 0.20;
            }
          }
        });
        this.scene.add(map);
      },
      undefined,
      (err) => console.warn('[MAP LOAD WARNING]', err)
    );

    // 5. Spawn Player at authentic Base
    const spawnPt = isCS
      ? (this.mapMeta.ctSpawns ? this.mapMeta.ctSpawns[0] : [0, -2, 40])
      : (this.mapMeta.spawns ? this.mapMeta.spawns[0] : [6.32, -4.03, -69.67]);

    this.playerHealth = this.maxHealth;
    this.playerShield = this.maxShield;
    this.character.spawn(spawnPt[0], spawnPt[1], spawnPt[2], isCS ? 0 : Math.PI);

    // 6. Initialize Bot Sparring / CS Squads
    if (this.botManager) {
      this.botManager.dispose();
    }
    this.botManager = new BotManager(this.scene, this.collision, this.mapMeta);
    this.botManager.init(isCS ? 'counter_strike' : 'halo');

    this.botManager.onDamageCallback = (evt) => {
      this.audio.playHitmarker(evt.isCrit);
      this.hud.flashHitmarker(evt.isCrit);
      if (evt.shieldBroke) this.audio.playShieldPop();

      if (Math.random() < 0.65) {
        this.audio.playVoice('damage');
      }

      // 3D Screen Space Floating Damage Number
      const screenPos = evt.hitPoint.clone().project(this.camera);
      const sx = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;
      this.hud.spawnDamageNumber(sx, sy, evt.amount, evt.isCrit);
    };

    this.botManager.onKillCallback = (bot, attacker) => {
      this.audio.playKillStinger();
      this.audio.playVoice('death');
      setTimeout(() => this.audio.playVoice('confirm'), 550);
      const weaponName = (attacker === 'YOU') ? this.weapons.def.name : (attacker || 'TACTICAL');
      this.hud.addFeedMessage(attacker || 'YOU', bot.name, weaponName, true);
    };

    this.botManager.onTracerCallback = (start, end, color) => {
      this._spawnTracer(start, end, color);
    };

    // 7. Reset Match Mode Systems
    if (isCS) {
      this.csMatch = {
        round: 1,
        maxRounds: 13,
        ctScore: 0,
        tScore: 0,
        state: 'FREEZE',
        roundTimer: 105,
        freezeTimer: 4.5,
        roundOverTimer: 0,
        money: 16000
      };
      this.audio.playRoundStart();
      this.hud.showRoundBanner('COUNTER-STRIKE 5v5', 'Black Hawk Down • Defend & Eliminate', true);
      setTimeout(() => this.hud.hideRoundBanner(), 2500);
      this.hud.addFeedMessage('SYSTEM', 'MATCH LIVE', 'CS 5v5 ELIMINATION', true);
    } else {
      this.playerScore = 0;
      this.botScore = 0;
      this.hud.addFeedMessage('SYSTEM', 'HAVEN ARENA', 'KOTH CONTROL', true);
    }

    this.hud.updateVitals(this.playerShield, this.maxShield, this.playerHealth, this.maxHealth);
  }

  toggleMap() {
    const next = (this.currentMapKey === 'cs_blackhawk') ? 'haven' : 'cs_blackhawk';
    this.loadMap(next);
  }

  _setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xfef08a, 0.65);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0xd97706, 0.45);
    this.scene.add(this.hemiLight);

    this.sun = new THREE.DirectionalLight(0xfffbeb, 1.6);
    this.sun.position.set(-60, 110, -50);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width = 2048;
    this.sun.shadow.mapSize.height = 2048;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 400;
    const d = 120;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.scene.add(this.sun);

    // Cosmic Starfield for Halo Haven
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 650;
      starPos[i + 1] = Math.random() * 350 - 30;
      starPos[i + 2] = (Math.random() - 0.5) * 650;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.85, transparent: true, opacity: 0.85 });
    this.stars = new THREE.Points(starGeo, starMat);
    this.stars.visible = false;
    this.scene.add(this.stars);

    // Celestial Planet for Halo Haven
    this.planet = new THREE.Mesh(
      new THREE.SphereGeometry(45, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x1d4ed8 })
    );
    this.planet.position.set(130, 95, -280);
    this.planet.visible = false;
    this.scene.add(this.planet);

    this.aura = new THREE.Mesh(
      new THREE.RingGeometry(46, 75, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
    );
    this.aura.position.copy(this.planet.position);
    this.aura.position.z += 1;
    this.aura.visible = false;
    this.scene.add(this.aura);
  }

  _setupKothRing() {
    const ringGeo = new THREE.RingGeometry(this.kothRadius - 0.2, this.kothRadius, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    this.kothRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.kothRingMesh.rotation.x = -Math.PI / 2;
    this.kothRingMesh.position.copy(this.kothCenter);
    this.kothRingMesh.position.y += 0.08;
    this.kothRingMesh.visible = false;
    this.scene.add(this.kothRingMesh);
  }

  _loadHeroine(key) {
    this.currentHeroineKey = key;
    // Calibrated scales & orientations: Standardizes every heroine to 1.75m human height
    const configs = {
      mai: { file: 'mai_maid_combat_ready.glb', scale: 0.50, rotY: 0, pos: [0, 0, 0], anim: 'Standby' },
      miyazawa: { file: 'main_heroine_miyazawa_combat_ready.glb', scale: 2.05, rotY: Math.PI, pos: [0, 0, -0.20], anim: 'ani_idle_basic_new' },
      lucy: { file: 'lucy_edgerunner_rigged.glb', scale: 0.0102, rotY: Math.PI, pos: [0, 0, 0], anim: 'char_mint_stand_show_1' }
    };

    // Update op-dock active tab
    const tabs = document.querySelectorAll('.op-tab');
    const heroines = ['mai', 'miyazawa', 'lucy'];
    tabs.forEach((tab, idx) => {
      tab.classList.toggle('active', heroines[idx] === key);
    });

    const conf = configs[key] || configs.mai;
    this.heroineConfig = conf;
    const path = `./assets/chars/${conf.file}`;

    new GLTFLoader().load(path, (gltf) => {
      if (this.currentHeroineKey !== key) return;

      const model = gltf.scene;
      model.scale.set(conf.scale, conf.scale, conf.scale);
      model.rotation.y = conf.rotY || 0;
      const p = conf.pos || [0, 0, 0];
      model.position.set(p[0], p[1], p[2]);
      model.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });

      // Remove previous character meshes (preserving weapon socket)
      for (let i = this.heroineGroup.children.length - 1; i >= 0; i--) {
        const child = this.heroineGroup.children[i];
        if (child !== this.heroineWeaponSocket) {
          this.heroineGroup.remove(child);
        }
      }

      this.heroineGroup.add(model);
      this.heroineGroup.visible = (this.perspective === 'OTS');

      if (gltf.animations && gltf.animations.length > 0) {
        this.heroineMixer = new THREE.AnimationMixer(model);
        const clips = gltf.animations;
        const targetAnim = conf.anim;
        const bestClip = (targetAnim && clips.find(c => c.name.toLowerCase().includes(targetAnim.toLowerCase())))
          || clips.find(c => ['ani_lobby_idle', 'standby', 'idle', 'ani_idle_basic_new', 'char_mint_stand_show_1'].some(n => c.name.toLowerCase().includes(n.toLowerCase())))
          || clips[0];
        const action = this.heroineMixer.clipAction(bestClip);
        action.play();
      }

      this._updateThirdPersonWeapon(this.weapons ? this.weapons.currentKey : 'ak47');
    });
  }

  _updateThirdPersonWeapon(weaponKey) {
    if (!this.heroineWeaponSocket) return;
    while (this.heroineWeaponSocket.children.length > 0) {
      this.heroineWeaponSocket.remove(this.heroineWeaponSocket.children[0]);
    }

    const def = WEAPONS[weaponKey] || WEAPONS.ak47;
    const file = def.model.endsWith('.glb') ? def.model : `${def.model}.glb`;
    const path = `./assets/weapons/${file}`;

    // Calibrated real-world scales & rotations for third-person socket
    const thirdPersonConfigs = {
      ak47: { scale: 1.05, rot: [0, Math.PI / 2, 0], pos: [0.22, 1.08, -0.32] },
      m4a1: { scale: 0.42, rot: [0, 0, 0], pos: [0.22, 1.08, -0.32] },
      mac10: { scale: 1.40, rot: [0, Math.PI / 2, 0], pos: [0.20, 1.05, -0.28] },
      ace: { scale: 0.72, rot: [0, Math.PI / 2, 0], pos: [0.20, 1.05, -0.30] },
      hawkmoon: { scale: 0.72, rot: [0, 0, 0], pos: [0.20, 1.05, -0.30] },
      outbreak: { scale: 0.25, rot: [0, Math.PI / 2, 0], pos: [0.22, 1.08, -0.34] },
      chaperone: { scale: 0.85, rot: [0, 0, 0], pos: [0.22, 1.08, -0.34] },
      smg: { scale: 0.90, rot: [0, Math.PI / 2, 0], pos: [0.20, 1.05, -0.30] },
      shotgun: { scale: 0.88, rot: [0, Math.PI / 2, 0], pos: [0.22, 1.08, -0.34] },
      launcher: { scale: 0.82, rot: [0, 0, 0], pos: [0.24, 1.15, -0.34] },
      sword: { scale: 0.75, rot: [-Math.PI / 2.2, 0.25, -0.2], pos: [0.24, 1.02, -0.28] },
      lament: { scale: 0.75, rot: [0, 0, 0], pos: [0.24, 1.02, -0.28] }
    };

    const tpc = thirdPersonConfigs[weaponKey] || {
      scale: 0.85,
      rot: def.rot || [0, 0, 0],
      pos: [0.18, 1.05, -0.22]
    };

    this.heroineWeaponSocket.position.set(tpc.pos[0], tpc.pos[1], tpc.pos[2]);

    new GLTFLoader().load(path, (gltf) => {
      const weaponModel = gltf.scene;
      weaponModel.scale.set(tpc.scale, tpc.scale, tpc.scale);
      if (tpc.rot) {
        weaponModel.rotation.set(tpc.rot[0], tpc.rot[1], tpc.rot[2]);
      }
      weaponModel.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      this.heroineWeaponSocket.add(weaponModel);
    }, undefined, () => {});
  }

  _loadGhostCompanion() {
    this.ghostGroup = new THREE.Group();
    this.scene.add(this.ghostGroup);

    new GLTFLoader().load('./assets/chars/ghost.glb', (gltf) => {
      const ghost = gltf.scene;
      ghost.scale.set(0.12, 0.12, 0.12);
      ghost.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          if (c.material) {
            c.material.metalness = 0.8;
            c.material.roughness = 0.25;
          }
        }
      });
      const coreLight = new THREE.PointLight(0x00f3ff, 1.2, 3);
      coreLight.position.set(0, 0, 0);
      this.ghostGroup.add(coreLight);
      this.ghostGroup.add(ghost);
    }, undefined, () => {});
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const startPrompt = document.getElementById('start-prompt');
    const engageCombat = () => {
      this.input.requestLock();
      this.audio.init();
      this.audio.resume();
      if (startPrompt) {
        startPrompt.style.opacity = '0';
        setTimeout(() => { startPrompt.style.display = 'none'; }, 300);
      }
    };

    if (startPrompt) {
      startPrompt.addEventListener('click', engageCombat);
    }
    this.renderer.domElement.addEventListener('click', engageCombat);

    window.addEventListener('keydown', (e) => {
      if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        // Digit 1-9, Digit 0 is index 9
        const slot = (num === 0) ? 9 : num - 1;
        if (slot >= 0 && slot < ARENA_ARSENAL.length) {
          this.switchWeapon(slot);
        }
      }
      if (e.code === 'KeyV') {
        this.togglePerspective();
      }
      if (e.code === 'KeyM') {
        this.toggleMap();
      }
      if (e.code === 'KeyH') {
        const heroines = ['mai', 'miyazawa', 'lucy'];
        const nextIdx = (heroines.indexOf(this.currentHeroineKey) + 1) % heroines.length;
        this._loadHeroine(heroines[nextIdx]);
        if (this.hud) {
          const names = { mai: 'MAI MAID', miyazawa: 'MIYAZAWA', lucy: 'LUCY EDGERUNNER' };
          this.hud.addFeedMessage('HEROINE', names[heroines[nextIdx]], 'EQUIPPED', true);
        }
      }
    });

    // Weapon Pips Click
    const pips = document.querySelectorAll('.w-pip');
    pips.forEach((pip, idx) => {
      pip.addEventListener('click', () => this.switchWeapon(idx));
    });
  }

  switchWeapon(idx) {
    if (idx < 0 || idx >= ARENA_ARSENAL.length) return;
    this.weapons.select(idx);
    const key = ARENA_ARSENAL[idx];
    const def = WEAPONS[key];
    this.viewmodel.equip(key, def);
    this.hud.updateWeapon(def, this.weapons.ammo, this.weapons.slot.reserve, idx);
    this.audio.playGunshot('snap');
    this._updateThirdPersonWeapon(key);
  }

  togglePerspective() {
    this.perspective = this.perspective === 'FPS' ? 'OTS' : 'FPS';
    this.heroineGroup.visible = (this.perspective === 'OTS');
    this.viewmodel.root.visible = (this.perspective === 'FPS');

    const viewTxt = document.getElementById('view-txt');
    if (viewTxt) viewTxt.innerText = `CAM // ${this.perspective}`;
  }

  applyPlayerDamage(amount, zone = 'torso', attackerName = 'Hostile') {
    if (this.playerHealth <= 0) return;
    this.lastDamageTime = performance.now();
    this.shieldRecharging = false;

    let remaining = amount;
    if (this.playerShield > 0) {
      if (this.playerShield >= remaining) {
        this.playerShield -= remaining;
        remaining = 0;
        this.audio.playShieldHit();
        this.hud.flashShieldDamage();
      } else {
        remaining -= this.playerShield;
        this.playerShield = 0;
        this.audio.playShieldPop();
        this.hud.flashShieldDamage();
      }
    }

    if (remaining > 0) {
      this.playerHealth = Math.max(0, this.playerHealth - remaining);
      this.audio.playGunshot('transient');
      this.hud.flashHealthDamage();
    }

    this.hud.updateVitals(this.playerShield, this.maxShield, this.playerHealth, this.maxHealth);

    if (this.playerHealth <= 0) {
      this.playerHealth = 0;
      this.hud.updateVitals(0, this.maxShield, 0, this.maxHealth);
      this.hud.addFeedMessage(attackerName, 'YOU', 'ELIMINATED', false);

      if (this.currentMapKey === 'haven') {
        // Instant respawn in Halo Deathmatch
        setTimeout(() => {
          this.playerHealth = this.maxHealth;
          this.playerShield = this.maxShield;
          const sp = this.mapMeta.spawns ? this.mapMeta.spawns[0] : [6.32, -4.03, -69.67];
          this.character.spawn(sp[0], sp[1], sp[2], Math.PI);
          this.hud.updateVitals(this.playerShield, this.maxShield, this.playerHealth, this.maxHealth);
        }, 3000);
      }
    }
  }

  simulate(dt) {
    if (!this.character || !this.weapons) return;
    const now = performance.now();
    const isCS = (this.currentMapKey === 'cs_blackhawk');

    // 1. Halo Shield Regeneration (Only in Haven mode)
    if (!isCS && now - this.lastDamageTime > 4500 && this.playerShield < this.maxShield) {
      if (!this.shieldRecharging) {
        this.shieldRecharging = true;
        this.audio.playShieldRecharge();
      }
      this.playerShield = Math.min(this.maxShield, this.playerShield + dt * 42.0);
      this.hud.updateVitals(this.playerShield, this.maxShield, this.playerHealth, this.maxHealth);
    }

    // 2. Consume input & update Quake/Halo movement
    this.input.poll(dt);

    const look = this.input.look(dt);
    this.character.yaw -= look.yaw;
    this.character.pitch = THREE.MathUtils.clamp(
      this.character.pitch - look.pitch,
      -Math.PI / 2.05,
      Math.PI / 2.05
    );

    const moveAxis = this.input.moveAxis();
    const moveCmd = {
      moveX: moveAxis.x,
      moveZ: moveAxis.y,
      jump: this.input.down('Space'),
      jumpPressed: !!this.input.pressed.jump,
      crouch: this.input.down('KeyC') || this.input.down('ControlLeft'),
      sprint: this.input.down('ShiftLeft') || this.input.down('ShiftRight'),
      ads: this.input.buttons[2] || this.input.down('KeyZ'),
      yaw: this.character.yaw
    };
    this.character.update(dt, moveCmd);

    // 3. Wheel weapon cycling
    const wheel = this.input.consumeWheel();
    if (wheel !== 0) {
      const next = (this.weapons.current + wheel + ARENA_ARSENAL.length) % ARENA_ARSENAL.length;
      this.switchWeapon(next);
    }

    // 4. Weapons & Ballistics update
    const eye = this.character.eyePosition.clone();
    const weaponCmd = {
      fire: this.input.buttons[0] || false,
      firePressed: !!this.input.pressed.fire,
      aim: this.input.buttons[2] || this.input.down('KeyZ') || false,
      reloadPressed: !!this.input.pressed.reload,
      time: now / 1000
    };

    const targets = this.botManager ? this.botManager.bots : [];
    const events = this.weapons.update(
      dt,
      weaponCmd,
      this.character,
      targets,
      eye,
      this.character.yaw,
      this.character.pitch
    );

    // Handle Weapon Events
    for (const ev of events) {
      if (ev.type === 'fire') {
        const def = this.weapons.def;
        this.viewmodel.triggerFlash();

        if (def.isMelee) {
          this.audio.playMelee(def.model.includes('lament'));
        } else {
          this.audio.playGunshot(def.sound || 'ace', weaponCmd.aim);
        }

        // Spawn bullet tracers
        for (const trace of ev.traces) {
          this._spawnTracer(eye, trace.point, 0x38bdf8);
        }

        this.hud.updateWeapon(def, this.weapons.ammo, this.weapons.slot.reserve, this.weapons.current);
      } else if (ev.type === 'reloadStart') {
        this.audio.playReload();
      } else if (ev.type === 'reloadEnd') {
        this.hud.updateWeapon(this.weapons.def, this.weapons.ammo, this.weapons.slot.reserve, this.weapons.current);
      }
    }

    // 5. Update Viewmodel animations (sway, bob, kickback)
    const isSprinting = this.character.sprinting;
    this.viewmodel.update(
      dt,
      this.character.speed,
      this.character.grounded,
      isSprinting,
      this.weapons.ads,
      this.weapons.kickPos,
      this.weapons.kickRot,
      this.input.mouseDX,
      this.input.mouseDY
    );

    // 6. Update Bots AI & Heroine Mixer
    if (this.heroineMixer) {
      this.heroineMixer.update(dt);
    }

    if (this.botManager) {
      const playerAlive = this.playerHealth > 0;
      this.botManager.update(dt, this.character.pos, (amount, zone, name) => {
        this.applyPlayerDamage(amount, zone, name);
      }, playerAlive);
    }

    // 7. Counter-Strike Match Loop vs Halo KOTH
    if (isCS) {
      this._updateCSMatch(dt);
    } else {
      this._updateHaloKOTH(dt);
    }

    // Update HUD Reticle Spread
    this.hud.updateSpread(this.weapons.spread, weaponCmd.aim);
  }

  _updateCSMatch(dt) {
    const counts = this.botManager.getLivingCounts();
    const playerAlive = this.playerHealth > 0;
    const ctAlive = counts.ct + (playerAlive ? 1 : 0);
    const tAlive = counts.t;

    if (this.csMatch.state === 'FREEZE') {
      this.csMatch.freezeTimer -= dt;
      if (this.csMatch.freezeTimer <= 0) {
        this.csMatch.state = 'LIVE';
        this.csMatch.roundTimer = 105;
        this.audio.playVoice('confirm');
      }
    } else if (this.csMatch.state === 'LIVE') {
      this.csMatch.roundTimer -= dt;

      // Final 10 seconds ticking cues
      if (this.csMatch.roundTimer <= 10 && this.csMatch.roundTimer > 0) {
        if (Math.floor(this.csMatch.roundTimer) !== Math.floor(this.csMatch.roundTimer + dt)) {
          this.audio.playTimerBeep(this.csMatch.roundTimer <= 4);
        }
      }

      // Check Round Victory / Defeat Conditions
      if (tAlive === 0) {
        this.csMatch.state = 'ROUND_OVER';
        this.csMatch.ctScore++;
        this.csMatch.roundOverTimer = 4.2;
        this.audio.playRoundWin(true);
        this.hud.showRoundBanner('COUNTER-TERRORISTS WIN', 'All Terrorists Neutralized • CT Squad Victorious', true);
      } else if (ctAlive === 0) {
        this.csMatch.state = 'ROUND_OVER';
        this.csMatch.tScore++;
        this.csMatch.roundOverTimer = 4.2;
        this.audio.playRoundLoss();
        this.hud.showRoundBanner('TERRORISTS WIN', 'Counter-Terrorists Eliminated', false);
      } else if (this.csMatch.roundTimer <= 0) {
        this.csMatch.state = 'ROUND_OVER';
        this.csMatch.ctScore++;
        this.csMatch.roundOverTimer = 4.2;
        this.audio.playRoundWin(true);
        this.hud.showRoundBanner('COUNTER-TERRORISTS WIN', 'Blackhawk Down Defended • Time Expired', true);
      }
    } else if (this.csMatch.state === 'ROUND_OVER') {
      this.csMatch.roundOverTimer -= dt;
      if (this.csMatch.roundOverTimer <= 0) {
        this.hud.hideRoundBanner();

        // Check Match Winner (First to 7 rounds)
        if (this.csMatch.ctScore >= 7 || this.csMatch.tScore >= 7 || this.csMatch.round >= this.csMatch.maxRounds) {
          const ctWon = this.csMatch.ctScore > this.csMatch.tScore;
          this.hud.showRoundBanner(ctWon ? 'MATCH VICTORY' : 'MATCH DEFEAT', `Final Score: CT ${this.csMatch.ctScore} - ${this.csMatch.tScore} T`, ctWon);
          this.csMatch.round = 1;
          this.csMatch.ctScore = 0;
          this.csMatch.tScore = 0;
        } else {
          this.csMatch.round++;
        }

        // Reset for next round
        this.csMatch.state = 'FREEZE';
        this.csMatch.freezeTimer = 4.0;
        this.csMatch.roundTimer = 105;

        // Respawn Player at CT Base
        this.playerHealth = this.maxHealth;
        this.playerShield = this.maxShield;
        const sp = this.mapMeta.ctSpawns ? this.mapMeta.ctSpawns[0] : [0, -2, 40];
        this.character.spawn(sp[0], sp[1], sp[2], 0);

        // Respawn all bots
        this.botManager.resetRound();
        this.weapons.ammo = this.weapons.def.magSize;
        this.audio.playRoundStart();
        this.hud.updateVitals(this.playerShield, this.maxShield, this.playerHealth, this.maxHealth);
      }
    }

    this.hud.updateCSMatch(this.csMatch, ctAlive, tAlive, 5, 5);
  }

  _updateHaloKOTH(dt) {
    const distToKoth = this.character.pos.distanceTo(this.kothCenter);
    const inKoth = (distToKoth <= this.kothRadius);
    if (inKoth) {
      this.playerScore = Math.min(100, this.playerScore + dt * 2.0);
    }
    const kothText = inKoth ? 'HILL CONTROLLED' : 'HILL ACTIVE';
    this.hud.updateKoth(kothText, Math.floor(this.playerScore), Math.floor(this.botScore));
  }

  _spawnTracer(start, end, color = 0x38bdf8) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  render(alpha) {
    if (!this.character) return;

    const eye = this.character.eyePosition;

    // Dual-Spring Recoil: Camera pitch & yaw kick
    this.currentCamRecoilPitch += (this.weapons.camPitch - this.currentCamRecoilPitch) * 0.45;
    this.currentCamRecoilYaw += (this.weapons.camYaw - this.currentCamRecoilYaw) * 0.45;

    const totalPitch = this.character.pitch + THREE.MathUtils.degToRad(this.currentCamRecoilPitch);
    const totalYaw = this.character.yaw + THREE.MathUtils.degToRad(this.currentCamRecoilYaw);

    this.cameraPivot.position.copy(eye);
    this.cameraPivot.rotation.set(0, totalYaw, 0, 'YXZ');
    this.camera.rotation.set(totalPitch, 0, 0);

    // ADS FOV Zoom Transition
    const baseFov = 85.0;
    const adsTargetFov = baseFov * (this.weapons.def.adsFov || 0.55);
    const targetFov = THREE.MathUtils.lerp(baseFov, adsTargetFov, this.weapons.ads);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    // -------------------------------------------------------------
    // Third-Person Over-The-Shoulder (OTS) Camera & Heroine Alignment
    // -------------------------------------------------------------
    if (this.perspective === 'OTS') {
      this.heroineGroup.visible = true;
      this.viewmodel.root.visible = false;

      // Pure Local OTS Offset inside cameraPivot:
      // Local +X = Right Shoulder (0.55m)
      // Local +Y = Eye Level (+0.18m)
      // Local +Z = Behind Player (+2.05m, pulls into +1.25m when ADS)
      const adsLerp = this.weapons ? this.weapons.ads : 0;
      const targetX = THREE.MathUtils.lerp(0.55, 0.38, adsLerp);
      const targetY = THREE.MathUtils.lerp(0.18, 0.12, adsLerp);
      const targetZ = THREE.MathUtils.lerp(2.05, 1.25, adsLerp);

      this.camera.position.set(targetX, targetY, targetZ);

      // Heroine Model stands cleanly on player position, oriented with Yaw
      this.heroineGroup.position.copy(this.character.pos);
      this.heroineGroup.rotation.y = totalYaw;

      // Aim third-person weapon socket up and down with pitch
      if (this.heroineWeaponSocket) {
        this.heroineWeaponSocket.rotation.x = totalPitch;
      }
    } else {
      this.heroineGroup.visible = false;
      this.viewmodel.root.visible = true;
      this.camera.position.set(0, 0, 0);
    }

    // Destiny Ghost companion hovering
    if (this.ghostGroup && this.character) {
      const t = performance.now() * 0.001;
      const hoverY = Math.sin(t * 2.2) * 0.035;
      const fwd = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(totalPitch, totalYaw, 0, 'YXZ'));
      const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, totalYaw, 0, 'YXZ'));

      if (this.perspective === 'OTS') {
        const targetPos = eye.clone()
          .addScaledVector(right, -0.65)
          .addScaledVector(fwd, -0.2)
          .add(new THREE.Vector3(0, 0.45 + hoverY, 0));
        this.ghostGroup.position.lerp(targetPos, 0.1);
        this.ghostGroup.rotation.y = totalYaw + Math.sin(t * 1.5) * 0.15;
        this.ghostGroup.visible = true;
      } else {
        const targetPos = eye.clone()
          .addScaledVector(right, -0.42)
          .addScaledVector(fwd, 0.7)
          .add(new THREE.Vector3(0, -0.22 + hoverY, 0));
        this.ghostGroup.position.lerp(targetPos, 0.12);
        this.ghostGroup.rotation.y = totalYaw + Math.PI + Math.sin(t * 1.5) * 0.15;
        this.ghostGroup.visible = (this.weapons.ads < 0.25);
      }
    }

    // Update active tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= 0.016;
      tr.line.material.opacity = tr.life / 0.08;
      if (tr.life <= 0) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        tr.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Boot game reliably across all load states
function bootGame() {
  if (window.game) return;
  window.game = new GameApp();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootGame);
} else {
  bootGame();
}
       