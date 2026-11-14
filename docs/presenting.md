# Presenting Countersign

Notes for whoever is showing Countersign to other people. Nothing here is needed to use it.

---

## The live GitHub walkthrough

You need: a **public** repo (branch rules are free on public repos), and a **second GitHub account** to play the payments lead. GitHub doesn't let you approve your own pull request.

1. Put the payments lead's GitHub username in `countersign.yaml` (`github_user:`) and in `.github/CODEOWNERS`. Commit on `main`.
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
5. **During the walkthrough:**
   - Fix route: `scripts/github_demo.sh fix` → about a minute later everything is green.
   - The second change: `setup` also opens a PR from `review-limit`. It is stopped too, and it has no fix. The payments lead approves it and types the reason in the review box. The reason appears in the Countersign comment.
   - Approval route: the payments lead opens the PR → **Files changed → Review changes → Approve** → the "re-check after review" workflow (`countersign-review.yml`) re-runs Countersign, which turns green with "Approved by payments lead". Takes about a minute.
6. Afterwards: `scripts/github_demo.sh reset` puts the PR back to the bad change. Any approval is cancelled, because the PR got a new push.

The ruleset blocks direct pushes to `main`. To change `main`, switch the ruleset to **Disabled**, push, and switch it back to **Active**.

---

## 90-second walkthrough script

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

## Common questions

- **"Couldn't a unit test catch this?"** The developer updated the tests along with the code, so the tests agree with the bug. Countersign checks against **real past traffic** and **money rules**, not against tests the same developer wrote.
- **"Doesn't API diff tooling already do this?"** Format checks (like oasdiff, which we use) pass this change, because a number is still a number. The bug is in what the number **means**.
- **"Where does the data come from?"** The company's own gateway logs and a masked copy of recent payments, read inside their own CI. In this demo, both are made-up sample files.
- **"What if the change is meant to change amounts?"** Then the payments lead approves it, and the approval is recorded.
- **"Is this a product?"** It's an early one. It installs as a GitHub Action and works on two sample APIs, but no real company has run it yet. See [what works today](../README.md#what-works-today-and-whats-next).
- **"Does it only work for refunds?"** No. [`examples/payouts/`](../examples/payouts/README.md) runs the same code on a payout API, where it catches a fee bug that changes no API field at all.

---

## The demo video

`video/` (in the repo root) makes a 2½-minute narrated video of the whole story: the website, then the same change on the real GitHub pull request. One-time setup (Mac, needs internet): `brew install espeak-ng ffmpeg`, then in `video/` (in the repo root): `npm install`, `python3.11 -m venv .tts && .tts/bin/pip install kokoro-onnx soundfile`, download the Kokoro model files into `video/models/`, and run `npm install` in `video/remotion/`.

To remake it (for example after changing the script in `video/script.json`):

1. `video/.tts/bin/python video/make_voice.py`, then copy `video/out/voice/*` into `video/remotion/public/voice/`: the voiceover (free Kokoro AI voice, offline)
2. `node video/record.mjs`: records the website in sharp 4K, in step with the voice. It doesn't film the screen in real time: it freezes the site's clock and moves it forward one frame at a time, taking a screenshot of each frame.
3. `node video/capture_github_live.mjs <failed run id>`: runs the live GitHub demo for real and photographs it as it happens. It re-runs the checks on PR #2, pushes the fix, watches the checks go green, then puts the PR back to the bad change (stopped again). It also saves GitHub's real merge state (BLOCKED, then CLEAN) for the terminal card.
4. In `video/remotion/`: `npx remotion render CountersignDemo ../out/countersign-demo.mp4`

`npx remotion studio` in `video/remotion/` opens an editor to preview and tweak it. `node stills.mjs <folder> <frame> ...` renders a few single frames to check.

---

## The logo

`brand/` has the logo in every version (open `brand/index.html` to see them all), with PNGs for slides in `brand/png/`. The files are traced from the original image in `brand/source/`: `brand/make_logo.py` makes the SVGs (needs `brew install potrace`), then `node video/export_logo_png.mjs` makes the PNGs.
