extends Node3D
class_name GachaTerminal

@export var gacha_manager: GachaManager

@onready var interaction_label: Label3D = $InteractionLabel
@onready var result_label: Label3D = $ResultLabel
@onready var halo_mesh: MeshInstance3D = $FloatingHalo
@onready var altar_light: OmniLight3D = $AltarLight

var player_in_range: bool = false
var elapsed: float = 0.0

func _ready() -> void:
	if not gacha_manager:
		gacha_manager = get_tree().root.find_child("GachaManager", true, false)
	_update_prompt()

func _process(delta: float) -> void:
	elapsed += delta
	if halo_mesh:
		halo_mesh.rotate_y(1.2 * delta)
		halo_mesh.position.y = 1.6 + sin(elapsed * 2.0) * 0.12

	if player_in_range and Input.is_action_just_pressed("tactical_ability"):
		_perform_pull()

func _on_area_3d_body_entered(body: Node3D) -> void:
	if body is PlayerFPS or body.name.to_lower().contains("player"):
		player_in_range = true
		interaction_label.visible = true
		_update_prompt()

func _on_area_3d_body_exited(body: Node3D) -> void:
	if body is PlayerFPS or body.name.to_lower().contains("player"):
		player_in_range = false
		interaction_label.visible = false

func _update_prompt() -> void:
	if gacha_manager and interaction_label:
		var p5 = gacha_manager.save_data.get("pity_5_star", 0)
		interaction_label.text = "[E] ACTIVATE RELIC SUMMON\n(10-Pull Gacha) | 5★ Pity: " + str(p5) + " / 90"

func _perform_pull() -> void:
	if not gacha_manager:
		return

	var results = gacha_manager.pull_multi("event_nova", 10)
	var highest_rarity = 3
	var result_text = "✦ SUMMON RESULTS ✦\n"
	
	for item in results:
		var r = item.get("rarity", 3)
		if r > highest_rarity:
			highest_rarity = r
		var prefix = "★★★ "
		if r == 4: prefix = "★★★★ "
		elif r == 5: prefix = "★★★★★ [SSR] "
		result_text += prefix + item.get("name", "Item") + "\n"

	result_label.text = result_text
	result_label.visible = true
	
	# Light burst based on rarity
	if highest_rarity == 5:
		altar_light.light_color = Color(1.0, 0.85, 0.2) # Gold
		altar_light.light_energy = 8.0
	elif highest_rarity == 4:
		altar_light.light_color = Color(0.75, 0.35, 1.0) # Purple
		altar_light.light_energy = 5.0
	else:
		altar_light.light_color = Color(0.3, 0.6, 1.0) # Blue
		altar_light.light_energy = 3.0

	var tween = create_tween()
	tween.tween_property(altar_light, "light_energy", 2.0, 1.5)
	
	_update_prompt()
