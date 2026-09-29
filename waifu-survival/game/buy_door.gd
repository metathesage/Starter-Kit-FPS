class_name BuyDoor
extends Interactable

## Buyable door: solid until paid for, then slides away forever. A closed
## door genuinely holds zombies back - they steer around it like any wall.

var open := false


func setup(d: Node, door_cost: int, door_body: Node3D) -> void:
	director = d
	cost = door_cost
	_make_label("", Color(0.4, 0.95, 1.0))
	_refresh(door_cost, door_body)
	_body = door_body


var _body: Node3D = null


func _refresh(c: int, _door: Node3D) -> void:
	cost = c
	if label:
		label.text = "OPEN DOOR  [%d]" % cost


func prompt_text() -> String:
	if open:
		return ""
	return "OPEN DOOR  [%d]" % cost


func interact() -> void:
	if open or director == null:
		return
	if not director.salvage.try_spend(cost):
		if label:
			label.text = "NEED %d SALVAGE" % cost
			_flash_back(cost)
		return
	open = true
	enabled = false
	if label:
		label.text = "OPEN"
		label.modulate = Color(0.4, 1.0, 0.6)
	if _body:
		var tween := create_tween()
		tween.tween_property(_body, "position:y", _body.position.y - 4.2, 0.8) \
			.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)


func _flash_back(c: int) -> void:
	await get_tree().create_timer(1.2).timeout
	if label and not open:
		label.text = "OPEN DOOR  [%d]" % c
