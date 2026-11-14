# Countersign

**A second signature before any code change that moves money goes live.**

Countersign is a check that runs on every pull request. If a change could send the wrong amount of money, it stops the change, shows the exact payment that would go wrong, and needs a named person (the payments lead) to sign off. It's like a bank's **maker–checker** rule: one person makes a payment, a second person checks it.

> **Where this is today:** Countersign runs as a GitHub Action, and this repo shows it on **two sample APIs** with **made-up data**. The "payment company" here is fake. It has not been run on a real company's payments yet. [What works today, and what doesn't](#what-works-today-and-whats-next).

**See it:** the walkthrough is at https://bhanujangid067.github.io/countersign-demo/

---

## The story in one minute

1. **The change.** A developer changes the refund API so `amount` means **rupees** instead of **paise** (₹1 = 100 paise). They update the mobile app in the same change. **All the normal tests pass.**
2. **Check 1: who will break?** Countersign finds that 2 of the 8 apps calling the API still send paise: the **merchant dashboard** and the **partner shopping app**.
3. **Check 2: is the money right?** It replays last week's refunds through the new code: **paid ₹900.00 → refund sent ₹90,000.00**. 890 of 4,180 refunds would be wrong, sending **₹94.1 crore** too much in one week. Rule broken: a refund can't be more than what was paid.
4. **Stopped.** The PR check fails, and the PR comment shows the exact refund that broke.
5. **Check 3: who signs off?** Either the developer pushes a fix and everything goes green, or the **payments lead** approves the risk. An audit record is saved either way.

### Then a second change, where signing is the right answer

Countersign can't tell a mistake from a decision. It can only show what a change does to real money. So the demo has one of each.

6. **The change.** Finance asks that refunds above **₹1,00,000** are reviewed by a person. A developer makes the API turn those away. All the normal tests pass.
7. **Stopped again.** Replaying last week shows **7 refunds, ₹10.0 lakh in all**, that went out before and would now be turned away. All 7 come from the mobile app.
8. **Signed, with a reason.** That is what the change is for, so there is nothing to fix. The payments lead reads the numbers and approves that exact commit. Her reason is written into the PR comment and the audit record.

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

You'll see: tests pass → 2 callers named → ₹900 → ₹90,000 caught → STOPPED → the fix → ALL CLEAR. Then the second change: 7 refunds turned away → STOPPED → the payments lead signs with a reason → APPROVED.

Countersign itself runs from `main`. To try changes to Countersign that aren't on `main` yet: `COUNTERSIGN_BASE=my-branch scripts/demo_local.sh`.

It also writes a one-page **dashboard** (like the report's mock-up) from the same results: open `out/local/dashboard.html` for the stopped change, `out/local/dashboard-fixed.html` after the fix, or `out/local/dashboard-approved.html` for the second change after sign-off. It works offline. The "Request approval" button is for show only. On GitHub, Countersign already asks the payments lead to review.

---

## The website

Open `site/index.html` in any browser. It works offline. It starts with a one-page introduction, then shows Countersign as a product: an overview, change #482 (the mistake) and change #483 (the decision) with all three checks animating, an audit log for both, and a plain-English "How it works" page.

Click any app in Check 1 or any refund in Check 2 to open a side panel with the evidence: the request the app sent, what the old and new code do with it, and the rule it breaks. "And 885 more" opens all the wrong refunds, with a filter per app. The audit log also holds earlier records for five other changes, marked **sample**: those are illustrations, not real runs. The left panel collapses to a rail of icons (the round button on its edge, or the `[` key) and is a slide-in drawer on a phone. Its team list follows the story: it shows what Countersign, the developer and the payments lead are each doing.

On the change page, use the buttons or keys: **R** run Countersign · **F** developer pushes a fix · **A** payments lead approves · **M** merge · **0** start again. Merging is blocked (with the reason shown) until the change is fixed or approved. Switch between the two changes with the tabs at the top of the change page. Change #483 has no fix button: the only way forward is the payments lead's signature.

For recording, add these to the address after `#/change`:
- `?play=fix` acts out the whole story by itself: stopped, then fixed, all clear and merged.
- `?play=approve` does the same, but the payments lead approves and countersigns before the merge.
- `&speed=0.5` makes it slower; `&speed=2` makes it faster.

For the second change, use `#/review?play=approve`.

Every number on the site comes from a real run of the checks: `scripts/demo_local.sh` writes `site/data.js`.

---

## How it works, in simple words

The repo plays two roles at once:

| Folder | Role |
|---|---|
| `service/` | The **fake payment company**: a refund API (`refund_api.py`), its API spec (`openapi.yaml`) and its normal tests |
| `clients/` | The **mobile app's refund call**: the one caller whose code lives in this repo, so a change can update it in the same pull request |
| `data/` | **Sample data**: one day of gateway traffic with a few recorded requests per app (`gateway_log.jsonl`) and a week of masked refunds (`refunds_last_week.csv`) |
| `countersign/` | **Our product**: the three checks and the PR comment. Nothing in here knows about refunds |
| `countersign.yaml` | What Countersign protects in this repo: the handler, the data, the rules, who signs off, and what the fields are called |
| `action.yml` | Countersign as a **GitHub Action**, so another repo can use it |
| `examples/payouts/` | A **second sample API** with different field names and a different kind of bug |
| `tests/` | Tests of Countersign itself (the sample API's own tests are in `service/tests/`) |
| `.github/workflows/countersign.yml` | Runs it all on every pull request, inside the company's own GitHub |

### Check 1: Who will break? (`countersign/check_callers.py`)
- It compares the API spec **before** and **after** the change.
- First it asks **oasdiff** (a free, standard tool) whether the change is "breaking". oasdiff says **no breaking changes**, because the change still *looks* fine: a number is still a number. **That is the gap we fill.**
- So Countersign also compares what each field **means**: its unit (paise or rupees), its limit and its description.
- Then it works out what each app **really sends**. Nobody labels that:
  - For the mobile app, whose code is in this repo, it runs that code from the pull request and looks at the request it builds.
  - For every other app, it takes the requests recorded in the **gateway log** and matches them with last week's refunds. If the amount equals the paise that were refunded, the app sends paise. If it is 100 times smaller, the app sends rupees.
- Any app that sends `amount` in paise while the new code reads rupees will break. So will any app whose refunds last week are above a limit the change adds.
- The gateway log comes from the base branch, so a pull request can't edit the evidence.

### Check 2: Is the money right? (`countersign/check_money.py`)
- It takes last week's refunds (masked sample data) and **runs each one through both the old code and the new code**, building each request the way that app really sends it.
- Then it checks the **money rules** in `countersign/rules.yaml`. The main one: `refund_out <= paid`, meaning a refund can't be more than what was paid.
- One rule is always on: a refund that went out before must still go out. If the new code turns it away, that counts as wrong.
- It adds up how much extra money the wrong refunds would send, and how much would be turned away, in total and per app. The payments lead sees that total in the PR comment before deciding, and it's saved in the audit record.
- If any rule breaks, it exits with an error, so the GitHub check fails.

### Check 3: Who signs off? (`countersign/report.py`, `countersign/github.py`)
- If anything is risky, the change is **stopped** until the **payments lead** approves **that exact commit**. A new commit needs a new approval.
- What the payments lead writes in the approving review is kept as the **reason**, in the PR comment and the audit record.
- Countersign posts **one** comment on the PR, adds the `needs-payments-lead` label and asks the payments lead to review.
- It saves an **audit record** (PR, commit, checks run, results, who approved, when) as a file attached to the GitHub run, and links it in the comment.

### Why the code and data never leave the company
It runs in the company's own CI (here, GitHub Actions in their own repo). Nothing is sent to us.

### Why a PR can't switch Countersign off
Countersign's code, rules and replay data are taken from the **base branch** (the trusted, already-merged code), not from the PR being checked.

---

## Use it on your own repo

Countersign is a GitHub Action. It runs in your own CI, so your code and payment data stay with you.

**What you need**

- A **handler**: the Python function that decides how much money moves. It takes the request as a dict and returns a dict that includes the amount. Countersign calls it thousands of times, so it must not send anything for real.
- **Replay data**: a CSV with a masked copy of recent payments. One row per payment: an id, which app sent it, what was asked for, and the amount your rules compare with.
- A **gateway log**: one line of JSON per app that calls the API, with a few recorded requests for the apps that send money. See [`data/gateway_log.jsonl`](data/gateway_log.jsonl).
- **Money rules**: one line each, such as `out <= reference`. See [`countersign/rules.yaml`](countersign/rules.yaml).

**Steps**

1. Add `countersign.yaml` to the root of your repo. Copy [this repo's](countersign.yaml) or the [payouts example's](examples/payouts/before/countersign.yaml) and change the paths, the approver and the field names.
2. Add this workflow as `.github/workflows/countersign.yml`:

   ```yaml
   name: Countersign
   on: pull_request
   permissions:
     contents: read
     pull-requests: write   # comment, request a reviewer
     issues: write          # labels
   jobs:
     countersign:
       name: Countersign
       runs-on: ubuntu-latest
       steps:
         - uses: bhanujangid067/countersign-demo@main
   ```

3. Copy [`.github/workflows/countersign-review.yml`](.github/workflows/countersign-review.yml), so an approval re-runs the check.
4. Make **Countersign** a required status check on your main branch, and dismiss stale approvals when new commits are pushed.

The action reads `countersign.yaml`, the rules, the replay data and the gateway log from the **base branch**. Only the code under test comes from the pull request.

To see it work on something other than refunds first, read [`examples/payouts/`](examples/payouts/README.md).

---

## What works today, and what's next

**Works today**

- All three checks, on a pull request, with the comment, label, review request and audit record.
- Approval by a named person for one exact commit, with their reason recorded.
- Two sample APIs (refunds and payouts) on the same code, set up only through `countersign.yaml`.
- Unit detection from recorded requests and from client code in the repo.
- Tests of Countersign itself: `python -m pytest tests`.

**Limits you should know about**

- **No real company has run it yet.** Everything here is sample data.
- **Python handlers only**, called directly as a function. The handler must have no side effects. A service in another language, or one that has to be called over HTTP, isn't supported.
- **One endpoint per repo**, with one amount per request.
- **Two units only**, a minor and a major one (paise and rupees, cents and dollars). Money is printed in rupees.
- **Rules are one comparison each.** There is no "and", "or" or arithmetic.
- **The action has only been run on this repo's own pull requests**, not yet from another repo.

**Next**

- Run it with one real payments team on a masked copy of their data.
- Call the service over HTTP in a sandbox, so the handler can be in any language.
- More than one endpoint, and currencies other than rupees.
- Publish tagged releases of the action.

---

## The three branches

| Branch | What it does | Tests | Check 1 | Check 2 | Result |
|---|---|---|---|---|---|
| `bad-change` | `amount` now read as rupees; mobile app updated | ✓ 4 pass | ⚠ 2 callers break | ✗ 890 of 4,180 wrong | **STOPPED** |
| `fix` (one more commit) | API takes an explicit `unit`, paise by default, so old apps keep working; the mobile app sends `unit: "rupees"` | ✓ 6 pass | ✓ | ✓ | **ALL CLEAR** |
| `review-limit` | Refunds above ₹1,00,000 are turned away and go to manual review | ✓ 5 pass | ⚠ 1 caller affected | ✗ 7 of 4,180 turned away | **STOPPED**, then **APPROVED** with a reason |

---

## Presenting it

Notes for showing Countersign to people (the live GitHub walkthrough, a 90-second script, common questions, the video and the logo) are in [docs/presenting.md](docs/presenting.md).

---

## Sample data

Everything in `data/` is **made up**: no real customers, orders, payments or companies. `scripts/make_sample_data.py` creates the refunds file with a fixed seed, so the numbers are the same every time. Calls per day are illustrative.
