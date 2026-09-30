class_name HeroModel
extends Node3D
## Procedural armoured humanoid with a real node rig (hips > spine > head / arms, legs with knees)
## and an idle loop: breathing, weight shift, head scan, arm sway, visor pulse.
## SPARTAN is lean with a cyan visor. GUARDIAN is wide with heavy pauldrons and amber trim.

var hero_id := "spartan"
var focused := false

var _t := randf() * 10.0
var _hips: Node3D
var _spine: Node3D
var _chest: MeshInstance3D
var _head: Node3D
var _arm_l: Node3D
var _arm_r: Node3D
var _fore_l: Node3D
var _fore_r: Node3D
var _leg_l: Node3D
var _leg_r: Node3D
var _knee_l: Node3D
var _knee_r: Node3D
var _visor_mat: StandardMaterial3D
var _trim_mat: StandardMaterial3D
var _heavy := false


func setup(id: String) -> HeroModel:
	hero_id = id
	_heavy = id == "guardian"
	var accent: Color = Game.HEROES[id].accent
	var armor := _mat(Color("59667d") if not _heavy else Color("6b6a75"), 0.0, accent)
	var under := _mat(Color("262b36"))
	_trim_mat = _mat(accent.darkened(0.15), 0.6, accent)
	_visor_mat = _mat(accent, 2.5, accent)
	var w := 1.22 if _heavy else 1.0      # width scale
	var h := 1.06 if _heavy else 1.0

	_hips = _node(self, Vector3(0, 0.95 * h, 0))
	_part(_hips, Vector3(0.36 * w, 0.2, 0.24), Vector3.ZERO, armor)
	# legs
	for side in [-1, 1]:
		var thigh := _node(_hips, Vector3(0.12 * w * side, -0.08, 0))
		_part(thigh, Vector3(0.17 * w, 0.46 * h, 0.19), Vector3(0, -0.24 * h, 0), armor)
		var knee := _node(thigh, Vector3(0, -0.47 * h, 0))
		_part(knee, Vector3(0.15 * w, 0.44 * h, 0.17), Vector3(0, -0.22 * h, 0), under)
		_part(knee, Vector3(0.17 * w, 0.14, 0.05), Vector3(0, -0.02, 0.09), armor)
		_part(knee, Vector3(0.17 * w, 0.08, 0.28), Vector3(0, -0.47 * h, 0.05), armor)
		if side < 0:
			_leg_l = thigh
			_knee_l = knee
		else:
			_leg_r = thigh
			_knee_r = knee
	# spine + chest
	_spine = _node(_hips, Vector3(0, 0.1, 0))
	_chest = _part(_spine, Vector3(0.44 * w, 0.5, 0.27), Vector3(0, 0.28, 0), armor)
	_part(_spine, Vector3(0.3 * w, 0.14, 0.02), Vector3(0, 0.38, 0.145), _trim_mat)
	_part(_spine, Vector3(0.04, 0.4, 0.02), Vector3(0, 0.28, 0.146), _visor_mat)
	_part(_spine, Vector3(0.36 * w, 0.16, 0.3), Vector3(0, 0.04, 0), under)
	# back unit
	_part(_spine, Vector3(0.3 * w, 0.4, 0.14), Vector3(0, 0.3, -0.2), under)
	if _heavy:
		_part(_spine, Vector3(0.5, 0.16, 0.2), Vector3(0, 0.42, -0.24), armor)
	# head
	_head = _node(_spine, Vector3(0, 0.6, 0))
	_part(_head, Vector3(0.11 * w, 0.06, 0.11), Vector3(0, -0.02, 0), under)
	var helm := _part(_head, Vector3(0.25 * w, 0.28, 0.29), Vector3(0, 0.15, 0), armor)
	_part(_head, Vector3(0.21 * w, 0.075, 0.03), Vector3(0, 0.16, 0.15), _visor_mat)
	_part(_head, Vector3(0.06, 0.1, 0.24), Vector3(0, 0.34, -0.02), _trim_mat if _heavy else armor)
	# arms
	for side in [-1, 1]:
		var sh := _node(_spine, Vector3((0.3 if not _heavy else 0.36) * side, 0.5, 0))
		var pw := 0.3 if _heavy else 0.2
		_part(sh, Vector3(pw, 0.14 if not _heavy else 0.22, pw * 1.05), Vector3(0.02 * side, 0.05, 0), armor)
		if _heavy:
			_part(sh, Vector3(pw * 0.7, 0.05, pw * 0.9), Vector3(0.02 * side, 0.18, 0), _trim_mat)
		var fore := _node(sh, Vector3(0, -0.32, 0))
		_part(sh, Vector3(0.12 * w, 0.3, 0.13), Vector3(0, -0.16, 0), under)
		_part(fore, Vector3(0.12 * w, 0.28, 0.13), Vector3(0, -0.15, 0), armor)
		_part(fore, Vector3(0.1, 0.09, 0.11), Vector3(0, -0.32, 0), under)
		if side < 0:
			_arm_l = sh
			_fore_l = fore
		else:
			_arm_r = sh
			_fore_r = fore
			# sidearm in the right hand
			_part(fore, Vector3(0.06, 0.1, 0.34), Vector3(0, -0.34, 0.16), under)
			_part(fore, Vector3(0.02, 0.03, 0.2), Vector3(0, -0.29, 0.22), _visor_mat)
	return self


