import { Audio, Video } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO, SANS } from "../theme";
import { DUR, line, momentAt, said, sec, SITE_SCENES, SITE_TRIM, siteAt, VOICED } from "../timing";
import { BrowserFrame, Callout, Captions, Chip, Cross, easeOut, Paper, Tick } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const FRAME = { x: 120, y: 44, width: 1680 };
const W = FRAME.width, H = Math.round((FRAME.width * 9) / 16);

// How long each website scene lasts in the recording (seconds).
const lengthOf = (id: string) => {
  const i = SITE_SCENES.indexOf(id);
  const next = SITE_SCENES[i + 1];
  return (next ? siteAt(next) : DUR.site / 30) - siteAt(id);
};

// ---- the "two ways forward" cards, shown twice: before path one, and between path one and path two ----
const AWAY = [
  { up: siteAt("stopped") + said("stopped", "There are two ways") - 0.15, down: siteAt("fix") + 0.55 },
  { up: momentAt("mergeUnlocked") + 0.7, down: siteAt("approve") + 1.6 },
];
const FADE = 0.75; // seconds to pull back or dive in
function away(t: number) {
  let a = 0;
  for (const w of AWAY) a = Math.max(a, interpolate(t, [w.up, w.up + FADE, w.down, w.down + FADE], [0, 1, 1, 0], { ...clamp, easing: inOut }));
  return a;
}

// ---- camera moves inside the browser window: zoom, and the point (fractions of the page) to centre on ----
type Cam = { t: number; z: number; x: number; y: number };
const FULL = { z: 1, x: 0.5, y: 0.5 };
const TRAY = (y: number) => ({ z: 1.95, x: 0.856, y });
const CAMERA: Cam[] = [
  { t: 0, ...FULL },
  { t: siteAt("change") + 1.6, z: 1.3, x: 0.42, y: 0.36 },
  { t: siteAt("check1") + 0.6, z: 1.18, x: 0.49, y: 0.4 },
  { t: siteAt("check2") + 1.4, z: 1.3, x: 0.44, y: 0.5 },
  { t: siteAt("stopped") + 0.2, ...FULL },
  { t: momentAt("mergeClick") - 1.2, ...TRAY(0.25) },
  { t: AWAY[0].up - 0.4, ...FULL },
  { t: siteAt("fix") + 3.2, z: 1.18, x: 0.47, y: 0.42 },
  { t: momentAt("allClear") - 0.6, ...FULL },
  { t: momentAt("mergeUnlocked") - 1.9, ...TRAY(0.22) },
  { t: AWAY[1].up - 0.2, ...FULL },
  { t: momentAt("signing") + 0.5, z: 1.55, x: 0.33, y: 0.84 },
  { t: momentAt("countersigned") + 2.3, ...TRAY(0.2) },
  { t: momentAt("merged") + 0.1, z: 1.5, x: 0.47, y: 0.15 },
  { t: siteAt("audit") + 0.1, ...FULL },
  { t: siteAt("audit") + 2.4, z: 1.4, x: 0.76, y: 0.46 },
];
const MOVE = 1.35; // seconds for each camera move
function camera(t: number) {
  let k = 0;
  while (k + 1 < CAMERA.length && CAMERA[k + 1].t <= t) k++;
  const cur = CAMERA[k], prev = CAMERA[Math.max(0, k - 1)];
  const p = interpolate(t, [cur.t, cur.t + MOVE], [0, 1], { ...clamp, easing: inOut });
  const z = prev.z + (cur.z - prev.z) * p;
  const x = prev.x + (cur.x - prev.x) * p;
  const y = prev.y + (cur.y - prev.y) * p;
  // Keep the page filling the window: never show past its edges.
  const tx = Math.min(0, Math.max(W * (1 - z), W * (0.5 - x * z)));
  const ty = Math.min(0, Math.max(H * (1 - z), H * (0.5 - y * z)));
  return { z, tx, ty };
}

