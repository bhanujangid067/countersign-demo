// Renders a few still frames of the video, to check them without rendering it all.
//   node stills.mjs <out dir> <frame> [<frame> ...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const [outDir, ...frames] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "CountersignDemo" });
console.log("duration", composition.durationInFrames);
for (const f of frames) {
  await renderStill({ serveUrl, composition, frame: Number(f), output: path.join(outDir, `f${String(f).padStart(5, "0")}.jpg`), imageFormat: "jpeg", scale: 0.5 });
  console.log("frame", f);
}
