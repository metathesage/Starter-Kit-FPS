extends Node
class_name GachaManager

# Signals for UI and animation sequences
signal pull_completed(results: Array)
signal pity_updated(pity_4_star: int, pity_5_star: int)
signal new_character_unlocked(character_id: String, rarity: int)

# Gacha Rates (Standard Genshin-style benchmark)
const BASE_RATE_5_STAR: float = 0.006      # 0.6% base
const BASE_RATE_4_STAR: float = 0.051      # 5.1% base
const SOFT_PITY_THRESHOLD: int = 74
const HARD_PITY_5_STAR: int = 90
const HARD_PITY_4_STAR: int = 10

const SAVE_PATH: String = "user://gacha_save.json"

# State data persisted to browser local storage
var save_data: Dictionary = {
	"pity_5_star": 0,
	"pity_4_star": 0,
	"guaranteed_event_5_star": false,
	"owned_characters": ["waifu_001_nova"], # starter operative
	"owned_cosmetics": ["default_spartan_mark_v"],
	"pull_currency": 1600, # 10 starter pulls
	"pull_history": []
}

var character_db: Array = []

func _ready() -> void:
	load_character_database()
	load_save_data()

func load_character_database() -> void:
	var file := FileAccess.open("res://characters/waifus/character_registry.json", FileAccess.READ)
	if file:
		var json_text := file.get_as_text()
		var parsed = JSON.parse_string(json_text)
		if parsed is Array:
			character_db = parsed

func load_save_data() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
		if file:
			var parsed = JSON.parse_string(file.get_as_text())
			if parsed is Dictionary:
				for key in parsed.keys():
					save_data[key] = parsed[key]
	emit_signal("pity_updated", save_data["pity_4_star"], save_data["pity_5_star"])

func write_save_data() -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(save_data, "\t"))

# --- PULL LOGIC ---

func pull_multi(banner_id: String = "event_nova", count: int = 10) -> Array:
	var results: Array = []
	for i in range(count):
		var single_result = pull_single(banner_id)
		results.append(single_result)
	
	write_save_data()
	emit_signal("pull_completed", results)
	return results

func pull_single(banner_id: String = "event_nova") -> Dictionary:
	save_data["pity_5_star"] += 1
	save_data["pity_4_star"] += 1
	
	var p5 = save_data["pity_5_star"]
	var p4 = save_data["pity_4_star"]
	
	# Calculate dynamic 5-star rate with soft pity
	var rate_5 = BASE_RATE_5_STAR
	if p5 >= SOFT_PITY_THRESHOLD:
		# Escalates linearly from 0.6% up to 100% at pull 90
		rate_5 += (p5 - SOFT_PITY_THRESHOLD + 1) * 0.06
	
	var roll := randf()
	var rolled_rarity := 3
	
	if roll < rate_5 or p5 >= HARD_PITY_5_STAR:
		rolled_rarity = 5
	elif roll < (rate_5 + BASE_RATE_4_STAR) or p4 >= HARD_PITY_4_STAR:
		rolled_rarity = 4
	else:
		rolled_rarity = 3
	
	var reward: Dictionary = {}
	
	match rolled_rarity:
		5:
			save_data["pity_5_star"] = 0
			reward = roll_5_star(banner_id)
		4:
			save_data["pity_4_star"] = 0
			reward = roll_4_star(banner_id)
		3:
			reward = roll_3_star()
	
	# Log pull history
	save_data["pull_history"].append({
		"timestamp": Time.get_unix_time_from_system(),
		"banner": banner_id,
		"item": reward["name"],
		"rarity": rolled_rarity
	})
	
	emit_signal("pity_updated", save_data["pity_4_star"], save_data["pity_5_star"])
	return reward

func roll_5_star(banner_id: String) -> Dictionary:
	var is_featured := false
	if banner_id.begins_with("event_"):
		if save_data["guaranteed_event_5_star"] or randf() < 0.5:
			is_featured = true
			save_data["guaranteed_event_5_star"] = false
		else:
			is_featured = false
			save_data["guaranteed_event_5_star"] = true
	
	var chosen_id := "waifu_001_nova"
	if is_featured:
		chosen_id = "waifu_001_nova" # featured rate-up
	else:
		# Standard 5-star pool (Lux or Ria)
		var pool_5 = ["waifu_002_lux", "waifu_003_ria"]
		chosen_id = pool_5[randi() % pool_5.size()]
	
	return award_character(chosen_id, 5)

func roll_4_star(_banner_id: String) -> Dictionary:
	var pool_4 = ["waifu_004_nyx", "waifu_005_honey", "weapon_4s_rail_carbine", "weapon_4s_void_lance"]
	var chosen_item = pool_4[randi() % pool_4.size()]
	
	if chosen_item.begins_with("waifu_"):
		return award_character(chosen_item, 4)
	else:
		return {
			"id": chosen_item,
			"name": chosen_item.replace("weapon_4s_", "").capitalize(),
			"rarity": 4,
			"type": "weapon",
			"is_new": false
		}

func roll_3_star() -> Dictionary:
	var items_3s = [
		{"id": "cosmetic_shader_neon_blue", "name": "Armor Shader: Aurelian Teal", "type": "cosmetic"},
		{"id": "mat_relic_core_shard", "name": "Relic Core Shard", "type": "upgrade_material"},
		{"id": "weapon_3s_kinetic_rifle", "name": "Vanguard Scout Rifle", "type": "weapon"}
	]
	var item = items_3s[randi() % items_3s.size()]
	item["rarity"] = 3
	item["is_new"] = false
	return item

func award_character(char_id: String, rarity: int) -> Dictionary:
	var is_new = not (char_id in save_data["owned_characters"])
	if is_new:
		save_data["owned_characters"].append(char_id)
		emit_signal("new_character_unlocked", char_id, rarity)
	
	var char_data = get_character_data(char_id)
	return {
		"id": char_id,
		"name": char_data.get("name", "Unknown Operative"),
		"title": char_data.get("title", ""),
		"rarity": rarity,
		"type": "waifu",
		"element": char_data.get("element", "Kinetic"),
		"perk": char_data.get("perk", {}),
		"is_new": is_new
	}

func get_character_data(char_id: String) -> Dictionary:
	for c in character_db:
		if c.get("id") == char_id:
			return c
	return {}
