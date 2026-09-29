# 🐆 Veloce — Video Downloader

Download clips from Kick, X/Twitter, Pinterest — and 1000+ other sites.
Powered by yt-dlp. No Cloudflare issues. No API keys. No setup.

## Requirements

- Python 3.8+
- yt-dlp  (`pip install yt-dlp`)
- ffmpeg (optional, for merging HLS streams)

## Start

**Mac / Linux:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```
Double-click start.bat
```

Then open **http://localhost:8899** in your browser.

## How it works

The frontend (index.html) talks to a tiny local Python server (server.py)
which calls yt-dlp under the hood. yt-dlp handles:
- Cloudflare bypass for Kick
- HLS stream extraction
- Multiple quality options
- 1000+ supported sites

## Update yt-dlp

```bash
pip install -U yt-dlp
```

Sites change their APIs often — keeping yt-dlp updated fixes most issues.
