import { Audio, Video } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, SIGN } from "../theme";
import { DUR, line, sec, SITE_SCENES, SITE_TRIM, siteAt } from "../timing";
import { BrowserFrame, Callout, Captions, Chip, Cross, easeOut, Paper, Tick } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FRAME = { x: 180, y: 70, width: 1560 }; // leaves room above for the chapter tag

// How long each website scene lasts in the recording (seconds).
const lengthOf = (id: string) => {
  const i = SITE_SCENES.indexOf(id);
  const next = SITE_SCENES[i + 1];
  return (next ? siteAt(next) : DUR.site / 30) - siteAt(id);
};

// Camera moves inside the browser window: zoom level and the point it zooms toward (% of the window).
type Cam = { t: number; z: number; ox: number; oy: number };
const CAMERA: Cam[] = [
  { t: siteAt("overview"), z: 1, ox: 50, oy: 50 },
  { t: siteAt("change") + 0.8, z: 1.1, ox: 36, oy: 30 },
  { t: siteAt("check1") + 0.3, z: 1.12, ox: 36, oy: 20 },
  { t: siteAt("stopped") + 0.2, z: 1.08, ox: 36, oy: 15 },
  { t: siteAt("stopped") + 3.0, z: 1, ox: 50, oy: 50 },
  { t: siteAt("fix") + 0.6, z: 1.08, ox: 38, oy: 30 },
  { t: siteAt("approve") - 3.8, z: 1, ox: 50, oy: 50 },
  { t: siteAt("audit") + 0.8, z: 1.06, ox: 50, oy: 35 },
]
function camera(t: number) {
  let k = 0;
  while (k + 1 < CAMERA.length && CAMERA[k + 1].t <= t) k++;
  const cur = CAMERA[k];
  const prev = CAMERA[Math.max(0, k - 1)];
  const p = interpolate(t, [cur.t, cur.t + 1.3], [0, 1], { ...clamp, easing: easeOut });
  return {
    z: prev.z + (cur.z - prev.z) * p,
    ox: prev.ox + (cur.ox - prev.ox) * p,
    oy: prev.oy + (cur.oy - prev.oy) * p,
  };
}

const Big: React.FC<{ color: string; children: React.ReactNode; size?: number }> = ({ color, children, size = 52 }) => (
  <div style={{ fontSize: size, fontWeight: 700, letterSpacing: "-0.02em", color, lineHeight: 1.1 }}>{children}</div>
);
const Small: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 25, color: C.ink2, marginTop: 8, lineHeight: 1.35 }}>{children}</div>
);
const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 27, fontWeight: 500, marginTop: 12 }}>{children}</div>
);

const Counter: React.FC<{ to: number; color: string }> = ({ to, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = interpolate(frame, [4, 4 + 1.2 * fps], [0, to], { ...clamp, easing: easeOut });
  return <span style={{ color, fontVariantNumeric: "tabular-nums" }}>{Math.round(v).toLocaleString("en-IN")}</span>;
};

const Signature: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [8, 8 + 1.4 * fps], [0, 100], clamp);
  return (
    <div style={{ fontFamily: SIGN, fontSize: 84, color: C.pen, lineHeight: 1.1, clipPath: `inset(0 ${100 - p}% 0 0)`, padding: "0 6px" }}>Ananya Iyer</div>
  );
};

