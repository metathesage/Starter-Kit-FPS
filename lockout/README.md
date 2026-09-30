# NU LIGHT

(formerly LOCKOUT; the Lockout map keeps its name)

A browser arena shooter built as a tribute to classic console team-slayer on a symmetrical map.
4v4 against bots or friends. Cyber-angel armored operators (halo, wing blades, twin tails), three symmetrical maps, a full sandbox of Halo-style weapons and power-ups. Noir minimal UI.
No install, no build step, no downloaded assets: geometry, textures, audio and music are all generated at runtime.

**Stack:** Three.js r186 (WebGL2, vendored in `vendor/`), ES modules, Web Audio synth.

## Run

```bash
cd lockout
python3 -m http.server 8080      # or: npx serve .
# open http://localhost:8080
```

Must be served over HTTP (ES modules + importmap). Chrome, Edge, Firefox, Safari.

## Controls

| | Keyboard + mouse | Xbox controller |
| --- | --- | --- |
| Move / look | WASD / mouse | LS / RS |
| Fire | LMB | RT |
| Zoom | RMB | RS click |
| Grenade / switch type | G / T | LT / LB |
| Melee | F | B |
| Jump / crouch | Space / C | A / LS click |
| Reload / pick up | R / E | X |
| Swap weapon | Q | Y |
| Scoreboard | Tab | View |
| Chase cam | V | — |
| Pause | Esc | Menu |

Menus are fully navigable by D-pad / stick, A, B. Prompts switch glyphs by last device used.

## Play online with friends (including phones)

Main menu -> **Play Online**.
- **Host a lobby** gives a 5-letter code and a share link. Friends open the link (or type the code) on any device and land in your lobby.
- Up to 3 friends join. They take slots from the bots, on your team or the other team (host setting). The host starts the match.
- The host's browser runs the match (bots, weapons, scoring). Friends send input and render what the host streams, so the host's connection matters most.
- Signaling uses the free public PeerJS cloud (`0.peerjs.com`), then game traffic goes browser to browser over WebRTC.
  Both sides need internet access to that server. Corporate/school networks sometimes block WebRTC.
- Link format: `https://<host>/<path>/?join=CODE`.
- Not available inside the Claude artifact preview (it blocks network access). Use the GitHub Pages build or run locally.

**Phones:** touch controls appear automatically (left thumb stick, drag the right side to aim, buttons for fire, jump,
melee, grenade, reload/pick up, swap, zoom, crouch). Shadows start off and resolution scales down to keep frame rate up.
Landscape works best. The menu asks for fullscreen on tap.

### Deploy (GitHub Pages)

`.github/workflows/lockout-pages.yml` publishes `lockout/` to Pages. In the repo: Settings -> Pages -> Source: **GitHub Actions**.
It runs on pushes to `main` and can be run by hand (Actions -> Deploy NU LIGHT -> Run workflow).
Live URL: `https://<owner>.github.io/<repo>/`.

## Modes

| Mode | Players | Win condition |
| --- | --- | --- |
| Team Slayer | 4 v 4 | Kills score for the team. First to 15 / 25 / 50. |
| Rumble Pit | 8 free-for-all | Most kills. First to 15 / 25 / 40. The kill leader wears a crown and is marked for everyone. |
| Capture the Flag | 4 v 4 | Steal the enemy flag, bring it to your base while yours is home. 3 / 5 / 8 captures. Dropped flags auto-return after 20 s. |
| Warlock Hunt | 4 v 4 | Asymmetric. Warlocks (red) hold jump to glide, Blink (two charges, `X` / LB) and charge a homing Nova Bomb (`Z` / RB) from time, damage and kills. Spartans (blue) bring the numbers and the full arsenal. Shoot a caster for 55 damage to break the Nova (NOVA BREAKER). 20 / 30 / 50 kills. |
| Oddball | 4 v 4 | Hold the ball to score one point per second. The carrier is unarmed. 60 / 100 / 150 seconds. |

Pick the mode in Deployment (or the online lobby). Bots play the objectives: CTF bots split into attackers and defenders, Oddball bots escort or hunt the carrier.

## Rules

