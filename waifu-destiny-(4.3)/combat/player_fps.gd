extends CharacterBody3D
class_name PlayerFPS

# --- SIGNALS ---
signal ammo_changed(current_ammo: int, max_ammo: int, reserve_ammo: int)
signal health_shield_changed(health: float, max_health: float, shield: float, max_shield: float)
signal dash_charges_changed(current_charges: int, max_charges: int, recharge_ratio: float)
signal weapon_fired(is_ads: bool)
signal hit_registered(is_crit: bool, damage: float, hit_position: Vector3)

# --- NODES ---
@onready var camera_pivot: Node3D = $CameraPivot
@onready var camera: Camera3D = $CameraPivot/Camera3D
@onready var weapon_container: Node3D = $CameraPivot/WeaponContainer
@onready var raycast: RayCast3D = $CameraPivot/Camera3D/RayCast3D
@onready var stat_manager: PlayerStatManager = $PlayerStatManager

# --- MOUSE & CAMERA SETTINGS ---
@export_group("Camera & Mouse")
@export var mouse_sensitivity: float = 0.0022
@export var base_fov: float = 75.0
@export var ads_fov: float = 48.0
@export var dash_fov: float = 86.0
@export var fov_transition_speed: float = 14.0

# --- MOVEMENT SETTINGS ---
@export_group("Movement")
@export var walk_speed: float = 6.8
@export var sprint_multiplier: float = 1.45
@export var acceleration: float = 42.0
@export var air_acceleration: float = 18.0
@export var jump_velocity: float = 7.2
@export var gravity: float = 19.6

# --- JET-DASH SETTINGS ---
@export_group("Jet Dash")
@export var max_dash_charges: int = 2
@export var dash_speed: float = 24.0
@export var dash_duration: float = 0.22
@export var dash_charge_cooldown: float = 2.4

# --- WEAPON SETTINGS ---
@export_group("Weapon & Recoil")
@export var base_damage: float = 38.0
@export var fire_rate_rpm: float = 540.0 # rounds per minute
@export var max_magazine: int = 24
@export var max_reserve: int = 240
@export var base_reload_time: float = 1.6
@export var recoil_pitch_kick: float = 0.05
@export var recoil_yaw_kick: float = 0.015
@export var recoil_recovery_speed: float = 18.0

# --- WEAPON SWAY & BOB ---
@export_group("Procedural Sway & Bob")
@export var sway_amount: float = 0.0018
@export var sway_max: float = 0.06
@export var sway_smooth: float = 10.0
@export var bob_freq: float = 10.0
@export var bob_amp: float = 0.025

# --- RUNTIME VARIABLES ---
var health: float = 100.0
var max_health: float = 100.0
var shield: float = 100.0
var max_shield: float = 100.0
var shield_regen_timer: float = 0.0

var current_ammo: int = 24
var reserve_ammo: int = 240
var is_reloading: bool = false
var reload_timer: float = 0.0
var fire_cooldown: float = 0.0

var current_dash_charges: int = 2
var dash_recharge_timer: float = 0.0
var is_dashing: bool = false
var dash_time_remaining: float = 0.0
var dash_direction: Vector3 = Vector3.ZERO

var is_aiming_down_sights: bool = false
var mouse_input: Vector2 = Vector2.ZERO
var target_weapon_rotation: Vector3 = Vector3.ZERO
var current_recoil_offset: Vector3 = Vector3.ZERO
var default_weapon_pos: Vector3 = Vector3(0.24, -0.22, -0.45)
var ads_weapon_pos: Vector3 = Vector3(0.0, -0.165, -0.32)
var bob_timer: float = 0.0

func _ready() -> void:
	# Capture mouse by default for browser/desktop FPS
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	current_dash_charges = max_dash_charges
	current_ammo = max_magazine
	reserve_ammo = max_reserve
	
	if stat_manager:
		stat_manager.stats_recalculated.connect(_on_stats_recalculated)
		stat_manager.recalculate_stats()
	
	_emit_ui_updates()

