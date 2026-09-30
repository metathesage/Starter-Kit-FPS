extends Node3D

signal killed

@export var player: Node3D

@onready var raycast = $RayCast
@onready var muzzle_a = $MuzzleA
@onready var muzzle_b = $MuzzleB

const WINDUP := 0.55        # telegraph: light swells, then a burst
const COOLDOWN := 1.1
const SHOT_DAMAGE := 5

var health := 100
var time := 0.0
var target_position: Vector3
var destroyed := false
var charge := 0.0
var cooldown := 0.0
var flash := 0.0
var _light: OmniLight3D
var _overlay: StandardMaterial3D
var _meshes: Array[MeshInstance3D] = []
var _phase := randf() * TAU

# When ready, save the initial position

func _ready():
	target_position = position
	$Timer.stop()  # firing is driven by the wind-up state machine below
	_light = OmniLight3D.new()
	_light.light_color = Color(1.0, 0.25, 0.15)
	_light.omni_range = 5.0
	_light.light_energy = 0.0
	_light.position = Vector3(0, 0.3, 0.6)
	add_child(_light)
	_overlay = StandardMaterial3D.new()
	_overlay.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_overlay.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_overlay.albedo_color = Color(1, 1, 1, 0)
	for m in find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		mi.material_overlay = _overlay
		_meshes.append(mi)


func _process(delta):
	if destroyed:
		return
	self.look_at(player.position + Vector3(0, 0.5, 0), Vector3.UP, true)  # Look at player
	time += delta
	# lazy figure-of-eight drift so drones never sit still
	position = target_position + Vector3(sin(time * 0.8 + _phase) * 1.3, sin(time * 3.0 + _phase) * 0.35, cos(time * 0.6 + _phase) * 1.3)

	# hit flash
	flash = maxf(0.0, flash - delta * 6.0)
	_overlay.albedo_color.a = flash * 0.85

	# wind-up -> burst state machine
	cooldown = maxf(0.0, cooldown - delta)
	if charge > 0.0 or (cooldown <= 0.0 and _sees_player()):
		charge += delta / WINDUP
		_light.light_energy = charge * charge * 5.0
		if charge >= 1.0:
			charge = 0.0
			cooldown = COOLDOWN
			for i in 3:
				get_tree().create_timer(i * 0.09).timeout.connect(_shoot)
	else:
		_light.light_energy = lerpf(_light.light_energy, 0.0, delta * 10.0)


func _sees_player() -> bool:
	if player and player.get("cloaked"):
		return false
	raycast.force_raycast_update()
	return raycast.is_colliding() and raycast.get_collider().has_method("damage")

# Take damage from player

func damage(amount):
	if destroyed:
		return
	Audio.play("sounds/enemy_hurt.ogg")
	health -= amount
	flash = 1.0
	charge = maxf(0.0, charge - 0.25)  # getting hit rattles the wind-up

	if health <= 0:
		destroy()

# Destroy the enemy when out of health

func destroy():
	Audio.play("sounds/enemy_destroy.ogg")
	destroyed = true
	killed.emit()
	_death_fx()
	queue_free()


func _death_fx() -> void:
	var host: Node = get_parent().get_parent() if get_parent() and get_parent().get_parent() else get_parent()
	if host == null:
		return
	var at := global_position
	var burst := CPUParticles3D.new()
	burst.one_shot = true
	burst.emitting = true
	burst.amount = 48
	burst.lifetime = 0.8
	burst.explosiveness = 1.0
	burst.direction = Vector3.UP
	burst.spread = 180.0
	burst.initial_velocity_min = 4.0
	burst.initial_velocity_max = 10.0
	burst.gravity = Vector3(0, -9.0, 0)
	var quad := QuadMesh.new()
	quad.size = Vector2(0.16, 0.16)
	var qm := StandardMaterial3D.new()
	qm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	qm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	qm.vertex_color_use_as_albedo = true
	quad.material = qm
	burst.mesh = quad
	var grad := Gradient.new()
	grad.colors = PackedColorArray([Color(1, 0.95, 0.7, 1), Color(1, 0.4, 0.1, 0.9), Color(0.2, 0.05, 0.02, 0)])
	grad.offsets = PackedFloat32Array([0.0, 0.35, 1.0])
	burst.color_ramp = grad
	host.add_child(burst)
	burst.global_position = at
	var flash_light := OmniLight3D.new()
	flash_light.light_color = Color(1.0, 0.6, 0.25)
	flash_light.omni_range = 8.0
	flash_light.light_energy = 7.0
	host.add_child(flash_light)
	flash_light.global_position = at
	var tw := flash_light.create_tween()
	tw.tween_property(flash_light, "light_energy", 0.0, 0.3)
	tw.tween_callback(flash_light.queue_free)
	get_tree().create_timer(1.2).timeout.connect(burst.queue_free)


# One shot of the burst; re-checks line of sight so dodging (or camo) still works

func _shoot():
	if destroyed or not is_inside_tree() or not _sees_player():
		return
	muzzle_a.frame = 0
	muzzle_a.play("default")
	muzzle_a.rotation_degrees.z = randf_range(-45, 45)
	muzzle_b.frame = 0
	muzzle_b.play("default")
	muzzle_b.rotation_degrees.z = randf_range(-45, 45)
	Audio.play("sounds/enemy_attack.ogg")
	raycast.get_collider().damage(SHOT_DAMAGE)


# Kept for the scene's signal connection; the timer is stopped in _ready

func _on_timer_timeout():
	pass
