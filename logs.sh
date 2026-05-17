#!/bin/bash
# Aegis Lite — Tail logs
# Usage: ./logs.sh [backend|frontend|all]

WHAT="${1:-all}"

case "$WHAT" in
  backend|api)
    echo "── Backend logs (journalctl) ──────────────────────────────────────────"
    sudo journalctl -u aegis-lite-api.service -f --no-pager -n 50
    ;;
  frontend|web)
    echo "── Frontend logs (journalctl) ─────────────────────────────────────────"
    sudo journalctl -u aegis-lite-web.service -f --no-pager -n 50
    ;;
  all|*)
    echo "── Aegis Lite logs (Ctrl-C to exit) ───────────────────────────────────"
    sudo journalctl -u aegis-lite-api.service -u aegis-lite-web.service -f --no-pager -n 50
    ;;
esac
