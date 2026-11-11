"""Export a demo run as site/data.js, the data behind the Countersign website (site/index.html).

Re-runs the refund replay on all three versions of the code, so the website's numbers,
example refunds and code diffs all come from the real checks, not typed in by hand.

Usage: python -m countersign.site --base <main dir> --bad <bad-change dir> --fix <fix dir>
         --results out/local --out site/data.js
"""

import argparse
import difflib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from countersign.check_money import rule_holds, send
from countersign.common import (
    load_config, load_handler, load_yaml, mask_order, read_gateway_log, read_refunds, request_builder,
)

DIFF_FILES = ["service/refund_api.py", "service/openapi.yaml", "clients/mobile_app.py", "service/tests/test_refunds.py"]


def file_diff(old_dir: Path, new_dir: Path, path: str) -> dict | None:
    old = (old_dir / path).read_text().splitlines()
    new = (new_dir / path).read_text().splitlines()
    lines = list(difflib.unified_diff(old, new, lineterm="", n=3))[2:]  # drop the ---/+++ header
    if not lines:
        return None
    return {
        "path": path,
        "added": sum(1 for l in lines if l.startswith("+")),
        "removed": sum(1 for l in lines if l.startswith("-")),
        "lines": lines,
    }


def count_tests(code_dir: Path) -> int:
    return len(re.findall(r"^def test_", (code_dir / "service/tests/test_refunds.py").read_text(), re.M))


def replay(base: Path, head: Path, config: dict) -> dict:
    """Same replay as Check 2, but keeps every wrong refund so the website can show them."""
    rules = load_yaml(base / config["rules"])["rules"]
    old_handler = load_handler(base, config["handler"])
    new_handler = load_handler(head, config["handler"])
    refunds = read_refunds(base / config["replay_data"])
    ledger = {row["order_id"]: row["refund_paise"] for row in refunds}
    log = {e["caller"]: e for e in read_gateway_log(base / config["gateway_log"])}
    old_build = {c: request_builder(e, base, config, ledger) for c, e in log.items()}
    new_build = {c: request_builder(e, head, config, ledger) for c, e in log.items()}

    wrong, over, not_sent = [], 0, 0
    for i, row in enumerate(refunds):
        before = send(old_handler, old_build[row["caller"]](row))
        after = send(new_handler, new_build[row["caller"]](row))
        values = {"paid": row["paid_paise"], "refund_asked": row["refund_paise"],
                  "refund_before": before, "refund_out": after}
        broken = after is None or not all(rule_holds(r["check"], values) for r in rules)
        if broken:
            # [row number, masked order, caller, paid, old code sent, new code sends]
            wrong.append([i, mask_order(row["order_id"]), log[row["caller"]]["name"],
                          row["paid_paise"], before, after])
            if after is not None and before is not None:
                over += after - before
            elif before is not None:
                not_sent += before
    return {"replayed": len(refunds), "wrong": wrong, "over_refund_paise": over, "not_sent_paise": not_sent,
            "rules": [{"check": r["check"], "message": r["message"]} for r in rules]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base", required=True, type=Path, help="main (before the change)")
    parser.add_argument("--bad", required=True, type=Path, help="bad-change")
    parser.add_argument("--fix", required=True, type=Path, help="fix")
    parser.add_argument("--results", required=True, type=Path, help="out/local, from demo_local.sh")
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    config = load_config()
    read = lambda version, name: json.loads((args.results / version / name).read_text())

    def version(name: str, old: Path, new: Path, title: str) -> dict:
        audit = read(name, "audit.json")
        return {
            "title": title,
            "commit": str(audit["commit"])[:7],
            "tests": count_tests(new),
            "diff": [d for d in (file_diff(old, new, p) for p in DIFF_FILES) if d],
            "callers": read(name, "callers.json"),
            "money": replay(args.base, new, config),
            "audit": audit,
        }

    data = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "api": config["api_name"],
        "approver_role": config["approver"]["role"],
        "change": {"number": 482, "title": "Refund API: take amount in rupees",
                   "branch": "bad-change", "base": "main"},
        "bad": version("bad-change", args.base, args.bad,
                       "Refund API: take amount in rupees (simpler for app developers)"),
        "fix": version("fix", args.bad, args.fix,
                       "Fix: refund API takes an explicit unit, paise by default"),
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        "// Generated by countersign/site.py from a real demo run. Sample data only.\n"
        "window.COUNTERSIGN = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"Website data written to {args.out} "
          f"({len(data['bad']['money']['wrong'])} wrong refunds of {data['bad']['money']['replayed']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
