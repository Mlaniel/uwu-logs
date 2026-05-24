#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/.venv"
PYTHON="$VENV/bin/python"
PIP="$VENV/bin/pip"

# Setup venv and install requirements if needed
if [ ! -f "$PYTHON" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV"
fi

if [ ! -f "$VENV/.installed" ] || [ "$SCRIPT_DIR/requirements.txt" -nt "$VENV/.installed" ]; then
    echo "Installing requirements..."
    "$PIP" install -r "$SCRIPT_DIR/requirements.txt" --quiet
    touch "$VENV/.installed"
fi

cd "$SCRIPT_DIR"

cleanup() {
    echo ""
    echo "Shutting down..."
    kill 0
}
trap cleanup EXIT INT TERM

echo "Starting uwu-logs dev stack..."
echo "  Flask  → http://localhost:5000"
echo "  Upload → http://localhost:5010"
echo "  Top    → http://localhost:5020"
echo ""

"$PYTHON" Z_SERVER.py &
"$PYTHON" -m uvicorn server_upload:app --port 5010 --proxy-headers &
"$PYTHON" -m uvicorn server_top:app --port 5020 --proxy-headers &

wait
