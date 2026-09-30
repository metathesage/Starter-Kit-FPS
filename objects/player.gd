extends CharacterBody3D

@export_subgroup("Properties")
@export var movement_speed = 5
@export_range(0, 100) var number_of_jumps: int = 2
@export var jump_strength = 8

@export_subgroup("Weapons")
@export var weapons: Array[Weapon] = []

var weapon: Weapon
var weapon_index := 0

var mouse_sensitivity = 700
var gamepad_sensitivity := 0.075

var mouse_captured := true

var movement_velocity: Vector3
var rotation_target: Vector3

var input_mouse: Vector2

var health: int = 100
var gravity := 0.0

var previously_floored := false

var jumps_remaining: int

var container_offset = Vector3(1.2, -1.1, -2.75)

var tween: Tween

var spawn_points: Array = []  # [{pos, yaw}] provided by the arena

# class + movement state
var hero: Dictionary
var max_health := 100
var sprint_speed := 8.0
var crouching := false
var sliding := false
var slide_time := 0.0
var slide_dir := Vector3.ZERO
var slide_speed := 0.0
var dash_time := 0.0
var dash_dir := Vector3.ZERO
var boost_vel := Vector3.ZERO
var boost_time := 0.0
var cd := {"a1": 0.0, "a2": 0.0}
var aegis_time := 0.0
var aegis_hp := 0.0
var cloak_time := 0.0
var cloaked := false
var slamming := false
var slam_grace := 0.0
var last_hit := 99.0
var regen_acc := 0.0
var sprinting := false

const STAND_H := 1.8
const CROUCH_H := 1.1
const HEAD_STAND := 1.6
const HEAD_CROUCH := 1.0
const DASH_SPEED := 17.0
const DASH_TIME := 0.22
const BOOST_TIME := 0.6

signal health_updated

@onready var camera = $Head/Camera
@onready var head: Node3D = $Head
@onready var collider: CollisionShape3D = $Collider
@onready var raycast = $Head/Camera/RayCast
@onready var muzzle = $Head/Camera/SubViewportContainer/SubViewport/CameraItem/Muzzle
@onready var container = $Head/Camera/SubViewportContainer/SubViewport/CameraItem/Container
@onready var sound_footsteps = $SoundFootsteps
@onready var blaster_cooldown = $Cooldown

@export var crosshair: TextureRect

# Functions

func _ready():
	_ready_physics()
	hero = Game.hero()
	max_health = hero.health
	health = max_health
	movement_speed = hero.speed
	sprint_speed = hero.sprint
	jump_strength = hero.jump
	(collider.shape as CapsuleShape3D).height = STAND_H
	health_updated.emit.call_deferred(health)
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	
	weapon = weapons[weapon_index] # Weapon must never be nil
	initiate_change_weapon(weapon_index)

func _ready_physics() -> void:
	floor_snap_length = 0.6
	floor_max_angle = deg_to_rad(50.0)
	floor_stop_on_slope = true
	floor_constant_speed = true
	floor_block_on_wall = true
	max_slides = 6

func _physics_process(delta):
	# Handle functions
	handle_controls(delta)
	handle_crouch_slide(delta)
	handle_abilities(delta)
	handle_gravity(delta)
	
	# Movement
	
	var applied_velocity: Vector3
	
	movement_velocity = transform.basis * movement_velocity # Move forward
	if boost_time > 0.0:
		movement_velocity += boost_vel * (boost_time / BOOST_TIME)
	
	applied_velocity = velocity.lerp(movement_velocity, delta * 10)
	if sliding:
		var t := clampf(slide_time / hero.slide_time, 0.0, 1.0)
		var sp := lerpf(movement_speed * 0.6, slide_speed, t)
		applied_velocity.x = slide_dir.x * sp
		applied_velocity.z = slide_dir.z * sp
	if dash_time > 0.0:
		applied_velocity.x = dash_dir.x * DASH_SPEED
		applied_velocity.z = dash_dir.z * DASH_SPEED
	applied_velocity.y = - gravity
	
	velocity = applied_velocity
	move_and_slide()
	
	# Slam landing
	if slamming and slam_grace <= 0.0 and is_on_floor():
		slamming = false
		shockwave()
	
	# Field of view kick (sprint / slide / dash)
	var fov_target := 80.0
	if dash_time > 0.0 or sliding:
		fov_target = 92.0
	elif sprinting:
		fov_target = 86.0
	camera.fov = lerpf(camera.fov, fov_target, delta * 8.0)
	
	# Rotation 
	container.position = lerp(container.position, container_offset - (basis.inverse() * applied_velocity / 30), delta * 10)
	
	# Movement sound
	
	sound_footsteps.stream_paused = true
	
	if is_on_floor():
		if abs(velocity.x) > 1 or abs(velocity.z) > 1:
			sound_footsteps.stream_paused = false
	
	# Landing after jump or falling
	
	camera.position.y = lerp(camera.position.y, 0.0, delta * 5)
	
	if is_on_floor() and gravity > 1 and !previously_floored: # Landed
		Audio.play("sounds/land.ogg")
		camera.position.y = -0.1
	
	previously_floored = is_on_floor()
	
	# Falling/respawning
	
	if position.y < -12:
		respawn()

