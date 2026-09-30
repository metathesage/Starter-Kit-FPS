class_name Icons
extends RefCounted
## One icon language: 24px grid, square caps, mitred joins, fat outer stroke + hairline inner detail.
## Paths come from the project's own icon set (Drive: ui-*.svg / wp-*.svg), rasterised at any size.

const _HEAD := '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d"><g fill="none" stroke="white" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" stroke-miterlimit="6">'
const _TAIL := "</g></svg>"

const BODY := {
	"bolt": ['<path d="M14 1 3 14h8l-2 9 12-14h-8z" fill="white" stroke="none"/>', 24],
	"eye": ['<path stroke-width="2.6" d="M1 12 6 5h12l5 7-5 7H6z"/><path fill="white" stroke="none" d="M9 8h6l3 4-3 4H9l-3-4z"/>', 24],
	"shield": ['<path stroke-width="2.6" d="M12 1 22 5v9l-10 9L2 14V5z"/><path opacity=".55" d="M12 5 18 8v6l-6 5-6-5V8z"/>', 24],
	"down": ['<path d="M12 3v18M5 14l7 7 7-7"/>', 24],
	"chevrons": ['<path stroke-width="2.6" d="M4 6 12 12 20 6M4 12l8 6 8-6M4 18l8 5 8-5"/>', 24],
	"target": ['<path stroke-width="2.6" d="M12 2 22 12l-10 10L2 12z"/><path opacity=".6" d="M12 6l6 6-6 6-6-6z"/><path fill="white" stroke="none" d="M12 9.5 14.5 12 12 14.5 9.5 12z"/>', 24],
	"rifle": ['<path stroke-width="2.6" d="M2 15h6l2-3h11l1 2h8v4h-8l-1 2h-3l-1 6H8l1-6H2z"/><path d="M11 12V9h7v3M5 19h3"/>', 32],
	"pistol": ['<path stroke-width="2.6" d="M3 13h15l3 2v3h-6l-1 10H9l1-10H3z"/><path d="M9 16h3"/>', 32],
}

static var _cache := {}


static func tex(name: String, px := 96) -> Texture2D:
	var key := "%s@%d" % [name, px]
	if _cache.has(key):
		return _cache[key]
	var def: Array = BODY[name]
	var n: int = def[1]
	var svg: String = (_HEAD % [n, n, n, n]) + def[0] + _TAIL
	var img := Image.new()
	var err := img.load_svg_from_string(svg, float(px) / n)
	if err != OK:
		push_warning("icon %s failed to rasterise" % name)
		return null
	var t := ImageTexture.create_from_image(img)
	_cache[key] = t
	return t
