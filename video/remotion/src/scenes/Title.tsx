import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO, SANS } from "../theme";
import { VOICE_IN } from "../timing";
import { easeOut, Logo, Paper } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const WORD = "Countersign";

export const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const draw = interpolate(frame, [8, 8 + 0.9 * fps], [0, 1], { ...clamp, easing: easeOut });
  const sub = interpolate(frame, [1.2 * fps, 1.8 * fps], [0, 1], { ...clamp, easing: easeOut });
  const foot = interpolate(frame, [1.9 * fps, 2.5 * fps], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Paper />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 40, fontFamily: SANS }}>
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div style={{ scale: String(interpolate(logo, [0, 1], [0.4, 1])), opacity: logo, rotate: `${interpolate(logo, [0, 1], [-12, 0])}deg` }}>
            <Logo size={150} draw={draw} />
          </div>
          <div style={{ display: "flex", fontSize: 168, fontWeight: 700, letterSpacing: "-0.03em", color: C.ink }}>
            {WORD.split("").map((ch, i) => {
              const s = spring({ frame: frame - 10 - i * 2, fps, config: { damping: 200 } });
              return (
                <span key={i} style={{ display: "inline-block", opacity: s, translate: `0 ${interpolate(s, [0, 1], [60, 0])}px` }}>
                  {ch}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ opacity: sub, translate: `0 ${interpolate(sub, [0, 1], [24, 0])}px`, fontSize: 56, color: C.ink2, textAlign: "center", maxWidth: 1380, lineHeight: 1.3 }}>
          A second signature before any code change
          <br />
          that <span style={{ color: C.pen, fontWeight: 600 }}>moves money</span> goes live.
        </div>
        <div style={{ opacity: foot, fontFamily: MONO, fontSize: 28, color: C.muted, letterSpacing: "0.06em" }}>
          TEAM BULLSEYE · VENTURE VORTEX 2026
        </div>
      </AbsoluteFill>
      <Sequence from={Math.round(VOICE_IN.title * fps)}>
        <Audio src={staticFile("voice/title.wav")} />
      </Sequence>
    </AbsoluteFill>
  );
};
