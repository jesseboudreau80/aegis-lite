#!/usr/bin/env bash
# Pre-launch health check — run this the morning of Product Hunt launch
# and again 30 minutes before going live.

set -e

DEMO_URL="https://aegis-lite.jesseboudreau.com"
API_URL="$DEMO_URL/api"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; FAILED=1; }
warn() { echo -e "${YELLOW}~${NC} $1"; }

FAILED=0

echo ""
echo "═══════════════════════════════════════════"
echo "  Aegis Lite — Launch Day Health Check"
echo "═══════════════════════════════════════════"
echo ""

# ── Frontend ────────────────────────────────────────────────────────────────
echo "[ Frontend ]"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEMO_URL" --max-time 10)
if [ "$STATUS" = "200" ]; then
  pass "Homepage returns 200"
else
  fail "Homepage returned $STATUS (expected 200)"
fi

# ── API health ───────────────────────────────────────────────────────────────
echo ""
echo "[ Backend API ]"
HEALTH=$(curl -s "$API_URL/health" --max-time 10)
if echo "$HEALTH" | grep -q '"status"'; then
  pass "API health endpoint responding"
  echo "    $HEALTH"
else
  fail "API health endpoint not responding — check aegis-lite-api.service"
fi

META=$(curl -s "$API_URL/.well-known/aegis-meta" --max-time 10)
if echo "$META" | grep -q '"version"'; then
  pass "API meta endpoint responding"
else
  fail "API meta endpoint not responding (/.well-known/aegis-meta)"
fi

# ── Auth ─────────────────────────────────────────────────────────────────────
echo ""
echo "[ Authentication ]"
AUTH_RESP=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"demo"}' \
  --max-time 10)

if echo "$AUTH_RESP" | grep -q '"access_token"'; then
  pass "Admin login works (admin@example.com / demo)"
  # Write token to temp file to avoid subshell variable loss
  echo "$AUTH_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" > /tmp/_aegis_launch_token 2>/dev/null
  TOKEN=$(cat /tmp/_aegis_launch_token 2>/dev/null || echo "")
else
  fail "Admin login failed — check DEMO_PASSWORD or auth service"
  TOKEN=""
fi

AUTH_RESP2=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demo"}' \
  --max-time 10)

if echo "$AUTH_RESP2" | grep -q '"access_token"'; then
  pass "Demo user login works (demo@example.com / demo)"
else
  fail "Demo user login failed"
fi

# ── Core features (requires auth) ────────────────────────────────────────────
# The Next.js middleware gates /api/* routes behind aegis_session cookie.
# The actual JWT auth happens at the backend layer. We pass both for curl testing.
AUTH_COOKIE="aegis_session=authenticated"

if [ -n "$TOKEN" ]; then
  echo ""
  echo "[ Core Features ]"

  MODELS=$(curl -s "$API_URL/models" \
    -H "Authorization: Bearer $TOKEN" \
    -b "$AUTH_COOKIE" --max-time 10)
  if echo "$MODELS" | grep -q '"id"'; then
    pass "Models endpoint returning providers"
  else
    fail "Models endpoint empty — check provider API keys"
  fi

  CONVS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/conversations" \
    -H "Authorization: Bearer $TOKEN" -b "$AUTH_COOKIE" --max-time 10)
  if [ "$CONVS_STATUS" = "200" ]; then
    pass "Conversations endpoint OK (HTTP 200)"
  else
    fail "Conversations endpoint returned HTTP $CONVS_STATUS"
  fi

  AUDIT=$(curl -s "$API_URL/governance/audit" \
    -H "Authorization: Bearer $TOKEN" -b "$AUTH_COOKIE" --max-time 10)
  if echo "$AUDIT" | grep -q '"events"'; then
    pass "Audit log endpoint OK"
  else
    warn "Audit log endpoint may be empty (OK if no requests yet)"
  fi

  PLAYBOOKS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/playbooks" \
    -H "Authorization: Bearer $TOKEN" -b "$AUTH_COOKIE" --max-time 10)
  if [ "$PLAYBOOKS_STATUS" = "200" ]; then
    pass "Playbooks endpoint OK (HTTP 200)"
  else
    fail "Playbooks endpoint returned HTTP $PLAYBOOKS_STATUS"
  fi
fi

# ── Local services ────────────────────────────────────────────────────────────
echo ""
echo "[ Systemd Services ]"
if systemctl is-active --quiet aegis-lite-api.service 2>/dev/null; then
  pass "aegis-lite-api.service is active"
else
  warn "aegis-lite-api.service status unknown (may be remote deployment)"
fi

if systemctl is-active --quiet aegis-lite-web.service 2>/dev/null; then
  pass "aegis-lite-web.service is active"
else
  warn "aegis-lite-web.service status unknown (may be remote deployment)"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
if [ "$FAILED" = "1" ]; then
  echo -e "${RED}  LAUNCH BLOCKED — fix failures above before going live${NC}"
  echo "═══════════════════════════════════════════"
  exit 1
else
  echo -e "${GREEN}  ALL CHECKS PASSED — ready to launch 🚀${NC}"
  echo "═══════════════════════════════════════════"
  echo ""
  echo "  Demo:   $DEMO_URL"
  echo "  Login:  admin@example.com / demo"
  echo ""
fi
