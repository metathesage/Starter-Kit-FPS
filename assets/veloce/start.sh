#!/bin/bash
# Veloce — one-click start script

echo ""
echo "  🐆 Veloce — Video Downloader"
echo ""

# Check dependencies
if ! command -v python3 &>/dev/null; then
  echo "  ✗ Python 3 not found. Install from python.org"
  exit 1
fi

if ! command -v yt-dlp &>/dev/null; then
  echo "  Installing yt-dlp..."
  pip3 install yt-dlp --quiet --break-system-packages 2>/dev/null || pip install yt-dlp --quiet
fi

if ! command -v yt-dlp &>/dev/null; then
  echo "  ✗ yt-dlp install failed. Try: pip3 install yt-dlp"
  exit 1
fi

echo "  ✓ yt-dlp ready"
echo "  ✓ Starting server at http://localhost:8899"
echo ""
echo "  Opening browser..."
sleep 0.5

# Open browser
if command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:8899
elif command -v open &>/dev/null; then
  open http://localhost:8899
elif command -v start &>/dev/null; then
  start http://localhost:8899
fi

# Run server
python3 server.py
