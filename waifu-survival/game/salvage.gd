class_name Salvage
extends RefCounted

## SALVAGE: the single run currency. Earned by shooting, spent between waves.
## `mult` is the operator passive (Scavenger = 1.25).

signal changed(balance: int)
signal gained(amount: int)
signal spent(amount: int)

const HIT := 10
const KILL_BODY := 60
const KILL_CRIT := 90
const AMMO_REFILL := 250
const OVERCLOCK_COSTS := [5000, 7500]

var balance: int = 0
var earned_total: int = 0
var mult: float = 1.0


func reset() -> void:
	balance = 0
	earned_total = 0
	mult = 1.0
	changed.emit(0)


func award(base: int) -> void:
	var amount := int(round(base * mult))
	if amount <= 0:
		return
	balance += amount
	earned_total += amount
	gained.emit(amount)
	changed.emit(balance)


func award_hit() -> void:
	award(HIT)


func award_kill(crit: bool) -> void:
	award(KILL_CRIT if crit else KILL_BODY)


func award_wave_bonus(wave: int) -> void:
	award(WaveTable.wave_clear_bonus(wave))


func try_spend(cost: int) -> bool:
	if balance < cost:
		return false
	balance -= cost
	spent.emit(cost)
	changed.emit(balance)
	return true
