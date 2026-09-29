class_name SurvivalDirector
extends Node

## Owns the run: map, zombie pool, wave loop, salvage, PULSE, death/restart.

const BEST_PATH := "user://waifu_survival_best.json"

var salvage := Salvage.new()
var map: SurvivalMap
var hud: SurvivalHUD
var player: Survivor

var wave := 0
var kills := 0
var energy := 0.0
var game_over := false

var _zombies: Array[Zombie] = []
var _interactables: Array[Interactable] = []
var _spawned_left := 0
var _alive := 0


func _ready() -> void:
	await get_tree().process_frame
	player = get_tree().get_first_node_in_group("player") as Survivor
	if player == null:
		push_error("SurvivalDirector: no player node in group 'player'")
		return

	map = SurvivalMap.new()
	map.name = "Sector7"
	add_child(map)
	map.build()

	for d in map.doors:
		d.director = self
	for s in map.stations:
		s.director = self
	_interactables = map.doors.duplicate()
	_interactables.append_array(map.stations)

	for i in WaveTable.POOL_SIZE:
		var z := Zombie.new()
		z.name = "Zombie_%d" % i
		add_child(z)
		z.died.connect(_on_zombie_died)
		z.deactivate()
		_zombies.append(z)

	hud = SurvivalHUD.new()
	hud.name = "SurvivalHUD"
	add_child(hud)
	hud.setup(self)

	player.shot_hit.connect(_on_shot_hit)
	player.died.connect(_on_player_died)

	_run_waves()


func _process(_delta: float) -> void:
	if hud == null:
		return
	hud.set_wave_info(wave, _spawned_left + _alive)
	if game_over:
		if Input.is_action_just_pressed("reload"):
			get_tree().reload_current_scene()
		return
	_update_interact_prompt()
	if Input.is_action_just_pressed("ability"):
		_fire_pulse()


# ------------------------------------------------------------------ waves

func _run_waves() -> void:
	await get_tree().create_timer(0.5).timeout
	wave = 1
	while not game_over:
		var prep := WaveTable.FIRST_PREP if wave == 1 else WaveTable.INTERMISSION
		hud.banner("WAVE %d INCOMING" % wave)
		var t := int(ceilf(prep))
		while t > 0 and not game_over:
			hud.countdown(t)
			await get_tree().create_timer(1.0).timeout
			t -= 1
		if game_over:
			return
		hud.countdown(0)
		await _play_wave()
		if game_over:
			return
		salvage.award_wave_bonus(wave)
		hud.banner("WAVE %d CLEARED  +%d SALVAGE" % [wave, WaveTable.wave_clear_bonus(wave)])
		_save_best()
		wave += 1


func _play_wave() -> void:
	var budget := WaveTable.count(wave)
	_spawned_left = budget
	var brutes_left := WaveTable.brute_count(wave)
	var runner_p := WaveTable.runner_chance(wave)
	var brute_every := int(budget / brutes_left) if brutes_left > 0 else 0
	var spawned := 0

	while spawned < budget and not game_over:
		if _alive >= WaveTable.ALIVE_CAP:
			await get_tree().create_timer(0.25).timeout
			continue
		var kind := Zombie.Kind.WALKER
		if brutes_left > 0 and brute_every > 0 and spawned % brute_every == brute_every - 1:
			kind = Zombie.Kind.BRUTE
			brutes_left -= 1
		elif randf() < runner_p:
			kind = Zombie.Kind.RUNNER
		_spawn(kind)
		spawned += 1
		_spawned_left -= 1
		await get_tree().create_timer(WaveTable.spawn_interval(wave)).timeout

	while _alive > 0 and not game_over:
		await get_tree().create_timer(0.3).timeout


func _spawn(kind: Zombie.Kind) -> void:
	var idx := pick_index(map.windows, player.global_position, _camera_forward())
	var pos := map.windows[idx]
	for z in _zombies:
		if not z.is_alive():
			_alive += 1
			z.activate(kind, wave, pos, player)
			return


func _on_zombie_died(_z: Zombie, crit: bool) -> void:
	_alive = maxi(0, _alive - 1)
	kills += 1
	salvage.award_kill(crit)
	energy = minf(100.0, energy + 12.0)


func _on_shot_hit(zombie: Zombie, _crit: bool, _dmg: float) -> void:
	if zombie != null:
		salvage.award_hit()
		energy = minf(100.0, energy + 4.0)


# ------------------------------------------------------------------ ability

func _fire_pulse() -> void:
	if energy < 100.0:
		return
	energy = 0.0
	hud.banner("PULSE")
	for z in _zombies:
		if not z.is_alive():
			continue
		var to := z.global_position - player.global_position
		if to.length() <= 8.0:
			z.pulse_hit(60.0, to.normalized())


# ------------------------------------------------------------------ death

func _on_player_died() -> void:
	game_over = true
	_save_best()
	var best := _load_best()
	hud.show_results(wave, kills, salvage.earned_total, int(best.get("wave", 0)), int(best.get("score", 0)))


func _save_best() -> void:
	var best := _load_best()
	var changed := false
	if wave - 1 > int(best.get("wave", 0)):
		best["wave"] = wave - 1
		changed = true
	if salvage.earned_total > int(best.get("score", 0)):
		best["score"] = salvage.earned_total
		changed = true
	if changed:
		var f := FileAccess.open(BEST_PATH, FileAccess.WRITE)
		if f:
			f.store_string(JSON.stringify(best))


func _load_best() -> Dictionary:
	if not FileAccess.file_exists(BEST_PATH):
		return {}
	var f := FileAccess.open(BEST_PATH, FileAccess.READ)
	if f == null:
		return {}
	var parsed = JSON.parse_string(f.get_as_text())
	return parsed if parsed is Dictionary else {}


# ------------------------------------------------------------- interact

func _update_interact_prompt() -> void:
	var nearest: Interactable = null
	var best_dist := 2.6
	for it in _interactables:
		if not it.enabled or not is_instance_valid(it):
			continue
		var dist := it.global_position.distance_to(player.global_position)
		if dist < best_dist:
			best_dist = dist
			nearest = it
	if nearest == null:
		hud.prompt("")
		return
	hud.prompt(nearest.prompt_text())
	if Input.is_action_just_pressed("interact"):
		nearest.interact()


func _camera_forward() -> Vector3:
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return Vector3.FORWARD
	var f := -cam.global_transform.basis.z
	f.y = 0.0
	return f.normalized() if f.length_squared() > 0.0001 else Vector3.FORWARD


## Window selection: prefer breach points the player is NOT facing and that
## are at least 14 m away; among valid candidates take the farthest one.
## Deterministic so selftest.gd can assert on it.
static func pick_index(windows: Array[Vector3], from: Vector3, cam_fwd: Vector3) -> int:
	var best_i := 0
	var best_score := -1.0e9
	for i in windows.size():
		var to := windows[i] - from
		to.y = 0.0
		var dist := to.length()
		if dist < 0.001:
			continue
		var dot := to.normalized().dot(cam_fwd)
		var valid := dist > 14.0 or dot < -0.2
		var score := dist + (100.0 if valid else 0.0)
		if score > best_score:
			best_score = score
			best_i = i
	return best_i
