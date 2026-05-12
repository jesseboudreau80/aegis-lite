#!/usr/bin/env bash
# =============================================================================
# Aegis Lite — Bulk GitHub Issue Creator
#
# Reads markdown files from docs/github-issues/ and creates GitHub issues.
# Labels are extracted from the "**Labels:**" line in each file.
#
# Prerequisites:
#   - gh auth login
#   - Run scripts/setup_github_labels.sh first (labels must exist)
#
# Usage:
#   bash scripts/create_github_issues.sh [OPTIONS]
#
# Options:
#   --dry-run        Print what would be created without making API calls
#   --recover        Skip issues whose title already exists on GitHub
#   --file=<name>    Create only one issue file (filename only, not full path)
#   --verbose        Show full gh output
#   --no-labels      Create issues without applying labels (useful if labels missing)
# =============================================================================

# NOTE: NO set -e — we want the loop to continue past individual failures.
set -uo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REPO="jesseboudreau80/aegis-lite"
ISSUES_DIR="$(cd "$(dirname "$0")/.." && pwd)/docs/github-issues"
DRY_RUN=false
RECOVER=false
SINGLE_FILE=""
VERBOSE=false
NO_LABELS=false
RATE_LIMIT_SLEEP=3

# ── Parse args ────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --dry-run)   DRY_RUN=true  ;;
    --recover)   RECOVER=true  ;;
    --verbose)   VERBOSE=true  ;;
    --no-labels) NO_LABELS=true ;;
    --file=*)    SINGLE_FILE="${arg#--file=}" ;;
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
log()    { echo "  $*"; }
ok()     { printf "  \033[32m✓\033[0m  %s\n" "$*"; }
skip()   { printf "  \033[33m–\033[0m  SKIPPED: %s\n" "$*"; }
fail()   { printf "  \033[31m✗\033[0m  FAILED:  %s\n" "$*" >&2; }

# ── gh auth check ─────────────────────────────────────────────────────────────
if ! gh auth status --hostname github.com >/dev/null 2>&1; then
  echo "ERROR: GitHub CLI is not authenticated. Run: gh auth login" >&2
  exit 1
fi

# ── Label extraction (from **Labels:** line) ──────────────────────────────────
extract_labels() {
  local file="$1"
  # Matches: **Labels:** `label-one` · `label-two`
  # The backtick-quoted values are the label names.
  grep "Labels" "$file" 2>/dev/null \
    | head -1 \
    | grep -oP '`[^`]+`' \
    | tr -d '`' \
    | tr '\n' ',' \
    | sed 's/,$//'
}

# ── Title extraction (first # heading) ───────────────────────────────────────
extract_title() {
  local file="$1"
  grep -m1 "^# " "$file" 2>/dev/null | sed 's/^# //' | sed 's/^Issue: //'
}

# ── Fetch existing issue titles for --recover mode ───────────────────────────
existing_titles=""
if [[ "$RECOVER" == true ]] && [[ "$DRY_RUN" == false ]]; then
  log "Fetching existing issue titles for --recover check..."
  existing_titles=$(gh issue list --repo "$REPO" --limit 200 --state all \
    --json title --jq '.[].title' 2>/dev/null || echo "")
  log "Found $(echo "$existing_titles" | grep -c . || echo 0) existing issues"
  echo ""
fi

# ── Build file list ───────────────────────────────────────────────────────────
if [[ -n "$SINGLE_FILE" ]]; then
  target="$ISSUES_DIR/$SINGLE_FILE"
  if [[ ! -f "$target" ]]; then
    echo "ERROR: File not found: $target" >&2
    exit 1
  fi
  files=("$target")
else
  mapfile -t files < <(find "$ISSUES_DIR" -maxdepth 1 -name "*.md" | sort)
fi

