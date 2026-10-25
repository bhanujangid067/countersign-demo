"""A one-page HTML dashboard built from Countersign's results (matches the report's mock-up).

Reads the same files the PR comment is built from (callers.json, money.json, audit.json)
and writes a single self-contained HTML page. No internet needed to open it.

Usage: python -m countersign.dashboard --results out/local/bad-change --out out/local/dashboard.html
         [--change-number 482] [--title "Refund API: take amount in rupees"]
"""

import argparse
import html
import json
import sys
from pathlib import Path

from countersign.common import inr, load_config, short_count

# Other APIs shown in the "Protected APIs" list. Sample entries only: this demo checks refund-api.
OTHER_APIS = [("payments-api", "No open changes"), ("payouts-api", "No open changes")]

STATUS = {
    "stopped": ("Stopped", "bad", "Can't go live until it's fixed or the payments lead approves."),
    "approved": ("Approved", "good", "The payments lead approved the risk. Safe to merge."),
    "all clear": ("All clear", "good", "Every check passed. Safe to go live."),
}

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Countersign Dashboard</title>
<style>
:root {{
  --bg: #f6f7f9; --panel: #ffffff; --ink: #14171c; --muted: #5d6673; --line: #e3e6ea;
  --bad: #c9302c; --bad-soft: #fdecea; --warn: #9a6200; --warn-soft: #fff4dd;
  --good: #1f7a3a; --good-soft: #e6f4ea; --accent: #2457c5; --chip: #eef1f5;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    --bg: #0d1117; --panel: #161b22; --ink: #e6edf3; --muted: #8b949e; --line: #2a313b;
    --bad: #f85149; --bad-soft: #2d1416; --warn: #d29922; --warn-soft: #2b2212;
    --good: #3fb950; --good-soft: #12261a; --accent: #6ea8fe; --chip: #21262d;
  }}
}}
:root[data-theme="dark"] {{
  --bg: #0d1117; --panel: #161b22; --ink: #e6edf3; --muted: #8b949e; --line: #2a313b;
  --bad: #f85149; --bad-soft: #2d1416; --warn: #d29922; --warn-soft: #2b2212;
  --good: #3fb950; --good-soft: #12261a; --accent: #6ea8fe; --chip: #21262d;
}}
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: var(--bg); color: var(--ink);
  font: 15px/1.5 -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif; }}
.top {{ display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 24px; background: var(--panel); border-bottom: 1px solid var(--line); }}
.brand {{ font-weight: 700; letter-spacing: .01em; }}
.brand small {{ font-weight: 400; color: var(--muted); margin-left: 8px; }}
.tag {{ font-size: 12px; color: var(--muted); background: var(--chip); padding: 3px 8px; border-radius: 999px; }}
.layout {{ display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 24px; max-width: 1180px; margin: 24px auto; padding: 0 24px; }}
.layout > * {{ min-width: 0; }}
nav h2, .section h2 {{ font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 0 0 10px; }}
.api {{ display: block; padding: 10px 12px; border-radius: 8px; border: 1px solid transparent; margin-bottom: 6px; }}
.api.active {{ background: var(--panel); border-color: var(--line); }}
.api b {{ display: block; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; }}
.api span {{ font-size: 13px; color: var(--muted); }}
.api span.bad {{ color: var(--bad); font-weight: 600; }}
.change {{ background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 20px 22px; }}
.change-head {{ display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }}
.change-head h1 {{ font-size: 22px; margin: 0; }}
.change-head h1 .num {{ color: var(--muted); font-weight: 400; }}
.pill {{ font-weight: 700; font-size: 13px; padding: 4px 12px; border-radius: 999px; }}
.pill.bad {{ background: var(--bad-soft); color: var(--bad); }}
.pill.good {{ background: var(--good-soft); color: var(--good); }}
.change p.sub {{ margin: 8px 0 0; color: var(--muted); }}
.cards {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 18px; }}
.card {{ background: var(--panel); border: 1px solid var(--line); border-top: 4px solid var(--line); border-radius: 12px; padding: 16px 18px; display: flex; flex-direction: column; }}
.card.bad {{ border-top-color: var(--bad); }}
.card.warn {{ border-top-color: var(--warn); }}
.card.good {{ border-top-color: var(--good); }}
.card .q {{ font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }}
.card .big {{ font-size: 26px; font-weight: 700; margin: 6px 0 2px; }}
.card.bad .big {{ color: var(--bad); }}
.card.warn .big {{ color: var(--warn); }}
.card.good .big {{ color: var(--good); }}
.card p {{ margin: 6px 0 0; color: var(--muted); font-size: 14px; }}
.card .example {{ margin-top: 10px; padding: 10px 12px; border-radius: 8px; background: var(--chip); font-size: 14px; color: var(--ink); }}
.card .example b.bad {{ color: var(--bad); }}
.card ul {{ margin: 8px 0 0; padding-left: 18px; font-size: 14px; }}
.card p.fine {{ font-size: 12px; margin-top: 10px; }}
.btn {{ margin-top: auto; align-self: flex-start; font: inherit; font-weight: 600; font-size: 14px; color: #fff; background: var(--accent);
  border: 0; border-radius: 8px; padding: 9px 14px; cursor: pointer; }}
