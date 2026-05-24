#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/.venv"
PYTHON="$VENV/bin/python"
PIP="$VENV/bin/pip"
FRONTEND="$SCRIPT_DIR/frontend"

# Setup Python venv and install requirements if needed
if [ ! -f "$PYTHON" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV"
fi

if [ ! -f "$VENV/.installed" ] || [ "$SCRIPT_DIR/requirements.txt" -nt "$VENV/.installed" ]; then
    echo "Installing Python requirements..."
    "$PIP" install -r "$SCRIPT_DIR/requirements.txt" --quiet
    touch "$VENV/.installed"
fi

# Setup Node dependencies if needed
if [ ! -d "$FRONTEND/node_modules" ]; then
    echo "Installing Node dependencies..."
    npm install --prefix "$FRONTEND" --silent
fi

cleanup() {
    echo ""
    echo "Shutting down..."
    kill 0
}
trap cleanup EXIT INT TERM

echo "Starting uwu-logs dev stack..."
echo "  Vue    → http://localhost:5173"
echo "  Flask  → http://localhost:5000"
echo "  Upload → http://localhost:5010"
echo "  Top    → http://localhost:5020"
echo ""

"$PYTHON" Z_SERVER.py &
"$PYTHON" -m uvicorn server_upload:app --port 5010 --proxy-headers &
"$PYTHON" -m uvicorn server_top:app --port 5020 --proxy-headers &
npm run dev --prefix "$FRONTEND" &

wait
