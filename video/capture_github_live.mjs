// Records the real GitHub demo as it happens, as sharp screenshots, for the video.
//
//   node video/capture_github_live.mjs <failed run id>
//
// It acts out the live demo on PR #2 and photographs each step:
//   1. the pull request and its diff
//   2. re-runs the checks on the bad change, photographing the run page every few seconds
//   3. the Countersign comment, and GitHub's merge state (BLOCKED)
//   4. pushes the fix (scripts/github_demo.sh fix), photographing the new run as it turns green
//   5. the updated comment, and the merge state again
//   6. puts the PR back to the bad change (scripts/github_demo.sh reset) and checks it is stopped again
// Writes video/remotion/public/gh/*.jpg and gh.json (each picture: when, which page, where things are).
// Needs the GitHub CLI, logged in as the repo owner. The browser itself is logged out (public pages).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const OUT = path.join(HERE, "remotion", "public", "gh");
const SLUG = "bhanujangid067/countersign-demo";
const REPO = `https://github.com/${SLUG}`;
const PR = 2;
const [failedRun] = process.argv.slice(2);
if (!failedRun) throw new Error("usage: node video/capture_github_live.mjs <failed run id>");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const sh = (cmd, ...args) => execFileSync(cmd, args, { encoding: "utf8", cwd: ROOT }).trim();
const gh = (...args) => sh("gh", ...args);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const clock = () => (Date.now() - t0) / 1000;

// The browser: 1280 x 720, drawn 2x, so each picture is 2560 x 1440 (sharp even when the video zooms in).
const VIEW = { width: 1280, height: 720 };
const browser = await chromium.launch({ channel: "chrome" }); // the Google Chrome already installed on this Mac
const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 2, colorScheme: "light" });
const shots = [];
const extra = {};

async function open(url) {
  if (page.url() === url) await page.reload({ waitUntil: "load" });
  else await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelectorAll(".js-signup-prompt, .flash-full, .js-notification-shelf, cookie-consent-banner").forEach((e) => e.remove()));
}
// Scroll so the deepest visible element with this text sits `top` px from the top of the window.
async function scrollTo(sel, text, top = 120) {
  const ok = await page.evaluate(([sel, text, top]) => {
    const el = [...document.querySelectorAll(sel)].filter((e) => e.innerText?.includes(text) && e.getBoundingClientRect().width > 0).pop();
    if (!el) return false;
    window.scrollTo(0, el.getBoundingClientRect().top + scrollY - top);
    return true;
  }, [sel, text, top]);
  await page.waitForTimeout(400);
  return ok;
}
// Where things are in the window (fractions of the width and height). Each mark is [css, text, min width].
async function marksOf(marks) {
  return page.evaluate(([marks, w, h]) => {
    const out = {};
    for (const [name, [sel, text, minW]] of Object.entries(marks)) {
      const el = [...document.querySelectorAll(sel)].filter((e) => {
        const r = e.getBoundingClientRect();
        return e.innerText?.includes(text) && r.width >= (minW || 1) && r.height > 0;
      }).pop();
      const r = el?.getBoundingClientRect();
      out[name] = r ? { x: r.left / w, y: r.top / h, w: r.width / w, h: r.height / h } : null;
    }
    return out;
  }, [marks, VIEW.width, VIEW.height]);
}
async function shot(id, marks = {}, note = {}) {
  const file = `${id}.jpg`;
  await page.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 92 });
  const s = { id, file, url: page.url().replace("https://", ""), t: Math.round(clock() * 10) / 10, marks: await marksOf(marks), ...note };
  shots.push(s);
  console.log(`${s.t.toFixed(0).padStart(4)}s  ${id}`, Object.entries(s.marks).filter(([, v]) => !v).map(([k]) => k + " MISSING").join(" "));
  return s;
}
const jobsOf = (run) => JSON.parse(gh("run", "view", String(run), "--repo", SLUG, "--json", "status,conclusion,jobs"));
const jobState = (r) => r.jobs.map((j) => `${j.name}:${j.conclusion || j.status}`).join(" ") + ` run:${r.conclusion || r.status}`;
const RUN_MARKS = {
  tests: [".WorkflowGraph *", "Normal tests", 150],
  countersign: [".WorkflowGraph *", "Countersign", 150],
  status: [".actions-workflow-stats *", "Status", 40],
  title: ["h1", "Refund API", 100],
};
// Photograph a run page every few seconds until the run finishes.
async function watch(run, prefix) {
  let n = 0;
  for (;;) {
    const r = jobsOf(run);
    await open(`${REPO}/actions/runs/${run}`);
    await shot(`${prefix}-${String(n++).padStart(2, "0")}`, RUN_MARKS, { state: jobState(r) });
    if (r.status === "completed") {
      await sleep(3000);
      await open(`${REPO}/actions/runs/${run}`);
      await shot(`${prefix}-done`, RUN_MARKS, { state: jobState(jobsOf(run)) });
      return r;
    }
    await sleep(2500);
  }
}
const COMMENT_MARKS = {
  comment: [".timeline-comment", "countersign on the change", 400],
  verdict: [".comment-body *", "countersign on the change", 300],
  money: [".comment-body *", "re-ran", 300],
  apps: [".comment-body *", "apps", 300],
};
async function comment(id) {
  await open(`${REPO}/pull/${PR}`);
  await scrollTo(".timeline-comment", "countersign on the change", 90);
  return shot(id, COMMENT_MARKS);
}
const mergeState = () => JSON.parse(gh("pr", "view", String(PR), "--repo", SLUG, "--json", "mergeStateStatus,statusCheckRollup"));

