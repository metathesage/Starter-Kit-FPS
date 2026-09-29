# SHRINE RANGE — Training Construct

Moonlit gacha firing range in the **WAIFU HALO** aesthetic: cherry blossom, torii
gates, halo statues, a giant moon, and holo-waifu targets. Built entirely from
runtime primitives in the existing engine style — no new assets, no new packages.

---

## How to get there

| From | Action |
|---|---|
| **Arena scene** (in match) | Press **V** — travel to the range. The match clock pauses, bots freeze, no one captures the hill. **V** / **B** returns and drops you where you left. |
| **Editor (fresh scene)** | **Tools → Waifu Halo → Build Shrine Range Scene** — standalone training scene, boots straight into Free Fire. |
| **WebGL build** | Both scenes ship automatically; same V toggle in-game. |

## The five drills

Switch with **[** / **]** or **F1–F5**. Pull the trigger to start a run.

| # | Drill | Type | Rules |
|---|---|---|---|
| F1 | **FREE FIRE** | Sandbox | Untimed. Red plates respawn forever. `C` banks the run for a rank. |
| F2 | **PRECISION** | Marksmanship | 60s. Halo-core hits pay 250+; body shots break your combo. |
| F3 | **SPLIT TARGET** | Reflex | 75s. Targets spawn in pairs with 2 HP each; clear the pair for the next. |
| F4 | **HALO WAVE** | Tracking | 90s. Drones orbit the shrines in waves that shrink their uptime. |
| F5 | **POPCORN** | Flick | One target at a time, anywhere on the field, instant respawn. Chase the combo. |

**Scoring:** base points × combo multiplier (up to ×2 at a 20-chain) × 1.6 for
halo cores. Stray bullets break the combo on strict drills. Rank thresholds also
demand accuracy — S needs ≥72%.

Ranks: **C / B / A / S**. Best scores persist per drill (PlayerPrefs).
Every completed run pays 1 gacha pull; A pays 2, S pays 3.

## The gacha

After a run, a crystal forms on screen, bursts, and reveals an **ECHO card** —
N / R / SR / SSR with names like KIRA-7, SERAPH-01, AMATERASU-0. The pull pool
weights better with higher scores. Collection count shown on each card.

## Controls (range)

```
V            enter / leave range        [ ] or F1–F5   switch drill
LMB          start run / fire           C              bank Free Fire run
B            leave range                R / X          reload (unchanged)
```

## Files

| File | Role |
|---|---|
| `Scripts/ShrineRange.cs` | Procedural map: floor, deck, ponds, torii ×3, halo statues ×2, blossom trees, lanterns, skyline, moon, fog, petal drift |
| `Scripts/RangeTarget.cs` | Holo-waifu popups, halo drones, red plates; weak-point colliders, flip-down death |
| `Scripts/RangeMaster.cs` | Drill director: scheduling, combo scoring, ranks, bests, gacha, travel |
| `Scripts/RangeHUD.cs` | ECHO-style overlay: drill card, combo meter, score block, results, card reveal |
| `Scripts/RangeFX.cs` | Sparks, rose bursts, rings, score puffs |
| `Scripts/SoundManager.cs` | + target dings, medal stinger, gacha jingle/burst, looping wind bed |
| Patches | `ArenaDirector` (V toggle, shrine-aware boot), `GameInput` (V, F1–F5 guard), `Weapon` (shot/hit router), `ArenaHUD` (defer to RangeHUD), `KingOfTheHill` (clock pause), `BotAI` (stand down), `RuntimeAssets` (MeshFilter/MeshRenderer pin), `Editor/SceneBuilder` (Shrine scene menu) |

## Tuning knobs

- Mode table: `RangeMaster.Modes` — durations, respawn delays, HP, penalties.
- Rank gates: `RangeMaster.SThresholds()`.
- Gacha odds: `RangeMaster.GrantPull()` — SSR base 2%, scaling +35% of bonus with score.
- Map scale: all constants local to `ShrineRange` methods (lanes, rows, pond sizes).
