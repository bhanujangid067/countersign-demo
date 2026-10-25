"""The GitHub side of Countersign, used only inside the GitHub workflow.

  approval  Did the payments lead approve the PR's latest commit? Writes out/approval.json.
  publish   Posts (or updates) the one Countersign comment on the PR. If stopped, adds the
            needs-payments-lead label and asks the payments lead to review; if clear, removes the label.

Needs GITHUB_TOKEN, GITHUB_REPOSITORY and PR_NUMBER in the environment.
Uses only Python's standard library to talk to the GitHub API.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from countersign.common import load_config, write_json
from countersign.report import ARTIFACT_LINK, MARKER

API = "https://api.github.com"


def call(method: str, path: str, body: dict | None = None):
    request = urllib.request.Request(
        API + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(request) as response:
        text = response.read()
        return json.loads(text) if text else None


def try_call(method: str, path: str, body: dict | None = None):
    """Like call(), but a GitHub error is printed as a warning instead of stopping the run."""
    try:
        return call(method, path, body)
    except urllib.error.HTTPError as error:
        print(f"::warning::GitHub said {error.code} to {method} {path}: {error.read().decode()[:200]}")
        return None


def approval(repo: str, pr: str, head_sha: str, approver: str, out: Path) -> None:
    reviews = call("GET", f"/repos/{repo}/pulls/{pr}/reviews?per_page=100")
    # The approver's latest review on this exact commit counts. An approval of an older commit doesn't.
    latest = None
    for review in reviews:
        if review["user"]["login"].lower() == approver.lower() and review["commit_id"] == head_sha:
            if review["state"] in ("APPROVED", "CHANGES_REQUESTED", "DISMISSED"):
                latest = review
    found = None
    if latest and latest["state"] == "APPROVED":
        found = {"login": latest["user"]["login"], "submitted_at": latest["submitted_at"],
                 "review_id": latest["id"], "commit": head_sha}
    write_json(out, found or {})
    print(f"Approval from @{approver} on {head_sha[:7]}: {'yes' if found else 'no'}")


def publish(repo: str, pr: str, comment_file: Path, verdict_file: Path, audit_link: str) -> None:
    config = load_config()
    label, approver = config["label"], config["approver"]["github_user"]
    body = comment_file.read_text().replace(ARTIFACT_LINK, audit_link)
    verdict = verdict_file.read_text().strip()

    # One comment per PR: update ours if it's already there.
    existing = None
    for c in call("GET", f"/repos/{repo}/issues/{pr}/comments?per_page=100"):
        if MARKER in (c.get("body") or ""):
            existing = c
    if existing:
        call("PATCH", f"/repos/{repo}/issues/comments/{existing['id']}", {"body": body})
    else:
        call("POST", f"/repos/{repo}/issues/{pr}/comments", {"body": body})
    print("Posted the Countersign comment")

    if verdict == "stopped":
        try_call("POST", f"/repos/{repo}/labels", {"name": label, "color": "d93f0b",
                                                  "description": "Countersign: needs the payments lead"})
        try_call("POST", f"/repos/{repo}/issues/{pr}/labels", {"labels": [label]})
        try_call("POST", f"/repos/{repo}/pulls/{pr}/requested_reviewers", {"reviewers": [approver]})
        print(f"Added label {label} and asked @{approver} to review")
    else:
        try_call("DELETE", f"/repos/{repo}/issues/{pr}/labels/{label}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    a = sub.add_parser("approval")
    a.add_argument("--head-sha", required=True)
    a.add_argument("--out", required=True, type=Path)
    p = sub.add_parser("publish")
    p.add_argument("--comment", required=True, type=Path)
    p.add_argument("--verdict", required=True, type=Path)
    p.add_argument("--audit-link", default="saved as a workflow artifact")
    args = parser.parse_args()

    repo, pr = os.environ["GITHUB_REPOSITORY"], os.environ["PR_NUMBER"]
    if args.command == "approval":
        approval(repo, pr, args.head_sha, load_config()["approver"]["github_user"], args.out)
    else:
        publish(repo, pr, args.comment, args.verdict, args.audit_link)
    return 0


if __name__ == "__main__":
    sys.exit(main())
