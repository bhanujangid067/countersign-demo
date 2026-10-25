import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO, SANS } from "../theme";
import { DUR, line, proof2At, VOICE_IN } from "../timing";
import { BrowserFrame, Callout, Captions, Cross, easeOut, Highlight, Paper, Tick } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const WIN = { x: 300, y: 214, width: 1320 };
const VW = WIN.width;

// One real GitHub screenshot: where the camera starts and ends (x, y, width in image pixels),
// and the boxes to draw around what matters (x, y, w, h in image pixels, appearing `at` seconds in).
type Mark = { box: [number, number, number, number]; color: string; at: number };
type Shot = { src: string; start: number; end: number; from: [number, number, number]; to: [number, number, number]; marks: Mark[] };

const P = VOICE_IN.proof, PL = line("proof").seconds, P2 = proof2At, P2L = line("proof2").seconds;
const SHOTS: Shot[] = [
  // "This isn't a mock-up. Countersign runs today, as a real check on GitHub."
  { src: "github/pr.png", start: 0, end: P + PL * 0.45, from: [0, 0, 2880], to: [120, 300, 2300], marks: [] },
  // "On this pull request, the normal tests pass, Countersign fails,"
  {
    src: "github/run_failed.png", start: P + PL * 0.45, end: P + PL * 0.82, from: [48, 380, 2784], to: [600, 820, 1700],
    marks: [
      { box: [760, 1008, 522, 88], color: C.clear, at: 0.5 },
      { box: [1393, 1008, 523, 88], color: C.stop, at: 1.1 },
      { box: [752, 1572, 1500, 98], color: C.stop, at: 1.9 },
    ],
  },
  // "and GitHub blocks the merge."
  {
    src: "github/merge_blocked.jpg", start: P + PL * 0.82, end: P2, from: [150, 40, 1150], to: [250, 96, 820],
    marks: [
      { box: [288, 236, 744, 30], color: C.stop, at: 0.4 },
      { box: [290, 346, 172, 36], color: C.stop, at: 1.0 },
    ],
  },
  // "It posts the evidence right on the pull request."
  {
    src: "github/pr.png", start: P2, end: P2 + P2L * 0.47, from: [200, 1080, 1900], to: [300, 1290, 1180],
    marks: [{ box: [364, 1408, 960, 132], color: C.stop, at: 0.7 }],
  },
  // "And when the fix is pushed,"
  {
    src: "github/run_green.png", start: P2 + P2L * 0.47, end: P2 + P2L * 0.78, from: [48, 380, 2784], to: [600, 820, 1700],
    marks: [
      { box: [760, 1008, 522, 88], color: C.clear, at: 0.3 },
      { box: [1393, 1008, 523, 88], color: C.clear, at: 0.6 },
    ],
  },
  // "every check turns green."
  {
    src: "github/merge_green.jpg", start: P2 + P2L * 0.78, end: DUR.proof / 30 + 1, from: [150, 40, 1150], to: [250, 100, 820],
    marks: [
      { box: [288, 166, 740, 48], color: C.clear, at: 0.3 },
      { box: [290, 312, 172, 38], color: C.clear, at: 0.8 },
    ],
  },
];

const ShotView: React.FC<{ shot: Shot; first: boolean }> = ({ shot, first }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const len = (shot.end - shot.start) * fps;
  const p = interpolate(frame, [0, len], [0, 1], { ...clamp, easing: easeOut });
  const [x, y, w] = shot.from.map((v, i) => v + (shot.to[i] - v) * p);
  const scale = VW / w;
  const fadeIn = first ? 1 : interpolate(frame, [0, 10], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: fadeIn }}>
      <Img src={staticFile(shot.src)} style={{ position: "absolute", left: -x * scale, top: -y * scale, transformOrigin: "0 0", scale: String(scale), maxWidth: "none" }} />
      {shot.marks.map((m, i) => (
        <Highlight key={i} x={(m.box[0] - x) * scale} y={(m.box[1] - y) * scale} w={m.box[2] * scale} h={m.box[3] * scale} color={m.color} delay={Math.round(m.at * fps)} />
      ))}
    </div>
  );
};

