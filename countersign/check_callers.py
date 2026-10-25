"""Check 1: who will break?

1. Format check: run oasdiff on the old and new API spec. It catches format changes
   (a field removed, a type narrowed), but not a change in what a number *means*.
2. Meaning check: compare each request field's unit and description ourselves.
3. Cross the changed fields with the gateway log: any caller that sends a changed field,
   in a unit the new API will read differently, will break.

Usage: python -m countersign.check_callers --base <old code dir> --head <new code dir> --out out/callers.json
"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from countersign.common import load_config, load_yaml, paint, read_gateway_log, short_count, write_json

METHODS = ("get", "post", "put", "patch", "delete")


def resolve(spec: dict, schema: dict) -> dict:
    """Follow a '#/components/schemas/Name' reference."""
    ref = schema.get("$ref")
    if not ref:
        return schema
    node = spec
    for part in ref.lstrip("#/").split("/"):
        node = node[part]
    return node


def request_fields(spec: dict) -> dict:
    """{("POST", "/v1/refunds"): {"amount": {...schema...}, ...}, ...}"""
    found = {}
    for path, item in spec.get("paths", {}).items():
        for method in METHODS:
            op = item.get(method)
            if not op or "requestBody" not in op:
                continue
            body = op["requestBody"]["content"]["application/json"]["schema"]
            found[(method.upper(), path)] = resolve(spec, body).get("properties", {})
    return found


def unit_of(field: dict) -> str | None:
    """The unit a field is counted in: our x-unit tag, or a guess from its description."""
    if field.get("x-unit"):
        return field["x-unit"]
    text = (field.get("description") or "").lower()
    for unit in ("paise", "rupees"):
        if unit in text:
            return unit
    return None


def changed_fields(base: dict, head: dict) -> list[dict]:
    """Request fields whose type, unit or description differ between the two specs."""
    changes = []
    head_ops = request_fields(head)
    for op, base_props in request_fields(base).items():
        head_props = head_ops.get(op, {})
        for name, old in base_props.items():
            new = head_props.get(name)
            if new is None:
                continue
            diffs = {}
            for what, before, after in (
                ("type", old.get("type"), new.get("type")),
                ("unit", unit_of(old), unit_of(new)),
                ("description", old.get("description"), new.get("description")),
            ):
                if before != after:
                    diffs[what] = {"before": before, "after": after}
            if diffs:
                changes.append({"method": op[0], "path": op[1], "field": name, "changes": diffs})
    return changes


def unit_api_reads(field: dict, entry: dict, name: str) -> str | None:
    """Which unit the API will read this caller's field in.

    If the field has an 'x-unit-field' (e.g. a separate "unit" field) and the caller sends it,
    the API reads whatever unit the caller says. Otherwise it reads the field's default unit.
    """
    override = field.get("x-unit-field")
    if override and override in entry.get("fields_sent", []):
        return entry["units"][name]
    return unit_of(field)


def format_check(base_spec: Path, head_spec: Path) -> dict:
    """Ask oasdiff (free, open source) whether the change is 'breaking' by format rules."""
    if not shutil.which("oasdiff"):
        return {"tool": None, "note": "oasdiff not installed; skipped"}
    version = subprocess.run(["oasdiff", "--version"], capture_output=True, text=True).stdout.strip()
    run = subprocess.run(
        ["oasdiff", "breaking", str(base_spec), str(head_spec), "--format", "json"],
        capture_output=True, text=True,
    )
    if run.returncode != 0:
        return {"tool": version, "note": f"oasdiff failed: {run.stderr.strip()[:200]}"}
    found = json.loads(run.stdout or "[]") or []
    return {"tool": version, "breaking": len(found), "items": [c.get("text", "") for c in found]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base", required=True, type=Path, help="folder with the old code (base branch)")
    parser.add_argument("--head", required=True, type=Path, help="folder with the new code (PR branch)")
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    config = load_config()
    base_spec, head_spec = args.base / config["spec"], args.head / config["spec"]
    base, head = load_yaml(base_spec), load_yaml(head_spec)
    head_ops = request_fields(head)
    base_ops = request_fields(base)

    changes = changed_fields(base, head)
    old_log = {e["caller"]: e for e in read_gateway_log(args.base / config["gateway_log"])}
    new_log = read_gateway_log(args.head / config["gateway_log"])

    callers = []
    for entry in new_log:
        op = (entry["method"], entry["path"])
        uses = [c["field"] for c in changes
                if (c["method"], c["path"]) == op and c["field"] in entry.get("fields_sent", [])]
        affected, reason = False, ""
        if not uses:
            if entry.get("fields_read"):
                reason = "reads " + ", ".join(entry["fields_read"]) + " only"
            else:
                reason = "doesn't use the changed field"
        for name in uses:
            sends = entry["units"][name]
            reads = unit_api_reads(head_ops[op][name], entry, name)
            if sends != reads:
                affected = True
                reason = f"sends {name} in {sends}, new code reads {reads}"
                break
            old = old_log.get(entry["caller"])
            was = old and unit_api_reads(base_ops[op][name], old, name)
            if old and (old.get("units") != entry.get("units") or old.get("fields_sent") != entry.get("fields_sent")):
                reason = f"updated to {sends} in this change"
            elif was == reads:
                reason = "works as before"
        callers.append({
            "caller": entry["caller"], "name": entry["name"], "calls_per_day": entry["calls_per_day"],
            "affected": affected, "reason": reason,
        })

    broken = [c for c in callers if c["affected"]]
    result = {
        "check": "who-will-break",
        "api": config["api_name"],
        "format_check": format_check(base_spec, head_spec),
        "changed_fields": changes,
        "callers": callers,
        "total": len(callers),
        "affected": len(broken),
        "passed": not broken,
    }
    write_json(args.out, result)

    # What the person running it sees.
    print(paint("Check 1 · Who will break?", "bold"))
    fc = result["format_check"]
    if fc.get("tool"):
        verdict = "no breaking changes found" if fc.get("breaking") == 0 else f"{fc.get('breaking', '?')} breaking change(s)"
        print(f"  Format check ({fc['tool']}): {verdict}")
    for c in changes:
        parts = [f"{k} {v['before']} → {v['after']}" for k, v in c["changes"].items() if k != "description"]
        print(f"  Changed: {c['field']} in {c['method']} {c['path']}" + (f" ({', '.join(parts)})" if parts else ""))
    if not changes:
        print("  No request fields changed meaning")
    if broken:
        print(paint(f"  ⚠ {len(broken)} of {len(callers)} callers will break:", "yellow", "bold"))
        for c in broken:
            print(paint(f"    ✗ {c['name']:<22} {short_count(c['calls_per_day']):>5} calls/day   {c['reason']}", "yellow"))
    else:
        print(paint(f"  ✓ None of the {len(callers)} callers break", "green"))
    for c in callers:
        if not c["affected"]:
            print(paint(f"    · {c['name']:<22} {short_count(c['calls_per_day']):>5} calls/day   {c['reason']}", "dim"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
