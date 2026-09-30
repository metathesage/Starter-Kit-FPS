# HALO.md: the Nu Light north star

One page for what we are making, the rules every screen and system follows, and where it goes next.
Companion docs: `docs/PATCH_NOTES.md` (what shipped), `docs/DEV_NOTES.md` (how it is built), `README.md` (how to run it).

## What Nu Light is
A browser arena shooter with Halo's rules of engagement (shields, sandbox weapons, symmetrical maps, Oddball and CTF), Destiny's loot and exotics, Genshin's character art, and Apex's UI confidence. Noir, art deco, luxury. Anime operators, marble and gold, a quiet hub between fights. Runs in a tab. Xbox controller first-class.

## Pillars
1. **Fun in ten seconds.** Press Start, be shooting inside ten seconds, get a reward inside ten more. Grey-box fun before art.
2. **Sandbox over stats.** Every weapon has a role, a range and a tell. Exotics change how you play, not just numbers.
3. **Noir luxury.** Black glass, bone white, one champagne gold. Restraint reads as expensive.
4. **UI is gameplay.** The HUD is read in a glance under fire; menus feel like a product, not a settings page.
5. **Everything moves.** No sliding statues: rigs animate, UI enters and exits, rewards escalate.
6. **Controller-native.** Every screen and every action works on an Xbox pad; prompts swap live.
7. **Honest scope.** We say what is finished, what is approximate and what is missing (see Known gaps).

## Design rules

### Look (2D and UI)
- Palette: black `#040404`-`#0e0e11` surfaces, white text, champagne `--champ #ffe2a8` as the only accent. Team colours (blue, red) belong to teams and nothing else. Reward gold is the same champagne. Danger red is used for damage and warnings only.
- Shape language: **chamfered corners** (10 to 26 px cuts), gold hairline frames, stepped rules under headings, sunbursts behind marks. No pill buttons, no rounded cards, no drop-shadow glow soup.
- Type: display **Syncopate** (caps, wide tracking) for names and headings; **Geist Mono** for labels, numbers and data (tabular numerals); **Geist** for body text. No system fonts, no emoji, ever.
- Icons: one language. 24 px grid, 1.6 stroke, round caps, `currentColor`, custom paths in `js/icons.js` and `js/catalog.js`. Every button, tab and option row carries a matching glyph. Never a stock icon pack.
- Focus state is the cursor: inverted white slab, animated icon pop, shine sweep. Hover, focus, press and disabled all designed.
- Motion: menus dash in (skewed slide + blur, staggered), panels wipe, medals slam, numbers count up. Ease `cubic-bezier(.16,1,.3,1)`, springs for pops. Respect `prefers-reduced-motion` by calming, not removing, feedback.
- Loading and splash: real progress only. Loading screens carry the map they are loading.

### Look (3D)
- Cel shading with two intensities: **characters** get the stronger anime read (4-band toon, ink outline, team rim light); **weapons** get the gentler read (6-band, thin ink) so they stay Halo/Destiny credible.
- Tone mapping ACES, HDR bloom on emissives only, per-map grade, vignette and a whisper of fringe. Fog for depth. No unlit default materials.
- Maps: bevelled geometry with baked AO, normal-mapped panels, foliage with wind. Each map has one signature light colour and one landmark you can navigate by.
- Characters: real textured models, one unique silhouette per operator, palette variants for the rest. Halo above the head is the team beacon. Armor is a separate kit layered on top (planned).
- Menu stage: space, Earth, Milky Way, the ring. The operator stands on a deco platform and is always lit by a key and a rim.

### Sound
- **UI is sleek and futuristic, never boopy:** FM ticks, glass partials, air sweeps, sub thumps, short bright reverb. Movement is a tick; confirm is a chime plus sweep; back is a reverse sweep. Silence between sounds is a feature.
- **Guns are punchy and short**, with a low body and a bright transient. Power weapons and exotics get a signature voice.
- **Music is guitar-led.** Acoustic and ambient for menus and the hub; driving rock and orchestra for matches. It ducks under the narrator and big moments.
- **Narrator** is a calm holographic AI. Short lines. Never talks over itself; scene lines (`@start`, `@win`) may interrupt.
- Always credit third-party audio (`audio/music/CREDITS.txt`).