// 1. The pull request and its diff.
await open(`${REPO}/pull/${PR}`);
await shot("pr-top", { title: ["h1", "Refund API", 100], body: [".comment-body", "rupees instead of paise", 300] });
await open(`${REPO}/pull/${PR}/files`);
await scrollTo("*", "refund_api.py", 150);
await shot("pr-files", { file: ["*", "refund_api.py", 300] });

// 2. Re-run the checks on the bad change, and watch them.
console.log("re-running the checks on the bad change");
gh("run", "rerun", String(failedRun), "--repo", SLUG);
await sleep(4000);
await watch(failedRun, "bad");

// 3. The evidence, and GitHub's answer.
await comment("comment-stopped");
extra.blocked = mergeState();

// 4. Push the fix, and watch the new run.
console.log("pushing the fix");
const fixSha = sh("git", "rev-parse", "fix");
sh("scripts/github_demo.sh", "fix");
let fixRun = null;
for (let i = 0; i < 60 && !fixRun; i++) {
  await sleep(3000);
  const runs = JSON.parse(gh("run", "list", "--repo", SLUG, "--workflow", "countersign.yml", "-L", "5", "--json", "databaseId,headSha"));
  fixRun = runs.find((r) => r.headSha === fixSha)?.databaseId;
}
if (!fixRun) throw new Error("no run started for the fix");
await open(`${REPO}/pull/${PR}`);
await scrollTo("*", "Fix: refund API takes an explicit unit", 360);
await shot("pr-pushed", { pushed: ["*", "Fix: refund API takes an explicit unit", 300] });
await watch(fixRun, "fix");

// 5. The updated comment, and GitHub's answer now.
await comment("comment-clear");
extra.clean = mergeState();
extra.fixRun = fixRun;

// 6. Back to the bad change, so the live PR is stopped again.
console.log("putting the PR back to the bad change");
const badSha = sh("git", "rev-parse", "bad-change");
const resetAt = new Date(Date.now() - 5000).toISOString();
sh("scripts/github_demo.sh", "reset");
let resetRun = null;
for (let i = 0; i < 60 && !resetRun; i++) {
  await sleep(3000);
  const runs = JSON.parse(gh("run", "list", "--repo", SLUG, "--workflow", "countersign.yml", "-L", "5", "--json", "databaseId,headSha,createdAt"));
  resetRun = runs.find((r) => r.headSha === badSha && r.createdAt > resetAt)?.databaseId;
}
if (resetRun) {
  for (let i = 0; i < 60 && jobsOf(resetRun).status !== "completed"; i++) await sleep(4000);
}
extra.after = mergeState();
console.log("PR after reset:", extra.after.mergeStateStatus, extra.after.statusCheckRollup.map((c) => `${c.name}:${c.conclusion}`).join(" "));

await browser.close();
fs.writeFileSync(path.join(OUT, "gh.json"), JSON.stringify({ repo: SLUG, pr: PR, failedRun: Number(failedRun), ...extra, shots }, null, 2));
console.log("saved", shots.length, "pictures");
