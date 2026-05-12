#!/usr/bin/env bash
# =============================================================================
# Aegis Lite — Bulk GitHub Issue Creator
#
# Reads markdown files from docs/github-issues/ and creates GitHub issues.
# Labels are extracted from the "Labels:" line in each file.
#
# Prerequisites:
#   - gh auth login
#   - Run scripts/setup_github_labels.sh first (labels must exist)
#
# Usage:
#   bash scripts/create_github_issues.sh [--dry-run] [--file=<issue-file.md>]
#
# Flags:
#   --dry-run        Print what would be created without making API calls
#   --file=<name>    Create only a single issue file (filename, not full path)
# =============================================================================

set -euo pipefail

REPO="jesseboudreau80/aegis-lite"
ISSUES_DIR="$(dirname "$0")/../docs/github-issues"
DRY_RUN=false
SINGLE_FILE=""

for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
  [[ "$arg" =~ ^--file=(.+)$ ]] && SINGLE_FILE="${BASH_REMATCH[1]}"
done

echo "═══════════════════════════════════════════════════"
echo "  Aegis Lite — GitHub Issue Creator"
echo "  Repo: $REPO"
[[ "$DRY_RUN" == true ]] && echo "  Mode: DRY RUN (no issues created)"
[[ -n "$SINGLE_FILE" ]] && echo "  Single file: $SINGLE_FILE"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Parse labels from "Labels:" line ─────────────────────────────────────────
extract_labels() {
  local file="$1"
  # Match lines containing **Labels:** or Labels: anywhere in the line
  grep -i "\*\*Labels\*\*:\|^Labels:" "$file" 2>/dev/null \
    | head -1 \
    | grep -oP '`[^`]+`' \
    | tr -d '`' \
    | tr '\n' ',' \
    | sed 's/,$//'
}

# ── Parse title from first "# " heading ──────────────────────────────────────
extract_title() {
  local file="$1"
  grep -m1 "^# " "$file" | sed 's/^# //'
}

# ── Build file list ───────────────────────────────────────────────────────────
if [[ -n "$SINGLE_FILE" ]]; then
  files=("$ISSUES_DIR/$SINGLE_FILE")
else
  # Sort numerically so issues are created in order
  mapfile -t files < <(find "$ISSUES_DIR" -name "*.md" | sort)
fi

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No issue files found in $ISSUES_DIR"
  exit 1
fi

CREATED=0
SKIPPED=0
FAILED=0

for file in "${files[@]}"; do
  [[ -f "$file" ]] || continue

  title="$(extract_title "$file")"
  labels="$(extract_labels "$file")"
  filename="$(basename "$file")"

  if [[ -z "$title" ]]; then
    echo "  ⚠ Skipping $filename — no title found"
    ((SKIPPED++))
    continue
  fi

  echo "────────────────────────────────────────────────────"
  echo "  File:   $filename"
  echo "  Title:  $title"
  echo "  Labels: ${labels:-<none>}"

  if [[ "$DRY_RUN" == true ]]; then
    echo "  [dry-run] Would create issue"
    ((CREATED++))
    continue
  fi

  # Build label args
  label_args=()
  if [[ -n "$labels" ]]; then
    IFS=',' read -ra label_list <<< "$labels"
    for label in "${label_list[@]}"; do
      label=$(echo "$label" | xargs)  # trim whitespace
      label_args+=("--label" "$label")
    done
  fi

  if gh issue create \
      --title "$title" \
      --body-file "$file" \
      --repo "$REPO" \
      "${label_args[@]}" 2>/dev/null; then
    echo "  ✓ Created"
    ((CREATED++))
    # Brief pause to avoid secondary rate limit
    sleep 2
  else
    echo "  ✗ FAILED — check label names match exactly what was created by setup_github_labels.sh"
    ((FAILED++))
  fi
done

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Summary: Created=$CREATED  Skipped=$SKIPPED  Failed=$FAILED"
if [[ "$DRY_RUN" == true ]]; then
  echo "  Dry run complete. Run without --dry-run to create issues."
fi
echo "  Issues: https://github.com/$REPO/issues"
