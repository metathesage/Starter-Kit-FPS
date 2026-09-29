/**
 * Bot AI Controller: Nav grid traversal, team sparring, weapon fire,
 * realistic inertia steering, and Counter-Strike Team Deathmatch (TDM).
 */

import * as THREE from '../../vendor/three/build/three.module.js';
import { GLTFLoader } from '../../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { WEAPONS } from '../player/weapons.js';
import { makeContact } from '../world/collision.js';

export class BotManager {
  constructor(scene, collision, mapMeta) {
    this.scene = scene;
    this.collision = collision;
    this.mapMeta = mapMeta || {};
    this.loader = new GLTFLoader();
    this.bots = [];
    this.mode = this.mapMeta.mode || 'tdm'; // 'tdm', 'counter_strike', 'ffa', 'halo'

    this.onKillCallback = null;
    this.onDamageCallback = null;
    this.onTracerCallback = null;
    this.onBotFireCallback = null;
  }

  init(mode = null) {
    if (mode) this.mode = mode;
    this.dispose();

    if (this.mode === 'counter_strike' || this.mode === 'tdm') {
      this._initCSMode();
    } else {
      this._initHaloMode();
    }
  }

  _initHaloMode() {
    const allSpawns = this.mapMeta.spawns || [
      [0, -7.28, -40],
      [0, -7.84, 40],
      [0, -7.28, 0],
      [-9.68, -2.85, 18.83],
      [0, -7.28, 15],
      [8.5, -3.73, -55],
      [12.0, -2.85, 25],
      [-12.0, -4.54, -25]
    ];
    const botSpawns = allSpawns.length > 1 ? allSpawns.slice(1) : allSpawns;

    const configs = [
      { name: 'Mai Maid', model: 'mai_maid_combat_ready.glb', weapon: 'Outbreak Perfected', weaponKey: 'outbreak', color: 0x38bdf8, scale: 0.50, rotY: 0, team: 'T' },
      { name: 'Combat Maid', model: 'mai_maid_combat_ready.glb', weapon: 'The Chaperone', weaponKey: 'chaperone', color: 0x10b981, scale: 0.50, rotY: 0, team: 'T' },
      { name: 'Tactical Mai', model: 'mai_maid_combat_ready.glb', weapon: 'Hawkmoon', weaponKey: 'hawkmoon', color: 0xf43f5e, scale: 0.50, rotY: 0, team: 'T' },
      { name: 'Elite Maid', model: 'mai_maid_combat_ready.glb', weapon: 'Energy Sword', weaponKey: 'sword', color: 0xfbbf24, scale: 0.50, rotY: 0, team: 'T' },
      { name: 'Vanguard Mai', model: 'mai_maid_combat_ready.glb', weapon: 'Lotus Launcher', weaponKey: 'launcher', color: 0xa855f7, scale: 0.50, rotY: 0, team: 'T' }
    ];

    configs.forEach((conf, idx) => {
      const spawn = botSpawns[idx % botSpawns.length];
      const bot = this._createBot(conf, spawn, idx);
      this.bots.push(bot);
      this.scene.add(bot.root);
    });
  }

