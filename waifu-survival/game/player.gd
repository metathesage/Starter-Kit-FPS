class_name Survivor
extends CharacterBody3D

## First-person operator: move/look, hitscan hand cannon, jet-dash, shields.

signal health_changed(hp: float, max_hp: float, shield: float, max_shield: float)
signal ammo_changed(cur: int, mag: int, reserve: int)
signal shot_hit(zombie: Zombie, crit: bool, damage: float)
signal died

@export var walk_speed := 7.0
@export var sprint_mult := 1.45
@export var jump_velocity := 7.5
@export var gravity := 19.6
@export var mouse_sensitivity := 0.0022

var max_health := 100.0
var health := 100.0
var max_shield := 100.0
var shield := 100.0
var shield_regen_timer := 0.0
var dead := false

var damage := 54.0
var damage_mult := 1.0          # OVERCLOCK station raises this
var rpm := 140.0
var mag_size := 8
var max_reserve := 240
var current_ammo := 8
var reserve_ammo := 240
var reload_time := 1.6
var reloading := false
var reload_timer := 0.0
var fire_cooldown := 0.0
var is_aiming := false

var max_dash_charges := 2
var dash_charges := 2
var dash_timer := 0.0
var dash_recharge := 0.0
var dashing := false
var dash_dir := Vector3.ZERO

var camera_pivot: Node3D
var camera: Camera3D
var gun: MeshInstance3D
var gun_mat: StandardMaterial3D
var muzzle_light: OmniLight3D
var _mouse := Vector2.ZERO
var _dash_prev := false
var _reload_prev := false

const DASH_SPEED := 25.0
const DASH_TIME := 0.22
const DASH_CD := 2.4
const HEADSHOT_RANGE := 0.45


func _ready() -> void:
	add_to_group("player")
	camera_pivot = Node3D.new()
	camera_pivot.name = "CameraPivot"
	add_child(camera_pivot)
	camera_pivot.position = Vector3(0, 1.6, 0)

	camera = Camera3D.new()
	camera.name = "Camera3D"
	camera.fov = 75.0
	camera.far = 300.0
	camera_pivot.add_child(camera)
	camera.position = Vector3(0, 0, 0)

	gun = MeshInstance3D.new()
	gun.name = "Gun"
	var box := BoxMesh.new()
	box.size = Vector3(0.09, 0.12, 0.5)
	gun.mesh = box
	gun_mat = StandardMaterial3D.new()
	gun_mat.albedo_color = Color(0.75, 0.6, 0.25)
	gun.material_override = gun_mat
	camera.add_child(gun)
	gun.position = Vector3(0.22, -0.18, -0.45)

	muzzle_light = OmniLight3D.new()
	muzzle_light.omni_range = 7.0
	muzzle_light.light_energy = 0.0
	muzzle_light.light_color = Color(1.0, 0.8, 0.4)
	camera.add_child(muzzle_light)
	muzzle_light.position = Vector3(0.22, -0.1, -0.8)

	# Without a collision shape the body falls straight through the world.
	var collision := CollisionShape3D.new()
	collision.name = "Collision"
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.4
	capsule.height = 1.8
	collision.shape = capsule
	collision.position = Vector3(0, 0.9, 0)
	add_child(collision)

	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_emit_stats()
	_emit_ammo()


func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_mouse += event.relative


func _physics_process(delta: float) -> void:
	if dead:
		return
	_look(delta)
	_move(delta)
	_dash(delta)
	_shields(delta)
	_weapon(delta)
	move_and_slide()


func _look(delta: float) -> void:
	var look := _mouse * mouse_sensitivity
	_mouse = Vector2.ZERO

	# Gamepad right-stick look across all connected pads
	const DEADZONE := 0.15
	for joy in Input.get_connected_joypads():
		var rx := Input.get_joy_axis(joy, JOY_AXIS_RIGHT_X)
		var ry := Input.get_joy_axis(joy, JOY_AXIS_RIGHT_Y)
		if absf(rx) > DEADZONE:
			look.x += ((rx - signf(rx) * DEADZONE) / (1.0 - DEADZONE)) * 3.2 * delta
		if absf(ry) > DEADZONE:
			look.y += ((ry - signf(ry) * DEADZONE) / (1.0 - DEADZONE)) * 3.2 * delta

	# Arrow-key look fallback
	const ARROW_SPEED := 2.5
	if Input.is_key_pressed(KEY_UP): look.y -= ARROW_SPEED * delta
	if Input.is_key_pressed(KEY_DOWN): look.y += ARROW_SPEED * delta
	if Input.is_key_pressed(KEY_LEFT): look.x -= ARROW_SPEED * delta
	if Input.is_key_pressed(KEY_RIGHT): look.x += ARROW_SPEED * delta

	if look.length_squared() > 0.000001:
		rotate_y(-look.x)
		camera_pivot.rotate_x(-look.y)
		camera_pivot.rotation.x = clampf(camera_pivot.rotation.x, -1.5, 1.5)