func _input(event: InputEvent) -> void:
	# Toggle mouse capture in web browser with click / escape
	if event is InputEventMouseButton and event.pressed:
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event.is_action_pressed("ui_cancel") or (event is InputEventKey and event.keycode == KEY_ESCAPE and event.pressed):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	
	if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and event is InputEventMouseMotion:
		mouse_input = event.relative

func _physics_process(delta: float) -> void:
	_handle_rotation()
	_handle_movement(delta)
	_handle_jet_dash(delta)
	_handle_shields(delta)
	_handle_weapons(delta)
	_handle_camera_and_fov(delta)
	_handle_procedural_sway_and_bob(delta)
	move_and_slide()

# --- MOUSE LOOK & CAMERA ---
func _handle_rotation() -> void:
	if mouse_input.length_squared() > 0.0:
		# Yaw (Body)
		rotate_y(-mouse_input.x * mouse_sensitivity)
		# Pitch (Camera Pivot)
		camera_pivot.rotate_x(-mouse_input.y * mouse_sensitivity)
		camera_pivot.rotation.x = clamp(camera_pivot.rotation.x, deg_to_rad(-89.0), deg_to_rad(89.0))
		
		# Sway tracking
		target_weapon_rotation.y = clamp(-mouse_input.x * sway_amount, -sway_max, sway_max)
		target_weapon_rotation.x = clamp(-mouse_input.y * sway_amount, -sway_max, sway_max)
		
		mouse_input = Vector2.ZERO

