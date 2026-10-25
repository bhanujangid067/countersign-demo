import type React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO, SANS } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

// Paper background with a faint dot grid that drifts slowly, so still frames never feel frozen.
export const Paper: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const frame = useCurrentFrame();
  const dot = dark ? "rgba(255,255,255,0.06)" : "rgba(22,33,44,0.07)";
  return (
    <AbsoluteFill
      style={{
        backgroundColor: dark ? C.night : C.paper,
        backgroundImage: `radial-gradient(${dot} 1.4px, transparent 1.6px)${
          dark ? ", radial-gradient(ellipse at 50% 35%, rgba(31,61,140,0.35), transparent 65%)" : ""
        }`,
        backgroundSize: dark ? "34px 34px, 100% 100%" : "34px 34px",
        backgroundPosition: `${frame * 0.15}px ${frame * 0.1}px${dark ? ", 0 0" : ""}`,
      }}
    />
  );
};

// Captions for one voice line: sentences (long ones split at a comma), timed by word count.
function chunks(text: string, seconds: number) {
  const sentences = text.match(/[^.?!]+[.?!]/g)?.map((s) => s.trim()) ?? [text];
  const pieces: string[] = [];
  for (const s of sentences) {
    const words = s.split(" ").length;
    const cut = s.lastIndexOf(",", Math.floor(s.length * 0.62));
    if (words > 11 && cut > 12) pieces.push(s.slice(0, cut + 1), s.slice(cut + 1).trim());
    else pieces.push(s);
  }
  const total = pieces.reduce((n, p) => n + p.split(" ").length, 0);
  let at = 0;
  return pieces.map((p) => {
    const start = at;
    at += (p.split(" ").length / total) * seconds;
    return { text: p, start, end: at };
  });
}

export const Captions: React.FC<{ text: string; seconds: number }> = ({ text, seconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const parts = chunks(text, seconds);
  const cur = parts.find((p) => t >= p.start && t < p.end + 0.25);
  if (!cur) return null;
  const local = t - cur.start;
  const opacity = interpolate(local, [0, 0.18], [0, 1], clamp) * interpolate(t, [cur.end, cur.end + 0.25], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 26, pointerEvents: "none" }}>
      <div
        style={{
          opacity,
          translate: `0 ${interpolate(local, [0, 0.25], [8, 0], { ...clamp, easing: easeOut })}px`,
          maxWidth: 1780,
          textAlign: "center",
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: 37,
          lineHeight: 1.3,
          color: "#fff",
          background: "rgba(14,21,29,0.88)",
          padding: "12px 30px 14px",
          borderRadius: 14,
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        }}
      >
        {cur.text}
      </div>
    </AbsoluteFill>
  );
};

// A clean browser window around a screen recording or screenshot.
export const BrowserFrame: React.FC<{
  x: number;
  y: number;
  width: number;
  url: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ x, y, width, url, children, style }) => {
  const height = Math.round((width * 9) / 16);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        borderRadius: 16,
        overflow: "hidden",
        background: C.sheet,
        boxShadow: "0 40px 90px rgba(5,10,20,0.45), 0 0 0 1px rgba(0,0,0,0.08)",
        ...style,
      }}
    >
      <div style={{ height: 46, display: "flex", alignItems: "center", gap: 9, padding: "0 18px", background: "#eceee8", borderBottom: "1px solid #dcdfd6" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
        ))}
        <div
          style={{
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#fff",
            borderRadius: 8,
            padding: "5px 18px",
            fontFamily: MONO,
            fontSize: 17,
            color: C.ink2,
            minWidth: 520,
            justifyContent: "center",
          }}
        >
          <svg width="12" height="14" viewBox="0 0 12 14">
            <rect x="1" y="6" width="10" height="7.5" rx="1.6" fill={C.muted} />
            <path d="M3 6V4.2a3 3 0 0 1 6 0V6" fill="none" stroke={C.muted} strokeWidth="1.6" />
          </svg>
          {url}
        </div>
        <div style={{ width: 66 }} />
      </div>
      <div style={{ position: "relative", width, height, overflow: "hidden", background: C.paper }}>{children}</div>
    </div>
  );
};

