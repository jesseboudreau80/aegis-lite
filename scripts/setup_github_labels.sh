#!/usr/bin/env bash
# =============================================================================
# Aegis Lite — GitHub Label Setup
#
# Creates a professional label set using the GitHub CLI.
# Safe to run multiple times — uses --force which upserts existing labels.
#
# Prerequisites:
#   gh auth login && gh auth status
#
# Usage:
#   bash scripts/setup_github_labels.sh [OPTIONS]
#
# Options:
#   --dry-run    Print what would be created without making API calls
#   --recover    Skip deletion of defaults; only create/update Aegis labels
#   --verify     After creation, verify every label exists via API
#   --verbose    Show full gh output (default: summary only)
# =============================================================================

# NOTE: intentionally NO set -e here.
# Arithmetic like CREATED=$((CREATED+1)) is always safe, but we want
# the loop to continue past individual failures — not abort the whole run.
set -uo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REPO="jesseboudreau80/aegis-lite"
DRY_RUN=false
RECOVER=false
VERIFY=false
VERBOSE=false
MAX_RETRIES=3
RETRY_DELAY=3

# ── Parse args ────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --recover) RECOVER=true ;;
    --verify)  VERIFY=true  ;;
    --verbose) VERBOSE=true ;;
    --help)
      sed -n '2,/^$/p' "$0" | grep -E '^#' | sed 's/^# \?//'
      exit 0 ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Run with --help for usage." >&2
      exit 1 ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo "  $*"; }
ok()   { printf "  \033[32m✓\033[0m  %-38s #%s\n" "\"$1\"" "$2"; }
fail() { printf "  \033[31m✗\033[0m  FAILED: %s — %s\n" "$1" "$2" >&2; }
info() { printf "  \033[34m→\033[0m  %s\n" "$*"; }

# ── gh auth check ─────────────────────────────────────────────────────────────
if ! gh auth status --hostname github.com >/dev/null 2>&1; then
  echo "ERROR: GitHub CLI is not authenticated." >&2
  echo "Run: gh auth login" >&2
  exit 1
fi

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Aegis Lite — GitHub Label Setup"
printf "  Repo:   %s\n" "$REPO"
printf "  Flags:  dry-run=%-5s  recover=%-5s  verify=%s\n" "$DRY_RUN" "$RECOVER" "$VERIFY"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── Step 1: Delete noisy GitHub defaults ─────────────────────────────────────
DEFAULT_LABELS=(
  "bug"
  "documentation"
  "duplicate"
  "enhancement"
  "good first issue"
  "help wanted"
  "invalid"
  "question"
  "wontfix"
)

if [[ "$RECOVER" == true ]]; then
  log "Step 1/3 — Skipping default label deletion (--recover mode)"
else
  log "Step 1/3 — Removing default GitHub labels..."
  for label in "${DEFAULT_LABELS[@]}"; do
    if [[ "$DRY_RUN" == true ]]; then
      log "[dry-run] delete: $label"
    else
      if gh label delete "$label" --repo "$REPO" --yes 2>/dev/null; then
        log "  deleted: $label"
      else
        log "  skip (not found or already deleted): $label"
      fi
    fi
  done
fi

echo ""
log "Step 2/3 — Creating Aegis Lite label set..."
echo ""

# ── Label definitions ─────────────────────────────────────────────────────────
# Format: "name|color|description"
# - color: 6-char hex WITHOUT leading #
# - description: ASCII only, max 100 chars (GitHub limit)
# - name: lowercase, hyphens ok, colons ok (for namespaced labels)

LABELS=(
  # Triage
  "needs-triage|e4e669|Newly opened - not yet reviewed by a maintainer"
  "confirmed|1d76db|Reproduced and confirmed by a maintainer"
  "wontfix|eeeeee|Intentional behavior or out of scope - will not be changed"
  "duplicate|cfd3d7|Duplicate of an existing issue"

  # Contribution entry points
  "good-first-issue|7057ff|Self-contained, well-scoped work for new contributors"
  "help-wanted|008672|Maintainers are actively looking for community input"
  "hacktoberfest|ff7518|Eligible for Hacktoberfest contributions"

  # Type
  "bug|d73a4a|Something is broken or producing incorrect behavior"
  "enhancement|a2eeef|Improvement to an existing feature"
  "feature|0075ca|New capability that does not yet exist"
  "refactor|e4e669|Code restructuring with no behavior change"
  "performance|fbca04|Latency, throughput, or resource efficiency improvement"

  # Domain
  "policy|6f42c1|Policy engine rules, config, or evaluation logic"
  "security|b60205|Security hardening, vulnerability, or threat detection"
  "governance|0052cc|Governance dashboard, audit log, or event tracking"
  "audit-engine|1d76db|Audit log schema, persistence, or query layer"
  "observability|0075ca|Metrics, tracing, logging, or monitoring"

  # Stack
  "backend|c5def5|FastAPI, Python services, or database layer"
  "frontend|bfd4f2|Next.js, TypeScript, or UI components"
  "dashboard|fef2c0|Governance dashboard or data visualization"
  "mobile|d4c5f9|Mobile responsiveness or small-screen layout"

  # Infrastructure
  "deployment|ededed|Docker, Dockerfile, CI, or hosting guides"
  "testing|bfd4f2|Unit tests, integration tests, or test infrastructure"
  "documentation|0075ca|Docs, guides, diagrams, or in-code comments"

  # Providers
  "provider-integration|e4e669|New AI provider adapters or provider-specific behavior"

  # Priority (namespaced)
  "priority:critical|b60205|Blocking release or causing data loss"
  "priority:high|d93f0b|Should be resolved in the current milestone"
  "priority:medium|e4e669|Important but not blocking"
  "priority:low|0e8a16|Nice to have - pick up when bandwidth allows"

  # Status (namespaced)
  "status:in-progress|fbca04|Actively being worked on"
  "status:blocked|d73a4a|Blocked by a dependency or decision"
  "status:needs-review|0075ca|PR or design is ready for review"
)

