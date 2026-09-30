// Patch notes: the single source. `node tools/gen-notes.mjs` writes docs/PATCH_NOTES.md from this list; the in-game Patch Notes screen reads it directly.
// Newest first. Section kinds: NEW, CHANGED, FIXED, KNOWN.
export const PATCHES = [
  { v: '0.12', date: '2026-09-30', name: 'Depth Pass I', blurb: 'Two factions, killcams, a top-kill cinematic, tighter hits and airtight walls.', sections: [
    ['NEW', [
      'TEAM DESTINY vs TEAM SPARTANS. Pick a faction in Setup: your side gets that kit and the enemy fields the other. CLASSIC keeps pure gunplay.',
      'Destiny kit: blink (2 charges), glide, a real double jump and a charging Nova Bomb super.',
      'Spartan kit: POWER DASH (2 charges, shoulder-charges and throws the first foe in the lane), one armor ability of your choice, faster shield recharge and 3 frags. Armor abilities: ARMOR LOCK (invulnerable, then a pulse that returns the damage you absorbed), JETPACK (hold to thrust, fuel recharges on the ground), DROP SHIELD (a dome that cuts damage by 60% and restarts shield recharge).',
      'Killcam: a beat after you die, the last seconds replay from your killer\'s eyes, slowing on the killing shot. Any button skips.',
      'TOP KILL: at match end the best kill of the game (distance, headshots, power weapons, multikills, air kills, streaks) plays as a slow-motion chase cinematic before the results.',
      'Hit markers v2: chamfered ticks, orange when the target\'s shield is down, skull on headshots, a burst ring on kills, and stacked damage numbers beside the reticle.',
      'Strafe roll, landing dip and dust puffs on hard landings. The loading screen gets an animated emblem: counter-rotating rings, a live progress arc and a radar sweep.',
      'Bullet magnetism: shots bend toward a foe near the reticle on every input device. Setting: Aim assist OFF / LIGHT / STANDARD.',
    ]],
    ['FIXED', [
      'Shooting through walls: hit-scan now uses an exact ray-vs-box test instead of stepping, so thin rails and long shots can no longer skip a wall. Rockets, novas and grenades are swept the same way and cannot tunnel.',
      'Fast movement (dash, blink, knockback) is sub-stepped so nobody is carried through geometry.',
      'The weapon panel stretched over the screen in short windows.',
    ]],
  ] },
  { v: '0.11', date: '2026-09-30', name: 'New Light', blurb: 'The game gets its name, real textured operators and a sleeker sound.', sections: [
    ['NEW', [
      'Game renamed to NEW LIGHT (the Lockout map keeps its name). New brand mark on splash, title and tab icon.',
      'Lucy joins the roster: a textured cyberpunk operator built from a 10-tile UDIM atlas.',
      'Palette variants: one model becomes several operators through hue, saturation and brightness shifts (hue-safe for skin).',
      'The Halo ring now arcs across the menu sky, behind the Earth and moon.',
      'Futuristic UI sound palette: FM ticks, glass chimes, air sweeps, sub thumps and a short bright reverb. New panel-open whoosh, cinematic win and lose stingers, and a drifting space ambience under the menus.',
      'Loading screens now report an error on screen if anything throws while a map or match loads.',
      'Patch Notes screen (this one), plus docs/DEV_NOTES.md and HALO.md (roadmap and design rules).',
    ]],
    ['CHANGED', [
      'Bots and operators use Mualani, Kagome and Lucy. Only EOS (top unlock) still uses the angel model.',
      'Marble goddess statues are carved from the Mualani model instead of the angel.',
      'Team-coloured anime rim light on operators; outlines widen with distance to reduce shimmer.',
      'A bad operator model can no longer block a match: it falls back to the classic body.',
    ]],
    ['KNOWN', [
      'Characters are static meshes skinned at load with hand-placed joints and driven by the procedural rig. Limb deformation is approximate. A real rigged pipeline is the top roadmap item.',
      'Outline shimmer can still show at low render resolution.',
    ]],
  ] },
  { v: '0.10', date: '2026-09-30', name: 'Real Operators', blurb: 'Real character models, a space stage, stats and end screens.', sections: [
    ['NEW', [
      'Real textured operator models (Mualani, Kagome) replace the low-poly body; the procedural body remains as the animation driver.',
      'Menu stage: procedural spinning Earth with clouds, city lights and aurora, a Milky Way band, moon, shooting stars and a deco platform.',
      'Loading screens show the map being loaded with a slow push-in and its name.',
      'Full stat tracking: kills, deaths, K/D, accuracy, headshots, playtime, win rate, win streak, best game, losses, per-weapon kills, per-map and per-mode books and a 30-match history.',
      'End-of-match screen: slab banner, slam-in title, MVP strip and eight count-up performance cards.',
      '10 new emblems and 10 new badges with new glyphs; animated ring on earned badges.',
    ]],
    ['CHANGED', [
      'Brutalist art-deco noir pass: chamfered corners, gold double rules, sunburst behind the logo, mono labels, Syncopate display type.',
      'Double arrows on buttons removed: icons carry the meaning.',
      'Panel frames live in the panel background so they stay put while long screens scroll.',
    ]],
  ] },
  { v: '0.9', date: '2026-09-30', name: 'Drive Pack', blurb: 'Destiny weapon models, sprint, classic BR scope, narrator and a guitar score.', sections: [
    ['NEW', [
      'Weapon models from your Drive: Ace of Spades, Izanagi\'s Burden, Chaperone, Vex Mythoclast, Outbreak Perfected, plus the cyberpunk pistol, PDW, sci-fi rifle and Mindbender\'s Ambition swapped in for Magnum, SMG, Plasma Rifle and Shotgun.',
      'Five new exotics with perks: Memento Mori (hotter mags after reload), Honed Edge (kill reloads instantly), Slug Rounds, Timeless Adaptive (kills restore shield), Nanite Culture (poison stacks).',
      'Sprint: hold Shift (LS click on pad, toggle). 40% faster, forward only, cancelled by firing, zooming or crouching. Weapon lowers and FOV kicks. Crouch moves to D-Pad on controller.',
      'Classic Halo BR scope: black surround, rounded window, stadia reticle, range and magazine readouts.',
      'Narrator VO: 68 holographic-AI lines (kills, streaks, lead changes, exotics, match start and end, shield critical).',
      'Licensed guitar-driven score: acoustic bed for menus and hub, rock playlist for matches (credits in audio/music/CREDITS.txt).',
      'Arcade motion layer: dash-in menus, wipe transitions, slamming medals, ticker on the title.',
      'Oddball carriers can shoot.',
      'Guns use a gentler cel shading (softer bands, thinner ink) than characters.',
    ]],
  ] },
  { v: '0.8', date: '2026-09-29', name: 'Premium Pass', blurb: 'Liquid-glass UI, wow moments and sculpted guardians.', sections: [
    ['NEW', [
      'Liquid-glass UI layer (Geist and Geist Mono), springy motion, aurora focus rings.',
      'Wow layer: match intro title card with letterbox, exotic acquisition flash and god rays, level-up confetti, kill and medal chromatic pulses.',
      'Four sculpted female warlock-mage guardian statues (Blender) across the Sanctum.',
    ]],
  ] },
  { v: '0.7', date: '2026-09-29', name: 'Iconic', blurb: 'Destiny exotics and the post pipeline.', sections: [
    ['NEW', [
      'Hawkmoon, Last Word, Felwinter\'s Lie, Gjallarhorn and Thorn with their signature perks, exotic spawns with beams and a vault display.',
      'HDR bloom chain, FXAA, per-map colour grade, vignette and chromatic fringe (toggle in Settings).',
    ]],
  ] },
  { v: '0.6', date: '2026-09-29', name: 'The Sanctum', blurb: 'A solo hub: marble, gold, cherry blossom and a vault.', sections: [
    ['NEW', [
      'Sanctum hub: art-deco utopia plaza with reflecting pool, fountains, 17 marble statues, deco skyline, day and night cycle, tea buff, garden cat and photo mode.',
      'Vault museum with exhibits and discoveries, mission board with bonus objectives, the Keeper.',
      'Save system v2: profile migration, checksummed export and import codes.',
    ]],
  ] },
  { v: '0.5', date: '2026-09-29', name: 'Maps', blurb: 'Three new maps and an art pass on every map.', sections: [
    ['NEW', [
      'Halcyon-style dusk ruins, Overgrowth (Venus atrium) and Warsat maps with bevelled, baked-AO geometry, foliage, vines and normal-mapped panels.',
      'Warlock Hunt: asymmetric mode with glide, blink, homing Nova Bomb, cast interrupt and bot AI.',
    ]],
  ] },
  { v: '0.4', date: '2026-09-29', name: 'Cel Shade', blurb: 'The anime look arrives.', sections: [
    ['NEW', [
      'Toon gradient and inverted-hull ink outlines on weapons and operators, per-weapon saturation.',
      'Cryostat night-snow map, cyber-angel operators, new weapons and power-ups.',
    ]],
  ] },
  { v: '0.3', date: '2026-09-29', name: 'Progression', blurb: 'Levels, armory and modes.', sections: [
    ['NEW', [
      'Profile, XP and levels, Armory (locker, shop, codex), Service Record, badges, emblems, halos and operators.',
      'Rumble Pit, CTF and Oddball; kill leader crown; PERFECT medal; widescreen sniper scope.',
      'Daily and weekly challenges, Quick Play variants (low gravity, fiesta, snipers, swords).',
    ]],
  ] },
  { v: '0.2', date: '2026-09-29', name: 'Online', blurb: 'Play with friends anywhere.', sections: [
    ['NEW', [
      'Host-authoritative online lobbies (PeerJS) by code or link, phone touch controls and a Pages deploy workflow.',
      'Weapon models: Halo-style low-poly set, then generated and optimised models.',
    ]],
  ] },
  { v: '0.1', date: '2026-09-29', name: 'Lockout', blurb: 'First playable.', sections: [
    ['NEW', [
      '4v4 Team Slayer on a Forerunner-style symmetrical map, bots with nav-graph AI, Reach-style HUD, Xbox controller support.',
    ]],
  ] },
];
