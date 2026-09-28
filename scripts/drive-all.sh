#!/usr/bin/env bash
# Run every browser drive, restarting the dev server between each one.
#
# WHY THE RESTARTS: `next dev` degrades over a long sweep — after five or six
# drives, unrelated ones start failing with "element never became visible" and
# then pass unchanged on a fresh server. It has cost three separate
# investigations (D54). A flaky suite is worse than a slow one: it trains you
# to re-run instead of read the failure. So this pays ~25s per drive to make
# every result mean something.
#
# Usage:  bash scripts/drive-all.sh [port]
set -uo pipefail

PORT="${1:-3111}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DRIVES=(drive-t2b drive-t2c drive-t2d drive-t2e drive-t2f drive-t3a drive-t3c drive-t3d drive-t3e drive-scratch-plan audit-admin)

restart() {
  pkill -f "next dev" 2>/dev/null
  sleep 2
  rm -rf .next
  (pnpm dev -p "$PORT" >/tmp/training-dev.log 2>&1 &)
  for _ in $(seq 1 60); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/login")" = "200" ]; then
      # /login answering is NOT "ready". After `rm -rf .next` every route
      # compiles on first request, and a drive that starts here can have its
      # own startup time out against a server still building — drive-t3d
      # aborted in 2.2s exactly that way while passing 10/10 alone. Warm the
      # routes a drive hits first, then give the compiler a beat.
      curl -s -o /dev/null "http://localhost:$PORT/today" || true
      curl -s -o /dev/null "http://localhost:$PORT/admin" || true
      sleep 3
      return 0
    fi
    sleep 1
  done
  echo "  dev server never came up on $PORT" >&2
  return 1
}

FAILED=()
for drive in "${DRIVES[@]}"; do
  [ -f "e2e/$drive.mjs" ] || continue
  printf '%-22s ' "$drive"
  restart || { FAILED+=("$drive (server)"); echo "SERVER FAIL"; continue; }
  if out=$(node "e2e/$drive.mjs" 2>&1); then
    echo "$out" | grep -E "passed" | tail -1
  else
    echo "$out" | grep -E "passed|FAILED" | tail -1
    FAILED+=("$drive")
  fi
done

pkill -f "next dev" 2>/dev/null

echo
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "✅ all drives green"
  exit 0
fi
echo "❌ failed: ${FAILED[*]}"
exit 1
