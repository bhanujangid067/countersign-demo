"""The demo's own story, end to end: each change gives the numbers the README quotes."""

from conftest import ROOT, change, run_check


def test_an_unchanged_api_is_all_clear(head, tmp_path):
    code, callers = run_check("check_callers", ROOT, head, tmp_path / "callers.json")
    assert callers["passed"] and callers["total"] == 8
    code, money = run_check("check_money", ROOT, head, tmp_path / "money.json")
    assert code == 0 and money["passed"] and money["replayed"] == 4180


def make_rupees_change(head):
    """The bad change: the API reads rupees, and only the mobile app is updated."""
    change(head / "service/refund_api.py", '"refund_paise": amount,', '"refund_paise": round(amount * 100),')
    change(head / "service/refund_api.py", "not isinstance(amount, int)", "not isinstance(amount, (int, float))")
    change(head / "service/openapi.yaml", "description: Amount to refund, in paise (₹1 = 100 paise).\n          x-unit: paise",
           "description: Amount to refund, in rupees (for example 900 or 49.50).\n          x-unit: rupees")
    change(head / "clients/mobile_app.py", '"amount": refund_paise}', '"amount": refund_paise / 100}')


def test_reading_rupees_breaks_the_two_apps_that_still_send_paise(head, tmp_path):
    make_rupees_change(head)
    _, callers = run_check("check_callers", ROOT, head, tmp_path / "callers.json")
    broken = [c["name"] for c in callers["callers"] if c["affected"]]
    assert broken == ["Merchant dashboard", "Partner shopping app"]
    mobile = callers["callers"][0]
    assert mobile["reason"] == "updated to rupees in this change" and "clients/mobile_app.py" in mobile["evidence"]

    code, money = run_check("check_money", ROOT, head, tmp_path / "money.json")
    assert code == 1
    assert (money["wrong"], money["replayed"]) == (890, 4180)
    assert money["over_refund_paise"] == 94116498300  # ₹94.1 crore
    first = money["examples"][0]
    assert (first["paid_paise"], first["after_paise"]) == (90000, 9000000)  # ₹900 -> ₹90,000


def test_a_new_limit_turns_away_seven_big_refunds(head, tmp_path):
    change(head / "service/refund_api.py", '    return {', '    if amount > 10000000:\n        raise ValueError("needs manual review")\n\n    return {')
    change(head / "service/openapi.yaml", "          x-unit: paise", "          maximum: 10000000\n          x-unit: paise")
    _, callers = run_check("check_callers", ROOT, head, tmp_path / "callers.json")
    assert [c["name"] for c in callers["callers"] if c["affected"]] == ["Mobile app"]
    code, money = run_check("check_money", ROOT, head, tmp_path / "money.json")
    assert code == 1 and (money["wrong"], money["rejected"]) == (7, 7)
    assert money["not_sent_paise"] == 100000000  # ₹10.0 lakh


def test_a_pull_request_cannot_edit_the_evidence(head, tmp_path):
    """The gateway log and replay data are read from the base branch, never from the PR."""
    make_rupees_change(head)
    (head / "data").mkdir()
    (head / "data/gateway_log.jsonl").write_text("")          # the PR empties the log
    (head / "data/refunds_last_week.csv").write_text("order_id,caller,paid_paise,refund_paise\n")
    code, money = run_check("check_money", ROOT, head, tmp_path / "money.json")
    assert code == 1 and money["wrong"] == 890