  _initCSMode() {
    const ctSpawns = this.mapMeta.ctSpawns || [
      [0, -2, 50], [5, -2, 52], [-5, -2, 48], [10, -2, 54], [-10, -2, 46]
    ];
    const tSpawns = this.mapMeta.tSpawns || [
      [0, -2, -50], [5, -2, -52], [-5, -2, -48], [10, -2, -54], [-10, -2, -46]
    ];

    // Mid combat zones for immediate dynamic action in Blackhawk Down
    const midA = (this.mapMeta.bombsites && this.mapMeta.bombsites.A) ? [-21.98, -2.31, -11.56] : tSpawns[0];
    const midB = (this.mapMeta.bombsites && this.mapMeta.bombsites.B) ? [12.02, -1.49, -11.56] : tSpawns[1];

    // Counter-Terrorist Waifu Squad (Teammates) - ALL ANIMATED RIGS WITH ACTIVE LOCOMOTION
    const ctConfigs = [
      { name: 'Mai Maid', model: 'mai_maid_combat_ready.glb', weapon: 'Outbreak Perfected', weaponKey: 'outbreak', color: 0x38bdf8, scale: 0.50, rotY: 0, team: 'CT' },
      { name: 'Tactical Maid', model: 'mai_maid_combat_ready.glb', weapon: 'Hanami SMG', weaponKey: 'smg', color: 0x06b6d4, scale: 0.50, rotY: 0, team: 'CT' },
      { name: 'Maid Enforcer', model: 'mai_maid_combat_ready.glb', weapon: 'M4A1 Carbine', weaponKey: 'm4a1', color: 0x3b82f6, scale: 0.50, rotY: 0, team: 'CT' },
      { name: 'Maid Vanguard', model: 'mai_maid_combat_ready.glb', weapon: 'Ace of Spades', weaponKey: 'ace', color: 0x60a5fa, scale: 0.50, rotY: 0, team: 'CT' }
    ];

    // Terrorist Hostile Squad - Distributed between forward combat and T base
    const tConfigs = [
      { name: 'Rebel Mai', model: 'mai_maid_combat_ready.glb', weapon: 'AK-47', weaponKey: 'ak47', color: 0xf43f5e, scale: 0.50, rotY: 0, team: 'T', forwardSpawn: midA },
      { name: 'Renegade Maid', model: 'mai_maid_combat_ready.glb', weapon: 'The Chaperone', weaponKey: 'chaperone', color: 0xe11d48, scale: 0.50, rotY: 0, team: 'T', forwardSpawn: midB },
      { name: 'Shadow Mai', model: 'mai_maid_combat_ready.glb', weapon: 'Energy Sword', weaponKey: 'sword', color: 0xa855f7, scale: 0.50, rotY: 0, team: 'T' },
      { name: 'Demolition Mai', model: 'mai_maid_combat_ready.glb', weapon: 'Lotus Launcher', weaponKey: 'launcher', color: 0xf97316, scale: 0.50, rotY: 0, team: 'T' },
      { name: 'Infiltrator Mai', model: 'mai_maid_combat_ready.glb', weapon: 'Hawkmoon', weaponKey: 'hawkmoon', color: 0xd97706, scale: 0.50, rotY: 0, team: 'T' }
    ];

    // Spawn 4 CT bots (Player is CT #1)
    ctConfigs.forEach((conf, idx) => {
      const sp = ctSpawns[(idx + 1) % ctSpawns.length];
      const bot = this._createBot(conf, sp, idx);
      this.bots.push(bot);
      this.scene.add(bot.root);
    });

    // Spawn 5 T bots
    tConfigs.forEach((conf, idx) => {
      const sp = conf.forwardSpawn || tSpawns[idx % tSpawns.length];
      const bot = this._createBot(conf, sp, idx + 10);
      this.bots.push(bot);
      this.scene.add(bot.root);
    });
  }

