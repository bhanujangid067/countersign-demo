"""Normal unit tests for the refund API. These are the tests a team already has."""

import pytest

from service.refund_api import create_refund


def test_full_refund_of_900_rupees():
    result = create_refund({"order_id": "ord_test01", "amount": 90000})
    assert result["refund_paise"] == 90000
    assert result["status"] == "sent_to_bank"


def test_small_refund():
    result = create_refund({"order_id": "ord_test02", "amount": 4900})
    assert result["refund_paise"] == 4900


def test_rejects_zero():
    with pytest.raises(ValueError):
        create_refund({"order_id": "ord_test03", "amount": 0})


def test_rejects_text_amount():
    with pytest.raises(ValueError):
        create_refund({"order_id": "ord_test04", "amount": "900"})
