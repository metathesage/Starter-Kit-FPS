shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_toon, specular_toon;

// --- UNIFORMS ---
uniform vec4 albedo_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);
uniform sampler2D albedo_texture : source_color, filter_linear_mipmap;

group_uniforms ToonRamp;
uniform float shadow_threshold : hint_range(0.0, 1.0, 0.05) = 0.45;
uniform float shadow_softness : hint_range(0.0, 0.2, 0.01) = 0.04;
uniform vec4 shadow_tint : source_color = vec4(0.55, 0.58, 0.7, 1.0);

group_uniforms Specular;
uniform float specular_size : hint_range(0.0, 1.0, 0.05) = 0.25;
uniform float specular_smoothness : hint_range(0.0, 0.2, 0.01) = 0.05;
uniform vec4 specular_color : source_color = vec4(1.0, 1.0, 1.0, 0.7);

group_uniforms RimLight;
uniform float rim_threshold : hint_range(0.0, 1.0, 0.05) = 0.65;
uniform float rim_softness : hint_range(0.0, 0.5, 0.02) = 0.1;
uniform vec4 rim_color : source_color = vec4(0.8, 0.9, 1.0, 1.0);

void fragment() {
	vec4 tex_color = texture(albedo_texture, UV);
	ALBEDO = albedo_color.rgb * tex_color.rgb;
	ROUGHNESS = 0.8;
	SPECULAR = 0.2;
}

void light() {
	// NdotL: Diffuse lighting factor
	float NdotL = dot(NORMAL, LIGHT);
	float light_intensity = smoothstep(shadow_threshold - shadow_softness, shadow_threshold + shadow_softness, NdotL);
	
	// Apply Toon lighting ramp with cool shadow tint
	vec3 light_color = mix(shadow_tint.rgb, vec3(1.0), light_intensity) * LIGHT_COLOR * ATTENUATION;
	
	// Specular band
	vec3 H = normalize(VIEW + LIGHT);
	float NdotH = dot(NORMAL, H);
	float spec = smoothstep(1.0 - specular_size - specular_smoothness, 1.0 - specular_size + specular_smoothness, NdotH);
	vec3 specular_result = spec * specular_color.rgb * light_intensity;
	
	// Rim lighting calculation
	float NdotV = 1.0 - max(dot(NORMAL, VIEW), 0.0);
	float rim = smoothstep(rim_threshold - rim_softness, rim_threshold + rim_softness, NdotV * NdotL);
	vec3 rim_result = rim * rim_color.rgb * LIGHT_COLOR;
	
	// Final composite for Godot 4 Cel Shading
	DIFFUSE_LIGHT += ALBEDO * light_color + rim_result;
	SPECULAR_LIGHT += specular_result;
}
