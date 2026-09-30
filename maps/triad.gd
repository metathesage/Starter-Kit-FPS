extends LevelKit
## TRIAD — Valorant-style three-site arena. A and C sites on the flanks, B on a raised centre
## platform with ramps on both sides. Attackers west, defenders east. 72m x 44m. Mirrored in Z.

const FLOOR := Color("77747a")
const WALL := Color("a39a8d")
const WALL_D := Color("5e5a66")
const SITE := Color("d2b06e")
const GREEN := Color("4fe39a")
const RED := Color("ff4655")


func _init() -> void:
	map_name = "TRIAD"
	map_tag = "3 SITES  /  ATTACK VS DEFEND  /  72 x 44"
	sky_top = Color("2f5f7a")
	sky_horizon = Color("d9f0d0")
	ground_color = Color("3f4a3f")
	sun_color = Color("fff3d1")
	sun_energy = 1.1
	sun_rotation = Vector3(-48, 40, 0)
	ambient_energy = 1.5


func build() -> void:
	arena_shell(36, 22, 12, FLOOR, WALL_D)
	# attacker gate: mid gap |z|<3.5, lane gaps z 12..18
	box(Vector3(-30, 0, 3.5), Vector3(0.6, 3.5, 8.5), WALL, false, true)
	box(Vector3(-30, 0, 18), Vector3(0.6, 3.5, 4), WALL, false, true)
	# lane walls with mid door x -12..-8
	box(Vector3(-29.4, 0, 8), Vector3(17.4, 3.5, 0.6), WALL, false, true)
	box(Vector3(-8, 0, 8), Vector3(16, 3.5, 0.6), WALL, false, true)
	# defender wall: B gap |z|<4, A/C doors z 12..18
	box(Vector3(30, 0, 4), Vector3(0.6, 3.5, 8), WALL, false, true)
	box(Vector3(30, 0, 18), Vector3(0.6, 3.5, 4), WALL, false, true)
	# B platform + ramps
	box(Vector3(16, 0, -6), Vector3(8, 1.6, 12), WALL_D)
	ramp(Vector3(8, 0, -3), Vector3(8, 1.6, 6), 0, SITE)
	ramp(Vector3(24, 0, -3), Vector3(6, 1.6, 6), 1, SITE)
	# mid + site cover
	prism(Vector2(-16, 5), 0, 3, 1.2, 8, WALL_D, 22.5, false, true)
	box(Vector3(0, 0, 4), Vector3(3, 1.2, 2), SITE, false, true)
	box(Vector3(16, 0, 12), Vector3(2.4, 1.2, 2.4), SITE, false, true)
	box(Vector3(22, 0, 17), Vector3(3, 2.6, 1), WALL, false, true)
	box(Vector3(12, 0, 19), Vector3(2, 1.2, 2), SITE, false, true)
	light_strip(Vector2(-29.7, -21), Vector2(-29.7, 21), 3.5, GREEN)
	light_strip(Vector2(30.3, -21), Vector2(30.3, 21), 3.5, RED)
	# spawns
	spawn(Vector3(-33, 0.05, 0), 270)
	spawn(Vector3(-33, 0.05, 10), 270, false, true)
	spawn(Vector3(34, 0.05, 0), 90)
	spawn(Vector3(34, 0.05, 12), 90, false, true)
	for p in [Vector3(14, 3.5, 15), Vector3(14, 3.5, -15), Vector3(0, 5, 0), Vector3(-15, 4, 0), Vector3(20, 4.5, 0), Vector3(-15, 4, 14), Vector3(-15, 4, -14)]:
		enemy_spawns.append(p)
	nav_paths = [
		PackedVector3Array([Vector3(-33, 0.05, 0), Vector3(-25, 0, 0), Vector3(-10, 0, 0), Vector3(6, 0, 0), Vector3(8.5, 0, 0), Vector3(12, 0.8, 0),
			Vector3(16, 1.6, 0), Vector3(20, 1.6, 0), Vector3(24, 1.6, 0), Vector3(27, 0.8, 0), Vector3(31, 0, 0), Vector3(34, 0, 0)]),
		PackedVector3Array([Vector3(-33, 0.05, 10), Vector3(-33, 0, 15), Vector3(-25, 0, 15), Vector3(-10, 0, 15), Vector3(10, 0, 16), Vector3(28, 0, 16), Vector3(33, 0, 15)]),
		PackedVector3Array([Vector3(-33, 0.05, -10), Vector3(-33, 0, -15), Vector3(-25, 0, -15), Vector3(-10, 0, -15), Vector3(10, 0, -16), Vector3(28, 0, -16), Vector3(33, 0, -15)]),
	]