func _move(delta: float) -> void:
	if dashing:
		velocity.x = dash_dir.x * DASH_SPEED
		velocity.z = dash_dir.z * DASH_SPEED
	else:
		if not is_on_floor():
			velocity.y -= gravity * delta
		elif velocity.y < 0.0:
			velocity.y = -0.5
		if Input.is_action_just_pressed("jump") and is_on_floor():
			velocity.y = jump_velocity
		var dir := Input.get_vector("move_left", "move_right", "move_forward", "move_backward")
		var wish := (transform.basis * Vector3(dir.x, 0, dir.y)).normalized()
		var speed := walk_speed
		is_aiming = Input.is_action_pressed("aim_down_sights")
		if Input.is_action_pressed("sprint") and not is_aiming:
			speed *= sprint_mult
		elif is_aiming:
			speed *= 0.6
		var target := wish * speed
		var accel := 44.0 if is_on_floor() else 20.0
		velocity.x = move_toward(velocity.x, target.x, accel * delta)
		velocity.z = move_toward(velocity.z, target.z, accel * delta)

	# FOV target for ADS / dash
	var want_fov := 75.0
	if dashing:
		want_fov = 86.0
	elif is_aiming:
		want_fov = 50.0
	camera.fov = lerpf(camera.fov, want_fov, 12.0 * delta)


func _dash(delta: float) -> void:
	var pressed := Input.is_action_pressed("dash")
	if dash_charges < max_dash_charges:
		dash_recharge += delta
		if dash_recharge >= DASH_CD:
			dash_recharge = 0.0
			dash_charges += 1
	if pressed and not _dash_prev and dash_charges > 0 and not dashing:
		dash_charges -= 1
		dashing = true
		dash_timer = DASH_TIME
		var dir := Input.get_vector("move_left", "move_right", "move_forward", "move_backward")
		dash_dir = (transform.basis * Vector3(dir.x, 0, dir.y)).normalized() if dir.length() > 0.0 else -transform.basis.z
		velocity.y = max(velocity.y, 1.5)
	_dash_prev = pressed
	if dashing:
		dash_timer -= delta
		if dash_timer <= 0.0:
			dashing = false
			velocity.x *= 0.4
			velocity.z *= 0.4


func _shields(delta: float) -> void:
	shield_regen_timer += delta
	if shield_regen_timer >= 3.0 and shield < max_shield:
		shield = min(max_shield, shield + 30.0 * delta)
		_emit_stats()


func _weapon(delta: float) -> void:
	if fire_cooldown > 0.0:
		fire_cooldown -= delta
	if reloading:
		reload_timer -= delta
		if reload_timer <= 0.0:
			reloading = false
			var need := mag_size - current_ammo
			var take: int = mini(need, reserve_ammo)
			current_ammo += take
			reserve_ammo -= take
			_emit_ammo()
		return
	var reload_pressed := Input.is_action_pressed("reload")
	if reload_pressed and not _reload_prev and current_ammo < mag_size and reserve_ammo > 0:
		reloading = true
		reload_timer = reload_time
	_reload_prev = reload_pressed
	muzzle_light.light_energy = maxf(0.0, muzzle_light.light_energy - 30.0 * delta)
	gun.scale = gun.scale.lerp(Vector3.ONE, 10.0 * delta)
	if Input.is_action_pressed("fire") and fire_cooldown <= 0.0:
		if current_ammo > 0:
			_fire()
			fire_cooldown = 60.0 / rpm
		elif reserve_ammo > 0:
			reloading = true
			reload_timer = reload_time


func _fire() -> void:
	current_ammo -= 1
	_emit_ammo()
	# Recoil kick + muzzle flash
	camera_pivot.rotate_x(0.035)
	muzzle_light.light_energy = 2.5
	gun.scale = Vector3(1.0, 1.0, 1.3)

	var from := camera.global_position
	var dir := -camera.global_transform.basis.z
	var to := from + dir * 150.0
	var query := PhysicsRayQueryParameters3D.create(from, to)
	query.exclude = [self]
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return
	var collider = hit["collider"]
	if collider is Zombie:
		var z := collider as Zombie
		var crit := z.head_hit(hit["position"])
		var dmg := damage * damage_mult
		if crit:
			dmg *= 2.0
		z.take_damage(dmg, crit)
		shot_hit.emit(z, crit, dmg)


func take_damage(amount: float) -> void:
	if dead:
		return
	shield_regen_timer = 0.0
	if shield > 0.0:
		shield -= amount
		if shield < 0.0:
			health += shield
			shield = 0.0
	else:
		health -= amount
	health = max(0.0, health)
	_emit_stats()
	if health <= 0.0:
		dead = true
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		died.emit()


func refill() -> void:
	reserve_ammo = max_reserve
	_emit_ammo()


func set_gold() -> void:
	if gun_mat:
		gun_mat.albedo_color = Color(1.0, 0.82, 0.2)


func _emit_stats() -> void:
	health_changed.emit(health, max_health, shield, max_shield)


func _emit_ammo() -> void:
	ammo_changed.emit(current_ammo, mag_size, reserve_ammo)
