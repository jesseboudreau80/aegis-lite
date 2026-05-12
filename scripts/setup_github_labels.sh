#!/usr/bin/env bash
# =============================================================================
# Aegis Lite — GitHub Label Setup
#
# Creates a professional label set using the GitHub CLI.
# Run this ONCE after the repo is public.
#
# Prerequisites:
#   gh auth login
#   gh auth status
#
# Usage:
#   cd aegis-lite
#   bash scripts/setup_github_labels.sh [--dry-run]
#
# Flags:
#   --dry-run    Print what would be created without making API calls
# =============================================================================

set -euo pipefail

REPO="jesseboudreau80/aegis-lite"
DRY_RUN=false

for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
done

echo "═══════════════════════════════════════════════════"
echo "  Aegis Lite — GitHub Label Setup"
echo "  Repo: $REPO"
[[ "$DRY_RUN" == true ]] && echo "  Mode: DRY RUN (no changes)"
echo "═══════════════════════════════════════════════════"
echo ""

# Delete default GitHub labels that add noise
DEFAULT_LABELS=(
  "bug" "documentation" "duplicate" "enhancement" "good first issue"
  "help wanted" "invalid" "question" "wontfix"
)

echo "Step 1/3 — Removing default GitHub labels…"
for label in "${DEFAULT_LABELS[@]}"; do
  if [[ "$DRY_RUN" == true ]]; then
    echo "  [dry-run] delete: $label"
  else
    gh label delete "$label" --repo "$REPO" --yes 2>/dev/null || true
  fi
done

echo ""
echo "Step 2/3 — Creating Aegis Lite label set…"
echo ""

# Format: "name|color|description"
LABELS=(
  # ── Triage ────────────────────────────────────────────────────────────────
  "needs-triage|e4e669|Newly opened — not yet reviewed by a maintainer"
  "confirmed|1d76db|Reproduced and confirmed by a maintainer"
  "wontfix|ffffff|Intentional behavior or out of scope — will not be changed"
  "duplicate|cfd3d7|Duplicate of an existing issue"

  # ── Contribution entry points ─────────────────────────────────────────────
  "good-first-issue|7057ff|Self-contained, well-scoped work for new contributors"
  "help-wanted|008672|Maintainers are actively looking for community input"
  "hacktoberfest|ff7518|Eligible for Hacktoberfest contributions"

  # ── Type ──────────────────────────────────────────────────────────────────
  "bug|d73a4a|Something is broken or producing incorrect behavior"
  "enhancement|a2eeef|Improvement to an existing feature"
  "feature|0075ca|New capability that doesn't yet exist"
  "refactor|e4e669|Code restructuring with no behavior change"
  "performance|fbca04|Latency, throughput, or resource efficiency improvement"

  # ── Domain ───────────────────────────────────────────────────────────────
  "policy|6f42c1|Policy engine rules, config, or evaluation logic"
  "security|b60205|Security hardening, vulnerability, or threat detection"
  "governance|0052cc|Governance dashboard, audit log, or event tracking"
  "audit-engine|1d76db|Audit log schema, persistence, or query layer"
  "observability|0075ca|Metrics, tracing, logging, or monitoring"

  # ── Stack ─────────────────────────────────────────────────────────────────
  "backend|c5def5|FastAPI, Python services, or database layer"
  "frontend|bfd4f2|Next.js, TypeScript, or UI components"
  "dashboard|fef2c0|Governance dashboard or data visualization"
  "mobile|d4c5f9|Mobile responsiveness or small-screen layout"

  # ── Infrastructure ────────────────────────────────────────────────────────
  "deployment|ededed|Docker, Dockerfile, CI, or hosting guides"
  "testing|bfd4f2|Unit tests, integration tests, or test infrastructure"
  "documentation|0075ca|Docs, guides, diagrams, or in-code comments"

  # ── Providers ─────────────────────────────────────────────────────────────
  "provider-integration|e4e669|New AI provider adapters or provider-specific behavior"

  # ── Priority ──────────────────────────────────────────────────────────────
  "priority:critical|b60205|Blocking release or causing data loss"
  "priority:high|d93f0b|Should be resolved in the current milestone"
  "priority:medium|e4e669|Important but not blocking"
  "priority:low|0e8a16|Nice to have — pick up when bandwidth allows"

  # ── Status ────────────────────────────────────────────────────────────────
  "status:in-progress|fbca04|Actively being worked on"
  "status:blocked|d73a4a|Blocked by a dependency or decision"
  "status:needs-review|0075ca|PR or design is ready for review"
)

CREATED=0
FAILED=0

for entry in "${LABELS[@]}"; do
  IFS='|' read -r name color description <<< "$entry"
  if [[ "$DRY_RUN" == true ]]; then
    printf "  [dry-run] %-35s #%-8s %s\n" "\"$name\"" "$color" "$description"
  else
    if gh label create "$name" \
        --color "$color" \
        --description "$description" \
        --repo "$REPO" \
        --force 2>/dev/null; then
      printf "  ✓ %-35s #%s\n" "\"$name\"" "$color"
      ((CREATED++))
    else
      printf "  ✗ FAILED: %s\n" "$name"
      ((FAILED++))
    fi
  fi
done

echo ""
echo "Step 3/3 — Summary"
if [[ "$DRY_RUN" == true ]]; then
  echo "  Dry run complete. ${#LABELS[@]} labels would be created."
else
  echo "  Created: $CREATED  Failed: $FAILED"
  if [[ $FAILED -gt 0 ]]; then
    echo "  Some labels failed — check gh auth status and repo permissions."
    exit 1
  fi
fi

echo ""
echo "Done. View labels at: https://github.com/$REPO/labels"
