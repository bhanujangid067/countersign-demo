// Records the Countersign website, scene by scene, timed to the voiceover.
//
//   node video/record.mjs        (run make_voice.py first)
//
// The site is not screen-recorded in real time. Its clock is frozen and moved forward one frame
// at a time (timers, animations and scrolling all follow it), and every frame is a sharp 4K
// screenshot. So the video is crisp, smooth, and every scene starts exactly when we say.
// Frames are drawn in 4K and saved at 2560 x 1440: sharp even when the video zooms in, and light enough to render.
//
// Writes video/remotion/public/site.mp4 and video/remotion/public/site-marks.json
// (when each website scene starts, when key moments happen, and where things are on screen).
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, "..", "site");
const OUT = path.join(HERE, "out");
const PUBLIC = path.join(HERE, "remotion", "public");
const VOICE = JSON.parse(fs.readFileSync(path.join(OUT, "voice", "durations.json"), "utf8"));
const LINES = Object.fromEntries(VOICE.scenes.map((s) => [s.id, s]));
const PAD = 0.9; // seconds each scene runs past the end of its voice line (Remotion uses the same value)
const FPS = 30;
// The site is laid out at 1280 x 720 and drawn 3x, so each frame is 3840 x 2160 (4K).
const VIEW = { width: 1280, height: 720 };
const DPR = 3;

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

// Runs in the page before the site's own code: a clock we control, smooth scrolling that follows it,
// a ripple where we click, and no presenter buttons or pop-up messages (the voiceover says it).
const SETUP = `
(() => {
  const realTimeout = window.setTimeout.bind(window);
  let now = 0, seq = 1;
  const timers = new Map();
  const add = (fn, ms, args, every) => { const id = seq++; timers.set(id, { at: now + Math.max(0, +ms || 0), fn, args, every }); return id; };
  window.setTimeout = (fn, ms, ...args) => add(fn, ms, args, 0);
  window.setInterval = (fn, ms, ...args) => add(fn, ms, args, Math.max(1, +ms || 0));
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  window.requestAnimationFrame = (fn) => add(() => fn(now), 1000 / 60, [], 0);
  window.cancelAnimationFrame = (id) => { timers.delete(id); };
  const start = Date.now();
  Date.now = () => start + now;
  performance.now = () => now;

  // Move the clock forward: run every timer that falls due (in order, letting promises settle
  // after each), then put every CSS animation and transition at the matching point.
  window.__advance = async (ms) => {
    const from = now, end = now + ms;
    for (;;) {
      let id = 0, next = null;
      for (const [k, t] of timers) if (t.at <= end && (!next || t.at < next.at)) { id = k; next = t; }
      if (!next) break;
      now = next.at;
      if (next.every) next.at += next.every; else timers.delete(id);
      try { next.fn(...next.args); } catch (e) { console.error(e); }
      await new Promise((r) => realTimeout(r, 0));
    }
    now = end;
    for (const a of document.getAnimations()) {
      if (a.__from === undefined) { a.__from = from; a.pause(); }
      a.currentTime = now - a.__from;
    }
  };

  // Smooth scrolling, driven by the same clock (an ease in and out over 0.9 s).
  const jump = window.scrollTo.bind(window);
  let scrolling = 0;
  const glide = (top) => {
    const from = window.scrollY, max = document.documentElement.scrollHeight - innerHeight;
    const to = Math.max(0, Math.min(top, max)), began = now, dur = 900;
    clearTimeout(scrolling);
    const step = () => {
      const p = Math.min(1, (now - began) / dur);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      jump(0, from + (to - from) * e);
      if (p < 1) scrolling = setTimeout(step, 1000 / 60);
    };
    step();
  };
  window.scrollTo = (a, b) => (a && typeof a === "object" && a.behavior === "smooth") ? glide(a.top ?? scrollY) : jump(a, b);
  const into = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (opt) {
    if (!opt || typeof opt !== "object" || opt.behavior !== "smooth") return into.call(this, opt);
    const r = this.getBoundingClientRect(), margin = parseFloat(getComputedStyle(this).scrollMarginTop) || 0;
    glide(opt.block === "center" ? scrollY + r.top - (innerHeight - r.height) / 2 : scrollY + r.top - margin);
  };

  const css = '.tray>section:first-child{display:none!important}.toast{display:none!important}' +
    '.vo-ripple{position:fixed;width:46px;height:46px;border-radius:50%;border:3px solid #226192;pointer-events:none;z-index:99997;transform:translate(-50%,-50%) scale(.4);animation:vo-ripple .6s ease-out forwards}' +
    '@keyframes vo-ripple{to{transform:translate(-50%,-50%) scale(1.8);opacity:0}}';
  const addCss = () => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addCss); else addCss();
  window.__ripple = (x, y) => { const r = document.createElement("div"); r.className = "vo-ripple"; r.style.left = x + "px"; r.style.top = y + "px"; document.body.appendChild(r); setTimeout(() => r.remove(), 700); };
})();`;

