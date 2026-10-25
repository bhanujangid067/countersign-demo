"""Small helpers shared by the Countersign checks."""

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
