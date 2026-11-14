"""Helpers for Countersign's own tests (the sample API's tests live in service/tests)."""

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def run_check(module: str, base: Path, head: Path, out: Path) -> tuple[int, dict]:
    """Run one check the way CI does and return (exit code, its JSON result)."""
    run = subprocess.run(
        [sys.executable, "-m", f"countersign.{module}", "--base", str(base), "--head", str(head), "--out", str(out)],
        cwd=ROOT, capture_output=True, text=True, env={"PATH": "/usr/bin:/bin", "NO_COLOR": "1"},
    )
    assert out.exists(), run.stdout + run.stderr
    return run.returncode, json.loads(out.read_text())


@pytest.fixture
def head(tmp_path):
    """A copy of the code a pull request can change. Tests edit it to make a change."""
    for folder in ("service", "clients"):
        shutil.copytree(ROOT / folder, tmp_path / folder)
    return tmp_path


def change(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    assert old in text, f"{old!r} not found in {path}"
    path.write_text(text.replace(old, new))