const browser = await chromium.launch({ channel: "chrome" }); // the Google Chrome already installed on this Mac
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DPR, colorScheme: "light" });
await context.addInitScript(SETUP);
const page = await context.newPage();
page.on("pageerror", (e) => console.log("page error:", e.message));

// Frames go straight into ffmpeg as JPEGs and come out as one H.264 video.
fs.mkdirSync(PUBLIC, { recursive: true });
const ffmpeg = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  "-vf", "scale=2560:1440:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-g", "15", "-r", String(FPS), "-an",
  path.join(PUBLIC, "site.mp4")], { stdio: ["pipe", "inherit", "inherit"] });
const ffmpegDone = new Promise((r) => ffmpeg.on("close", r));

let frame = 0;
const now = () => frame / FPS; // seconds of video so far
async function step() {
  await page.evaluate((ms) => window.__advance(ms), 1000 / FPS);
  const jpeg = await page.screenshot({ type: "jpeg", quality: 93 });
  if (!ffmpeg.stdin.write(jpeg)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
  frame++;
  if (frame % 300 === 0) console.log(`  ${frame} frames (${now().toFixed(0)}s)`);
}
const wait = async (ms) => { const end = frame + Math.round((ms / 1000) * FPS); while (frame < end) await step(); };
async function until(fn, arg, label) {
  const limit = frame + 90 * FPS;
  while (!(await page.evaluate(fn, arg))) {
    if (frame > limit) throw new Error("waited too long for " + label);
    await step();
  }
}
const pill = (text) => until((t) => document.getElementById("statusPill")?.innerText === t, text, text);
const key = (k) => page.keyboard.press(k);
async function release(name) {
  await until((n) => window.__waitingFor === n, name, name);
  await page.evaluate((n) => window.__release(n), name);
}
async function click(selector) {
  const box = await page.locator(selector).boundingBox();
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.evaluate(([x, y]) => window.__ripple(x, y), [x, y]);
  await page.mouse.click(x, y); // the locked Merge button still takes clicks (it shakes)
}

const marks = {}; // scene starts, in seconds
const moments = {}; // key moments inside scenes, in seconds
const boxes = {}; // where things are on screen at a moment (fractions of the frame)
const moment = (name) => { moments[name] = now(); };
async function boxOf(name, selector) {
  boxes[name] = await page.evaluate(([sel, w, h]) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r && { x: r.left / w, y: r.top / h, w: r.width / w, h: r.height / h };
  }, [selector, VIEW.width, VIEW.height]);
}
// One scene: note when it starts, do its actions, and hold until its voice line (plus PAD) has finished.
async function scene(id, actions, seconds = LINES[id] ? LINES[id].seconds + PAD : 0) {
  const start = now();
  marks[id] = start;
  console.log(`scene ${id} at ${start.toFixed(1)}s`);
  if (actions) await actions(start);
  const left = seconds - (now() - start);
  if (left > 0) await wait(left * 1000);
  else if (seconds) console.log(`  ${id} ran ${(-left).toFixed(1)}s longer than its line`);
}
const at = async (start, s) => { if (now() < start + s) await wait((start + s - now()) * 1000); };

