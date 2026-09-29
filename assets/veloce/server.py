#!/usr/bin/env python3
"""
Veloce Server — yt-dlp powered backend.
Supports 1000+ sites: YouTube, TikTok (no watermark), Kick, X/Twitter,
Pinterest, Instagram, Reddit, Facebook, Twitch, SoundCloud, Vimeo + more.
"""
import json, subprocess, sys, os, re, shutil
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = 8899

# ── Find yt-dlp ───────────────────────────────────────────────────────────────
def find_ytdlp():
    found = shutil.which("yt-dlp") or shutil.which("yt-dlp.exe")
    if found:
        return found
    home = os.path.expanduser("~")
    for pyver in ["312","311","310","39","38"]:
        for base in [
            os.path.join(home,"AppData","Local","Programs","Python",f"Python{pyver}","Scripts"),
            os.path.join(home,"AppData","Roaming","Python",f"Python{pyver}","Scripts"),
        ]:
            p = os.path.join(base,"yt-dlp.exe")
            if os.path.isfile(p): return p
    for p in [
        os.path.join(home,".local","bin","yt-dlp"),
        "/usr/local/bin/yt-dlp","/usr/bin/yt-dlp","/opt/homebrew/bin/yt-dlp",
        os.path.join(home,"yt-dlp.exe"), r"C:\yt-dlp\yt-dlp.exe",
    ]:
        if os.path.isfile(p): return p
    return None

YTDLP = find_ytdlp()

def ytdlp_cmd():
    return [YTDLP] if YTDLP else [sys.executable, "-m", "yt_dlp"]

NO_WIN = dict(creationflags=subprocess.CREATE_NO_WINDOW) if sys.platform=="win32" else {}

def run(args, timeout=45):
    result = subprocess.run(
        ytdlp_cmd() + args,
        capture_output=True, text=True, timeout=timeout, **NO_WIN
    )
    return result

def ytdlp_info(url, extra=None):
    """Fetch metadata JSON for a URL."""
    args = ["--dump-json","--no-playlist","--no-warnings","--quiet"]
    if extra: args += extra
    args.append(url)
    r = run(args)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or "yt-dlp returned no output")
    return json.loads(r.stdout.strip().split("\n")[0])

def ytdlp_playlist(url, limit=6):
    r = run(["--flat-playlist","--dump-json","--playlist-end",str(limit),
             "--quiet","--no-warnings", url], timeout=20)
    items = []
    for line in r.stdout.strip().split("\n"):
        if not line: continue
        try: items.append(json.loads(line))
        except: pass
    return items

# ── Platform helpers ──────────────────────────────────────────────────────────
def is_tiktok(url):
    return "tiktok.com" in url or "vm.tiktok.com" in url

def tiktok_nowatermark_args():
    """yt-dlp args to get TikTok without watermark."""
    # TikTok serves a watermark-free version at format id "download_addr"
    # We select it specifically, falling back to best available
    return ["-f", "download_addr/best[ext=mp4]/best"]

def build_qualities(info, nowatermark=False):
    formats = info.get("formats") or []
    seen, qualities = set(), []

    if nowatermark and is_tiktok(info.get("webpage_url","")):
        # TikTok: prioritise the watermark-free download_addr format
        wm_free = [f for f in formats if f.get("format_id") in ("download_addr","play_addr_h264") and f.get("url")]
        if wm_free:
            f = wm_free[0]
            qualities.append({
                "label":"No Watermark","sub":"MP4","url":f["url"],"hd":True,"nowatermark":True
            })
        # Also add normal formats below
        formats_to_scan = [f for f in formats if f.get("format_id") not in ("download_addr","play_addr_h264")]
    else:
        formats_to_scan = formats

    video_fmts = [f for f in formats_to_scan
                  if f.get("vcodec","none")!="none" and f.get("url") and not f.get("manifest_url")]
    video_fmts.sort(key=lambda f:(f.get("height") or 0, f.get("tbr") or 0), reverse=True)

    for f in video_fmts:
        h = f.get("height") or 0
        label = f"{h}p" if h else (f.get("format_note") or f.get("format_id",""))
        if not label or label in seen: continue
        seen.add(label)
        qualities.append({
            "label": label + (" — HD" if h>=720 else ""),
            "sub": (f.get("ext","mp4")).upper(),
            "url": f["url"],
            "hd": h>=720,
        })
        if len(qualities) >= 5: break

    # Audio-only option
    audio_fmts = [f for f in formats if f.get("acodec","none")!="none"
                  and f.get("vcodec","none")=="none" and f.get("url")]
    audio_fmts.sort(key=lambda f: f.get("abr") or 0, reverse=True)
    if audio_fmts:
        af = audio_fmts[0]
        qualities.append({
            "label":"Audio Only","sub":(af.get("ext","mp3")).upper(),
            "url": af["url"],"hd":False,"audio":True
        })

    # Final fallback
    if not qualities and info.get("url"):
        qualities.append({"label":"Best Quality","sub":(info.get("ext","mp4")).upper(),
                          "url":info["url"],"hd":True})
    return qualities

