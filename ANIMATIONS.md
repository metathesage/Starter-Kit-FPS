# Character Animation Setup

## What was done automatically (run of `Tools > Character Anim > Setup Everything`)

1. **Characters converted GLB -> FBX source** — the native FBX was extracted from the
   original zips (no lossy re-export):
   - `Assets/Characters/Miyazawa/chr100_000_00.fbx` (from `miyazawa-blank-city/source/chr100_000_00.zip`)
   - `Assets/Characters/MaiMaid/PL002_000.fbx` (from `mai-maid-bourin/source/PL002_000.zip`)
2. **Both rigs imported as Humanoid** (auto muscle-mapping — verified `avatar.isHuman == true`).
   That means the entire Universal Animation Library retargets onto them for free.
3. **Animation library installed**: `Assets/Animations/UniversalAnimationLibrary/UAL1_Standard.fbx`
   + `UAL2_Standard.fbx` (Unity FBX versions, also imported as Humanoid).
   86 source clips total: idle/walk/jog/sprint/crouch/jump/slide/roll, pistol
   aim+shoot+reload, sword/shield/spell/punch, swim, climb, farm, zombie,
   death/hit, dance + yes/no emotes...
4. **Shared controller** `Assets/Animations/Controllers/CharacterAnim.controller`:
   - Base layer: Speed blend Idle->Walk->Jog->Sprint, Crouch idle/move,
     Jump chain, Slide chain, Death.
   - "Weapon Aim" layer (upper-body mask): Pistol aim blend (-1..1), Shoot and
     Reload one-shots.
   - "Emote" layer: Dance loop (weight toggled at runtime).
5. **Ready prefabs** (drag into any scene, they just work):
   - `Assets/Characters/Miyazawa/Miyazawa_AnimReady.prefab`
   - `Assets/Characters/MaiMaid/MaiMaid_AnimReady.prefab`
6. **Demo scene**: `Assets/Scenes/AnimDemo.unity`

## Demo controls
| Input | Action |
|---|---|
| WASD | move (walk speed) |
| Shift | sprint |
| C | crouch |
| Space | jump |
| Ctrl | slide |
| Left mouse | shoot |
| R | reload |
| E | dance toggle (emote) |
| Y | toggle gun visibility (unarmed) |
| Right mouse drag | orbit camera / aim pitch |

## Runtime API
- `CharacterAnimDriver` — `SetSpeed(mps)`, `SetGrounded`, `SetCrouch`, `SetAimPitch(-1..1)`,
  `Jump()`, `Slide()`, `Shoot()`, `Reload()`, `Dance(bool)`, `Die()`, `isArmed`.
- `WeaponSocket` — attaches any gun Transform to the avatar's right hand
  (`WeaponSocket.Attach(gun)` or set the slot field). Tune `positionOffset` /
  `rotationOffsetEuler` per weapon.