# --- WASD MOVEMENT ---
func _handle_movement(delta: float) -> void:
	if is_dashing:
		velocity.x = dash_direction.x * dash_speed
		velocity.z = dash_direction.z * dash_speed
		return

	# Gravity
	if not is_on_floor():
		velocity.y -= gravity * delta
	elif velocity.y < 0.0:
		velocity.y = -0.5

	# Jump
	if is_action_pressed_custom("jump") and is_on_floor():
		velocity.y = jump_velocity

	# Input direction
	var input_dir := Vector2.ZERO
	if is_action_pressed_custom("move_forward"): input_dir.y -= 1.0
	if is_action_pressed_custom("move_backward"): input_dir.y += 1.0
	if is_action_pressed_custom("move_left"): input_dir.x -= 1.0
	if is_action_pressed_custom("move_right"): input_dir.x += 1.0
	input_dir = input_dir.normalized()

	var move_dir := (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
	
	# Speed modifiers
	var target_speed := walk_speed
	if stat_manager and stat_manager.active_stats.has("movement_speed"):
		target_speed = stat_manager.active_stats["movement_speed"]
		
	if is_action_pressed_custom("sprint") and input_dir.y < 0.0 and not is_aiming_down_sights:
		target_speed *= sprint_multiplier
	elif is_aiming_down_sights:
		target_speed *= 0.65

	var accel := acceleration if is_on_floor() else air_acceleration
	var target_vel := move_dir * target_speed
	velocity.x = move_toward(velocity.x, target_vel.x, accel * delta)
	velocity.z = move_toward(velocity.z, target_vel.z, accel * delta)

# --- JET-DASH ---
func _handle_jet_dash(delta: float) -> void:
	# Dash recharge
	if current_dash_charges < max_dash_charges:
		dash_recharge_timer += delta
		if dash_recharge_timer >= dash_charge_cooldown:
			dash_recharge_timer = 0.0
			current_dash_charges += 1
		var progress := dash_recharge_timer / dash_charge_cooldown
		dash_charges_changed.emit(current_dash_charges, max_dash_charges, progress)

	# Active dash countdown
	if is_dashing:
		dash_time_remaining -= delta
		if dash_time_remaining <= 0.0:
			is_dashing = false
			velocity.x *= 0.4
			velocity.z *= 0.4

	# Dash activation
	if is_action_just_pressed_custom("dash") and not is_dashing and current_dash_charges > 0:
		_execute_jet_dash()

func _execute_jet_dash() -> void:
	current_dash_charges -= 1
	dash_charges_changed.emit(current_dash_charges, max_dash_charges, 0.0)
	is_dashing = true
	dash_time_remaining = dash_duration

	var input_dir := Vector2.ZERO
	if is_action_pressed_custom("move_forward"): input_dir.y -= 1.0
	if is_action_pressed_custom("move_backward"): input_dir.y += 1.0
	if is_action_pressed_custom("move_left"): input_dir.x -= 1.0
	if is_action_pressed_custom("move_right"): input_dir.x += 1.0
	
	if input_dir.length_squared() > 0.0:
		dash_direction = (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
	else:
		# Default dash forward if stationary
		dash_direction = -transform.basis.z

	# Reset vertical gravity during dash for snappy horizontal jet feel
	velocity.y = max(velocity.y, 1.5)

# --- GUNPLAY & RECOIL ---
func _handle_weapons(delta: float) -> void:
	if fire_cooldown > 0.0:
		fire_cooldown -= delta

	# Reloading
	if is_reloading:
		reload_timer -= delta
		if reload_timer <= 0.0:
			_complete_reload()
		return

	# Manual Reload
	if is_action_just_pressed_custom("reload") and current_ammo < max_magazine and reserve_ammo > 0:
		_start_reload()
		return

	# Aim Down Sights (ADS)
	is_aiming_down_sights = is_action_pressed_custom("aim_down_sights")

	# Firing
	var fire_interval := 60.0 / fire_rate_rpm
	if stat_manager and stat_manager.active_stats.has("fire_rate_mult"):
		fire_interval /= max(0.5, stat_manager.active_stats["fire_rate_mult"])

	if is_action_pressed_custom("fire") and fire_cooldown <= 0.0:
		if current_ammo > 0:
			_fire_weapon()
			fire_cooldown = fire_interval
		elif reserve_ammo > 0:
			_start_reload()

	# Recoil decay
	current_recoil_offset = current_recoil_offset.lerp(Vector3.ZERO, recoil_recovery_speed * delta)

func _fire_weapon() -> void:
	current_ammo -= 1
	ammo_changed.emit(current_ammo, max_magazine, reserve_ammo)
	weapon_fired.emit(is_aiming_down_sights)

	# Apply procedural recoil kick
	var ads_mult := 0.55 if is_aiming_down_sights else 1.0
	var pitch_kick := randf_range(recoil_pitch_kick * 0.8, recoil_pitch_kick * 1.2) * ads_mult
	var yaw_kick := randf_range(-recoil_yaw_kick, recoil_yaw_kick) * ads_mult
	camera_pivot.rotate_x(pitch_kick)
	rotate_y(yaw_kick)
	current_recoil_offset.z += 0.07 * ads_mult

	# Hitscan Raycast
	if raycast and raycast.is_colliding():
		var collider = raycast.get_collider()
		var hit_point = raycast.get_collision_point()
		var is_crit = false
		
		# Weakpoint / Headshot detection
		if collider.has_method("is_weakpoint_hit"):
			is_crit = collider.is_weakpoint_hit(hit_point)
		elif collider.name.to_lower().contains("head") or collider.name.to_lower().contains("core"):
			is_crit = true

		var damage = base_damage
		if is_crit:
			var crit_mult = 1.8
			if stat_manager and stat_manager.active_stats.has("crit_damage_mult"):
				crit_mult = stat_manager.active_stats["crit_damage_mult"]
			damage *= crit_mult

		if collider.has_method("take_damage"):
			collider.take_damage(damage, is_crit)
			
		hit_registered.emit(is_crit, damage, hit_point)

func _start_reload() -> void:
	if is_reloading or current_ammo == max_magazine or reserve_ammo <= 0:
		return
	is_reloading = true
	var reload_duration = base_reload_time
	if stat_manager and stat_manager.active_stats.has("reload_speed_mult"):
		reload_duration /= max(0.5, stat_manager.active_stats["reload_speed_mult"])
	reload_timer = reload_duration

func _complete_reload() -> void:
	is_reloading = false
	var needed := max_magazine - current_ammo
	var taken := min(needed, reserve_ammo)
	current_ammo += taken
	reserve_ammo -= taken
	ammo_changed.emit(current_ammo, max_magazine, reserve_ammo)

# --- SHIELD & HEALTH REGEN ---
func _handle_shields(delta: float) -> void:
	var regen_delay: float = 3.0
	if stat_manager and stat_manager.active_stats.has("shield_regen_delay"):
		regen_delay = stat_manager.active_stats["shield_regen_delay"]

	shield_regen_timer += delta
	if shield_regen_timer >= regen_delay and shield < max_shield:
		shield = min(max_shield, shield + 28.0 * delta)
		health_shield_changed.emit(health, max_health, shield, max_shield)

func take_damage(amount: float) -> void:
	shield_regen_timer = 0.0
	if shield > 0.0:
		shield -= amount
		if shield < 0.0:
			health += shield # overflow to health
			shield = 0.0
	else:
		health -= amount

	health = max(0.0, health)
	health_shield_changed.emit(health, max_health, shield, max_shield)

# --- CAMERA FOV & PROCEDURAL BOB ---
func _handle_camera_and_fov(delta: float) -> void:
	var target_fov = base_fov
	if is_dashing:
		target_fov = dash_fov
	elif is_aiming_down_sights:
		target_fov = ads_fov
	camera.fov = lerp(camera.fov, target_fov, fov_transition_speed * delta)

func _handle_procedural_sway_and_bob(delta: float) -> void:
	# Weapon ADS position lerp
	var target_pos := ads_weapon_pos if is_aiming_down_sights else default_weapon_pos
	target_pos.z += current_recoil_offset.z

	# Head Bobbing on ground
	var speed_2d := Vector2(velocity.x, velocity.z).length()
	if is_on_floor() and speed_2d > 1.0 and not is_dashing:
		bob_timer += delta * bob_freq * (speed_2d / walk_speed)
		target_pos.y += sin(bob_timer) * bob_amp
		target_pos.x += cos(bob_timer * 0.5) * bob_amp * 0.6
	else:
		bob_timer = 0.0

	weapon_container.position = weapon_container.position.lerp(target_pos, 14.0 * delta)

	# Weapon Sway
	target_weapon_rotation.x = lerp(target_weapon_rotation.x, 0.0, sway_smooth * delta)
	target_weapon_rotation.y = lerp(target_weapon_rotation.y, 0.0, sway_smooth * delta)
	weapon_container.rotation = target_weapon_rotation

# --- STAT MANAGER SYNC ---
func _on_stats_recalculated(stats: Dictionary) -> void:
	if stats.has("max_shield"):
		max_shield = stats["max_shield"]
		shield = min(shield, max_shield)
	if stats.has("max_health"):
		max_health = stats["max_health"]
		health = min(health, max_health)
	_emit_ui_updates()

func _emit_ui_updates() -> void:
	ammo_changed.emit(current_ammo, max_magazine, reserve_ammo)
	health_shield_changed.emit(health, max_health, shield, max_shield)
	dash_charges_changed.emit(current_dash_charges, max_dash_charges, 1.0)

# --- HELPER FALLBACKS FOR CUSTOM ACTION MAPPINGS ---
func is_action_pressed_custom(action_name: String) -> bool:
	if InputMap.has_action(action_name):
		return Input.is_action_pressed(action_name)
	# Key code fallbacks if inputs aren't mapped
	match action_name:
		"move_forward": return Input.is_key_pressed(KEY_W)
		"move_backward": return Input.is_key_pressed(KEY_S)
		"move_left": return Input.is_key_pressed(KEY_A)
		"move_right": return Input.is_key_pressed(KEY_D)
		"jump": return Input.is_key_pressed(KEY_SPACE)
		"sprint": return Input.is_key_pressed(KEY_SHIFT)
		"dash": return Input.is_key_pressed(KEY_Q)
		"fire": return Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT)
		"aim_down_sights": return Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT)
		"reload": return Input.is_key_pressed(KEY_R)
		_: return false

func is_action_just_pressed_custom(action_name: String) -> bool:
	if InputMap.has_action(action_name):
		return Input.is_action_just_pressed(action_name)
	match action_name:
		"dash": return Input.is_key_label_pressed(KEY_Q)
		"reload": return Input.is_key_label_pressed(KEY_R)
		_: return false