if [[ ${#files[@]} -eq 0 ]]; then
  echo "ERROR: No .md files found in $ISSUES_DIR" >&2
  exit 1
fi

# ── Banner ────────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "  Aegis Lite — GitHub Issue Creator"
printf "  Repo:   %s\n" "$REPO"
printf "  Files:  %d found in docs/github-issues/\n" "${#files[@]}"
printf "  Flags:  dry-run=%-5s  recover=%-5s  no-labels=%s\n" "$DRY_RUN" "$RECOVER" "$NO_LABELS"
echo "═══════════════════════════════════════════════════════════"
echo ""

CREATED=0
SKIPPED=0
FAILED=0
FAILED_TITLES=()

for file in "${files[@]}"; do
  [[ -f "$file" ]] || continue

  filename="$(basename "$file")"
  raw_title="$(extract_title "$file")"
  labels="$(extract_labels "$file")"

  # ── Validate title ──────────────────────────────────────────────────────────
  if [[ -z "$raw_title" ]]; then
    echo "────────────────────────────────────────────────"
    log "File: $filename"
    skip "no # heading found — skipping"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "────────────────────────────────────────────────"
  log "File:   $filename"
  log "Title:  $raw_title"
  log "Labels: ${labels:-<none>}"

  # ── Dry run ─────────────────────────────────────────────────────────────────
  if [[ "$DRY_RUN" == true ]]; then
    ok "Would create: $raw_title"
    CREATED=$((CREATED + 1))
    continue
  fi

  # ── Recover: skip if title already exists ───────────────────────────────────
  if [[ "$RECOVER" == true ]] && [[ -n "$existing_titles" ]]; then
    if echo "$existing_titles" | grep -qxF "$raw_title"; then
      skip "already exists on GitHub — skipping (--recover)"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
    # Also check the "Issue: " prefixed variant
    if echo "$existing_titles" | grep -qxF "Issue: $raw_title"; then
      skip "already exists (with 'Issue: ' prefix) — skipping (--recover)"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
  fi

  # ── Build label args ─────────────────────────────────────────────────────────
  label_args=()
  if [[ "$NO_LABELS" == false ]] && [[ -n "$labels" ]]; then
    IFS=',' read -ra label_list <<< "$labels"
    for label in "${label_list[@]}"; do
      label="$(echo "$label" | xargs)"  # trim whitespace
      [[ -n "$label" ]] && label_args+=("--label" "$label")
    done
  fi

  # ── Create the issue ─────────────────────────────────────────────────────────
  gh_output=""
  gh_exit=0

  if [[ "$VERBOSE" == true ]]; then
    gh issue create \
      --title "$raw_title" \
      --body-file "$file" \
      --repo "$REPO" \
      "${label_args[@]+"${label_args[@]}"}" && gh_exit=0 || gh_exit=$?
  else
    gh_output=$(gh issue create \
      --title "$raw_title" \
      --body-file "$file" \
      --repo "$REPO" \
      "${label_args[@]+"${label_args[@]}"}" 2>&1) && gh_exit=0 || gh_exit=$?
  fi

  if [[ $gh_exit -eq 0 ]]; then
    issue_url="${gh_output:-created}"
    ok "Created → ${issue_url}"
    CREATED=$((CREATED + 1))
    # Respect GitHub secondary rate limit
    sleep "$RATE_LIMIT_SLEEP"
  else
    # Check if it's a label-not-found error — offer advice
    if echo "$gh_output" | grep -qi "label"; then
      fail "$raw_title"
      log "    gh output: ${gh_output}"
      log "    Hint: label may not exist. Try --no-labels or run setup_github_labels.sh first."
    else
      fail "$raw_title"
      [[ -n "$gh_output" ]] && log "    gh output: ${gh_output}"
    fi
    FAILED=$((FAILED + 1))
    FAILED_TITLES+=("$raw_title")
  fi
done

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
printf "  Created: %-4d  Skipped: %-4d  Failed: %d\n" "$CREATED" "$SKIPPED" "$FAILED"

if [[ "$DRY_RUN" == true ]]; then
  echo "  Dry run complete. Run without --dry-run to create issues."
fi

if [[ ${#FAILED_TITLES[@]} -gt 0 ]]; then
  echo ""
  echo "  Failed issues:" >&2
  for t in "${FAILED_TITLES[@]}"; do
    echo "    - $t" >&2
  done
  echo ""
  echo "  Troubleshooting:" >&2
  echo "    Labels missing?  bash scripts/setup_github_labels.sh --recover --verify" >&2
  echo "    Skip labels?     bash scripts/create_github_issues.sh --recover --no-labels" >&2
  echo "    Single retry?    bash scripts/create_github_issues.sh --file=<filename.md>" >&2
  echo "    See errors?      bash scripts/create_github_issues.sh --verbose --recover" >&2
  exit 1
fi

echo "  Issues: https://github.com/$REPO/issues"
