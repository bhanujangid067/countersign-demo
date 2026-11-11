"""Refund API of a made-up payment company (sample code for the Countersign demo).

POST /v1/refunds sends a refund to the bank for an order.

Money is counted in paise: ₹1 = 100 paise, so ₹900.00 is 90000 paise.
"""

PAISE_PER = {"paise": 1, "rupees": 100}


def create_refund(request: dict) -> dict:
    """Handle POST /v1/refunds.

    request: {"order_id": "ord_...", "amount": 90000}                  amount in paise (default)
         or: {"order_id": "ord_...", "amount": 900, "unit": "rupees"}  amount in rupees

    Callers that don't send "unit" keep working exactly as before.
    Returns the refund instruction that goes to the bank.
    """
    amount = request["amount"]
    unit = request.get("unit", "paise")

    if unit not in PAISE_PER:
        raise ValueError('unit must be "paise" or "rupees"')
    if isinstance(amount, bool) or not isinstance(amount, (int, float)):
        raise ValueError("amount must be a number")
    if unit == "paise" and not isinstance(amount, int):
        raise ValueError("amount in paise must be a whole number")
    if amount <= 0:
        raise ValueError("amount must be more than zero")

    return {
        "order_id": request["order_id"],
        "refund_paise": round(amount * PAISE_PER[unit]),
        "status": "sent_to_bank",
    }
