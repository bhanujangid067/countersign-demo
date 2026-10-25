import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO, SANS } from "../theme";
import { line, VOICE_IN } from "../timing";
import { easeOut, Paper, Tick } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ₹ with Indian digit grouping: 90000 -> "₹90,000"
function rupees(n: number) {
  const s = String(Math.round(n));
  if (s.length <= 3) return "₹" + s;
  let head = s.slice(0, -3);
  const groups: string[] = [];
  while (head.length > 2) {
    groups.unshift(head.slice(-2));
    head = head.slice(0, -2);
  }
  if (head) groups.unshift(head);
  return "₹" + [...groups, s.slice(-3)].join(",");
}

const Words: React.FC<{ text: string; start: number; style?: React.CSSProperties; red?: string }> = ({ text, start, style, red }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "0.26em", ...style }}>
      {text.split(" ").map((w, i) => {
        const s = spring({ frame: frame - start - i * 3, fps, config: { damping: 200 } });
        const isRed = red?.split(" ").includes(w.replace(/[.,]/g, ""));
        return (
          <span key={i} style={{ display: "inline-block", opacity: s, translate: `0 ${interpolate(s, [0, 1], [34, 0])}px`, color: isRed ? C.stop : undefined }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const voiceStart = VOICE_IN.problem * fps;
  const lineSecs = line("problem").seconds;
  const l1 = voiceStart + 0.9 * fps; // "A code change can pass every single test"
  const l2 = voiceStart + 0.42 * lineSecs * fps; // "and still send the wrong amount of money"
  const receipt = voiceStart + 0.68 * lineSecs * fps; // "A nine hundred rupee refund goes out as ninety thousand"
  const r = spring({ frame: frame - receipt, fps, config: { damping: 16, stiffness: 120 } });
  const count = interpolate(frame, [receipt + 0.5 * fps, receipt + 1.7 * fps], [900, 90000], { ...clamp, easing: easeOut });
  const stamp = spring({ frame: frame - receipt - 1.8 * fps, fps, config: { damping: 11, stiffness: 160 } });
  const tests = spring({ frame: frame - l1 - 0.9 * fps, fps, config: { damping: 200 } });
  const underline = interpolate(frame, [l2 + 0.6 * fps, l2 + 1.2 * fps], [0, 1], { ...clamp, easing: easeOut });
  const lift = interpolate(r, [0, 1], [0, -70]);

  return (
    <AbsoluteFill>
      <Paper />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 150, fontFamily: SANS, color: C.ink }}>
        <div style={{ translate: `0 ${lift}px`, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          <div style={{ fontFamily: MONO, fontSize: 28, letterSpacing: "0.14em", color: C.muted, opacity: interpolate(frame, [0, 12], [0, 1], clamp) }}>THE PROBLEM</div>
          <Words text="A code change can pass every test" start={l1} style={{ fontSize: 92, fontWeight: 600, letterSpacing: "-0.02em" }} />
          <div style={{ opacity: tests, scale: String(interpolate(tests, [0, 1], [0.9, 1])), display: "flex", alignItems: "center", gap: 14, background: C.clearSoft, color: C.clear, borderRadius: 999, padding: "10px 26px 10px 14px", fontSize: 32, fontWeight: 600 }}>
            <Tick color={C.clear} size={36} /> 4 of 4 tests pass
          </div>
          <div style={{ position: "relative" }}>
            <Words text="and still send the wrong amount of money." start={l2} red="wrong amount of money" style={{ fontSize: 92, fontWeight: 600, letterSpacing: "-0.02em" }} />
            <div style={{ position: "absolute", left: "34%", right: 0, bottom: -6, height: 10, borderRadius: 5, background: C.stop, opacity: 0.85, transformOrigin: "left", scale: `${underline} 1` }} />
          </div>
        </div>
      </AbsoluteFill>

      {/* The receipt: a ₹900 refund that goes out as ₹90,000 */}
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 110, fontFamily: SANS }}>
        <div style={{ opacity: r, translate: `0 ${interpolate(r, [0, 1], [120, 0])}px`, position: "relative", display: "flex", alignItems: "center", gap: 48, background: C.sheet, borderRadius: 24, padding: "34px 56px", boxShadow: "0 40px 90px rgba(5,10,20,0.18)", border: `1px solid ${C.rule}` }}>
          <div>
            <div style={{ fontSize: 28, color: C.muted, fontWeight: 500 }}>Customer paid</div>
            <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: "-0.02em" }}>₹900</div>
          </div>
          <svg width="90" height="40" viewBox="0 0 90 40">
            <path d="M4 20h76M64 6l16 14-16 14" fill="none" stroke={C.muted} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div style={{ fontSize: 28, color: C.muted, fontWeight: 500 }}>Refund sent</div>
            <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: "-0.02em", color: count > 1000 ? C.stop : C.ink, minWidth: 380, fontVariantNumeric: "tabular-nums" }}>{rupees(count)}</div>
          </div>
          <div style={{ position: "absolute", right: -60, top: -46, opacity: stamp, scale: String(interpolate(stamp, [0, 1], [2.2, 1])), rotate: "-8deg", border: `5px solid ${C.stop}`, color: C.stop, borderRadius: 12, padding: "10px 20px", fontSize: 34, fontWeight: 700, letterSpacing: "0.12em", background: "rgba(252,239,237,0.92)" }}>
            100× TOO MUCH
          </div>
        </div>
      </AbsoluteFill>

      <Sequence from={Math.round(voiceStart)}>
        <Audio src={staticFile("voice/problem.wav")} />
      </Sequence>
      <Sequence from={Math.round(receipt + 1.7 * fps)}>
        <Audio src={staticFile("sfx/switch.wav")} volume={0.35} />
      </Sequence>
    </AbsoluteFill>
  );
};