await page.goto(`${BASE}/index.html#/overview?steps`);
await page.evaluate(() => document.fonts.ready);
await wait(1000);

await scene("overview");
await scene("change", async () => {
  await page.evaluate(() => { location.hash = "#/change"; });
  await wait(1500);
  await page.evaluate(() => window.scrollTo({ top: 150, behavior: "smooth" }));
});
await scene("check1", async () => {
  await key("r");
  await release("callers");
  await wait(2500);
  await boxOf("callers", "#chkCallers");
});
await scene("check2", async () => {
  await release("money");
  await wait(2500);
  await boxOf("money", "#chkMoney");
});
await scene("stopped", async () => {
  await release("signoff");
  await pill("Stopped");
  moment("stopped");
  await wait(1600);
  await boxOf("verdictStopped", "#verdict");
  await boxOf("mergeBoxStopped", "#mergeBox");
  await boxOf("mergeLocked", "#bMerge");
  moment("mergeClick");
  await click("#bMerge");
}, LINES.stopped.seconds + 0.4); // the "two ways forward" card follows straight on
await scene("fix", async (start) => {
  await page.evaluate(() => { window.__auto = setInterval(() => window.__waitingFor && window.__release(window.__waitingFor), 60); });
  await at(start, 1.4);
  await key("f");
  await page.evaluate(() => window.__setSpeed(1.5)); // so "all clear" lands on the right words
  await pill("All clear");
  await page.evaluate(() => window.__setSpeed(1));
  moment("allClear");
  await wait(1200);
  await boxOf("verdictClear", "#verdict");
  await boxOf("mergeBoxClear", "#mergeBox");
  await boxOf("mergeOpen", "#bMerge");
  await page.evaluate(() => document.getElementById("bMerge")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  await wait(1000);
  await boxOf("mergeOpenCentered", "#bMerge");
  moment("mergeUnlocked");
}, LINES.fix.seconds + 0.3);
// No voice: back to the stopped change, hidden behind the "path two" card in the video.
await scene("rewind", async () => {
  await page.evaluate(() => window.__setSpeed(40));
  await key("0");
  await wait(100);
  await key("r");
  await pill("Stopped");
  await page.evaluate(() => { window.__setSpeed(1); window.scrollTo(0, 150); });
}, 0.5);
await scene("approve", async (start) => {
  await at(start, 2.6);
  await key("a");
  moment("signing");
  await pill("Countersigned");
  moment("countersigned");
  await wait(1200);
  await boxOf("signoff", "#chkSignoff");
  await boxOf("verdictSigned", "#verdict");
  await boxOf("mergeBoxSigned", "#mergeBox");
  await at(start, 9.0);
  await boxOf("mergeSigned", "#bMerge");
  moment("mergeClick2");
  await click("#bMerge");
  await pill("Merged");
  moment("merged");
  await wait(300);
  await boxOf("verdictMerged", "#verdict");
});
await scene("audit", async () => {
  await page.evaluate(() => { location.hash = "#/audit"; });
  await wait(1400);
  await page.evaluate(() => {
    const el = document.querySelectorAll(".doc-s")[3];
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 220, behavior: "smooth" });
  });
});
marks.end = now();
await wait(500);

ffmpeg.stdin.end();
await ffmpegDone;
await browser.close();
server.close();
fs.writeFileSync(path.join(PUBLIC, "site-marks.json"), JSON.stringify({ pad: PAD, marks, moments, boxes }, null, 2));
console.log("saved remotion/public/site.mp4 and site-marks.json");
console.log({ marks, moments });
