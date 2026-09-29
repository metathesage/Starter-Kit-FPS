class_name Interactable
extends Node3D

## Base for anything bought/spent at a station or opened on a door.
## The director polls proximity and offers the nearest prompt.

var director: Node = null
var enabled := true
var label: Label3D = null
var cost := 0


func prompt_text() -> String:
	return ""


func interact() -> void:
	pass


func _make_label(text: String, color: Color) -> void:
	label = Label3D.new()
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	label.pixel_size = 0.006
	label.position = Vector3(0, 2.6, 0)
	label.text = text
	label.font_size = 40
	label.modulate = color
	add_child(label)
