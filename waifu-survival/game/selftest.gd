extends SceneTree

## Headless unit checks for the pure survival math.
## Run: Godot --headless --path . --script res://game/selftest.gd

var fails := 0
var gain_events := 0


func _init() -> void:
	# --- WaveTable ---
	_check("count w1 = 6", WaveTable.count(1) == 6)
	_check("count w10 = 33", WaveTable.count(10) == 33)
	_check("count w21 = 66", WaveTable.count(21) == 66)
	_check("count w25 = 70", WaveTable.count(25) == 70)
	_check("hp scale w3 = 1.32", is_equal_approx(WaveTable.hp_scale(3), 1.32))
	_check("speed scale w1 = 1.0", is_equal_approx(WaveTable.speed_scale(1), 1.0))
	_check("speed scale w16 capped 1.1", is_equal_approx(WaveTable.speed_scale(16), 1.1))
	_check("interval w1 = 2.5", is_equal_approx(WaveTable.spawn_interval(1), 2.5))
	_check("interval w13 = 1.2", is_equal_approx(WaveTable.spawn_interval(13), 1.2))
	_check("wave bonus w5 = 500", WaveTable.wave_clear_bonus(5) == 500)
	_check("no runners w4", WaveTable.runner_chance(4) == 0.0)
	_check("runners w7 = 0.3", is_equal_approx(WaveTable.runner_chance(7), 0.3))
	_check("no brutes w7", WaveTable.brute_count(7) == 0)
	_check("1 brute w8", WaveTable.brute_count(8) == 1)
	_check("2 brutes w13", WaveTable.brute_count(13) == 2)
	_check("brutes capped at 4", WaveTable.brute_count(40) == 4)

	# --- Salvage ---
	var s := Salvage.new()
	s.mult = 1.25
	s.award(60)
	_check("scavenger kill = 75", s.balance == 75)
	_check("earned total tracks gross", s.earned_total == 75)
	_check("cannot overspend", not s.try_spend(100))
	_check("balance untouched by failed spend", s.balance == 75)
	_check("spend ok", s.try_spend(75))
	_check("balance zeroed", s.balance == 0)
	gain_events = 0
	s.gained.connect(_on_gain)
	s.award_hit()
	_check("gained signal fired", gain_events == 1)
	s.reset()
	_check("reset zeroes balance", s.balance == 0)

	# --- Window selection: behind player wins over a close frontal point ---
	var windows: Array[Vector3] = [Vector3(5, 0, 0), Vector3(-8, 0, 0)]
	var idx := SurvivalDirector.pick_index(windows, Vector3.ZERO, Vector3(1, 0, 0))
	_check("spawns behind, not in face", idx == 1)
	var single: Array[Vector3] = [Vector3(2, 0, 0)]
	_check("single window still selectable", SurvivalDirector.pick_index(single, Vector3.ZERO, Vector3(1, 0, 0)) == 0)

	print("SELFTTEST DONE fails=%d" % fails)
	quit(0 if fails == 0 else 1)


func _on_gain(_amount: int) -> void:
	gain_events += 1


func _check(name: String, ok: bool) -> void:
	if ok:
		print("  pass  " + name)
	else:
		fails += 1
		print("  FAIL  " + name)
