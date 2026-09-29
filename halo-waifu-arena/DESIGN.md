# WAIFU ARENA — Haven

A Halo-flavoured arena shooter in the browser. Waifu Spartans fight over the Haven map.

## Measured facts about the assets (not guesses — read off the files)

### `Maps/halo_4multiplayerdefaulthaven.glb` (20.46 MB)
- 244,780 triangles, 21 meshes, 20 materials, 31 embedded textures.
- Source is **Z-up** (dominant surface normals are ±Z). Root node carries a 180° yaw.
- Bounds `X[-289, 289] Y[-694, 1574] Z[-125, 18]` — 578 × 2268 × 143 units.
- Playable core is a mirrored arena ~456 × 948 units, with 3 floor tiers (Z ≈ −28, −31/−34, −37/−39).
- Largest floor plate: 521 cells, 274-unit radius, centred at `(-6, 76, -44)`. That is the KOTH site.
- **Scale: 1 unit = 10 cm.** Core arena ≈ 45 m × 95 m, 14 m of vertical range, tiers ≈ 0.6 m apart
  (correct step height). Player eye height 1.6 m = 16 units.

### Characters
All rigged characters share **one Mixamo-named humanoid skeleton** (21–23 joints):

```
Hips Spine Chest [UpperChest] Neck Head
LeftUpLeg LeftLeg LeftFoot LeftToeBase      Right…
LeftShoulder LeftArm LeftForeArm LeftHand   Right…
```

### `assets/Animations/Mesh2Motion/GLB/human-base-animations.glb` (2.37 MB, 87 clips)
CC0, 66-joint **UE-mannequin** skeleton (`pelvis`, `spine_01`, `thigh_l`, `ball_l`, …).

**The rigs and the animations use different bone names.** Retargeting is mandatory — see
`src/chars/retarget.js`. Required clips all exist: `Pistol_Idle / Pistol_Aim_Up / Aim_Down /
Aim_Neutral / Pistol_Shoot / Pistol_Reload`, `Walk / Jog / Sprint / Crouch_Idle / Crouch_Walk`,
`Jump_Start / Jump_air / Jump_Land`, `Slide / Slide_Start / Slide_Exit`, `Hit_Chest / Hit_Head /
Hit_Knockback`, `Death_D`, `Roll`.

Rejected: `elaina_…` (125 meshes / 908 joints), `mint_swimsuit…` (611 joints),
`Kasumi_Tactical_Sailor_AAA_100k.glb`, NIKKE & bunny-girl rigs (63–112 MB), all
`vex-mythoclast*.STL`, and the 2 GB `character design/` source.

## Game feel spec

"Crisp like Halo / Destiny / Call of Duty" is a set of concrete, testable commitments.

### 1. Input latency — the single most important thing
- Mouse look uses **raw `movementX/Y` deltas accumulated between frames**, no smoothing,
  no acceleration curve, no clamping. Read in the frame, applied in the same sim tick.
- Simulation runs at a **fixed 120 Hz**; rendering interpolates. Frame time spikes never
  change physics.
- Zero hidden delays: no "aim smoothing", no input queues, no waits.

### 2. Movement (Quake-lineage, the Halo feel)
- Ground: `accelerate()` toward a wish velocity (Quake accel, not lerp-to-target), so
  strafing keeps momentum exactly like Halo's WASD strafe.
- Separate ground/air accel; air accel ≈ 12 % of ground.
- Friction with a hard stop threshold (no ice-skating).
- `coyoteTime` 110 ms, `jumpBuffer` 130 ms, so jumps always register.
- Crouch with smoothed height lerp; sprint with FOV push; slide on crouch-while-sprinting.

### 3. Weapons
- Hitscan raycast against character hitboxes, not meshes.
- Recoil is **two separate systems**: camera kick (view moves) and viewmodel kick (gun moves).
  Different curves, different springs. This is what separates good from mushy.
- Recoil patterns are deterministic and learnable, not random.
- Spread is a live HUD value; it grows with movement/airs and shrinks when aiming.
- ADS lerps FOV and spread; gun model moves to an iron-sight pose.

### 4. Feedback (hit confirmation is what shooters live on)
- Hitmarker on hit, red + louder on kill, distinct sound per.
- Damage numbers, directional damage indicators, hit flash on the victim.
- Trauma-based camera shake, hit-stop on kills only.
- Impact: decal + spark burst + surface-typed sound; tracers for every shot.

### 5. Audio
- Web Audio, one shared graph, gun sounds are layered (transient + body + tail).
- Positional (PannerNode) for world sounds, no clipping, gain ramps on pause.

## Modes
- **King of the Hill** — 100 points, the arena is the objective, built around the 274-unit plate.
- **Slayer** — first team to 50.

## Architecture
```
tools/build-map.mjs   offline: GLB -> collision BVH + nav grid + spawns/KOTH/cover
src/core/     loop, input, rng, math
src/world/    map, collision (BVH+capsule), nav (A*)
src/player/   controller, weapons, viewmodel
src/chars/    retarget (Mixamo<-UE), actor, rig
src/ai/       bot, aim
src/fx/       camera, vfx, audio
src/ui/       hud
```
