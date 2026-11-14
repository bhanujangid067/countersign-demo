"""Payout API of a made-up payment company (a second sample for Countersign).

POST /v1/payouts pays a merchant what their customers paid, minus the company's fee.
Money is counted in paise: ₹1 = 100 paise.
"""

FEE_BASIS_POINTS = 200  # 2%. One basis point is a hundredth of a percent.


def create_payout(request: dict) -> dict:
    """Handle POST /v1/payouts.

    request: {"settlement_id": "stl_...", "gross": 1250000}
      gross: what the merchant's customers paid, in paise.
    """
    gross = request["gross"]
    if isinstance(gross, bool) or not isinstance(gross, int) or gross <= 0:
        raise ValueError("gross must be a whole number of paise, more than zero")

    fee = gross * FEE_BASIS_POINTS // 10000
    return {
        "settlement_id": request["settlement_id"],
        "fee_paise": fee,
        "payout_paise": gross - fee,
        "status": "sent_to_bank",
    }
