import type React from "react";
import parts from "../../../brand/parts.json"; // traced from the logo by brand/make_logo.py
import { C } from "./theme";

const [mx, my, mw, mh] = parts.mark_box;
const [wx, wy, ww, wh] = parts.word_box;
// The spark's centre, where the two halves meet (source pixels).
const SPARK = { x: 640, y: 583 };

// The Countersign logo, ready to animate:
//   lock  0 = the two halves apart, 1 = locked together
//   spark 0 = hidden, 1 = full size (a little over 1 overshoots)
//   rays  0..1 a short burst of lines out of the spark
//   word  0..1 the name "countersign" wiping in from the left (stacked only)
export const Logo: React.FC<{
  height: number;
  stacked?: boolean;
  lock?: number;
  spark?: number;
  rays?: number;
  word?: number;
  ink?: string;
  sparkColor?: string;
}> = ({ height, stacked = false, lock = 1, spark = 1, rays = 0, word = 1, ink = C.ink, sparkColor = C.spark }) => {
  const pad = 20;
  const view = stacked
    ? { x: Math.min(mx, wx) - pad, y: my - pad, w: Math.max(mx + mw, wx + ww) - Math.min(mx, wx) + 2 * pad, h: wy + wh - my + 2 * pad }
    : { x: mx - pad, y: my - pad, w: mw + 2 * pad, h: mh + 2 * pad };
  const apart = 1 - lock;
  const id = `wipe-${Math.round(height)}`;
  return (
    <svg width={(height * view.w) / view.h} height={height} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} style={{ overflow: "visible", flex: "none" }}>
      <defs>
        <clipPath id={id}>
          <rect x={wx - 10} y={wy - 20} width={(ww + 20) * word} height={wh + 40} />
        </clipPath>
      </defs>
      <path d={parts.top} fill={ink} transform={`translate(${-90 * apart} ${-230 * apart})`} />
      <path d={parts.bottom} fill={ink} transform={`translate(${90 * apart} ${230 * apart})`} />
      {rays > 0 && rays < 1
        ? [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r0 = 30 + 70 * rays, r1 = r0 + 34 * (1 - rays);
            const rad = (a * Math.PI) / 180;
            return (
              <line key={a} x1={SPARK.x + r0 * Math.cos(rad)} y1={SPARK.y + r0 * Math.sin(rad)} x2={SPARK.x + r1 * Math.cos(rad)} y2={SPARK.y + r1 * Math.sin(rad)}
                stroke={sparkColor} strokeWidth={7} strokeLinecap="round" opacity={1 - rays} />
            );
          })
        : null}
      <path d={parts.spark} fill={sparkColor} transform={`translate(${SPARK.x} ${SPARK.y}) scale(${Math.max(0, spark)}) rotate(${-60 * (1 - Math.min(1, spark))}) translate(${-SPARK.x} ${-SPARK.y})`} />
      {stacked ? (
        <g clipPath={`url(#${id})`}>
          <path d={parts.word} fill={ink} transform={`translate(${-24 * (1 - word)} 0)`} />
        </g>
      ) : null}
    </svg>
  );
};
