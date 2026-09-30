extends Control
## Class select shown before every match. Spartan / Guardian, controller-first.

const FONT_DISPLAY := preload("res://fonts/chakra_petch_bold.ttf")
const FONT_BODY := preload("res://fonts/rajdhani_semibold.ttf")

const BG_SHADER := """
shader_type canvas_item;
uniform vec4 tint : source_color = vec4(0.10, 0.12, 0.17, 1.0);
void fragment() {
	vec2 uv = UV;
	float band = smoothstep(0.0, 1.0, 0.5 + 0.5 * sin((uv.x * 1.2 + uv.y) * 8.0 - TIME * 0.3));
	vec3 c = mix(vec3(0.03, 0.035, 0.05), tint.rgb, band * (1.0 - uv.y * 0.5));
	c *= 1.0 - 0.6 * distance(uv, vec2(0.5));
	COLOR = vec4(c, 1.0);
}
"""


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
	root.add_theme_constant_override("margin_left", 72)
	root.add_theme_constant_override("margin_right", 72)
	root.add_theme_constant_override("margin_top", 48)
	root.add_theme_constant_override("margin_bottom", 40)
	add_child(root)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 20)
	root.add_child(col)
	col.add_child(_label("DEPLOYING TO  " + _map_name(), FONT_BODY, 22, Color(1, 1, 1, 0.55)))
	col.add_child(_label("CHOOSE YOUR CLASS", FONT_DISPLAY, 64, Color.WHITE))

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 28)
	row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(row)
	var first: Button
	for id in ["spartan", "guardian"]:
		var b := _card(id)
		row.add_child(b)
		if first == null:
			first = b
	col.add_child(_label("A / ENTER  DEPLOY        D-PAD / STICK  MOVE        B / ESC  BACK", FONT_BODY, 20, Color(1, 1, 1, 0.5)))
	first.grab_focus.call_deferred()


func _map_name() -> String:
	return Game.map_scene.get_file().get_basename().replace("_", " ").to_upper()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_tree().change_scene_to_file("res://scenes/menu.tscn")


func _label(text: String, font: Font, size: int, color: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


func _style(fill: Color, border: Color, width: int, offset := 0) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = fill
	s.border_color = border
	s.set_border_width_all(width)
	s.set_corner_radius_all(0)
	s.shadow_color = border if offset > 0 else Color(0, 0, 0, 0)
	s.shadow_size = 0
	s.shadow_offset = Vector2(offset, offset)
	return s


func _card(id: String) -> Button:
	var h: Dictionary = Game.HEROES[id]
	var accent: Color = h.accent
	var b := Button.new()
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.custom_minimum_size = Vector2(500, 380)
	b.focus_mode = Control.FOCUS_ALL
	b.add_theme_stylebox_override("normal", _style(Color(1, 1, 1, 0.05), Color(1, 1, 1, 0.22), 1))
	b.add_theme_stylebox_override("hover", _style(Color(1, 1, 1, 0.09), Color(1, 1, 1, 0.5), 1))
	b.add_theme_stylebox_override("focus", _style(Color(accent.r, accent.g, accent.b, 0.16), accent, 3, 10))
	b.add_theme_stylebox_override("pressed", _style(accent, accent, 3))
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.offset_left = 32
	v.offset_top = 26
	v.offset_right = -32
	v.offset_bottom = -26
	v.add_theme_constant_override("separation", 8)
	b.add_child(v)
	v.add_child(_label(h.role, FONT_BODY, 22, accent))
	v.add_child(_label(h.name, FONT_DISPLAY, 54, Color.WHITE))
	v.add_child(_label("HEALTH %d      SPEED %.1f      SPRINT %.1f" % [h.health, h.speed, h.sprint], FONT_BODY, 22, Color(1, 1, 1, 0.75)))
	v.add_child(_label("PASSIVE  " + h.passive, FONT_BODY, 22, Color(1, 1, 1, 0.6)))
	var sp := Control.new()
	sp.custom_minimum_size = Vector2(0, 8)
	sp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(sp)
	for k in ["a1", "a2"]:
		var a: Dictionary = h[k]
		var t := _label("%s  /  %.0fs\n%s" % [a.name, a.cd, a.desc], FONT_BODY, 22, Color.WHITE)
		t.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(t)
	for c in v.get_children():
		c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.pressed.connect(func():
		Game.hero_id = id
		get_tree().change_scene_to_file(Game.map_scene))
	b.mouse_entered.connect(b.grab_focus)
	b.focus_entered.connect(func():
		b.pivot_offset = b.size * 0.5
		create_tween().set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK).tween_property(b, "scale", Vector2(1.03, 1.03), 0.18))
	b.focus_exited.connect(func(): create_tween().tween_property(b, "scale", Vector2.ONE, 0.15))
	return b