const Big: React.FC<{ color: string; children: React.ReactNode; size?: number }> = ({ color, children, size = 50 }) => (
  <div style={{ fontSize: size, fontWeight: 700, letterSpacing: "-0.02em", color, lineHeight: 1.1 }}>{children}</div>
);
const Small: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 25, color: C.ink2, marginTop: 8, lineHeight: 1.35 }}>{children}</div>
);
const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 27, fontWeight: 500, marginTop: 12 }}>{children}</div>
);
const Lock: React.FC<{ color: string }> = ({ color }) => (
  <svg width="38" height="42" viewBox="0 0 14 15"><rect x="1.5" y="6.5" width="11" height="8" rx="1.8" fill={color} /><path d="M3.8 6.5V4.6a3.2 3.2 0 0 1 6.4 0v1.9" fill="none" stroke={color} strokeWidth="1.6" /></svg>
);

const Counter: React.FC<{ to: number; color: string }> = ({ to, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = interpolate(frame, [4, 4 + 1.2 * fps], [0, to], { ...clamp, easing: easeOut });
  return <span style={{ color, fontVariantNumeric: "tabular-nums" }}>{Math.round(v).toLocaleString("en-IN")}</span>;
};

// Everything that appears on top of one website scene. Times are seconds into the scene.
const Overlay: React.FC<{ id: string }> = ({ id }) => {
  const { fps } = useVideoConfig();
  const start = siteAt(id);
  const dur = sec(lengthOf(id));
  const hide = 1 - away(start + useCurrentFrame() / fps); // labels step aside while the "two ways" cards are up
  const at = (s: number) => Math.round(s * fps);
  const voice = VOICED.has(id) ? (
    <Sequence from={at(0.15)}>
      <Audio src={staticFile(`voice/${id}.wav`)} />
      <Captions text={line(id).text} seconds={line(id).seconds} />
    </Sequence>
  ) : null;
  const chip = (label: string, sub: string, color?: string, from = 0) => (
    <Sequence from={at(from)} durationInFrames={Math.max(1, dur - at(from))} layout="none">
      <div style={{ opacity: hide }}><Chip label={label} sub={sub} duration={dur - at(from)} color={color} /></div>
    </Sequence>
  );
  // A callout from `from` to `to` seconds into this scene.
  const callout = (from: number, to: number, accent: string, body: React.ReactNode, opts: { top?: number; side?: "left" | "right"; width?: number } = {}) => (
    <Sequence from={at(from)} durationInFrames={Math.max(1, at(to) - at(from))} layout="none">
      <div style={{ opacity: hide }}><Callout duration={at(to) - at(from)} accent={accent} {...opts}>{body}</Callout></div>
    </Sequence>
  );
  const sfx = (file: string, from: number, volume: number) => (
    <Sequence from={at(from)} layout="none"><Audio src={staticFile(`sfx/${file}`)} volume={volume} /></Sequence>
  );
  const end = lengthOf(id);
  switch (id) {
    case "overview":
      return <>{chip("The payments lead's dashboard", "SAMPLE CO.")}{voice}</>;
    case "change":
      return (
        <>
          {chip("Rohan's change", "STEP 1")}
          {callout(said("change", "and every normal test"), end, C.clear, <><Row><Tick color={C.clear} size={40} /><Big color={C.clear} size={44}>Every test passes</Big></Row><Small>4 of 4 unit tests. Most teams would merge this.</Small></>, { top: 600 })}
          {voice}
        </>
      );
    case "check1":
      return (
        <>
          {chip("Who will break?", "CHECK 1")}
          {callout(said("check1", "Two apps still send"), end, C.caution, (
            <>
              <Big color={C.caution}>2 of 8 apps break</Big>
              <Row><span style={{ width: 14, height: 14, borderRadius: 7, background: C.stop }} />Merchant dashboard</Row>
              <Row><span style={{ width: 14, height: 14, borderRadius: 7, background: C.stop }} />Partner shopping app</Row>
              <div style={{ height: 1, background: C.rule, margin: "18px 0 6px" }} />
              <Row><Tick color={C.clear} size={26} /><span style={{ fontSize: 23, color: C.ink2 }}>Standard API checker said it was fine</span></Row>
            </>
          ), { top: 560 })}
          {voice}
        </>
      );
    case "check2":
      return (
        <>
          {chip("Is the money right?", "CHECK 2")}
          {callout(said("check2", "Eight hundred and ninety"), end, C.stop, (
            <>
              <Big color={C.ink} size={70}><Counter to={890} color={C.stop} /><span style={{ fontSize: 40, color: C.muted, fontWeight: 600 }}> of 4,180</span></Big>
              <Small>refunds from last week come out wrong</Small>
              <Row><span style={{ fontSize: 34, fontWeight: 600 }}>₹900</span><span style={{ color: C.muted }}>→</span><span style={{ fontSize: 34, fontWeight: 700, color: C.stop }}>₹90,000</span></Row>
            </>
          ), { top: 580 })}
          {voice}
        </>
      );
    case "stopped": {
      const click = momentAt("mergeClick") - start;
      return (
        <>
          {chip("Stopped", "RESULT", C.stop)}
          {callout(click - 0.5, AWAY[0].up - start, C.stop, (
            <>
              <Row><Lock color={C.stop} /><Big color={C.stop} size={48}>Merge locked</Big></Row>
              <Small>until the code is fixed, or the payments lead signs off.</Small>
            </>
          ), { side: "left", top: 470 })}
          {sfx("mouse-click.wav", click, 0.4)}
          {voice}
        </>
      );
    }
    case "fix": {
      const clear = momentAt("allClear") - start;
      return (
        <>
          {chip("Rohan fixes it", "PATH 1", C.clear, 1.3)}
          {callout(clear + 0.1, AWAY[1].up - start, C.clear, (
            <>
              <Row><Tick color={C.clear} size={44} /><Big color={C.clear}>All clear</Big></Row>
              <Small>Every app works. Every refund is right. The merge unlocks.</Small>
            </>
          ), { side: "left", top: 470 })}
          {sfx("ding.wav", clear, 0.25)}
          {voice}
        </>
      );
    }
    case "approve": {
      const signed = momentAt("countersigned") - start, merged = momentAt("merged") - start;
      return (
        <>
          {chip("Ananya signs off", "PATH 2", C.pen, 2.3)}
          {callout(signed + 0.2, signed + 2.4, C.pen, (
            <>
              <Big color={C.pen} size={44}>Countersigned</Big>
              <Small>Ananya Iyer, payments lead. For this exact commit only.</Small>
            </>
          ), { top: 150 })}
          {callout(merged + 0.2, end, C.clear, (
            <>
              <Row><Tick color={C.clear} size={44} /><Big color={C.clear}>Merged</Big></Row>
              <Small>Once, and only after the second signature.</Small>
            </>
          ), { side: "left", top: 500 })}
          {sfx("mouse-click.wav", momentAt("mergeClick2") - start, 0.4)}
          {sfx("switch.wav", merged, 0.25)}
          {voice}
        </>
      );
    }
    case "audit":
      return (
        <>
          {chip("The audit record", "RECORD")}
          {sfx("page-turn.wav", 0.2, 0.35)}
          {callout(2.2, end, C.pen, (
            <>
              <Big color={C.ink} size={40}>A signed record of every decision</Big>
              <Row><Tick color={C.pen} size={28} />What was checked</Row>
              <Row><Cross color={C.stop} size={28} />What went wrong</Row>
              <Row><Tick color={C.pen} size={28} />Who approved it, and when</Row>
            </>
          ), { side: "left", top: 420, width: 500 })}
          {voice}
        </>
      );
    default:
      return null;
  }
};

// The two ways out of a stopped change. `active` is the card being chosen; card 1 shows a tick once it's done.
const PathCards: React.FC<{ t: number; amount: number }> = ({ t, amount }) => {
  const { fps } = useVideoConfig();
  const second = t >= AWAY[1].up - 0.1;
  const active = second ? (t >= siteAt("approve") ? 2 : 0) : t >= siteAt("fix") ? 1 : 0;
  const choose = (n: number) => {
    const from = n === 1 ? siteAt("fix") : siteAt("approve");
    return active === n ? spring({ frame: Math.round((t - from) * fps), fps, config: { damping: 16, stiffness: 140 } }) : 0;
  };
  const enter = (i: number) => {
    const from = (second ? AWAY[1].up : AWAY[0].up) + 0.15 + i * 0.12;
    return spring({ frame: Math.round((t - from) * fps), fps, config: { damping: 18, stiffness: 120 } });
  };
  // Leaving: when diving into the chosen path, its card grows and everything fades.
  const leaving = interpolate(t, [AWAY[second ? 1 : 0].down, AWAY[second ? 1 : 0].down + FADE], [0, 1], { ...clamp, easing: inOut });
  const cards = [
    { n: 1, title: "Rohan fixes the code", sub: "Countersign checks the new commit again", color: C.clear },
    { n: 2, title: "Ananya signs off", sub: "The payments lead countersigns this exact commit", color: C.pen },
  ];
  return (
    <AbsoluteFill style={{ opacity: amount, fontFamily: SANS, justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 44 }}>
      <div style={{ textAlign: "center", opacity: 1 - leaving }}>
        <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.16em", color: C.stop, fontWeight: 500 }}>CHANGE #482 IS STOPPED</div>
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-0.025em", color: C.ink, marginTop: 6 }}>Two ways forward</div>
      </div>
      <div style={{ display: "flex", gap: 56 }}>
        {cards.map((c, i) => {
          const e = enter(i), pick = choose(c.n), on = active === c.n;
          const done = c.n === 1 && second;
          const dim = active && !on ? 0.45 : 1;
          const grow = on ? leaving : 0;
          return (
            <div key={c.n} style={{
              width: 640, padding: "40px 44px 42px", borderRadius: 26, background: C.sheet,
              border: `3px solid ${on ? c.color : "transparent"}`,
              boxShadow: on ? "0 40px 90px rgba(40,30,15,0.28)" : "0 24px 60px rgba(40,30,15,0.16)",
              opacity: e * dim * (1 - (on ? 0 : leaving)) * (1 - grow * 0.9),
              translate: `0 ${interpolate(e, [0, 1], [70, 0]) - 14 * pick}px`,
              scale: String(interpolate(e, [0, 1], [0.94, 1]) * (1 + 0.04 * pick + 0.5 * grow)),
              filter: `blur(${interpolate(e, [0, 1], [8, 0]) + 10 * grow}px)`,
              display: "flex", gap: 30, alignItems: "flex-start",
            }}>
              <div style={{ flex: "none", width: 84, height: 84, borderRadius: 42, background: done ? C.clear : c.color, color: C.sheet, display: "grid", placeItems: "center", fontSize: 44, fontWeight: 700 }}>
                {done ? <svg width="44" height="44" viewBox="0 0 30 30"><path d="M7.5 15.5l5 5 10-10.5" fill="none" stroke={C.sheet} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" /></svg> : c.n}
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.14em", color: c.color, fontWeight: 500 }}>PATH {c.n}</div>
                <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em", color: C.ink, marginTop: 4, lineHeight: 1.1 }}>{c.title}</div>
                <div style={{ fontSize: 26, color: C.ink2, marginTop: 10, lineHeight: 1.35 }}>{done ? "Done: all clear, the merge unlocks." : c.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Site: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cam = camera(t);
  const a = away(t);
  return (
    <AbsoluteFill>
      <Paper deep />
      <div style={{ position: "absolute", inset: 0, scale: String(1 - 0.12 * a), filter: `blur(${12 * a}px)`, opacity: 1 - 0.6 * a }}>
        <BrowserFrame x={FRAME.x} y={FRAME.y} width={FRAME.width} url="countersign · Sample Payments Co.">
          <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0", transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.z})` }}>
            <Video src={staticFile("site.mp4")} trimBefore={Math.round(SITE_TRIM * fps)} muted style={{ width: W, height: H }} />
          </div>
        </BrowserFrame>
      </div>
      {a > 0 ? <PathCards t={t} amount={a} /> : null}
      {AWAY.flatMap((w) => [w.up, w.down]).map((s, i) => (
        <Sequence key={i} from={sec(s) - 3} durationInFrames={30} layout="none">
          <Audio src={staticFile("sfx/whoosh.wav")} volume={0.16} />
        </Sequence>
      ))}
      {SITE_SCENES.map((id) => (
        <Sequence key={id} name={id} from={sec(siteAt(id))} durationInFrames={sec(lengthOf(id))} layout="none">
          <Overlay id={id} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
