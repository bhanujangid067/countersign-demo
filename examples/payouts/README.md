# Second example: a payout API

The same Countersign code, pointed at a different API with different field names, catching a
different kind of mistake. Nothing in `countersign/` knows about payouts: everything specific
is in [`before/countersign.yaml`](before/countersign.yaml) and [`before/rules.yaml`](before/rules.yaml).

**The change.** A developer renames the fee setting from basis points (`200`) to percent (`2`),
because finance finds percent easier to read. They forget that the formula still divides by 10,000.
The fee becomes 100 times too small, so every merchant is paid too much. The API itself doesn't
change at all, so an API diff has nothing to look at.

**What Countersign finds.** Run from the repo root:

```bash
python -m countersign.check_callers --base examples/payouts/before --head examples/payouts/after --out out/payouts/callers.json
```

```bash
python -m countersign.check_money --base examples/payouts/before --head examples/payouts/after --out out/payouts/money.json
```

Check 1 passes: no caller breaks. Check 2 replays 400 payouts and stops the change: all 400 come out
different, ₹31.3 lakh too much in one week of sample data. The rule that catches it is
`out == before`: a payout must not change unless someone signs off.

`before/` is the base branch and `after/` is the pull request. The data is made up;
`make_data.py` recreates it.
