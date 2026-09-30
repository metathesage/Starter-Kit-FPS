extends LevelKit
## BEAVER CREEK — Halo CE style: flat colour, chunky blocks, zero textures.
## Red bunker (+X) / Blue bunker (-X). 60m x 48m.
## Walk-through halls, roof ramps, a rail bridge across the middle, mid plinth, cover walls.

const CONCRETE := Color("7f8b7a")
const CONCRETE_D := Color("56635a")
const ROCK := Color("a5987a")
const ROCK_D := Color("8f8466")
const METAL := Color("4c5966")
const RED := Color("d23a2c")
const BLUE := Color("2f66d6")
const RAIL := Color("c9d6a2")


func _init() -> void:
	map_name = "BEAVER CREEK"
	map_tag = "2 BASE  /  SYMMETRIC  /  60 x 48"
	sky_top = Color("6d9ccf")
	sky_horizon = Color("d5e2d0")
	ground_color = Color("6b6752")
	sun_color = Color("fff4d6")
	sun_energy = 0.95
	sun_rotation = Vector3(-50, -35, 0)
	ambient_energy = 1.6


func build() -> void:
	arena_shell(30, 24, 12, ROCK_D, ROCK)

	# ---------- bunkers (mirrored in X) ----------
	box(Vector3(27, 0, -9), Vector3(1.5, 3.5, 18), CONCRETE_D, true)              # back wall
	box(Vector3(16, 0, 8), Vector3(4, 3.5, 1), CONCRETE_D, true, true)            # side walls with 4m door at x 20..24
	box(Vector3(24, 0, 8), Vector3(4.5, 3.5, 1), CONCRETE_D, true, true)
	box(Vector3(16, 3.5, -9), Vector3(12.5, 1.5, 18), CONCRETE, true)             # roof slab, top y=5
	prism(Vector2(17.5, 4), 0, 3.5, 0.9, 6, CONCRETE, 0, true, true)              # hall pillars
	box(Vector3(23, 0, 0), Vector3(2, 1, 2), METAL, true)                        # hall crate

	# roof ramps outside the bunker flanks
	ramp(Vector3(21, 0, 9), Vector3(6, 5, 10), 3, ROCK, true, true)

	# roof barriers
	barrier(Vector2(16.15, 2.5), Vector2(16.15, 9), 5, RAIL, 3.5, true, true)
	barrier(Vector2(16, 9.15), Vector2(21, 9.15), 5, RAIL, 3.5, true, true)
	barrier(Vector2(27, 9.15), Vector2(28.5, 9.15), 5, RAIL, 3.5, true, true)
	barrier(Vector2(28.35, -9), Vector2(28.35, 9), 5, RAIL, 3.5, true)

	# team colours: block on the roof edge, not mirrored
	box(Vector3(16.5, 5, -1.5), Vector3(0.6, 0.5, 3), RED)
	box(Vector3(-17.1, 5, -1.5), Vector3(0.6, 0.5, 3), BLUE)
	box(Vector3(27.2, 1.0, -3), Vector3(0.3, 1.5, 6), RED)
	box(Vector3(-27.5, 1.0, -3), Vector3(0.3, 1.5, 6), BLUE)

	# ---------- middle ----------
	box(Vector3(-16.5, 4.4, -2.5), Vector3(33, 0.6, 5), METAL)                    # bridge, top y=5
	barrier(Vector2(-16, 2.65), Vector2(16, 2.65), 5, RAIL, 3.5, false, true)
	prism(Vector2.ZERO, 0, 1.2, 4.5, 8, ROCK, 22.5)                                # plinth
	prism(Vector2(0, 9), 0, 2.6, 1.4, 6, CONCRETE, 0, false, true)                # pillars

	# ---------- cover ----------
	box(Vector3(7, 0, 10), Vector3(6, 2.5, 1.2), CONCRETE, true, true)
	box(Vector3(9, 0, 5), Vector3(1.2, 2.5, 6), CONCRETE_D, true, true)
	box(Vector3(-2, 0, 14.5), Vector3(4, 1.2, 4), ROCK_D, false, true)

	# ---------- spawns / enemies / nav ----------
	spawn(Vector3(22, 0.05, 4), 90, true, true)
	spawn(Vector3(19, 0.05, 0), 90, true)
	spawn(Vector3(15, 0.05, 15), 90, true, true)
	for p in [Vector3(10, 3.2, 8), Vector3(10, 3.2, -8), Vector3(-10, 3.2, 8), Vector3(-10, 3.2, -8), Vector3(0, 7.5, 0)]:
		enemy_spawns.append(p)

	nav_paths = [
		PackedVector3Array([Vector3(22, 0.05, 4), Vector3(15, 0, 0), Vector3(15, 0, 14), Vector3(15, 0, 22), Vector3(24, 0, 22),
			Vector3(24, 1, 17), Vector3(24, 2.5, 14), Vector3(24, 4.6, 10), Vector3(22, 5, 4), Vector3(18, 5, 0), Vector3(8, 5, 0), Vector3(0, 5, 0),
			Vector3(-8, 5, 0), Vector3(-18, 5, 0)]),
		PackedVector3Array([Vector3(15, 0.05, 15), Vector3(15, 0, 0), Vector3(0, 0, 0), Vector3(-12, 0, 0), Vector3(-15, 0, -4),
			Vector3(-22, 0, -4), Vector3(-22, 0, 0), Vector3(-22, 0, 5)]),
	]
