# NU LIGHT dev notes

How the game is built, how to add things, what bit us. Keep this current; if you fix a nasty bug, add it to Gotchas.

## Run it
```
cd lockout && python3 -m http.server 8123   # then open http://localhost:8123/?fast
```
No build step. Three.js r186 is vendored in `vendor/`. URL flags: `?fast` skip splash waits, `?quick` start a match, `?bot` AI plays for you, `?map=lockout|cryostat|mesa|overgrowth|warsat|sanctum`, `?mode=slayer|rumble|hunt|ctf|oddball`, `?fps` frame counter.

## Map of the code (`js/`)
| File | Job |
|---|---|
| `main.js` | boot, screen flow, loop, camera, settings, menu stage, results, save screens |
| `match.js` | Actor and Match: movement, weapons, perks, damage, kills, medals, pickups, snapshots. Factions (`factionFor`), Destiny kit (`abilities`, double jump) and Spartan kit (`spartanKit`, `doDash`, armor lock/jetpack/drop shield) live here |
| `replay.js` | `Recorder` (30 Hz pose ring buffer, shots, booms, kill scoring, clips) and `ReplayPlayer` (ghost rigs, killer-POV and chase cameras). `main.js` drives killcam and the top-kill cinematic |
| `modes.js` | mode rules (slayer, rumble, hunt, ctf, oddball) and objective HUD data |
| `bots.js` | nav-graph AI, weapon scoring, aim and strafing |
| `world.js` | map definitions, solids and collision (`groundAt`, `rayWorld`), visuals per map, `MAP_LIST` |
| `hubmap.js`, `hubdeco.js`, `hub.js` | Sanctum: collision and POIs, visuals, controller |
| `mapkit.js` | bevelled geometry with baked AO, procedural textures, foliage, trees |
| `rig.js` | procedural rig: joints, animation, IK, operator and bot rosters (`WAIFUS`, `BOT_STYLES`) |
| `angel.js` | operator models: load, skin at load from joint landmarks, palette variants, rim light |
| `weapons.js` | weapon definitions, loader (glb plus base64 fallback), toon look, pickups |
| `fps.js` | first-person viewmodel |
| `hud.js` | HUD: shield, ammo, radar, feed, medals, scopes, announcements |
| `post.js` | HDR bloom chain, FXAA, grade, vignette, fringe, `kick()` for hits |
| `toon.js` | cel shading (two gradients), ink hulls that widen with distance |
| `space.js` | menu stage: planet, Milky Way, moon, Halo ring, deco platform |
| `audio.js` | all synthesis (guns, UI palette, ambience), narrator VO player, music player |
| `ui.js`, `icons.js` | menu navigation, controller focus, icon injection by label |
| `profile.js`, `catalog.js`, `challenges.js`, `armory.js`, `missions.js` | progression, unlocks, saves, armory screens |
| `wow.js` | intro card, exotic flash, confetti, level-up card |
| `patchnotes.js` | release notes (source for the Patch Notes screen and `docs/PATCH_NOTES.md`) |
| `net.js` | PeerJS host and join |

CSS: `css/style.css` is the original noir base; `css/premium.css` layers everything after it (glass, deco, motion, results, scopes). Later rules win.

## Pipelines (Blender is `pip install bpy==4.2.0`, headless, works in the sandbox)
All scripts live in `tools/blender/` and run as `python3 script.py -- args`.

**Weapons from downloaded models**
1. `inspect_glb.py -- in.glb` for tris, size, skeleton, materials.
2. `sheet_glb.py -- out.png a.glb b.glb` contact sheet (red ball marks +Y).
3. `conform.py -- in.glb out.glb MUZZLE(+X|-X|+Y|-Y) [tris] [tex] [delete,names]` rotates the muzzle to +Y, joins, decimates, shrinks textures.
4. Drop `out.glb` in `models/weapons/`, add an entry to `manifest.json` (`gripFromStock`, `gripHeight`, `length`, `glow`), add the weapon to `WEAPONS`, `EXOTICS` if exotic, `ICONS`, bots (`RANGE`, `score`), catalog blurb, hub plinth in `hubmap.js`.
5. Thumbnail: a tiny page that renders `makeWeaponMesh(id)` orthographically from +X, crop, save `models/weapons/thumb/id.webp` (used by HUD silhouettes and the Armory).
6. Publishing to a text-only host: `base64 -w0 x.glb > x.b64.txt` next to it; loaders fall back automatically.

**Operators (characters)**
1. `sheet_char.py` to preview front and side.
2. `prep_char.py -- in out.glb [tris] [tex]` joins meshes, recalculates normals (mirrored FBX transforms flip winding, which turns the ink hull into a black silhouette), normalises to height 1, feet at y=-0.5, faces glTF +Z.
3. UDIM sources: `prep_udim.py` packs tiles 1001.. into a 5x2 atlas and remaps UVs.
4. Add to `OPERATOR_MODELS` in `angel.js` with joint landmarks (measure them from a front render: shoulder, elbow, wrist, hip, knee, ankle, head), then to `WAIFUS` with `model` and `look: { hue, sat, val }`.
5. Skinning is distance-to-bone-segment at load (no authored weights). T-pose or A-pose both work; the arm rest quaternion is derived from the shoulder to wrist direction.

**Statues**: `guardians.py` builds the four marble guardian statues; `exotics.py` and `br.py` are the original Blender-built weapons; `kit.py` is the hard-surface kit.

**Narrator VO**: `tools/vo/gen_vo.py model.onnx audio/vo` (Piper voice plus effect chain, mp3 via imageio-ffmpeg). Add a line to the `L` dict; the key is the uppercased announce text.

