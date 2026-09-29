extends Control
class_name HUD

@onready var shield_bar: ProgressBar = $BottomLeft/ShieldBar
@onready var health_bar: ProgressBar = $BottomLeft/HealthBar
@onready var waifu_label: Label = $BottomLeft/WaifuBadge
@onready var dash_charges_label: Label = $BottomLeft/DashLabel

@onready var ammo_label: Label = $BottomRight/AmmoCount
@onready var weapon_label: Label = $BottomRight/WeaponName

@onready var crosshair: Control = $Center/Crosshair
@onready var hitmarker: Label = $Center/Hitmarker

func setup_player_connections(player: PlayerFPS) -> void:
	player.ammo_changed.connect(_on_ammo_changed)
	player.health_shield_changed.connect(_on_health_shield_changed)
	player.dash_charges_changed.connect(_on_dash_charges_changed)
	player.hit_registered.connect(_on_hit_registered)
	
	if player.stat_manager:
		player.stat_manager.active_waifu_changed.connect(_on_active_waifu_changed)

func _on_ammo_changed(current: int, max_mag: int, reserve: int) -> void:
	ammo_label.text = str(current) + " / " + str(reserve)

func _on_health_shield_changed(h: float, max_h: float, s: float, max_s: float) -> void:
	health_bar.max_value = max_h
	health_bar.value = h
	shield_bar.max_value = max_s
	shield_bar.value = s

func _on_dash_charges_changed(charges: int, max_charges: int, ratio: float) -> void:
	var charge_str = ""
	for i in range(max_charges):
		if i < charges:
			charge_str += "◆ "
		else:
			charge_str += "◇ "
	dash_charges_label.text = "JET-DASH: " + charge_str

func _on_hit_registered(is_crit: bool, _damage: float, _hit_pos: Vector3) -> void:
	hitmarker.visible = true
	if is_crit:
		hitmarker.modulate = Color(1.0, 0.85, 0.2, 1.0) # Gold
		hitmarker.text = "╳"
	else:
		hitmarker.modulate = Color(1.0, 1.0, 1.0, 0.85) # White
		hitmarker.text = "✕"
		
	var tween = create_tween()
	tween.tween_property(hitmarker, "modulate:a", 0.0, 0.18)
	tween.tween_callback(func(): hitmarker.visible = false)

func _on_active_waifu_changed(waifu_data: Dictionary) -> void:
	var w_name = waifu_data.get("name", "Nova")
	var rarity = waifu_data.get("rarity", 5)
	var prefix = "[SSR] " if rarity == 5 else "[SR] "
	var perk_desc = waifu_data.get("perk", {}).get("description", "")
	waifu_label.text = prefix + w_name.to_upper() + " | " + perk_desc
