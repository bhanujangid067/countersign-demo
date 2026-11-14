"""The small pieces: unit detection, money rules, formatting, the verdict."""

from countersign.check_money import rule_holds
from countersign.common import inr, inr_short, mask_order, rule_values, unit_sent
from countersign.report import comment, decide

LEDGER = {"ord_a": 90000, "ord_b": 4950, "ord_c": 125000}


def test_amounts_equal_to_the_ledger_mean_paise():
    seen = unit_sent([{"order_id": "ord_a", "amount": 90000}, {"order_id": "ord_b", "amount": 4950}], LEDGER)
    assert seen == {"unit": "paise", "matched": 2, "of": 2, "says_unit": False}


def test_amounts_100_times_smaller_mean_rupees():
    seen = unit_sent([{"order_id": "ord_a", "amount": 900}, {"order_id": "ord_b", "amount": 49.5}], LEDGER)
    assert seen["unit"] == "rupees" and seen["matched"] == 2


def test_a_request_that_names_its_unit_is_believed():
    seen = unit_sent([{"order_id": "ord_a", "amount": 900, "unit": "rupees"}], LEDGER)
    assert seen["unit"] == "rupees" and seen["says_unit"]


def test_requests_that_match_nothing_give_no_unit():
    seen = unit_sent([{"order_id": "ord_zzz", "amount": 1}, {"order_id": "ord_a", "amount": 7}], LEDGER)
    assert seen["unit"] is None and seen["matched"] == 0


def test_unit_detection_follows_configured_field_names():
    money = {"request_id": "settlement_id", "request_amount": "gross", "request_unit": "unit",
             "minor_unit": "cents", "major_unit": "dollars", "minor_per_major": 100}
    seen = unit_sent([{"settlement_id": "s1", "gross": 12.5}], {"s1": 1250}, money)
    assert seen["unit"] == "dollars"


def test_money_rules():
    row = {"reference": 90000, "asked": 90000}
    assert rule_holds("refund_out <= paid", rule_values(row, 90000, 90000))
    assert not rule_holds("refund_out <= paid", rule_values(row, 90000, 9000000))
    assert not rule_holds("out == before", rule_values(row, 90000, 90050))
    assert rule_holds("out >= 100", rule_values(row, 90000, 90000))


def test_indian_money_formatting():
    assert inr(90000) == "₹900.00"
    assert inr(12500000) == "₹1,25,000.00"
    assert inr_short(94116498300) == "₹94.1 crore"
    assert inr_short(100000000) == "₹10.0 lakh"
    assert inr_short(4900) == "₹49.00"


def test_ids_are_masked():
    assert mask_order("ord_FbXXZg41") == "ord_••41"
    assert mask_order("stl_abc12") == "stl_••12"
    assert mask_order("12345") == "••45"


CALLERS = {"api": "refund-api", "passed": False, "total": 1, "changed_fields": [], "format_check": {},
           "callers": [{"name": "Mobile app", "calls_per_day": 10, "affected": True, "reason": "r"}]}
MONEY = {"passed": False, "replayed": 10, "wrong": 1, "not_sent_paise": 500, "by_caller": {},
         "examples": [{"order": "ord_••01", "caller": "Mobile app", "paid_paise": 500, "before_paise": 500,
                       "after_paise": None, "rule": "a refund that went out before is now turned away"}]}


def test_a_risky_change_is_stopped_until_someone_approves():
    clear = ({**CALLERS, "passed": True}, {**MONEY, "passed": True})
    assert decide(*clear, None) == "all clear"
    assert decide(CALLERS, MONEY, None) == "stopped"
    assert decide(CALLERS, MONEY, {"login": "lead"}) == "approved"


def test_the_approvers_reason_is_in_the_comment():
    approval = {"login": "lead", "submitted_at": "2026-11-14T10:00:00Z", "reason": "Intended. Finance asked."}
    text = comment("approved", CALLERS, MONEY, approval, "payments lead", "lead", "cs-1")
    assert "Reason given: “Intended. Finance asked.”" in text
    assert "turned away" in text
