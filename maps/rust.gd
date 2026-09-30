extends LevelKit
## RUST — the real layout. Loads the ripped GLB, scales it to 0.25, re-centres it on the floor,
## re-skins it with a height-tinted shader and wraps it in invisible walls so nothing leaves the plate.

const SRC := "res://models/maps/rust.glb"
const UNIT := 0.25
# GLB-space centre of the plate and top of its floor (units of the source model)
const CENTER := Vector2(74.04, -113.09)
const FLOOR_Y := 15.0

const SKIN := """
shader_type spatial;
render_mode cull_disabled;
varying vec3 wpos;
varying vec3 wnrm;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; wnrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz); }
void fragment() {
	float up = smoothstep(0.55, 0.9, wnrm.y);
	vec3 sand = vec3(0.58, 0.42, 0.27);
	vec3 rust = vec3(0.42, 0.20, 0.10);
	vec3 steel = vec3(0.34, 0.37, 0.38);
	float h = clamp(wpos.y / 26.0, 0.0, 1.0);
	vec3 side = mix(rust, steel, smoothstep(0.15, 0.7, h));
	vec3 c = mix(side, sand, up);
	float grid = step(0.94, fract(wpos.x * 0.5)) + step(0.94, fract(wpos.z * 0.5));
	c *= 1.0 - 0.08 * clamp(grid, 0.0, 1.0) * up;
	c *= 0.72 + 0.28 * smoothstep(0.0, 6.0, wpos.y + 1.0);
	ALBEDO = c;
	ROUGHNESS = 1.0;
}
"""


func _init() -> void:
	map_name = "RUST"
	map_tag = "OIL RIG  /  56 x 55"
	sky_top = Color("6f9fd0")
	sky_horizon = Color("ffdcae")
	ground_color = Color("6a5238")
	sun_color = Color("ffe6bd")
	sun_energy = 0.75
	sun_rotation = Vector3(-46, -40, 0)
	ambient_energy = 0.9
	fog_color = Color("e2b98a")
	fog_density = 0.004


func build() -> void:
	var packed: PackedScene = load(SRC)
	var root := packed.instantiate() as Node3D
	root.name = "RustMesh"
	add_child(root)
	root.scale = Vector3.ONE * UNIT
	root.position = Vector3(-CENTER.x * UNIT, -FLOOR_Y * UNIT, -CENTER.y * UNIT - 1.5)
	var sh := Shader.new()
	sh.code = SKIN
	var mat := ShaderMaterial.new()
	mat.shader = sh
	for m in root.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		mi.material_override = mat
		mi.create_trimesh_collision()
	invisible_bounds(28.2, 27.7, 34.0)
	# spawns: open, flat floor found by probing the mesh (near the source project's spawn spots)
	for p in [Vector2(-9, -14.5), Vector2(15, 8.5), Vector2(-10, 10.5), Vector2(10, -12.5), Vector2(0, -20.5), Vector2(0, 15.5)]:
		spawn(Vector3(p.x, 0.1, p.y), rad_to_deg(atan2(p.x, p.y)))
	for p in [Vector3(-8, 4, 0), Vector3(8, 4, 0), Vector3(0, 6, 12), Vector3(0, 6, -12), Vector3(0, 12, 0)]:
		enemy_spawns.append(p)