def get_similar(url):
    try:
        parsed = urlparse(url)
        netloc = parsed.netloc

        if "kick.com" in netloc:
            m = re.match(r'/([^/]+)/clips/', parsed.path)
            if m:
                items = ytdlp_playlist(f"https://kick.com/{m.group(1)}/clips")
                return [{"title":d.get("title","Clip"),"thumbnail":d.get("thumbnail",""),
                         "duration":d.get("duration"),"views":d.get("view_count",0),
                         "url":d.get("url") or d.get("webpage_url","")} for d in items]

        if "x.com" in netloc or "twitter.com" in netloc:
            m = re.match(r'/([^/]+)/status/', parsed.path)
            if m:
                items = ytdlp_playlist(f"https://x.com/{m.group(1)}/media")
                return [{"title":(d.get("title") or d.get("description","Tweet"))[:80],
                         "thumbnail":d.get("thumbnail",""),"duration":d.get("duration"),
                         "views":d.get("view_count",0),
                         "url":d.get("url") or d.get("webpage_url","")} for d in items]

        if "tiktok.com" in netloc:
            # Get more from same user
            m = re.match(r'/@([^/]+)/', parsed.path)
            if m:
                items = ytdlp_playlist(f"https://www.tiktok.com/@{m.group(1)}")
                return [{"title":(d.get("title") or d.get("description",""))[:80],
                         "thumbnail":d.get("thumbnail",""),"duration":d.get("duration"),
                         "views":d.get("view_count",0),
                         "url":d.get("url") or d.get("webpage_url","")} for d in items]

        if "youtube.com" in netloc or "youtu.be" in netloc:
            # Get channel's recent uploads
            channel = info_cache.get(url,{}).get("channel_url","")
            if channel:
                items = ytdlp_playlist(channel, limit=6)
                return [{"title":d.get("title",""),"thumbnail":d.get("thumbnail",""),
                         "duration":d.get("duration"),"views":d.get("view_count",0),
                         "url":d.get("url") or d.get("webpage_url","")} for d in items]

    except Exception as e:
        print(f"  Similar error: {e}")
    return []

info_cache = {}

# ── HTTP Handler ──────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"  {self.command} {self.path.split('?')[0]}")

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type","application/json")
        self.send_header("Access-Control-Allow-Origin","*")
        self.send_header("Content-Length",len(body))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin","*")
        self.send_header("Access-Control-Allow-Methods","GET,OPTIONS")
        self.send_header("Access-Control-Allow-Headers","*")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        if parsed.path == "/info":
            url = qs.get("url",[""])[0]
            nowatermark = qs.get("nowatermark",[""])[0] == "1"
            if not url: return self.send_json({"error":"No URL"},400)
            try:
                print(f"  Fetching: {url[:90]}")
                extra = tiktok_nowatermark_args() if (nowatermark and is_tiktok(url)) else None
                info = ytdlp_info(url, extra)
                info_cache[url] = info
                return self.send_json({
                    "title":     info.get("title") or info.get("description","")[:80] or "Video",
                    "author":    info.get("uploader") or info.get("channel") or info.get("uploader_id",""),
                    "thumbnail": info.get("thumbnail",""),
                    "duration":  info.get("duration"),
                    "qualities": build_qualities(info, nowatermark),
                    "views":     info.get("view_count"),
                    "likes":     info.get("like_count"),
                    "platform":  info.get("extractor","").lower(),
                })
            except Exception as e:
                print(f"  Error: {e}")
                return self.send_json({"error":str(e)},500)

        elif parsed.path == "/similar":
            url = qs.get("url",[""])[0]
            return self.send_json(get_similar(url) if url else [])

        elif parsed.path == "/":
            html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),"index.html")
            if os.path.exists(html_path):
                with open(html_path,"rb") as f: body=f.read()
                self.send_response(200)
                self.send_header("Content-Type","text/html; charset=utf-8")
                self.send_header("Content-Length",len(body))
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_json({"error":"index.html not found"},404)
        else:
            self.send_json({"error":"Not found"},404)

if __name__ == "__main__":
    print(f"\n  🐆 Veloce Server")
    print(f"  Python: {sys.version.split()[0]}")
    if YTDLP:
        print(f"  yt-dlp: {YTDLP}")
    else:
        print("  yt-dlp not in PATH — trying pip install...")
        for pip_args in [
            [sys.executable,"-m","pip","install","yt-dlp","--quiet"],
            [sys.executable,"-m","pip","install","yt-dlp","--quiet","--break-system-packages"],
        ]:
            if subprocess.run(pip_args, capture_output=True, **NO_WIN).returncode == 0:
                YTDLP = find_ytdlp()
                print(f"  yt-dlp installed: {YTDLP or 'module mode'}")
                break
        else:
            print("  WARNING: yt-dlp not found. Run:  pip install yt-dlp")

    print(f"\n  Ready at http://localhost:{PORT}")
    print(f"  Ctrl+C to stop\n")
    try:
        HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")
