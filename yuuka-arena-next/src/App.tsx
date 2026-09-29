import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { InputManager } from './game/input'
import { buildMap, resolveCollision } from './game/map'
import { createBot, updateBot } from './game/bots'
import type { PlayerState, BotState } from './game/types'

// ─── Constants ────────────────────────────────────────────────────────────
const PLAYER_HEALTH = 100
const PLAYER_AMMO = 30
const WEAPON_DAMAGE = 25
const WEAPON_RANGE = 80
const FIRE_INTERVAL = 0.18
const RELOAD_TIME = 1.4
const MOVE_SPEED = 12
const JUMP_SPEED = 8
const GRAVITY = 24
const MOUSE_SENSITIVITY = 0.0022
const BOT_COUNT = 7

// ─── Player controller component ──────────────────────────────────────────
function Player({ input, playerRef, botsRef, onShoot }: {
  input: InputManager
  playerRef: React.MutableRefObject<PlayerState>
  botsRef: React.MutableRefObject<BotState[]>
  onShoot: (hit: boolean, id?: number) => void
}) {
  const { camera } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const p = playerRef.current

    if (!p.alive) return

    // Mouse look
    const { dx, dy } = input.consumeMouse()
    p.yaw -= dx * MOUSE_SENSITIVITY
    p.pitch -= dy * MOUSE_SENSITIVITY
    p.pitch = THREE.MathUtils.clamp(p.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01)

    // Movement (relative to yaw)
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw)
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw)
    const move = new THREE.Vector3()
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) move.add(forward)
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) move.sub(forward)
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) move.add(right)
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) move.sub(right)
    move.y = 0
    if (move.lengthSq() > 0) move.normalize()

    p.velocity.x = move.x * MOVE_SPEED
    p.velocity.z = move.z * MOVE_SPEED

    // Jump
    if ((input.isDown('Space')) && p.onGround) {
      p.velocity.y = JUMP_SPEED
      p.onGround = false
    }

    // Gravity
    p.velocity.y -= GRAVITY * dt

    // Integrate
    p.position.x += p.velocity.x * dt
    p.position.z += p.velocity.z * dt
    p.position.y += p.velocity.y * dt

    // Ground collision
    if (p.position.y <= 1.0) {
      p.position.y = 1.0
      p.velocity.y = 0
      p.onGround = true
    }

    // Collide with static geometry
    p.position.copy(resolveCollision(p.position, 0.6, 1.8))

    // Weapon cooldown & reload
    p.weaponCooldown = Math.max(0, p.weaponCooldown - dt)
    if (p.reloading) {
      p.weaponCooldown = Math.max(0, p.weaponCooldown - dt)
      // (reload handled below via timer)
    }

    // Reload logic
    if (input.isDown('KeyR') && !p.reloading && p.ammo < p.maxAmmo) {
      p.reloading = true
      p.weaponCooldown = RELOAD_TIME
      setTimeout(() => {
        p.ammo = p.maxAmmo
        p.reloading = false
        p.weaponCooldown = 0
      }, RELOAD_TIME * 1000)
    }

    // Shooting
    if (input.mouseDown && p.weaponCooldown <= 0 && !p.reloading && p.ammo > 0) {
      p.weaponCooldown = FIRE_INTERVAL
      p.ammo--
      // Raycast from camera
      const dir = new THREE.Vector3(0, 0, -1)
      dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), p.pitch)
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw)
      raycaster.set(camera.getWorldPosition(new THREE.Vector3()), dir)
      raycaster.far = WEAPON_RANGE

      // Check against bots (approximate bodies as spheres)
      let hitBot = false
      let hitBotId: number | undefined
      for (const bot of botsRef.current) {
        if (!bot.alive) continue
        const botCenter = bot.position.clone()
        botCenter.y += 1.0
        const toBot = new THREE.Vector3().subVectors(botCenter, raycaster.ray.origin)
        const t = toBot.dot(raycaster.ray.direction)
        if (t < 0 || t > WEAPON_RANGE) continue
        const closest = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(t))
        if (closest.distanceTo(botCenter) < 1.2) {
          hitBot = true
          hitBotId = bot.id
          break
        }
      }

      if (hitBot && hitBotId !== undefined) {
        const bot = botsRef.current[hitBotId]
        bot.health -= WEAPON_DAMAGE
        if (bot.health <= 0) {
          bot.alive = false
          bot.respawnTimer = 3
          p.score += 1
        }
        onShoot(true, hitBotId)
      } else {
        onShoot(false)
      }
    }

    // Update camera to player eye
    camera.position.copy(p.position)
    camera.rotation.order = 'YXZ'
    camera.rotation.y = p.yaw
    camera.rotation.x = p.pitch
  })

  return null
}

