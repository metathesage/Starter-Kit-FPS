extends LevelKit
## LOCKOUT — two-base symmetric Forerunner arena.
## Blue base (+X) / Orange base (-X). 100m x 60m. Spartan scale (1.8m).
## Ground ring, elevated central tower on pylons, two bridges to the base decks,
## ramps up to every deck, energy barriers on every elevated edge. No voids.

const STONE := Color("59627a")
const STONE_D := Color("4b546b")
const STONE_L := Color("7b869f")
const SAND := Color("b8a684")
const SAND_D := Color("8a7b5f")
const CYAN := Color("39e3ff")
const ORANGE := Color("ff8a2b")
const TOWER_Y := 6.0


func _init() -> void:
	map_name = "LOCKOUT"
	map_tag = "2 BASE  /  SYMMETRIC  /  100 x 60"
	sky_top = Color("2d5b8f")
	sky_horizon = Color("f0c28e")
	ground_color = Color("6a5d48")
	sun_color = Color("ffd9a8")
	sun_energy = 1.05
	sun_rotation = Vector3(-38, 52, 0)
	ambient_energy = 1.5


func build() -> void:
	arena_shell(50, 30, 16, SAND, STONE_D)

	# ---------- bases (mirrored in X) ----------
	box(Vector3(45, 0, -13), Vector3(2, 6, 26), STONE, true)                     # back wall
	box(Vector3(26, 0, 5), Vector3(1.5, 5, 8), STONE, true, true)                # front wall, 10m doorway
	box(Vector3(26, 0, 12), Vector3(7, 5, 1), STONE, true, true)                 # side wall A
	box(Vector3(37, 0, 12), Vector3(9, 5, 1), STONE, true, true)                 # side wall B, 4m side door at x 33..37
	box(Vector3(26, 5, -13), Vector3(21, 1, 26), STONE_L, true)                  # deck
	prism(Vector2(36, 0), 0, 5, 1.4, 8, STONE_D, 22.5, true)                     # interior pillar
	box(Vector3(40, 0, 4.5), Vector3(2, 1.1, 4), STONE_D, true, true)            # interior cover

	# deck ramps, outside the base flanks (rise toward the deck at z=+-13)
	ramp(Vector3(40, 0, 13), Vector3(6, 6, 12), 3, SAND_D, true, true)

	# deck barriers
	barrier(Vector2(26.15, 3), Vector2(26.15, 13), 6, CYAN, 4, true, true)
	barrier(Vector2(26, 13.15), Vector2(40, 13.15), 6, CYAN, 4, true, true)
	barrier(Vector2(46.85, -13), Vector2(46.85, 13), 6, CYAN, 4, true)
	# team colour strips (not mirrored: blue +X, orange -X)
	light_strip(Vector2(26.3, -12.5), Vector2(26.3, 12.5), 4.6, CYAN)
	light_strip(Vector2(-26.3, -12.5), Vector2(-26.3, 12.5), 4.6, ORANGE)

	# ---------- central tower ----------
	for sx in [1, -1]:
		for sz in [1, -1]:
			box(Vector3(4 if sx > 0 else -7, 0, 4 if sz > 0 else -7), Vector3(3, 5, 3), STONE)
	prism(Vector2.ZERO, 5, TOWER_Y, 13, 8, STONE_L, 22.5)
	# ramps up to the tower (north/south)
	ramp(Vector3(-3, 0, 12), Vector3(6, TOWER_Y, 12), 3, SAND_D, false, true)
	# bridges to both bases
	box(Vector3(11.5, 5, -3), Vector3(15, 1, 6), STONE_L, true)
	barrier(Vector2(12, 3.15), Vector2(26, 3.15), 6, CYAN, 4, true, true)
	# tower rails: 8 edges, axis-facing ones have a gap for the bridge / ramp
	var r := 12.85
	for k in 8:
		var a0 := deg_to_rad(22.5 + 45.0 * k)
		var a1 := deg_to_rad(22.5 + 45.0 * (k + 1))
		var pa := Vector2(cos(a0), sin(a0)) * r
		var pb := Vector2(cos(a1), sin(a1)) * r
		if k % 2 == 1:
			var mid := (pa + pb) * 0.5
			var d := (pb - pa).normalized()
			barrier(pa, mid - d * 3.0, 6, CYAN)
			barrier(mid + d * 3.0, pb, 6, CYAN)
		else:
			barrier(pa, pb, 6, CYAN)

	# ---------- ground cover ----------
	box(Vector3(16, 0, 10), Vector3(4, 1.2, 4), SAND_D, true, true)
	box(Vector3(30, 0, 19), Vector3(6, 3, 1.5), STONE, true, true)
	for px in [10.0, 24.0]:
		prism(Vector2(px, 26.5), 0, 10, 1.5, 8, STONE_L, 22.5, true, true)
	box(Vector3(-2, 0, 22), Vector3(4, 1.2, 4), SAND_D, false, true)

	# ---------- spawns / enemies / nav ----------
	spawn(Vector3(31, 0.05, 8), 90, true, true)
	spawn(Vector3(31, 0.05, 0), 90, true)
	spawn(Vector3(33, 0.05, 22), 90, true, true)
	for p in [Vector3(20, 3.5, 12), Vector3(20, 3.5, -12), Vector3(-20, 3.5, 12), Vector3(-20, 3.5, -12),
			Vector3(0, 9, 0), Vector3(0, 4, 20), Vector3(0, 4, -20)]:
		enemy_spawns.append(p)

	# waypoint routes for tools/map_test.gd (positive-X half; symmetric elsewhere)
	nav_paths = [
		PackedVector3Array([Vector3(31, 0.05, 8), Vector3(30, 0, 3), Vector3(22, 0, 0), Vector3(8.5, 0, 0), Vector3(8.5, 0, -27),
			Vector3(0, 0, -27), Vector3(0, 0, -22), Vector3(0, 2, -18), Vector3(0, 5, -14), Vector3(0, 6, -8), Vector3(0, 6, 0), Vector3(12, 6, 0), Vector3(22, 6, 0),
			Vector3(30, 6, 0), Vector3(43, 6, 8), Vector3(43, 6, 12), Vector3(43, 3, 19), Vector3(43, 0, 24), Vector3(43, 0, 27), Vector3(38, 0, 27)]),
		PackedVector3Array([Vector3(33, 0.05, 22), Vector3(38, 0, 22), Vector3(38, 0, 16), Vector3(35, 0, 15), Vector3(35, 0, 9),
			Vector3(30, 0, 0), Vector3(-30, 0, 0), Vector3(-35, 0, -9), Vector3(-35, 0, -15), Vector3(-38, 0, -16), Vector3(-38, 0, -27), Vector3(-43, 0, -27), Vector3(-43, 3, -19),
			Vector3(-43, 6, -12), Vector3(-43, 6, -8), Vector3(-30, 6, 0), Vector3(-12, 6, 0), Vector3(0, 6, 0)]),
	]
