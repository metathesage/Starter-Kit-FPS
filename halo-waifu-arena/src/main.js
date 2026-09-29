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
import { WeaponPickupManager } from './player/pickups.js';

export const ARENA_MAPS = {
  cs_blackhawk: {
    key: 'cs_blackhawk',
    name: 'CS BLACKHAWK',
    title: 'COUNTER-STRIKE 5v5',
    sub: 'Black Hawk Down • Defend & Eliminate',
    teamName: 'CT WAIFU SQUAD',
    teamSub: 'KEVLAR & HELMET // 100',
    mode: 'counter_strike',
    dir: './assets/map_cs/',
    glb: 'cs_blackhawk_down.glb',
    pos: [-12.94, 0, -4.90],
    rot: [0, 0, 0],
    scale: [1.0, 1.0, 1.0],
    color: '#fbbf24',
    desc: 'Counter-Terrorist squad elimination match on open desert fortress.',
    lighting: {
      bg: 0x93c5fd,
      fog: 0xdbeafe,
      fogDensity: 0.0035,
      ambient: 0xfef08a,
      ambientIntensity: 0.65,
      hemiSky: 0x93c5fd,
      hemiGround: 0xd97706,
      hemiIntensity: 0.45,
      sunColor: 0xfffbeb,
      sunIntensity: 1.6,
      sunPos: [-60, 110, -50],
      space: false
    }
  },
  haven: {
    key: 'haven',
    name: 'HALO HAVEN',
    title: 'HAVEN ARENA',
    sub: 'Orbital Complex • King of the Hill',
    teamName: 'SPARTAN WAIFU',
    teamSub: 'SHIELDS // NOMINAL',
    mode: 'halo',
    dir: './assets/map/',
    glb: 'haven.glb',
    pos: [0, 0, 43.995], // CRITICAL: Centers and aligns visual mesh with collision BVH exactly!
    rot: [-Math.PI / 2, 0, 0],
    scale: [0.1, 0.1, 0.1],
    color: '#00f3ff',
    desc: 'Halo sci-fi arena King of the Hill and Slayer combat in cosmic orbital platform.',
    lighting: {
      bg: 0x070d1e,
      fog: 0x0c1730,
      fogDensity: 0.0018,
      ambient: 0x60a5fa,
      ambientIntensity: 0.85,
      hemiSky: 0x38bdf8,
      hemiGround: 0x1e293b,
      hemiIntensity: 0.65,
      sunColor: 0xffffff,
      sunIntensity: 2.0,
      sunPos: [-35, 95, -55],
      space: true
    }
  },
  lockout: {
    key: 'lockout',
    name: 'HALO LOCKOUT',
    title: 'LOCKOUT ARENA',
    sub: 'Snowy Peak Platform • Slayer & King of the Hill',
    teamName: 'SPARTAN WAIFU',
    teamSub: 'SHIELDS // NOMINAL',
    mode: 'halo',
    dir: './assets/map_lockout/',
    glb: 'lockout.glb',
    pos: [1.129, 0, -4.843],
    rot: [0, 0, 0],
    scale: [0.22, 0.22, 0.22],
    color: '#38bdf8',
    desc: 'Multi-tiered snowy mountain facility with intense close-quarters combat.',
    lighting: {
      bg: 0x0a1128,
      fog: 0x101b38,
      fogDensity: 0.006,
      ambient: 0x93c5fd,
      ambientIntensity: 0.6,
      hemiSky: 0x38bdf8,
      hemiGround: 0x1e293b,
      hemiIntensity: 0.5,
      sunColor: 0xe0f2fe,
      sunIntensity: 1.6,
      sunPos: [-40, 80, -30],
      space: true
    }
  },
  rust: {
    key: 'rust',
    name: 'COD RUST',
    title: 'RUST OIL RIG',
    sub: 'Industrial Desert • Fast Paced TDM',
    teamName: 'TASK FORCE 141',
    teamSub: 'BODY ARMOR // 100',
    mode: 'halo',
    dir: './assets/map_rust/',
    glb: 'rust.glb',
    pos: [-18.51, 0, 28.273],
    rot: [0, 0, 0],
    scale: [0.25, 0.25, 0.25],
    color: '#f59e0b',
    desc: 'Compact desert oil yard featuring vertical tower battles and fast-paced shootouts.',
    lighting: {
      bg: 0x78350f,
      fog: 0x92400e,
      fogDensity: 0.007,
      ambient: 0xfef08a,
      ambientIntensity: 0.7,
      hemiSky: 0xfbbf24,
      hemiGround: 0x451a03,
      hemiIntensity: 0.5,
      sunColor: 0xfffbeb,
      sunIntensity: 1.8,
      sunPos: [-50, 90, -40],
      space: false
    }
  }
};

