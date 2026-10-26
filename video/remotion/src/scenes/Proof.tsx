import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import sizes from "../../public/github/sizes.json";
import terminal from "../../public/github/terminal.json";
import { C, MONO, SANS } from "../theme";
import { DUR, line, proof2At, said, VOICE_IN } from "../timing";
import { Captions, easeOut, Highlight, Paper } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const AREA = { cx: 960, top: 214, maxW: 1500, maxH: 690 }; // where the cards sit
const OUT = 14; // frames a card takes to leave

type ShotName = keyof typeof sizes;
type MarkBox = { x: number; y: number; w: number; h: number };
// A ring drawn around one part of a screenshot, `at` seconds after the card arrives.
type Ring = { mark: string; color: string; at: number };
// A slow zoom into the area around some marks, starting `at` seconds after the card arrives.
type Zoom = { marks: string[]; z: number; at: number };

const P = VOICE_IN.proof, P2 = proof2At;
const inProof = (phrase: string) => P + said("proof", phrase);
const inProof2 = (phrase: string) => P2 + said("proof2", phrase);
const END = DUR.proof / 30;

const RUN = `github.com/${terminal.repo}/actions/runs`;
const RUN_ZOOM = (at: number): Zoom => ({ marks: ["status", "tests", "countersign"], z: 1.75, at });
const CARDS: { shot: ShotName | "terminal"; from: number; to: number; url: string; rings?: Ring[]; zoom?: Zoom; maxW?: number }[] = [
  // "This isn't a mock-up. Countersign runs today, as a real check on GitHub."
  { shot: "pr_head", from: 0.1, to: inProof("On this pull request") - 0.1, url: `github.com/${terminal.repo}/pull/${terminal.pr}`, maxW: 1720 },
  // "On this pull request, the normal tests pass, Countersign fails,"
  {
    shot: "run_failed", from: inProof("On this pull request") - 0.1, to: inProof("and GitHub blocks") - 0.15, url: RUN, zoom: RUN_ZOOM(0.5),
    rings: [
      { mark: "tests", color: C.clear, at: said("proof", "the normal tests") - said("proof", "On this pull request") + 0.3 },
      { mark: "countersign", color: C.stop, at: said("proof", "Countersign fails") - said("proof", "On this pull request") + 0.2 },
      { mark: "status", color: C.stop, at: said("proof", "Countersign fails") - said("proof", "On this pull request") + 0.8 },
    ],
  },
  // "and GitHub blocks the merge."
  { shot: "terminal", from: inProof("and GitHub blocks") - 0.15, to: P2 - 0.1, url: "" },
  // "It posts the evidence right on the pull request,"
  {
    shot: "comment", from: P2 - 0.1, to: inProof2("and saves the audit") - 0.1, url: `github.com/${terminal.repo}/pull/${terminal.pr}`,
    rings: [{ mark: "money", color: C.stop, at: 0.7 }, { mark: "apps", color: C.caution, at: 1.5 }],
  },
  // "and saves the audit record with the run."
  { shot: "artifact", from: inProof2("and saves the audit") - 0.1, to: inProof2("When the fix") - 0.1, url: RUN, rings: [{ mark: "row", color: C.pen, at: 0.6 }] },
  // "When the fix is pushed, every check turns green."
  {
    shot: "run_green", from: inProof2("When the fix") - 0.1, to: END + 1, url: RUN, zoom: RUN_ZOOM(0.3),
    rings: [
      { mark: "tests", color: C.clear, at: said("proof2", "every check") - said("proof2", "When the fix") + 0.1 },
      { mark: "countersign", color: C.clear, at: said("proof2", "every check") - said("proof2", "When the fix") + 0.4 },
      { mark: "status", color: C.clear, at: said("proof2", "every check") - said("proof2", "When the fix") + 0.8 },
    ],
  },
];

