shader_type spatial;
render_mode cull_front, unshaded, depth_draw_opaque;

uniform vec4 outline_color : source_color = vec4(0.12, 0.12, 0.16, 1.0);
uniform float outline_thickness : hint_range(0.001, 0.08, 0.002) = 0.035;

void vertex() {
	// Inverted Hull: extrude vertices along their normals in model space
	// Screen-space scaling so outline remains consistent across distances
	vec4 clip_position = PROJECTION_MATRIX * (MODELVIEW_MATRIX * vec4(VERTEX, 1.0));
	vec3 clip_normal = mat3(PROJECTION_MATRIX) * (mat3(MODELVIEW_MATRIX) * NORMAL);
	
	// Normalize screen space offset
	vec2 offset = normalize(clip_normal.xy) / VIEWPORT_SIZE * outline_thickness * clip_position.w * 100.0;
	clip_position.xy += offset;
	
	POSITION = clip_position;
}

void fragment() {
	ALBEDO = outline_color.rgb;
}