### Gameplay
- Shields recharge after a delay; health does not. Melee is a commitment. Power weapons are timed and announced.
- Exotics: one clear perk, one line of text, one visible tell. No hidden stacking modifiers.
- Sprint is forward-only and gives up the gun (cancelled by fire, zoom, crouch). Zoom scopes follow the weapon: BR is the classic rounded window, snipers get the wide scope.
- Bots are predictable enough to read, dangerous enough to respect. Difficulty changes reaction and aim, not health.
- Every match ends on a screen worth screenshotting.

### Controller
- Menus: D-Pad or left stick to move, A confirm, B back, Menu opens pause. Glyphs follow the last device used.
- Gameplay: RT fire, LT grenade, RS zoom, LS click sprint (toggle), D-Pad down crouch, A jump, B melee, X reload or pick up, Y swap.
- Every new screen ships controller-navigable or it does not ship.

### Performance and compatibility
- 60 fps on a mid laptop; adaptive resolution below 24 ms frames. Cap DPR at 2. Pool particles and bullets. No per-frame allocation in hot loops.
- Runs in current Chrome, Edge, Firefox and Safari, phones included (touch layout). Audio unlocks on first input. Storage in try/catch.
- Budget: menu stage plus hub under 200k triangles on screen; weapons 8 to 16k tris each; operators 5 to 32k.

### Content rules
- Nothing generic: no default fonts, default spawn boxes, default blue skies.
- Every new asset goes through its pipeline (`docs/DEV_NOTES.md`) so orientation, scale, materials and file size are consistent.
- Third-party art, models and music are tracked with licence and source.

## Roadmap
Status: `[x]` shipped, `[~]` partial, `[ ]` planned. Priority inside each band is top to bottom.

### Depth Pass (brainstorm, ranked by impact per effort)
Core is solid; this pass makes it alive. Each brick ships alone.
1. **[x] Killcam and top kill (shipped in 0.12).** Ring buffer of every actor's position, aim and weapon for the last 4s. On death, replay the killer's POV at 0.5x with a slow-mo hit, ink-line letterbox, killer nameplate and weapon card, skippable with any button. Same buffer powers end-screen best-play replay.
2. **Impact layer.** Decals (scorch, bullet, blood-free ink splats), shell casings with physics, dust on landing and slide, muzzle light pulses, tracer trails, hit-spark by material, screen-edge damage direction wedges.
3. **Fidelity.** Baked lightmap-style AO per map, SSAO-lite, volumetric god rays through windows, reflection probes on glass and water, PBR trims and normal maps on weapons, film grain and chromatic edge, HDR skies from the Milky Way shader in every map.
4. **Motion.** Weapon reload, draw and inspect clips; camera roll on strafe; landing dip; sprint FOV kick; ledge-grab and mantle; melee lunge with target snap; footstep IK on stairs and ramps.
5. **Loading screens.** Operator turntable with rim light, map fly-through pulled from the map file, live progress ring, scrolling lore and tip ticker, radar sweep that resolves into the playable map, animated deco frame that opens on ready.
6. **Interactivity.** Destructible props (crates, glass), doors and lifts, shootable sanctum targets, jump pads, gravity lifts, grenade cook-and-throw physics, environmental hazards, hub mini-games between matches.
7. **Reactive world.** Announcer callouts tied to streaks, crowd of holographic spectators in the arena rim, map sky and fog shift with match time, weather variants.
8. **Asset pipeline (free tools).** Pollinations for concept and texture images (works now, no key). Blender headless for kitbashing and armor. TRELLIS and Hunyuan3D HF Spaces for image-to-3D (anonymous ZeroGPU quota is spent for about 18 hours; a free HF token lifts it). Higgsfield `generate_3d` is connected but spends credits, so it stays opt-in.