// One card arriving from below (soft blur, slight tilt), drifting gently, then lifting away.
const CardMotion: React.FC<{ len: number; last: boolean; children: React.ReactNode }> = ({ len, last, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 110, mass: 0.9 } });
  const leave = last ? 0 : interpolate(frame, [len - OUT, len], [0, 1], { ...clamp, easing: easeOut });
  const drift = interpolate(frame, [0, len], [1, 1.025]);
  return (
    <AbsoluteFill style={{
      opacity: Math.min(1, enter * 1.3) * (1 - leave),
      translate: `0 ${interpolate(enter, [0, 1], [90, 0]) - 60 * leave}px`,
      scale: String(interpolate(enter, [0, 1], [0.95, 1]) * drift * (1 - 0.04 * leave)),
      filter: `blur(${interpolate(enter, [0, 1], [10, 0]) + 8 * leave}px)`,
      transform: `perspective(1600px) rotateX(${interpolate(enter, [0, 1], [10, 0])}deg)`,
    }}>
      {children}
    </AbsoluteFill>
  );
};

const Shot: React.FC<{ shot: ShotName; url: string; rings: Ring[]; zoom?: Zoom; maxW?: number }> = ({ shot, url, rings, zoom, maxW = AREA.maxW }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const size = sizes[shot];
  const s = Math.min(maxW / size.width, (AREA.maxH - 44) / size.height);
  const w = size.width * s, h = size.height * s;
  const marks = size.marks as Record<string, MarkBox | null>;
  // Zoom: move the middle of the chosen marks to the middle of the card while scaling up (the screenshot is 3x, so it stays sharp).
  let move = "none";
  if (zoom) {
    const ms = zoom.marks.map((k) => marks[k]).filter((m): m is MarkBox => !!m);
    const cx = (Math.min(...ms.map((m) => m.x)) + Math.max(...ms.map((m) => m.x + m.w))) / 2;
    const cy = (Math.min(...ms.map((m) => m.y)) + Math.max(...ms.map((m) => m.y + m.h))) / 2;
    const p = interpolate(frame, [zoom.at * fps, (zoom.at + 1.4) * fps], [0, 1], { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) });
    const z = 1 + (zoom.z - 1) * p;
    move = `translate(${(0.5 - cx) * w * p}px, ${(0.5 - cy) * h * p}px) translate(${cx * w}px, ${cy * h}px) scale(${z}) translate(${-cx * w}px, ${-cy * h}px)`;
  }
  return (
    <div style={{ position: "absolute", left: AREA.cx - w / 2, top: AREA.top + (AREA.maxH - h - 44) / 2, width: w, borderRadius: 18, overflow: "hidden", background: "#fff",
      boxShadow: "0 50px 100px rgba(40,30,15,0.26), 0 12px 30px rgba(40,30,15,0.12), 0 0 0 1px rgba(26,26,26,0.08)" }}>
      <div style={{ height: 44, display: "flex", alignItems: "center", gap: 12, padding: "0 18px", background: "#f6f4ef", borderBottom: "1px solid #e4dfd5", fontFamily: MONO, fontSize: 18, color: C.muted }}>
        <svg width="20" height="20" viewBox="0 0 16 16"><path fill={C.ink} d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" /></svg>
        {url}
      </div>
      <div style={{ position: "relative", width: w, height: h, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, transform: move, transformOrigin: "0 0" }}>
        <Img src={staticFile(`github/${shot}.png`)} style={{ width: w, height: h, display: "block" }} />
        {rings.map((r, i) => {
          const m = marks[r.mark];
          if (!m) return null;
          return <Highlight key={i} x={m.x * w - 4} y={m.y * h - 4} w={m.w * w + 8} h={m.h * h + 8} color={r.color} delay={Math.round(r.at * fps)} />;
        })}
        </div>
      </div>
    </div>
  );
};

