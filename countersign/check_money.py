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
    request_builder, rule_values, write_json,
)

COMPARE = {"<=": operator.le, "<": operator.lt, ">=": operator.ge, ">": operator.gt,
           "==": operator.eq, "!=": operator.ne}
EXAMPLES_TO_SHOW = 3


def send(handler, request: dict, result_amount: str = "refund_paise") -> int | None:
    """Run the handler; return the money it sends (minor unit), or None if it rejected the request."""
    try:
        return handler(request)[result_amount]
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

    config = load_config(args.base)
    money = config["money"]
    noun, nouns, out_field = money["noun"], money["noun"] + "s", money["result_amount"]
    # Rules, replay data and the gateway log come from the base branch, so a PR can't weaken
    # the checks on itself. Only the code under test (the API and in-repo callers) comes from the PR.
    rules = load_yaml(args.base / config["rules"])["rules"]
    old_handler = load_handler(args.base, config["handler"])
    new_handler = load_handler(args.head, config["handler"])
    refunds = read_refunds(args.base / config["replay_data"], money)
    ledger = {row["id"]: row["asked"] for row in refunds}
    log = {e["caller"]: e for e in read_gateway_log(args.base / config["gateway_log"])}
    old_build = {c: request_builder(e, args.base, config, ledger) for c, e in log.items()}
    new_build = {c: request_builder(e, args.head, config, ledger) for c, e in log.items()}

    broken_count = {rule["id"]: 0 for rule in rules}
    rejected = 0
    wrong = []
    for row in refunds:
        before = send(old_handler, old_build[row["caller"]](row), out_field)
        after = send(new_handler, new_build[row["caller"]](row), out_field)
        if after is None:
            if before is not None:
                rejected += 1
                wrong.append({"row": row, "before": before, "after": None,
                              "rule": f"a {noun} that went out before is now turned away"})
            continue
        values = rule_values(row, before, after)
        for rule in rules:
            if not rule_holds(rule["check"], values):
                broken_count[rule["id"]] += 1
                wrong.append({"row": row, "before": before, "after": after, "rule": rule["message"]})
                break

    examples = [{
        "order": mask_order(w["row"]["id"]),
        "caller": log[w["row"]["caller"]]["name"],
        "paid_paise": w["row"]["reference"],
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
        "noun": noun,
        "data": f"{config['replay_data']}{' (' + config['data_label'] + ')' if config.get('data_label') else ''}",
        "data_label": config.get("data_label"),
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
    label = f" ({config['data_label']})" if config.get("data_label") else ""
    print(f"  Re-ran {len(refunds):,} {nouns} from last week{label} through the old and new code")
    if wrong:
        messages = sorted({w["rule"] for w in wrong})
        print(paint(f"  ✗ {len(wrong):,} of {len(refunds):,} {nouns} broke a money rule: {'; '.join(messages)}",
                    "red", "bold"))
        for e in examples:
            if e["after_paise"] is None:
                line = f"paid {inr(e['paid_paise']):>12}  →  turned away"
            elif e["after_paise"] > e["paid_paise"]:
                line = f"paid {inr(e['paid_paise']):>12}  →  {noun} sent {inr(e['after_paise'])}"
            else:  # within what was paid, but not what the old code sent
                line = f"old code sent {inr(e['before_paise']):>12}  →  this change sends {inr(e['after_paise'])}"
            print(paint(f"    {e['order']}  {e['caller']:<22} {line}", "red"))
        if over_refund > 0:
            print(paint(f"  ✗ Together they would send {inr_short(over_refund)} too much", "red", "bold"))
            for name, app in by_caller.items():
                print(paint(f"    {name:<22} {app['wrong']:>5,} {nouns}   {inr_short(app['over_refund_paise'])} too much", "red"))
        if not_sent > 0:
            print(paint(f"  ✗ Together, {inr_short(not_sent)} that went out last week would be turned away", "red", "bold"))
        return 1
    print(paint(f"  ✓ All {len(refunds):,} {nouns} follow the money rules", "green"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
