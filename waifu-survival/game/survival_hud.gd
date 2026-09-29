class_name SurvivalHUD
extends CanvasLayer

## Neon IMGUI-free HUD: wave/salvage/ability top, vitals bottom-left,
## prompts bottom-center, banners center, results panel on death.

var director: SurvivalDirector

var _wave_label: Label
var _salvage_label: Label
var _best_label: Label
var _hp_bar: ProgressBar
var _shield_bar: ProgressBar
var _ammo_label: Label
var _ability_bar: ProgressBar
var _ability_label: Label
var _prompt_label: Label
var _banner_label: Label
var _countdown_label: Label
var _hint_label: Label
var _results: PanelContainer
var _flash := 0.0
var _pad := false

const CYAN := Color(0.35, 0.9, 1.0)
const GOLD := Color(1.0, 0.8, 0.2)


func setup(d: SurvivalDirector) -> void:
	director = d
	director.salvage.changed.connect(func(b): _salvage_label.text = "SALVAGE  %d" % b)
	director.salvage.gained.connect(func(_a): _flash = 0.4)

	var player := director.player
	player.health_changed.connect(_on_vitals)
	player.ammo_changed.connect(_on_ammo)
	_on_vitals(player.health, player.max_health, player.shield, player.max_shield)
	_on_ammo(player.current_ammo, player.mag_size, player.reserve_ammo)

	director.salvage.changed.emit(director.salvage.balance)
	_best_label.text = _best_text()


func _ready() -> void:
	layer = 10
	_wave_label = _label("WAVE 1", Vector2(24, 16), 30, CYAN, HORIZONTAL_ALIGNMENT_LEFT)
	_salvage_label = _label("SALVAGE  0", Vector2(24, 56), 22, GOLD, HORIZONTAL_ALIGNMENT_LEFT)
	_best_label = _label("", Vector2(24, 86), 14, Color(0.6, 0.55, 0.7), HORIZONTAL_ALIGNMENT_LEFT)
	_ammo_label = _label("", Vector2(24, -60), 26, Color.WHITE, HORIZONTAL_ALIGNMENT_LEFT, true)
	_ability_label = _label("PULSE READY [X]", Vector2(24, -120), 14, CYAN, HORIZONTAL_ALIGNMENT_LEFT, true)

	_hp_bar = _bar(Vector2(24, -100), 220, Color(0.9, 0.3, 0.35))
	_shield_bar = _bar(Vector2(24, -112), 220, Color(0.3, 0.6, 0.95))
	_ability_bar = _bar(Vector2(24, -140), 140, CYAN)

	_prompt_label = _label("", Vector2(0, -170), 20, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER, true)
	_banner_label = _label("", Vector2(0, -80), 44, Color.WHITE, HORIZONTAL_ALIGNMENT_CENTER, true)
	_countdown_label = _label("", Vector2(0, -130), 26, CYAN, HORIZONTAL_ALIGNMENT_CENTER, true)
	_banner_label.modulate.a = 0.0

	# Crosshair: center dot + four serif ticks, honest gap.
	_cross(Vector2(-2, -2), Vector2(4, 4), Color(1, 1, 1, 0.9))
	_cross(Vector2(-1, -16), Vector2(2, 10), Color(1, 1, 1, 0.7))
	_cross(Vector2(-1, 6), Vector2(2, 10), Color(1, 1, 1, 0.7))
	_cross(Vector2(-16, -1), Vector2(10, 2), Color(1, 1, 1, 0.7))
	_cross(Vector2(6, -1), Vector2(10, 2), Color(1, 1, 1, 0.7))

	_hint_label = Label.new()
	_hint_label.add_theme_font_size_override("font_size", 14)
	_hint_label.add_theme_color_override("font_color", Color(0.6, 0.55, 0.7))
	_hint_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(_hint_label)
	_hint_label.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_hint_label.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_hint_label.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_hint_label.offset_right = -16
	_hint_label.offset_bottom = -12

	_results = PanelContainer.new()
	_results.set_anchors_preset(Control.PRESET_CENTER)
	_results.visible = false
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 48)
	margin.add_theme_constant_override("margin_right", 48)
	margin.add_theme_constant_override("margin_top", 32)
	margin.add_theme_constant_override("margin_bottom", 32)
	_results.add_child(margin)
	var vbox := VBoxContainer.new()
	margin.add_child(vbox)
	var title := Label.new()
	title.text = "DOWN — RUN OVER"
	title.add_theme_font_size_override("font_size", 36)
	title.add_theme_color_override("font_color", Color(0.95, 0.25, 0.35))
	vbox.add_child(title)
	var stats := Label.new()
	stats.name = "Stats"
	stats.add_theme_font_size_override("font_size", 20)
	stats.add_theme_color_override("font_color", Color.WHITE)
	vbox.add_child(stats)
	var hint := Label.new()
	hint.text = "[R] NEW RUN"
	hint.add_theme_font_size_override("font_size", 16)
	hint.add_theme_color_override("font_color", CYAN)
	vbox.add_child(hint)
	add_child(_results)


