#!/usr/bin/env bash
# Helpers for the live GitHub demo.
#
#   scripts/github_demo.sh setup   first time: push main, bad-change and fix, and open the PR
#   scripts/github_demo.sh fix     on stage: push the fix onto the PR (turns it green)
#   scripts/github_demo.sh reset   after a rehearsal: put the PR back to the bad change
set -euo pipefail
cd "$(dirname "$0")/.."

case "${1:-}" in
  setup)
    git push -u origin main bad-change fix
    gh pr create --base main --head bad-change \
      --title "Refund API: take amount in rupees" \
      --body "Makes \`amount\` rupees instead of paise. Simpler for app developers. The mobile app is updated in the same change. All unit tests pass."
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
