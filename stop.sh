#!/bin/bash
# Aegis Lite — Graceful Stop
set -uo pipefail

RUNTIME_DIR="/tmp/aegis-lite"
BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"
BACKEND_PORT="8107"
FRONTEND_PORT="3007"

echo ""
echo "Stopping Aegis Lite..."

_stop_pid() {
  local name="$1" pid_file="$2" port="$3"
  if [ -f "$pid_file" ]; then
    local pid; pid=$(cat "$pid_file" 2>/dev/null || echo "")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "  Stopping $name (PID=$pid)..."
      kill -TERM "$pid" 2>/dev/null || true
      for i in {1..10}; do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
      kill -0 "$pid" 2>/dev/null && kill -KILL "$pid" 2>/dev/null || true
      echo "  $name stopped."
    else
      echo "  $name: PID $pid not running (stale PID file)"
    fi
    rm -f "$pid_file"
  else
    echo "  $name: no PID file — releasing port $port"
    fuser -k "${port}/tcp" 2>/dev/null || true
  fi
}

_stop_pid "Frontend" "$FRONTEND_PID_FILE" "$FRONTEND_PORT"
_stop_pid "Backend"  "$BACKEND_PID_FILE"  "$BACKEND_PORT"

echo "Aegis Lite stopped."
echo ""
