class_name LevelKit
extends Node3D
## Code-built low-poly level toolkit.
## Every solid is a convex hull (box, wedge, n-gon prism). Meshes are batched per
## material, collision is one StaticBody3D of convex shapes. No trimesh seams,
## no thin gaps, flat shading.

enum Kind { SOLID, GLASS, GLOW }

const UP := Vector3.UP

var spawns: Array[Dictionary] = []   # { "pos": Vector3, "yaw": float }
var enemy_spawns: Array[Vector3] = []
var nav_paths: Array = []            # Array of PackedVector3Array, walked by tools/map_test.gd
var bounds := AABB()
var sky_top := Color(0.35, 0.5, 0.8)
var sky_horizon := Color(0.75, 0.8, 0.9)
var ground_color := Color(0.3, 0.3, 0.3)
var sun_color := Color(1, 0.95, 0.85)
var sun_energy := 1.2
var sun_rotation := Vector3(-55, 35, 0)
var ambient_energy := 0.9
var map_name := "MAP"
var map_tag := ""

var _surfaces := {}          # key -> SurfaceTool
var _mats := {}              # key -> Material
var _body: StaticBody3D
var _glass_mi: MeshInstance3D


func _ready() -> void:
	_body = StaticBody3D.new()
	_body.name = "Collision"
	add_child(_body)
	build()
	_commit()


func build() -> void:
	pass  # override


# ---------- materials ----------

func _mat(color: Color, kind: int) -> Material:
	var key := "%s_%d" % [color.to_html(), kind]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 1.0
	m.metallic = 0.0
	m.metallic_specular = 0.0
	m.vertex_color_use_as_albedo = false
	if kind == Kind.GLASS:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.albedo_color = Color(color.r, color.g, color.b, 0.16)
		m.emission_enabled = true
		m.emission = color
		m.emission_energy_multiplier = 0.6
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	elif kind == Kind.GLOW:
		m.emission_enabled = true
		m.emission = color
		m.emission_energy_multiplier = 2.2
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_mats[key] = m
	return m


# ---------- convex core ----------

func _add_hull(pts: PackedVector3Array, faces: Array, color: Color, kind: int, collide: bool) -> void:
	if collide:
		var shape := ConvexPolygonShape3D.new()
		shape.points = pts
		var cs := CollisionShape3D.new()
		cs.shape = shape
		_body.add_child(cs)
	var centroid := Vector3.ZERO
	for p in pts:
		centroid += p
	centroid /= pts.size()
	var key := "%s_%d" % [color.to_html(), kind]
	var st: SurfaceTool = _surfaces.get(key)
	if st == null:
		st = SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		st.set_material(_mat(color, kind))
		_surfaces[key] = st
	for f in faces:
		# triangle fan, orientation forced outward from the hull centroid
		var p0: Vector3 = pts[f[0]]
		for i in range(1, f.size() - 1):
			var p1: Vector3 = pts[f[i]]
			var p2: Vector3 = pts[f[i + 1]]
			var n := (p1 - p0).cross(p2 - p0)
			if n.length_squared() < 1e-8:
				continue
			n = n.normalized()
			if n.dot(((p0 + p1 + p2) / 3.0) - centroid) < 0.0:
				var t := p1
				p1 = p2
				p2 = t
				n = -n
			st.set_normal(n)
			st.add_vertex(p0)
			st.set_normal(n)
			st.add_vertex(p1)
			st.set_normal(n)
			st.add_vertex(p2)


func _commit() -> void:
	var mesh := ArrayMesh.new()
	var glass := ArrayMesh.new()
	for key in _surfaces:
		var st: SurfaceTool = _surfaces[key]
		var is_glass: bool = key.ends_with("_%d" % Kind.GLASS)
		st.commit(glass if is_glass else mesh)
	var mi := MeshInstance3D.new()
	mi.name = "Geometry"
	mi.mesh = mesh
	add_child(mi)
	if glass.get_surface_count() > 0:
		var gi := MeshInstance3D.new()
		gi.name = "Glass"
		gi.mesh = glass
		gi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(gi)


const BOX_FACES := [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]


static func _xf(p: Vector3, mx: bool, mz: bool) -> Vector3:
	return Vector3(-p.x if mx else p.x, p.y, -p.z if mz else p.z)


