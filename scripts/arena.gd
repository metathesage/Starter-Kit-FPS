extends Node3D
## Match shell: builds the selected map, drops the player on a spawn, seeds enemies.

@export var map_id := "lockout"

const MAPS := {
	"lockout": preload("res://maps/lockout.gd"),
	"beaver_creek": preload("res://maps/beaver_creek.gd"),
}
const ENEMY := preload("res://objects/enemy.tscn")
const FONT_DISPLAY := preload("res://fonts/chakra_petch_bold.ttf")
const FONT_BODY := preload("res://fonts/rajdhani_semibold.ttf")

var map: LevelKit

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
		var e := ENEMY.instantiate()
		e.player = player
		e.position = p
		enemies.add_child(e)
	($HUD/Health as Label).label_settings.font = FONT_DISPLAY
	_build_title_card()


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
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = map.ambient_energy
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


func _unhandled_input(event: InputEvent) -> void:
	# View/Back button or Tab returns to the map select
	if (event is InputEventJoypadButton and event.pressed and event.button_index == JOY_BUTTON_BACK) \
			or (event is InputEventKey and event.pressed and event.keycode == KEY_TAB):
		get_tree().change_scene_to_file("res://scenes/menu.tscn")
