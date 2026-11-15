import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import gh from "../../public/gh/gh.json";
import { FRAME, H, makeCamera, RAIL, TAG, W } from "../stage";
import { C, MONO, SANS } from "../theme";
import { DUR, ghAt, ghSaid, GH_LINES, line } from "../timing";
import type { Box } from "../timing";
import { BrowserFrame, Captions, Chip, easeOut, Highlight, Paper, Steps } from "../ui";

// The real GitHub demo, from pictures taken while it ran (capture_github_live.mjs):
// the pull request, the checks running and failing, the evidence, the fix, the checks going green.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const XF = 10; // frames to cross-fade from one picture to the next

type Shot = (typeof gh.shots)[number];
const SHOT: Record<string, Shot> = Object.fromEntries(gh.shots.map((s) => [s.id, s]));
// A run is photographed every few seconds, so a fast run has fewer pictures: take the nearest earlier one.
const near = (id: string): string => {
  if (SHOT[id]) return id;
  const m = id.match(/^(.*)-(\d+)$/);
  if (!m) throw new Error(`no picture called ${id}`);
  for (let n = Number(m[2]) - 1; n >= 0; n--) if (SHOT[`${m[1]}-${String(n).padStart(2, "0")}`]) return `${m[1]}-${String(n).padStart(2, "0")}`;
  return `${m[1]}-done`;
};
// The first picture of a run where its state (as GitHub reported it then) contains these words.
const pick = (run: string, words: string): string =>
  gh.shots.find((x) => x.id.startsWith(run + "-") && ((x as { state?: string }).state ?? "").includes(words))?.id ?? `${run}-done`;
const BAD = { tests: pick("bad", "Normal tests:success"), running: pick("bad", "Countersign:in_progress") };
const FIX = { tests: pick("fix", "Normal tests:success") };
const mark = (id: string, name: string) => (SHOT[near(id)].marks as Record<string, Box | null | undefined>)[name] ?? null;
// The changed lines in the diff sit a fixed distance under the file's header, wherever the page was scrolled to.
const FILE = mark("pr-files", "file") ?? { x: 0.276, y: 0.208, w: 0.661, h: 0.044 };
const HAND: Record<string, Box> = {
  diff: { x: 0.348, y: FILE.y + 0.181, w: 0.47, h: 0.111 },
  pushed: { x: 0.098, y: 0.594, w: 0.37, h: 0.042 }, // the fix commit in the pull request's timeline
};

type Ring = { box: Box | null; color: string; at: number };
type Cam = { z: number; x: number; y: number };
type Step = { id: string; from: number; cam: Cam; rings?: Ring[]; tag?: [string, string, string?] };