func _hex(pts: PackedVector3Array, color: Color, kind: int, mx: bool, mz: bool, collide := true) -> void:
	var variants: Array = [[false, false]]
	if mx:
		variants.append([true, false])
	if mz:
		variants.append([false, true])
	if mx and mz:
		variants.append([true, true])
	for v in variants:
		var out := PackedVector3Array()
		for p in pts:
			out.append(_xf(p, v[0], v[1]))
		_add_hull(out, BOX_FACES, color, kind, collide)


# ---------- public primitives ----------
# All take the MIN corner + size. mx / mz mirror the piece across the X=0 / Z=0 planes.

func box(mn: Vector3, size: Vector3, color: Color, mx := false, mz := false, kind := Kind.SOLID) -> void:
	var a := mn
	var b := mn + size
	_hex(PackedVector3Array([
		Vector3(a.x, a.y, a.z), Vector3(b.x, a.y, a.z), Vector3(b.x, a.y, b.z), Vector3(a.x, a.y, b.z),
		Vector3(a.x, b.y, a.z), Vector3(b.x, b.y, a.z), Vector3(b.x, b.y, b.z), Vector3(a.x, b.y, b.z)]),
		color, kind, mx, mz)


## Ramp. `dir` is the direction the ramp RISES toward: 0=+X 1=-X 2=+Z 3=-Z.
## Footprint = mn.xz .. mn.xz+size.xz, base at mn.y, top edge at mn.y + size.y.
func ramp(mn: Vector3, size: Vector3, dir: int, color: Color, mx := false, mz := false) -> void:
	var a := mn
	var b := mn + size
	var lo := a.y
	var hi := b.y
	# heights at the 4 top corners, in box order 4..7: (a.x,a.z) (b.x,a.z) (b.x,b.z) (a.x,b.z)
	var h := [lo, lo, lo, lo]
	match dir:
		0: h = [lo, hi, hi, lo]
		1: h = [hi, lo, lo, hi]
		2: h = [lo, lo, hi, hi]
		3: h = [hi, hi, lo, lo]
	_hex(PackedVector3Array([
		Vector3(a.x, a.y, a.z), Vector3(b.x, a.y, a.z), Vector3(b.x, a.y, b.z), Vector3(a.x, a.y, b.z),
		Vector3(a.x, h[0], a.z), Vector3(b.x, h[1], a.z), Vector3(b.x, h[2], b.z), Vector3(a.x, h[3], b.z)]),
		color, Kind.SOLID, mx, mz)


## Box between two XZ points (any angle), y0..y1, given thickness.
func seg(p0: Vector2, p1: Vector2, thick: float, y0: float, y1: float, color: Color, mx := false, mz := false, kind := Kind.SOLID) -> void:
	var d := (p1 - p0)
	if d.length() < 0.01:
		return
	var n := Vector2(-d.y, d.x).normalized() * thick * 0.5
	var c := [p0 - n, p1 - n, p1 + n, p0 + n]
	var pts := PackedVector3Array()
	for i in 4:
		pts.append(Vector3(c[i].x, y0, c[i].y))
	for i in 4:
		pts.append(Vector3(c[i].x, y1, c[i].y))
	_hex(pts, color, kind, mx, mz)


## Regular n-gon prism. `phase` in degrees rotates the vertices.
func prism(center: Vector2, y0: float, y1: float, radius: float, sides: int, color: Color, phase := 0.0, mx := false, mz := false, kind := Kind.SOLID, solid := true) -> void:
	var variants: Array = [[false, false]]
	if mx:
		variants.append([true, false])
	if mz:
		variants.append([false, true])
	if mx and mz:
		variants.append([true, true])
	for v in variants:
		var pts := PackedVector3Array()
		for i in sides:
			var ang := deg_to_rad(phase + 360.0 * i / sides)
			var x := center.x + cos(ang) * radius
			var z := center.y + sin(ang) * radius
			pts.append(_xf(Vector3(x, y0, z), v[0], v[1]))
		for i in sides:
			var ang := deg_to_rad(phase + 360.0 * i / sides)
			var x := center.x + cos(ang) * radius
			var z := center.y + sin(ang) * radius
			pts.append(_xf(Vector3(x, y1, z), v[0], v[1]))
		var faces: Array = []
		var bot: Array = []
		var top: Array = []
		for i in sides:
			bot.append(i)
			top.append(sides + i)
			faces.append([i, (i + 1) % sides, sides + (i + 1) % sides, sides + i])
		faces.append(bot)
		faces.append(top)
		_add_hull(pts, faces, color, kind, solid)