### Now (next few sessions)
- [~] **Real rigged characters.** Loba and Revenant ship with authored skeletons and real clips (`js/clipped.js`: lower and upper body clip sets, idle, walk, jog, sprint, crouch, jump, aim, shoot, reload, death). Still to do: Wraith (her skeleton units do not match her animation, needs a fix in Blender), strafe and backpedal clips, melee, hit reactions, emotes, weapon grip tuning, and moving Mualani, Kagome, Lucy and the angel onto the same pipeline (Mixamo auto-rig or Rigify).
- [ ] **Rigged weapon animation.** The weapon files carry Idle, Fire, Reload and Inspect clips with Muzzle, Sight_ADS and Grip_Forehand nodes. Today they are frozen to their bind pose at load; play the clips in the viewmodel.
- [ ] **Weapon skins from the extra files.** R-99 Avalanche and Cutting Edge, CAR variants (the feather mythic needs a scale fix), Heirloom Grand Slam.
- [ ] **Armor kit.** Modular pieces (helm, pauldrons, chest, greaves, back piece) authored in Blender, attached to bones, with dye slots and rarity tiers. Ties into the Armory and drops.
- [ ] **Match-loading reliability.** Loading diagnostics are in; add a boot self-test screen (`?diag`) that reports every asset, shader and audio failure.
- [ ] **Weapon animation.** Author reload, draw and inspect clips for the hero weapons instead of procedural dips.
- [ ] **More unique operators.** Tripo-generated textured characters (credits pending), Lucy and the bunny girl pose fixes, enemy pack designs as bosses or vault exhibits.
- [~] **Audio mix pass.** Narrator, UI, guns, music and ambience levels balanced on real speakers and headphones.

### Next
- [ ] Character creator (face, hair, skin, armor dyes) using the `look` save slot.
- [ ] Skill trees and loadout perks using the `skills` save slot.
- [ ] Solo campaign missions with briefings and bonus objectives beyond the mission board.
- [~] Match replay and a saved best-play recap (killcam and top kill shipped in 0.12).
- [ ] Two more maps with the mapkit (a vertical city map and a large Big Team style arena).
- [ ] Playlists and ranked queue on top of the PeerJS lobby; reconnect and host migration.
- [ ] Sanctum: multiplayer social hub, cosmetics vendor, trophy wall driven by badges.
- [ ] Halo ring, planet and stars carried into map skies, not just the menu.
- [ ] Accessibility: colour-blind team palettes, subtitles for narrator lines, reduced flash, remappable controls.
- [ ] Localisation scaffolding.

### Later
- [ ] Vehicles (Warthog-style) on a big map.
- [ ] Forge-lite: place props and share a map code.
- [ ] Seasonal content: challenges, exotic quests, cosmetics.
- [ ] Native wrapper (PWA install, gamepad haptics on supported devices).

### Done recently
- [x] Depth Pass I: factions (Destiny and Spartan kits), killcam, top-kill cinematic, hit markers v2, bullet magnetism, exact wall collision for hit-scan and projectiles
- [x] Nu Light rename and brand mark
- [x] Real textured operators (Mualani, Kagome, Lucy) with palette variants
- [x] Space menu stage with the Halo ring
- [x] Futuristic UI sound palette and space ambience
- [x] Narrator VO, guitar score, sprint, classic BR scope
- [x] Destiny exotics: Hawkmoon, Last Word, Felwinter's Lie, Gjallarhorn, Thorn, Ace of Spades, Izanagi's Burden, Chaperone, Vex Mythoclast, Outbreak Perfected
- [x] Stats tracking, match history, end-of-match screen
- [x] Brutalist art-deco noir UI and icon language
- [x] Sanctum hub, five maps, Warlock Hunt, online lobbies

## Known gaps (said plainly)
- Operators are static meshes skinned at load with approximate joints and animated by a procedural rig. They are not authored, animated characters and they are not Destiny-level.
- Weapons are static meshes; motion comes from procedural viewmodel sway.
- Outline shimmer at low render resolution; Kagome's arms deform roughest.
- The narrator is synthesised speech with an effect chain, not a performance.
- Online play is host-authoritative peer-to-peer; expect variance on bad connections.

## How to change this file
Any design rule that changes gets edited here in the same commit as the change. Roadmap items move between bands as they are decided, never silently deleted: tick them, or move them to Done recently.
