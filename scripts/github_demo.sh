#!/usr/bin/env bash
# Helpers for the live GitHub demo.
#
#   scripts/github_demo.sh setup   first time: push main and the demo branches, and open both PRs
#   scripts/github_demo.sh fix     during a walkthrough: push the fix onto the PR (turns it green)
#   scripts/github_demo.sh reset   afterwards: put the PR back to the bad change
set -euo pipefail
cd "$(dirname "$0")/.."

case "${1:-}" in
  setup)
    git push -u origin main bad-change fix review-limit
    gh pr create --base main --head bad-change \
      --title "Refund API: take amount in rupees" \
      --body "Makes \`amount\` rupees instead of paise. Simpler for app developers. The mobile app is updated in the same change. All unit tests pass."
    # The second change: nothing to fix, the payments lead decides and gives a reason.
    gh pr create --base main --head review-limit \
      --title "Refund API: manual review above ₹1,00,000" \
      --body "Finance asked for this: refunds above ₹1,00,000 are turned away by the API and go to the manual review queue. All unit tests pass."
    ;;
  fix)
    # fix is bad-change plus one commit, so this is a normal (fast-forward) push.
    git push origin fix:bad-change
    ;;
  reset)
    git push --force origin "$(git rev-parse bad-change)":refs/heads/bad-change
    ;;
  *)
    sed -n '2,7p' "$0"
    exit 2
    ;;
esac
