extends Node
## Session state: which map, which class. Class data lives here so the loadout screen,
## the player and the HUD all read the same numbers.

var map_scene := "res://scenes/lockout.tscn"
var hero_id := "spartan"

const HEROES := {
	"spartan": {
		"name": "SPARTAN", "role": "MOBILITY", "accent": Color("39e3ff"),
		"health": 100, "speed": 5.5, "sprint": 8.5, "jump": 8.0, "slide_time": 0.9, "slide_boost": 1.3,
		"passive": "Sprint. Long, fast slides.",
		"a1": {"id": "thruster", "name": "THRUSTER", "cd": 3.5, "desc": "Burst dash in any direction. Works in the air."},
		"a2": {"id": "camo", "name": "ACTIVE CAMO", "cd": 18.0, "desc": "Drones lose you for 7 seconds."},
	},
	"guardian": {
		"name": "GUARDIAN", "role": "HEAVY", "accent": Color("ffa02b"),
		"health": 150, "speed": 4.4, "sprint": 5.8, "jump": 7.0, "slide_time": 0.7, "slide_boost": 1.15,
		"passive": "Regenerates health after 4 seconds unhit.",
		"a1": {"id": "aegis", "name": "AEGIS", "cd": 15.0, "desc": "6 second shield that soaks 120 damage."},
		"a2": {"id": "slam", "name": "SEISMIC SLAM", "cd": 10.0, "desc": "Leap, press again to dive. Shockwave hits 9 m."},
	},
}


func hero() -> Dictionary:
	return HEROES[hero_id]
