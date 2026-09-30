extends SceneTree
## Reference viewer: godot --rendering-driver opengl3 -s tools/ref_view.gd -- /path/model.glb /out/prefix
var f := 0
var out := ""
var node: Node3D
var cam: Camera3D
var views := []
var vi := 0

func _initialize() -> void:
	var a := OS.get_cmdline_user_args()
	out = a[1]
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	var err := doc.append_from_file(a[0], st)
	print("load err ", err)
	node = doc.generate_scene(st)
	root.add_child(node)
	root.size = Vector2i(1400, 1000)
	var aabb := AABB()
	var first := true
	var meshes := 0
	var tris := 0
	for m in node.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		var b := mi.global_transform * mi.get_aabb()
		aabb = b if first else aabb.merge(b)
		first = false
		meshes += 1
		for s in mi.mesh.get_surface_count():
			tris += mi.mesh.surface_get_array_len(s)
	print("meshes ", meshes, " verts ", tris, " aabb ", aabb)
	var c := aabb.get_center()
	var sz := aabb.size
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-60, 30, 0)
	root.add_child(sun)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.1, 0.12, 0.16)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.8, 0.8, 0.85)
	env.ambient_light_energy = 0.7
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)
	cam = Camera3D.new()
	root.add_child(cam)
	cam.current = true
	cam.far = 3000
	var r := maxf(sz.x, sz.z)
	# top ortho, and 3 perspective
	views = [
		["top", "ortho", c + Vector3(0, sz.y * 3 + 50, 0), c, r * 1.05],
		["persp1", "persp", c + Vector3(r * 0.9, r * 0.7, r * 0.9), c, 0.0],
		["persp2", "persp", c + Vector3(-r * 0.9, r * 0.7, r * 0.9), c, 0.0],
		["side", "ortho", c + Vector3(0, 0, r * 3), c, maxf(sz.x, sz.y) * 1.05],
	]

func _process(_d: float) -> bool:
	f += 1
	if f % 5 != 0: return false
	if vi > 0:
		root.get_texture().get_image().save_png("%s_%s.png" % [out, views[vi - 1][0]])
	if vi >= views.size():
		quit()
		return false
	var v = views[vi]
	if v[1] == "ortho":
		cam.projection = Camera3D.PROJECTION_ORTHOGONAL
		cam.size = v[4]
		cam.position = v[2]
		if v[0] == "top":
			cam.rotation_degrees = Vector3(-90, 0, 0)
		else:
			cam.look_at(v[3])
	else:
		cam.projection = Camera3D.PROJECTION_PERSPECTIVE
		cam.fov = 60
		cam.position = v[2]
		cam.look_at(v[3])
	vi += 1
	return false