class GameApp {
  constructor() {
    window.game = this;
    this.container = document.getElementById('canvas-container');
    this.audio = new AudioEngine();
    this.hud = new HUD();

    // Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    this.camera = new THREE.PerspectiveCamera(85, window.innerWidth / window.innerHeight, 0.08, 1200);
    this.cameraPivot = new THREE.Group();
    this.scene.add(this.cameraPivot);
    this.cameraPivot.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
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
    this.pickups = null;
    this.mapMeta = null;
    this.mapMesh = null;

    // Game Mode State: 'tdm' (Team Deathmatch), 'ffa' (Free For All), 'elimination' (CS Classic)
    this.gameMode = 'tdm';
    this.tdmMatch = {
      ctScore: 0,
      tScore: 0,
      targetScore: 30,
      timer: 600,
      state: 'LIVE'
    };

    // In-depth Settings State
    this.userBaseFov = 85.0;
    this.adsZoomScale = 1.0;
    this.isPaused = false;

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
      this.character.team = 'CT';
      this.weapons = new WeaponSystem(null, ARENA_ARSENAL);
      this.weapons.owner = this.character;

      // 3D Tactical Weapon Pickups System (Halo / CoD Standard)
      this.pickups = new WeaponPickupManager(this.scene, this.hud, this.audio);

      this.viewmodel = new Viewmodel(this.camera, this.scene);
      ARENA_ARSENAL.forEach((key) => {
        this.viewmodel.loadWeapon(key, WEAPONS[key]);
      });
      this.viewmodel.equip('ak47', WEAPONS.ak47);

      // 2. Load Selected Map (defaults to CS Blackhawk Down)
      await this.loadMap(this.currentMapKey);
      this.pickups.init(this.currentMapKey);

      // Expose globally for interactive HTML buttons
      window.game = this;

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
    const mapCfg = ARENA_MAPS[mapKey] || ARENA_MAPS.haven;
    this.currentMapKey = mapCfg.key;
    const isCS = (mapCfg.mode === 'counter_strike');

    const mapTxt = document.getElementById('map-txt');
    if (mapTxt) {
      mapTxt.innerText = `MAP // ${mapCfg.name}`;
      mapTxt.style.color = mapCfg.color;
    }

    const teamTitle = document.getElementById('vitals-team-name');
    if (teamTitle) {
      teamTitle.innerText = mapCfg.teamName;
    }
    const teamSub = document.getElementById('vitals-sub-status');
    if (teamSub) {
      teamSub.innerText = mapCfg.teamSub;
    }

    // 1. Remove previous map mesh
    if (this.mapMesh) {
      this.scene.remove(this.mapMesh);
      this.mapMesh = null;
    }

    // 2. Fetch Map Metadata & Collision BVH
    const dir = mapCfg.dir;
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
    const l = mapCfg.lighting;
    this.scene.background = new THREE.Color(l.bg);
    this.scene.fog = new THREE.FogExp2(l.fog, l.fogDensity);
    if (this.ambientLight) {
      this.ambientLight.color.setHex(l.ambient);
      this.ambientLight.intensity = l.ambientIntensity;
    }
    if (this.hemiLight) {
      this.hemiLight.color.setHex(l.hemiSky);
      this.hemiLight.groundColor.setHex(l.hemiGround);
      this.hemiLight.intensity = l.hemiIntensity;
    }
    if (this.sun) {
      this.sun.color.setHex(l.sunColor);
      this.sun.intensity = l.sunIntensity;
      this.sun.position.set(l.sunPos[0], l.sunPos[1], l.sunPos[2]);
    }
    if (this.stars) this.stars.visible = !!l.space;
    if (this.planet) this.planet.visible = !!l.space;
    if (this.aura) this.aura.visible = !!l.space;
    if (this.kothRingMesh) this.kothRingMesh.visible = !isCS;

    // Reposition KOTH Ring for the current map
    if (this.mapMeta.koth) {
      this.kothCenter.set(this.mapMeta.koth.x, this.mapMeta.koth.y, this.mapMeta.koth.z);
      this.kothRadius = this.mapMeta.koth.radius || 5.5;
      if (this.kothRingMesh) {
        this.kothRingMesh.position.copy(this.kothCenter);
        this.kothRingMesh.position.y += 0.08;
      }
    }

    // 4. Load Visual 3D GLTF Mesh
    const gltfFile = `${dir}${mapCfg.glb}`;
    await new Promise((resolve) => {
      new GLTFLoader().load(
        gltfFile,
        (gltf) => {
          if (this.currentMapKey !== mapKey) return resolve();
          const map = gltf.scene;
          this.mapMesh = map;

          map.position.set(mapCfg.pos[0], mapCfg.pos[1], mapCfg.pos[2]);
          map.rotation.set(mapCfg.rot[0], mapCfg.rot[1], mapCfg.rot[2]);
          map.scale.set(mapCfg.scale[0], mapCfg.scale[1], mapCfg.scale[2]);

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
          resolve(map);
        },
        undefined,
        (err) => {
          console.warn('[MAP LOAD WARNING]', err);
          resolve();
        }
      );
    });

    // 5. Spawn Player at authentic Base
    let spawnPt = [0, 2, 0];
    if (isCS) {
      spawnPt = (this.mapMeta.ctSpawns && this.mapMeta.ctSpawns.length > 1)
        ? this.mapMeta.ctSpawns[1]
        : (this.mapMeta.ctSpawns ? this.mapMeta.ctSpawns[0] : [-13.48, -2.26, 39.94]);
    } else {
      spawnPt = (this.mapMeta.spawns && this.mapMeta.spawns.length > 0)
        ? this.mapMeta.spawns[0]
        : [0, 2, 0];
    }

    const initYaw = isCS ? 0 : Math.atan2(-spawnPt[0], -spawnPt[2]);
    this.character.spawn(spawnPt[0], spawnPt[1], spawnPt[2], initYaw);

    // 6. Initialize Bot Sparring / CS Squads
    if (this.botManager) {
      this.botManager.dispose();
    }
    this.botManager = new BotManager(this.scene, this.collision, this.mapMeta);
    this.botManager.init(mapCfg.mode);

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

    this.botManager.onBotFireCallback = (ev) => {
      if (this.audio) {
        this.audio.playPositionalGunshot(ev.weaponKey || 'outbreak', ev.bot.pos, this.cameraPivot.position);
      }
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
      this.hud.showRoundBanner(mapCfg.title, mapCfg.sub, true);
      setTimeout(() => this.hud.hideRoundBanner(), 2500);
      this.hud.addFeedMessage('SYSTEM', 'MATCH LIVE', 'CS 5v5 ELIMINATION', true);
    } else {
      this.playerScore = 0;
      this.botScore = 0;
      this.hud.addFeedMessage('SYSTEM', mapCfg.title, 'KOTH CONTROL', true);
    }

    // 8. Re-initialize map weapon pickups
    if (this.pickups) {
      this.pickups.init(mapKey);
    }

    // 9. Update splash screen map button state
    ['cs_blackhawk', 'haven', 'lockout', 'rust'].forEach(k => {
      const btn = document.getElementById(`splash-mode-${k === 'cs_blackhawk' ? 'cs' : k}`);
      if (btn) btn.classList.toggle('active', k === this.currentMapKey);
    });
    const modeDesc = document.getElementById('splash-mode-desc');
    if (modeDesc) {
      modeDesc.innerText = mapCfg.desc;
    }

    this.hud.updateVitals(this.playerShield, this.maxShield, this.playerHealth, this.maxHealth);
  }

