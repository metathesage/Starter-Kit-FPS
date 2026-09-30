extends Control
## Arena select. Keyboard, mouse and Xbox pad (D-pad / stick + A) all drive the same focus.

const FONT_DISPLAY := preload("res://fonts/chakra_petch_bold.ttf")
const FONT_BODY := preload("res://fonts/rajdhani_semibold.ttf")

const MAPS := [
	{"scene": "res://scenes/lockout.tscn", "name": "LOCKOUT", "tag": "FORERUNNER  /  100 x 60", "accent": Color("39e3ff"),
		"blurb": "Twin decks. Central tower. Two rail bridges. Every edge is sealed."},
	{"scene": "res://scenes/nuketown.tscn", "name": "NUKETOWN 24/7", "tag": "SUBURBAN  /  60 x 34", "accent": Color("ffa02b"),
		"blurb": "Two houses, one street, zero downtime. Kills respawn in seconds."},
	{"scene": "res://scenes/beaver_creek.tscn", "name": "BEAVER CREEK", "tag": "BUNKERS  /  60 x 48", "accent": Color("d23a2c"),
		"blurb": "Flat-shaded blocks. Walk-through halls. One bridge across the middle."},
]

const BG_SHADER := """
shader_type canvas_item;
uniform vec4 a : source_color = vec4(0.03, 0.035, 0.05, 1.0);
uniform vec4 b : source_color = vec4(0.10, 0.12, 0.17, 1.0);
void fragment() {
	vec2 uv = UV;
	float band = smoothstep(0.0, 1.0, 0.5 + 0.5 * sin((uv.x * 1.6 - uv.y) * 9.0 + TIME * 0.35));
	float grid = step(0.985, fract(uv.x * 48.0)) + step(0.985, fract(uv.y * 27.0));
	vec3 c = mix(a.rgb, b.rgb, band * (1.0 - uv.y * 0.6));
	c += grid * 0.035;
	c *= 1.0 - 0.55 * distance(uv, vec2(0.5));
	COLOR = vec4(c, 1.0);
}
"""

var _first: Button


func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	var sh := Shader.new()
	sh.code = BG_SHADER
	var sm := ShaderMaterial.new()
	sm.shader = sh
	bg.material = sm
	add_child(bg)

	var root := MarginContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right"]:
		root.add_theme_constant_override("margin_" + side, 72)
	root.add_theme_constant_override("margin_top", 56)
	root.add_theme_constant_override("margin_bottom", 48)
	add_child(root)

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 28)
	root.add_child(col)

	var kicker := _label("ARENA SELECT", FONT_BODY, 22, Color(1, 1, 1, 0.55))
	col.add_child(kicker)
	var title := _label("CHOOSE YOUR\nGROUND", FONT_DISPLAY, 84, Color.WHITE)
	title.add_theme_constant_override("line_spacing", -14)
	col.add_child(title)

	var row := GridContainer.new()
	row.columns = 3
	row.add_theme_constant_override("h_separation", 24)
	row.add_theme_constant_override("v_separation", 24)
	row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(row)

	var buttons: Array[Button] = []
	for i in MAPS.size():
		var b := _map_card(MAPS[i])
		row.add_child(b)
		buttons.append(b)
		b.modulate.a = 0.0
		b.position.y += 30
		var tw := create_tween().set_parallel(true).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUART)
		tw.tween_interval(0.12 * i)
		tw.chain().tween_property(b, "modulate:a", 1.0, 0.5)
	_first = buttons[0]

	col.add_child(_label("A / ENTER  DEPLOY        D-PAD / STICK  MOVE        VIEW / TAB  BACK TO THIS SCREEN", FONT_BODY, 20, Color(1, 1, 1, 0.5)))
	_first.grab_focus.call_deferred()
	_build_presence_chip()


