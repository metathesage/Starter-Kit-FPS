extends LevelKit
## RUST — oil yard. Central sniper tower on stilts, shipping containers, drum clusters,
## two huts with walkable roofs. 56m x 40m, mirrored in X and Z.

const DIRT := Color("a07a52")
const RUST := Color("b0572b")
const RUST_D := Color("6f3a22")
const TIN := Color("8a8f8c")
const TIN_D := Color("5b605f")
const ORANGE := Color("e9812a")
const BLUE := Color("3d6f9e")
const GLOW := Color("ffb347")


func _init() -> void:
	map_name = "RUST"
	map_tag = "OIL YARD  /  56 x 40"
	sky_top = Color("6f9fd0")
	sky_horizon = Color("ffe1b0")
	ground_color = Color("6a5238")
	sun_color = Color("ffe6bd")
	sun_energy = 1.25
	sun_rotation = Vector3(-46, -40, 0)
	ambient_energy = 1.4


func build() -> void:
	arena_shell(28, 20, 10, DIRT, RUST_D)
	# tower
	box(Vector3(3, 0, 3), Vector3(1.2, 5.6, 1.2), TIN_D, true, true)
	box(Vector3(-4.5, 5.6, -4.5), Vector3(9, 0.4, 9), TIN)
	ramp(Vector3(-2, 0, 4.5), Vector3(4, 6, 12), 3, RUST, false, true)
	barrier(Vector2(-4.35, -4.5), Vector2(-4.35, 4.5), 6, GLOW, 3.5)
	barrier(Vector2(4.35, -4.5), Vector2(4.35, 4.5), 6, GLOW, 3.5)
	barrier(Vector2(-4.5, 4.35), Vector2(-2, 4.35), 6, GLOW, 3.5, false, true)
	barrier(Vector2(2, 4.35), Vector2(4.5, 4.35), 6, GLOW, 3.5, false, true)
	# containers
	box(Vector3(10, 0, 10), Vector3(8, 2.6, 2.6), BLUE, true, true)
	box(Vector3(8, 0, 3), Vector3(2.6, 2.6, 7), RUST, true, true)
	box(Vector3(-16, 0, -14), Vector3(10, 2.6, 2.6), ORANGE, false, false)
	# huts (touch the outer wall, no pockets): front door + side windows
	wall_z(-4, 4, 21, 0.4, 0, 3, TIN, [[-1.2, 1.2, 0, 2.5]], true)
	wall_x(21, 28, 3.6, 0.4, 0, 3, TIN, [[23, 25, 1.0, 2.2]], true, true)
	wall_z(-4, 4, 27.6, 0.4, 0, 3, TIN, [], true)
	box(Vector3(21, 3, -4), Vector3(7, 0.3, 8), TIN_D, true)
	ramp(Vector3(22, 0, 4), Vector3(4, 3.3, 7), 3, RUST_D, true, true)
	barrier(Vector2(21.15, -4), Vector2(21.15, 4), 3.3, GLOW, 3.5, true)
	barrier(Vector2(21, 3.85), Vector2(22, 3.85), 3.3, GLOW, 3.5, true, true)
	barrier(Vector2(26, 3.85), Vector2(27.8, 3.85), 3.3, GLOW, 3.5, true, true)
	# drums + pipe
	for d in [Vector2(12, -6), Vector2(13.3, -6.4), Vector2(12.6, -7.3)]:
		prism(d, 0, 1.0, 0.45, 8, ORANGE, 0, true)
	box(Vector3(-12, 0, -18), Vector3(24, 0.9, 0.6), RUST_D, false, true)
	# spawns / enemies
	spawn(Vector3(14, 0.05, 6), 90, true, true)
	spawn(Vector3(24, 0.05, 14), 90, true, true)
	for p in [Vector3(12, 3.5, 0), Vector3(-12, 3.5, 0), Vector3(0, 9, 0), Vector3(20, 4.5, 14), Vector3(-20, 4.5, -14), Vector3(0, 4, 14), Vector3(0, 4, -14)]:
		enemy_spawns.append(p)
	nav_paths = [
		PackedVector3Array([Vector3(14, 0.05, 6), Vector3(14, 0, 0), Vector3(6, 0, 0), Vector3(6, 0, 14), Vector3(6, 0, 18.5), Vector3(0, 0, 18.5),
			Vector3(0, 0, 17), Vector3(0, 3, 10), Vector3(0, 6, 4.8), Vector3(0, 6, 0), Vector3(0, 6, -4.8), Vector3(0, 3, -10), Vector3(0, 0, -17)]),
		PackedVector3Array([Vector3(14, 0.05, 6), Vector3(18, 0, 0), Vector3(24, 0, 0), Vector3(26, 0, -2), Vector3(21.8, 0, 0), Vector3(18, 0, 0), Vector3(18, 0, 8),
			Vector3(24, 0, 13), Vector3(24, 1.4, 8), Vector3(24, 3.3, 3)]),
	]
