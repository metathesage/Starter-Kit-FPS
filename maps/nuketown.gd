extends LevelKit
## NUKETOWN 24/7 — two mirrored two-storey houses, one street, no downtime.
## 60m x 34m. Cyan house (-X) vs Amber house (+X). Doors, jump-in windows, a stair in each house,
## gable roofs you can walk, bus + cars for cover, backyards. Sky ring overhead.

const WALL := Color("9aa3ad")
const WALL_D := Color("6c7580")
const SLAB := Color("454d59")
const LAWN := Color("6f8a58")
const ROAD := Color("6a717c")
const PAINT := Color("d8dde3")
const CYAN := Color("39e3ff")
const AMBER := Color("ffa02b")
const HAZ := Color("d9a82a")
const OLIVE := Color("58654a")
const T := 0.4          # wall thickness
const H1 := 3.2         # ground story height
const FL2 := 3.5        # second floor top
const H2 := 6.5         # second story top


func _init() -> void:
	map_name = "NUKETOWN 24/7"
	map_tag = "2 HOUSES  /  ZERO DOWNTIME  /  60 x 34"
	sky_top = Color("1d3f7a")
	sky_horizon = Color("ffd0a0")
	ground_color = Color("4a5a40")
	sun_color = Color("ffe2b8")
	sun_energy = 1.1
	sun_rotation = Vector3(-32, -60, 0)
	ambient_energy = 1.5


# mirrored-in-X box from x/y/z ranges
func _b(x0: float, x1: float, y0: float, y1: float, z0: float, z1: float, c: Color, mz := false) -> void:
	box(Vector3(x0, y0, z0), Vector3(x1 - x0, y1 - y0, z1 - z0), c, true, mz)


# a wall running along Z at x0..x0+T with the door / window pattern of a house face
func _face_z(x0: float) -> void:
	var x1 := x0 + T
	for band in [[0.0, H1], [FL2, H2]]:
		var y0: float = band[0]
		var y1: float = band[1]
		var wins: Array = [[-5.2, -3.2], [3.2, 5.2]]
		if y0 == 0.0:
			wins.append([-1.2, 1.2])   # door
		else:
			wins.append([-1.0, 1.0])
		wins.sort_custom(func(a, b): return a[0] < b[0])
		var cur := -7.0
		for w in wins:
			_b(x0, x1, y0, y1, cur, w[0], WALL)
			var is_door: bool = y0 == 0.0 and w[0] == -1.2
			var sill := y0 if is_door else y0 + 1.0
			var top := y0 + 2.5 if is_door else y0 + 2.2
			if not is_door:
				_b(x0, x1, y0, sill, w[0], w[1], WALL)
			_b(x0, x1, top, y1, w[0], w[1], WALL)
			cur = w[1]
		_b(x0, x1, y0, y1, cur, 7.0, WALL)
	_b(x0, x1, H1, FL2, -7.0, 7.0, SLAB)


func _house() -> void:
	# floor band of the house on the lawn is the arena floor; walls:
	_face_z(15.0)     # street-facing wall
	_face_z(25.0)     # back wall
	# side walls (z = +-7), windows at x 17..19 and 22..24 on both floors
	for band in [[0.0, H1], [FL2, H2]]:
		var y0: float = band[0]
		var y1: float = band[1]
		var cur := 15.0
		for w in [[17.0, 19.0], [22.0, 24.0]]:
			_b(cur, w[0], y0, y1, 6.6, 7.0, WALL, true)
			_b(w[0], w[1], y0, y0 + 1.0, 6.6, 7.0, WALL, true)
			_b(w[0], w[1], y0 + 2.2, y1, 6.6, 7.0, WALL, true)
			cur = w[1]
		_b(cur, 25.4, y0, y1, 6.6, 7.0, WALL, true)
	_b(15.0, 25.4, H1, FL2, 6.6, 7.0, SLAB, true)
	# partitions with a 3m doorway
	_b(19.4, 19.8, 0, H1, -6.6, -5.0, WALL_D)
	_b(19.4, 19.8, 0, H1, -2.0, 6.6, WALL_D)
	_b(19.4, 19.8, 2.5, H1, -5.0, -2.0, WALL_D)
	_b(19.4, 19.8, FL2, H2, -6.6, -4.0, WALL_D)
	_b(19.4, 19.8, FL2, H2, -1.0, 6.6, WALL_D)
	_b(19.4, 19.8, FL2 + 2.5, H2, -4.0, -1.0, WALL_D)
	# upper slab with the stair hole (x 21..23.4, z -2.6..3.8)
	_b(15.4, 25.0, H1, FL2, -6.6, -2.6, SLAB)
	_b(15.4, 21.0, H1, FL2, -2.6, 3.8, SLAB)
	_b(23.4, 25.0, H1, FL2, -2.6, 3.8, SLAB)
	_b(15.4, 25.0, H1, FL2, 3.8, 6.6, SLAB)
	# stair: rises toward +Z, foot is open to the room
	ramp(Vector3(21.0, 0, -2.6), Vector3(2.4, FL2, 6.4), 2, WALL_D, true)
	# ceiling + gable roof (walkable)
	_b(15.0, 25.4, H2, H2 + 0.3, -7.0, 7.0, SLAB)
	box(Vector3(15.0, H2 + 0.3, -7.0), Vector3(10.4, 1.6, 7.0), OLIVE, true, false)
	box(Vector3(15.0, H2 + 0.3, 0.0), Vector3(10.4, 1.6, 7.0), OLIVE, true, false)
	# interior dressing (all jump-height or above, no dead ends)
	_b(15.4, 17.4, 0, 0.9, -6.6, -5.4, WALL_D)
	_b(15.4, 17.4, 0, 1.0, 5.0, 6.6, WALL_D)
	_b(15.4, 17.4, FL2, FL2 + 1.0, 3.6, 5.4, WALL_D)


