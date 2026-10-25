#!/usr/bin/env bash
# The whole Countersign demo in the terminal. No internet or GitHub needed.
#
#   scripts/demo_local.sh            run straight through
#   scripts/demo_local.sh --pause    wait for Enter between steps (for presenting)
#
# It takes three branches out of git (main, bad-change, fix) into a temporary folder, then
# runs the normal tests and Countersign's checks on each change, exactly as the GitHub check does.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)

PY="$ROOT/.venv/bin/python"
[ -x "$PY" ] || PY=python3
"$PY" -c "import yaml, pytest" 2>/dev/null || {
  echo "Missing packages. Run once (needs internet): python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 2
}

PAUSE=0
[ "${1:-}" = "--pause" ] && PAUSE=1
export FORCE_COLOR=1 PYTHONDONTWRITEBYTECODE=1

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
for ref in main bad-change fix; do
  mkdir -p "$WORK/$ref"
  git archive "$ref" | tar -x -C "$WORK/$ref"
done

if [ -n "${NO_COLOR:-}" ]; then B="" T="" R=""; else B=$'\033[1m' T=$'\033[1;34m' R=$'\033[0m'; fi
bold()  { echo "$B$1$R"; }
title() {
  echo
  echo "$T━━ $1 ━━$R"
  if [ "$PAUSE" = 1 ]; then read -rp "   (press Enter) " _; fi
}

# Run tests + Checks 1–3 for one change. $1 = branch, $2 = what the change is.
check_change() {
  local head="$WORK/$1" out="$ROOT/out/local/$1"
  rm -rf "$out" && mkdir -p "$out"

  title "$2"
  bold "Normal tests"
  (cd "$head" && "$PY" -m pytest -q -p no:cacheprovider) | tail -1

  # Countersign runs from main (the base branch) and looks at the PR branch's code.
  cd "$WORK/main"
  echo
  "$PY" -m countersign.check_callers --base . --head "$head" --out "$out/callers.json"
  echo
  "$PY" -m countersign.check_money --base . --head "$head" --out "$out/money.json" || true
  echo
  local verdict=0
  "$PY" -m countersign.report --callers "$out/callers.json" --money "$out/money.json" \
    --out-dir "$out" --pr "$1" --commit "$(git -C "$ROOT" rev-parse "$1")" --repo local || verdict=$?
  cd "$ROOT"

  echo
  bold "The comment Countersign posts on the pull request:"
  sed -e '/<details>/,$d' -e '/<!--/d' -e 's/\*\*//g' "$out/comment.md" | sed '/^$/d' | sed 's/^/   │ /'
  return $verdict
}

bold "Countersign demo · sample refund API · made-up sample data"
echo "A developer changes the refund API so 'amount' means rupees instead of paise."
echo "They update the mobile app in the same change. Two other apps still send paise."

if check_change bad-change "Step 1–4 · The change: amount now read as rupees"; then
  echo "Unexpected: the bad change was not stopped"; exit 1
fi

check_change fix "Step 5 · The fix: API takes an explicit unit, paise by default"

"$PY" -m countersign.dashboard --results out/local/bad-change --out out/local/dashboard.html --change-number 482 >/dev/null
"$PY" -m countersign.dashboard --results out/local/fix --out out/local/dashboard-fixed.html --change-number 482 >/dev/null
"$PY" -m countersign.site --base "$WORK/main" --bad "$WORK/bad-change" --fix "$WORK/fix" \
  --results out/local --out site/data.js >/dev/null

title "Summary"
echo "  bad-change   tests ✓   Check 1 ⚠ 2 callers break   Check 2 ✗ ₹900 → ₹90,000   → STOPPED"
echo "  fix          tests ✓   Check 1 ✓                   Check 2 ✓                  → ALL CLEAR"
echo "  Results and audit records: out/local/"
echo "  Dashboard: open out/local/dashboard.html (and dashboard-fixed.html)"
echo "  Website:   open site/index.html"
