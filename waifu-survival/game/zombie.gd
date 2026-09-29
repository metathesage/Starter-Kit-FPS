class_name Zombie
extends CharacterBody3D

## One component, three archetypes. Climb -> chase -> windup -> swipe,
## with stagger/knockback so the PULSE ability has something to bite.

signal died(z: Zombie, crit: bool)

enum Kind { WALKER, RUNNER, BRUTE }
enum State { CLIMB, CHASE, WINDUP, SWING, STAGGER, DEAD }

const BASE := {
	Kind.WALKER: {"hp": 110.0, "speed": 2.6, "dmg": 22.0, "scale": 1.0, "color": Color(0.30, 0.38, 0.26)},
	Kind.RUNNER: {"hp": 80.0, "speed": 5.0, "dmg": 16.0, "scale": 0.9, "color": Color(0.52, 0.26, 0.40)},
	Kind.BRUTE: {"hp": 450.0, "speed": 2.0, "dmg": 45.0, "scale": 1.35, "color": Color(0.33, 0.27, 0.44)},
}

var kind := Kind.WALKER
var hp := 110.0
var speed := 2.6
var melee_dmg := 22.0
var state := State.DEAD
var player: Node3D = null
var climb_from := Vector3.ZERO
var climb_to := Vector3.ZERO
var climb_t := 0.0
var windup_t := 0.0
var swing_t := 0.0
var attack_cd := 0.0
var stagger_t := 0.0
var knock := Vector3.ZERO

var _collision: CollisionShape3D
var _body_mesh: MeshInstance3D
var _head_mesh: MeshInstance3D
var _arm_l: Node3D
var _arm_r: Node3D
var _mat: StandardMaterial3D
var _base_color := Color.WHITE
var _built := false


func _build() -> void:
	if _built:
		return
	_built = true
	add_to_group("zombies")

	_mat = StandardMaterial3D.new()
	_body_mesh = MeshInstance3D.new()
	var capsule := CapsuleMesh.new()
	capsule.radius = 0.35
	capsule.height = 1.7
	_body_mesh.mesh = capsule
	_body_mesh.position = Vector3(0, 0.85, 0)
	add_child(_body_mesh)

	_head_mesh = MeshInstance3D.new()
	_head_mesh.name = "HeadVisual"
	var sphere := SphereMesh.new()
	sphere.radius = 0.26
	sphere.height = 0.52
	_head_mesh.mesh = sphere
	_head_mesh.position = Vector3(0, 1.72, 0)
	add_child(_head_mesh)

	# Glowing red eyes - the thing that reads "zombie" in the dark.
	var eye_mat := StandardMaterial3D.new()
	eye_mat.emission_enabled = true
	eye_mat.emission = Color(1.0, 0.12, 0.08)
	eye_mat.albedo_color = Color(0.1, 0.02, 0.02)
	for ex in [-0.09, 0.09]:
		var eye := MeshInstance3D.new()
		var es := SphereMesh.new()
		es.radius = 0.045
		es.height = 0.09
		eye.mesh = es
		eye.position = Vector3(ex, 1.76, -0.2)
		eye.material_override = eye_mat
		add_child(eye)

	# Arms: pivot at the shoulder, mesh hangs below; they raise on windup.
	_arm_l = _make_arm(-0.44)
	_arm_r = _make_arm(0.44)

	_collision = CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.35
	shape.height = 1.8
	_collision.shape = shape
	_collision.position = Vector3(0, 0.9, 0)
	add_child(_collision)


func _make_arm(side_x: float) -> Node3D:
	var pivot := Node3D.new()
	pivot.position = Vector3(side_x, 1.25, 0)
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.13, 0.55, 0.13)
	mesh.mesh = box
	mesh.position = Vector3(0, -0.24, 0)
	mesh.material_override = _mat
	pivot.add_child(mesh)
	add_child(pivot)
	return pivot


func activate(z_kind: Kind, wave: int, at: Vector3, target: Node3D) -> void:
	_build()
	kind = z_kind
	var s: Dictionary = BASE[kind]
	scale = Vector3.ONE * float(s["scale"])
	hp = float(s["hp"]) * WaveTable.hp_scale(wave)
	speed = float(s["speed"]) * WaveTable.speed_scale(wave)
	melee_dmg = float(s["dmg"])
	_base_color = s["color"]
	player = target
	climb_from = at + Vector3(0.0, -1.3, 0.0)
	climb_to = at
	climb_t = 0.0
	knock = Vector3.ZERO
	stagger_t = 0.0
	attack_cd = 0.0
	state = State.CLIMB
	global_position = climb_from
	visible = true
	_collision.disabled = false
	_apply_color(_base_color)


func deactivate() -> void:
	state = State.DEAD
	visible = false
	if _collision:
		_collision.disabled = true


func is_alive() -> bool:
	return state != State.DEAD


func head_hit(hit_pos: Vector3) -> bool:
	if not _head_mesh:
		return false
	return hit_pos.distance_to(_head_mesh.global_position) < 0.45


