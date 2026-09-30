extends Control
## Bottom-right ability chips (radial cooldown, drawn icons), class tag, camo / aegis overlays.
## Everything is drawn with primitives: one stroke width, one corner language.

const FONT := preload("res://fonts/chakra_petch_bold.ttf")
const BODY := preload("res://fonts/rajdhani_semibold.ttf")

var player: CharacterBody3D
var pad := false
var _pulse := 0.0


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _input(event: InputEvent) -> void:
	if event is InputEventJoypadButton or (event is InputEventJoypadMotion and absf(event.axis_value) > 0.4):
		pad = true
	elif event is InputEventKey or event is InputEventMouseButton:
		pad = false


func _process(delta: float) -> void:
	_pulse += delta
	size = get_viewport_rect().size
	queue_redraw()


func _draw() -> void:
	if player == null or player.hero.is_empty():
		return
	var hero: Dictionary = player.hero
	var accent: Color = hero.accent
	var sz := size
	# overlays
	if player.cloaked:
		var a := 0.10 + 0.04 * sin(_pulse * 6.0)
		draw_rect(Rect2(Vector2.ZERO, sz), Color(0.2, 1.0, 0.6, a))
		_frame(sz, Color(0.3, 1.0, 0.7, 0.55), 6.0)
	if player.aegis_time > 0.0:
		_frame(sz, Color(1.0, 0.63, 0.17, 0.5), 10.0)
	# chips
	var r := 44.0
	for i in 2:
		var slot := i + 1
		var def: Dictionary = hero["a%d" % slot]
		var c := Vector2(sz.x * 0.5 + (i * 2 - 1) * (r + 16), sz.y - 60 - r)
		var remaining: float = player.cd["a%d" % slot]
		var active := _active_time(def.id)
		var ready := remaining <= 0.0
		var col := accent if ready else Color(1, 1, 1, 0.35)
		draw_circle(c, r, Color(0, 0, 0, 0.45))
		draw_arc(c, r, 0, TAU, 64, Color(1, 1, 1, 0.18), 3.0, true)
		if not ready:
			draw_arc(c, r, -PI / 2, -PI / 2 + TAU * (1.0 - remaining / def.cd), 64, accent, 5.0, true)
		elif active > 0.0:
			draw_arc(c, r + 6, 0, TAU, 64, accent, 3.0, true)
		else:
			draw_arc(c, r, 0, TAU, 64, accent, 3.0, true)
		_icon(def.id, c, col)
		var key := _key_label(slot)
		var kw := BODY.get_string_size(key, HORIZONTAL_ALIGNMENT_LEFT, -1, 22).x
		draw_string(BODY, c + Vector2(-kw * 0.5, r + 26), key, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color(1, 1, 1, 0.75))
		if not ready:
			var txt := "%.0f" % ceilf(remaining)
			var tw := FONT.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 30).x
			draw_string(FONT, c + Vector2(-tw * 0.5, 10), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 30, Color.WHITE)
	# class tag
	var tag: String = "%s  /  %s" % [hero.name, hero.role]
	draw_string(BODY, Vector2(48, sz.y - 96), tag, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color(accent.r, accent.g, accent.b, 0.9))
	# state readout
	var state := ""
	if player.sliding:
		state = "SLIDE"
	elif player.crouching:
		state = "CROUCH"
	elif player.sprinting:
		state = "SPRINT"
	if state != "":
		draw_string(FONT, Vector2(48, sz.y - 128), state, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, Color(1, 1, 1, 0.85))


func _active_time(id: String) -> float:
	match id:
		"camo":
			return player.cloak_time
		"aegis":
			return player.aegis_time
		"thruster":
			return player.dash_time
		"slam":
			return 1.0 if player.slamming else 0.0
	return 0.0


func _key_label(slot: int) -> String:
	if pad:
		return "LB" if slot == 1 else "X"
	return "Q" if slot == 1 else "F"


func _frame(sz: Vector2, col: Color, w: float) -> void:
	draw_rect(Rect2(0, 0, sz.x, w), col)
	draw_rect(Rect2(0, sz.y - w, sz.x, w), col)
	draw_rect(Rect2(0, 0, w, sz.y), col)
	draw_rect(Rect2(sz.x - w, 0, w, sz.y), col)


func _icon(id: String, c: Vector2, col: Color) -> void:
	var w := 3.0
	match id:
		"thruster":  # three chevrons
			for k in 3:
				var x := c.x - 14 + k * 14
				draw_polyline(PackedVector2Array([Vector2(x - 6, c.y - 12), Vector2(x + 6, c.y), Vector2(x - 6, c.y + 12)]), col, w, true)
		"camo":  # eye
			draw_arc(c + Vector2(0, 12), 22, deg_to_rad(215), deg_to_rad(325), 16, col, w, true)
			draw_arc(c + Vector2(0, -12), 22, deg_to_rad(35), deg_to_rad(145), 16, col, w, true)
			draw_circle(c, 6, col)
		"aegis":  # shield
			draw_polyline(PackedVector2Array([Vector2(c.x - 16, c.y - 16), Vector2(c.x + 16, c.y - 16), Vector2(c.x + 16, c.y + 2),
				Vector2(c.x, c.y + 18), Vector2(c.x - 16, c.y + 2), Vector2(c.x - 16, c.y - 16)]), col, w, true)
		"slam":  # down arrow + shock line
			draw_line(c + Vector2(0, -16), c + Vector2(0, 8), col, w, true)
			draw_polyline(PackedVector2Array([c + Vector2(-9, -1), c + Vector2(0, 9), c + Vector2(9, -1)]), col, w, true)
			draw_line(c + Vector2(-18, 17), c + Vector2(18, 17), col, w, true)
