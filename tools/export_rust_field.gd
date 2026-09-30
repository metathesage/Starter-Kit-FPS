extends SceneTree
## Converts the real Rust mesh into a 1 m heightfield of AABB columns (walkable approximation for the web port).
var a
var f := 0
func _initialize() -> void:
	a = load("res://scenes/arena.tscn").instantiate()
	a.map_id = "rust"
	root.add_child(a)
func _physics_process(_d: float) -> bool:
	f += 1
	if f == 4:
		var ss = a.get_world_3d().direct_space_state
		var X0 := -28; var X1 := 28; var Z0 := -28; var Z1 := 28
		var H := {}
		for z in range(Z0, Z1):
			for x in range(X0, X1):
				var q = PhysicsRayQueryParameters3D.create(Vector3(x + 0.5, 33, z + 0.5), Vector3(x + 0.5, -20, z + 0.5))
				var r = ss.intersect_ray(q)
				if r.is_empty(): continue
				var y: float = snappedf(r.position.y, 0.2)
				if y > 0.25 and y < 14.0: H[Vector2i(x, z)] = y
		# greedy merge: runs along x, then stack identical runs along z
		var runs := {}
		for z in range(Z0, Z1):
			var x := X0
			while x < X1:
				if H.has(Vector2i(x, z)):
					var y: float = H[Vector2i(x, z)]
					var e := x
					while e + 1 < X1 and H.has(Vector2i(e + 1, z)) and H[Vector2i(e + 1, z)] == y: e += 1
					runs[Vector3i(x, e + 1, z)] = y
					x = e + 1
				else:
					x += 1
		var boxes := []
		var used := {}
		for z in range(Z0, Z1):
			for k in runs.keys():
				if k.z != z or used.has(k): continue
				var y: float = runs[k]
				var z2 := z
				used[k] = true
				while runs.has(Vector3i(k.x, k.y, z2 + 1)) and runs[Vector3i(k.x, k.y, z2 + 1)] == y:
					z2 += 1
					used[Vector3i(k.x, k.y, z2)] = true
				boxes.append([k.x, k.y, z, z2 + 1, 0.0, y, "rust"])
		var sp := []
		for s in a.map.spawns: sp.append([snappedf(s.pos.x, 0.01), snappedf(s.pos.y, 0.01), snappedf(s.pos.z, 0.01), snappedf(s.yaw, 0.001)])
		var d := {"id": "rust", "name": "RUST", "tag": a.map.map_tag, "bounds": [28.0, 27.7, 34.0], "solids": boxes, "spawns": sp, "paths": [],
			"sky": [a.map.sky_top.to_html(false), a.map.sky_horizon.to_html(false), a.map.sun_color.to_html(false), a.map.fog_color.to_html(false), 0.004, a.map.sun_energy, false]}
		var fh := FileAccess.open("/tmp/mapdata/rust.json", FileAccess.WRITE)
		fh.store_string(JSON.stringify(d)); fh.close()
		print("rust boxes=", boxes.size(), " cells=", H.size())
		quit()
	return false
