#!/bin/bash
# Install Aegis Lite systemd services.
# Run once after cloning onto a new production host.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/../.." && pwd)"

echo ""
echo "Installing Aegis Lite systemd services..."

# Create log directory
mkdir -p "$ROOT_DIR/.logs"

# Copy unit files
sudo cp "$DEPLOY_DIR/aegis-lite-api.service" /etc/systemd/system/
sudo cp "$DEPLOY_DIR/aegis-lite-web.service" /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable aegis-lite-api.service aegis-lite-web.service

echo ""
echo "Services installed and enabled."
echo "Start with: sudo systemctl start aegis-lite-api aegis-lite-web"
echo "       or:  $ROOT_DIR/start.sh"
echo ""