## Energy barrier (visible glass + tall invisible-to-the-eye collision). Nothing gets past it.
func barrier(p0: Vector2, p1: Vector2, base_y: float, color: Color, height := 4.0, mx := false, mz := false) -> void:
	seg(p0, p1, 0.3, base_y, base_y + height, color, mx, mz, Kind.GLASS)
	seg(p0, p1, 0.36, base_y + 1.0, base_y + 1.14, color, mx, mz, Kind.GLOW)


func light_strip(p0: Vector2, p1: Vector2, y: float, color: Color, mx := false, mz := false) -> void:
	seg(p0, p1, 0.16, y, y + 0.12, color, mx, mz, Kind.GLOW)


# ---------- level scaffolding ----------

## Solid floor slab + perimeter walls + roof cap. Nothing can leave the arena.
func arena_shell(half_x: float, half_z: float, wall_h: float, floor_col: Color, wall_col: Color, floor_depth := 4.0) -> void:
	bounds = AABB(Vector3(-half_x, 0, -half_z), Vector3(half_x * 2, wall_h, half_z * 2))
	box(Vector3(-half_x - 4, -floor_depth, -half_z - 4), Vector3(half_x * 2 + 8, floor_depth, half_z * 2 + 8), floor_col)
	# walls: overlap the corners so there is never a seam
	box(Vector3(-half_x - 2, 0, -half_z - 2), Vector3(half_x * 2 + 4, wall_h, 2), wall_col)
	box(Vector3(-half_x - 2, 0, half_z), Vector3(half_x * 2 + 4, wall_h, 2), wall_col)
	box(Vector3(-half_x - 2, 0, -half_z), Vector3(2, wall_h, half_z * 2), wall_col)
	box(Vector3(half_x, 0, -half_z), Vector3(2, wall_h, half_z * 2), wall_col)
	# invisible roof
	var roof := ConvexPolygonShape3D.new()
	roof.points = PackedVector3Array([
		Vector3(-half_x, wall_h + 20, -half_z), Vector3(half_x, wall_h + 20, -half_z),
		Vector3(half_x, wall_h + 22, -half_z), Vector3(-half_x, wall_h + 22, -half_z),
		Vector3(-half_x, wall_h + 20, half_z), Vector3(half_x, wall_h + 20, half_z),
		Vector3(half_x, wall_h + 22, half_z), Vector3(-half_x, wall_h + 22, half_z)])
	var cs := CollisionShape3D.new()
	cs.shape = roof
	_body.add_child(cs)


func spawn(pos: Vector3, yaw_deg: float, mx := false, mz := false) -> void:
	var variants: Array = [[false, false]]
	if mx:
		variants.append([true, false])
	if mz:
		variants.append([false, true])
	if mx and mz:
		variants.append([true, true])
	for v in variants:
		var p := _xf(pos, v[0], v[1])
		var yaw := yaw_deg
		if v[0]:
			yaw = -yaw
		if v[1]:
			yaw = 180.0 - yaw
		spawns.append({"pos": p, "yaw": deg_to_rad(yaw)})


## Visual-only flat quad (road paint, hazard stripes). No collision, sits 1cm above `y`.
func flat(mn: Vector2, size: Vector2, y: float, color: Color, mx := false, mz := false, kind := Kind.SOLID) -> void:
	_hex(PackedVector3Array([
		Vector3(mn.x, y, mn.y), Vector3(mn.x + size.x, y, mn.y), Vector3(mn.x + size.x, y, mn.y + size.y), Vector3(mn.x, y, mn.y + size.y),
		Vector3(mn.x, y + 0.01, mn.y), Vector3(mn.x + size.x, y + 0.01, mn.y), Vector3(mn.x + size.x, y + 0.01, mn.y + size.y), Vector3(mn.x, y + 0.01, mn.y + size.y)]),
		color, kind, mx, mz, false)


## Halo-style ring arcing across the sky. Pure decoration.
func sky_ring(radius := 900.0, tilt_deg := 62.0, color := Color("bcd8ff")) -> void:
	var t := TorusMesh.new()
	t.outer_radius = radius + 10.0
	t.inner_radius = radius - 10.0
	t.rings = 96
	t.ring_segments = 8
	var mi := MeshInstance3D.new()
	mi.mesh = t
	mi.name = "SkyRing"
	mi.scale = Vector3(1, 5.0, 1)
	mi.rotation_degrees = Vector3(tilt_deg, 20, 0)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = color
	m.emission_enabled = true
	m.emission = color
	m.emission_energy_multiplier = 0.8
	mi.material_override = m
	add_child(mi)