// Everything that appears on top of one website scene.
const Overlay: React.FC<{ id: string }> = ({ id }) => {
  const { fps } = useVideoConfig();
  const dur = sec(lengthOf(id));
  const at = (s: number) => Math.round(s * fps);
  const voice = (
    <Sequence from={at(0.15)}>
      <Audio src={staticFile(`voice/${id}.wav`)} />
      <Captions text={line(id).text} seconds={line(id).seconds} />
    </Sequence>
  );
  const chip = (label: string, sub: string, color?: string) => <Chip label={label} sub={sub} duration={dur} color={color} />;
  const callout = (from: number, accent: string, body: React.ReactNode, top?: number) => (
    <Sequence from={at(from)} durationInFrames={Math.max(1, dur - at(from))}>
      <Callout duration={dur - at(from)} accent={accent} top={top}>{body}</Callout>
    </Sequence>
  );
  switch (id) {
    case "overview":
      return <>{chip("The payments lead's dashboard", "SAMPLE CO.")}{voice}</>;
    case "change":
      return (
        <>
          {chip("Rohan's change", "STEP 1")}
          {callout(3.6, C.clear, <><Row><Tick color={C.clear} size={40} /><Big color={C.clear} size={44}>Every test passes</Big></Row><Small>4 of 4 unit tests. Most teams would merge this.</Small></>)}
          {voice}
        </>
      );
    case "check1":
      return (
        <>
          {chip("Who will break?", "CHECK 1")}
          {callout(6.2, C.caution, (
            <>
              <Big color={C.caution}>2 of 8 apps break</Big>
              <Row><span style={{ width: 14, height: 14, borderRadius: 7, background: C.stop }} />Merchant dashboard</Row>
              <Row><span style={{ width: 14, height: 14, borderRadius: 7, background: C.stop }} />Partner shopping app</Row>
              <div style={{ height: 1, background: C.rule, margin: "18px 0 6px" }} />
              <Row><Tick color={C.clear} size={26} /><span style={{ fontSize: 23, color: C.ink2 }}>Standard API checker said it was fine</span></Row>
            </>
          ))}
          {voice}
        </>
      );
    case "check2":
      return (
        <>
          {chip("Is the money right?", "CHECK 2")}
          {callout(4.2, C.stop, (
            <>
              <Big color={C.ink} size={70}><Counter to={890} color={C.stop} /><span style={{ fontSize: 40, color: C.muted, fontWeight: 600 }}> of 4,180</span></Big>
              <Small>refunds from last week come out wrong</Small>
              <Row><span style={{ fontSize: 34, fontWeight: 600 }}>₹900</span><span style={{ color: C.muted }}>→</span><span style={{ fontSize: 34, fontWeight: 700, color: C.stop }}>₹90,000</span></Row>
            </>
          ))}
          {voice}
        </>
      );
    case "stopped":
      return (
        <>
          {chip("Stopped", "RESULT", C.stop)}
          {callout(3.0, C.stop, (
            <>
              <Row>
                <svg width="40" height="44" viewBox="0 0 14 15"><rect x="1.5" y="6.5" width="11" height="8" rx="1.8" fill={C.stop} /><path d="M3.8 6.5V4.6a3.2 3.2 0 0 1 6.4 0v1.9" fill="none" stroke={C.stop} strokeWidth="1.6" /></svg>
                <Big color={C.stop} size={48}>Merge locked</Big>
              </Row>
              <Small>until the code is fixed, or the payments lead signs off.</Small>
            </>
          ))}
          {voice}
        </>
      );
    case "fix":
      return (
        <>
          {chip("Rohan fixes it", "PATH 1", C.clear)}
          {callout(Math.max(4, lengthOf("fix") - 5.2), C.clear, (
            <>
              <Row><Tick color={C.clear} size={44} /><Big color={C.clear}>All clear</Big></Row>
              <Small>Every app works. Every refund is right. It merges.</Small>
            </>
          ))}
          <Sequence from={at(Math.max(4, lengthOf("fix") - 5.2))}><Audio src={staticFile("sfx/ding.wav")} volume={0.25} /></Sequence>
          {voice}
        </>
      );
    case "approve":
      return (
        <>
          {chip("The payments lead signs", "PATH 2")}
          {callout(Math.max(3.5, lengthOf("approve") - 7.2), C.pen, (
            <>
              <div style={{ fontSize: 24, color: C.muted, fontWeight: 500 }}>Countersigned by</div>
              <Signature />
              <div style={{ height: 2, background: C.ink, opacity: 0.6, marginTop: -6 }} />
              <Small>Ananya Iyer, payments lead · for this exact commit only</Small>
            </>
          ), 470)}
          {voice}
        </>
      );
    case "audit":
      return (
        <>
          {chip("The audit record", "RECORD")}
          <Sequence from={at(0.2)}><Audio src={staticFile("sfx/page-turn.wav")} volume={0.35} /></Sequence>
          {callout(2.0, C.pen, (
            <>
              <Big color={C.ink} size={42}>A signed record of every decision</Big>
              <Row><Tick color={C.pen} size={28} />What was checked</Row>
              <Row><Cross color={C.stop} size={28} />What went wrong</Row>
              <Row><Tick color={C.pen} size={28} />Who approved it, and when</Row>
            </>
          ))}
          {voice}
        </>
      );
    default:
      return null;
  }
};

export const Site: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = camera(frame / fps);
  return (
    <AbsoluteFill>
      <Paper dark />
      <BrowserFrame x={FRAME.x} y={FRAME.y} width={FRAME.width} url="countersign · Sample Payments Co.">
        <div style={{ position: "absolute", inset: 0, scale: String(cam.z), transformOrigin: `${cam.ox}% ${cam.oy}%` }}>
          <Video src={staticFile("site.mp4")} trimBefore={Math.round(SITE_TRIM * fps)} muted style={{ width: "100%", height: "100%" }} />
          {/* Covers the tiny colour square the recorder uses to sync scenes. */}
          <div style={{ position: "absolute", right: 0, bottom: 0, width: "0.8%", height: "1.4%", background: C.paper }} />
        </div>
      </BrowserFrame>
      {SITE_SCENES.map((id) => (
        <Sequence key={id} name={id} from={sec(siteAt(id))} durationInFrames={sec(lengthOf(id))} layout="none">
          <Overlay id={id} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