.card .spacer {{ flex: 1; min-height: 12px; }}
.note {{ font-size: 13px; color: var(--muted); margin-top: 8px; min-height: 1em; }}
.section {{ margin-top: 24px; }}
.tablewrap {{ background: var(--panel); border: 1px solid var(--line); border-radius: 12px; overflow-x: auto; }}
table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
th, td {{ text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--line); white-space: nowrap; }}
th {{ font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); font-weight: 600; }}
tr:last-child td {{ border-bottom: 0; }}
td.num, th.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
td.bad {{ color: var(--bad); font-weight: 700; }}
td code {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--chip); padding: 2px 6px; border-radius: 6px; }}
.yes {{ color: var(--bad); font-weight: 700; }}
footer {{ max-width: 1180px; margin: 8px auto 40px; padding: 0 24px; color: var(--muted); font-size: 13px; }}
@media (max-width: 900px) {{
  .layout {{ grid-template-columns: minmax(0, 1fr); padding: 0 16px; gap: 16px; }}
  .brand small {{ display: none; }}
  .change-head h1 {{ font-size: 19px; }}
  nav {{ display: flex; gap: 8px; overflow-x: auto; }}
  nav h2 {{ display: none; }}
  .api {{ flex: 0 0 auto; margin: 0; }}
  .cards {{ grid-template-columns: 1fr; }}
  .top {{ padding: 12px 16px; }}
  footer {{ padding: 0 16px; }}
}}
</style>
</head>
<body>
<header class="top">
  <div class="brand">Countersign<small>A second signature before money moves</small></div>
  <span class="tag">Demo · sample data</span>
</header>

<div class="layout">
  <nav aria-label="Protected APIs">
    <h2>Protected APIs</h2>
    {apis}
  </nav>

  <main>
    <section class="change">
      <div class="change-head">
        <h1>{title} <span class="num">#{number}</span></h1>
        <span class="pill {status_class}">{status_label}</span>
      </div>
      <p class="sub">Change to <b>{api}</b> · commit <code>{commit}</code> · {status_text}</p>
    </section>

    <div class="cards">
      <article class="card {c1_class}">
        <div class="q">1 · Who will break?</div>
        <div class="big">{c1_big}</div>
        <p>{c1_text}</p>
        {c1_list}
      </article>
      <article class="card {c2_class}">
        <div class="q">2 · Is the money right?</div>
        <div class="big">{c2_big}</div>
        <p>{c2_text}</p>
        {c2_example}
      </article>
      <article class="card {c3_class}">
        <div class="q">3 · Who signs off?</div>
        <div class="big">{c3_big}</div>
        <p>{c3_text}</p>
        <div class="spacer"></div>
        {c3_button}
        <div class="note" id="note" aria-live="polite"></div>
      </article>
    </div>

    {examples}

    <section class="section">
      <h2>Who calls {api} ({total_callers} callers, from gateway logs)</h2>
      <div class="tablewrap"><table>
        <thead><tr><th>Caller</th><th class="num">Calls/day</th><th>Breaks?</th><th>Why</th></tr></thead>
        <tbody>{caller_rows}</tbody>
      </table></div>
    </section>
  </main>
</div>

<footer>
  Audit record <code>{audit_id}</code> · {created}.
  Countersign demo on one sample API with made-up, masked sample data. Not a product a company can install yet.
</footer>

