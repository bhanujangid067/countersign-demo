#!/usr/bin/env bash
# The whole Countersign demo in the terminal. No internet or GitHub needed.
#
#   scripts/demo_local.sh            run straight through
#   scripts/demo_local.sh --pause    wait for Enter between steps (for presenting)
#
# It takes four branches out of git (main, bad-change, fix, review-limit) into a temporary folder,
# then runs the normal tests and Countersign's checks on each change, exactly as the GitHub check does.
#
# Countersign itself runs from main. To try Countersign changes that aren't on main yet:
#   COUNTERSIGN_BASE=my-branch scripts/demo_local.sh
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
# On a fresh clone only main exists locally; the other two are still origin/<branch>.
ref_of() {
  git rev-parse --verify -q "$1^{commit}" || git rev-parse --verify -q "origin/$1^{commit}" || {
    echo "Can't find branch '$1'. Run: git fetch origin" >&2
    exit 2
  }
}
BASE_REF="${COUNTERSIGN_BASE:-main}"
mkdir -p "$WORK/main"
git archive "$(ref_of "$BASE_REF")" | tar -x -C "$WORK/main"
for ref in bad-change fix review-limit; do
  mkdir -p "$WORK/$ref"
  git archive "$(ref_of "$ref")" | tar -x -C "$WORK/$ref"
done

if [ -n "${NO_COLOR:-}" ]; then B="" T="" R=""; else B=$'\033[1m' T=$'\033[1;34m' R=$'\033[0m'; fi
bold()  { echo "$B$1$R"; }
title() {
  echo
  echo "$T━━ $1 ━━$R"
  if [ "$PAUSE" = 1 ]; then read -rp "   (press Enter) " _; fi
}

# Show the PR comment the way a reader sees it (without the collapsed details).
show_comment() {
  echo
  bold "The comment Countersign posts on the pull request:"
  sed -e '/<details>/,$d' -e '/<!--/d' -e 's/\*\*//g' "$1" | sed '/^$/d' | sed 's/^/   │ /'
}

# Check 3 again after the payments lead approves. $1 = branch, $2 = the reason they give.
approve_change() {
  local out="$ROOT/out/local/$1"
  title "Step 7 · The payments lead reads the numbers and signs off"
  (cd "$WORK/main" && "$PY" - "$out/approval.json" "$(cd "$ROOT" && ref_of "$1")" "$2" <<'PYEOF'
import json, sys
from datetime import datetime, timezone
from countersign.common import load_config
out, commit, reason = sys.argv[1:4]
json.dump({"login": load_config()["approver"]["github_user"], "commit": commit, "reason": reason,
           "submitted_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat()}, open(out, "w"))
PYEOF
  )
  (cd "$WORK/main" && "$PY" -m countersign.report --callers "$out/callers.json" --money "$out/money.json" \
    --approval "$out/approval.json" --out-dir "$out" --pr "$1" --commit "$(cd "$ROOT" && ref_of "$1")" --repo local)
  show_comment "$out/comment.md"
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
    --out-dir "$out" --pr "$1" --commit "$(cd "$ROOT" && ref_of "$1")" --repo local || verdict=$?
  cd "$ROOT"

  show_comment "$out/comment.md"
  return $verdict
}

bold "Countersign demo · sample refund API · made-up sample data"
echo "A developer changes the refund API so 'amount' means rupees instead of paise."
echo "They update the mobile app in the same change. Two other apps still send paise."

if check_change bad-change "Step 1–4 · The change: amount now read as rupees"; then
  echo "Unexpected: the bad change was not stopped"; exit 1
fi

check_change fix "Step 5 · The fix: API takes an explicit unit, paise by default"

echo
bold "A second change, on purpose this time."
echo "Finance asks that refunds above ₹1,00,000 are reviewed by a person, not sent automatically."
echo "The developer adds the limit. It changes what happens to real refunds, so Countersign stops it."
echo "This time nothing needs fixing: someone has to decide."

if check_change review-limit "Step 6 · The second change: refunds above ₹1,00,000 need manual review"; then
  echo "Unexpected: the manual-review change was not stopped"; exit 1
fi
cp -R out/local/review-limit out/local/review-limit-stopped
approve_change review-limit "Intended. Finance asked for manual review above ₹1,00,000. About 7 refunds a week; the review queue is staffed."

"$PY" -m countersign.dashboard --results out/local/bad-change --out out/local/dashboard.html --change-number 482 >/dev/null
"$PY" -m countersign.dashboard --results out/local/fix --out out/local/dashboard-fixed.html --change-number 482 >/dev/null
"$PY" -m countersign.dashboard --results out/local/review-limit --out out/local/dashboard-approved.html --change-number 483 >/dev/null
"$PY" -m countersign.site --base "$WORK/main" --bad "$WORK/bad-change" --fix "$WORK/fix" --review "$WORK/review-limit" \
  --results out/local --out site/data.js >/dev/null

title "Summary"
echo "  bad-change   tests ✓   Check 1 ⚠ 2 callers break   Check 2 ✗ ₹900 → ₹90,000   → STOPPED"
echo "  fix          tests ✓   Check 1 ✓                   Check 2 ✓                  → ALL CLEAR"
echo "  review-limit tests ✓   Check 1 ⚠ 1 caller affected Check 2 ✗ 7 turned away    → STOPPED, then APPROVED with a reason"
echo "  Results and audit records: out/local/"
echo "  Dashboard: open out/local/dashboard.html (and dashboard-fixed.html, dashboard-approved.html)"
echo "  Website:   open site/index.html"