# Crouch + slide ------------------------------------------------------------

func handle_crouch_slide(delta: float) -> void:
	var want := Input.is_action_pressed("crouch")
	var hspeed := Vector2(velocity.x, velocity.z).length()
	if Input.is_action_just_pressed("crouch") and is_on_floor() and not sliding and hspeed > movement_speed * 1.15:
		start_slide(hspeed)
	if sliding:
		slide_time -= delta
		if slide_time <= 0.0 or not want or not is_on_floor() and slide_time < hero.slide_time - 0.25:
			end_slide()
	var blocked := crouching and not want and not sliding and test_move(global_transform, Vector3.UP * (STAND_H - CROUCH_H + 0.05))
	crouching = want or sliding or blocked
	var target_h := CROUCH_H if crouching else STAND_H
	var shape := collider.shape as CapsuleShape3D
	if not is_equal_approx(shape.height, target_h):
		shape.height = target_h
		collider.position.y = target_h * 0.5
	head.position.y = lerpf(head.position.y, HEAD_CROUCH if crouching else HEAD_STAND, delta * 12.0)


func start_slide(hspeed: float) -> void:
	sliding = true
	slide_time = hero.slide_time
	slide_dir = Vector3(velocity.x, 0, velocity.z).normalized()
	slide_speed = maxf(hspeed, sprint_speed) * hero.slide_boost
	Audio.play("sounds/land.ogg")


func end_slide() -> void:
	sliding = false
	slide_time = 0.0

# Abilities -----------------------------------------------------------------

func handle_abilities(delta: float) -> void:
	for k in cd:
		cd[k] = maxf(0.0, cd[k] - delta)
	dash_time = maxf(0.0, dash_time - delta)
	boost_time = maxf(0.0, boost_time - delta)
	slam_grace = maxf(0.0, slam_grace - delta)
	aegis_time = maxf(0.0, aegis_time - delta)
	if aegis_time <= 0.0:
		aegis_hp = 0.0
	cloak_time = maxf(0.0, cloak_time - delta)
	cloaked = cloak_time > 0.0
	# Guardian passive: regen after 4s unhit
	last_hit += delta
	if hero.health > 100 and last_hit > 4.0 and health < max_health:
		regen_acc += 8.0 * delta
		if regen_acc >= 1.0:
			var add := int(regen_acc)
			regen_acc -= add
			health = mini(max_health, health + add)
			health_updated.emit(health)


func use_ability(slot: int) -> void:
	var def: Dictionary = hero["a%d" % slot]
	var key := "a%d" % slot
	match def.id:
		"thruster":
			if cd[key] > 0.0:
				return
			var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
			var dir := transform.basis * Vector3(input.x, 0, input.y)
			dash_dir = dir.normalized() if dir.length() > 0.1 else -transform.basis.z
			dash_dir.y = 0.0
			dash_dir = dash_dir.normalized()
			dash_time = DASH_TIME
			end_slide()
			cd[key] = def.cd
			Audio.play("sounds/jump_c.ogg")
		"camo":
			if cd[key] > 0.0:
				return
			cloak_time = 7.0
			cd[key] = def.cd
			Audio.play("sounds/weapon_change.ogg")
		"aegis":
			if cd[key] > 0.0:
				return
			aegis_time = 6.0
			aegis_hp = 120.0
			cd[key] = def.cd
			Audio.play("sounds/weapon_change.ogg")
		"slam":
			if slamming:
				gravity = 32.0  # second press: dive
			elif cd[key] <= 0.0:
				slamming = true
				slam_grace = 0.2
				gravity = -11.0
				boost_vel = -transform.basis.z * 6.0
				boost_time = BOOST_TIME
				cd[key] = def.cd
				Audio.play("sounds/jump_b.ogg")


