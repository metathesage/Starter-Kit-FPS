extends Node
class_name PlayerStatManager

# Signals for HUD and gameplay controllers
signal active_waifu_changed(waifu_data: Dictionary)
signal stats_recalculated(final_stats: Dictionary)
signal ultimate_cosmetic_triggered(anim_name: String, cosmetic_fx: String)

@export var gacha_manager: GachaManager

# Base shooter stats (Destiny-lite baseline)
var base_stats: Dictionary = {
	"max_health": 100.0,
	"max_shield": 100.0,
	"shield_regen_delay": 3.0,
	"movement_speed": 7.0,
	"dash_distance": 8.0,
	"reload_speed_mult": 1.0,
	"crit_damage_mult": 1.5,
	"fire_rate_mult": 1.0
}

# Current active stats with waifu perk modifiers applied
var active_stats: Dictionary = {}
var active_waifu: Dictionary = {}

func _ready() -> void:
	recalculate_stats()

func equip_waifu(waifu_id: String) -> void:
	if not gacha_manager:
		return
	
	var data = gacha_manager.get_character_data(waifu_id)
	if data.is_empty():
		return
		
	active_waifu = data
	recalculate_stats()
	emit_signal("active_waifu_changed", active_waifu)

func recalculate_stats() -> void:
	# Clone base stats
	active_stats = base_stats.duplicate()
	
	if active_waifu.has("perk") and active_waifu["perk"].has("stat_modifiers"):
		var mods: Dictionary = active_waifu["perk"]["stat_modifiers"]
		
		if mods.has("crit_damage"):
			active_stats["crit_damage_mult"] += mods["crit_damage"]
		if mods.has("reload_speed"):
			active_stats["reload_speed_mult"] += mods["reload_speed"]
		if mods.has("max_shield"):
			active_stats["max_shield"] *= (1.0 + mods["max_shield"])
		if mods.has("shield_regen_delay"):
			active_stats["shield_regen_delay"] = max(1.0, active_stats["shield_regen_delay"] * (1.0 + mods["shield_regen_delay"]))
		if mods.has("movement_speed"):
			active_stats["movement_speed"] *= (1.0 + mods["movement_speed"])
		if mods.has("dash_distance"):
			active_stats["dash_distance"] *= (1.0 + mods["dash_distance"])
		if mods.has("fire_rate"):
			active_stats["fire_rate_mult"] += mods["fire_rate"]
			
	emit_signal("stats_recalculated", active_stats)

func trigger_boss_kill_cosmetic() -> void:
	if active_waifu.has("ultimate"):
		var ult: Dictionary = active_waifu["ultimate"]
		emit_signal("ultimate_cosmetic_triggered", ult.get("name", ""), ult.get("cosmetic_fx", ""))
