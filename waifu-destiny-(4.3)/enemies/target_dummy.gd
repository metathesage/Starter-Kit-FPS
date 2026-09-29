extends CharacterBody3D
class_name TargetDummy

@export var max_health: float = 280.0
@export var respawn_time: float = 4.0

@onready var core_mesh: MeshInstance3D = $CoreWeakpoint
@onready var armor_mesh: MeshInstance3D = $ArmorPlating
@onready var collision_shape: CollisionShape3D = $CollisionShape3D
@onready var health_bar_label: Label3D = $HealthLabel

var current_health: float = 280.0
var is_dead: bool = false
var respawn_timer: float = 0.0
var hover_timer: float = 0.0
var initial_pos_y: float = 0.0

const EXOTIC_BEAM_SCENE = preload("res://loot/exotic_loot_beam.tscn")

func _ready() -> void:
	current_health = max_health
	initial_pos_y = position.y
	_update_label()

func _process(delta: float) -> void:
	if is_dead:
		respawn_timer -= delta
		if respawn_timer <= 0.0:
			_respawn()
		return

	# Gentle levitation hover animation
	hover_timer += delta
	position.y = initial_pos_y + sin(hover_timer * 2.2) * 0.18
	if armor_mesh:
		armor_mesh.rotate_y(0.8 * delta)
	if core_mesh:
		core_mesh.rotate_y(-1.4 * delta)

func is_weakpoint_hit(hit_pos: Vector3) -> bool:
	if core_mesh:
		var core_global_pos = core_mesh.global_position
		return hit_pos.distance_to(core_global_pos) <= 0.42
	return false

func take_damage(amount: float, is_critical: bool) -> void:
	if is_dead:
		return

	current_health -= amount
	_spawn_damage_number(amount, is_critical)
	_flash_material(is_critical)
	_update_label()

	if current_health <= 0.0:
		_die()

func _spawn_damage_number(amount: float, is_critical: bool) -> void:
	var label = Label3D.new()
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	label.pixel_size = 0.007
	
	if is_critical:
		label.text = "CRIT " + str(int(amount)) + "!"
		label.modulate = Color(1.0, 0.85, 0.2, 1.0) # Yellow/Gold
		label.scale = Vector3(1.4, 1.4, 1.4)
	else:
		label.text = str(int(amount))
		label.modulate = Color(1.0, 1.0, 1.0, 0.9) # White
		
	get_parent().add_child(label)
	label.global_position = global_position + Vector3(randf_range(-0.3, 0.3), 1.2, randf_range(-0.3, 0.3))
	
	# Tween floating upward and fading out
	var tween = create_tween()
	tween.tween_property(label, "position:y", label.position.y + 1.2, 0.75).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(label, "modulate:a", 0.0, 0.75)
	tween.tween_callback(label.queue_free)

func _flash_material(is_critical: bool) -> void:
	if not core_mesh: return
	var flash_color = Color(1.0, 0.9, 0.2, 1.0) if is_critical else Color(1.0, 0.2, 0.2, 1.0)
	var mat = core_mesh.get_surface_override_material(0)
	if mat is StandardMaterial3D:
		mat.albedo_color = flash_color
		var tween = create_tween()
		tween.tween_property(mat, "albedo_color", Color(0.2, 0.7, 1.0, 1.0), 0.15)

func _update_label() -> void:
	if health_bar_label:
		health_bar_label.text = "AURELIAN CONSTRUCT\nHP: " + str(max(0, int(current_health))) + " / " + str(int(max_health))

func _die() -> void:
	is_dead = true
	respawn_timer = respawn_time
	visible = false
	collision_shape.disabled = true
	
	# Spawn Exotic Loot Beam on kill!
	var beam = EXOTIC_BEAM_SCENE.instantiate()
	get_parent().add_child(beam)
	beam.global_position = global_position
	
	# Clean up beam after 8 seconds
	var timer = get_tree().create_timer(8.0)
	timer.timeout.connect(beam.queue_free)

func _respawn() -> void:
	is_dead = false
	current_health = max_health
	visible = true
	collision_shape.disabled = false
	_update_label()