func _process(delta: float) -> void:
	if director == null:
		return
	_ability_bar.value = director.energy
	_ability_label.text = "PULSE READY [X]" if director.energy >= 100.0 else "PULSE %d%%" % int(director.energy)
	if _flash > 0.0:
		_flash -= delta
		_salvage_label.modulate = Color(1.4, 1.1, 0.4) if _flash > 0.0 else Color.WHITE
	# Controller glyphs everywhere the moment a pad is connected.
	var pad := Input.get_connected_joypads().size() > 0
	if pad != _pad:
		_pad = pad
		_hint_label.text = _hint_text(pad)


func _hint_text(pad: bool) -> String:
	if pad:
		return "(A) JUMP   (B) DASH   (X) RELOAD   (Y) BUY\n(LB) PULSE   (RT) FIRE   (LT) AIM   (LS) SPRINT"
	return "WASD MOVE   SPACE JUMP   SHIFT SPRINT\nE BUY   X PULSE   Q DASH   R RELOAD   LMB FIRE   RMB AIM"


func set_wave_info(wave: int, remaining: int) -> void:
	_wave_label.text = "WAVE %d   ZOMBIES LEFT %d" % [wave, remaining]


func countdown(seconds: int) -> void:
	_countdown_label.text = "STARTS IN %d" % seconds if seconds > 0 else ""


func banner(text: String) -> void:
	_banner_label.text = text
	_banner_label.modulate.a = 1.0
	var tween := create_tween()
	tween.tween_interval(1.6)
	tween.tween_property(_banner_label, "modulate:a", 0.0, 0.9)


func prompt(text: String) -> void:
	if text == "":
		_prompt_label.text = ""
		return
	var key := "(Y)" if _pad else "(E)"
	_prompt_label.text = "%s  %s" % [key, text]


func show_results(wave: int, kills: int, earned: int, best_wave: int, best_score: int) -> void:
	var stats := _results.get_node("MarginContainer/VBoxContainer/Stats") as Label
	stats.text = "REACHED WAVE %d\nKILLS %d\nSALVAGE EARNED %d\nBEST: WAVE %d / %d SALVAGE" % [
		wave, kills, earned, best_wave, best_score]
	_results.visible = true


func _on_vitals(hp: float, max_hp: float, shield: float, max_shield: float) -> void:
	_hp_bar.max_value = max_hp
	_hp_bar.value = hp
	_shield_bar.max_value = max_shield
	_shield_bar.value = shield


func _on_ammo(cur: int, _mag: int, reserve: int) -> void:
	_ammo_label.text = "AMMO  %d / %d" % [cur, reserve]


func _best_text() -> String:
	if director == null:
		return ""
	var best: Dictionary = director._load_best()
	if best.is_empty():
		return "BEST: --"
	return "BEST: WAVE %s / %s SALVAGE" % [best.get("wave", 0), best.get("score", 0)]


func _label(text: String, pos: Vector2, size: int, color: Color, align: int, bottom: bool = false) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.horizontal_alignment = align
	l.top_level = false
	add_child(l)
	l.size = Vector2(1280, size + 10)
	if bottom:
		l.position = pos + Vector2(0, -0)
		l.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
		l.offset_top = pos.y - 720
		l.offset_bottom = pos.y - 720 + size + 10
		l.offset_left = pos.x
		l.offset_right = pos.x + 1280
	else:
		l.position = pos
	return l


func _cross(pos: Vector2, size: Vector2, color: Color) -> void:
	var c := ColorRect.new()
	c.color = color
	c.size = size
	c.position = Vector2(640, 360) + pos
	add_child(c)


func _bar(pos: Vector2, width: float, color: Color) -> ProgressBar:
	var b := ProgressBar.new()
	b.show_percentage = false
	b.min_value = 0
	b.max_value = 100
	b.value = 100
	b.size = Vector2(width, 10)
	b.position = pos
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0, 0, 0, 0.5)
	b.add_theme_stylebox_override("background", style)
	var fill := StyleBoxFlat.new()
	fill.bg_color = color
	b.add_theme_stylebox_override("fill", fill)
	add_child(b)
	return b