  toggleMap() {
    const keys = Object.keys(ARENA_MAPS);
    const idx = keys.indexOf(this.currentMapKey);
    const nextKey = keys[(idx + 1) % keys.length];
    this.loadMap(nextKey);
  }

  setMap(mapKey) {
    if (this.currentMapKey === mapKey) return;
    this.loadMap(mapKey);
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
    // Calibrated scales & orientations: Standardizes every heroine to 1.70m human height - ANIMATED ONLY
    const configs = {
      mai: { file: 'mai_maid_combat_ready.glb', scale: 0.50, rotY: 0, pos: [0, 0, 0], anim: 'Standby' },
      maid: { file: 'mai_maid_combat_ready.glb', scale: 0.50, rotY: 0, pos: [0, 0, 0], anim: 'Standby' },
      miyazawa: { file: 'main_heroine_miyazawa_combat_ready.glb', scale: 1.95, rotY: Math.PI, pos: [0, 0, 0], anim: 'ani_idle_basic_new' }
    };

    // Update op-dock active tab
    const tabs = document.querySelectorAll('.op-tab');
    const heroines = ['mai', 'maid', 'miyazawa'];
    tabs.forEach((tab, idx) => {
      tab.classList.toggle('active', heroines[idx] === key);
    });

    // Update splash screen operator buttons & description
    heroines.forEach((hKey) => {
      const btn = document.getElementById(`splash-op-${hKey}`);
      if (btn) btn.classList.toggle('active', hKey === key);
    });
    const opDesc = document.getElementById('splash-op-desc');
    if (opDesc) {
      const descs = {
        mai: 'Combat Maid // Dual-wielding submachine & assault specialist. 13 verified skeletal animations.',
        maid: 'Tactical Striker // Armored combat maid with close-quarters shotgun & rifle mastery. 13 animations.',
        miyazawa: 'SpecOps Assassin // Elite precision marksman with agile strafing rig. 11 animations.'
      };
      opDesc.innerText = descs[key] || descs.mai;
    }

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

      // CRITICAL: Prevent Three.js frustum culling on all character meshes across large maps
      model.traverse((c) => {
        if (c.isMesh) {
          c.frustumCulled = false;
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });

      // Find right hand bone and spine bone (prioritize dedicated weapon socket)
      this.heroineHandBone = model.getObjectByName('Weapon_Socket_R') ||
                             model.getObjectByName('WeaponSocket_R') ||
                             model.getObjectByName('weapon_socket_r') ||
                             model.getObjectByName('Skl_hand_R_056') ||
                             model.getObjectByName('Bip001 R Hand_074') ||
                             model.getObjectByName('Bip001_R_Hand_074');
      this.heroineSpineBone = model.getObjectByName('Skl_spine2_019') ||
                              model.getObjectByName('Skl_spine3_020') ||
                              model.getObjectByName('Bip001 Spine2') ||
                              model.getObjectByName('Bip001_Spine2');
      if (!this.heroineHandBone || !this.heroineSpineBone) {
        model.traverse((child) => {
          const lower = child.name ? child.name.toLowerCase() : '';
          if (!this.heroineHandBone && (lower.includes('weapon_socket') || lower.includes('r_hand') || lower.includes('r hand') || lower.includes('hand_r'))) {
            this.heroineHandBone = child;
          }
          if (!this.heroineSpineBone && lower.includes('spine')) {
            this.heroineSpineBone = child;
          }
        });
      }

      // Remove previous character meshes (preserving weapon socket)
      for (let i = this.heroineGroup.children.length - 1; i >= 0; i--) {
        const child = this.heroineGroup.children[i];
        if (child !== this.heroineWeaponSocket) {
          this.heroineGroup.remove(child);
        }
      }

      this.heroineGroup.add(model);
      this.heroineGroup.visible = (this.perspective === 'OTS');

      // Parent weapon socket to hand bone with inverse scale to maintain natural weapon proportion
      if (this.heroineHandBone) {
        this.heroineHandBone.add(this.heroineWeaponSocket);
        const inv = 1.0 / (conf.scale || 1.0);
        this.heroineWeaponSocket.scale.set(inv, inv, inv);
        this.heroineWeaponSocket.position.set(0, 0, 0);
        this.heroineWeaponSocket.rotation.set(0, 0, 0);
      } else {
        this.heroineGroup.add(this.heroineWeaponSocket);
        this.heroineWeaponSocket.scale.set(1, 1, 1);
        this.heroineWeaponSocket.position.set(0.20, 1.15, -0.25);
        this.heroineWeaponSocket.rotation.set(0, 0, 0);
      }

      if (gltf.animations && gltf.animations.length > 0) {
        this.heroineMixer = new THREE.AnimationMixer(model);
        const clips = gltf.animations;
        const idleClip = clips.find(c => ['Standby', 'ani_idle_basic_new', 'idle', 'char_mint_stand_show_1'].some(n => c.name.toLowerCase().includes(n.toLowerCase()))) || clips[0];
        const stepClip = clips.find(c => ['step', 'walk', 'run', 'ani_lobby_landing'].some(n => c.name.toLowerCase().includes(n.toLowerCase()))) || null;

        this.heroineActions = {
          idle: idleClip ? this.heroineMixer.clipAction(idleClip) : null,
          step: stepClip ? this.heroineMixer.clipAction(stepClip) : null
        };

        if (this.heroineActions.idle) {
          this.heroineActions.idle.play();
        }
        if (this.heroineActions.step) {
          this.heroineActions.step.timeScale = 1.0;
        }
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

    // Calibrated weapon transforms in hand bone socket space (forward: -Z, up: +Y)
    const thirdPersonConfigs = {
      ak47: { scale: 0.95, rot: [0, Math.PI / 2, 0], pos: [0, -0.04, -0.10] },
      m4a1: { scale: 0.38, rot: [0, 0, 0], pos: [0, -0.04, -0.10] },
      mac10: { scale: 0.95, rot: [0, Math.PI / 2, 0], pos: [0, -0.03, -0.08] },
      ace: { scale: 0.65, rot: [0, Math.PI / 2, 0], pos: [0, -0.03, -0.06] },
      hawkmoon: { scale: 0.65, rot: [0, 0, 0], pos: [0, -0.03, -0.06] },
      outbreak: { scale: 0.38, rot: [0, Math.PI / 2, 0], pos: [0, -0.04, -0.10] },
      chaperone: { scale: 0.60, rot: [0, 0, 0], pos: [0, -0.04, -0.10] },
      smg: { scale: 0.70, rot: [0, Math.PI / 2, 0], pos: [0, -0.03, -0.08] },
      shotgun: { scale: 0.65, rot: [0, Math.PI / 2, 0], pos: [0, -0.04, -0.10] },
      launcher: { scale: 0.60, rot: [0, 0, 0], pos: [0, 0.0, 0.0] },
      sword: { scale: 0.65, rot: [-Math.PI / 2.2, 0.25, -0.2], pos: [0, 0, 0] },
      lament: { scale: 0.65, rot: [0, 0, 0], pos: [0, 0, 0] }
    };

    const tpc = thirdPersonConfigs[weaponKey] || {
      scale: 0.85,
      rot: def.rot || [0, Math.PI / 2, 0],
      pos: [0, -0.02, -0.05]
    };

    new GLTFLoader().load(path, (gltf) => {
      const weaponModel = gltf.scene;
      weaponModel.scale.set(tpc.scale, tpc.scale, tpc.scale);
      if (tpc.rot) {
        weaponModel.rotation.set(tpc.rot[0], tpc.rot[1], tpc.rot[2]);
      }
      if (tpc.pos) {
        weaponModel.position.set(tpc.pos[0], tpc.pos[1], tpc.pos[2]);
      }
      weaponModel.traverse((c) => {
        if (c.isMesh) {
          c.frustumCulled = false;
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

    // Deploy / Splash screen engage
    const splashDeployBtn = document.getElementById('splash-deploy-btn');
    if (splashDeployBtn) {
      splashDeployBtn.addEventListener('click', () => this.startMatchFromSplash());
    }

    // Pointer Lock change listener: detect Escape or browser unlock
    document.addEventListener('pointerlockchange', () => {
      const isLocked = (document.pointerLockElement === this.renderer.domElement);
      const splash = document.getElementById('splash-screen');
      const splashVisible = splash && (splash.style.display !== 'none');
      if (!isLocked && !splashVisible && !this.isPaused) {
        this.togglePause(true);
      }
    });

    // FOV Slider
    const fovSlider = document.getElementById('cfg-fov');
    const fovBadge = document.getElementById('val-fov');
    if (fovSlider && fovBadge) {
      fovSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.userBaseFov = val;
        fovBadge.innerText = `${Math.round(val)}°`;
        this.camera.fov = val;
        this.camera.updateProjectionMatrix();
      });
    }

    // ADS Zoom Scale Slider
    const adsZoomSlider = document.getElementById('cfg-ads-zoom');
    const adsZoomBadge = document.getElementById('val-ads-zoom');
    if (adsZoomSlider && adsZoomBadge) {
      adsZoomSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.adsZoomScale = val;
        adsZoomBadge.innerText = `${val.toFixed(2)}x`;
      });
    }

    // Mouse Sensitivity Slider
    const mouseSensSlider = document.getElementById('cfg-mouse-sens');
    const mouseSensBadge = document.getElementById('val-mouse-sens');
    if (mouseSensSlider && mouseSensBadge) {
      mouseSensSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.input.sensitivity = val;
        mouseSensBadge.innerText = (val * 1000).toFixed(1);
      });
    }

    // Controller Sensitivity Slider
    const padSensSlider = document.getElementById('cfg-pad-sens');
    const padSensBadge = document.getElementById('val-pad-sens');
    if (padSensSlider && padSensBadge) {
      padSensSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.input.padSensitivity = val;
        padSensBadge.innerText = val.toFixed(1);
      });
    }