// ─── Bot meshes ───────────────────────────────────────────────────────────
function BotMeshes({ botsRef, playerRef }: {
  botsRef: React.MutableRefObject<BotState[]>
  playerRef: React.MutableRefObject<PlayerState>
}) {
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const time = performance.now() / 1000
    const resolveC = (p: THREE.Vector3, r: number, h: number) => resolveCollision(p, r, h)
    for (const bot of botsRef.current) {
      updateBot(bot, playerRef.current.position, playerRef.current.alive, dt, time, resolveC, (dmg) => {
        const pl = playerRef.current
        if (pl.alive) {
          pl.health -= dmg
          if (pl.health <= 0) {
            pl.health = 0
            pl.alive = false
          }
        }
      })
    }
  })

  return <group>{
    botsRef.current.map((bot) => (
      <group key={bot.id} position={[bot.position.x, bot.position.y, bot.position.z]}>
        {/* Body */}
        <mesh position={[0, 1.1, 0]} castShadow>
          <boxGeometry args={[0.9, 1.2, 0.6]} />
          <meshStandardMaterial color={bot.alive ? bot.color : '#333333'} roughness={0.6} metalness={0.2} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 1.95, 0]} castShadow>
          <sphereGeometry args={[0.38, 16, 16]} />
          <meshStandardMaterial color={bot.alive ? '#2c3e50' : '#333333'} roughness={0.5} />
        </mesh>
        {/* Gun */}
        <mesh position={[0.35, 1.15, 0.45]} castShadow>
          <boxGeometry args={[0.7, 0.15, 0.15]} />
          <meshStandardMaterial color="#111111" roughness={0.4} metalness={0.6} />
        </mesh>
      </group>
    ))
  }</group>
}

// ─── Scene contents ───────────────────────────────────────────────────────
function SceneContent({ input, playerRef, botsRef, onShoot }: {
  input: InputManager
  playerRef: React.MutableRefObject<PlayerState>
  botsRef: React.MutableRefObject<BotState[]>
  onShoot: (hit: boolean, id?: number) => void
}) {
  const { mapGroup } = useMemo(() => {
    const built = buildMap()
    return { mapGroup: built.group }
  }, [])

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <hemisphereLight intensity={0.6} color="#bfd8ff" groundColor="#1a2030" />
      <directionalLight
        position={[30, 50, 20]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={150}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <primitive object={mapGroup} />
      <Player input={input} playerRef={playerRef} botsRef={botsRef} onShoot={onShoot} />
      <BotMeshes botsRef={botsRef} playerRef={playerRef} />
    </>
  )
}

