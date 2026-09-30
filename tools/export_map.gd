extends SceneTree
## Exports a map's solids / spawns / paths as JSON for the web port:  godot --headless -s tools/export_map.gd -- nuketown /out
var a
var f := 0
var id := ""
var out := "/tmp"
func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	id = args[0]
	if args.size() > 1: out = args[1]
	a = load("res://scenes/arena.tscn").instantiate()
	a.map_id = id
	root.add_child(a)
func _process(_d: float) -> bool:
	f += 1
	if f == 3:
		var m = a.map
		var sp := []
		for s in m.spawns: sp.append([snappedf(s.pos.x, 0.01), snappedf(s.pos.y, 0.01), snappedf(s.pos.z, 0.01), snappedf(s.yaw, 0.001)])
		var paths := []
		for pth in m.nav_paths:
			var one := []
			for v in pth: one.append([snappedf(v.x, 0.01), snappedf(v.y, 0.01), snappedf(v.z, 0.01)])
			paths.append(one)
		var d := {"id": id, "name": m.map_name, "tag": m.map_tag, "bounds": [m.bounds.size.x * 0.5, m.bounds.size.z * 0.5, m.bounds.size.y],
			"solids": m.recorded, "spawns": sp, "paths": paths,
			"sky": [m.sky_top.to_html(false), m.sky_horizon.to_html(false), m.sun_color.to_html(false), m.fog_color.to_html(false) if m.fog_color.a > 0 else "", m.fog_density, m.sun_energy, m.snow]}
		var fh := FileAccess.open("%s/%s.json" % [out, id], FileAccess.WRITE)
		fh.store_string(JSON.stringify(d))
		fh.close()
		print("exported ", id, " solids=", m.recorded.size())
		quit()
	return false
