import * as THREE from 'three'

// Pit-style arena: a large central combat area with raised walkways,
// ramps, pillars, and a Forerunner-ish sci-fi look built from colored
// primitives. All geometry is static and used for both rendering and
// collision (via a list of AABBs / boxes).

export interface Collider {
  box: THREE.Box3
  // center of box, used for collision resolution
  center: THREE.Vector3
}

export const MAP_SIZE = 60 // arena half-extent
export const FLOOR_Y = 0
export const WALL_HEIGHT = 8
export const WALL_THICKNESS = 2

const colliders: Collider[] = []

function addBox(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): THREE.Box3 {
  const box = new THREE.Box3(
    new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
    new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2),
  )
  colliders.push({ box, center: new THREE.Vector3(cx, cy, cz) })
  return box
}

export function buildMap() {
  const group = new THREE.Group()

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a3440, roughness: 0.85, metalness: 0.2 })
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a5a6a, roughness: 0.7, metalness: 0.35 })
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x39c5ff, roughness: 0.4, metalness: 0.6, emissive: 0x0a2030, emissiveIntensity: 0.4 })
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x5a6b7c, roughness: 0.6, metalness: 0.45 })
  const rampMat = new THREE.MeshStandardMaterial({ color: 0x3a4655, roughness: 0.8, metalness: 0.25 })

  // Floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(MAP_SIZE * 2, 1, MAP_SIZE * 2), floorMat)
  floor.position.set(0, FLOOR_Y - 0.5, 0)
  floor.receiveShadow = true
  group.add(floor)

  // Outer walls
  const half = MAP_SIZE
  const wallSpecs = [
    { pos: [0, WALL_HEIGHT / 2, -half], scale: [half * 2 + WALL_THICKNESS * 2, WALL_HEIGHT, WALL_THICKNESS] },
    { pos: [0, WALL_HEIGHT / 2, half], scale: [half * 2 + WALL_THICKNESS * 2, WALL_HEIGHT, WALL_THICKNESS] },
    { pos: [-half, WALL_HEIGHT / 2, 0], scale: [WALL_THICKNESS, WALL_HEIGHT, half * 2] },
    { pos: [half, WALL_HEIGHT / 2, 0], scale: [WALL_THICKNESS, WALL_HEIGHT, half * 2] },
  ]
  for (const w of wallSpecs) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.scale[0], w.scale[1], w.scale[2]), wallMat)
    mesh.position.set(w.pos[0], w.pos[1], w.pos[2])
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    addBox(w.pos[0], w.pos[1], w.pos[2], w.scale[0], w.scale[1], w.scale[2])
  }

  // Central elevated platform with ramps (the "pit" center)
  const platSize = 16
  const platH = 3
  const platform = new THREE.Mesh(new THREE.BoxGeometry(platSize, platH, platSize), pillarMat)
  platform.position.set(0, platH / 2, 0)
  platform.castShadow = true
  platform.receiveShadow = true
  group.add(platform)
  addBox(0, platH / 2, 0, platSize, platH, platSize)

  // Ramps up to platform (4 sides)
  const rampW = 4
  const rampLen = 10
  const rampH = platH
  const rampSpecs = [
    { pos: [0, 0, -platSize / 2 - rampLen / 2], rot: 0 }, // north ramp
    { pos: [0, 0, platSize / 2 + rampLen / 2], rot: Math.PI },
    { pos: [-platSize / 2 - rampLen / 2, 0, 0], rot: Math.PI / 2 },
    { pos: [platSize / 2 + rampLen / 2, 0, 0], rot: -Math.PI / 2 },
  ]
  for (const r of rampSpecs) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampW, rampH, rampLen), rampMat)
    ramp.position.set(r.pos[0], rampH / 2, r.pos[2])
    ramp.rotation.y = r.rot
    // Pitch the ramp to connect floor to platform
    const angle = Math.atan2(rampH, rampLen)
    ramp.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), -angle * Math.sign(Math.cos(r.rot) || 1))
    // Simpler: skip precise ramp collision, approximate as boxes for now.
    ramp.castShadow = true
    ramp.receiveShadow = true
    group.add(ramp)
    // Approximate ramp as a sloped collision box (bounding box)
    const bx = new THREE.Box3().setFromObject(ramp)
    const bcenter = new THREE.Vector3()
    bx.getCenter(bcenter)
    const bsize = new THREE.Vector3()
    bx.getSize(bsize)
    addBox(bcenter.x, bcenter.y, bcenter.z, bsize.x, bsize.y, bsize.z)
  }

  // Scattered pillars/crates for cover
  const coverSpots = [
    [-18, 0, -14], [14, 0, -22], [22, 0, 12], [-22, 0, 18],
    [10, 0, 10], [-12, 0, 12], [16, 0, -12], [-18, 0, 6],
  ]
  for (const [cx, , cz] of coverSpots) {
    const h = 3 + Math.random() * 2
    const w = 2 + Math.random() * 2
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), pillarMat)
    pillar.position.set(cx, h / 2, cz)
    pillar.castShadow = true
    pillar.receiveShadow = true
    group.add(pillar)
    addBox(cx, h / 2, cz, w, h, w)
  }

  // Glowing trim lines along floors for sci-fi feel
  const trimGeo = new THREE.BoxGeometry(0.2, 0.1, 0.2)
  const trims = new THREE.InstancedMesh(trimGeo, trimMat, 64)
  const dummy = new THREE.Object3D()
  let idx = 0
  for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * Math.PI * 2
    const r = half - 1
    dummy.position.set(Math.cos(angle) * r, 0.06, Math.sin(angle) * r)
    dummy.updateMatrix()
    trims.setMatrixAt(idx++, dummy.matrix)
  }
  group.add(trims)

  return { group, colliders }
}

export function getColliders(): Collider[] {
  return colliders
}

// Resolve a moving AABB (player/bot) against static colliders.
export function resolveCollision(
  position: THREE.Vector3,
  radius: number,
  _height?: number,
): THREE.Vector3 {
  const out = position.clone()

  for (const c of colliders) {
    const box = c.box
    // Find closest point on box to player center
    const px = THREE.MathUtils.clamp(out.x, box.min.x, box.max.x)
    const py = THREE.MathUtils.clamp(out.y, box.min.y, box.max.y)
    const pz = THREE.MathUtils.clamp(out.z, box.min.z, box.max.z)

    const dx = out.x - px
    const dy = out.y - py
    const dz = out.z - pz
    const distSq = dx * dx + dy * dy + dz * dz

    // Feet-level collision (ignore walls above head if jumping)
    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq) || 0.0001
      const nx = dx / dist
      const ny = dy / dist
      const nz = dz / dist
      const push = radius - dist
      out.x += nx * push
      out.z += nz * push
      // Only push vertically if collision is at feet level
      if (Math.abs(ny) > 0.1 && out.y < box.max.y) {
        out.y += ny * push
      }
    }
  }

  // Clamp to arena bounds
  const bound = MAP_SIZE - 1
  out.x = THREE.MathUtils.clamp(out.x, -bound, bound)
  out.z = THREE.MathUtils.clamp(out.z, -bound, bound)

  return out
}