// A chapter label that slides in, holds, and leaves.
export const Chip: React.FC<{ label: string; sub?: string; duration: number; color?: string }> = ({ label, sub, duration, color = C.pen }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });
  const exit = interpolate(frame, [duration - 12, duration], [1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 180,
        top: 8,
        opacity: enter * exit,
        translate: `${interpolate(enter, [0, 1], [-40, 0])}px 0`,
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: color,
        color: "#fff",
        borderRadius: 12,
        padding: "9px 20px 9px 12px",
        fontFamily: SANS,
        boxShadow: "0 14px 34px rgba(5,10,20,0.35)",
        zIndex: 5,
      }}
    >
      {sub ? (
        <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, background: "rgba(255,255,255,0.18)", borderRadius: 6, padding: "3px 9px", letterSpacing: "0.04em" }}>{sub}</span>
      ) : null}
      <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em" }}>{label}</span>
    </div>
  );
};

// A card of key facts that springs in on the right.
export const Callout: React.FC<{ duration: number; children: React.ReactNode; top?: number; accent?: string; width?: number }> = ({
  duration,
  children,
  top = 520,
  accent = C.pen,
  width = 470,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 140, mass: 0.8 } });
  const exit = interpolate(frame, [duration - 12, duration], [1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        right: 96,
        top,
        width,
        opacity: Math.min(1, enter * 1.4) * exit,
        translate: `${interpolate(enter, [0, 1], [80, 0])}px 0`,
        scale: String(interpolate(enter, [0, 1], [0.94, 1])),
        background: C.sheet,
        borderRadius: 18,
        padding: "24px 28px 26px",
        boxShadow: "0 30px 70px rgba(5,10,20,0.4)",
        borderTop: `6px solid ${accent}`,
        fontFamily: SANS,
        color: C.ink,
        zIndex: 6,
      }}
    >
      {children}
    </div>
  );
};

// A rectangle that draws itself around something important.
export const Highlight: React.FC<{ x: number; y: number; w: number; h: number; color: string; delay?: number }> = ({ x, y, w, h, color, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame - delay, [0, 0.6 * fps], [0, 1], { ...clamp, easing: easeOut });
  const per = 2 * (w + h);
  return (
    <svg style={{ position: "absolute", left: x - 10, top: y - 10, overflow: "visible" }} width={w + 20} height={h + 20}>
      <rect x={4} y={4} width={w + 12} height={h + 12} rx={12} fill={color} fillOpacity={0.08 * p} stroke={color} strokeWidth={5}
        strokeDasharray={per + 40} strokeDashoffset={(per + 40) * (1 - p)} />
    </svg>
  );
};

export const Tick: React.FC<{ color: string; size?: number }> = ({ color, size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 30 30" style={{ flex: "none" }}>
    <circle cx="15" cy="15" r="15" fill={color} />
    <path d="M8.5 15.5l4.2 4.2 8.8-9.4" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const Cross: React.FC<{ color: string; size?: number }> = ({ color, size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 30 30" style={{ flex: "none" }}>
    <circle cx="15" cy="15" r="15" fill={color} />
    <path d="M10 10l10 10M20 10L10 20" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// The Countersign mark: a pen-ink square with a signature stroke that can draw itself.
export const Logo: React.FC<{ size: number; draw?: number }> = ({ size, draw = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" style={{ flex: "none" }}>
    <rect width="28" height="28" rx="7" fill={C.pen} />
    <path
      d="M6 17.5c2.2-5.6 4.4-8.4 6-8.4 2 0-.6 7.6 1.4 7.6 1.6 0 2.8-4.2 4.4-4.2 1.2 0 .8 3 2 3 .9 0 1.7-.8 2.4-1.8"
      fill="none"
      stroke="#fff"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="40"
      strokeDashoffset={40 * (1 - draw)}
    />
    <path d="M6.5 21h15" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity={0.55 * draw} />
  </svg>
);
