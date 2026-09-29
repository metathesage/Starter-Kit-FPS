class_name SurvivalMap
extends Node3D

## "SECTOR 7": five rooms, four buyable doors, nine breach windows. Built
## entirely at runtime from boxes so the layout is tunable in code.
##
##   [CHAPEL - door 500]        [ROOFTOP - door 2500]
##   ammo station               OVERCLOCK bench
##        |                          |
## [START] -750- [COURTYARD] -1000- [INFIRMARY]
##  MA5K start   M90-free? no: wall pickups are later phases; now: 3 open rooms
##
## Doors: start->courtyard 750, courtyard->chapel 500, courtyard->infirmary
## 1000, infirmary->rooftop 2500.

var windows: Array[Vector3] = []
var doors: Array[BuyDoor] = []
var stations: Array[Interactable] = []

var _wall_mat: StandardMaterial3D
var _floor_mat: StandardMaterial3D
var _door_closed_mat: StandardMaterial3D
var _door_open_mat: StandardMaterial3D


func build() -> void:
	_wall_mat = _mat(Color(0.32, 0.34, 0.40))
	_floor_mat = _mat(Color(0.16, 0.16, 0.20))
	_door_closed_mat = _mat(Color(0.10, 0.75, 0.85))
	_door_open_mat = _mat(Color(0.30, 0.90, 0.50))

	_light()
	_floors()
	_walls()
	_doors()
	_window_frames()
	_stations()


func _light() -> void:
	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.rotation_degrees = Vector3(-55.0, 30.0, 0.0)
	sun.light_energy = 0.9
	add_child(sun)

	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.07, 0.03, 0.11)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.45, 0.4, 0.6)
	env.ambient_light_energy = 0.7
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)


func _floors() -> void:
	_box(Vector3(-4, -0.1, 0), Vector3(8, 0.2, 8), _floor_mat)      # start
	_box(Vector3(6, -0.1, 0), Vector3(12, 0.2, 12), _floor_mat)     # courtyard
	_box(Vector3(6, -0.1, -9), Vector3(8, 0.2, 6), _floor_mat)      # chapel
	_box(Vector3(17, -0.1, 0), Vector3(10, 0.2, 8), _floor_mat)     # infirmary
	_box(Vector3(18, -0.1, -11), Vector3(8, 0.2, 6), _floor_mat)    # rooftop
	# Fallback plane: never let the player fall through the world.
	_box(Vector3(0, -1.25, 0), Vector3(300, 0.1, 300), _floor_mat)


func _walls() -> void:
	# START room (x -8..0, z -4..4)
	_wall(Vector2(-8, -4), Vector2(-8, 4))
	_wall(Vector2(-8, -4), Vector2(0, -4))
	_wall(Vector2(-8, 4), Vector2(0, 4))
	_wall(Vector2(0, -4), Vector2(0, -1))
	_wall(Vector2(0, 1), Vector2(0, 4))

	# COURTYARD (x 0..12, z -6..6); west segments close its own box
	_wall(Vector2(0, -6), Vector2(0, -4))
	_wall(Vector2(0, 4), Vector2(0, 6))
	_wall(Vector2(0, 6), Vector2(12, 6))
	_wall(Vector2(0, -6), Vector2(3, -6))
	_wall(Vector2(5, -6), Vector2(12, -6))
	_wall(Vector2(12, -6), Vector2(12, -1))
	_wall(Vector2(12, 1), Vector2(12, 6))

	# CHAPEL (x 2..10, z -12..-6)
	_wall(Vector2(2, -12), Vector2(2, -6))
	_wall(Vector2(10, -12), Vector2(10, -6))
	_wall(Vector2(2, -12), Vector2(10, -12))

	# INFIRMARY (x 12..22, z -4..4)
	_wall(Vector2(22, -4), Vector2(22, 4))
	_wall(Vector2(12, 4), Vector2(22, 4))
	_wall(Vector2(12, -4), Vector2(16, -4))
	_wall(Vector2(18, -4), Vector2(22, -4))

	# ROOFTOP (x 14..22, z -14..-8) - approached through the infirmary gate
	_wall(Vector2(14, -14), Vector2(22, -14))
	_wall(Vector2(14, -14), Vector2(14, -8))
	_wall(Vector2(22, -14), Vector2(22, -8))
	_wall(Vector2(14, -8), Vector2(16, -8))
	_wall(Vector2(18, -8), Vector2(22, -8))


func _doors() -> void:
	_door(Vector3(0, 2, 0), true, 750)     # start -> courtyard
	_door(Vector3(4, 2, -6), false, 500)   # courtyard -> chapel
	_door(Vector3(12, 2, 0), true, 1000)   # courtyard -> infirmary
	_door(Vector3(17, 2, -4), false, 2500) # infirmary -> rooftop


func _window_frames() -> void:
	var frames := [
		Vector3(-8, 1.3, 0), Vector3(4, 1.3, 6), Vector3(9, 1.3, 6),
		Vector3(3, 1.3, -12), Vector3(8, 1.3, -12), Vector3(13, 1.3, 4),
		Vector3(17, 1.3, 4), Vector3(21, 1.3, 4), Vector3(18, 1.3, -14),
	]
	windows = [
		Vector3(-7.2, 0, 0), Vector3(4, 0, 5.2), Vector3(9, 0, 5.2),
		Vector3(3, 0, -11.2), Vector3(8, 0, -11.2), Vector3(13, 0, 3.2),
		Vector3(17, 0, 3.2), Vector3(21, 0, 3.2), Vector3(18, 0, -13.2),
	]
	for f in frames:
		var frame := _box(f, Vector3(1.6, 1.2, 0.4), _mat(Color(0.9, 0.7, 0.2)))
		frame.name = "WindowFrame"


func _stations() -> void:
	var ammo := AmmoStation.new()
	ammo.name = "AmmoStation"
	ammo.position = Vector3(6, 0, -9)
	add_child(ammo)
	_box(Vector3(6, 0.5, -9), Vector3(1.0, 1.0, 1.0), _mat(Color(0.2, 0.8, 0.4)))
	stations.append(ammo)

	var bench := OverclockStation.new()
	bench.name = "OverclockStation"
	bench.position = Vector3(18, 0, -11)
	add_child(bench)
	_box(Vector3(18, 0.5, -11), Vector3(1.2, 1.0, 1.2), _mat(Color(1.0, 0.82, 0.2)))
	stations.append(bench)


func _door(at: Vector3, along_x_wall: bool, cost: int) -> void:
	var size := Vector3(0.3, 4.0, 2.0) if along_x_wall else Vector3(2.0, 4.0, 0.3)
	var door_body := _box(at, size, _door_closed_mat)
	door_body.name = "DoorBody"
	var door := BuyDoor.new()
	door.name = "Door_%d" % cost
	door.position = at + Vector3(0, -2, 0)
	add_child(door)
	door.setup(null, cost, door_body)
	doors.append(door)


func _mat(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.9
	return m


func _wall(a: Vector2, b: Vector2) -> StaticBody3D:
	var d := b - a
	var len := d.length()
	var size := Vector3(len, 4.0, 0.3) if absf(d.x) > absf(d.y) else Vector3(0.3, 4.0, len)
	var center := Vector3((a.x + b.x) * 0.5, 2.0, (a.y + b.y) * 0.5)
	return _box(center, size, _wall_mat)


func _box(center: Vector3, size: Vector3, mat: StandardMaterial3D) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.position = center
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	mesh.mesh = box
	body.add_child(mesh)
	var shape := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	shape.shape = bs
	body.add_child(shape)
	mesh.material_override = mat
	add_child(body)
	return body