<script>
document.querySelectorAll("[data-demo-button]").forEach(function (b) {{
  b.addEventListener("click", function () {{
    document.getElementById("note").textContent =
      "Demo only. In GitHub, Countersign already asked the payments lead to review.";
  }});
}});
</script>
</body>
</html>
"""


def esc(value) -> str:
    return html.escape(str(value))


def build(callers: dict, money: dict, audit: dict, number: str, title: str) -> str:
    config = load_config()
    role = config["approver"]["role"]
    verdict = audit["verdict"]
    status_label, status_class, status_text = STATUS[verdict]
    api = callers["api"]
    broken = [c for c in callers["callers"] if c["affected"]]

    apis = [f'<div class="api active"><b>{esc(api)}</b><span class="{status_class if verdict == "stopped" else ""}">'
            f'{"1 change stopped" if verdict == "stopped" else "1 change checked"}</span></div>']
    apis += [f'<div class="api"><b>{esc(name)}</b><span>{esc(text)} · sample</span></div>' for name, text in OTHER_APIS]

    # Card 1: who will break?
    if broken:
        c1 = ("warn", f"{len(broken)} of {callers['total']} apps",
              "Still send <code>amount</code> in paise. The new code reads rupees.",
              "<ul>" + "".join(f"<li>{esc(c['name'])} · {short_count(c['calls_per_day'])} calls/day</li>"
                               for c in broken) + "</ul>")
    else:
        c1 = ("good", "None", f"All {callers['total']} callers keep working.", "")
    fc = callers.get("format_check", {})
    if fc.get("tool") and fc.get("breaking") == 0:
        c1 = (c1[0], c1[1], c1[2], c1[3] + '<p class="fine">Format check (oasdiff): no breaking changes</p>')

    # Card 2: is the money right?
    if money["passed"]:
        c2 = ("good", "All correct", f"Re-ran {money['replayed']:,} of last week's refunds through this change.", "")
    else:
        first = money["examples"][0]
        sent = inr(first["after_paise"]) if first["after_paise"] is not None else "rejected"
        c2 = ("bad", f"{money['wrong']:,} of {money['replayed']:,} wrong",
              f"Rule broken: {esc(first['rule'])}.",
              f'<div class="example">Paid {inr(first["paid_paise"])} → refund sent <b class="bad">{sent}</b></div>')

    # Card 3: who signs off?
    sign = audit["sign_off"]
    if verdict == "stopped":
        c3 = ("bad", role.capitalize(), f"Needs approval from the {role} before this can go live.",
              '<button class="btn" type="button" data-demo-button>Request approval</button>')
    elif verdict == "approved":
        c3 = ("good", "Approved", f"Approved by the {role} (@{esc(sign['approved_by'])}) at {esc(sign['approved_at'])}.", "")
    else:
        c3 = ("good", "Not needed", "Nothing risky, so no sign-off is needed.", "")

    examples = ""
    if money["examples"]:
        rows = "".join(
            f"<tr><td><code>{esc(e['order'])}</code></td><td>{esc(e['caller'])}</td>"
            f"<td class='num'>{inr(e['paid_paise'])}</td><td class='num'>{inr(e['before_paise'])}</td>"
            f"<td class='num bad'>{inr(e['after_paise']) if e['after_paise'] is not None else 'rejected'}</td></tr>"
            for e in money["examples"])
        examples = (
            '<section class="section"><h2>Wrong refunds (sample data, order ids masked)</h2>'
            '<div class="tablewrap"><table><thead><tr><th>Order</th><th>Caller</th><th class="num">Paid</th>'
            '<th class="num">Old code sent</th><th class="num">This change sends</th></tr></thead>'
            f"<tbody>{rows}</tbody></table></div></section>")

    caller_rows = "".join(
        f"<tr><td>{esc(c['name'])}</td><td class='num'>{short_count(c['calls_per_day'])}</td>"
        f"<td>{'<span class=yes>Yes</span>' if c['affected'] else 'No'}</td><td>{esc(c['reason'])}</td></tr>"
        for c in callers["callers"])

    return PAGE.format(
        apis="\n    ".join(apis), title=esc(title), number=esc(number), api=esc(api),
        commit=esc(str(audit["commit"])[:7]), status_label=status_label, status_class=status_class,
        status_text=status_text,
        c1_class=c1[0], c1_big=c1[1], c1_text=c1[2], c1_list=c1[3],
        c2_class=c2[0], c2_big=c2[1], c2_text=c2[2], c2_example=c2[3],
        c3_class=c3[0], c3_big=c3[1], c3_text=c3[2], c3_button=c3[3],
        examples=examples, total_callers=callers["total"], caller_rows=caller_rows,
        audit_id=esc(audit["audit_id"]), created=esc(audit["created_at"]),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--results", required=True, type=Path,
                        help="folder with callers.json, money.json and audit.json")
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--change-number", help="change number to show (default: the PR in the audit record)")
    parser.add_argument("--title", default="Refund API: take amount in rupees")
    args = parser.parse_args()

    read = lambda name: json.loads((args.results / name).read_text())
    callers, money, audit = read("callers.json"), read("money.json"), read("audit.json")
    number = args.change_number or audit["pull_request"]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(build(callers, money, audit, number, args.title))
    print(f"Dashboard written to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
