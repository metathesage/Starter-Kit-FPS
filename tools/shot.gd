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
	if id == "menu":
		root.add_child(load("res://scenes/menu.tscn").instantiate())
		root.size = Vector2i(1280, 720)
		return
	arena = load("res://scenes/arena.tscn").instantiate()
	arena.map_id = id
	root.add_child(arena)
	root.size = Vector2i(1280, 720)

func _process(_d: float) -> bool:
	f += 1
	if id == "menu":
		if f == 90:
			root.get_texture().get_image().save_png(out + "/menu.png")
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
		var views = [
			[Vector3(0, 55, 60), Vector3(0, 0, 0)] if id == "lockout" else [Vector3(0, 40, 45), Vector3.ZERO],
			[Vector3(-46, 14, 0), Vector3(0, 3, 0)] if id == "lockout" else [Vector3(-27, 10, 0), Vector3(0, 2, 0)],
			[Vector3(30, 9, 27), Vector3(0, 3, -4)] if id == "lockout" else [Vector3(24, 8, 21), Vector3(0, 2, -4)],
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