func take_damage(amount: float, crit: bool) -> void:
	if state == State.DEAD:
		return
	hp -= amount
	_apply_color(Color(1.6, 1.0, 0.4) if crit else Color(1.0, 0.35, 0.3))
	if hp <= 0.0:
		state = State.DEAD
		visible = false
		_collision.disabled = true
		died.emit(self, crit)
	elif state in [State.CHASE, State.WINDUP]:
		# Minor flinch so heavy guns interrupt swings.
		if amount >= 80.0 and kind != Kind.BRUTE:
			state = State.STAGGER
			stagger_t = 0.35


func pulse_hit(dmg: float, push_dir: Vector3) -> void:
	if state == State.DEAD:
		return
	take_damage(dmg, false)
	if state == State.DEAD:
		return
	knock = push_dir * (7.0 if kind == Kind.BRUTE else 12.0)
	if kind != Kind.BRUTE:
		state = State.STAGGER
		stagger_t = 1.2


func _physics_process(delta: float) -> void:
	if state == State.DEAD or player == null:
		return
	if not is_on_floor():
		velocity.y -= 19.6 * delta
	elif velocity.y < 0.0:
		velocity.y = -0.5

	match state:
		State.CLIMB:
			climb_t += delta / 0.8
			global_position = climb_from.lerp(climb_to, minf(climb_t, 1.0))
			velocity = Vector3.ZERO
			if climb_t >= 1.0:
				state = State.CHASE
			return
		State.CHASE:
			_chase(delta)
		State.WINDUP:
			windup_t -= delta
			velocity.x = 0.0
			velocity.z = 0.0
			if windup_t <= 0.0:
				state = State.SWING
				swing_t = 0.25
				if global_position.distance_to(player.global_position) < 2.2:
					player.take_damage(melee_dmg)
		State.SWING:
			swing_t -= delta
			velocity.x = 0.0
			velocity.z = 0.0
			if swing_t <= 0.0:
				state = State.CHASE
				attack_cd = 1.1
		State.STAGGER:
			stagger_t -= delta
			if stagger_t <= 0.0:
				state = State.CHASE

	# Knockback decay rides on top of whatever state ran this frame.
	velocity.x += knock.x
	velocity.z += knock.z
	knock = knock.lerp(Vector3.ZERO, minf(1.0, 8.0 * delta))
	move_and_slide()

	# Arms: raised high on windup, slammed on swing, reaching while chasing.
	var want_x := -0.9
	if state == State.WINDUP:
		want_x = -1.7
	elif state == State.SWING:
		want_x = -0.25
	elif state == State.STAGGER:
		want_x = -0.2
	_arm_l.rotation.x = lerpf(_arm_l.rotation.x, want_x, 12.0 * delta)
	_arm_r.rotation.x = lerpf(_arm_r.rotation.x, want_x, 12.0 * delta)


func _chase(delta: float) -> void:
	if attack_cd > 0.0:
		attack_cd -= delta
	var to_player := player.global_position - global_position
	to_player.y = 0.0
	var dist := to_player.length()

	if dist < 1.7 and attack_cd <= 0.0:
		state = State.WINDUP
		windup_t = 0.35
		return

	var dir := to_player.normalized()
	dir = _separate(dir)
	dir = _steer_around_walls(dir)
	look_at(global_position + Vector3(dir.x, global_position.y + 1.0, dir.z), Vector3.UP, true)
	velocity.x = dir.x * speed
	velocity.z = dir.z * speed


func _separate(dir: Vector3) -> Vector3:
	var sep := Vector3.ZERO
	for other in get_tree().get_nodes_in_group("zombies"):
		if other == self or not (other is Zombie):
			continue
		var o := other as Zombie
		if not o.is_alive():
			continue
		var d := global_position - o.global_position
		d.y = 0.0
		var l := d.length()
		if l > 0.01 and l < 1.3:
			sep += d / (l * l)
	if sep.length_squared() > 0.0001:
		dir = (dir + sep.normalized() * 0.45).normalized()
	return dir


func _steer_around_walls(dir: Vector3) -> Vector3:
	var space := get_world_3d().direct_space_state
	var probe_from := global_position + Vector3(0, 0.6, 0)
	var best_dir := dir
	var best_clear := _ray_dist(space, probe_from, dir)
	if best_clear > 1.2:
		return dir
	# Blocked: slide along whichever rotated direction sees the farthest,
	# so zombies funnel along walls and through door gaps instead of grinding.
	for angle in [0.7, -0.7, 1.3, -1.3, 2.2, -2.2]:
		var alt := dir.rotated(Vector3.UP, angle)
		var d := _ray_dist(space, probe_from, alt)
		if d > best_clear:
			best_clear = d
			best_dir = alt
	return best_dir


func _ray_dist(space: PhysicsDirectSpaceState3D, from: Vector3, dir: Vector3) -> float:
	var q := PhysicsRayQueryParameters3D.create(from, from + dir * 2.5)
	q.exclude = [self]
	var hit := space.intersect_ray(q)
	if hit.is_empty() or (hit["collider"] is Zombie):
		return 2.5
	return from.distance_to(hit["position"])


func _apply_color(c: Color) -> void:
	if _mat:
		_mat.albedo_color = c
	if _body_mesh:
		_body_mesh.material_override = _mat
