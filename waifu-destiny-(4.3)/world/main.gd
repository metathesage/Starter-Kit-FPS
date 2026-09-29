extends Node3D

@onready var player: PlayerFPS = $PlayerFPS
@onready var hud: HUD = $HUD
@onready var gacha_manager: GachaManager = $GachaManager
@onready var gacha_terminal: GachaTerminal = $Environment/GachaTerminal

var waifu_index: int = 0
var waifu_list = ["waifu_001_nova", "waifu_002_lux", "waifu_003_ria"]

func _ready() -> void:
	if hud and player:
		hud.setup_player_connections(player)
	
	if gacha_terminal and gacha_manager:
		gacha_terminal.gacha_manager = gacha_manager
		
	# Equip default waifu
	if player and player.stat_manager:
		player.stat_manager.gacha_manager = gacha_manager
		player.stat_manager.equip_waifu(waifu_list[0])

func _input(event: InputEvent) -> void:
	# Tab key to cycle through unlocked Waifus and test live stat changes!
	if event is InputEventKey and event.pressed and event.keycode == KEY_TAB:
		_cycle_waifu()

func _cycle_waifu() -> void:
	waifu_index = (waifu_index + 1) % waifu_list.size()
	var selected_id = waifu_list[waifu_index]
	if player and player.stat_manager:
		player.stat_manager.equip_waifu(selected_id)