const RUN: Cam = { z: 1.32, x: 0.36, y: 0.54 }; // left edge on the page edge, top just under the tabs
const COMMENT: Cam = { z: 1.5, x: 0.39, y: 0.37 };
const STEPS: Step[] = [
  { id: "pr-top", from: 0, cam: { z: 1, x: 0.5, y: 0.5 }, tag: ["The pull request", "GITHUB"] },
  { id: "pr-top", from: ghSaid("gh1", "Here is the same"), cam: { z: 1.4, x: 0.36, y: 0.42 } },
  { id: "pr-files", from: ghSaid("gh1", "and the line that") - 0.2, cam: { z: 1.5, x: 0.58, y: FILE.y + 0.25 }, rings: [{ box: HAND.diff, color: C.stop, at: 0.9 }], tag: ["The change", "GITHUB"] },
  { id: near("bad-00"), from: ghAt("gh2") - 0.15, cam: RUN, tag: ["The checks run", "GITHUB"] },
  { id: BAD.tests, from: ghSaid("gh2", "The normal tests pass") - 0.1, cam: RUN, rings: [{ box: mark(BAD.tests, "tests"), color: C.clear, at: 0.3 }] },
  { id: BAD.running, from: ghSaid("gh2", "Then Countersign runs") - 0.1, cam: RUN },
  { id: "bad-done", from: ghSaid("gh2", "and fails") - 0.15, cam: RUN, rings: [{ box: mark("bad-done", "countersign"), color: C.stop, at: 0.2 }, { box: mark("bad-done", "status"), color: C.stop, at: 0.7 }], tag: ["Countersign fails", "GITHUB", C.stop] },
  { id: "comment-stopped", from: ghAt("gh3") - 0.15, cam: COMMENT, rings: [{ box: mark("comment-stopped", "evidence"), color: C.stop, at: said3("a nine hundred") }], tag: ["The evidence, on the pull request", "GITHUB", C.stop] },
  { id: "pr-pushed", from: ghAt("gh4") - 0.15, cam: { z: 1.9, x: 0.32, y: 0.5 }, rings: [{ box: HAND.pushed, color: C.clear, at: 0.6 }], tag: ["The fix is pushed", "GITHUB", C.clear] },
  { id: near("fix-00"), from: ghSaid("gh4", "GitHub runs both") - 0.15, cam: RUN, tag: ["The checks run again", "GITHUB", C.clear] },
  { id: FIX.tests, from: ghSaid("gh4", "on the new commit") - 0.1, cam: RUN, rings: [{ box: mark(FIX.tests, "tests"), color: C.clear, at: 0.2 }] },
  { id: "fix-done", from: ghSaid("gh4", "This time") - 0.1, cam: RUN, rings: [{ box: mark("fix-done", "countersign"), color: C.clear, at: 0.2 }, { box: mark("fix-done", "status"), color: C.clear, at: 0.6 }], tag: ["Both checks pass", "GITHUB", C.clear] },
  { id: "comment-clear", from: ghAt("gh5") - 0.15, cam: COMMENT, rings: [{ box: mark("comment-clear", "verdict"), color: C.clear, at: 0.7 }], tag: ["All clear", "GITHUB", C.clear] },
];
function said3(phrase: string) {
  return ghSaid("gh3", phrase) - (ghAt("gh3") - 0.15);
}
const END = DUR.github / 30;
const pageOf = (id: string) => id.replace(/-.*/, "");
// A new page starts already framed; on the same page the camera glides.
const camera = makeCamera(STEPS.map((s, i) => ({ t: s.from, ...s.cam, snap: i > 0 && pageOf(STEPS[i - 1].id) !== pageOf(s.id) })), 1.2);

// GitHub's own answer about the merge: real output of `gh pr view`, saved when the pictures were taken.
const TERMINALS = [
  { from: ghSaid("gh3", "And GitHub blocks") - 0.2, to: ghAt("gh4") - 0.2, state: gh.blocked },
  { from: ghSaid("gh5", "and GitHub lets") - 0.2, to: END + 1, state: gh.clean },
];
type MergeState = typeof gh.blocked;
const checksOf = (s: MergeState) => {
  const last: Record<string, string> = {};
  for (const c of s.statusCheckRollup) last[c.name] = c.conclusion;
  return Object.entries(last);
};

// A live-run clock while the checks run: real seconds since the first picture of that run.
const RUNS = [
  { ids: [near("bad-00"), BAD.tests, BAD.running, "bad-done"], label: "CHECKS RUNNING" },
  { ids: [near("fix-00"), FIX.tests, "fix-done"], label: "NEW COMMIT · CHECKS RUNNING" },
];

const Picture: React.FC<{ step: Step; first: boolean; navigate: boolean }> = ({ step, first, navigate }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = first ? 1 : interpolate(frame, [0, XF], [0, 1], { ...clamp, easing: easeOut });
  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade, translate: navigate ? `0 ${(1 - fade) * 14}px` : undefined }}>
      <Img src={staticFile(`gh/${SHOT[step.id].file}`)} style={{ width: W, height: H, display: "block" }} />
      {(step.rings ?? []).map((r, i) =>
        r.box ? <Highlight key={i} x={r.box.x * W - 5} y={r.box.y * H - 5} w={r.box.w * W + 10} h={r.box.h * H + 10} color={r.color} delay={Math.round(r.at * fps)} /> : null,
      )}
    </div>
  );
};

// GitHub's thin blue bar that runs along the top while a page loads.
const LoadBar: React.FC = () => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 12], [0, 1], { ...clamp, easing: easeOut });
  return <div style={{ position: "absolute", left: 0, top: 0, height: 4, width: `${p * 100}%`, background: "#0969da", opacity: interpolate(frame, [10, 16], [1, 0], clamp), zIndex: 3 }} />;
};