func shockwave() -> void:
	Audio.play("sounds/enemy_destroy.ogg")
	camera.position.y = -0.3
	for e in get_tree().get_nodes_in_group("enemies"):
		var d: Vector3 = e.global_position - global_position
		if Vector2(d.x, d.z).length() < 9.0 and absf(d.y) < 8.0:
			e.damage(100)
	# expanding ring (visual)
	var ring := MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = 0.9
	t.outer_radius = 1.0
	ring.mesh = t
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(1.0, 0.63, 0.17, 0.8)
	ring.material_override = m
	get_parent().add_child(ring)
	ring.global_position = global_position + Vector3(0, 0.1, 0)
	ring.scale = Vector3(0.4, 0.4, 0.4)
	var tw := ring.create_tween().set_parallel(true).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUART)
	tw.tween_property(ring, "scale", Vector3(9.0, 1.0, 9.0), 0.45)
	tw.tween_property(m, "albedo_color:a", 0.0, 0.45)
	tw.chain().tween_callback(ring.queue_free)

# Teleport to a spawn point (used on start and if the player ever leaves the map)

func respawn():
	if spawn_points.is_empty():
		return
	var sp: Dictionary = spawn_points.pick_random()
	position = sp.pos
	velocity = Vector3.ZERO
	gravity = 0.0
	movement_velocity = Vector3.ZERO
	end_slide()
	dash_time = 0.0
	slamming = false
	rotation_target = Vector3(0, sp.yaw, 0)
	rotation.y = sp.yaw
	camera.rotation.x = 0.0
	reset_physics_interpolation()

# Mouse movement

func _input(event):
	if event is InputEventMouseMotion and mouse_captured:
		input_mouse = event.relative / mouse_sensitivity
		handle_rotation(event.relative.x, event.relative.y, false)