func _label(text: String, font: Font, size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l


func _style(fill: Color, border: Color, width: int, offset := 0) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = fill
	s.border_color = border
	s.set_border_width_all(width)
	s.set_corner_radius_all(0)
	s.shadow_color = border if offset > 0 else Color(0, 0, 0, 0.4)
	s.shadow_size = 0
	s.shadow_offset = Vector2(offset, offset)
	s.content_margin_left = 32
	s.content_margin_right = 32
	s.content_margin_top = 28
	s.content_margin_bottom = 28
	return s


func _map_card(m: Dictionary) -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(360, 240)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.focus_mode = Control.FOCUS_ALL
	b.clip_text = false
	var accent: Color = m.accent
	b.add_theme_stylebox_override("normal", _style(Color(1, 1, 1, 0.05), Color(1, 1, 1, 0.22), 1))
	b.add_theme_stylebox_override("hover", _style(Color(1, 1, 1, 0.09), Color(1, 1, 1, 0.5), 1))
	b.add_theme_stylebox_override("focus", _style(Color(accent.r, accent.g, accent.b, 0.16), accent, 3, 10))
	b.add_theme_stylebox_override("pressed", _style(accent, accent, 3))
	b.text = ""

	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.offset_left = 32
	v.offset_top = 28
	v.offset_right = -32
	v.offset_bottom = -28
	v.add_theme_constant_override("separation", 6)
	b.add_child(v)
	var tag := _label(m.tag, FONT_BODY, 20, accent)
	v.add_child(tag)
	v.add_child(_label(m.name, FONT_DISPLAY, 38, Color.WHITE))
	var blurb := _label(m.blurb, FONT_BODY, 24, Color(1, 1, 1, 0.7))
	blurb.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(blurb)

	var scene: String = m.scene
	b.pressed.connect(func(): get_tree().change_scene_to_file(scene))
	b.focus_entered.connect(func():
		var tw := create_tween().set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
		b.pivot_offset = b.size * 0.5
		tw.tween_property(b, "scale", Vector2(1.03, 1.03), 0.18))
	b.focus_exited.connect(func():
		create_tween().tween_property(b, "scale", Vector2.ONE, 0.15))
	b.mouse_entered.connect(b.grab_focus)
	return b


# ---------- players online ----------

var _pres_dot: PanelContainer
var _pres_label: Label
var _pres_shown := 0.0
var _pres_tween: Tween


func _build_presence_chip() -> void:
	var chip := PanelContainer.new()
	chip.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	chip.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	chip.offset_top = 56
	chip.offset_right = -72
	var st := _style(Color(1, 1, 1, 0.06), Color(1, 1, 1, 0.28), 1)
	st.content_margin_top = 12
	st.content_margin_bottom = 12
	st.content_margin_left = 20
	st.content_margin_right = 22
	chip.add_theme_stylebox_override("panel", st)
	add_child(chip)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 14)
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	chip.add_child(h)
	_pres_dot = PanelContainer.new()
	_pres_dot.custom_minimum_size = Vector2(12, 12)
	_pres_dot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	h.add_child(_pres_dot)
	_pres_label = _label("CONNECTING", FONT_DISPLAY, 24, Color(1, 1, 1, 0.6))
	h.add_child(_pres_label)
	Presence.changed.connect(_on_presence)
	if Presence.attempted:
		_on_presence(Presence.count, Presence.connected)
	var pulse := create_tween().set_loops()
	pulse.tween_property(_pres_dot, "modulate:a", 0.25, 0.9).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(_pres_dot, "modulate:a", 1.0, 0.9).set_trans(Tween.TRANS_SINE)


func _dot_style(c: Color) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = c
	s.set_corner_radius_all(6)
	s.shadow_color = Color(c.r, c.g, c.b, 0.7)
	s.shadow_size = 8
	return s


func _on_presence(count: int, connected: bool) -> void:
	if not is_instance_valid(_pres_label):
		return
	if not connected:
		_pres_dot.add_theme_stylebox_override("panel", _dot_style(Color("6b7280")))
		_pres_label.text = "OFFLINE"
		_pres_label.add_theme_color_override("font_color", Color(1, 1, 1, 0.45))
		return
	_pres_dot.add_theme_stylebox_override("panel", _dot_style(Color("5dffa0")))
	_pres_label.add_theme_color_override("font_color", Color.WHITE)
	if _pres_tween:
		_pres_tween.kill()
	_pres_tween = create_tween().set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUART)
	_pres_tween.tween_method(func(v: float):
		_pres_shown = v
		_pres_label.text = "%s ONLINE" % _fmt(int(round(v))), _pres_shown, float(count), 0.8)


func _fmt(n: int) -> String:
	var s := str(n)
	var out := ""
	for i in s.length():
		if i > 0 and (s.length() - i) % 3 == 0:
			out += ","
		out += s[i]
	return out