  _createBot(conf, spawnPos, id) {
    const root = new THREE.Group();
    root.position.set(spawnPos[0], spawnPos[1], spawnPos[2]);

    const initYaw = Math.atan2(-spawnPos[0], -spawnPos[2]);
    root.rotation.y = initYaw;

    // Character placeholder capsule while GLB loads
    const capGeo = new THREE.CapsuleGeometry(0.32, 1.1, 8, 16);
    const capMat = new THREE.MeshStandardMaterial({
      color: conf.color,
      roughness: 0.45,
      metalness: 0.2
    });
    const placeholder = new THREE.Mesh(capGeo, capMat);
    placeholder.position.y = 0.85;
    placeholder.castShadow = true;
    placeholder.receiveShadow = true;
    root.add(placeholder);

    // Dynamic Bot Weapon Muzzle Flash Light
    const botFlashLight = new THREE.PointLight(0xffb74d, 0, 6);
    botFlashLight.position.set(0, 1.25, 0.35);
    root.add(botFlashLight);

    const bot = {
      id,
      name: conf.name,
      weapon: conf.weapon,
      weaponKey: conf.weaponKey || 'outbreak',
      team: conf.team || 'T',
      root,
      pos: root.position,
      vel: new THREE.Vector3(),
      yaw: initYaw,
      targetYaw: initYaw,
      health: 100,
      shield: 100, // 100 Armor / Shield
      maxHealth: 100,
      maxShield: 100,
      alive: true,
      lastHitTime: 0,
      fireCooldown: 0.4 + Math.random() * 0.6,
      burstRemaining: 0,
      burstTimer: 0,
      flashLight: botFlashLight,
      flashTimer: 0,
      strafeDir: (Math.random() > 0.5 ? 1 : -1),
      strafeTimer: 1.2 + Math.random() * 1.4,
      respawnTimer: 0,
      spawnOrigin: spawnPos.slice(),
      contact: makeContact(),
      grounded: true,
      modelMesh: null,
      mixer: null,
      idleAction: null,
      stepAction: null,
      reactionAction: null,
      isMoving: false,

      takeDamage: (amount, zone, dir, hitPoint, attacker) => {
        if (!bot.alive) return;
        bot.lastHitTime = performance.now();

        const numAmount = (isNaN(amount) || amount <= 0) ? 25 : amount;
        let remaining = numAmount;
        let shieldAbsorbed = 0;

        if (bot.shield > 0) {
          if (bot.shield >= remaining) {
            bot.shield -= remaining;
            shieldAbsorbed = remaining;
            remaining = 0;
          } else {
            shieldAbsorbed = bot.shield;
            remaining -= bot.shield;
            bot.shield = 0;
            bot.health = Math.max(0, bot.health - remaining);
          }
        } else {
          bot.health = Math.max(0, bot.health - remaining);
        }

        // Dynamic Torso Flinch & Reaction Animation
        if (bot.reactionAction) {
          bot.reactionAction.reset();
          bot.reactionAction.setLoop(THREE.LoopOnce, 1);
          bot.reactionAction.clampWhenFinished = false;
          bot.reactionAction.fadeIn(0.06).play();
          setTimeout(() => {
            if (bot.reactionAction) bot.reactionAction.fadeOut(0.14);
          }, 280);
        }

        // Physical impulse jolt away from hit direction
        if (dir) {
          bot.pos.x += dir.x * 0.12;
          bot.pos.z += dir.z * 0.12;
        }

        // Damage flash (red)
        if (bot.modelMesh) {
          bot.modelMesh.traverse((c) => {
            if (c.isMesh && c.material && c.material.color) {
              const orig = c.material.color.getHex();
              c.material.color.setHex(0xff2222);
              setTimeout(() => { if (c.material) c.material.color.setHex(orig); }, 90);
            }
          });
        }

        if (this.onDamageCallback) {
          this.onDamageCallback({
            bot,
            amount: numAmount,
            zone,
            hitPoint: hitPoint || bot.pos.clone().add(new THREE.Vector3(0, 1.1, 0)),
            isCrit: zone === 'head',
            shieldBroke: shieldAbsorbed > 0 && bot.shield === 0
          });
        }

        if (bot.health <= 0) {
          bot.die(attacker);
        }
      },

      die: (attacker) => {
        bot.alive = false;
        bot.root.visible = false;
        bot.vel.set(0, 0, 0);

        // Continuous TDM Respawn: 2.0s delay
        bot.respawnTimer = (this.mode === 'elimination') ? Infinity : 2.0;

        if (this.onKillCallback) {
          this.onKillCallback(bot, attacker);
        }
      },

      respawn: () => {
        const spawns = (bot.team === 'CT' ? this.mapMeta.ctSpawns : this.mapMeta.tSpawns) || this.mapMeta.spawns || [bot.spawnOrigin];
        const sp = spawns[Math.floor(Math.random() * spawns.length)] || bot.spawnOrigin;
        bot.pos.set(sp[0], sp[1], sp[2]);
        bot.vel.set(0, 0, 0);
        bot.yaw = Math.atan2(-bot.pos.x, -bot.pos.z);
        bot.root.rotation.y = bot.yaw;
        bot.health = bot.maxHealth;
        bot.shield = bot.maxShield;
        bot.alive = true;
        bot.root.visible = true;

        if (bot.idleAction) bot.idleAction.reset().fadeIn(0.15).play();
        if (bot.stepAction) bot.stepAction.fadeOut(0.15);
        bot.isMoving = false;
      }
    };

    // Load character model
    const charPath = `./assets/chars/${conf.model}`;
    this.loader.load(charPath, (gltf) => {
      const model = gltf.scene;
      const sc = conf.scale || 1.0;
      model.scale.set(sc, sc, sc);
      if (conf.rotY !== undefined) {
        model.rotation.y = conf.rotY;
      }
      model.position.set(0, 0, 0);
      model.traverse((c) => {
        if (c.isMesh) {
          c.frustumCulled = false;
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      root.remove(placeholder);
      root.add(model);
      bot.modelMesh = model;

      // Attach 3D weapon to bot's right hand socket
      const handBone = model.getObjectByName('Weapon_Socket_R') ||
                       model.getObjectByName('Skl_hand_R_056') ||
                       model.getObjectByName('Bip001 R Hand_074');
      if (handBone) {
        const weaponKey = conf.weaponKey || 'ak47';
        const weaponDef = WEAPONS[weaponKey] || WEAPONS.ak47;
        const wfile = weaponDef.model.endsWith('.glb') ? weaponDef.model : `${weaponDef.model}.glb`;
        this.loader.load(`./assets/weapons/${wfile}`, (wgltf) => {
          const wm = wgltf.scene;
          const s = (conf.scale ? (1.0 / conf.scale) : 1.0) * 0.52;
          wm.scale.set(s, s, s);
          wm.rotation.set(0, Math.PI / 2, 0);
          wm.position.set(0, -0.02, -0.06);
          wm.traverse(c => { if (c.isMesh) { c.frustumCulled = false; c.castShadow = true; } });
          handBone.add(wm);
        }, undefined, () => {});
      }

      // Skeletal Animation Setup
      if (gltf.animations && gltf.animations.length > 0) {
        bot.mixer = new THREE.AnimationMixer(model);
        const clips = gltf.animations;
        const findClip = (names) => clips.find(c => names.some(n => c.name.toLowerCase().includes(n.toLowerCase())));

        const idleClip = findClip(['Standby', 'idle', 'char_mint_stand_show_1']) || clips[0];
        const stepClip = findClip(['Step', 'walk', 'run']) || null;
        const reactionClip = findClip(['Reaction', 'Reaction2', 'hit']) || null;

        if (idleClip) {
          bot.idleAction = bot.mixer.clipAction(idleClip);
          bot.idleAction.setLoop(THREE.LoopRepeat, Infinity);
          bot.idleAction.play();
        }
        if (stepClip) {
          bot.stepAction = bot.mixer.clipAction(stepClip);
          bot.stepAction.setLoop(THREE.LoopRepeat, Infinity);
          bot.stepAction.timeScale = 1.15;
        }
        if (reactionClip) {
          bot.reactionAction = bot.mixer.clipAction(reactionClip);
          bot.reactionAction.timeScale = 1.4;
        }
      }
    }, undefined, (err) => {
      console.warn(`Could not load bot model ${charPath}`, err);
    });

    return bot;
  }

  resetRound() {
    this.bots.forEach(bot => {
      bot.respawn();
    });
  }

  getLivingCounts() {
    let ct = 0;
    let t = 0;
    this.bots.forEach(bot => {
      if (bot.alive) {
        if (bot.team === 'CT') ct++;
        else t++;
      }
    });
    return { ct, t };
  }

  update(dt, playerPos, playerTakeDamage, playerAlive = true, playerTeam = 'CT') {
    const safeDt = Math.min(dt, 0.05);

    this.bots.forEach((bot) => {
      if (!bot.alive) {
        if (this.mode !== 'elimination') {
          bot.respawnTimer -= safeDt;
          if (bot.respawnTimer <= 0) {
            bot.respawn();
          }
        }
        return;
      }

      if (bot.mixer) {
        bot.mixer.update(safeDt);
      }

      // Dynamic muzzle flash decay
      if (bot.flashTimer > 0) {
        bot.flashTimer -= safeDt;
        if (bot.flashTimer <= 0 && bot.flashLight) {
          bot.flashLight.intensity = 0;
        }
      }

      // -------------------------------------------------------------
      // Tactical AI Target Selection (140m Engagement Range)
      // -------------------------------------------------------------
      let targetPos = null;
      let targetIsPlayer = false;
      let targetBot = null;
      let closestDist = Infinity;

      if (this.mode === 'ffa') {
        // Free For All: Hunt closest bot or player
        if (playerAlive) {
          closestDist = bot.pos.distanceTo(playerPos);
          targetPos = playerPos;
          targetIsPlayer = true;
        }
        this.bots.forEach(other => {
          if (other !== bot && other.alive) {
            const d = bot.pos.distanceTo(other.pos);
            if (d < closestDist) {
              closestDist = d;
              targetPos = other.pos;
              targetIsPlayer = false;
              targetBot = other;
            }
          }
        });
      } else if (this.mode === 'counter_strike' || this.mode === 'tdm') {
        if (bot.team === 'CT') {
          // CT bots hunt living Terrorist bots
          this.bots.forEach(other => {
            if (other.team === 'T' && other.alive) {
              const d = bot.pos.distanceTo(other.pos);
              if (d < closestDist) {
                closestDist = d;
                targetPos = other.pos;
                targetBot = other;
              }
            }
          });
        } else {
          // T bots hunt living CT bots or the Player (if player is CT)
          if (playerAlive && playerTeam === 'CT') {
            closestDist = bot.pos.distanceTo(playerPos);
            targetPos = playerPos;
            targetIsPlayer = true;
          }
          this.bots.forEach(other => {
            if (other.team === 'CT' && other.alive) {
              const d = bot.pos.distanceTo(other.pos);
              if (d < closestDist) {
                closestDist = d;
                targetPos = other.pos;
                targetIsPlayer = false;
                targetBot = other;
              }
            }
          });
        }
      } else {
        // Halo Mode: All bots challenge the player
        if (playerAlive) {
          targetPos = playerPos;
          targetIsPlayer = true;
          closestDist = bot.pos.distanceTo(playerPos);
        }
      }

      const desiredVel = new THREE.Vector3(0, 0, 0);

      if (targetPos && closestDist < 140.0) {
        const dx = targetPos.x - bot.pos.x;
        const dz = targetPos.z - bot.pos.z;
        const dist = Math.hypot(dx, dz) || 1;

        // --- 1. Smooth Yaw Steering towards Target ---
        const targetYaw = Math.atan2(dx, dz);
        let yawDiff = THREE.MathUtils.euclideanModulo(targetYaw - bot.yaw + Math.PI, Math.PI * 2) - Math.PI;
        bot.yaw += THREE.MathUtils.clamp(yawDiff, -6.5 * safeDt, 6.5 * safeDt);
        bot.root.rotation.y = bot.yaw;

        const toTargetNorm = new THREE.Vector2(dx / dist, dz / dist);
        const strafeNorm = new THREE.Vector2(-toTargetNorm.y, toTargetNorm.x);

        // --- 2. Tactical Movement & Strafe Logic ---
        bot.strafeTimer -= safeDt;
        if (bot.strafeTimer <= 0) {
          bot.strafeDir *= -1;
          bot.strafeTimer = 1.0 + Math.random() * 1.5;
        }

        let forwardSpeed = 0;
        let strafeSpeed = 1.8 * bot.strafeDir;

        if (dist > 18.0) {
          forwardSpeed = 3.6; // Sprint towards combat
        } else if (dist < 6.0) {
          forwardSpeed = -2.4; // Backpedal
          strafeSpeed *= 1.4;
        } else if (dist < 12.0) {
          forwardSpeed = 0.5;
          strafeSpeed *= 1.2;
        } else {
          forwardSpeed = 1.8;
        }

        desiredVel.x = (toTargetNorm.x * forwardSpeed) + (strafeNorm.x * strafeSpeed);
        desiredVel.z = (toTargetNorm.y * forwardSpeed) + (strafeNorm.y * strafeSpeed);

        // --- 3. Tactical Burst Fire at Target ---
        if (bot.burstRemaining > 0) {
          bot.burstTimer -= safeDt;
          if (bot.burstTimer <= 0) {
            bot.burstTimer = 0.085;
            bot.burstRemaining--;
            this._fireBotShot(bot, targetPos, targetIsPlayer, targetBot, toTargetNorm, dist, playerTakeDamage);
          }
        } else {
          bot.fireCooldown -= safeDt;
          if (bot.fireCooldown <= 0 && dist < 85.0) {
            bot.fireCooldown = 0.5 + Math.random() * 0.7;
            bot.burstRemaining = 3;
            bot.burstTimer = 0;
          }
        }
      } else {
        // --- Patrol towards Objectives / Center Courtyard ---
        const site = (this.mapMeta.bombsites && this.mapMeta.bombsites.A) || this.mapMeta.koth || { x: 0, y: -2, z: 0 };
        const kdx = site.x - bot.pos.x;
        const kdz = site.z - bot.pos.z;
        const kDist = Math.hypot(kdx, kdz);

        if (kDist > 3.0) {
          const targetYaw = Math.atan2(kdx, kdz);
          let yawDiff = THREE.MathUtils.euclideanModulo(targetYaw - bot.yaw + Math.PI, Math.PI * 2) - Math.PI;
          bot.yaw += THREE.MathUtils.clamp(yawDiff, -5.0 * safeDt, 5.0 * safeDt);
          bot.root.rotation.y = bot.yaw;

          desiredVel.x = (kdx / kDist) * 2.8;
          desiredVel.z = (kdz / kDist) * 2.8;
        }
      }

      // --- 4. Velocity Inertia & Capsule Depenetration ---
      bot.vel.lerp(desiredVel, Math.min(1.0, safeDt * 6.0));
      bot.pos.x += bot.vel.x * safeDt;
      bot.pos.z += bot.vel.z * safeDt;

      // Solid collision resolution against level geometry
      if (this.collision) {
        this.collision.resolveCapsule(bot.pos, 0.35, 1.7, bot.contact);
      }

      // --- 5. Animation Blending (Standby vs Step) ---
      const hSpeed = Math.hypot(bot.vel.x, bot.vel.z);
      if (bot.stepAction && bot.idleAction) {
        if (hSpeed > 0.25 && !bot.isMoving) {
          bot.isMoving = true;
          bot.stepAction.reset().fadeIn(0.18).play();
          bot.idleAction.fadeOut(0.18);
        } else if (hSpeed <= 0.25 && bot.isMoving) {
          bot.isMoving = false;
          bot.idleAction.reset().fadeIn(0.18).play();
          bot.stepAction.fadeOut(0.18);
        }
        if (bot.isMoving) {
          bot.stepAction.timeScale = Math.max(0.9, Math.min(1.4, hSpeed / 2.5));
        }
      }

      // --- 6. Direct Ground Clamp (Boots solidly on floor) ---
      if (this.collision) {
        const gy = this.collision.groundHeight(bot.pos.x, bot.pos.z, bot.pos.y + 1.2, 5.0);
        if (gy !== null) {
          bot.pos.y = gy;
        }
      }
    });
  }

  _fireBotShot(bot, targetPos, targetIsPlayer, targetBot, toTargetNorm, dist, playerTakeDamage) {
    if (!bot.alive) return;
    if (bot.flashLight) {
      bot.flashLight.intensity = 2.6;
      bot.flashTimer = 0.045;
    }

    const hitChance = Math.max(0.35, 0.72 - (dist / 70));
    const start = bot.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
    const end = targetPos.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.35,
      1.1 + (Math.random() - 0.5) * 0.25,
      (Math.random() - 0.5) * 0.35
    ));

    if (targetIsPlayer) {
      if (Math.random() < hitChance && playerTakeDamage) {
        const dmg = 12 + Math.floor(Math.random() * 8);
        playerTakeDamage(dmg, 'torso', bot.name);
      }
    } else if (targetBot && targetBot.alive) {
      if (Math.random() < hitChance) {
        const dmg = 15 + Math.floor(Math.random() * 10);
        targetBot.takeDamage(dmg, 'torso', toTargetNorm, targetBot.pos, bot.name);
      }
    }

    if (this.onBotFireCallback) {
      this.onBotFireCallback({
        bot,
        targetPos: end,
        startPos: start,
        weaponKey: bot.weaponKey || 'outbreak',
        color: bot.team === 'CT' ? 0x38bdf8 : 0xf43f5e
      });
    }

    if (this.onTracerCallback) {
      this.onTracerCallback(start, end, bot.team === 'CT' ? 0x38bdf8 : 0xf43f5e);
    }
  }

  dispose() {
    this.bots.forEach(bot => {
      this.scene.remove(bot.root);
    });
    this.bots = [];
  }
}
