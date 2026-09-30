extends Node3D
## Match shell: builds the selected map, drops the player on a spawn, seeds enemies.

@export var map_id := "lockout"

const MAPS := {
	"lockout": preload("res://maps/lockout.gd"),
	"beaver_creek": preload("res://maps/beaver_creek.gd"),
	"nuketown": preload("res://maps/nuketown.gd"),
	"the_pit": preload("res://maps/the_pit.gd"),
	"terminal": preload("res://maps/terminal.gd"),
	"rust": preload("res://maps/rust.gd"),
	"cinder": preload("res://maps/cinder.gd"),
	"triad": preload("res://maps/triad.gd"),
}
const ENEMY := preload("res://objects/enemy.tscn")
const FONT_DISPLAY := preload("res://fonts/chakra_petch_bold.ttf")
const FONT_BODY := preload("res://fonts/rajdhani_semibold.ttf")

var map: LevelKit
var kills := 0
var _kill_label: Label

@onready var player: CharacterBody3D = $Player
@onready var enemies: Node = $Enemies
@onready var sun: DirectionalLight3D = $Sun
@onready var world_env: WorldEnvironment = $WorldEnvironment


func _ready() -> void:
	map = MAPS[map_id].new()
	add_child(map)
	_apply_look()
	player.number_of_jumps = 1
	player.spawn_points = map.spawns
	player.respawn()
	for p in map.enemy_spawns:
		_spawn_enemy(p)
	($HUD/Health as Label).label_settings.font = FONT_DISPLAY
	_build_title_card()
	_build_kill_counter()
	var ah := preload("res://scripts/ability_hud.gd").new()
	ah.player = player
	$HUD.add_child(ah)


func _spawn_enemy(p: Vector3) -> void:
	var e := ENEMY.instantiate()
	e.player = player
	e.position = p
	e.killed.connect(_on_enemy_destroyed.bind(p))
	e.add_to_group("enemies")
	enemies.add_child(e)


# 24/7: every kill is replaced a few seconds later, so the fight never runs dry
func _on_enemy_destroyed(p: Vector3) -> void:
	kills += 1
	_kill_label.text = "KILLS  %d" % kills
	var tw := create_tween().set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
	_kill_label.pivot_offset = _kill_label.size * 0.5
	tw.tween_property(_kill_label, "scale", Vector2(1.25, 1.25), 0.08)
	tw.tween_property(_kill_label, "scale", Vector2.ONE, 0.2)
	get_tree().create_timer(3.5).timeout.connect(func():
		if is_inside_tree():
			_spawn_enemy(p))


func _apply_look() -> void:
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = map.sky_top
	sky_mat.sky_horizon_color = map.sky_horizon
	sky_mat.ground_horizon_color = map.sky_horizon.darkened(0.25)
	sky_mat.ground_bottom_color = map.ground_color
	var sky := Sky.new()
	sky.sky_material = sky_mat
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = map.sky_horizon.lerp(Color.WHITE, 0.4)
	env.ambient_light_energy = map.ambient_energy * 0.45
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.glow_bloom = 0.05
	world_env.environment = env
	sun.light_color = map.sun_color
	sun.light_energy = map.sun_energy
	sun.rotation_degrees = map.sun_rotation
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 120.0


func _build_title_card() -> void:
	var hud: CanvasLayer = $HUD
	var box := VBoxContainer.new()
	box.position = Vector2(48, 44)
	box.add_theme_constant_override("separation", -4)
	hud.add_child(box)
	var t := Label.new()
	t.text = map.map_name
	t.add_theme_font_override("font", FONT_DISPLAY)
	t.add_theme_font_size_override("font_size", 44)
	t.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.6))
	t.add_theme_constant_override("outline_size", 10)
	box.add_child(t)
	var s := Label.new()
	s.text = map.map_tag
	s.add_theme_font_override("font", FONT_BODY)
	s.add_theme_font_size_override("font_size", 20)
	s.add_theme_color_override("font_color", Color(1, 1, 1, 0.75))
	box.add_child(s)
	var tw := create_tween()
	tw.tween_interval(3.5)
	tw.tween_property(box, "modulate:a", 0.0, 1.2)


func _build_kill_counter() -> void:
	_kill_label = Label.new()
	_kill_label.text = "KILLS  0"
	_kill_label.add_theme_font_override("font", FONT_DISPLAY)
	_kill_label.add_theme_font_size_override("font_size", 36)
	_kill_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.6))
	_kill_label.add_theme_constant_override("outline_size", 10)
	_kill_label.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_kill_label.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_kill_label.offset_top = 44
	_kill_label.offset_right = -48
	$HUD.add_child(_kill_label)


func _unhandled_input(event: InputEvent) -> void:
	# View/Back button or Tab returns to the map select
	if (event is InputEventJoypadButton and event.pressed and event.button_index == JOY_BUTTON_BACK) \
			or (event is InputEventKey and event.pressed and event.keycode == KEY_TAB):
		get_tree().change_scene_to_file("res://scenes/menu.tscn")
