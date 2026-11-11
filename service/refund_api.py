"""Refund API of a made-up payment company (sample code for the Countersign demo).

POST /v1/refunds sends a refund to the bank for an order.

Money is counted in paise: ₹1 = 100 paise, so ₹900.00 is 90000 paise.
"""


def create_refund(request: dict) -> dict:
    """Handle POST /v1/refunds.

    request: {"order_id": "ord_...", "amount": 900}
      amount: rupees to refund, e.g. 900 or 49.50. Easier for app developers.

    Returns the refund instruction that goes to the bank.
    """
    amount = request["amount"]

    if isinstance(amount, bool) or not isinstance(amount, (int, float)):
        raise ValueError("amount must be a number of rupees")
    if amount <= 0:
        raise ValueError("amount must be more than zero")

    return {
        "order_id": request["order_id"],
        "refund_paise": round(amount * 100),
        "status": "sent_to_bank",
    }