**Music**: tracks in `audio/music/`, mapped in `TRACKS` in `audio.js`; credit in `CREDITS.txt`. Procedural music is the fallback.

**Patch notes**: edit `js/patchnotes.js`, run `node tools/gen-notes.mjs`.

## Adding things
- **Map**: `defineX()` in `world.js` (solids, spawns, pickups, nav), a visuals builder, entries in `MAP_LIST`, `GRADE`, `EXPOSURE`, `MENU` in `main.js`, a beauty shot in `img/maps/`.
- **Mode**: entry in `MODES`, rules in `modes.js`, HUD blocks in `modes.js` objective data.
- **Badge or emblem**: glyph path in `catalog.js` `GLYPH`, then `BADGES`/`EMBLEMS`.
- **UI sound**: add a function to `S` in `audio.js` using `wet(o)` plus `fm`, `bell`, `air`, `sub`, `pad`; call `Sound.play('name')`.
- **Icon**: path in `icons.js` `P`, label rule in `RULES`.

## Testing without a GPU
Playwright plus Chromium with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`. Keep the viewport small (about 1000x560); first frames after a map load can be black while shaders compile. `window.__game` exposes `state`, `match`, `ensureMap`, `render`, `camera`, `world`. Useful scripts live in the session scratchpad; recreate them from this description: start a match with `?quick&fast&bot`, wait for `__game.match.state === 'live'`, screenshot.

## Publishing the artifact
The host rejects `.glb`, so every model ships as `.b64.txt` and the loaders retry with it. Pass `root` (the `lockout` folder) plus a `files` map. Limits: 511 files and 256 MB per version. Only changed files need resending. Files I replaced deliberately need `overwrite_unread`.

## Gotchas (learned the hard way)
- **PMREM far plane**: `pm.fromScene(sky, 0.03, 0.1, 1000)`; the default far of 100 clips a r=320 sky sphere and turns metals black.
- **Merged vertex colours**: `merge.js` must give every bucket a colour attribute if any bucket has one, or plain meshes render black.
- **Blender `matrix_world` is stale** inside a script after `transform_apply`; transform mesh data directly (`me.transform(Matrix)`).
- **FBX with negative scale** flips winding; recalc normals or the toon ink hull covers the body.
- **UDIM**: FBX materials use one tile per material; remap `u` into a grid atlas, do not rely on the exporter.
- **`node --check` does not catch** a `const` shadowing a function parameter; run the game.
- **Never `pkill -f` a pattern that is in your own command line**; it kills the shell.
- **Skinned outlines**: the hull must share the skeleton (`outlineSkinned`); outline width scales with camera distance or it aliases into dots.
- **Menu stage exposure**: `main.js` lowers exposure in space and restores the map value every non-space frame.
- **Sound**: nothing plays until a user gesture; the narrator (`Sound.vo`) skips a non-scene line while another is playing.

## Save format
`localStorage lockout.profile` (key kept for compatibility, version 2): player id, callsign, xp, level, credits, owned, equipped cosmetics, `stats`, `wk` per-weapon kills, `maps` and `modes` books, `hist` last 30 matches, medals, badges, `skills` and `look` reserved. Backup codes start `NEWLIGHT2.` (old `LOCKOUT2.` still imports).

## Credits and licences
See `audio/music/CREDITS.txt`. Drive-supplied models are the owner's files; keep their source and licence next to them before any public release.

## COST WARNING: fix cache reads or move to a cheaper working system (ASAP)

Measured from the build session log (2026-09-29 to 2026-09-30, see the build ledger artifact):

| Measure | Value |
|---|---|
| Model steps | 1,437 |
| Average context re-read per step | about 435K tokens (peak about 785K) |
| List-price cost of the session | about $166 |
| Share that is cache reads | about 75% ($124) |
| Share that is new code and text (output) | about 13% ($21) |

The bill is not the code being written. It is the whole project being re-read on every single step. Cost is roughly (number of steps) x (context size), so a big context times a long back-and-forth is what hurts. This is not sustainable for a long roadmap (12 planned items is roughly $30 to $100 each range at current habits).

**Decision needed: either shrink the context per step, or change the working system. Do this before starting the next big roadmap item.**

Things to try, cheapest first:
1. **Short sessions, one topic each.** Start a fresh session per roadmap item. Use `HALO.md`, `docs/DEV_NOTES.md` and `docs/PATCH_NOTES.md` as the memory instead of a 400K-token history. Biggest single lever.
2. **Batch asks.** One message with five related changes costs far less than five messages, because each step re-reads everything.
3. **Stop giant reads.** `js/main.js`, `js/match.js`, `css/premium.css`, `js/world.js` are large. Read ranges, grep first, never dump whole files or screenshots into context. Keep test output short (tail it).
4. **Split the big files** into modules (main.js into screens, input, net, replay glue; premium.css into per-screen files) so a change only pulls the part it touches.
5. **Cheaper model for grunt work** (asset conversion scripts, docs, patch notes, mechanical edits) and keep the strongest model for design and hard bugs. Lower effort for routine edits.
6. **Automate what never needs a model:** the scripted tests already in the scratchpad (raycast audit, climb audit, stress walk, screenshot rigs) should live in `tools/test/` and run from one command, so verification does not cost model steps.
7. **Keep the prompt cache warm.** Do not reorder early context or restart mid-task; cache writes are paid again when the prefix changes.
8. **If it still costs too much:** move heavy generation (assets, docs, repetitive refactors) to scripts or a smaller model, and use the big model only for review and design. Consider a hard per-item budget (for example 15 requests or $40) and stop at the limit.

Track it: rerun the ledger after each roadmap item and compare cost per item against this baseline (typical request about $2.70, average about $4.40, roughly 17 active minutes each).
