#!/bin/bash
# Aegis Lite — Runtime Status

echo ""
echo "── Aegis Lite Runtime Status ─────────────────────────────────────────"
echo ""

# systemd service states
for svc in aegis-lite-api aegis-lite-web; do
  state=$(systemctl is-active "${svc}.service" 2>/dev/null || echo "unknown")
  pid=$(systemctl show -p MainPID --value "${svc}.service" 2>/dev/null || echo "?")
  uptime=$(systemctl show -p ActiveEnterTimestamp --value "${svc}.service" 2>/dev/null | sed 's/ [A-Z]*$//' || echo "?")
  restarts=$(systemctl show -p NRestarts --value "${svc}.service" 2>/dev/null || echo "?")

  if [ "$state" = "active" ]; then
    icon="✓"
  else
    icon="✗"
  fi

  printf "  %s  %-22s  state=%-8s  pid=%-6s  restarts=%s\n" \
    "$icon" "$svc" "$state" "$pid" "$restarts"
done

echo ""

# Health check
if curl -sf http://127.0.0.1:8107/health -o /dev/null 2>/dev/null; then
  echo "  ✓  Backend  health check  http://127.0.0.1:8107/health"
else
  echo "  ✗  Backend  health check FAILED  http://127.0.0.1:8107/health"
fi

if curl -sf http://127.0.0.1:3007/ -o /dev/null 2>/dev/null; then
  echo "  ✓  Frontend health check  http://127.0.0.1:3007/"
else
  echo "  ✗  Frontend health check FAILED  http://127.0.0.1:3007/"
fi

echo ""

# Public endpoint
code=$(curl -s -o /dev/null -w "%{http_code}" https://aegis-lite.jesseboudreau.com/ --max-time 5 2>/dev/null || echo "ERR")
if [ "$code" = "200" ]; then
  echo "  ✓  Public   https://aegis-lite.jesseboudreau.com/  → HTTP $code"
else
  echo "  ✗  Public   https://aegis-lite.jesseboudreau.com/  → HTTP $code"
fi

echo ""
echo "  Logs:  sudo journalctl -u aegis-lite-api -u aegis-lite-web -f"
echo "         or ./logs.sh"
echo ""