// ─── Top-level App ────────────────────────────────────────────────────────
export default function Game() {
  const [hud, setHud] = useState({ health: PLAYER_HEALTH, ammo: PLAYER_AMMO, score: 0, dead: false })
  const [locked, setLocked] = useState(false)

  const inputRef = useRef<InputManager | null>(null)
  const playerRef = useRef<PlayerState>({
    position: new THREE.Vector3(0, 1.0, 25),
    velocity: new THREE.Vector3(),
    yaw: Math.PI,
    pitch: 0,
    health: PLAYER_HEALTH,
    maxHealth: PLAYER_HEALTH,
    ammo: PLAYER_AMMO,
    maxAmmo: PLAYER_AMMO,
    score: 0,
    alive: true,
    weaponCooldown: 0,
    reloading: false,
    onGround: true,
  })
  const botsRef = useRef<BotState[]>(
    Array.from({ length: BOT_COUNT }, (_, i) =>
      createBot(i, new THREE.Vector3((i - 3) * 5, 0, -15))
    )
  )
  const canvasContainer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (canvasContainer.current) {
      inputRef.current = new InputManager(canvasContainer.current)
      setLocked(false)
    }
    const hudInterval = setInterval(() => {
      const p = playerRef.current
      setHud({
        health: Math.max(0, Math.round(p.health)),
        ammo: p.ammo,
        score: p.score,
        dead: !p.alive,
      })
    }, 100)
    return () => {
      clearInterval(hudInterval)
      inputRef.current?.dispose()
    }
  }, [])

  const onShoot = useCallback((_hit: boolean, _id?: number) => {
    // hit marker could flash here later
  }, [])

  const respawn = useCallback(() => {
    const p = playerRef.current
    p.health = PLAYER_HEALTH
    p.ammo = PLAYER_AMMO
    p.alive = true
    p.position.set(0, 1.0, 25)
    p.velocity.set(0, 0, 0)
    p.yaw = Math.PI
    p.pitch = 0
  }, [])

  return (
    <div ref={canvasContainer} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        shadows
        camera={{ fov: 75, near: 0.1, far: 200, position: [0, 1.0, 25] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onPointerDown={() => inputRef.current?.requestLock()}
      >
        <color attach="background" args={['#0a0e14']} />
        <fog attach="fog" args={['#0a0e14', 30, 120]} />
        <SceneContent input={inputRef.current!} playerRef={playerRef} botsRef={botsRef} onShoot={onShoot} />
      </Canvas>

      {/* HUD */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '24px', fontFamily: 'system-ui, sans-serif',
      }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '14px', color: '#8aa0b0', letterSpacing: '1px', textTransform: 'uppercase' }}>Health</div>
            <div style={{
              width: '220px', height: '14px', background: '#1a2530', borderRadius: '4px',
              marginTop: '4px', overflow: 'hidden',
            }}>
              <div style={{
                width: `${(hud.health / PLAYER_HEALTH) * 100}%`, height: '100%',
                background: hud.health > 50 ? '#2ecc71' : hud.health > 25 ? '#f1c40f' : '#e74c3c',
                transition: 'width 0.15s', borderRadius: '4px',
              }} />
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#8aa0b0', letterSpacing: '1px', textTransform: 'uppercase' }}>Score</div>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#39c5ff', lineHeight: '1' }}>{hud.score}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', color: '#8aa0b0', letterSpacing: '1px', textTransform: 'uppercase' }}>Ammo</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#e8eef5', lineHeight: '1' }}>{hud.ammo}</div>
          </div>
        </div>

        {/* Crosshair */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <div style={{
            width: '20px', height: '20px', position: 'relative',
          }}>
            <div style={{ position: 'absolute', left: '50%', top: '0', width: '2px', height: '6px', background: '#fff', transform: 'translateX(-50%)' }} />
            <div style={{ position: 'absolute', left: '50%', bottom: '0', width: '2px', height: '6px', background: '#fff', transform: 'translateX(-50%)' }} />
            <div style={{ position: 'absolute', top: '50%', left: '0', width: '6px', height: '2px', background: '#fff', transform: 'translateY(-50%)' }} />
            <div style={{ position: 'absolute', top: '50%', right: '0', width: '6px', height: '2px', background: '#fff', transform: 'translateY(-50%)' }} />
          </div>
        </div>

        {/* Death overlay */}
        {hud.dead && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(10, 30, 50, 0.7)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'auto', gap: '16px',
          }}>
            <div style={{ fontSize: '56px', fontWeight: 'bold', color: '#e74c3c', letterSpacing: '2px' }}>KILLED</div>
            <div style={{ fontSize: '20px', color: '#8aa0b0' }}>Score: {hud.score}</div>
            <button
              onClick={respawn}
              style={{
                pointerEvents: 'auto', padding: '14px 40px', fontSize: '18px', fontWeight: 'bold',
                background: '#39c5ff', color: '#0a0e14', border: 'none', borderRadius: '6px',
                cursor: 'pointer', letterSpacing: '1px',
              }}
            >
              RESPAWN
            </button>
          </div>
        )}

        {/* Controls hint */}
        {!locked && !hud.dead && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)', pointerEvents: 'auto', cursor: 'pointer',
          }}
          onClick={() => inputRef.current?.requestLock()}
          >
            <div style={{ fontSize: '44px', fontWeight: 'bold', color: '#39c5ff', letterSpacing: '2px' }}>YUUKA ARENA</div>
            <div style={{ fontSize: '18px', color: '#8aa0b0', marginTop: '8px' }}>Click to play</div>
            <div style={{ fontSize: '14px', color: '#5a6b7c', marginTop: '24px', lineHeight: '1.8', textAlign: 'center' }}>
              WASD — move&nbsp;&nbsp;·&nbsp;&nbsp;Mouse — aim<br />
              Click — shoot&nbsp;&nbsp;·&nbsp;&nbsp;R — reload&nbsp;&nbsp;·&nbsp;&nbsp;Space — jump
            </div>
          </div>
        )}
      </div>
    </div>
  )
}