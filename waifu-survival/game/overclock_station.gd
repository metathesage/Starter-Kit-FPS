class_name OverclockStation
extends Interactable

## Rooftop OVERCLOCK: tiers multiply the operator's gun damage, forever.

var tier := 0


func setup(d: Node) -> void:
	director = d
	_make_label("OVERCLOCK BENCH", Color(1.0, 0.82, 0.2))


func prompt_text() -> String:
	if tier >= Salvage.OVERCLOCK_COSTS.size():
		return "OVERCLOCK MAXED"
	return "OVERCLOCK %d  [%d]" % [tier + 1, Salvage.OVERCLOCK_COSTS[tier]]


func interact() -> void:
	if director == null or tier >= Salvage.OVERCLOCK_COSTS.size():
		return
	if not director.salvage.try_spend(Salvage.OVERCLOCK_COSTS[tier]):
		return
	tier += 1
	director.player.damage_mult *= 1.75
	director.player.set_gold()
	if label:
		if tier >= Salvage.OVERCLOCK_COSTS.size():
			label.text = "OVERCLOCK MAXED"
		else:
			label.text = "OVERCLOCK %d" % tier
