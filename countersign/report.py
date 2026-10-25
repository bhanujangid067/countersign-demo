"""Check 3 (who signs off?) and the result: the PR comment and the audit record.

Reads the results of Checks 1 and 2 and decides:
  all clear  nothing risky                                   -> exit 0
  approved   risky, but the payments lead approved this commit -> exit 0
  stopped    risky and not approved                          -> exit 1 (the GitHub check fails)

Writes out/comment.md (the PR comment) and out/audit.json (the audit record).

Usage: python -m countersign.report --callers out/callers.json --money out/money.json --out-dir out
         [--approval out/approval.json] [--pr 1] [--commit abc123] [--repo team/countersign-demo]
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from countersign.common import inr, load_config, paint, short_count, write_json

MARKER = "<!-- countersign -->"
ARTIFACT_LINK = "{{AUDIT_LINK}}"  # filled in after the audit record is uploaded


def decide(callers: dict, money: dict, approval: dict | None) -> str:
    risky = not callers["passed"] or not money["passed"]
    if not risky:
        return "all clear"
    if approval:
        return "approved"
    return "stopped"


def comment(verdict: str, callers: dict, money: dict, approval: dict | None,
            role: str, approver: str, audit_id: str) -> str:
    api = callers["api"]
    broken = [c for c in callers["callers"] if c["affected"]]
    badge = {"stopped": "🛑 **stopped**", "approved": "✅ **approved**", "all clear": "✅ **all clear**"}[verdict]
    lines = [MARKER, f"### countersign on the change to {api} — {badge}", ""]

    if money["passed"]:
        lines.append(f"✅ **Money rules hold** — re-ran {money['replayed']:,} of last week's refunds, all correct")
    else:
        first = money["examples"][0]
        sent = inr(first["after_paise"]) if first["after_paise"] is not None else "rejected"
        lines += [
            f"❌ **Money rule broken** — {first['rule']}",
            f"Re-ran last week's refunds through this change: **{money['wrong']:,} of {money['replayed']:,}** wrong",
            f"Example: paid **{inr(first['paid_paise'])}** → refund sent **{sent}**",
        ]
    lines.append("")

    if broken:
        names = " · ".join(c["name"].lower() for c in broken)
        lines.append(f"⚠️ **{len(broken)} apps use this field** — {names}")
    else:
        lines.append(f"✅ **No apps break** — checked {callers['total']} callers")
    lines.append("")

    who = f"{role} (@{approver})"
    if verdict == "stopped":
        lines.append(f"➡️ **Needs approval from:** {who}")
    elif verdict == "approved":
        lines.append(f"✅ **Approved by {role}** @{approval['login']} at {approval['submitted_at']}")
    else:
        lines.append("✅ **No sign-off needed**")
    lines.append("")

    # Details for anyone who wants to look closer.
    lines += ["<details><summary>Details</summary>", ""]
    if money["examples"]:
        lines += ["**Wrong refunds** (sample data, order ids masked)", "",
                  "| Order | Caller | Paid | Old code sent | This change sends |", "|---|---|---:|---:|---:|"]
        for e in money["examples"]:
            after = inr(e["after_paise"]) if e["after_paise"] is not None else "rejected"
            lines.append(f"| `{e['order']}` | {e['caller']} | {inr(e['paid_paise'])} | {inr(e['before_paise'])} | **{after}** |")
        lines.append("")
    lines += [f"**Who calls {api}** ({callers['total']} callers, from gateway logs)", "",
              "| Caller | Calls/day | Breaks? | Why |", "|---|---:|---|---|"]
    for c in callers["callers"]:
        mark = "**yes**" if c["affected"] else "no"
        lines.append(f"| {c['name']} | {short_count(c['calls_per_day'])} | {mark} | {c['reason']} |")
    lines.append("")
    if callers["changed_fields"]:
        lines.append("**What changed in the API**")
        lines.append("")
        for f in callers["changed_fields"]:
            parts = [f"{k}: `{v['before']}` → `{v['after']}`" for k, v in f["changes"].items()]
            lines.append(f"- `{f['field']}` in `{f['method']} {f['path']}` — " + "; ".join(parts))
        lines.append("")
    fc = callers["format_check"]
    if fc.get("tool"):
        found = fc.get("breaking")
        lines.append(f"Format check ({fc['tool']}): "
                     + ("no breaking changes found" if found == 0 else f"{found} breaking change(s)"))
        lines.append("")
    lines += ["</details>", "",
              f"Audit record `{audit_id}` · {ARTIFACT_LINK}", "",
              "<sub>Countersign demo · one sample API and made-up sample data</sub>"]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--callers", required=True, type=Path)
    parser.add_argument("--money", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--approval", type=Path, help="JSON from countersign.github approval")
    parser.add_argument("--pr", default="local")
    parser.add_argument("--commit", default="local")
    parser.add_argument("--repo", default="local")
    parser.add_argument("--tests", default="passed", help="result of the normal tests")
    args = parser.parse_args()

    config = load_config()
    callers = json.loads(args.callers.read_text())
    money = json.loads(args.money.read_text())
    approval = None
    if args.approval and args.approval.exists():
        approval = json.loads(args.approval.read_text()) or None

    verdict = decide(callers, money, approval)
    now = datetime.now(timezone.utc).replace(microsecond=0)
    audit_id = f"cs-{args.pr}-{args.commit[:7]}-{now:%Y%m%dT%H%M%SZ}"
    role, approver = config["approver"]["role"], config["approver"]["github_user"]

    audit = {
        "audit_id": audit_id,
        "created_at": now.isoformat(),
        "repo": args.repo,
        "pull_request": args.pr,
        "commit": args.commit,
        "api": callers["api"],
        "checks_run": {
            "normal_tests": args.tests,
            "who_will_break": {"passed": callers["passed"], "callers_checked": callers["total"],
                               "callers_affected": [c["name"] for c in callers["callers"] if c["affected"]]},
            "is_the_money_right": {"passed": money["passed"], "replayed": money["replayed"],
                                   "wrong": money["wrong"], "rules": money["rules"],
                                   "examples": money["examples"]},
        },
        "sign_off": {
            "needed": verdict != "all clear",
            "approver_role": role,
            "approver_github_user": approver,
            "approved_by": approval["login"] if approval else None,
            "approved_at": approval["submitted_at"] if approval else None,
        },
        "verdict": verdict,
        "note": "Countersign demo on one sample API with made-up sample data.",
    }
    write_json(args.out_dir / "audit.json", audit)
    text = comment(verdict, callers, money, approval, role, approver, audit_id)
    (args.out_dir / "comment.md").write_text(text)
    (args.out_dir / "verdict.txt").write_text(verdict + "\n")

    print(paint("Check 3 · Who signs off?", "bold"))
    if verdict == "stopped":
        print(paint(f"  → Needs approval from: {role}", "yellow"))
        print(paint("  ✗ STOPPED — this change can't go live yet", "red", "bold"))
    elif verdict == "approved":
        print(paint(f"  ✓ Approved by {role} (@{approval['login']})", "green", "bold"))
    else:
        print(paint("  ✓ No sign-off needed — ALL CLEAR", "green", "bold"))
    print(paint(f"  Audit record saved: {audit_id}", "dim"))
    return 1 if verdict == "stopped" else 0


if __name__ == "__main__":
    sys.exit(main())
