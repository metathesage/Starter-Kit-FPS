extends SceneTree
## Headless collision / stuck / fall test for a map.
##   godot --headless --fixed-fps 60 -s tools/map_test.gd -- lockout
## 1. Walks the real Player along the map's waypoint routes (fails on stall).
## 2. Random-walk fuzz with jumps: fails if the player leaves the map or gets pinned.

var arena: Node3D
var player: CharacterBody3D
var map: LevelKit
var phase := "route"
var route_i := 0
var wp_i := 0
var wp_time := 0.0
var progress_ref := Vector3.ZERO
var progress_time := 0.0
var jump_release := false
var failures := 0
var frame := 0
var fuzz_run := 0
var spawn_i := 0
var spawn_t := 0
var fuzz_time := 0.0
var fuzz_heading := 0.0
var fuzz_anchor := Vector3.ZERO
var fuzz_anchor_t := 0.0
var fuzz_probe := Vector3.ZERO
var fuzz_prev := Vector3.ZERO
var fuzz_path := 0.0
var fuzz_probe_t := 0.0
var rng := RandomNumberGenerator.new()
const FUZZ_RUNS := 24
const FUZZ_SECONDS := 20.0


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var id: String = args[0] if args.size() > 0 else "lockout"
	arena = load("res://scenes/arena.tscn").instantiate()
	arena.map_id = id
	root.add_child(arena)
	rng.seed = 1234
	print("== map_test: ", id)


func _start_route() -> void:
	var path: PackedVector3Array = map.nav_paths[route_i]
	player.position = path[0]
	player.velocity = Vector3.ZERO
	player.gravity = 0.0
	wp_i = 1
	wp_time = 0.0
	progress_ref = player.position
	progress_time = 0.0


func _face(target: Vector3) -> void:
	var d := target - player.position
	var yaw := atan2(-d.x, -d.z)
	player.rotation.y = yaw
	player.rotation_target.y = yaw


func _physics_process(delta: float) -> bool:
	frame += 1
	if frame == 3:
		map = arena.map
		player = arena.player
		for e in arena.enemies.get_children():
			e.queue_free()
		print("hulls: ", map.get_node("Collision").get_child_count(), "  routes: ", map.nav_paths.size(), "  spawns: ", map.spawns.size())
		phase = "spawn"
		return false
	if frame < 4:
		return false

	if jump_release:
		Input.action_release("jump")
		jump_release = false

	if phase == "spawn":
		return _spawn_step()
	if phase == "route":
		return _route_step(delta)
	return _fuzz_step(delta)


func _spawn_step() -> bool:
	# every spawn must settle on solid floor, not inside geometry or in the air
	if spawn_t == 0:
		var sp: Dictionary = map.spawns[spawn_i]
		player.position = sp.pos
		player.velocity = Vector3.ZERO
		player.gravity = 0.0
	spawn_t += 1
	if spawn_t > 40:
		var ok: bool = player.is_on_floor() and player.position.y > -0.5 and player.position.y < 12.0
		if not ok:
			failures += 1
			print("FAIL spawn %d at %s settled at %s floor=%s" % [spawn_i, map.spawns[spawn_i].pos, player.position, player.is_on_floor()])
		spawn_t = 0
		spawn_i += 1
		if spawn_i >= map.spawns.size():
			if map.nav_paths.is_empty():
				phase = "fuzz"
				_fuzz_begin()
			else:
				phase = "route"
				_start_route()
	return false


func _route_step(delta: float) -> bool:
	var path: PackedVector3Array = map.nav_paths[route_i]
	var target := path[wp_i]
	_face(target)
	Input.action_press("move_forward")
	wp_time += delta
	progress_time += delta
	var flat := Vector2(target.x - player.position.x, target.z - player.position.z)
	if flat.length() < 1.0 and abs(target.y - player.position.y) < 2.2:
		wp_i += 1
		wp_time = 0.0
		progress_ref = player.position
		progress_time = 0.0
		if wp_i >= path.size():
			print("route %d OK" % route_i)
			route_i += 1
			if route_i >= map.nav_paths.size():
				Input.action_release("move_forward")
				phase = "fuzz"
				_fuzz_begin()
				return false
			_start_route()
		return false
	if progress_time > 1.0:
		if player.position.distance_to(progress_ref) < 0.5:
			Input.action_press("jump")
			jump_release = true
		progress_ref = player.position
		progress_time = 0.0
	if wp_time > 12.0:
		failures += 1
		print("FAIL route %d waypoint %d %s  stuck at %s" % [route_i, wp_i, target, player.position])
		wp_i += 1
		wp_time = 0.0
		if wp_i >= path.size():
			route_i += 1
			if route_i >= map.nav_paths.size():
				Input.action_release("move_forward")
				phase = "fuzz"
				_fuzz_begin()
				return false
			_start_route()
	return false


func _fuzz_begin() -> void:
	player.respawn()
	fuzz_time = 0.0
	fuzz_anchor = player.position
	fuzz_anchor_t = 0.0
	fuzz_probe = player.position
	fuzz_prev = player.position
	fuzz_path = 0.0
	fuzz_probe_t = 0.0
	Input.action_press("move_forward")


func _fuzz_step(delta: float) -> bool:
	fuzz_time += delta
	fuzz_anchor_t += delta
	if fmod(fuzz_time, 1.0) < delta:
		fuzz_heading = rng.randf() * TAU
	# a real player who is blocked turns away: re-roll the heading when barely moving
	fuzz_probe_t += delta
	if fuzz_probe_t >= 0.5:
		if player.position.distance_to(fuzz_probe) < 0.6:
			fuzz_heading = rng.randf() * TAU
			Input.action_press("jump")
			jump_release = true
		fuzz_probe = player.position
		fuzz_probe_t = 0.0
	player.rotation.y = fuzz_heading
	player.rotation_target.y = fuzz_heading
	if rng.randf() < 0.02:
		Input.action_press("jump")
		jump_release = true
	var p := player.position
	fuzz_path += p.distance_to(fuzz_prev)
	fuzz_prev = p
	var b := map.bounds
	if p.y < -1.0 or p.x < b.position.x - 0.5 or p.x > b.end.x + 0.5 or p.z < b.position.z - 0.5 or p.z > b.end.z + 0.5 or p.y > 30.0:
		failures += 1
		print("FAIL fuzz %d left map at %s (t=%.1f)" % [fuzz_run, p, fuzz_time])
		player.respawn()
	if fuzz_anchor_t > 5.0:
		if fuzz_path < 6.0:   # holding forward for 5s should cover ~25m; <6m of path means blocked
			failures += 1
			print("FAIL fuzz %d pinned near %s (path %.1fm)" % [fuzz_run, p, fuzz_path])
		fuzz_path = 0.0
		fuzz_anchor = p
		fuzz_anchor_t = 0.0
	if fuzz_time > FUZZ_SECONDS:
		fuzz_run += 1
		if fuzz_run >= FUZZ_RUNS:
			Input.action_release("move_forward")
			print("== DONE failures=%d" % failures)
			quit(1 if failures > 0 else 0)
			return true
		_fuzz_begin()
	return false
