#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

echo "Starting Aegis Lite..."

# Backend
cd "$ROOT/backend"
if [ ! -f ".env" ]; then
  echo "ERROR: backend/.env not found. Copy .env.example and fill in values."
  exit 1
fi

if [ ! -d ".venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi

echo "Starting backend (port 8100)..."
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8100 --reload &
BACKEND_PID=$!

# Frontend
cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install -q
fi

echo "Starting frontend (port 3000)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Aegis Lite running:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8100"
echo ""
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
