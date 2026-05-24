#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$SCRIPT_DIR/frontend"

if [ ! -d "$FRONTEND/node_modules" ]; then
    echo "Installing Node dependencies..."
    npm install --prefix "$FRONTEND" --silent
fi

echo "Starting frontend..."
echo "  Vue → http://localhost:5173"
echo ""

npm run dev --prefix "$FRONTEND"
