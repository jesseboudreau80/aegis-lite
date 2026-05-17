#!/bin/bash
# Aegis Lite — Start (delegates to systemd)
set -euo pipefail

echo ""
echo "Starting Aegis Lite..."
sudo systemctl start aegis-lite-api.service
sudo systemctl start aegis-lite-web.service

echo ""
echo "Waiting for services to become healthy..."
for i in {1..20}; do
  if curl -sf http://127.0.0.1:8107/health -o /dev/null 2>/dev/null && \
     curl -sf http://127.0.0.1:3007/ -o /dev/null 2>/dev/null; then
    echo ""
    echo "Aegis Lite is running."
    echo "  Backend  → http://127.0.0.1:8107  (PID=$(systemctl show -p MainPID --value aegis-lite-api.service))"
    echo "  Frontend → http://127.0.0.1:3007  (PID=$(systemctl show -p MainPID --value aegis-lite-web.service))"
    echo ""
    exit 0
  fi
  sleep 1
done

echo ""
echo "WARNING: Services started but health check timed out. Check: ./logs.sh"
echo ""
