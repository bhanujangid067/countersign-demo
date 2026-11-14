"""Make the sample data: data/refunds_last_week.csv (fake, masked refunds for the replay check)
and data/gateway_log.jsonl (one day of gateway traffic, with a few recorded requests per app).

Run: python scripts/make_sample_data.py
Same seed every time, so the file (and the demo numbers) never change.

Numbers it produces (the README, website and video quote them):
  4,180 refunds in total
    890 from callers that still send paise (merchant dashboard + partner shopping app)
  3,290 from the mobile app
  The first three refunds from those two callers are the examples shown everywhere:
    ord_••41  paid ₹900.00    refund ₹900.00
    ord_••87  paid ₹1,250.00  refund ₹1,250.00
    ord_••12  paid ₹49.00     refund ₹49.00
  7 big refunds from the mobile app, each above ₹1,00,000 (phones, laptops): ₹10.0 lakh together.
    They are what the "manual review" change turns away.
"""

import csv
import json
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

# Paid amounts (paise) of the big mobile-app refunds. All refunded in full.
BIG_REFUNDS = [10499900, 11999000, 12490000, 13999900, 15499000, 16990000, 18522200]

# Who calls the refund API. Apps that send refunds get a few recorded requests added below.
# There are no unit labels here: Countersign works out paise or rupees from the requests themselves.
CALLERS = [
    {"caller": "mobile-app", "name": "Mobile app", "method": "POST", "path": "/v1/refunds", "calls_per_day": 1200000},
    {"caller": "merchant-dashboard", "name": "Merchant dashboard", "method": "POST", "path": "/v1/refunds", "calls_per_day": 85000},
    {"caller": "partner-shopping-app", "name": "Partner shopping app", "method": "POST", "path": "/v1/refunds", "calls_per_day": 240000},
    {"caller": "accounting-service", "name": "Accounting service", "method": "GET", "path": "/v1/refunds/{refund_id}", "fields_read": ["status"], "calls_per_day": 30000},
    {"caller": "upi-switch", "name": "UPI switch", "method": "POST", "path": "/v1/refunds/{refund_id}/status", "fields_sent": ["upi_status"], "calls_per_day": 900000},
    {"caller": "partner-bank", "name": "Partner bank", "method": "POST", "path": "/v1/refunds/{refund_id}/confirm", "fields_sent": ["bank_ref"], "calls_per_day": 400000},
    {"caller": "support-tool", "name": "Support tool", "method": "GET", "path": "/v1/refunds/{refund_id}", "fields_read": ["status"], "calls_per_day": 12000},
    {"caller": "fraud-checks", "name": "Fraud checks", "method": "GET", "path": "/v1/refunds/{refund_id}", "fields_read": ["order_id"], "calls_per_day": 1100000},
]
RECORDED_PER_CALLER = 5

OUT = Path(__file__).resolve().parent.parent / "data" / "refunds_last_week.csv"
LOG_OUT = OUT.parent / "gateway_log.jsonl"
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

    # Put the three examples first so they are the examples Countersign shows.
    examples = [
        {"order_id": fake_order_id(rng, end), "caller": caller,
         "paid_paise": paid, "refund_paise": refund}
        for end, caller, paid, refund in EXAMPLES
    ]
    rows = examples + rows
    assert len(rows) == TOTAL

    # Make a few mobile-app refunds big ones. A separate random source, so every other row
    # stays exactly as it was.
    big_rng = random.Random(SEED + 1)
    mobile_rows = [row for row in rows[len(EXAMPLES):] if row["caller"] == "mobile-app"]
    for row, paid in zip(big_rng.sample(mobile_rows, len(BIG_REFUNDS)), BIG_REFUNDS):
        row["paid_paise"] = row["refund_paise"] = paid

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

    # The gateway log: each app that sends refunds gets its first few requests of the week,
    # recorded as they arrived (every one of these apps sent plain paise last week).
    with LOG_OUT.open("w") as f:
        f.write(json.dumps({"_note": "SAMPLE DATA. Made up for the Countersign demo. One day of API gateway "
                            "traffic to the refund API, summed per caller, with a few recorded requests "
                            "per app. Calls per day are illustrative."}) + "\n")
        for caller in CALLERS:
            entry = dict(caller)
            if entry["path"] == "/v1/refunds":
                mine = [row for row in rows if row["caller"] == entry["caller"]][:RECORDED_PER_CALLER]
                entry["recent_requests"] = [{"order_id": row["order_id"], "amount": row["refund_paise"]} for row in mine]
            f.write(json.dumps(entry) + "\n")
    print(f"wrote {len(CALLERS)} callers to {LOG_OUT}")


if __name__ == "__main__":
    main()