    // ADS Sensitivity Multiplier Slider
    const adsSensSlider = document.getElementById('cfg-ads-sens');
    const adsSensBadge = document.getElementById('val-ads-sens');
    if (adsSensSlider && adsSensBadge) {
      adsSensSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.input.adsSensitivityMultiplier = val;
        adsSensBadge.innerText = `${val.toFixed(2)}x`;
      });
    }

    // Stick Deadzone Slider
    const deadzoneSlider = document.getElementById('cfg-deadzone');
    const deadzoneBadge = document.getElementById('val-deadzone');
    if (deadzoneSlider && deadzoneBadge) {
      deadzoneSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.input.stickDeadzone = val;
        deadzoneBadge.innerText = val.toFixed(2);
      });
    }

    // Audio Sliders
    const volMaster = document.getElementById('cfg-vol-master');
    const valVolMaster = document.getElementById('val-vol-master');
    if (volMaster && valVolMaster) {
      volMaster.addEventListener('input', (e) => { valVolMaster.innerText = `${e.target.value}%`; });
    }

    const volSfx = document.getElementById('cfg-vol-sfx');
    const valVolSfx = document.getElementById('val-vol-sfx');
    if (volSfx && valVolSfx) {
      volSfx.addEventListener('input', (e) => { valVolSfx.innerText = `${e.target.value}%`; });
    }

    const volHit = document.getElementById('cfg-vol-hit');
    const valVolHit = document.getElementById('val-vol-hit');
    if (volHit && valVolHit) {
      volHit.addEventListener('input', (e) => { valVolHit.innerText = `${e.target.value}%`; });
    }

    window.addEventListener('keydown', (e) => {
      if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
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
        const heroines = ['mai', 'maid', 'miyazawa'];
        const nextIdx = (heroines.indexOf(this.currentHeroineKey) + 1) % heroines.length;
        this._loadHeroine(heroines[nextIdx]);
        if (this.hud) {
          const names = { mai: 'MAI MAID', maid: 'MAID BATTLE', miyazawa: 'MIYAZAWA' };
          this.hud.addFeedMessage('HEROINE', names[heroines[nextIdx]], 'EQUIPPED', true);
        }
      }
      if (e.code === 'KeyI') {
        this.toggleInvertY();
      }
      if (e.code === 'Escape') {
        this.togglePause();
      }
    });

    // Weapon Pips Click
    const pips = document.querySelectorAll('.w-pip');
    pips.forEach((pip, idx) => {
      pip.addEventListener('click', () => this.switchWeapon(idx));
    });
  }

  startMatchFromSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => { splash.style.display = 'none'; }, 300);
    }
    this.isPaused = false;
    this.input.requestLock();
    this.audio.init();
    this.audio.resume();
  }

  togglePause(forceState) {
    if (forceState !== undefined) {
      this.isPaused = forceState;
    } else {
      this.isPaused = !this.isPaused;
    }

    const modal = document.getElementById('pause-modal');
    if (modal) {
      modal.style.display = this.isPaused ? 'flex' : 'none';
    }

    if (this.isPaused) {
      this.input.exitLock();
    } else {
      this.input.requestLock();
      this.audio.resume();
    }
  }

  showSettingsTab(tabName) {
    const tabs = ['controller', 'display', 'audio'];
    tabs.forEach((t) => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const content = document.getElementById(`tab-content-${t}`);
      if (btn) btn.classList.toggle('active', t === tabName);
      if (content) content.style.display = (t === tabName) ? 'block' : 'none';
    });
  }

  setPerspective(persp) {
    this.perspective = persp;
    this.heroineGroup.visible = (this.perspective === 'OTS');
    this.viewmodel.root.visible = (this.perspective === 'FPS');

    const viewTxt = document.getElementById('view-txt');
    if (viewTxt) viewTxt.innerText = `CAM // ${this.perspective}`;

    const fpsBtn = document.getElementById('splash-cam-fps');
    const otsBtn = document.getElementById('splash-cam-ots');
    if (fpsBtn) fpsBtn.classList.toggle('active', persp === 'FPS');
    if (otsBtn) otsBtn.classList.toggle('active', persp === 'OTS');

    const cfgFps = document.getElementById('cfg-cam-fps');
    const cfgOts = document.getElementById('cfg-cam-ots');
    if (cfgFps) cfgFps.classList.toggle('active', persp === 'FPS');
    if (cfgOts) cfgOts.classList.toggle('active', persp === 'OTS');
  }

  setAdsMode(mode) {
    this.input.adsMode = mode;
    const holdBtn = document.getElementById('cfg-ads-mode-hold');
    const toggleBtn = document.getElementById('cfg-ads-mode-toggle');
    if (holdBtn) holdBtn.classList.toggle('active', mode === 'hold');
    if (toggleBtn) toggleBtn.classList.toggle('active', mode === 'toggle');
    if (this.hud) {
      this.hud.addFeedMessage('SETTINGS', `ADS MODE: ${mode.toUpperCase()}`, 'CONFIG', true);
    }
  }

  restartMatch() {
    this.loadMap(this.currentMapKey);
    this.togglePause(false);
    if (this.hud) {
      this.hud.addFeedMessage('MATCH', 'MATCH RESTARTED', 'RESET', true);
    }
  }

  toggleInvertY() {
    const inv = this.input.toggleInvertY();
    if (this.hud) {
      this.hud.addFeedMessage('CONTROLS', inv ? 'INVERT Y: ON' : 'INVERT Y: OFF', inv ? 'TACTICAL' : 'STANDARD', true);
    }
    const invTxt = document.getElementById('invert-txt');
    if (invTxt) invTxt.innerText = `INVERT // ${inv ? 'ON' : 'OFF'}`;
    const cfgBtn = document.getElementById('cfg-invert-btn');
    if (cfgBtn) {
      cfgBtn.innerText = inv ? 'ON' : 'OFF';
      cfgBtn.classList.toggle('active', inv);
    }
  }

  _testBotRay(origin, dir, bot, maxDist) {
    if (!bot || !bot.alive) return null;
    const base = bot.pos.y;
    const hitboxes = [
      { y: base + 1.58, r: 0.22, h: 0.30, zone: 'head' },
      { y: base + 0.95, r: 0.35, h: 0.75, zone: 'torso' },
      { y: base + 0.30, r: 0.30, h: 0.65, zone: 'legs' }
    ];
    let bestT = maxDist;
    let hitZone = null;
    for (const hb of hitboxes) {
      const y0 = hb.y - hb.h * 0.5;
      const y1 = hb.y + hb.h * 0.5;
      const ox = origin.x - bot.pos.x, oz = origin.z - bot.pos.z;
      const a = dir.x * dir.x + dir.z * dir.z;
      const b = 2 * (ox * dir.x + oz * dir.z);
      const c = ox * ox + oz * oz - hb.r * hb.r;
      if (a > 1e-12) {
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
          const sq = Math.sqrt(disc);
          for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
            if (t > 0.05 && t < bestT) {
              const y = origin.y + dir.y * t;
              if (y >= y0 && y <= y1) {
                bestT = t;
                hitZone = hb.zone;
              }
            }
          }
        }
      }
    }
    if (bestT < maxDist) {
      return { t: bestT, point: origin.clone().addScaledVector(dir, bestT), zone: hitZone };
    }
    return null;
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
          const sp = this.mapMeta.spawns ? this.mapMeta.spawns[0] : [0, -7.28, -40];
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

    if (this.input.pressed.pause) {
      this.togglePause();
    }
    if (this.isPaused) return;

    const isAiming = this.input.isAiming();
    const isFiring = this.input.isFiring();

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
      jump: this.input.down('Space') || !!(this.input.pad?.connected && this.input.pad.a),
      jumpPressed: !!this.input.pressed.jump,
      crouch: this.input.down('KeyC') || this.input.down('ControlLeft') || !!(this.input.pad?.connected && this.input.pad.b),
      sprint: this.input.down('ShiftLeft') || this.input.down('ShiftRight') || !!(this.input.pad?.connected && this.input.pad.leftStickClick),
      ads: isAiming,
      yaw: this.character.yaw
    };
    this.character.update(dt, moveCmd);

    // 3. Wheel weapon cycling & Gamepad bumper cycling
    const wheel = this.input.consumeWheel();
    if (wheel !== 0) {
      const next = (this.weapons.current + wheel + ARENA_ARSENAL.length) % ARENA_ARSENAL.length;
      this.switchWeapon(next);
    }
    if (this.input.pressed.nextWeapon) {
      this.switchWeapon((this.weapons.current + 1) % ARENA_ARSENAL.length);
    }
    if (this.input.pressed.prevWeapon) {
      this.switchWeapon((this.weapons.current - 1 + ARENA_ARSENAL.length) % ARENA_ARSENAL.length);
    }

    // 4. Weapons & Ballistics update (Screen-Space Crosshair Raycast - CoD/Halo Standard)
    const eye = this.character.eyePosition.clone();
    const weaponCmd = {
      fire: isFiring,
      firePressed: !!this.input.pressed.fire,
      aim: isAiming,
      reloadPressed: !!this.input.pressed.reload,
      time: now / 1000
    };

    // Calculate exact 3D point in world under center crosshairs
    const camPos = new THREE.Vector3();
    this.camera.getWorldPosition(camPos);
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);

    const maxRange = this.weapons.def.range || 250;
    const hit = this.collision ? this.collision.raycast(camPos, camDir, maxRange, 0) : null;
    let targetPoint = hit ? hit.point.clone() : camPos.clone().addScaledVector(camDir, maxRange);
    let hitDist = hit ? hit.distance : maxRange;

    // Check if any hostile bot is under the crosshairs
    const targets = this.botManager ? this.botManager.bots : [];
    for (const bot of targets) {
      if (!bot.alive) continue;
      if (isCS && bot.team === 'CT') continue;
      const bHit = this._testBotRay(camPos, camDir, bot, hitDist);
      if (bHit && bHit.t < hitDist) {
        hitDist = bHit.t;
        targetPoint.copy(bHit.point);
      }
    }

    let muzzlePos = eye.clone();
    if (this.perspective === 'OTS' && this.heroineWeaponSocket) {
      this.heroineWeaponSocket.getWorldPosition(muzzlePos);
    }

    const events = this.weapons.update(
      dt,
      weaponCmd,
      this.character,
      targets,
      eye,
      this.character.yaw,
      this.character.pitch,
      targetPoint,
      muzzlePos
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

        // Spawn bullet tracers directly from muzzle to hit impact point
        for (const trace of ev.traces) {
          this._spawnTracer(ev.origin || muzzlePos, trace.point, 0x38bdf8);
        }

        this.hud.updateWeapon(def, this.weapons.ammo, this.weapons.slot.reserve, this.weapons.current);
      } else if (ev.type === 'reloadStart') {
        this.audio.playReload();
      } else if (ev.type === 'reloadEnd') {
        this.hud.updateWeapon(this.weapons.def, this.weapons.ammo, this.weapons.slot.reserve, this.weapons.current);
      }
    }

    // 5. Update Heroine Animation Blend (Standby / Step)
    if (this.heroineMixer) {
      this.heroineMixer.update(dt);
      if (this.heroineActions) {
        const isMoving = this.character.vel.length() > 0.4;
        if (isMoving && this.heroineActions.step && !this.heroineActions.step.isRunning()) {
          this.heroineActions.idle?.fadeOut(0.18);
          this.heroineActions.step.reset().fadeIn(0.18).play();
        } else if (!isMoving && this.heroineActions.idle && !this.heroineActions.idle.isRunning()) {
          this.heroineActions.step?.fadeOut(0.18);
          this.heroineActions.idle.reset().fadeIn(0.18).play();
        }
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

    // 6. Update Bots AI
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

    // 8. Update 3D Weapon Pickups & Proximity Detection
    if (this.pickups) {
      const isInteractPressed = this.input.down('KeyE') || !!(this.input.pad?.connected && this.input.pad.x);
      this.pickups.update(dt, this.character.pos, isInteractPressed, (slotIdx) => {
        this.switchWeapon(slotIdx);
        this.audio.playVoice('confirm');
      });
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
    this.cameraPivot.rotation.set(totalPitch, totalYaw, 0, 'YXZ');

    // ADS FOV Zoom Transition (Configurable via In-Depth Settings)
    const baseFov = this.userBaseFov || 85.0;
    const adsTargetFov = baseFov * (this.weapons.def.adsFov || 0.55) * (this.adsZoomScale || 1.0);
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
      // Local +X = Right Shoulder (0.50m)
      // Local +Y = Eye Level (+0.16m)
      // Local +Z = Behind Player (+2.10m, pulls into +1.25m when ADS)
      const adsLerp = this.weapons ? this.weapons.ads : 0;
      let targetX = THREE.MathUtils.lerp(0.58, 0.40, adsLerp);
      let targetY = THREE.MathUtils.lerp(0.14, 0.08, adsLerp);
      let targetZ = THREE.MathUtils.lerp(2.40, 1.40, adsLerp);

      // Proportional camera collision prevention against walls/geometry
      if (this.collision) {
        const camPosWish = eye.clone()
          .addScaledVector(new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(totalPitch, totalYaw, 0, 'YXZ')), targetX)
          .addScaledVector(new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(totalPitch, totalYaw, 0, 'YXZ')), targetY)
          .addScaledVector(new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(totalPitch, totalYaw, 0, 'YXZ')), targetZ);
        const dist = eye.distanceTo(camPosWish);
        if (dist > 0.05) {
          const dir = camPosWish.clone().sub(eye).normalize();
          const wallHit = this.collision.raycast(eye, dir, dist, 0.20);
          if (wallHit && wallHit.distance < dist) {
            const safeDist = Math.max(0.40, wallHit.distance - 0.20);
            const ratio = safeDist / dist;
            targetX *= ratio;
            targetY *= ratio;
            targetZ *= ratio;
          }
        }
      }

      this.camera.position.set(targetX, targetY, targetZ);
      this.camera.rotation.set(0, 0, 0);

      // Heroine Model stands cleanly on player position, oriented with Yaw
      this.heroineGroup.position.copy(this.character.pos);
      this.heroineGroup.rotation.y = totalYaw;

      // When camera pulls too close due to wall clipping, fade/hide player to avoid clipping into skull
      this.heroineGroup.visible = (targetZ > 1.15);
    } else {
      this.heroineGroup.visible = false;
      this.viewmodel.root.visible = true;
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.set(0, 0, 0);
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