## Caveats / manual follow-ups
- **Materials pink?** The dump FBXs use game shaders. If textures don't auto-bind,
  create Standard-material copies per part and drag the PNGs (sitting next to the
  FBXs onto them.
- Characters were auto-rescaled to 1.75 m (dump FBXs came in at 0.01x).
- One pre-existing script `Assets/Assets/Editor/SceneBuilder.cs` referenced
  `NavMeshSurface` (AI Navigation package not installed) and broke compilation;
  renamed to `SceneBuilder.cs.broken-nomeshnav`. Restore it after installing
  `com.unity.ai.navigation`, or delete it.
- Speed thresholds (Idle 0 / Walk @1.5 / Jog 3.2 / Sprint 5.5) assume ~real m/s —
  the demo mover matches. Retune blend tree thresholds or your locomotion speeds
  if they diverge.
- Extra library clips never in the controller can be dropped in manually (e.g.
  sword combo, swim) — all 86 are retarget-ready sub-assets of the UAL FBXs.





## Motion verification (headless)
Run `Tools/Character Anim/Verify Motion` or:
```
Unity -batchmode -executeMethod CharacterAnimVerify.VerifyAll
```
It drives every state (walk/jog/sprint/crouch/shoot/reload/slide/dance/jump) on both
prefabs via Animator.Update() and measures LOCAL BONE ROTATION (>15 deg accumulated).
Current status: 18/18 PASS (see Logs/anim_verify.log).

Notes:
- Animator culling is forced to AlwaysAnimate (prefab + CharacterAnimDriver.Awake);
  the default CullUpdateTransforms silently freezes bones when no camera sees the mesh.
- Unity 6 cannot create serializable BlendTrees from script, so speed/aim blending
  uses threshold-gated states (Idle/Walk/Jog/Sprint, AimIdle/AimUp/AimDn) instead.
- Root-motion curves from the UE-sourced library were cm-scale and are divided by 100
  when cloning clips (ScaleRootMotion).

## Roster (auto-rig + auto-animate pipeline)

### Humanoid (shared 32-state controller: 9 core + 23 mocap X_*)
Full-auto rigged from FBX: Miyazawa, MaiMaid, Elaina, WuwaLucy, PsxDoctor, Swat, Kasumi,
SciFiWaifu, Gekkou, Kurenai, Shogun, Samidale, Drizzle, Kasa.
GLB -> FBX (Blender, External/tools/glb2fbx.py) then rigged: Swat/Kasumi/SciFiWaifu (J_Bip
UE names auto-renamed to Unity standard by the converter).
User-provided Mesh2Motion-app rigged FBX, re-exported through Blender to normalize transforms:
LucyED, Pomni, Kagome (their raw M2M exports gave "Avatar creation failed" in Unity;
the Blender round-trip fixed it).

### Generic creatures (own baked clips, one state per animation - QuadAnimIntegrator.cs)
From GLBs shipped with their own animation actions, exported with --with-anims:
Quad_Fox (14: Bark/Bite/Death/Fall/Fetch/Howl/...), Quad_TRex (10: Attack/Death/Hit/Idle/Roar/...),
Quad_Dragon (5: Fly_Flap/Fly_Glide/Idle/Rest_Pose/Walk), Quad_Eagle (5: Flap/Glide/Idle/Rest_Pose/Walk).
Verification has a generic branch (accumulated local rotation across skeleton).

### Unriggable (scanned, no armature in file)
Pomni C2.glb, bunny_girl_dark, venus_goddess, chicken_gun, kagome.glb/wraith/the_lament/
reaper/ghost/ninja/archer/angel (spooky-waifu static meshes), bone_seraph_skeletal_angel,
grim_reaper_-_glowing_rune_scythe, girl_/zexy girl, android_18/hinata bikini, angle_fantasy_ai,
jemadia, chaperone, alice_-_nikke + Citlali (obfuscated bone names), lucy_edgerunner.glb static.
Fix = external auto-rigger (Mesh2Motion app / Mixamo), then they enter the roster like the
other _rigged files.

## Mesh2Motion integration
- Source: github.com/Mesh2Motion (MIT app, CC0 animations). Downloaded CMU mocap FBX set
  (7 clips, subject 91: locomotion variants) into Assets/Animations/Mesh2Motion/CMU.
- Mesh2MotionIntegrator.cs imports them as Humanoid, converts to retargetable muscle clips in
  Assets/Animations/Mesh2MotionClips, and adds controller states named X_<clip> on the base layer.
- Recursive scan: Assets/Animations/Mesh2Motion/CMU/swat/*.fbx adds 16 named emotes/actions
  (Angry, Backflip, Chop_Tree, Climb_Ladder, ...) exported from swat.glb actions via
  glb2fbx.py --split-actions --limit; subfolder name namespaces them (X_swat_<name>).
  swat.glb actually holds 178 actions - export more by raising --limit.
- Play from code: driver.PlayState("X_swat_Backflip"); latest full run: 577/578 PASS
  (the 1 "fail" is Quad_TRex Rest_Pose, a static pose with nothing to move).
- Menu: Tools > Character Anim > Integrate Mesh2Motion Mocap (also part of Setup Everything).

## GLB pipeline (unlocked)
- Blender 5.2 headless (C:\blender.exe) + External/tools/glb2fbx.py converts GLB -> FBX.
  Bone renamer maps UE Mannequin (J_Bip_*, upperarm_l/pelvis...) and VRM names to Unity
  standard so Unity auto-rigs. Modes: default model, --split-actions (one FBX per action,
  --limit N), --with-anims (all actions baked into one Generic FBX, used for creatures).
- External/tools/scan_glbs.py batch-scans any GLB list and reports armature/bone counts/
  names - run it first to classify a model drop before converting.
- Assets/Scenes/AnimDemo.unity shows all 21 animated prefabs (17 humanoid + 4 creatures).

## Guns & skins
- 16 gun/blade FBXs converted into Assets/Weapons (+10 spooky guns, Destiny replicas, ufo etc).
- Attachment needs NO animation work: GunAttacher (hand socket via WeaponSocket) parents any
  gun prefab to the RightHand bone; Shoot/Aim/Reload clips already animate the hand, so every
  gun auto-inherits all animations. `attacher.Equip(prefab)` at runtime; attacher.Muzzle for VFX.
- Skins: External/tools/gen_gun_skins.py hue-shifts the gun's own pixels in Blender and exports
  one FBX per skin (mac10 + tsuki_carbine got 4 each under Assets/Weapons/skins/).
  GunSkinSwapper.cs cycles skins at runtime (G key in demo scene on Miyazawa, who holds a mac10).
  More skins: `blender --background --python gen_gun_skins.py -- <gun.glb> <outdir> 60 140 220 300`.
- Sofia onboarded (66-bone rig): 178-clip mocap library in CMU/sofia -> 201 X_* states total;
  verify uses `-mocapEvery N` extra arg to sample them (default 1).

## Avatar-cache hazard (fixed)
A batch crashing mid-import can poison Unity's avatar cache: avatar reports isHuman=True but
retargeted animation silently writes nothing (localRotAccum ~0). SetupAll now regenerates every
avatar via Generic->Human toggle each run; MiyazawaProbe.cs exists for one-off diagnosis.

