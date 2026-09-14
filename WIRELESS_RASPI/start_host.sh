#!/bin/bash
# ============================================================
# Starts the Merit List Control Station on Linux/macOS.
# Also advertises this machine as acap-host.local via mDNS
# (see main.py) so displays never need a manually typed IP.
# ============================================================

cd "$(dirname "$0")"

echo "==================================================="
echo "Starting the Merit List Control Station..."
echo "==================================================="

# Create the virtual environment on first run, and install deps into it
if [ ! -f ".venv/bin/python3" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
    .venv/bin/pip install --upgrade pip
    .venv/bin/pip install -r requirements.txt
fi

(sleep 1 && xdg-open http://127.0.0.1:8000 > /dev/null 2>&1 &)

.venv/bin/python3 main.py
