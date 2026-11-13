"""Check 2: is the money right?

Replays last week's refunds (masked sample data) through the old code and the new code,
building each request the way that caller really sends it, then checks the money rules.
A caller whose code is in this repo is run from the PR; every other caller is rebuilt from
its recorded requests in the gateway log.
Exits with 1 if any rule is broken, so the GitHub check fails.

Usage: python -m countersign.check_money --base <old code dir> --head <new code dir> --out out/money.json
"""

import argparse
import operator
import sys
from pathlib import Path

from countersign.common import (
    inr, inr_short, load_config, load_handler, load_yaml, mask_order, paint, read_gateway_log, read_refunds,
    request_builder, write_json,
)

COMPARE = {"<=": operator.le, "<": operator.lt, ">=": operator.ge, ">": operator.gt,
           "==": operator.eq, "!=": operator.ne}
EXAMPLES_TO_SHOW = 3


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
    # Rules, replay data and the gateway log come from the base branch, so a PR can't weaken
    # the checks on itself. Only the code under test (the API and in-repo callers) comes from the PR.
    rules = load_yaml(args.base / config["rules"])["rules"]
    old_handler = load_handler(args.base, config["handler"])
    new_handler = load_handler(args.head, config["handler"])
    refunds = read_refunds(args.base / config["replay_data"])
    ledger = {row["order_id"]: row["refund_paise"] for row in refunds}
    log = {e["caller"]: e for e in read_gateway_log(args.base / config["gateway_log"])}
    old_build = {c: request_builder(e, args.base, config, ledger) for c, e in log.items()}
    new_build = {c: request_builder(e, args.head, config, ledger) for c, e in log.items()}

    broken_count = {rule["id"]: 0 for rule in rules}
    rejected = 0
    wrong = []
    for row in refunds:
        before = send(old_handler, old_build[row["caller"]](row))
        after = send(new_handler, new_build[row["caller"]](row))
        if after is None:
            if before is not None:
                rejected += 1
                wrong.append({"row": row, "before": before, "after": None,
                              "rule": "a refund that went out before is now turned away"})
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
        "caller": log[w["row"]["caller"]]["name"],
        "paid_paise": w["row"]["paid_paise"],
        "before_paise": w["before"],
        "after_paise": w["after"],
        "rule": w["rule"],
    } for w in wrong[:EXAMPLES_TO_SHOW]]

    # How much money the wrong refunds move, in total and per app: extra money sent, and
    # money that went out before but would now be turned away.
    over_refund = not_sent = 0
    by_caller = {}
    for w in wrong:
        extra = w["after"] - w["before"] if w["after"] is not None and w["before"] is not None else 0
        held = w["before"] if w["after"] is None else 0
        over_refund += extra
        not_sent += held
        app = by_caller.setdefault(log[w["row"]["caller"]]["name"],
                                   {"wrong": 0, "over_refund_paise": 0, "not_sent_paise": 0})
        app["wrong"] += 1
        app["over_refund_paise"] += extra
        app["not_sent_paise"] += held

    result = {
        "check": "is-the-money-right",
        "data": f"{config['replay_data']} (sample data)",
        "replayed": len(refunds),
        "wrong": len(wrong),
        "rejected": rejected,
        "over_refund_paise": over_refund,
        "not_sent_paise": not_sent,
        "by_caller": by_caller,
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
            after = f"refund sent {inr(e['after_paise'])}" if e["after_paise"] is not None else "turned away"
            print(paint(f"    {e['order']}  {e['caller']:<22} paid {inr(e['paid_paise']):>12}  →  {after}", "red"))
        if over_refund > 0:
            print(paint(f"  ✗ Together they would send {inr_short(over_refund)} too much", "red", "bold"))
            for name, app in by_caller.items():
                print(paint(f"    {name:<22} {app['wrong']:>5,} refunds   {inr_short(app['over_refund_paise'])} too much", "red"))
        if not_sent > 0:
            print(paint(f"  ✗ Together, {inr_short(not_sent)} that went out last week would be turned away", "red", "bold"))
        return 1
    print(paint(f"  ✓ All {len(refunds):,} refunds follow the money rules", "green"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
