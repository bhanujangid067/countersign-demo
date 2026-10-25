import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries, type TransitionPresentationComponentProps } from "@remotion/transitions";
import { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, Easing, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fontsLoaded } from "./fonts";
import { Close } from "./scenes/Close";
import { Problem } from "./scenes/Problem";
import { Proof } from "./scenes/Proof";
import { Site } from "./scenes/Site";
import { Title } from "./scenes/Title";
import { C } from "./theme";
import { DUR, TRANSITION } from "./timing";

// One transition for every chapter change: the new scene settles in from a soft blur and slight zoom.
const SoftZoom: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({ children, presentationDirection, presentationProgress }) => {
  const p = Easing.bezier(0.33, 1, 0.68, 1)(presentationProgress);
  if (presentationDirection === "exiting") {
    return <AbsoluteFill style={{ scale: String(1 - 0.03 * p), filter: `blur(${p * 6}px)` }}>{children}</AbsoluteFill>;
  }
  return <AbsoluteFill style={{ opacity: p, scale: String(1.05 - 0.05 * p), filter: `blur(${(1 - p) * 10}px)` }}>{children}</AbsoluteFill>;
};
const soft = { component: SoftZoom, props: {} };
const timing = linearTiming({ durationInFrames: TRANSITION });

const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return <div style={{ position: "absolute", left: 0, bottom: 0, height: 5, width: `${(frame / durationInFrames) * 100}%`, background: C.pen, opacity: 0.8 }} />;
};

export const CountersignVideo: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    fontsLoaded.then(() => continueRender(handle));
  }, [handle]);

  // Frames where each chapter transition starts (for the whoosh).
  const cuts: number[] = [];
  let t = 0;
  for (const d of [DUR.title, DUR.problem, DUR.site, DUR.proof]) {
    t += d - TRANSITION;
    cuts.push(t);
  }

  return (
    <AbsoluteFill style={{ backgroundColor: C.paper }}>
      <TransitionSeries>
        <TransitionSeries.Sequence name="Title" durationInFrames={DUR.title}>
          <Title />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={soft} timing={timing} />
        <TransitionSeries.Sequence name="Problem" durationInFrames={DUR.problem}>
          <Problem />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={soft} timing={timing} />
        <TransitionSeries.Sequence name="Website" durationInFrames={DUR.site}>
          <Site />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={soft} timing={timing} />
        <TransitionSeries.Sequence name="GitHub proof" durationInFrames={DUR.proof}>
          <Proof />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={soft} timing={timing} />
        <TransitionSeries.Sequence name="Close" durationInFrames={DUR.close}>
          <Close />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      {cuts.map((f) => (
        <Sequence key={f} from={f - 4} durationInFrames={30}>
          <Audio src={staticFile("sfx/whoosh.wav")} volume={0.22} />
        </Sequence>
      ))}
      <Progress />
    </AbsoluteFill>
  );
};
