#!/usr/bin/env bash
# ralph-verify.sh — the "ralph loop" correctness gate for the Instrument redesign.
#
# Runs the project's static + build checks in order and reports a single GREEN/RED
# verdict. A ralph loop = run this, fix what it reports, run it again, repeat until
# GREEN. Used as the per-phase gate during the redesign (see design-reference/).
#
# Usage:
#   scripts/ralph-verify.sh            # full gate: format → typecheck → lint → build
#   scripts/ralph-verify.sh --quick    # skip the (slow) production build
#   scripts/ralph-verify.sh --fix      # auto-format before checking
#
# Exit code 0 = GREEN (safe to proceed / commit). Non-zero = RED (keep fixing).

set -uo pipefail
cd "$(dirname "$0")/.."

QUICK=0
FIX=0
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    --fix)   FIX=1 ;;
    *) echo "unknown arg: $arg"; exit 2 ;;
  esac
done

FAILED=()
run() {
  local label="$1"; shift
  echo ""
  echo "▶ $label"
  echo "  \$ $*"
  if "$@"; then
    echo "  ✓ $label passed"
  else
    echo "  ✗ $label FAILED"
    FAILED+=("$label")
  fi
}

echo "════════════════════════════════════════════"
echo "  ralph-verify · Instrument redesign gate"
echo "  $(date '+%Y-%m-%d %H:%M:%S')  quick=$QUICK fix=$FIX"
echo "════════════════════════════════════════════"

if [[ $FIX -eq 1 ]]; then
  run "format (write)" pnpm format
fi

run "format:check" pnpm format:check
run "typecheck"    pnpm typecheck
run "lint"         pnpm lint
if [[ $QUICK -eq 0 ]]; then
  run "build"      pnpm build
fi

echo ""
echo "════════════════════════════════════════════"
if [[ ${#FAILED[@]} -eq 0 ]]; then
  echo "  ✅ GREEN — all gates passed"
  echo "════════════════════════════════════════════"
  exit 0
else
  echo "  ❌ RED — ${#FAILED[@]} gate(s) failed: ${FAILED[*]}"
  echo "  Fix the above, then re-run scripts/ralph-verify.sh"
  echo "════════════════════════════════════════════"
  exit 1
fi
