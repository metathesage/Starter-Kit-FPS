extends LevelKit
## TERMINAL — airport concourse. Ground floor with a luggage carousel, shop kiosks and check-in
## desks; a mezzanine gallery on both long sides joined by a centre bridge; escalator ramps at
## both ends. 70m x 36m, mirrored in X and Z.

const FLOOR := Color("c9c3b4")
const WALL := Color("8b95a3")
const WALL_D := Color("5c6675")
const GALLERY := Color("a8b0bd")
const KIOSK := Color("d9a441")
const STEEL := Color("6e7885")
const GLOW := Color("39e3ff")
const RED := Color("d8483a")


func _init() -> void:
	map_name = "TERMINAL"
	map_tag = "CONCOURSE  /  70 x 36"
	sky_top = Color("2c5d9c")
	sky_horizon = Color("f4e2c6")
	ground_color = Color("55524a")
	sun_color = Color("fff0d6")
	sun_energy = 0.9
	sun_rotation = Vector3(-50, 20, 0)
	ambient_energy = 1.7


func build() -> void:
	arena_shell(35, 18, 12, FLOOR, WALL)
	# mezzanine
	box(Vector3(-18, 4.5, 9), Vector3(36, 0.5, 9), GALLERY, false, true)
	box(Vector3(-4, 4.5, -9), Vector3(8, 0.5, 18), GALLERY)
	ramp(Vector3(18, 0, 11), Vector3(10, 5, 4), 1, STEEL, true, true)
	for x in [-14.0, -7.0, 7.0, 14.0]:
		prism(Vector2(x, 9.4), 0, 4.5, 0.5, 6, WALL_D, 0, false, true)
	# mezzanine barriers
	barrier(Vector2(-17.8, 9.15), Vector2(-4, 9.15), 5, GLOW, 3.5, false, true)
	barrier(Vector2(4, 9.15), Vector2(17.8, 9.15), 5, GLOW, 3.5, false, true)
	barrier(Vector2(17.85, 9), Vector2(17.85, 11), 5, GLOW, 3.5, true, true)
	barrier(Vector2(17.85, 15), Vector2(17.85, 17.8), 5, GLOW, 3.5, true, true)
	barrier(Vector2(3.85, -9), Vector2(3.85, 9), 5, GLOW, 3.5, true)
	# ground: shops under the galleries, desks, carousel
	box(Vector3(8, 0, 11), Vector3(6, 3.2, 4), KIOSK, true, true)
	box(Vector3(18, 0, -8), Vector3(8, 1.1, 2), WALL_D, true, true)
	prism(Vector2.ZERO, 0, 0.9, 4, 8, STEEL, 22.5)
	prism(Vector2.ZERO, 0.9, 0.94, 3.4, 8, GLOW, 22.5, false, false, Kind.GLOW, false)
	# mezzanine dressing
	box(Vector3(-12, 5, 13), Vector3(4, 1.1, 2), WALL_D, true, true)
	# departure board strips
	light_strip(Vector2(-34.6, -16), Vector2(-34.6, 16), 6, RED)
	light_strip(Vector2(34.6, -16), Vector2(34.6, 16), 6, GLOW)
	# spawns / enemies
	spawn(Vector3(30, 0.05, 0), 90, true)
	spawn(Vector3(30, 0.05, 6), 90, true, true)
	for p in [Vector3(20, 3.6, 4), Vector3(-20, 3.6, 4), Vector3(20, 3.6, -4), Vector3(-20, 3.6, -4), Vector3(0, 7.5, 0), Vector3(0, 3, 13), Vector3(0, 3, -13)]:
		enemy_spawns.append(p)
	nav_paths = [
		PackedVector3Array([Vector3(30, 0.05, 0), Vector3(30, 0, 13), Vector3(28, 0, 13), Vector3(23, 2.5, 13), Vector3(18.5, 4.9, 13),
			Vector3(10, 5, 13), Vector3(0, 5, 13), Vector3(0, 5, 5), Vector3(0, 5, -5), Vector3(0, 5, -13), Vector3(-10, 5, -13)]),
		PackedVector3Array([Vector3(30, 0.05, 0), Vector3(8, 0, 0), Vector3(0, 0, 5.6), Vector3(-8, 0, 0), Vector3(-30, 0, 0)]),
	]
