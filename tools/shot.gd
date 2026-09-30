extends SceneTree
## Renders overview screenshots: godot --rendering-driver opengl3 --path . -s tools/shot.gd -- lockout /out/dir
var arena: Node3D
var cams := []
var i := 0
var f := 0
var out := "/tmp"
var id := "lockout"

func _initialize() -> void:
	var a := OS.get_cmdline_user_args()
	id = a[0]
	if a.size() > 1: out = a[1]
	if id == "menu" or id == "loadout":
		root.add_child(load("res://scenes/%s.tscn" % id).instantiate())
		root.size = Vector2i(1280, 720)
		return
	arena = load("res://scenes/arena.tscn").instantiate()
	arena.map_id = id
	root.add_child(arena)
	root.size = Vector2i(1280, 720)

func _process(_d: float) -> bool:
	f += 1
	if id == "menu" or id == "loadout":
		if f == 90:
			root.get_texture().get_image().save_png(out + "/" + id + ".png")
			quit()
		return false
	if f == 3:
		var p = arena.player
		p.get_node("Head/Camera").current = false
		var cam := Camera3D.new()
		cam.name = "ShotCam"
		arena.add_child(cam)
		cam.current = true
		cam.far = 400
		var bd: AABB = arena.map.bounds
		var ext := maxf(bd.size.x, bd.size.z)
		var sp: Dictionary = arena.map.spawns[0]
		var fwd := Vector3(-sin(sp.yaw), 0, -cos(sp.yaw))
		var views = [
			[Vector3(0, ext * 0.75, bd.size.z * 0.55), Vector3.ZERO],
			[sp.pos + Vector3(0, 1.6, 0) - fwd * 0.5, sp.pos + Vector3(0, 1.3, 0) + fwd * 10.0],
			[Vector3(-bd.size.x * 0.3, 8.0, bd.size.z * 0.4), Vector3(bd.size.x * 0.1, 2.0, 0)],
		]
		cams = views
	if f > 3 and f % 6 == 0 and i < cams.size() + 1:
		if i > 0:
			root.get_texture().get_image().save_png("%s/%s_%d.png" % [out, id, i])
		if i < cams.size():
			var cam: Camera3D = arena.get_node("ShotCam")
			cam.position = cams[i][0]
			cam.look_at(cams[i][1])
		i += 1
		if i > cams.size(): quit()
	return false
