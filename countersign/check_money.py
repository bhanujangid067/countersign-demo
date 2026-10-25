"""Check 2: is the money right?

Replays last week's refunds (masked sample data) through the old code and the new code,
building each request the way that caller really sends it, then checks the money rules.
Exits with 1 if any rule is broken, so the GitHub check fails.

Usage: python -m countersign.check_money --base <old code dir> --head <new code dir> --out out/money.json
"""

import argparse
import csv
import operator
import sys
from pathlib import Path

from countersign.common import (
    inr, load_config, load_handler, load_yaml, mask_order, paint, read_gateway_log, write_json,
)

COMPARE = {"<=": operator.le, "<": operator.lt, ">=": operator.ge, ">": operator.gt,
           "==": operator.eq, "!=": operator.ne}
EXAMPLES_TO_SHOW = 3


def read_refunds(path: Path) -> list[dict]:
    with Path(path).open() as f:
        lines = [line for line in f if not line.startswith("#")]
    rows = list(csv.DictReader(lines))
    for row in rows:
        row["paid_paise"] = int(row["paid_paise"])
        row["refund_paise"] = int(row["refund_paise"])
    return rows


def build_request(row: dict, entry: dict) -> dict:
    """The refund request this caller would send for this row."""
    unit = entry["units"]["amount"]
    if unit == "paise":
        amount = row["refund_paise"]
    else:
        amount = row["refund_paise"] / 100
        if amount == int(amount):
            amount = int(amount)
    request = {"order_id": row["order_id"], "amount": amount}
    if "unit" in entry["fields_sent"]:
        request["unit"] = unit
    return request


def send(handler, request: dict) -> int | None:
    """Run the handler; return paise sent to the bank, or None if it rejected the request."""
    try:
        return handler(request)["refund_paise"]
    except (ValueError, KeyError, TypeError):
        return None


def rule_holds(check: str, values: dict) -> bool:
    left, compare, right = check.split()
    value = lambda token: values[token] if token in values else float(token)
    return COMPARE[compare](value(left), value(right))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base", required=True, type=Path, help="folder with the old code (base branch)")
    parser.add_argument("--head", required=True, type=Path, help="folder with the new code (PR branch)")
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    config = load_config()
    # Rules and replay data come from the base branch, so a PR can't weaken the checks on itself.
    # The gateway log comes from the PR branch, because it shows callers updated in this change.
    rules = load_yaml(args.base / config["rules"])["rules"]
    old_handler = load_handler(args.base, config["handler"])
    new_handler = load_handler(args.head, config["handler"])
    old_log = {e["caller"]: e for e in read_gateway_log(args.base / config["gateway_log"])}
    new_log = {e["caller"]: e for e in read_gateway_log(args.head / config["gateway_log"])}
    refunds = read_refunds(args.base / config["replay_data"])

    broken_count = {rule["id"]: 0 for rule in rules}
    rejected = 0
    wrong = []
    for row in refunds:
        before = send(old_handler, build_request(row, old_log[row["caller"]]))
        after = send(new_handler, build_request(row, new_log[row["caller"]]))
        if after is None:
            if before is not None:
                rejected += 1
                wrong.append({"row": row, "before": before, "after": None,
                              "rule": "refund that worked before is now rejected"})
            continue
        values = {"paid": row["paid_paise"], "refund_asked": row["refund_paise"],
                  "refund_before": before, "refund_out": after}
        for rule in rules:
            if not rule_holds(rule["check"], values):
                broken_count[rule["id"]] += 1
                wrong.append({"row": row, "before": before, "after": after, "rule": rule["message"]})
                break

    examples = [{
        "order": mask_order(w["row"]["order_id"]),
        "caller": new_log[w["row"]["caller"]]["name"],
        "paid_paise": w["row"]["paid_paise"],
        "before_paise": w["before"],
        "after_paise": w["after"],
        "rule": w["rule"],
    } for w in wrong[:EXAMPLES_TO_SHOW]]

    result = {
        "check": "is-the-money-right",
        "data": f"{config['replay_data']} (sample data)",
        "replayed": len(refunds),
        "wrong": len(wrong),
        "rejected": rejected,
        "rules": [{"id": r["id"], "check": r["check"], "message": r["message"], "broken": broken_count[r["id"]]}
                  for r in rules],
        "examples": examples,
        "passed": not wrong,
    }
    write_json(args.out, result)

    print(paint("Check 2 · Is the money right?", "bold"))
    print(f"  Re-ran {len(refunds):,} refunds from last week (sample data) through the old and new code")
    if wrong:
        messages = sorted({w["rule"] for w in wrong})
        print(paint(f"  ✗ {len(wrong):,} of {len(refunds):,} refunds broke a money rule: {'; '.join(messages)}",
                    "red", "bold"))
        for e in examples:
            after = inr(e["after_paise"]) if e["after_paise"] is not None else "rejected"
            print(paint(f"    {e['order']}  {e['caller']:<22} paid {inr(e['paid_paise']):>12}  →  refund sent {after}",
                        "red"))
        return 1
    print(paint(f"  ✓ All {len(refunds):,} refunds follow the money rules", "green"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
