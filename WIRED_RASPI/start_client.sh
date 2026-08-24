#!/bin/bash
# ============================================================
# Starts the ACAP display client:
#   1. Serves this folder over local HTTP (avoids the file://
#      origin restrictions Chromium applies to local files).
#   2. Opens Chromium in kiosk mode pointed at it.
#
# The client auto-connects over WiFi to the host's WebSocket
# (see WS_HOST in backend.js) — no IP entry needed here.
# ============================================================

cd "$(dirname "$0")"

PORT=8080

# Free the port if a previous run left the server up
fuser -k ${PORT}/tcp 2>/dev/null

python3 -m http.server $PORT &
SERVER_PID=$!

sleep 1

chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    "http://localhost:${PORT}/index.html"

# Browser closed (kiosk exited) — stop the local server too.
kill $SERVER_PID
