#!/usr/bin/env bash
# Aegis Lite health monitor — runs every 5 minutes via cron.
# Sends a Slack alert when any check fails, and a recovery alert when it comes back.
#
# Setup:
#   1. Add SLACK_WEBHOOK_URL to /home/jesse/infra/apps/aegis-lite/backend/.env
#   2. crontab -e  →  */5 * * * * /home/jesse/infra/apps/aegis-lite/scripts/monitor.sh >> /home/jesse/infra/apps/aegis-lite/logs/monitor.log 2>&1
#
# State files track previous status so we only alert on transitions (down → up, up → down).

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
ENV_FILE="/home/jesse/infra/apps/aegis-lite/backend/.env"
STATE_DIR="/home/jesse/infra/apps/aegis-lite/logs/monitor-state"
LOG_TS=$(date '+%Y-%m-%d %H:%M:%S')

# Load env (only the vars we need, safely)
if [ -f "$ENV_FILE" ]; then
  SLACK_WEBHOOK_URL=$(grep '^SLACK_WEBHOOK_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'") || true
  PUBLIC_URL=$(grep '^PUBLIC_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'") || true
fi

PUBLIC_URL="${PUBLIC_URL:-https://aegis-lite.jesseboudreau.com}"
mkdir -p "$STATE_DIR"

# ── Slack notifier ────────────────────────────────────────────────────────────
send_slack() {
  local color="$1"   # good / warning / danger
  local title="$2"
  local body="$3"

  if [ -z "${SLACK_WEBHOOK_URL:-}" ]; then
    echo "[$LOG_TS] SLACK_WEBHOOK_URL not set — skipping notification: $title"
    return
  fi

  curl -s -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{
      \"attachments\": [{
        \"color\": \"$color\",
        \"title\": \"$title\",
        \"text\": \"$body\",
        \"footer\": \"Aegis Lite Monitor\",
        \"footer_icon\": \"https://aegis-lite.jesseboudreau.com/favicon.svg\",
        \"ts\": $(date +%s)
      }]
    }" > /dev/null
}

# ── Check helper ──────────────────────────────────────────────────────────────
# check_endpoint <name> <url> <expected_field> <expected_value>
# Returns 0 if healthy, 1 if not.
check_endpoint() {
  local name="$1"
  local url="$2"
  local field="$3"
  local expected="$4"
  local state_file="$STATE_DIR/${name}.state"

  local response http_code body
  response=$(curl -s -o /tmp/_aegis_mon_body -w "%{http_code}" "$url" \
    --max-time 8 --connect-timeout 5 2>/dev/null) || response="000"
  http_code="$response"
  body=$(cat /tmp/_aegis_mon_body 2>/dev/null || echo "")

  local healthy=0
  if [ "$http_code" = "200" ] && echo "$body" | grep -q "\"$field\":\"$expected\"" 2>/dev/null; then
    healthy=1
  fi

  local prev_state
  prev_state=$(cat "$state_file" 2>/dev/null || echo "unknown")

  if [ "$healthy" = "1" ]; then
    echo "[$LOG_TS] ✓ $name — HTTP $http_code — healthy"
    if [ "$prev_state" = "down" ]; then
      send_slack "good" \
        "✅ Aegis Lite — $name recovered" \
        "*$name* is back online.\n$url\n\n_HTTP $http_code · Response: \`${body:0:120}\`_"
    fi
    echo "up" > "$state_file"
  else
    echo "[$LOG_TS] ✗ $name — HTTP $http_code — UNHEALTHY"
    if [ "$prev_state" != "down" ]; then
      send_slack "danger" \
        "🚨 Aegis Lite — $name is DOWN" \
        "*$name* health check failed.\n$url\n\n_HTTP $http_code · Response: \`${body:0:120}\`_\n\nCheck: \`systemctl status aegis-lite-api.service aegis-lite-web.service\`"
    fi
    echo "down" > "$state_file"
    return 1
  fi
}

# ── Checks ────────────────────────────────────────────────────────────────────
FAILED=0

# 1. Backend API liveness
check_endpoint "API" "$PUBLIC_URL/api/health" "status" "ok" || FAILED=1

# 2. Policy engine operational
check_endpoint "Governance" "$PUBLIC_URL/api/status" "status" "operational" || FAILED=1

# 3. Frontend (Next.js) — just check HTTP 200
FRONTEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PUBLIC_URL" --max-time 8 2>/dev/null || echo "000")
FRONTEND_STATE="$STATE_DIR/frontend.state"
PREV_FRONTEND=$(cat "$FRONTEND_STATE" 2>/dev/null || echo "unknown")
if [ "$FRONTEND_CODE" = "200" ]; then
  echo "[$LOG_TS] ✓ Frontend — HTTP 200 — healthy"
  if [ "$PREV_FRONTEND" = "down" ]; then
    send_slack "good" "✅ Aegis Lite — Frontend recovered" "*Frontend* is back online ($PUBLIC_URL)\nHTTP $FRONTEND_CODE"
  fi
  echo "up" > "$FRONTEND_STATE"
else
  echo "[$LOG_TS] ✗ Frontend — HTTP $FRONTEND_CODE — UNHEALTHY"
  if [ "$PREV_FRONTEND" != "down" ]; then
    send_slack "danger" "🚨 Aegis Lite — Frontend is DOWN" "*Frontend* not responding.\n$PUBLIC_URL\n\nHTTP $FRONTEND_CODE\n\nCheck: \`systemctl status aegis-lite-web.service\`"
    FAILED=1
  fi
  echo "down" > "$FRONTEND_STATE"
fi

# 4. systemd service status (local check)
for SVC in aegis-lite-api.service aegis-lite-web.service; do
  SVC_STATE="$STATE_DIR/${SVC}.state"
  PREV_SVC=$(cat "$SVC_STATE" 2>/dev/null || echo "unknown")
  if systemctl is-active --quiet "$SVC" 2>/dev/null; then
    echo "[$LOG_TS] ✓ $SVC — active"
    if [ "$PREV_SVC" = "down" ]; then
      send_slack "good" "✅ Aegis Lite — $SVC recovered" "*$SVC* is active again."
    fi
    echo "up" > "$SVC_STATE"
  else
    echo "[$LOG_TS] ✗ $SVC — NOT ACTIVE"
    if [ "$PREV_SVC" != "down" ]; then
      send_slack "danger" "🚨 Aegis Lite — $SVC is down" \
        "*$SVC* is not active.\n\nRestart with:\n\`\`\`sudo systemctl restart $SVC\`\`\`"
      FAILED=1
    fi
    echo "down" > "$SVC_STATE"
  fi
done

echo "[$LOG_TS] Monitor run complete — failed=$FAILED"
exit $FAILED
