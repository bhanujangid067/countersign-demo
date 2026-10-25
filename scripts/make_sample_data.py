"""Make data/refunds_last_week.csv: fake, masked refunds for the replay check.

Run: python scripts/make_sample_data.py
Same seed every time, so the file (and the demo numbers) never change.

Numbers it produces (they must match the pitch):
  4,180 refunds in total
    890 from callers that still send paise (merchant dashboard + partner shopping app)
  3,290 from the mobile app
  The first three refunds from those two callers are the pitch examples:
    ord_••41  paid ₹900.00    refund ₹900.00
    ord_••87  paid ₹1,250.00  refund ₹1,250.00
    ord_••12  paid ₹49.00     refund ₹49.00
"""

import csv
import random
from datetime import date, timedelta
from pathlib import Path

SEED = 2026
TOTAL = 4180
MOBILE = 3290
MERCHANT = 230
PARTNER = 660  # MERCHANT + PARTNER = 890

EXAMPLES = [
    # (order id ending, caller, paid paise, refund paise)
    ("41", "merchant-dashboard", 90000, 90000),
    ("87", "partner-shopping-app", 125000, 125000),
    ("12", "merchant-dashboard", 4900, 4900),
]

OUT = Path(__file__).resolve().parent.parent / "data" / "refunds_last_week.csv"
WEEK_START = date(2026, 10, 18)
LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"


def fake_order_id(rng: random.Random, ending: str | None = None) -> str:
    # The middle part is a random token, not a real order number.
    middle = "".join(rng.choice(LETTERS) for _ in range(6))
    ending = ending or f"{rng.randrange(100):02d}"
    return f"ord_{middle}{ending}"


def fake_refund(rng: random.Random, caller: str) -> dict:
    # Paid amount between ₹49 and ₹25,000, rounded to 50 paise.
    paid = rng.randrange(98, 50001) * 50
    if rng.random() < 0.7:
        refund = paid  # full refund
    else:
        # Partial refund: 10% to 90% of what was paid, rounded to 50 paise.
        refund = max(50, round(paid * rng.uniform(0.1, 0.9) / 50) * 50)
    return {"caller": caller, "paid_paise": paid, "refund_paise": refund}


def main() -> None:
    rng = random.Random(SEED)

    rows = (
        [fake_refund(rng, "mobile-app") for _ in range(MOBILE)]
        + [fake_refund(rng, "merchant-dashboard") for _ in range(MERCHANT - 2)]
        + [fake_refund(rng, "partner-shopping-app") for _ in range(PARTNER - 1)]
    )
    rng.shuffle(rows)
    for row in rows:
        row["order_id"] = fake_order_id(rng)

    # Put the three pitch examples first so they are the examples Countersign shows.
    examples = [
        {"order_id": fake_order_id(rng, end), "caller": caller,
         "paid_paise": paid, "refund_paise": refund}
        for end, caller, paid, refund in EXAMPLES
    ]
    rows = examples + rows
    assert len(rows) == TOTAL

    for i, row in enumerate(rows):
        row["refunded_on"] = (WEEK_START + timedelta(days=i % 7)).isoformat()

    with OUT.open("w", newline="") as f:
        f.write("# SAMPLE DATA. Made up for the Countersign demo: fake, masked refunds from one week.\n")
        f.write("# No real customers, orders or payments. Amounts are in paise (₹1 = 100 paise).\n")
        writer = csv.DictWriter(
            f, fieldnames=["order_id", "caller", "paid_paise", "refund_paise", "refunded_on"]
        )
        writer.writeheader()
        writer.writerows(rows)
    print(f"wrote {len(rows)} refunds to {OUT}")


if __name__ == "__main__":
    main()
