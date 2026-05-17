#!/bin/bash
# Aegis Lite — Restart
set -euo pipefail

WHAT="${1:-all}"

echo ""
case "$WHAT" in
  backend|api)
    echo "Restarting backend..."
    sudo systemctl restart aegis-lite-api.service
    echo "  Backend restarted."
    ;;
  frontend|web)
    echo "Restarting frontend..."
    sudo systemctl restart aegis-lite-web.service
    echo "  Frontend restarted."
    ;;
  all|*)
    echo "Restarting Aegis Lite..."
    sudo systemctl restart aegis-lite-api.service
    sudo systemctl restart aegis-lite-web.service
    echo "  Both services restarted."
    ;;
esac
echo ""
echo "Use ./status.sh to verify."
echo ""
