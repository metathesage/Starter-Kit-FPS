extends LevelKit
## THE PIT — Forerunner arena. Two spawn-corridor bases, a rim catwalk on both long sides,
## a sunken-feel centre plateau with a spire. 80m x 50m, mirrored in X and Z.

const SLATE := Color("4d5670")
const SLATE_L := Color("7a86a3")
const SLATE_D := Color("2f3547")
const FLOOR := Color("8f8b80")
const SAND_D := Color("6f6b5e")
const CYAN := Color("39e3ff")
const AMBER := Color("ffa02b")


func _init() -> void:
	map_name = "THE PIT"
	map_tag = "FORERUNNER  /  80 x 50"
	sky_top = Color("1f2a55")
	sky_horizon = Color("c9a5d8")
	ground_color = Color("3f3a4a")
	sun_color = Color("ffd9c0")
	sun_energy = 1.0
	sun_rotation = Vector3(-42, 30, 0)
	ambient_energy = 1.5


func build() -> void:
	arena_shell(40, 25, 16, FLOOR, SLATE_D)
	sky_ring(1100.0, 55.0)
	# bases: two solid blocks + lintel, leaving a 10m spawn corridor
	box(Vector3(28, 0, 5), Vector3(12, 5, 16), SLATE, true, true)
	box(Vector3(28, 4, -5), Vector3(12, 1, 10), SLATE, true)
	# rim catwalk (top y=5) + ramps up
	box(Vector3(-28, 4.5, 17), Vector3(56, 0.5, 4), SLATE_L, false, true)
	ramp(Vector3(-3, 0, 8), Vector3(6, 5, 9), 2, SAND_D, false, true)
	ramp(Vector3(16, 0, 8), Vector3(12, 5, 6), 0, SAND_D, true, true)
	for x in [-20.0, -10.0, 10.0, 20.0]:
		prism(Vector2(x, 19), 0, 4.5, 0.8, 8, SLATE_D, 22.5, false, true)
	# barriers
	barrier(Vector2(-27.8, 17.15), Vector2(-3, 17.15), 5, CYAN, 4, false, true)
	barrier(Vector2(3, 17.15), Vector2(27.8, 17.15), 5, CYAN, 4, false, true)
	barrier(Vector2(-39.7, 20.85), Vector2(39.7, 20.85), 5, CYAN, 4, false, true)
	barrier(Vector2(28.15, -8), Vector2(28.15, 8), 5, CYAN, 4, true)
	barrier(Vector2(28.15, 14), Vector2(28.15, 17), 5, CYAN, 4, true, true)
	# centre plateau + ramps + spire
	box(Vector3(-10, 0, -5), Vector3(20, 2.5, 10), SLATE_L)
	ramp(Vector3(10, 0, -3), Vector3(7, 2.5, 6), 1, SAND_D, true)
	prism(Vector2.ZERO, 2.5, 8, 1.5, 8, SLATE_D, 22.5)
	light_strip(Vector2(-9.8, -4.8), Vector2(-9.8, 4.8), 2.55, CYAN)
	light_strip(Vector2(9.8, -4.8), Vector2(9.8, 4.8), 2.55, AMBER)
	# ground cover
	box(Vector3(20, 0, -2), Vector3(2, 1.2, 4), SLATE, true)
	box(Vector3(6, 0, 9), Vector3(3, 1.2, 1.6), SLATE, true, true)
	# spawns / enemies
	spawn(Vector3(33, 0.05, 0), 90, true)
	spawn(Vector3(36, 0.05, 3), 90, true, true)
	for p in [Vector3(20, 3.5, 11), Vector3(-20, 3.5, 11), Vector3(20, 3.5, -11), Vector3(-20, 3.5, -11), Vector3(0, 9.5, 0), Vector3(0, 8, 20), Vector3(0, 8, -20)]:
		enemy_spawns.append(p)
	nav_paths = [
		PackedVector3Array([Vector3(33, 0.05, 0), Vector3(26, 0, 0), Vector3(19, 0, 0), Vector3(14, 1.2, 0), Vector3(8, 2.5, 0),
			Vector3(0, 2.5, 3.6), Vector3(-8, 2.5, 0), Vector3(-14, 1.2, 0), Vector3(-20, 0, 0)]),
		PackedVector3Array([Vector3(26, 0.05, 0), Vector3(14, 0, 11), Vector3(20, 2.0, 11), Vector3(26, 4.2, 11), Vector3(32, 5, 11),
			Vector3(32, 5, 19), Vector3(20, 5, 19), Vector3(0, 5, 19), Vector3(0, 5, 16), Vector3(0, 2.5, 12.5), Vector3(0, 0, 7)]),
	]
