# LOCKOUT — Team Slayer, Waifu Edition

A browser arena shooter built as a tribute to classic console team-slayer on a symmetrical map.
4v4 against bots. Low-poly armored operators, energy sword, sniper tower, rockets, overshield.
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

## Rules

- Team Slayer, 4v4, first to 15 / 25 / 50 kills or 12 minutes.
- Shield 100 + health 45. Shields recharge after ~4.6s out of fire. Headshots pay extra.
- Weapons: BR, magnum, SMG, shotgun, sniper, rocket launcher, energy sword (lunge). Frag + plasma grenades.
- Overshield (+200 for 30s). Killed players drop weapons. Medals: multi-kills, sprees, headshot, assassination, sword, grenade, revenge.
- Four bot difficulties (Easy, Normal, Heroic, Legendary): reaction time, aim error, turn rate, strafing.

## Map

Original layout inspired by symmetrical two-base arena design: two raised bases, catwalk bridges at height,
a central sniper tower, ground lanes, cover crates. Rotationally symmetric about the origin (Red -X, Blue +X).
It is not a copy of any existing map or asset.

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
js/main.js     boot, loading, menus, camera, loop
```

Debug: `?fps` shows an FPS counter (or F3), `?quick` skips splash and drops straight into a match,
`?quick&bot` lets the AI play for you.

A fan tribute. Not affiliated with or endorsed by any publisher.