func handle_controls(delta):
	# Mouse capture
	if Input.is_action_just_pressed("mouse_capture"):
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		mouse_captured = true
	
	if Input.is_action_just_pressed("mouse_capture_exit"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		mouse_captured = false
		
		input_mouse = Vector2.ZERO
	
	# Movement
	var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	sprinting = Input.is_action_pressed("sprint") and input.y < -0.1 and not crouching
	var speed: float = movement_speed
	if crouching:
		speed *= 0.55
	elif sprinting:
		speed = sprint_speed
	movement_velocity = Vector3(input.x, 0, input.y).normalized() * speed
	
	# Handle Controller Rotation
	var rotation_input := Input.get_vector("camera_right", "camera_left", "camera_down", "camera_up")
	if rotation_input:
		handle_rotation(rotation_input.x, rotation_input.y, true, delta)
	
	# Shooting
	
	action_shoot()
	
	# Jumping
	
	if Input.is_action_just_pressed("jump"):
		if sliding:
			# slide-jump keeps the slide's momentum for a moment
			boost_vel = slide_dir * slide_speed * 0.7
			boost_time = BOOST_TIME
			end_slide()
		if jumps_remaining and not (crouching and not sliding):
			action_jump()
	
	if Input.is_action_just_pressed("ability_1"):
		use_ability(1)
	if Input.is_action_just_pressed("ability_2"):
		use_ability(2)
		
	# Weapon switching
	
	action_weapon_toggle()

# Camera rotation

func handle_rotation(xRot: float, yRot: float, isController: bool, delta: float = 0.0):
	if isController:
		rotation_target -= Vector3(-yRot, -xRot, 0).limit_length(1.0) * gamepad_sensitivity
		rotation_target.x = clamp(rotation_target.x, deg_to_rad(-90), deg_to_rad(90))
		camera.rotation.x = lerp_angle(camera.rotation.x, rotation_target.x, delta * 25)
		rotation.y = lerp_angle(rotation.y, rotation_target.y, delta * 25)
	else:
		rotation_target += (Vector3(-yRot, -xRot, 0) / mouse_sensitivity)
		rotation_target.x = clamp(rotation_target.x, deg_to_rad(-90), deg_to_rad(90))
		camera.rotation.x = rotation_target.x;
		rotation.y = rotation_target.y;
	
# Handle gravity

func handle_gravity(delta):
	if dash_time > 0.0:
		gravity = 0.0
		return
	gravity += 20 * delta

	if gravity < 0 and is_on_ceiling():
		gravity = 0
	
	if gravity > 0 and is_on_floor():
		jumps_remaining = number_of_jumps
		gravity = 0

# Jumping

func action_jump():
	Audio.play("sounds/jump_a.ogg, sounds/jump_b.ogg, sounds/jump_c.ogg")
	gravity = - jump_strength
	jumps_remaining -= 1

# Shooting

func action_shoot():
	if Input.is_action_pressed("shoot"):
		if !blaster_cooldown.is_stopped(): return # Cooldown for shooting
		
		Audio.play(weapon.sound_shoot)
		
		# Set muzzle flash position, play animation
		
		muzzle.play("default")
		
		muzzle.rotation_degrees.z = randf_range(-45, 45)
		muzzle.scale = Vector3.ONE * randf_range(0.40, 0.75)
		muzzle.position = container.position - weapon.muzzle_position
		
		blaster_cooldown.start(weapon.cooldown)
		
		# Shoot the weapon, amount based on shot count
		
		for n in weapon.shot_count:
			raycast.target_position.x = randf_range(-weapon.spread, weapon.spread)
			raycast.target_position.y = randf_range(-weapon.spread, weapon.spread)
			
			raycast.force_raycast_update()
			
			if !raycast.is_colliding(): continue # Don't create impact when raycast didn't hit
			
			var collider = raycast.get_collider()
			
			# Hitting an enemy
			
			if collider.has_method("damage"):
				collider.damage(weapon.damage)
			
			# Creating an impact animation
			
			var impact = preload("res://objects/impact.tscn")
			var impact_instance = impact.instantiate()
			
			impact_instance.play("shot")
			
			get_tree().root.add_child(impact_instance)
			
			impact_instance.position = raycast.get_collision_point() + (raycast.get_collision_normal() / 10)
			impact_instance.look_at(camera.global_transform.origin, Vector3.UP, true)
			
		var knockback = random_vec2(weapon.min_knockback, weapon.max_knockback)
		# print('knockback', knockback)
		container.position.z += 0.25 # Knockback of weapon visual
		camera.rotation.x += knockback.x # Knockback of camera
		rotation.y += knockback.y
		rotation_target.x += knockback.x
		rotation_target.y += knockback.y
		movement_velocity += Vector3(0, 0, weapon.knockback) # Knockback

# Toggle between available weapons (listed in 'weapons')

func action_weapon_toggle():
	if Input.is_action_just_pressed("weapon_toggle"):
		weapon_index = wrap(weapon_index + 1, 0, weapons.size())
		initiate_change_weapon(weapon_index)
		
		Audio.play("sounds/weapon_change.ogg")

# Initiates the weapon changing animation (tween)

func initiate_change_weapon(index):
	weapon_index = index
	
	tween = get_tree().create_tween()
	tween.set_ease(Tween.EASE_OUT_IN)
	tween.tween_property(container, "position", container_offset - Vector3(0, 1, 0), 0.1)
	tween.tween_callback(change_weapon) # Changes the model

# Switches the weapon model (off-screen)

func change_weapon():
	weapon = weapons[weapon_index]

	# Step 1. Remove previous weapon model(s) from container
	
	for n in container.get_children():
		container.remove_child(n)
	
	# Step 2. Place new weapon model in container
	
	var weapon_model = weapon.model.instantiate()
	container.add_child(weapon_model)
	
	weapon_model.position = weapon.position
	weapon_model.rotation_degrees = weapon.rotation
	
	# Step 3. Set model to only render on layer 2 (the weapon camera)
	
	for child in weapon_model.find_children("*", "MeshInstance3D"):
		child.layers = 2
		
	# Set weapon data
	
	raycast.target_position = Vector3(0, 0, -1) * weapon.max_distance
	crosshair.texture = weapon.crosshair

func damage(amount):
	last_hit = 0.0
	if aegis_time > 0.0 and aegis_hp > 0.0:
		var absorbed := minf(aegis_hp, float(amount))
		aegis_hp -= absorbed
		amount -= int(ceil(absorbed))
	if amount <= 0:
		return
	health -= amount
	health_updated.emit(health) # Update health on HUD
	
	if health <= 0:
		get_tree().reload_current_scene() # Reset when out of health

# Create a random knockback vector
static func random_vec2(_min: Vector2, _max: Vector2) -> Vector2:
	var _sign = -1 if randi() % 2 == 0 else 1
	return Vector2(randf_range(_min.x, _max.x), randf_range(_min.y, _max.y) * _sign)