CREATED=0
UPDATED=0
FAILED=0
FAILED_NAMES=()

for entry in "${LABELS[@]}"; do
  # Split on pipe — description may contain spaces, hyphens, colons
  name="${entry%%|*}"
  rest="${entry#*|}"
  color="${rest%%|*}"
  description="${rest#*|}"

  # Validate we got 3 parts
  if [[ -z "$name" || -z "$color" || -z "$description" ]]; then
    fail "$entry" "parse error — expected name|color|description"
    FAILED=$((FAILED + 1))
    FAILED_NAMES+=("$name")
    continue
  fi

  # Validate color is 6 hex chars
  if ! [[ "$color" =~ ^[0-9a-fA-F]{6}$ ]]; then
    fail "$name" "invalid color '$color' — must be 6-char hex without #"
    FAILED=$((FAILED + 1))
    FAILED_NAMES+=("$name")
    continue
  fi

  if [[ "$DRY_RUN" == true ]]; then
    printf "  [dry-run] %-35s #%-8s  %s\n" "\"$name\"" "$color" "$description"
    CREATED=$((CREATED + 1))
    continue
  fi

  # Attempt creation with retry
  success=false
  for attempt in $(seq 1 $MAX_RETRIES); do
    gh_output=""
    gh_exit=0

    if [[ "$VERBOSE" == true ]]; then
      gh label create "$name" \
        --color "$color" \
        --description "$description" \
        --repo "$REPO" \
        --force && gh_exit=0 || gh_exit=$?
    else
      gh_output=$(gh label create "$name" \
        --color "$color" \
        --description "$description" \
        --repo "$REPO" \
        --force 2>&1) && gh_exit=0 || gh_exit=$?
    fi

    if [[ $gh_exit -eq 0 ]]; then
      success=true
      break
    fi

    if [[ $attempt -lt $MAX_RETRIES ]]; then
      log "  retry $attempt/$MAX_RETRIES for '$name' (exit $gh_exit)..."
      sleep "$RETRY_DELAY"
    fi
  done

  if [[ "$success" == true ]]; then
    ok "$name" "$color"
    CREATED=$((CREATED + 1))
  else
    fail "$name" "${gh_output:-exit code $gh_exit}"
    FAILED=$((FAILED + 1))
    FAILED_NAMES+=("$name")
  fi
done

# ── Step 3: Verify ────────────────────────────────────────────────────────────
echo ""
log "Step 3/3 — Summary"

if [[ "$DRY_RUN" == true ]]; then
  log "Dry run complete. ${#LABELS[@]} labels would be created."
  echo ""
  echo "Done. Run without --dry-run to apply changes."
  exit 0
fi

log "Created/updated: $CREATED   Failed: $FAILED"

if [[ "$VERIFY" == true ]] && [[ $CREATED -gt 0 ]]; then
  echo ""
  info "Verifying all labels exist on GitHub..."

  # Fetch all labels from the repo
  existing_labels=$(gh label list --repo "$REPO" --limit 200 --json name --jq '.[].name' 2>/dev/null | sort)

  VERIFY_PASS=0
  VERIFY_FAIL=0
  VERIFY_MISSING=()

  for entry in "${LABELS[@]}"; do
    name="${entry%%|*}"
    if echo "$existing_labels" | grep -qx "$name"; then
      VERIFY_PASS=$((VERIFY_PASS + 1))
    else
      VERIFY_FAIL=$((VERIFY_FAIL + 1))
      VERIFY_MISSING+=("$name")
      fail "$name" "not found on GitHub after creation"
    fi
  done

  log "Verified: $VERIFY_PASS/${#LABELS[@]} labels present on GitHub"

  if [[ ${#VERIFY_MISSING[@]} -gt 0 ]]; then
    echo ""
    echo "  Labels missing after verification:" >&2
    for m in "${VERIFY_MISSING[@]}"; do
      echo "    - $m" >&2
    done
    echo ""
    echo "  Re-run with --verbose to see gh CLI output for failing labels." >&2
  fi
fi

if [[ ${#FAILED_NAMES[@]} -gt 0 ]]; then
  echo ""
  echo "  Failed labels:" >&2
  for f in "${FAILED_NAMES[@]}"; do
    echo "    - $f" >&2
  done
  echo ""
  echo "  Troubleshooting:" >&2
  echo "    1. Check auth:     gh auth status" >&2
  echo "    2. Check perms:    gh repo view $REPO" >&2
  echo "    3. See full output: bash scripts/setup_github_labels.sh --verbose --recover" >&2
  echo "    4. Retry failures: bash scripts/setup_github_labels.sh --recover --verify" >&2
  exit 1
fi

echo ""
echo "All labels created successfully."
echo "View: https://github.com/$REPO/labels"
