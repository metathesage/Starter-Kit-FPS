class_name WaveTable
extends RefCounted

## Wave pacing for round-based zombie survival. Pure static math so it is
## testable headless without a scene (see selftest.gd).

const ALIVE_CAP := 16          # WebGL budget: zombies walking at once
const POOL_SIZE := 24          # pre-built zombie instances, recycled forever
const INTERMISSION := 18.0     # shop time between waves
const FIRST_PREP := 6.0        # shorter countdown before wave 1


static func count(wave: int) -> int:
	# Wave 1 = 6 zombies, +3 per wave; past wave 20 the growth flattens to +1
	# so the late game escalates toughness, not spam.
	var n := wave - 1
	if n <= 20:
		return 6 + 3 * n
	return 66 + (n - 20)


static func hp_scale(wave: int) -> float:
	return 1.0 + 0.16 * float(wave - 1)


static func speed_scale(wave: int) -> float:
	return 1.0 + 0.10 * clampf(float(wave - 1) / 15.0, 0.0, 1.0)


static func spawn_interval(wave: int) -> float:
	# Drip-feed cadence: zombies arrive over the wave, never in a lump.
	return lerpf(2.5, 1.2, clampf(float(wave - 1) / 12.0, 0.0, 1.0))


static func wave_clear_bonus(wave: int) -> int:
	return 100 * wave


static func runner_chance(wave: int) -> float:
	return 0.3 if wave >= 5 else 0.0


static func brute_count(wave: int) -> int:
	if wave < 8:
		return 0
	return clampi(1 + (wave - 8) / 5, 0, 4)