func _process(delta: float) -> void:
	_t += delta * (1.6 if focused else 1.0)
	var t := _t
	var breathe := sin(t * (1.5 if _heavy else 1.9))
	_spine.position.y = 0.1 + breathe * 0.008
	_chest.scale = Vector3(1.0 + breathe * 0.012, 1.0 + breathe * 0.02, 1.0)
	_hips.rotation.z = sin(t * 0.9) * 0.025
	_hips.position.x = sin(t * 0.9) * 0.012
	_spine.rotation.y = sin(t * 0.5) * 0.08
	_head.rotation.y = sin(t * 0.55 + 1.0) * (0.35 if focused else 0.22)
	_head.rotation.x = sin(t * 0.8) * 0.05
	# idle guard stance: left arm relaxed, right arm holding the sidearm forward
	_arm_l.rotation.x = -0.15 + sin(t * 1.1) * 0.05
	_fore_l.rotation.x = -0.35 + sin(t * 1.1 + 0.6) * 0.05
	_arm_r.rotation.x = -0.85 + sin(t * 1.3) * 0.04
	_fore_r.rotation.x = -0.75 + sin(t * 1.3 + 0.4) * 0.04
	_arm_l.rotation.z = 0.08
	_arm_r.rotation.z = -0.08
	# legs: slight stagger with a soft knee bend
	_leg_l.rotation.x = -0.10 + sin(t * 0.9) * 0.015
	_knee_l.rotation.x = 0.18
	_leg_r.rotation.x = 0.06 - sin(t * 0.9) * 0.015
	_knee_r.rotation.x = 0.08
	# visor / trim pulse
	_visor_mat.emission_energy_multiplier = 2.2 + sin(t * 2.4) * 0.8
	_trim_mat.emission_energy_multiplier = 0.5 + (0.3 * sin(t * 1.2) if _heavy else 0.1)


func _node(parent: Node3D, pos: Vector3) -> Node3D:
	var n := Node3D.new()
	n.position = pos
	parent.add_child(n)
	return n


func _part(parent: Node3D, size: Vector3, pos: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.position = pos
	mi.material_override = mat
	parent.add_child(mi)
	return mi


func _mat(c: Color, emit := 0.0, emit_col := Color.BLACK) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.55
	m.metallic = 0.35
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = emit_col
		m.emission_energy_multiplier = emit
	return m
