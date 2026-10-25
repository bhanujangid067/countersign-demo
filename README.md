# Countersign demo

**A second signature before any code change that moves money goes live.**

Countersign is a check that runs on every pull request. If a change could send the wrong amount of money, it stops the change, shows the exact payment that would go wrong, and needs a named person (the payments lead) to sign off. It's like a bank's **maker–checker** rule: one person makes a payment, a second person checks it.

> **What this is, honestly:** a working demo of the idea on **one sample API** with **made-up sample data**. The "payment company" here is fake. It is not a product a company can install yet.

---

## The story in one minute

1. **The change.** A developer changes the refund API so `amount` means **rupees** instead of **paise** (₹1 = 100 paise). They update the mobile app in the same change. **All the normal tests pass.**
2. **Check 1: who will break?** Countersign finds that 2 of the 8 apps calling the API still send paise: the **merchant dashboard** and the **partner shopping app**.
3. **Check 2: is the money right?** It replays last week's refunds through the new code: **paid ₹900.00 → refund sent ₹90,000.00**. 890 of 4,180 refunds would be wrong. Rule broken: a refund can't be more than what was paid.
4. **Stopped.** The PR check fails, and the PR comment shows the exact refund that broke.
5. **Check 3: who signs off?** Either the developer pushes a fix and everything goes green, or the **payments lead** approves the risk. An audit record is saved either way.

---

## Run it on your laptop (no internet needed)

One-time setup (needs internet, about a minute):

```bash
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
brew install oasdiff        # optional: the free API diff tool used in Check 1
```

Then, any time, even offline:

```bash
scripts/demo_local.sh            # runs straight through
scripts/demo_local.sh --pause    # waits for Enter between steps (for presenting)
```

You'll see: tests pass → 2 callers named → ₹900 → ₹90,000 caught → STOPPED → the fix → ALL CLEAR.