// The real state of the pull request, as GitHub's own command-line tool reports it.
const Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cmd = `gh pr view ${terminal.pr} --json mergeStateStatus`;
  const typed = Math.floor(interpolate(frame, [0.25 * fps, 0.95 * fps], [0, cmd.length], clamp));
  const out = frame >= 1.1 * fps;
  const pop = spring({ frame: frame - Math.round(1.1 * fps), fps, config: { damping: 12, stiffness: 160 } });
  const glow = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 2.2);
  const w = 1240;
  return (
    <div style={{ position: "absolute", left: AREA.cx - w / 2, top: AREA.top + 70, width: w, borderRadius: 18, overflow: "hidden", background: C.night,
      boxShadow: "0 50px 100px rgba(40,30,15,0.32), 0 0 0 1px rgba(0,0,0,0.3)", fontFamily: MONO }}>
      <div style={{ height: 46, display: "flex", alignItems: "center", gap: 9, padding: "0 18px", background: "#22201d" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
        <div style={{ margin: "0 auto", color: "#9a938a", fontSize: 18 }}>GitHub CLI · {terminal.repo}</div>
        <div style={{ width: 66 }} />
      </div>
      <div style={{ padding: "34px 40px 44px", fontSize: 30, lineHeight: 1.6, color: "#eeeae3" }}>
        <div><span style={{ color: "#7db4e0" }}>$ </span>{cmd.slice(0, typed)}<span style={{ opacity: !out && frame % 16 < 9 ? 1 : 0, color: C.spark }}>▍</span></div>
        {out ? (
          <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 18, opacity: Math.min(1, pop * 1.5) }}>
            <span>{"{ \"mergeStateStatus\": "}</span>
            <span style={{ display: "inline-block", color: "#ff8a80", fontWeight: 600, fontSize: 44, scale: String(interpolate(pop, [0, 1], [1.6, 1])),
              textShadow: `0 0 ${10 + 14 * glow}px rgba(255,90,80,${0.35 + 0.3 * glow})` }}>"{terminal.mergeState}"</span>
            <span>{"}"}</span>
          </div>
        ) : null}
        <div style={{ marginTop: 26, color: "#9a938a", fontSize: 24, opacity: interpolate(frame, [1.6 * fps, 2.1 * fps], [0, 1], clamp) }}>
          # main only accepts a change when both pass: {terminal.required.join(" and ")}
        </div>
      </div>
    </div>
  );
};

export const Proof: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = spring({ frame, fps, config: { damping: 200 } });
  const pulse = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 2);
  const f = (s: number) => Math.round(s * fps);
  return (
    <AbsoluteFill style={{ fontFamily: SANS }}>
      <Paper />
      <div style={{ position: "absolute", left: 0, right: 0, top: 52, textAlign: "center", opacity: head, translate: `0 ${interpolate(head, [0, 1], [-20, 0])}px` }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, fontFamily: MONO, fontSize: 22, letterSpacing: "0.14em", color: C.clear, fontWeight: 500 }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: C.clear, boxShadow: `0 0 0 ${4 + pulse * 6}px rgba(23,115,74,${0.25 - pulse * 0.2})` }} />
          LIVE ON GITHUB
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, color: C.ink, letterSpacing: "-0.025em", marginTop: 6 }}>This runs for real, on a real pull request</div>
      </div>
      {CARDS.map((c, i) => {
        const len = f(c.to - c.from) + OUT;
        return (
          <Sequence key={i} name={c.shot} from={f(c.from)} durationInFrames={len} layout="none">
            <CardMotion len={len} last={i === CARDS.length - 1}>
              {c.shot === "terminal" ? <Terminal /> : <Shot shot={c.shot} url={c.url} rings={c.rings ?? []} zoom={c.zoom} maxW={c.maxW} />}
            </CardMotion>
          </Sequence>
        );
      })}
      {CARDS.slice(1).map((c, i) => (
        <Sequence key={i} from={f(c.from)} layout="none">
          <Audio src={staticFile("sfx/whoosh.wav")} volume={0.08} />
        </Sequence>
      ))}
      <Sequence from={f(P)}>
        <Audio src={staticFile("voice/proof.wav")} />
        <Captions text={line("proof").text} seconds={line("proof").seconds} />
      </Sequence>
      <Sequence from={f(P2)}>
        <Audio src={staticFile("voice/proof2.wav")} />
        <Captions text={line("proof2").text} seconds={line("proof2").seconds} />
      </Sequence>
    </AbsoluteFill>
  );
};