const Label: React.FC<{ children: React.ReactNode; dur: number; accent: string }> = ({ children, dur, accent }) => (
  <Callout duration={dur} accent={accent} top={640} width={430}>
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 30, fontWeight: 600 }}>{children}</div>
  </Callout>
);

export const Proof: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = spring({ frame, fps, config: { damping: 200 } });
  const pulse = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 2);
  const f = (s: number) => Math.round(s * fps);
  return (
    <AbsoluteFill>
      <Paper />
      <div style={{ position: "absolute", left: 300, top: 54, opacity: head, translate: `0 ${interpolate(head, [0, 1], [-20, 0])}px`, fontFamily: SANS }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: MONO, fontSize: 22, letterSpacing: "0.12em", color: C.clear, fontWeight: 500 }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: C.clear, boxShadow: `0 0 0 ${4 + pulse * 6}px rgba(23,115,74,${0.25 - pulse * 0.2})` }} />
          LIVE ON GITHUB
        </div>
        <div style={{ fontSize: 58, fontWeight: 600, color: C.ink, letterSpacing: "-0.02em", marginTop: 8 }}>This runs for real, on a real pull request</div>
      </div>
      <BrowserFrame x={WIN.x} y={WIN.y} width={WIN.width} url="github.com/bhanujangid067/countersign-demo">
        {SHOTS.map((s, i) => (
          <Sequence key={i} name={s.src} from={f(s.start)} durationInFrames={f(s.end - s.start) + 10} layout="none">
            <ShotView shot={s} first={i === 0} />
          </Sequence>
        ))}
      </BrowserFrame>

      <Sequence from={f(SHOTS[1].start + 0.6)} durationInFrames={f(SHOTS[2].start - SHOTS[1].start - 0.6)}>
        <Label dur={f(SHOTS[2].start - SHOTS[1].start - 0.6)} accent={C.stop}>
          <span style={{ display: "flex", gap: 12, alignItems: "center" }}><Tick color={C.clear} />Normal tests pass</span>
          <span style={{ display: "flex", gap: 12, alignItems: "center", color: C.stop }}><Cross color={C.stop} />Countersign fails</span>
        </Label>
      </Sequence>
      <Sequence from={f(SHOTS[2].start + 0.5)} durationInFrames={f(SHOTS[3].start - SHOTS[2].start - 0.5)}>
        <Label dur={f(SHOTS[3].start - SHOTS[2].start - 0.5)} accent={C.stop}>
          <span style={{ color: C.stop, fontSize: 36 }}>GitHub blocks the merge</span>
        </Label>
      </Sequence>
      <Sequence from={f(SHOTS[4].start + 0.4)}>
        <Label dur={f(DUR.proof / 30 - SHOTS[4].start + 1)} accent={C.clear}>
          <span style={{ display: "flex", gap: 12, alignItems: "center", color: C.clear, fontSize: 36 }}><Tick color={C.clear} size={36} />After the fix: all green</span>
        </Label>
      </Sequence>

      {SHOTS.slice(1).map((s, i) => (
        <Sequence key={i} from={f(s.start)}>
          <Audio src={staticFile("sfx/shutter-modern.wav")} volume={0.12} />
        </Sequence>
      ))}
      <Sequence from={f(P)}>
        <Audio src={staticFile("voice/proof.wav")} />
        <Captions text={line("proof").text} seconds={PL} />
      </Sequence>
      <Sequence from={f(P2)}>
        <Audio src={staticFile("voice/proof2.wav")} />
        <Captions text={line("proof2").text} seconds={P2L} />
      </Sequence>
    </AbsoluteFill>
  );
};
