import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO, SANS, SIGN } from "../theme";
import { VOICE_IN } from "../timing";
import { easeOut, Logo, Paper } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const draw = interpolate(frame, [6, 6 + 0.8 * fps], [0, 1], { ...clamp, easing: easeOut });
  const tag = interpolate(frame, [VOICE_IN.close * fps + 0.9 * fps, VOICE_IN.close * fps + 1.5 * fps], [0, 1], { ...clamp, easing: easeOut });
  const sign = interpolate(frame, [2.4 * fps, 3.9 * fps], [0, 100], clamp);
  const line = interpolate(frame, [2.1 * fps, 2.6 * fps], [0, 1], { ...clamp, easing: easeOut });
  const foot = interpolate(frame, [3.6 * fps, 4.2 * fps], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Paper />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 34, fontFamily: SANS }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30, opacity: logo, scale: String(interpolate(logo, [0, 1], [0.85, 1])) }}>
          <Logo size={120} draw={draw} />
          <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: "-0.03em", color: C.ink }}>Countersign</div>
        </div>
        <div style={{ opacity: tag, translate: `0 ${interpolate(tag, [0, 1], [20, 0])}px`, fontSize: 64, fontWeight: 600, color: C.pen, letterSpacing: "-0.01em" }}>
          Proof, not an opinion.
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontFamily: SIGN, fontSize: 110, color: C.pen, lineHeight: 1.05, clipPath: `inset(0 ${100 - sign}% 0 0)`, padding: "0 10px" }}>Countersigned</div>
          <div style={{ width: 520, height: 2, background: C.ink, opacity: 0.55, transformOrigin: "left", scale: `${line} 1`, marginTop: -10 }} />
        </div>
        <div style={{ opacity: foot, fontFamily: MONO, fontSize: 24, color: C.muted, letterSpacing: "0.05em", marginTop: 16, textAlign: "center", lineHeight: 1.6 }}>
          TEAM BULLSEYE · VENTURE VORTEX 2026
          <br />
          Demo on one sample API with made-up data
        </div>
      </AbsoluteFill>
      <Sequence from={Math.round(VOICE_IN.close * fps)}>
        <Audio src={staticFile("voice/close.wav")} />
      </Sequence>
    </AbsoluteFill>
  );
};
