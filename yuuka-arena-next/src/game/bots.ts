import * as THREE from 'three'
import type { BotState } from './types'
import { MAP_SIZE } from './map'

// Simple FSM bot: patrol → chase (on line-of-sight) → shoot. Strafe while
// engaging. No pathfinding in this pass — bots move in straight lines toward
// targets and bounce off walls via collision resolution.

const BOT_SPEED = 6.5
const CHASE_SPEED = 9
const BOT_HEALTH = 100
const BOT_DAMAGE = 8
const SHOOT_RANGE = 35
const SHOOT_INTERVAL = 0.25
const SIGHT_RANGE = 40

export function createBot(id: number, spawnPos: THREE.Vector3): BotState {
  return {
    id,
    position: spawnPos.clone(),
    velocity: new THREE.Vector3(),
    health: BOT_HEALTH,
    maxHealth: BOT_HEALTH,
    alive: true,
    respawnTimer: 0,
    state: 'patrol',
    strafeDir: Math.random() > 0.5 ? 1 : -1,
    strafeTimer: 0,
    lastShotTime: 0,
    color: ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e84393'][id % 7],
  }
}

export function updateBot(
  bot: BotState,
  playerPos: THREE.Vector3,
  playerAlive: boolean,
  dt: number,
  time: number,
  resolveCollision: (p: THREE.Vector3, r: number, h: number) => THREE.Vector3,
  onHitPlayer: (dmg: number) => void,
) {
  if (!bot.alive) {
    bot.respawnTimer -= dt
    if (bot.respawnTimer <= 0) {
      bot.alive = true
      bot.health = bot.maxHealth
      bot.position.set(
        (Math.random() - 0.5) * (MAP_SIZE - 10),
        0,
        (Math.random() - 0.5) * (MAP_SIZE - 10),
      )
    }
    return
  }

  const toPlayer = new THREE.Vector3().subVectors(playerPos, bot.position)
  const distToPlayer = toPlayer.length()

  // State transitions
  if (bot.state === 'patrol') {
    if (playerAlive && distToPlayer < SIGHT_RANGE) {
      bot.state = 'chase'
    } else {
      // Wander toward a random point
      wander(bot, dt, resolveCollision)
      return
    }
  }

  if (bot.state === 'chase') {
    if (!playerAlive || distToPlayer > SIGHT_RANGE * 1.5) {
      bot.state = 'patrol'
      return
    }
    if (distToPlayer < SHOOT_RANGE) {
      bot.state = 'shoot'
      bot.strafeDir = Math.random() > 0.5 ? 1 : -1
      bot.strafeTimer = 0
    } else {
      moveToward(bot, playerPos, CHASE_SPEED, dt, resolveCollision)
      return
    }
  }

  if (bot.state === 'shoot') {
    if (!playerAlive || distToPlayer > SHOOT_RANGE * 1.3) {
      bot.state = 'chase'
      return
    }
    // Strafe around the player
    bot.strafeTimer += dt
    if (bot.strafeTimer > 1.5) {
      bot.strafeDir *= -1
      bot.strafeTimer = 0
    }
    strafe(bot, playerPos, dt, resolveCollision)

    // Fire at player
    if (time - bot.lastShotTime > SHOOT_INTERVAL) {
      bot.lastShotTime = time
      // Simple hit chance based on distance (closer = more likely hit)
      const hitChance = Math.max(0.15, 1 - distToPlayer / SHOOT_RANGE)
      if (Math.random() < hitChance) {
        onHitPlayer(BOT_DAMAGE)
      }
    }
  }
}

function wander(bot: BotState, dt: number, resolveCollision: (p: THREE.Vector3, r: number, h: number) => THREE.Vector3) {
  // Move in current direction; occasionally change
  if (bot.velocity.lengthSq() < 0.1 || Math.random() < 0.005) {
    const angle = Math.random() * Math.PI * 2
    bot.velocity.set(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(BOT_SPEED)
  }
  const nx = bot.velocity.x * dt
  const nz = bot.velocity.z * dt
  bot.position.x += nx
  bot.position.z += nz
  bot.position.y = 0
  // Bounce off walls
  const b = MAP_SIZE - 2
  if (Math.abs(bot.position.x) > b || Math.abs(bot.position.z) > b) {
    bot.velocity.multiplyScalar(-1)
  }
  bot.position = resolveCollision(bot.position, 0.7, 2)
}

function moveToward(bot: BotState, target: THREE.Vector3, speed: number, dt: number, resolveCollision: (p: THREE.Vector3, r: number, h: number) => THREE.Vector3) {
  const dir = new THREE.Vector3().subVectors(target, bot.position)
  dir.y = 0
  dir.normalize()
  bot.position.x += dir.x * speed * dt
  bot.position.z += dir.z * speed * dt
  bot.position.y = 0
  bot.position = resolveCollision(bot.position, 0.7, 2)
}

function strafe(bot: BotState, target: THREE.Vector3, dt: number, resolveCollision: (p: THREE.Vector3, r: number, h: number) => THREE.Vector3) {
  const dir = new THREE.Vector3().subVectors(target, bot.position)
  dir.y = 0
  dir.normalize()
  const right = new THREE.Vector3(dir.z, 0, -dir.x)
  bot.position.add(right.multiplyScalar(bot.strafeDir * BOT_SPEED * 0.7 * dt))
  bot.position.y = 0
  bot.position = resolveCollision(bot.position, 0.7, 2)
}