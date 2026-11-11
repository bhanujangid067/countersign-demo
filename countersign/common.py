"""Small helpers shared by the Countersign checks."""

import csv
import importlib.util
import json
import os
import sys
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent


def load_config() -> dict:
    return yaml.safe_load((HERE / "config.yaml").read_text())


def load_yaml(path: Path) -> dict:
    return yaml.safe_load(Path(path).read_text())


def read_gateway_log(path: Path) -> list[dict]:
    """One dict per caller. Skips the line that labels the file as sample data."""
    entries = []
    for line in Path(path).read_text().splitlines():
        if not line.strip():
            continue
        entry = json.loads(line)
        if "_note" not in entry:
            entries.append(entry)
    return entries


def load_handler(repo_dir: Path, target: str):
    """Load e.g. "service/refund_api.py:create_refund" from one branch's copy of the code.

    The base branch and the PR branch each get their own copy, so we can run both side by side.
    """
    file_name, func_name = target.split(":")
    path = Path(repo_dir) / file_name
    module_name = f"_countersign_{abs(hash(str(path.resolve())))}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return getattr(module, func_name)


def read_refunds(path: Path) -> list[dict]:
    """Last week's refunds (the ledger): what was paid and what was refunded, in paise."""
    with Path(path).open() as f:
        lines = [line for line in f if not line.startswith("#")]
    rows = list(csv.DictReader(lines))
    for row in rows:
        row["paid_paise"] = int(row["paid_paise"])
        row["refund_paise"] = int(row["refund_paise"])
    return rows


def unit_sent(requests: list[dict], ledger: dict) -> dict:
    """Work out which unit a caller sends 'amount' in, from its requests alone.

    Each request is matched with the ledger: if the amount equals the paise the bank really
    refunded for that order, the caller sends paise; if it is 100 times smaller, rupees.
    A request that names its unit ("unit": "rupees") is taken at its word.
    Returns {"unit": "paise" | "rupees" | None, "matched": 5, "of": 5, "says_unit": False}.
    """
    votes = {"paise": 0, "rupees": 0}
    says_unit = False
    for request in requests:
        refunded = ledger.get(request.get("order_id"))
        amount = request.get("amount")
        if refunded is None or isinstance(amount, bool) or not isinstance(amount, (int, float)):
            continue
        if request.get("unit") in votes:
            says_unit = True
            votes[request["unit"]] += 1
        elif amount == refunded:
            votes["paise"] += 1
        elif round(amount * 100) == refunded:
            votes["rupees"] += 1
    unit = max(votes, key=votes.get) if any(votes.values()) else None
    return {"unit": unit, "matched": votes[unit] if unit else 0, "of": len(requests), "says_unit": says_unit}


def request_builder(entry: dict, repo_dir: Path, config: dict, ledger: dict):
    """A function that turns one ledger row into the request this caller would send.

    A caller whose code is in the repo: run that code (from repo_dir, so the PR's version counts).
    Any other caller: copy the shape of its recorded requests, in the unit worked out from them.
    """
    target = (config.get("clients_in_repo") or {}).get(entry["caller"])
    if target:
        client = load_handler(repo_dir, target)
        return lambda row: client(row["order_id"], row["refund_paise"])

    seen = unit_sent(entry.get("recent_requests", []), ledger)
    with_unit_field = seen["says_unit"]

    def build(row: dict) -> dict:
        amount = row["refund_paise"]
        if seen["unit"] == "rupees":
            amount = amount / 100
            if amount == int(amount):
                amount = int(amount)
        request = {"order_id": row["order_id"], "amount": amount}
        if with_unit_field:
            request["unit"] = seen["unit"]
        return request
    return build


def write_json(path: Path, data: dict) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def inr(paise: int) -> str:
    """90000 -> "₹900.00"; 12500000 -> "₹1,25,000.00" (Indian digit grouping)."""
    rupees, rest = divmod(int(paise), 100)
    digits = str(rupees)
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        digits = ",".join(groups + [tail])
    return f"₹{digits}.{rest:02d}"


def inr_short(paise: int) -> str:
    """For totals: 9411649830000 -> "₹94.1 crore"; 12500000 -> "₹1.3 lakh"; small amounts as inr()."""
    rupees = int(paise) / 100
    if rupees >= 1e7:
        return f"₹{rupees / 1e7:.1f} crore"
    if rupees >= 1e5:
        return f"₹{rupees / 1e5:.1f} lakh"
    return inr(paise)


def mask_order(order_id: str) -> str:
    """ord_FbXXZg41 -> ord_••41"""
    return f"ord_••{order_id[-2:]}"


def short_count(n: int) -> str:
    """1200000 -> "1.2M", 85000 -> "85k"."""
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}".rstrip("0").rstrip(".") + "M"
    if n >= 1_000:
        return f"{n / 1_000:.0f}k"
    return str(n)


# Terminal colours. Off when output isn't a terminal (e.g. in GitHub logs), unless FORCE_COLOR is set.
_USE_COLOR = (sys.stdout.isatty() or os.environ.get("FORCE_COLOR")) and not os.environ.get("NO_COLOR")
_CODES = {"red": "31", "green": "32", "yellow": "33", "blue": "34", "bold": "1", "dim": "2"}


def paint(text: str, *styles: str) -> str:
    if not _USE_COLOR:
        return text
    codes = ";".join(_CODES[s] for s in styles)
    return f"\033[{codes}m{text}\033[0m"
