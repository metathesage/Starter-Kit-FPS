extends SceneTree
## Headless movement/ability test: crouch, slide, uncrouch under a ceiling, dash, camo, slam.
##   godot --headless --fixed-fps 60 -s tools/ability_test.gd
var a: Node3D
var p: CharacterBody3D
var f := 0
var fails := 0
var step := 0
var t0 := 0
var pos0 := Vector3.ZERO
var hero := "spartan"

func _initialize() -> void:
	_boot("spartan")

func _boot(h: String) -> void:
	if a: a.queue_free()
	root.get_node("Game").hero_id = h
	hero = h
	a = load("res://scenes/arena.tscn").instantiate()
	a.map_id = "the_pit"
	root.add_child(a)
	step = 0
	f = 0

func _ok(name: String, cond: bool, info := "") -> void:
	print(("PASS " if cond else "FAIL ") + name + " " + info)
	if not cond: fails += 1

func _phys(name: String) -> void: pass

func _physics_process(_d: float) -> bool:
	f += 1
	p = a.player
	for e in a.enemies.get_children(): e.get_node("Timer").stop()  # (enemy timer is already stopped; drones only fire via wind-up)
	if f == 3:
		p.position = Vector3(-9, 3.0, -3)   # plateau top is y 2.5 in the_pit; drop onto it
		p.velocity = Vector3.ZERO
	if hero == "spartan":
		match f:
			90:
				pos0 = p.position
				p.rotation.y = -PI / 2; p.rotation_target.y = -PI / 2
				Input.action_press("move_forward"); Input.action_press("sprint")
			120:
				_ok("sprint speed", Vector2(p.velocity.x, p.velocity.z).length() > 7.5, "v=%.1f" % Vector2(p.velocity.x, p.velocity.z).length())
				Input.action_press("crouch")
			124:
				_ok("slide started", p.sliding and p.crouching)
				_ok("capsule shrank", (p.collider.shape as CapsuleShape3D).height < 1.2)
				pos0 = p.position
			150:
				_ok("slide moves fast", Vector2(p.velocity.x, p.velocity.z).length() > 6.0, "v=%.1f" % Vector2(p.velocity.x, p.velocity.z).length())
				Input.action_release("crouch"); Input.action_release("sprint"); Input.action_release("move_forward")
			175:
				_ok("stood back up", not p.crouching and (p.collider.shape as CapsuleShape3D).height > 1.7)
				pos0 = p.position
				p.use_ability(1)
			190:
				_ok("dash travelled", p.position.distance_to(pos0) > 2.5, "d=%.1f" % p.position.distance_to(pos0))
				_ok("dash cooldown", p.cd["a1"] > 2.0)
				p.use_ability(2)
			192:
				_ok("camo on", p.cloaked)
			200:
				_boot("guardian")
	else:
		match f:
			90:
				var e = a.enemies.get_child(0)
				e.global_position = p.global_position + Vector3(4, 1.0, 0)
				e.target_position = e.position
				p.use_ability(1)
				p.damage(60)
			100:
				_ok("aegis absorbed", p.health == 150, "hp=%d aegis=%.0f" % [p.health, p.aegis_hp])
				p.use_ability(2)
			101:
				_ok("slam leaping", p.slamming)
			160:
				p.use_ability(2)
			260:
				_ok("slam landed", not p.slamming)
				_ok("slam killed drone", a.kills >= 1, "kills=%d" % a.kills)
				print("== DONE fails=%d" % fails)
				quit(1 if fails > 0 else 0)
	return false
