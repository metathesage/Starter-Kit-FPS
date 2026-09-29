/**
 * Bot AI Controller: Nav grid traversal, team sparring, weapon fire,
 * realistic inertia steering, and Counter-Strike round elimination.
 */

import * as THREE from '../../vendor/three/build/three.module.js';
import { GLTFLoader } from '../../vendor/three/examples/jsm/loaders/GLTFLoader.js';

export class BotManager {
  constructor(scene, collision, mapMeta) {
    this.scene = scene;
    this.collision = collision;
    this.mapMeta = mapMeta || {};
    this.loader = new GLTFLoader();
    this.bots = [];
    this.mode = this.mapMeta.mode || 'halo'; // 'halo' or 'counter_strike'

    this.onKillCallback = null;
    this.onDamageCallback = null;
    this.onTracerCallback = null;
  }

  init(mode = null) {
    if (mode) this.mode = mode;
    this.dispose();

    if (this.mode === 'counter_strike') {
      this._initCSMode();
    } else {
      this._initHaloMode();
    }
  }

  _initHaloMode() {
    const allSpawns = this.mapMeta.spawns || [
      [6.32, -4.03, -69.67],
      [3.82, -3.38, 100.83],
      [-9.68, -3.00, 18.83],
      [28.82, -11.42, -53.17],
      [-3.68, -3.38, 95.83]
    ];
    const botSpawns = allSpawns.length > 1 ? allSpawns.slice(1) : allSpawns;

    // Standardized scales calibrated to 1.75m human height
    const configs = [
      { name: 'Mai Maid', model: 'mai_maid_combat_ready.glb', weapon: 'Outbreak Perfected', color: 0x38bdf8, scale: 0.50, team: 'T' },
      { name: 'Miyazawa', model: 'main_heroine_miyazawa_combat_ready.glb', weapon: 'Hawkmoon', color: 0xf43f5e, scale: 2.05, team: 'T' },
      { name: 'Lucy', model: 'lucy_edgerunner_rigged.glb', weapon: 'Hanami SMG', color: 0x10b981, scale: 0.0102, team: 'T' },
      { name: 'Spartan Soldier', model: 'soldier.glb', weapon: 'The Chaperone', color: 0xfbbf24, scale: 1.08, team: 'T' },
      { name: 'Shadow Wraith', model: 'wraith.glb', weapon: 'Energy Sword', color: 0xa855f7, scale: 1.75, team: 'T' }
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

    // Counter-Terrorist Waifu Squad (Teammates)
    const ctConfigs = [
      { name: 'Mai Maid', model: 'mai_maid_combat_ready.glb', weapon: 'Outbreak Perfected', color: 0x38bdf8, scale: 0.50, team: 'CT' },
      { name: 'Lucy', model: 'lucy_edgerunner_rigged.glb', weapon: 'Hanami SMG', color: 0x06b6d4, scale: 0.0102, team: 'CT' },
      { name: 'Spartan Soldier', model: 'soldier.glb', weapon: 'The Chaperone', color: 0x3b82f6, scale: 1.08, team: 'CT' },
      { name: 'Operator Meghan', model: 'soldier.glb', weapon: 'Ace of Spades', color: 0x60a5fa, scale: 1.08, team: 'CT' }
    ];

    // Terrorist Hostile Squad
    const tConfigs = [
      { name: 'Miyazawa', model: 'main_heroine_miyazawa_combat_ready.glb', weapon: 'AK-47', color: 0xf43f5e, scale: 2.05, team: 'T' },
      { name: 'Shadow Wraith', model: 'wraith.glb', weapon: 'Energy Sword', color: 0xa855f7, scale: 1.75, team: 'T' },
      { name: 'Reaper Terrorist', model: 'soldier.glb', weapon: 'Hawkmoon', color: 0xef4444, scale: 1.08, team: 'T' },
      { name: 'Ghost Operator', model: 'wraith.glb', weapon: 'Hanami SMG', color: 0xf97316, scale: 1.75, team: 'T' },
      { name: 'Agent Karen', model: 'main_heroine_miyazawa_combat_ready.glb', weapon: 'Sakura Shotgun', color: 0xe11d48, scale: 2.05, team: 'T' }
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
      const sp = tSpawns[idx % tSpawns.length];
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
    placeholder.position.y = 0.9;
    placeholder.castShadow = true;
    placeholder.receiveShadow = true;
    root.add(placeholder);

    // Overhead 3D Vitals Canvas Sprite
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 36;
    const ctx = canvas.getContext('2d');
    const spriteTex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: spriteTex, depthTest: false });
    const vitalsSprite = new THREE.Sprite(spriteMat);
    vitalsSprite.position.set(0, 2.15, 0);
    vitalsSprite.scale.set(1.15, 0.32, 1);
    root.add(vitalsSprite);

    const bot = {
      id,
      name: conf.name,
      weapon: conf.weapon,
      team: conf.team || 'T',
      root,
      pos: root.position,
      vel: new THREE.Vector3(),
      yaw: initYaw,
      targetYaw: initYaw,
      health: 100,
      shield: this.mode === 'counter_strike' ? 100 : 100, // In CS: 100 Armor
      maxHealth: 100,
      maxShield: 100,
      alive: true,
      lastHitTime: 0,
      fireCooldown: 0.8 + Math.random() * 0.8,
      strafeDir: (Math.random() > 0.5 ? 1 : -1),
      strafeTimer: 1.5 + Math.random() * 1.5,
      respawnTimer: 0,
      spawnOrigin: spawnPos.slice(),
      vitalsSprite,
      vitalsCtx: ctx,
      vitalsTex: spriteTex,
      modelMesh: null,
      mixer: null,
      idleAction: null,
      stepAction: null,
      reactionAction: null,
      isMoving: false,

      takeDamage: (amount, zone, dir, hitPoint, attacker) => {
        if (!bot.alive) return;
        bot.lastHitTime = performance.now();

        let remaining = amount;
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

        // Flinch animation
        if (bot.reactionAction) {
          bot.reactionAction.reset();
          bot.reactionAction.setLoop(THREE.LoopOnce);
          bot.reactionAction.play();
        }

        // Damage flash (red)
        if (bot.modelMesh) {
          bot.modelMesh.traverse((c) => {
            if (c.isMesh && c.material && c.material.color) {
              const orig = c.material.color.getHex();
              c.material.color.setHex(0xff2222);
              setTimeout(() => { if (c.material) c.material.color.setHex(orig); }, 100);
            }
          });
        }

        bot.updateVitalsUI();

        if (this.onDamageCallback) {
          this.onDamageCallback({
            bot,
            amount,
            zone,
            hitPoint,
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

        // In CS mode, bots DO NOT respawn mid-round (elimination)
        if (this.mode === 'counter_strike') {
          bot.respawnTimer = Infinity;
        } else {
          bot.respawnTimer = 4.5;
        }

        if (this.onKillCallback) {
          this.onKillCallback(bot, attacker);
        }
      },

      respawn: () => {
        bot.pos.set(bot.spawnOrigin[0], bot.spawnOrigin[1], bot.spawnOrigin[2]);
        bot.vel.set(0, 0, 0);
        bot.yaw = Math.atan2(-bot.pos.x, -bot.pos.z);
        bot.root.rotation.y = bot.yaw;
        bot.health = bot.maxHealth;
        bot.shield = bot.maxShield;
        bot.alive = true;
        bot.root.visible = true;
        bot.updateVitalsUI();
      },

      updateVitalsUI: () => {
        ctx.clearRect(0, 0, 128, 36);
        // Background container
        ctx.fillStyle = 'rgba(6, 10, 24, 0.90)';
        ctx.fillRect(0, 0, 128, 36);

        // Team indicator badge
        const isCT = bot.team === 'CT';
        ctx.fillStyle = isCT ? '#38bdf8' : '#f43f5e';
        ctx.font = 'bold 9px "Share Tech Mono", monospace';
        ctx.fillText(isCT ? 'CT // ' + bot.name.toUpperCase() : 'T // ' + bot.name.toUpperCase(), 5, 10);

        // Shield / Armor bar
        const sPct = Math.max(0, Math.min(1, bot.shield / bot.maxShield));
        ctx.fillStyle = isCT ? '#38bdf8' : '#fb923c';
        ctx.fillRect(4, 14, 120 * sPct, 8);

        // Health bar (pure white)
        const hPct = Math.max(0, Math.min(1, bot.health / bot.maxHealth));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(4, 24, 120 * hPct, 6);

        // Border
        ctx.strokeStyle = isCT ? 'rgba(56, 189, 248, 0.5)' : 'rgba(244, 63, 94, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, 127, 35);

        spriteTex.needsUpdate = true;
      }
    };

    bot.updateVitalsUI();

    // Load character model
    const charPath = `./assets/chars/${conf.model}`;
    this.loader.load(charPath, (gltf) => {
      const model = gltf.scene;
      const sc = conf.scale || 1.0;
      model.scale.set(sc, sc, sc);
      model.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      root.remove(placeholder);
      root.add(model);
      bot.modelMesh = model;

      // Animation Setup
      if (gltf.animations && gltf.animations.length > 0) {
        bot.mixer = new THREE.AnimationMixer(model);
        const clips = gltf.animations;
        const findClip = (names) => clips.find(c => names.some(n => c.name.toLowerCase().includes(n.toLowerCase())));

        const idleClip = findClip(['Standby', 'ani_idle_basic_new', 'idle', 'char_mint_stand_show_1']) || clips[0];
        const stepClip = findClip(['Step', 'walk', 'run', 'ani_lobby_landing']) || null;
        const reactionClip = findClip(['Reaction', 'Reaction2', 'hit']) || null;

        if (idleClip) {
          bot.idleAction = bot.mixer.clipAction(idleClip);
          bot.idleAction.play();
        }
        if (stepClip) {
          bot.stepAction = bot.mixer.clipAction(stepClip);
          bot.stepAction.timeScale = 0.85;
        }
        if (reactionClip) {
          bot.reactionAction = bot.mixer.clipAction(reactionClip);
          bot.reactionAction.timeScale = 1.2;
        }
      }
    }, undefined, (err) => {
      console.warn(`Could not load bot model ${charPath}, using capsule.`, err);
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

  update(dt, playerPos, playerTakeDamage, playerAlive = true) {
    const now = performance.now();
    const safeDt = Math.min(dt, 0.05);

    this.bots.forEach((bot) => {
      if (!bot.alive) {
        if (this.mode !== 'counter_strike') {
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

      // Armor/Shield slow regen in Halo mode only
      if (this.mode === 'halo' && now - bot.lastHitTime > 4500 && bot.shield < bot.maxShield) {
        bot.shield = Math.min(bot.maxShield, bot.shield + safeDt * 42);
        bot.updateVitalsUI();
      }

      // -------------------------------------------------------------
      // Tactical AI Target Selection
      // -------------------------------------------------------------
      let targetPos = null;
      let targetIsPlayer = false;
      let targetBot = null;
      let closestDist = Infinity;

      if (this.mode === 'counter_strike') {
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
          // T bots hunt living CT bots or the Player
          if (playerAlive) {
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

      if (targetPos && closestDist < 55.0) {
        const dx = targetPos.x - bot.pos.x;
        const dz = targetPos.z - bot.pos.z;
        const dist = Math.hypot(dx, dz) || 1;

        // --- 1. Smooth Yaw Steering towards Target ---
        const targetYaw = Math.atan2(dx, dz);
        let yawDiff = THREE.MathUtils.euclideanModulo(targetYaw - bot.yaw + Math.PI, Math.PI * 2) - Math.PI;
        bot.yaw += THREE.MathUtils.clamp(yawDiff, -5.5 * safeDt, 5.5 * safeDt);
        bot.root.rotation.y = bot.yaw;

        const toTargetNorm = new THREE.Vector2(dx / dist, dz / dist);
        const strafeNorm = new THREE.Vector2(-toTargetNorm.y, toTargetNorm.x);

        // --- 2. Tactical Spacing & Strafe Logic ---
        bot.strafeTimer -= safeDt;
        if (bot.strafeTimer <= 0) {
          bot.strafeDir *= -1;
          bot.strafeTimer = 1.4 + Math.random() * 1.6;
        }

        let forwardSpeed = 0;
        let strafeSpeed = 1.6 * bot.strafeDir;

        if (dist > 20.0) {
          forwardSpeed = 2.4;
        } else if (dist < 5.0) {
          forwardSpeed = -2.2;
          strafeSpeed *= 1.2;
        } else if (dist < 10.0) {
          forwardSpeed = -0.5;
        } else {
          forwardSpeed = 0.2;
        }

        desiredVel.x = (toTargetNorm.x * forwardSpeed) + (strafeNorm.x * strafeSpeed);
        desiredVel.z = (toTargetNorm.y * forwardSpeed) + (strafeNorm.y * strafeSpeed);

        // --- 3. Tactical Fire at Target ---
        bot.fireCooldown -= safeDt;
        if (bot.fireCooldown <= 0 && dist < 36.0) {
          bot.fireCooldown = 0.75 + Math.random() * 0.75;
          const hitChance = Math.max(0.35, 0.72 - (dist / 65));

          if (targetIsPlayer) {
            if (Math.random() < hitChance && playerTakeDamage) {
              playerTakeDamage(18, 'torso', bot.name);
            }
          } else if (targetBot && targetBot.alive) {
            if (Math.random() < hitChance) {
              const dmg = 24 + Math.random() * 12;
              targetBot.takeDamage(dmg, 'torso', toTargetNorm, targetBot.pos, bot.name);
            }
          }

          if (this.onTracerCallback) {
            const start = bot.pos.clone().add(new THREE.Vector3(0, 1.3, 0));
            const end = targetPos.clone().add(new THREE.Vector3(0, 1.2, 0));
            this.onTracerCallback(start, end, bot.team === 'CT' ? 0x38bdf8 : 0xf43f5e);
          }
        }
      } else {
        // --- Patrol towards Objectives ---
        const site = (this.mapMeta.bombsites && this.mapMeta.bombsites.A) || this.mapMeta.koth || { x: 0, y: -2, z: 0 };
        const kdx = site.x - bot.pos.x;
        const kdz = site.z - bot.pos.z;
        const kDist = Math.hypot(kdx, kdz);

        if (kDist > 3.0) {
          const targetYaw = Math.atan2(kdx, kdz);
          let yawDiff = THREE.MathUtils.euclideanModulo(targetYaw - bot.yaw + Math.PI, Math.PI * 2) - Math.PI;
          bot.yaw += THREE.MathUtils.clamp(yawDiff, -4.0 * safeDt, 4.0 * safeDt);
          bot.root.rotation.y = bot.yaw;

          desiredVel.x = (kdx / kDist) * 1.8;
          desiredVel.z = (kdz / kDist) * 1.8;
        }
      }

      // --- 4. Velocity Inertia ---
      bot.vel.lerp(desiredVel, Math.min(1.0, safeDt * 4.5));
      bot.pos.x += bot.vel.x * safeDt;
      bot.pos.z += bot.vel.z * safeDt;

      // --- 5. Animation Blending ---
      const hSpeed = Math.hypot(bot.vel.x, bot.vel.z);
      if (bot.stepAction && bot.idleAction) {
        if (hSpeed > 0.35 && !bot.isMoving) {
          bot.isMoving = true;
          bot.stepAction.reset().fadeIn(0.2).play();
          bot.idleAction.fadeOut(0.2);
        } else if (hSpeed <= 0.35 && bot.isMoving) {
          bot.isMoving = false;
          bot.idleAction.reset().fadeIn(0.2).play();
          bot.stepAction.fadeOut(0.2);
        }
      }

      // --- 6. Ground Clamp ---
      const gy = this.collision.groundHeight(bot.pos.x, bot.pos.z, bot.pos.y + 2.0, 6.0);
      if (gy !== null) {
        bot.pos.y = THREE.MathUtils.lerp(bot.pos.y, gy, Math.min(1.0, safeDt * 10.0));
      }
    });
  }

  dispose() {
    this.bots.forEach(bot => {
      this.scene.remove(bot.root);
    });
    this.bots = [];
  }
}
