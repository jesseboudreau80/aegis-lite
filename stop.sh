#!/bin/bash
# Aegis Lite — Stop (delegates to systemd)
set -euo pipefail

echo ""
echo "Stopping Aegis Lite..."
sudo systemctl stop aegis-lite-web.service 2>/dev/null && echo "  Frontend stopped." || echo "  Frontend was not running."
sudo systemctl stop aegis-lite-api.service 2>/dev/null && echo "  Backend stopped."  || echo "  Backend was not running."
echo ""
