// Records the Countersign website, scene by scene, timed to the voiceover.
//
//   node video/record.mjs        (run make_voice.py first)
//
// Writes video/remotion/public/site.mp4 and video/remotion/public/site-marks.json
// (when each website scene starts in the recording). Remotion adds the titles, captions and motion.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, "..", "site");
const OUT = path.join(HERE, "out");
const PUBLIC = path.join(HERE, "remotion", "public");
const VOICE = JSON.parse(fs.readFileSync(path.join(OUT, "voice", "durations.json"), "utf8"));
const LINES = Object.fromEntries(VOICE.scenes.map((s) => [s.id, s]));
const PAD = 0.9; // seconds each scene runs past the end of its voice line (Remotion uses the same value)

// ---- a tiny static server for the site ----
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const file = path.join(SITE, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/$/, "/index.html"));
  if (!file.startsWith(SITE) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// Show the site 45% larger so it fills the video frame sharply, hide the site's pop-up messages
// (the voiceover says it) and the presenter buttons (viewers don't need them), and show a ripple where we click.
const ZOOM = 1.45;
const OVERLAY = `
(() => {
  const css = 'html{zoom:${ZOOM}}.tray>section:first-child{display:none!important}.toast{display:none!important}.vo-ripple{position:fixed;width:46px;height:46px;border-radius:50%;border:3px solid #1f3d8c;pointer-events:none;z-index:99997;transform:translate(-50%,-50%) scale(.4);animation:vo-ripple .6s ease-out forwards}@keyframes vo-ripple{to{transform:translate(-50%,-50%) scale(1.8);opacity:0}}';
  const add = () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
  const mark = () => { if (document.getElementById('vo-mark')) return; const m = document.createElement('div'); m.id = 'vo-mark';
    m.style.cssText = 'position:fixed;right:0;bottom:0;width:6px;height:6px;z-index:99999;background:#000'; document.body.appendChild(m); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark); else mark();
  window.__ripple = (x, y) => { const r = document.createElement('div'); r.className = 'vo-ripple'; r.style.left = (x / ${ZOOM}) + 'px'; r.style.top = (y / ${ZOOM}) + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 700); };
})();`;

const browser = await chromium.launch({ channel: "chrome" }); // the Google Chrome already installed on this Mac
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  colorScheme: "light",
  recordVideo: { dir: path.join(OUT, "tmp"), size: { width: 1920, height: 1080 } },
});
await context.addInitScript(OVERLAY);
const page = await context.newPage();
const t0 = Date.now();
const marks = {};
const pill = (text) => page.waitForFunction((t) => document.getElementById("statusPill")?.innerText === t, text, { timeout: 90000 });
const key = (k) => page.keyboard.press(k);
const wait = (ms) => page.waitForTimeout(ms);
async function click(selector) {
  const box = await page.locator(selector).boundingBox();
  await page.evaluate(([x, y]) => window.__ripple(x, y), [box.x + box.width / 2, box.y + box.height / 2]);
  await page.locator(selector).click({ force: true }); // the locked Merge button is aria-disabled but still clickable (it shakes)
}
async function releaseWhenReady(name) {
  await page.waitForFunction((n) => window.__waitingFor === n, name, { timeout: 60000 });
  await page.evaluate((n) => window.__release(n), name);
}
// One scene: note when it starts, do its actions, and hold until its voice line (plus PAD) has finished.
// Each scene colours the corner square, so its exact start can be found in the video afterwards.
const SCENE_COLORS = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff", "#ff8000", "#8000ff"];
const ORDER = ["overview", "change", "check1", "check2", "stopped", "fix", "approve", "audit", "end"];
const flag = (id) => page.evaluate((c) => { const m = document.getElementById("vo-mark"); if (m) m.style.background = c; }, SCENE_COLORS[ORDER.indexOf(id)]);
async function scene(id, actions) {
  const line = LINES[id], start = Date.now();
  await flag(id);
  marks[id] = (start - t0) / 1000;
  console.log(`scene ${id} at ${marks[id].toFixed(1)}s (voice ${line.seconds}s)`);
  if (actions) await actions();
  const left = (line.seconds + PAD) * 1000 - (Date.now() - start);
  if (left > 0) await wait(left);
  else console.log(`  ${id} ran ${(-left / 1000).toFixed(1)}s longer than its line`);
}

await page.goto(`${BASE}/index.html#/overview?steps`);
await page.evaluate(() => document.fonts.ready);
await wait(1500);

await scene("overview");
await scene("change", async () => {
  await page.evaluate(() => { location.hash = "#/change"; });
  await wait(1500);
  await page.evaluate(() => window.scrollTo({ top: 150, behavior: "smooth" }));
});
await scene("check1", async () => {
  await key("r");
  await releaseWhenReady("callers");
});
await scene("check2", async () => { await releaseWhenReady("money"); });
await scene("stopped", async () => {
  await releaseWhenReady("signoff");
  await pill("Stopped");
  await wait(2400);
  await click("#bMerge");
});
await scene("fix", async () => {
  await page.evaluate(() => { window.__auto = setInterval(() => window.__waitingFor && window.__release(window.__waitingFor), 60); });
  await key("f");
  await pill("All clear");
  await wait(1500);
  await click("#bMerge");
  await pill("Merged");
  await wait(1800);
});
await scene("approve", async () => {
  await page.evaluate(() => window.__setSpeed(3));
  await key("0");
  await wait(300);
  await key("r");
  await pill("Stopped");
  await page.evaluate(() => window.__setSpeed(1));
  await wait(500);
  await key("a");
  await pill("Countersigned");
  await wait(3600);
  await click("#bMerge");
  await pill("Merged");
  await wait(1800);
});
await scene("audit", async () => {
  await page.evaluate(() => { location.hash = "#/audit"; });
  await wait(1400);
  await page.evaluate(() => {
    const el = document.querySelectorAll(".doc-s")[3];
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 300, behavior: "smooth" });
  });
});
marks.end = (Date.now() - t0) / 1000;
await flag("end");
await wait(600);

await context.close();
const raw = await page.video().path();
await browser.close();
server.close();
fs.mkdirSync(PUBLIC, { recursive: true });
// H.264 with frequent keyframes, so Remotion can jump to any scene quickly.
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
  "-r", "30", "-g", "15", "-an", path.join(PUBLIC, "site.mp4")]);
// Find where each scene really starts in the video, from the corner square's colour.
const raw30 = execFileSync("ffmpeg", ["-v", "error", "-i", path.join(PUBLIC, "site.mp4"), "-vf", "crop=4:4:1915:1075,scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 26 });
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const PALETTE = SCENE_COLORS.map(rgb);
const videoMarks = {};
let want = 0;
for (let f = 0; f * 3 < raw30.length && want < ORDER.length; f++) {
  const px = [raw30[f * 3], raw30[f * 3 + 1], raw30[f * 3 + 2]];
  const near = PALETTE.map((c) => c.reduce((d, v, i) => d + (v - px[i]) ** 2, 0));
  const best = near.indexOf(Math.min(...near));
  if (best === want && near[best] < 6000) { videoMarks[ORDER[want]] = f / 30; want++; }
}
if (want < ORDER.length) throw new Error("could not find every scene in the video: found " + Object.keys(videoMarks).join(", "));
console.log("scene starts in the video:", videoMarks);
fs.writeFileSync(path.join(PUBLIC, "site-marks.json"), JSON.stringify({ pad: PAD, marks: videoMarks, clock: marks }, null, 2));
console.log("saved remotion/public/site.mp4 and site-marks.json");