It also writes a one-page **dashboard** (like the report's mock-up) from the same results: open `out/local/dashboard.html` for the stopped change, or `out/local/dashboard-fixed.html` after the fix. It works offline. The "Request approval" button is for show only. On GitHub, Countersign already asks the payments lead to review.

---

## The website (easiest way to show it)

Open `site/index.html` in any browser. It works offline. It's Countersign as a product: an overview, change #482 with all three checks animating, an audit log, and a plain-English "How it works" page.

On the change page, use the buttons or keys: **R** run Countersign · **F** developer pushes a fix · **A** payments lead approves · **M** merge · **0** start again. Merging is blocked (with the reason shown) until the change is fixed or approved.

For recording, add these to the address after `#/change`:
- `?play=fix` acts out the whole story by itself: stopped, then fixed, all clear and merged.
- `?play=approve` does the same, but the payments lead approves and countersigns before the merge.
- `&speed=0.5` makes it slower; `&speed=2` makes it faster.

Every number on the site comes from a real run of the checks: `scripts/demo_local.sh` writes `site/data.js`.

---

## How it works, in simple words

The repo plays two roles at once:

| Folder | Role |
|---|---|
| `service/` | The **fake payment company**: a refund API (`refund_api.py`), its API spec (`openapi.yaml`) and its normal tests |
| `data/` | **Sample data**: one day of gateway traffic (`gateway_log.jsonl`) and a week of masked refunds (`refunds_last_week.csv`) |
| `countersign/` | **Our product**: the three checks, the money rules and the PR comment |
| `.github/workflows/countersign.yml` | Runs it all on every pull request, inside the company's own GitHub |

### Check 1: Who will break? (`countersign/check_callers.py`)
- It compares the API spec **before** and **after** the change.
- First it asks **oasdiff** (a free, standard tool) whether the change is "breaking". oasdiff says **no breaking changes**, because the change still *looks* fine: a number is still a number. **That is the gap we fill.**
- So Countersign also compares what each field **means**: its unit (paise or rupees) and its description.
- Then it reads the **gateway log**, the record of which apps call which part of the API. Any app that sends `amount` in paise while the new code reads rupees will break.

### Check 2: Is the money right? (`countersign/check_money.py`)
- It takes last week's refunds (masked sample data) and **runs each one through both the old code and the new code**, building each request the way that app really sends it.
- Then it checks the **money rules** in `countersign/rules.yaml`. The main one: `refund_out <= paid`, meaning a refund can't be more than what was paid.
- If any rule breaks, it exits with an error, so the GitHub check fails.

### Check 3: Who signs off? (`countersign/report.py`, `countersign/github.py`)
- If anything is risky, the change is **stopped** until the **payments lead** approves **that exact commit**. A new commit needs a new approval.
- Countersign posts **one** comment on the PR, adds the `needs-payments-lead` label and asks the payments lead to review.
- It saves an **audit record** (PR, commit, checks run, results, who approved, when) as a file attached to the GitHub run, and links it in the comment.

### Why the code and data never leave the company
It runs in the company's own CI (here, GitHub Actions in their own repo). Nothing is sent to us.

### Why a PR can't switch Countersign off
Countersign's code, rules and replay data are taken from the **base branch** (the trusted, already-merged code), not from the PR being checked.

---

## The two changes

| Branch | What it does | Tests | Check 1 | Check 2 | Result |
|---|---|---|---|---|---|
| `bad-change` | `amount` now read as rupees; mobile app updated | ✓ 4 pass | ⚠ 2 callers break | ✗ 890 of 4,180 wrong | **STOPPED** |
| `fix` (one more commit) | API takes an explicit `unit`, paise by default, so old apps keep working; the mobile app sends `unit: "rupees"` | ✓ 6 pass | ✓ | ✓ | **ALL CLEAR** |

---

## Put it on GitHub (live demo)

You need: a **public** repo (branch rules are free on public repos), and a **second GitHub account** to play the payments lead. GitHub doesn't let you approve your own pull request.

1. Put the payments lead's GitHub username in `countersign/config.yaml` (`github_user:`) and in `.github/CODEOWNERS`. Commit on `main`.
2. Create the empty repo on GitHub, then:
   ```bash
   git remote add origin https://github.com/<you>/countersign-demo.git
   scripts/github_demo.sh setup
   ```
3. Add the payments lead as a collaborator: **Settings → Collaborators**.
4. Wait for the first checks to finish on the PR (about a minute). Then turn on the merge block: **Settings → Rules → Rulesets → New branch ruleset**
   - Target: the default branch (`main`); Enforcement: **Active**
   - ✓ Require a pull request before merging → ✓ **Dismiss stale pull request approvals when new commits are pushed** (so a new commit always needs a new approval)
   - ✓ Require status checks to pass → add **Normal tests** and **Countersign**
5. **On stage:**
   - Fix route: `scripts/github_demo.sh fix` → about a minute later everything is green.
   - Approval route: the payments lead opens the PR → **Files changed → Review changes → Approve** → the "re-check after review" workflow (`countersign-review.yml`) re-runs Countersign, which turns green with "Approved by payments lead". Takes about a minute.
6. After a rehearsal: `scripts/github_demo.sh reset` puts the PR back to the bad change. Any approval is cancelled, because the PR got a new push.

The ruleset blocks direct pushes to `main`. To change `main`, switch the ruleset to **Disabled**, push, and switch it back to **Active**.

---

## 90-second click-through script (for the pitch)

| Time | Show | Say |
|---|---|---|
| 0:00 | The PR title and its "Files changed" tab | "A developer makes `amount` rupees instead of paise. Simpler for app developers. They even update the mobile app." |
| 0:15 | The checks list: **Normal tests ✓** | "Every normal test passes. Any team would merge this." |
| 0:25 | **Countersign ✗** and the comment | "Countersign stopped it." |
| 0:35 | The "2 apps use this field" line | "First: who will break? From the company's own gateway logs: the merchant dashboard and the partner shopping app still send paise." |
| 0:50 | The "paid ₹900.00 → refund sent ₹90,000.00" line | "Second: is the money right? We replayed last week's refunds. A ₹900 refund would send ₹90,000. 890 of 4,180 would be wrong. That's proof, not an opinion." |
| 1:05 | "Needs approval from: payments lead", the merge button blocked | "Third: who signs off? It can't merge until the payments lead approves, or it's fixed." |
| 1:15 | Run `scripts/github_demo.sh fix`, wait, all green | "The developer adds an explicit unit, so old apps keep working. Everything is green." |
| 1:25 | The audit record link | "And there's an audit record of who checked what, and when. A second signature before money moves." |

If the Wi-Fi fails: play the backup video, or run `scripts/demo_local.sh --pause`.

---

## Questions judges might ask

- **"Couldn't a unit test catch this?"** The developer updated the tests along with the code, so the tests agree with the bug. Countersign checks against **real past traffic** and **money rules**, not against tests the same developer wrote.
- **"Doesn't API diff tooling already do this?"** Format checks (like oasdiff, which we use) pass this change, because a number is still a number. The bug is in what the number **means**.
- **"Where does the data come from?"** The company's own gateway logs and a masked copy of recent payments, read inside their own CI. In this demo, both are made-up sample files.
- **"What if the change is meant to change amounts?"** Then the payments lead approves it, and the approval is recorded.
- **"Is this a product?"** Not yet. This is a working demo of the idea on one sample API.

---

## Sample data

Everything in `data/` is **made up**: no real customers, orders, payments or companies. `scripts/make_sample_data.py` creates the refunds file with a fixed seed, so the numbers are the same every time. Calls per day are illustrative.
