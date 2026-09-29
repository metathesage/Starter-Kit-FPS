import * as THREE from 'three'

export interface PlayerState {
  position: THREE.Vector3
  velocity: THREE.Vector3
  yaw: number
  pitch: number
  health: number
  maxHealth: number
  ammo: number
  maxAmmo: number
  score: number
  alive: boolean
  weaponCooldown: number
  reloading: boolean
  onGround: boolean
}

export interface BotState {
  id: number
  position: THREE.Vector3
  velocity: THREE.Vector3
  health: number
  maxHealth: number
  alive: boolean
  respawnTimer: number
  state: 'patrol' | 'chase' | 'shoot'
  strafeDir: number
  strafeTimer: number
  lastShotTime: number
  color: string
}