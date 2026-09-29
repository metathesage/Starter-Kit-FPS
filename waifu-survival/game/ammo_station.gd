class_name AmmoStation
extends Interactable

## Chapel ammo crate: tops up reserves for a flat salvage fee.


func setup(d: Node) -> void:
	director = d
	cost = Salvage.AMMO_REFILL
	_make_label("AMMO REFILL", Color(0.4, 0.95, 1.0))


func prompt_text() -> String:
	return "E - AMMO REFILL  [%d]" % cost


func interact() -> void:
	if director == null:
		return
	if not director.salvage.try_spend(cost):
		return
	var player: Survivor = director.player
	if player:
		player.refill()