- Shield 100 + health 45. Shields recharge after ~4.6s out of fire. Headshots pay extra.
- Weapons: BR, magnum, SMG, shotgun, sniper (two-stage widescreen scope), rocket launcher, carbine, plasma rifle, needler (supercombine), energy sword (lunge), gravity hammer. Frag + plasma grenades.
- Power-ups: overshield (+200), active camo (cloaks you, hides you from radar), damage boost (x2). Killed players drop weapons.
- Medals: multi-kills, sprees, headshot, assassination, sword, grenade, revenge, flag capture, carrier kill, and **PERFECT** (headshot finish, every shot of the fight landed, no damage taken).
- Four bot difficulties (Easy, Normal, Heroic, Legendary): reaction time, aim error, turn rate, strafing.

## Progression

Your callsign is your in-game name everywhere (kill feed, scoreboard, lobby). Roll one or type your own in Deployment or Service Record.
Matches award XP and credits. Levels 1-50 unlock operators, halo colours, emblems and titles. Credits buy the premium halos and emblems early in the **Armory**,
which is also a codex for every weapon, power-up, map and mode. **Service Record** shows rank, stats, service badges and medals.
Everything is stored in your browser (localStorage).

## Model pipeline

Best results so far: GPT concept image -> **Tripo H3.1** image-to-3D (PBR, ~9 Higgsfield credits) -> `tools/blender/optimize.py`
(headless Blender via `pip install bpy==4.2.0`: decimate to ~9k triangles, textures to 1024px JPEG, about 0.5 MB per weapon).
BR, sniper and needler use it. The rest are older SAM 3D models and get replaced as credits allow. `tools/blender/kit.py` is a hard-surface
scripting kit for building weapons by hand in Blender (used as a comparison; the AI-generated Tripo models had better detail).

## Weapons and models

All eleven weapons and both grenades are textured low-poly models (2k-7k triangles each). They were generated with GPT image concepts lifted to 3D with SAM 3D,
then shrunk with `tools/optimize_glb.py` (textures to 768px JPEG). `models/weapons/manifest.json` sets orientation, length and grip per weapon.
The same models drive the first-person view, the operator's hands, floor pickups and the Armory preview. The HUD ammo panel uses white silhouettes of the concept art.
Weapon skins (tints) are unlocked with level and credits.

## Variants and extras

- **Variants:** Standard, Low Gravity, Fiesta (random weapon each spawn), Snipers, Swords + Magnums. Pick in Deployment or the lobby.
- **Quick Play:** random mode and map.
- **Challenges:** three daily and two weekly, in Service Record. They pay XP and credits.
- **Match intro:** the camera orbits your operator during the countdown, then drops into first person.
- **Feel:** bullet holes, shell casings, hitstop on kills, power-weapon spawn callouts, map ambience (wind / reactor hum), optional announcer voice.
- **Settings:** render quality, HUD size, reticle colour, announcer.

## Maps

Both are rotationally symmetric about the origin (Red -X, Blue +X) with mirrored spawns and pickups. Pick in Deployment -> Map (or `?map=lockout|cryostat|mesa|overgrowth|warsat`).

- **Lockout** - two raised bases, catwalk bridges, central tower with ramps to every height, sniper ledges at the top, dense cover and rails. No floor: fall and you die.
- **Overgrowth** - a drowned transit atrium in the style of an overgrown Venus subway: dark teal concrete, ivy, buttressed trees, red steel trusses, a skybridge over the centre lane, lit windows in the haze.
- **Warsat** - an Io launch facility in the style of a Warmind bunker: a rocket on its yellow gantry, charcoal slab walls, tapered pylons, moss-choked hangars, cream pipes and a banded giant in a pale sky.
- **Mesa** - sunset canyon. Central plateau with four ramps, one sniper spire per side reached by a long ramp, sandstone bases, side pods, big sightlines.
- **Cryostat** - night snow yard. Two sniper towers (one per side, one rifle each), central reactor deck, base pads, skybridges, ramps to every level, lots of spawn pads, camo, damage boost, overshield, sword, hammer. Aurora, moon, drifting snow.

Original layouts inspired by classic symmetrical arena design. Not a copy of any existing map or asset.

## Layout

