extends Node
## Players-online client. Heartbeats to a presence server and reports the live count.
## Server URL: env PRESENCE_URL, else project setting game/presence_url. Empty = offline state (no fake numbers).

signal changed(count: int, connected: bool)

const INTERVAL := 20.0

var count := -1
var connected := false
var url := ""
var attempted := false

var _id := ""
var _http: HTTPRequest


func _ready() -> void:
	url = OS.get_environment("PRESENCE_URL")
	if url.is_empty():
		url = str(ProjectSettings.get_setting("game/presence_url", ""))
	url = url.rstrip("/")
	_id = "%08x%08x" % [randi(), randi()]
	_http = HTTPRequest.new()
	_http.timeout = 8.0
	_http.request_completed.connect(_on_done)
	add_child(_http)
	var t := Timer.new()
	t.wait_time = INTERVAL
	t.autostart = true
	t.timeout.connect(_beat)
	add_child(t)
	_beat()


func _beat() -> void:
	if url.is_empty():
		attempted = true
		changed.emit(-1, false)
		return
	if _http.get_http_client_status() != HTTPClient.STATUS_DISCONNECTED:
		return
	_http.request("%s/heartbeat?id=%s" % [url, _id])


func _on_done(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	attempted = true
	connected = false
	count = -1
	if result == HTTPRequest.RESULT_SUCCESS and code == 200:
		var j: Variant = JSON.parse_string(body.get_string_from_utf8())
		if j is Dictionary and j.has("online"):
			count = int(j.online)
			connected = true
	changed.emit(count, connected)