const Terminal: React.FC<{ state: MergeState }> = ({ state }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });
  const cmd = `gh pr view ${gh.pr} --json mergeStateStatus`;
  const typed = Math.floor(interpolate(frame, [0.2 * fps, 0.8 * fps], [0, cmd.length], clamp));
  const out = frame >= 0.95 * fps;
  const pop = spring({ frame: frame - Math.round(0.95 * fps), fps, config: { damping: 12, stiffness: 170 } });
  const glow = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 2.2);
  const ok = state.mergeStateStatus === "CLEAN";
  const tone = ok ? "#5fd39a" : "#ff8a80";
  // The command, on two lines so it fits the rail.
  const flat = cmd.replace(" --json", "\n  --json");
  const checks = checksOf(state);
  return (
    <div style={{ position: "absolute", left: RAIL.x, top: RAIL.notes, width: RAIL.width, boxSizing: "border-box", borderRadius: 16, overflow: "hidden", background: C.night, fontFamily: MONO,
      boxShadow: "0 24px 56px rgba(20,15,5,0.3), 0 0 0 1px rgba(0,0,0,0.3)",
      opacity: Math.min(1, enter * 1.4), translate: `0 ${interpolate(enter, [0, 1], [26, 0])}px` }}>
      <div style={{ height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", background: "#22201d" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => <div key={c} style={{ width: 11, height: 11, borderRadius: 6, background: c }} />)}
        <div style={{ marginLeft: 10, color: "#9a938a", fontSize: 15 }}>GitHub CLI</div>
      </div>
      <div style={{ padding: "20px 24px 24px", fontSize: 20, lineHeight: 1.5, color: "#eeeae3" }}>
        <div style={{ whiteSpace: "pre" }}><span style={{ color: "#7db4e0" }}>$ </span>{flat.slice(0, typed + 3)}<span style={{ opacity: !out && frame % 16 < 9 ? 1 : 0, color: C.spark }}>▍</span></div>
        <div style={{ marginTop: 14, opacity: out ? Math.min(1, pop * 1.5) : 0 }}>
          <div style={{ color: "#9a938a" }}>mergeStateStatus</div>
          <div style={{ display: "inline-block", color: tone, fontWeight: 600, fontSize: 44, lineHeight: 1.2, transformOrigin: "left center", scale: String(interpolate(pop, [0, 1], [1.25, 1])),
            textShadow: `0 0 ${10 + 14 * glow}px ${ok ? "rgba(95,211,154," : "rgba(255,90,80,"}${0.3 + 0.3 * glow})` }}>{state.mergeStateStatus}</div>
        </div>
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #3a3733", fontSize: 18, color: "#c9c3ba", opacity: interpolate(frame, [1.4 * fps, 1.9 * fps], [0, 1], clamp) }}>
          <div style={{ color: "#9a938a", marginBottom: 4 }}>required checks</div>
          {checks.map(([n, c]) => (
            <div key={n} style={{ display: "flex", justifyContent: "space-between" }}><span>{n}</span><span style={{ color: c === "SUCCESS" ? "#5fd39a" : "#ff8a80" }}>{c === "SUCCESS" ? "passed" : "failed"}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
};

const RunClock: React.FC<{ t: number }> = ({ t }) => {
  for (const run of RUNS) {
    const steps = STEPS.filter((s) => run.ids.includes(s.id));
    const from = steps[0].from, to = STEPS[STEPS.indexOf(steps[steps.length - 1]) + 1]?.from ?? END;
    if (t < from - 0.1 || t > to + 0.3) continue;
    const cur = [...steps].reverse().find((s) => s.from <= t) ?? steps[0];
    const secs = Math.round(SHOT[cur.id].t - SHOT[run.ids[0]].t);
    const show = interpolate(t, [from - 0.1, from + 0.3, to, to + 0.3], [0, 1, 1, 0], clamp);
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
    const done = cur.id.endsWith("done");
    return (
      <div style={{ position: "absolute", right: 1920 - FRAME.x - FRAME.width, top: TAG.y, opacity: show, display: "flex", alignItems: "center", gap: 14, fontFamily: MONO,
        background: C.sheet, borderRadius: 12, padding: "10px 18px", boxShadow: "0 14px 34px rgba(40,30,15,0.18)", fontSize: 20, color: C.ink2, letterSpacing: "0.06em" }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: done ? C.muted : "#d29922", boxShadow: done ? "none" : `0 0 0 ${3 + pulse * 5}px rgba(210,153,34,${0.3 - pulse * 0.25})` }} />
        {run.label}
        <span style={{ color: C.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums", minWidth: 60 }}>+{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</span>
        <span style={{ color: C.muted, fontSize: 17 }}>real time</span>
      </div>
    );
  }
  return null;
};

export const GitHub: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cam = camera(t);
  const f = (s: number) => Math.round(s * fps);
  const cur = [...STEPS].reverse().find((s) => s.from <= t) ?? STEPS[0];
  const tags = STEPS.filter((s) => s.tag);
  return (
    <AbsoluteFill style={{ fontFamily: SANS }}>
      <Paper deep />
      <BrowserFrame x={FRAME.x} y={FRAME.y} width={FRAME.width} url={SHOT[cur.id].url}>
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0", transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.z})` }}>
          {STEPS.map((s, i) => {
            const prev = STEPS[i - 1];
            if (prev && prev.id === s.id) return null; // same picture, only the camera moves
            let j = i + 1;
            while (STEPS[j] && STEPS[j].id === s.id) j++;
            const until = STEPS[j] ? STEPS[j].from : END + 1;
            return (
              <Sequence key={i} from={f(s.from)} durationInFrames={f(until - s.from) + (STEPS[j] && pageOf(STEPS[j].id) !== pageOf(s.id) ? 0 : XF + 2)} layout="none">
                <Picture step={{ ...s, rings: STEPS.slice(i, j).flatMap((x) => (x.rings ?? []).map((r) => ({ ...r, at: r.at + x.from - s.from }))) }} first={i === 0} navigate={!!prev && pageOf(prev.id) !== pageOf(s.id)} />
              </Sequence>
            );
          })}
        </div>
        {STEPS.map((s, i) => (i > 0 && SHOT[s.id].url !== SHOT[STEPS[i - 1].id].url && STEPS[i - 1].id !== s.id) ? (
          <Sequence key={`bar${i}`} from={f(s.from)} durationInFrames={20} layout="none"><LoadBar /></Sequence>
        ) : null)}
      </BrowserFrame>

      {tags.map((s, i) => {
        const until = tags[i + 1]?.from ?? END;
        const [label, sub, color] = s.tag!;
        return (
          <Sequence key={i} from={f(s.from)} durationInFrames={f(until - s.from)} layout="none">
            <Chip label={label} sub={sub} color={color ?? C.ink} duration={f(until - s.from)} x={TAG.x} y={TAG.y} />
          </Sequence>
        );
      })}
      <Steps current={8} />
      <RunClock t={t} />
      {TERMINALS.map((m, i) => (
        <Sequence key={i} from={f(m.from)} durationInFrames={f(m.to - m.from)} layout="none">
          <TerminalOut len={f(m.to - m.from)}><Terminal state={m.state} /></TerminalOut>
        </Sequence>
      ))}
      {STEPS.slice(1).filter((s, i) => pageOf(s.id) !== pageOf(STEPS[i].id)).map((s, i) => (
        <Sequence key={i} from={f(s.from) - 2} durationInFrames={30} layout="none">
          <Audio src={staticFile("sfx/whoosh.wav")} volume={0.08} />
        </Sequence>
      ))}
      {GH_LINES.map((id) => (
        <Sequence key={id} from={f(ghAt(id))} durationInFrames={f(line(id).seconds + 0.6)}>
          <Audio src={staticFile(`voice/${id}.wav`)} />
          <Captions text={line(id).text} seconds={line(id).seconds} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// Fades a terminal card out at the end of its time.
const TerminalOut: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const frame = useCurrentFrame();
  return <div style={{ opacity: interpolate(frame, [len - 10, len], [1, 0], clamp) }}>{children}</div>;
};
