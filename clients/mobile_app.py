"""The mobile app's refund call (sample code for the Countersign demo).

The mobile app is the one caller whose code lives in this repo, so a change to the refund API
can update it in the same pull request. Every other app is owned by another team or company.
"""


def refund_request(order_id: str, refund_paise: int) -> dict:
    """The request the mobile app sends to POST /v1/refunds for one refund."""
    return {"order_id": order_id, "amount": refund_paise}