```
js/world.js    map solids, collision, raycast, nav graph + A*, meshes, sky
js/rig.js      procedural waifu rig, arm IK, animation
js/weapons.js  weapon data + low-poly meshes + SVG icons
js/match.js    actors, physics, combat, projectiles, medals, pickups, rules
js/bots.js     perception, pathing, strafing, target leading, grenades
js/fps.js      first-person viewmodel (own scene/camera)
js/fx.js       pooled particles, tracers, flashes, explosions
js/hud.js      HUD, radar, reticle, feed, scoreboard
js/ui.js       screen manager, controller-navigable rows
js/input.js    one action map for keyboard/mouse/gamepad
js/audio.js    synthesized SFX + ambient music
js/merge.js    merges static meshes per material (draw-call budget)
js/net.js      PeerJS lobby + transport
js/touch.js    on-screen controls for phones
js/mapkit.js   environment art kit (bevelled architecture, normal-mapped panels, scaffolds, foliage, vines, trees)
js/modes.js    game modes + CTF / Oddball objective layer
js/profile.js  callsign, XP, credits, unlocks (localStorage)
js/catalog.js  operators, halos, emblems, titles, badges, codex data
js/armory.js   Armory (locker/shop/codex) + Service Record screens
js/angel.js    SAM-generated angel operator: skinned at load, driven by the procedural rig
js/main.js     boot, loading, menus, online flow, camera, loop
```

Operators are armored angels (a 7k-triangle SAM 3D model, skinned in code so the procedural rig's idle/run/aim/hit/death animation drives it), with per-operator hair colour and a team tint.
Setup lets you switch to the classic Spartan-helm body. Real weapon models: see `models/README.md`.

Debug: `?fast` skips splash delays, `?touch` forces touch controls, `?peerhost=localhost&peerport=9000&peerpath=/` uses a local PeerJS server, `?fps` shows an FPS counter (or F3), `?quick` skips splash and drops straight into a match,
`?quick&bot` lets the AI play for you, `?mode=slayer|rumble|hunt|ctf|oddball` (`&team=red|blue`) and `?map=lockout|cryostat` preselect.

A fan tribute. Not affiliated with or endorsed by any publisher.

## Saves

Progress autosaves in the browser (`lockout.profile`, save version 2: player id, skills slot, look slot for the future customizer). Settings > Save data exports a checksummed `LOCKOUT2.` code you can paste on another device or keep as a backup; older v1 saves migrate automatically.

## Sanctum (the hub)

Title menu > Enter Sanctum. A clean, sunlit art-deco utopia you walk around in third person (glide with jump held, blink with X / LB). A slow afternoon-to-night cycle turns the skyline, lamps and fountains on.

- **Look:** white marble with gold inlay, fluted colonnades, a sunburst arch, a reflecting pool with fountains and koi, cherry-blossom accent trees, a deco skyline and an orbital ring. Marble goddesses (the operator model carved in stone) and armoured guardians stand in courts around the plaza; 17 statues to study, each with a name and a line of lore.
- **Mission Board** (colonnade): ten missions plus a rotating Daily Bloom, with first-clear rewards, bonus objectives and an unlock chain. Results return you to the plaza.
- **Atrium Cafe:** Armory / locker, Service Record, Save Data terminal, and a cup of tea (+15% XP on your next match).
- **The Vault** (north; interact to open the door): all 11 weapons on plinths (stats, test fire, rotate, skin preview), all 9 operators, dioramas of every map, a codex orb and a wall of your medals.
- **Discoveries:** statues, weapons, operators, maps and secrets. Milestones pay credits; 20 unseals the Deep Vault and its relic (Sakura halo + Keeper title).
- **Life:** koi, a carillon bell, a plaza cat, seats, a void obelisk, fireflies, photo mode (V hides the HUD).


## Nu Light: what changed lately
- **Operators** are real textured models skinned at load (`js/angel.js`): Mualani, Kagome and Lucy (UDIM atlas built by `tools/blender/prep_udim.py`), plus the original angel for EOS. Palette variants (`look: { hue, sat, val }` in `WAIFUS` / `BOT_STYLES`) make one model several operators. Add a model: run `tools/blender/prep_char.py`, add an entry with joint landmarks to `OPERATOR_MODELS`.
- **Weapons** from the Drive pack are conformed with `tools/blender/conform.py` and listed in `models/weapons/manifest.json`.
- **Menu stage** (`js/space.js`): procedural Earth, Milky Way, moon, the Halo ring (`models/space/halo_ring.glb`) and a deco platform.
- **Audio**: licensed guitar score (`audio/music/CREDITS.txt`), narrator VO (`tools/vo/gen_vo.py`), and a synthesized UI palette (FM ticks, glass partials, air sweeps, sub thumps, short bright reverb) with a space ambience bed.
