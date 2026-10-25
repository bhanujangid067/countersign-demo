// Takes sharp screenshots of the real GitHub pages, as proof the demo runs for real.
//
//   node video/capture_github.mjs <failed run id> <green run id>
//
// Saves full-page PNGs (2x resolution) to video/remotion/public/github/, plus boxes.json:
// where the key parts are on each page, so the video can zoom to them.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "remotion", "public", "github");
const REPO = "https://github.com/bhanujangid067/countersign-demo";
const [failedRun, greenRun] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" }); // the Google Chrome already installed on this Mac
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "light" });
const page = await context.newPage();
const boxes = {};

// Box of the first element matching `selector` whose text includes `text` (page coordinates, CSS pixels).
async function boxOf(selector, text) {
  return page.evaluate(([sel, txt]) => {
    const el = [...document.querySelectorAll(sel)].find((e) => !txt || e.innerText.includes(txt));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
  }, [selector, text]);
}
async function shot(name, url, wantBoxes) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // Close the cookie/sign-in banners GitHub shows to logged-out visitors, if any.
  await page.evaluate(() => document.querySelectorAll(".js-signup-prompt, .flash-full").forEach((e) => e.remove()));
  const pageSize = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
  boxes[name] = { page: pageSize, scale: 2 };
  for (const [key, [sel, text]] of Object.entries(wantBoxes)) boxes[name][key] = await boxOf(sel, text);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log(`${name}.png`, pageSize, Object.fromEntries(Object.entries(boxes[name]).filter(([k]) => !["page", "scale"].includes(k)).map(([k, v]) => [k, v ? "found" : "MISSING"])));
}

await shot("pr", `${REPO}/pull/2`, {
  title: ["h1", "Refund API"],
  comment: [".timeline-comment, .TimelineItem", "countersign on the change"],
  money: ["p", "Re-ran last week"],
  apps: ["p", "apps use this field"],
  approval: ["p", "Needs approval from"],
  checks: ["[aria-label='Checks'], .merge-status-list, section", "Some checks were not successful"],
});
await shot("run_failed", `${REPO}/actions/runs/${failedRun}`, {
  graph: ["[data-testid='workflow-graph'], .WorkflowGraph, .workflow-graph, main", "Countersign"],
  status: ["main", "Failure"],
  artifacts: ["section, div", "Artifacts"],
});
await shot("run_green", `${REPO}/actions/runs/${greenRun}`, {
  graph: ["[data-testid='workflow-graph'], .WorkflowGraph, .workflow-graph, main", "Countersign"],
  status: ["main", "Success"],
});
// The Countersign job's steps (Check 1, Check 2, Check 3...) on the failed run.
await page.goto(`${REPO}/actions/runs/${failedRun}`, { waitUntil: "networkidle" });
const jobUrl = await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => a.innerText.trim() === "Countersign" && a.href.includes("/job/"))?.href);
if (jobUrl) {
  await shot("job_failed", jobUrl, { steps: ["main", "Check 1"], check2: ["*", "Check 2: is the money right?"] });
} else console.log("job link not found");

fs.writeFileSync(path.join(OUT, "boxes.json"), JSON.stringify(boxes, null, 2));
await browser.close();
