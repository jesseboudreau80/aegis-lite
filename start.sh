#!/bin/bash
# Aegis Lite — Production Launcher
set -uo pipefail

export PATH="/home/jesse/.nvm/versions/node/v22.22.1/bin:/home/jesse/.local/bin:/home/jesse/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

ROOT_DIR="/home/jesse/infra/apps/aegis-lite"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_PORT="8107"
FRONTEND_PORT="3007"

RUNTIME_DIR="/tmp/aegis-lite"
BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"

LOG_DIR="$ROOT_DIR/.logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

_LAUNCH_BACKEND_PID=""
_LAUNCH_FRONTEND_PID=""

startup_cleanup() {
  echo ""
  echo "Startup interrupted — stopping partially launched processes..."
  [[ -n "${_LAUNCH_BACKEND_PID:-}" ]]  && kill "$_LAUNCH_BACKEND_PID"  2>/dev/null || true
  [[ -n "${_LAUNCH_FRONTEND_PID:-}" ]] && kill "$_LAUNCH_FRONTEND_PID" 2>/dev/null || true
  rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE" 2>/dev/null || true
  echo "Startup aborted."
  exit 1
}
trap startup_cleanup INT TERM

mkdir -p "$RUNTIME_DIR" "$LOG_DIR"

for _log in "$BACKEND_LOG" "$FRONTEND_LOG"; do
  if [ -f "$_log" ] && [ "$(du -m "$_log" 2>/dev/null | cut -f1)" -gt 50 ]; then
    mv "$_log" "${_log}.$(date +%Y%m%d%H%M%S).old" 2>/dev/null || true
  fi
done

echo ""
echo "Starting Aegis Lite..."
echo "  Backend  → http://127.0.0.1:$BACKEND_PORT"
echo "  Frontend → http://127.0.0.1:$FRONTEND_PORT"
echo ""

# ── Backend ───────────────────────────────────────────────────────────────────
echo "  [1/2] Starting backend..."
(
  cd "$BACKEND_DIR"
  exec .venv/bin/uvicorn main:app \
    --host 0.0.0.0 \
    --port "$BACKEND_PORT" \
    --log-level info
) >> "$BACKEND_LOG" 2>&1 &
_LAUNCH_BACKEND_PID=$!
echo "$_LAUNCH_BACKEND_PID" > "$BACKEND_PID_FILE"

# Wait for backend health
echo "  Waiting for backend..."
for i in {1..30}; do
  if curl -sf "http://127.0.0.1:$BACKEND_PORT/health" > /dev/null 2>&1; then
    echo "  Backend healthy (PID=$_LAUNCH_BACKEND_PID)"
    break
  fi
  if ! kill -0 "$_LAUNCH_BACKEND_PID" 2>/dev/null; then
    echo "  ERROR: Backend process died. Check $BACKEND_LOG"
    exit 1
  fi
  sleep 1
done

# ── Frontend ──────────────────────────────────────────────────────────────────
echo "  [2/2] Starting frontend..."
(
  cd "$FRONTEND_DIR"
  exec npx next start --port "$FRONTEND_PORT"
) >> "$FRONTEND_LOG" 2>&1 &
_LAUNCH_FRONTEND_PID=$!
echo "$_LAUNCH_FRONTEND_PID" > "$FRONTEND_PID_FILE"

# Wait for frontend
echo "  Waiting for frontend..."
for i in {1..30}; do
  if curl -sf "http://127.0.0.1:$FRONTEND_PORT" > /dev/null 2>&1; then
    echo "  Frontend healthy (PID=$_LAUNCH_FRONTEND_PID)"
    break
  fi
  if ! kill -0 "$_LAUNCH_FRONTEND_PID" 2>/dev/null; then
    echo "  ERROR: Frontend process died. Check $FRONTEND_LOG"
    exit 1
  fi
  sleep 1
done

echo ""
echo "Aegis Lite is running."
echo "  Backend  → http://127.0.0.1:$BACKEND_PORT  (log: $BACKEND_LOG)"
echo "  Frontend → http://127.0.0.1:$FRONTEND_PORT  (log: $FRONTEND_LOG)"
echo ""
