"""Make the payout sample data. Same seed every time. Run: python examples/payouts/make_data.py"""

import csv
import json
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent / "before" / "data"
CALLERS = [("settlement-job", "Nightly settlement job", 380, 52000), ("ops-console", "Ops console", 20, 300)]

rng = random.Random(7)
letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
rows = []
for caller, _, count, _ in CALLERS:
    for _ in range(count):
        token = "".join(rng.choice(letters) for _ in range(6)) + f"{rng.randrange(100):02d}"
        # A settlement between ₹5,000 and ₹8,00,000, in whole rupees.
        rows.append({"settlement_id": f"stl_{token}", "caller": caller, "gross_paise": rng.randrange(5000, 800001) * 100})
rng.shuffle(rows)

with (HERE / "payouts_last_week.csv").open("w", newline="") as f:
    f.write("# SAMPLE DATA. Made up: fake settlements from one week. Amounts are in paise (₹1 = 100 paise).\n")
    writer = csv.DictWriter(f, fieldnames=["settlement_id", "caller", "gross_paise"])
    writer.writeheader()
    writer.writerows(rows)

with (HERE / "gateway_log.jsonl").open("w") as f:
    f.write(json.dumps({"_note": "SAMPLE DATA. Made up. Gateway traffic to the payout API, per caller."}) + "\n")
    for caller, name, _, per_day in CALLERS:
        mine = [row for row in rows if row["caller"] == caller][:5]
        f.write(json.dumps({"caller": caller, "name": name, "method": "POST", "path": "/v1/payouts",
                            "calls_per_day": per_day,
                            "recent_requests": [{"settlement_id": r["settlement_id"], "gross": r["gross_paise"]} for r in mine]}) + "\n")
print(f"wrote {len(rows)} payouts")