func build() -> void:
	arena_shell(30, 17, 10, LAWN, WALL_D)
	sky_ring(1000.0, 64.0)
	# street + paint (visual only)
	flat(Vector2(-15, -17), Vector2(30, 34), 0.0, ROAD)
	for i in 5:
		flat(Vector2(-13.0 + i * 5.5, -0.15), Vector2(3.0, 0.3), 0.01, PAINT)
	flat(Vector2(15, -1.5), Vector2(3, 3), 0.0, HAZ, true)
	# houses
	_house()
	# ---------- street cover ----------
	box(Vector3(-5, 0, -11.5), Vector3(10, 3.0, 2.8), OLIVE)                   # bus
	box(Vector3(-4.6, 0, -8.7), Vector3(9.2, 0.05, 0.05), HAZ, false, false, Kind.GLOW)
	seg(Vector2(-9, 9.6), Vector2(-4.6, 10.4), 1.9, 0, 1.25, WALL_D, true)     # cars
	seg(Vector2(4.0, 6.2), Vector2(8.4, 5.6), 1.9, 0, 1.25, HAZ, true)
	prism(Vector2.ZERO, 0, 1.0, 2.6, 8, WALL, 22.5)                            # centre plinth
	prism(Vector2.ZERO, 1.0, 1.04, 2.2, 8, CYAN, 22.5, false, false, Kind.GLOW, false)
	# front-yard fences (jump-height)
	box(Vector3(9, 0, 10), Vector3(6, 1.1, 0.25), WALL, true, true)
	box(Vector3(9, 0, -10.25), Vector3(6, 1.1, 0.25), WALL, true, false)
	# backyard sheds
	box(Vector3(26.6, 0, 11), Vector3(3, 2.4, 4), WALL_D, true, true)
	# team trim (not mirrored)
	light_strip(Vector2(14.8, -6.8), Vector2(14.8, 6.8), 3.3, AMBER)
	light_strip(Vector2(-14.8, -6.8), Vector2(-14.8, 6.8), 3.3, CYAN)
	light_strip(Vector2(14.8, -6.8), Vector2(14.8, 6.8), 6.3, AMBER)
	light_strip(Vector2(-14.8, -6.8), Vector2(-14.8, 6.8), 6.3, CYAN)

	# ---------- spawns / enemies / nav ----------
	spawn(Vector3(17.5, 0.05, -4), 90, true, true)
	spawn(Vector3(17.5, 0.05, 4), 90, true, true)
	spawn(Vector3(27.5, 0.05, 0), 90, true)
	spawn(Vector3(11, 0.05, 13), 90, true, true)
	for p in [Vector3(9, 3.8, 6), Vector3(9, 3.8, -6), Vector3(-9, 3.8, 6), Vector3(-9, 3.8, -6), Vector3(0, 5.0, 0), Vector3(0, 4.0, 13), Vector3(0, 4.0, -14)]:
		enemy_spawns.append(p)
	nav_paths = [
		PackedVector3Array([Vector3(17.5, 0.05, -4), Vector3(17.5, 0, -3.6), Vector3(20.6, 0, -3.6), Vector3(22.2, 0, -3.6),
			Vector3(22.2, 1.75, 0.6), Vector3(22.2, 3.5, 5.2), Vector3(20.4, 3.5, 5.5), Vector3(20.4, 3.5, -2.5), Vector3(17, 3.5, -2.5)]),
		PackedVector3Array([Vector3(17.5, 0.05, 4), Vector3(17, 0, 0), Vector3(13, 0, 0), Vector3(5, 0, 0), Vector3(0, 0, 4),
			Vector3(-13, 0, 0), Vector3(-17, 0, 0), Vector3(-17.5, 0, -3.6), Vector3(-22.2, 0, -3.6), Vector3(-22.2, 1.75, 0.6), Vector3(-22.2, 3.5, 5.2)]),
		PackedVector3Array([Vector3(27.5, 0.05, 0), Vector3(26.5, 0, 0), Vector3(24.2, 0, 0), Vector3(24.2, 0, -3.6), Vector3(20.4, 0, -3.6), Vector3(17, 0, -3.6), Vector3(13, 0, 0)]),
	]
