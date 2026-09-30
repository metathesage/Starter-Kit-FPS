extends LevelKit
## CINDER — Valorant-style two-site arena. Attackers west, defenders east.
## Two lanes + a mid corridor into A (north) and B (south) sites, each with cover and a raised
## perch. 80m x 40m. Mirrored in Z.

const FLOOR := Color("6d6f78")
const WALL := Color("9a8f86")
const WALL_D := Color("5b5560")
const SITE := Color("c9a86a")
const RED := Color("ff4655")
const CYAN := Color("39e3ff")


func _init() -> void:
	map_name = "CINDER"
	map_tag = "2 SITES  /  ATTACK VS DEFEND  /  80 x 40"
	sky_top = Color("2b3a63")
	sky_horizon = Color("f0b48a")
	ground_color = Color("3a3640")
	sun_color = Color("ffd7b0")
	sun_energy = 1.0
	sun_rotation = Vector3(-40, -25, 0)
	ambient_energy = 1.6


func build() -> void:
	arena_shell(40, 20, 12, FLOOR, WALL_D)
	# attacker gate + lane separators (mid door at x -18..-13)
	box(Vector3(-30, 0, 4), Vector3(0.6, 3.5, 5), WALL, false, true)
	box(Vector3(-30, 0, 15), Vector3(0.6, 3.5, 5), WALL, false, true)
	box(Vector3(-29.4, 0, 6), Vector3(11.4, 3.5, 0.6), WALL, false, true)
	box(Vector3(-13, 0, 6), Vector3(9, 3.5, 0.6), WALL, false, true)
	box(Vector3(-2, 0, -3), Vector3(4, 3.5, 6), WALL_D)
	# site walls (A main gap z 9..15) and defender wall (doors z 9..13)
	box(Vector3(10, 0, 6), Vector3(0.6, 3.5, 3), WALL, false, true)
	box(Vector3(10, 0, 15), Vector3(0.6, 3.5, 5), WALL, false, true)
	box(Vector3(34, 0, 6), Vector3(0.6, 3.5, 3), WALL, false, true)
	box(Vector3(34, 0, 13), Vector3(0.6, 3.5, 7), WALL, false, true)
	# site cover + perch
	box(Vector3(18, 0, 9.5), Vector3(2.4, 1.2, 2.4), SITE, false, true)
	box(Vector3(24, 0, 14), Vector3(3, 2.6, 1), WALL, false, true)
	box(Vector3(28, 0, 9), Vector3(2, 1.2, 2), SITE, false, true)
	box(Vector3(28, 0, 15.5), Vector3(6, 2.4, 4.5), WALL_D, false, true)
	ramp(Vector3(22, 0, 16), Vector3(6, 2.4, 3), 0, SITE, false, true)
	# site markers (visual)
	flat(Vector2(19, 15.5), Vector2(0.6, 3), 0.0, RED, false, true, Kind.GLOW)
	light_strip(Vector2(-29.7, -19), Vector2(-29.7, 19), 3.5, CYAN)
	light_strip(Vector2(34.3, -19), Vector2(34.3, 19), 3.5, RED)
	# spawns
	spawn(Vector3(-36, 0.05, 10), 270, false, true)
	spawn(Vector3(-36, 0.05, 0), 270)
	spawn(Vector3(37, 0.05, 0), 90)
	spawn(Vector3(37, 0.05, 9), 90, false, true)
	for p in [Vector3(20, 3.5, 12), Vector3(20, 3.5, -12), Vector3(0, 5, 12), Vector3(0, 5, -12), Vector3(-15, 4, 0), Vector3(30, 5, 0)]:
		enemy_spawns.append(p)
	nav_paths = [
		PackedVector3Array([Vector3(-36, 0.05, 10), Vector3(-33, 0, 12), Vector3(-25, 0, 13), Vector3(0, 0, 13), Vector3(12, 0, 13), Vector3(21, 0, 13),
			Vector3(20, 0, 17.5), Vector3(22.4, 0.3, 17.5), Vector3(25, 1.2, 17.5), Vector3(28, 2.4, 17.5), Vector3(31, 2.4, 17.5)]),
		PackedVector3Array([Vector3(-36, 0.05, 0), Vector3(-25, 0, 0), Vector3(-5, 0, 0), Vector3(-5, 0, 4.5), Vector3(0, 0, 4.5), Vector3(10, 0, 4),
			Vector3(20, 0, 0), Vector3(30, 0, 0), Vector3(37, 0, 0)]),
		PackedVector3Array([Vector3(37, 0.05, 9), Vector3(33, 0, 11), Vector3(20, 0, 13), Vector3(12, 0, 13), Vector3(0, 0, 13), Vector3(-25, 0, 13), Vector3(-36, 0, 12)]),
	]
