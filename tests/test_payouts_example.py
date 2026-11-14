"""The same Countersign code on a second API with different field names and a different bug."""

from conftest import ROOT, run_check

BEFORE, AFTER = ROOT / "examples/payouts/before", ROOT / "examples/payouts/after"


def test_a_fee_bug_with_no_api_change_is_caught_by_the_replay(tmp_path):
    _, callers = run_check("check_callers", BEFORE, AFTER, tmp_path / "callers.json")
    assert callers["passed"] and callers["changed_fields"] == []  # nothing for an API diff to see

    code, money = run_check("check_money", BEFORE, AFTER, tmp_path / "money.json")
    assert code == 1 and money["noun"] == "payout"
    assert (money["wrong"], money["replayed"]) == (400, 400)
    broken = {rule["id"]: rule["broken"] for rule in money["rules"]}
    assert broken == {"payout-not-more-than-collected": 0, "payout-unchanged": 400}
    assert money["over_refund_paise"] > 0


def test_the_payout_api_against_itself_is_all_clear(tmp_path):
    code, money = run_check("check_money", BEFORE, BEFORE, tmp_path / "money.json")
    assert code == 0 and money["passed"]
