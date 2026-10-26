import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Logo } from "../logo";
import { C, MONO, SANS } from "../theme";
import { VOICE_IN } from "../timing";
import { easeOut, Paper } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// The two halves of the S slide in and lock together, the spark flashes where they meet,
// then the name wipes in. Two people, two signatures.
export const LogoReveal: React.FC<{ height: number; delay?: number }> = ({ height, delay = 0 }) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  const lock = spring({ frame, fps, config: { damping: 15, stiffness: 90, mass: 1 } });
  const meet = 0.62 * fps; // when the halves click together
  const spark = spring({ frame: frame - meet, fps, config: { damping: 9, stiffness: 180 } });
  const rays = interpolate(frame, [meet, meet + 0.55 * fps], [0, 1], clamp);
  const word = interpolate(frame, [meet + 0.25 * fps, meet + 1.05 * fps], [0, 1], { ...clamp, easing: easeOut });
  const appear = interpolate(frame, [0, 8], [0, 1], clamp);
  return (
    <div style={{ opacity: appear }}>
      <Logo height={height} stacked lock={lock} spark={spark} rays={rays} word={word} />
    </div>
  );
};

export const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sub = interpolate(frame, [1.7 * fps, 2.4 * fps], [0, 1], { ...clamp, easing: easeOut });
  const foot = interpolate(frame, [2.4 * fps, 3.0 * fps], [0, 1], clamp);
  const drift = interpolate(frame, [0, 8 * fps], [1, 1.035]);

  return (
    <AbsoluteFill>
      <Paper />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 46, fontFamily: SANS, scale: String(drift) }}>
        <LogoReveal height={440} delay={4} />
        <div style={{ opacity: sub, translate: `0 ${interpolate(sub, [0, 1], [24, 0])}px`, filter: `blur(${(1 - sub) * 6}px)`, fontSize: 50, color: C.ink2, textAlign: "center", maxWidth: 1380, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
          A second signature before any code change
          <br />
          that <span style={{ color: C.pen, fontWeight: 600 }}>moves money</span> goes live.
        </div>
        <div style={{ opacity: foot, fontFamily: MONO, fontSize: 24, color: C.muted, letterSpacing: "0.12em" }}>TEAM BULLSEYE · VENTURE VORTEX 2026</div>
      </AbsoluteFill>
      <Sequence from={Math.round(0.62 * fps) + 4}>
        <Audio src={staticFile("sfx/mouse-click.wav")} volume={0.35} />
      </Sequence>
      <Sequence from={Math.round(VOICE_IN.title * fps)}>
        <Audio src={staticFile("voice/title.wav")} />
      </Sequence>
    </AbsoluteFill>
  );
};
