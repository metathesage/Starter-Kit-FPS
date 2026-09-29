extends Node3D
class_name ExoticLootBeam

@export var beam_color: Color = Color(1.0, 0.82, 0.2, 1.0) # Sovereign Exotic Gold
@export var beam_height: float = 60.0
@export var rotation_speed: float = 1.8

@onready var core_beam: MeshInstance3D = $CoreBeam
@onready var rotating_rings: Node3D = $RotatingRings
@onready var omni_light: OmniLight3D = $OmniLight3D

var elapsed: float = 0.0

func _ready() -> void:
	if omni_light:
		omni_light.light_color = beam_color
		omni_light.light_energy = 4.5

func _process(delta: float) -> void:
	elapsed += delta
	if rotating_rings:
		rotating_rings.rotate_y(rotation_speed * delta)
		rotating_rings.position.y = 1.2 + sin(elapsed * 2.5) * 0.2
	
	if core_beam:
		# Pulsing intensity
		var pulse = 1.0 + sin(elapsed * 4.0) * 0.15
		core_beam.scale.x = pulse
		core_beam.scale.z = pulse
