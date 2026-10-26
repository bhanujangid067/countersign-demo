import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO, SANS, SIGN } from "../theme";
import { VOICE_IN } from "../timing";
import { easeOut, Paper } from "../ui";
import { LogoReveal } from "./Title";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = VOICE_IN.close * fps;
  const tag = interpolate(frame, [v + 0.2 * fps, v + 0.8 * fps], [0, 1], { ...clamp, easing: easeOut });
  const sign = interpolate(frame, [v + 1.3 * fps, v + 2.7 * fps], [0, 100], clamp);
  const rule = interpolate(frame, [v + 1.0 * fps, v + 1.5 * fps], [0, 1], { ...clamp, easing: easeOut });
  const foot = interpolate(frame, [v + 2.5 * fps, v + 3.1 * fps], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Paper />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 30, fontFamily: SANS }}>
        <LogoReveal height={330} delay={6} />
        <div style={{ opacity: tag, translate: `0 ${interpolate(tag, [0, 1], [20, 0])}px`, filter: `blur(${(1 - tag) * 6}px)`, fontSize: 60, fontWeight: 600, color: C.pen, letterSpacing: "-0.015em", marginTop: 10 }}>
          Proof, not an opinion.
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontFamily: SIGN, fontSize: 96, color: C.pen, lineHeight: 1.05, clipPath: `inset(0 ${100 - sign}% 0 0)`, padding: "0 10px" }}>Countersigned</div>
          <div style={{ width: 480, height: 2, background: C.ink, opacity: 0.5, transformOrigin: "left", scale: `${rule} 1`, marginTop: -8 }} />
        </div>
        <div style={{ opacity: foot, fontFamily: MONO, fontSize: 22, color: C.muted, letterSpacing: "0.08em", marginTop: 10, textAlign: "center", lineHeight: 1.7 }}>
          TEAM BULLSEYE · VENTURE VORTEX 2026
          <br />
          A working demo on one sample API, with made-up data
        </div>
      </AbsoluteFill>
      <Sequence from={Math.round(0.62 * fps) + 6}>
        <Audio src={staticFile("sfx/mouse-click.wav")} volume={0.3} />
      </Sequence>
      <Sequence from={Math.round(v)}>
        <Audio src={staticFile("voice/close.wav")} />
      </Sequence>
    </AbsoluteFill>
  );
};
