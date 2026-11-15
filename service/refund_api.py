"""Refund API of a made-up payment company (sample code for the Countersign demo).

POST /v1/refunds sends a refund to the bank for an order.

Money is counted in paise: ₹1 = 100 paise, so ₹900.00 is 90000 paise.
"""

# Finance policy: a refund above ₹1,00,000 is not sent automatically. A person reviews it first.
MANUAL_REVIEW_ABOVE_PAISE = 1_00_00_000


def create_refund(request: dict) -> dict:
    """Handle POST /v1/refunds.

    request: {"order_id": "ord_...", "amount": 90000}
      amount: whole number of paise to refund. Above ₹1,00,000 the request is turned away:
              those refunds go through the manual review queue instead.

    Returns the refund instruction that goes to the bank.
    """
    amount = request["amount"]

    if isinstance(amount, bool) or not isinstance(amount, int):
        raise ValueError("amount must be a whole number of paise")
    if amount <= 0:
        raise ValueError("amount must be more than zero")
    if amount > MANUAL_REVIEW_ABOVE_PAISE:
        raise ValueError("refunds above ₹1,00,000 need manual review")

    return {
        "order_id": request["order_id"],
        "refund_paise": amount,
        "status": "sent_to_bank",
    }
