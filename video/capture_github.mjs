// Takes sharp, tightly cropped screenshots of the real GitHub pages, as proof the demo runs for real.
//
//   node video/capture_github.mjs <failed run id> <green run id>
//
// Each picture is one part of a page (not the whole page), taken at 3x resolution, so the video
// never has to zoom into a blurry screenshot. Also saves terminal.json: the real output of a few
// `gh` commands (needs the GitHub CLI, logged in), shown in the video as a terminal.
// Writes video/remotion/public/github/*.png, sizes.json and terminal.json.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "remotion", "public", "github");
const SLUG = "bhanujangid067/countersign-demo";
const REPO = `https://github.com/${SLUG}`;
const PR = 2;
const [failedRun, greenRun] = process.argv.slice(2);
if (!failedRun || !greenRun) throw new Error("usage: node video/capture_github.mjs <failed run id> <green run id>");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const SCALE = 3;
const browser = await chromium.launch({ channel: "chrome" }); // the Google Chrome already installed on this Mac
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: SCALE, colorScheme: "light" });
const sizes = {};

async function open(url) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(3500);
  // Banners GitHub shows to logged-out visitors.
  await page.evaluate(() => document.querySelectorAll(".js-signup-prompt, .flash-full, .js-notification-shelf").forEach((e) => e.remove()));
}
// Box (page coordinates) around everything from the first to the last element, plus padding.
// Each selector is [css, text it must contain]; the last (deepest) visible match is used.
async function union(selectors, pad = 12) {
  return page.evaluate(([sels, pad]) => {
    const pick = ([sel, text]) => [...document.querySelectorAll(sel)]
      .filter((e) => (!text || e.innerText?.includes(text)) && e.getBoundingClientRect().width > 0).pop();
    const rs = sels.map((s) => pick(s)?.getBoundingClientRect()).filter(Boolean);
    if (rs.length !== sels.length) return null;
    const x0 = Math.min(...rs.map((r) => r.left)), y0 = Math.min(...rs.map((r) => r.top));
    const x1 = Math.max(...rs.map((r) => r.right)), y1 = Math.max(...rs.map((r) => r.bottom));
    return { x: x0 - pad, y: y0 + scrollY - pad, width: x1 - x0 + 2 * pad, height: y1 - y0 + 2 * pad };
  }, [selectors, pad]);
}
// Where things are inside a crop (fractions of its width and height), so the video can circle them.
// Each mark is [css, text, minimum width in px]: the deepest visible match at least that wide.
async function marksIn(clip, marks) {
  return page.evaluate(([clip, marks]) => {
    const out = {};
    for (const [name, [sel, text, minW]] of Object.entries(marks)) {
      const el = [...document.querySelectorAll(sel)].filter((e) => {
        const r = e.getBoundingClientRect();
        return e.innerText?.includes(text) && r.width >= (minW || 1) && r.height > 0;
      }).pop();
      if (!el) { out[name] = null; continue; }
      const r = el.getBoundingClientRect();
      out[name] = { x: (r.left - clip.x) / clip.width, y: (r.top + scrollY - clip.y) / clip.height, w: r.width / clip.width, h: r.height / clip.height };
    }
    return out;
  }, [clip, marks]);
}
async function crop(name, selectors, pad, marks = {}) {
  const clip = await union(selectors, pad);
  if (!clip) throw new Error(`${name}: part of the page not found`);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip, fullPage: true });
  sizes[name] = { width: Math.round(clip.width * SCALE), height: Math.round(clip.height * SCALE), marks: await marksIn(clip, marks) };
  console.log(`${name}.png`, sizes[name].width, sizes[name].height, Object.entries(sizes[name].marks).map(([k, v]) => k + (v ? " found" : " MISSING")).join(", "));
}

// The run: its title, the job list with ✓ and ✗, the status, and the graph.
const RUN = [["h1", "Refund API"], ["nav", "All jobs"], [".actions-workflow-stats"], [".WorkflowGraph"]];
await open(`${REPO}/actions/runs/${failedRun}`);
const NODES = { tests: [".WorkflowGraph *", "Normal tests", 150], countersign: [".WorkflowGraph *", "Countersign", 150] };
await crop("run_failed", RUN, 16, { ...NODES, status: [".actions-workflow-stats *", "Failure", 1] });
await crop("artifact", [[".actions-fullwidth-module", "Artifacts"]], 8, { row: ["tr, li, div", "countersign-audit", 600] });
await open(`${REPO}/actions/runs/${greenRun}`);
await crop("run_green", RUN, 16, { ...NODES, status: [".actions-workflow-stats *", "Success", 1] });
// The pull request: its title, and Countersign's comment with the evidence.
await open(`${REPO}/pull/${PR}`);
await crop("pr_head", [["[class*=PageLayout-HeaderContent]", "Refund API"]], 6);
await crop("comment", [[".timeline-comment", "countersign on the change"]], 10, {
  money: [".comment-body *", "Example: paid", 300],
  apps: [".comment-body *", "apps use this field", 300],
  approval: [".comment-body *", "Needs approval from", 300],
  audit: [".comment-body *", "Audit record", 300],
});
await browser.close();
fs.writeFileSync(path.join(OUT, "sizes.json"), JSON.stringify(sizes, null, 2));

// The real state of the pull request, straight from GitHub.
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" }).trim();
const view = JSON.parse(gh("pr", "view", String(PR), "--repo", SLUG, "--json", "number,mergeStateStatus,statusCheckRollup"));
const checks = view.statusCheckRollup.map((c) => ({ name: c.name, result: (c.conclusion || c.status).toLowerCase() }));
const rules = JSON.parse(gh("api", `repos/${SLUG}/rules/branches/main`));
const required = rules.filter((r) => r.type === "required_status_checks").flatMap((r) => r.parameters.required_status_checks.map((c) => c.context));
const terminal = { pr: PR, repo: SLUG, checks, mergeState: view.mergeStateStatus, required, takenAt: new Date().toISOString() };
fs.writeFileSync(path.join(OUT, "terminal.json"), JSON.stringify(terminal, null, 2));
console.log(terminal);
