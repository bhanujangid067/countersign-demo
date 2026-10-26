// The layout shared by the website and GitHub sections: one browser window in the middle,
// the chapter label above it, the captions below it, so nothing covers the page itself.
import type React from "react";
import { Easing, interpolate } from "remotion";
import type { Box } from "./timing";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);

export const FRAME = { x: 200, y: 94, width: 1520 };
export const W = FRAME.width;
export const H = Math.round((FRAME.width * 9) / 16); // the page area under the browser bar
export const TAG = { x: FRAME.x, y: 26 }; // where chapter labels sit

// Camera moves inside the window: zoom, and the point of the page (fractions) to centre on.
export type Cam = { t: number; z: number; x: number; y: number; snap?: boolean }; // snap: start there at once (a new page)
export function makeCamera(keys: Cam[], move = 1.35) {
  return (t: number) => {
    let k = 0;
    while (k + 1 < keys.length && keys[k + 1].t <= t) k++;
    const cur = keys[k], prev = keys[Math.max(0, k - 1)];
    const p = cur.snap ? (t >= cur.t ? 1 : 0) : interpolate(t, [cur.t, cur.t + move], [0, 1], { ...clamp, easing: inOut });
    const z = prev.z + (cur.z - prev.z) * p;
    const x = prev.x + (cur.x - prev.x) * p;
    const y = prev.y + (cur.y - prev.y) * p;
    // Keep the page filling the window: never show past its edges.
    const tx = Math.min(0, Math.max(W * (1 - z), W * (0.5 - x * z)));
    const ty = Math.min(0, Math.max(H * (1 - z), H * (0.5 - y * z)));
    return { z, tx, ty };
  };
}
export type CamState = ReturnType<ReturnType<typeof makeCamera>>;

// Dims everything in the window except one part of the page, with a soft ring around it.
export const Spotlight: React.FC<{ box: Box; cam: CamState; amount: number; color: string; pad?: number }> = ({ box, cam, amount, color, pad = 10 }) => {
  if (amount <= 0) return null;
  const x = cam.tx + box.x * W * cam.z - pad, y = cam.ty + box.y * H * cam.z - pad;
  const w = box.w * W * cam.z + 2 * pad, h = box.h * H * cam.z + 2 * pad;
  return (
    <div style={{
      position: "absolute", left: x, top: y, width: w, height: h, borderRadius: 16, pointerEvents: "none",
      boxShadow: `0 0 0 3px ${color}, 0 0 0 4000px rgba(234,230,222,${0.62 * amount})`, opacity: Math.min(1, amount * 1.4),
    }} />
  );
};
// 0 -> 1 -> 0 over a time window, with eased edges.
export const windowed = (t: number, from: number, to: number, fade = 0.45) =>
  interpolate(t, [from, from + fade, to - fade, to], [0, 1, 1, 0], { ...clamp, easing: inOut });
