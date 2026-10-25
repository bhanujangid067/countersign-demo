import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// The website's fonts, so the video matches it. Latin + extended Latin (which has the ₹ sign).
const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const EXT =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF";

const files: { family: string; file: string; weight: string; unicodeRange: string }[] = [];
for (const w of ["400", "500", "600", "700"]) {
  files.push({ family: "IBM Plex Sans", file: `IBMPlexSans-${w}-latin.woff2`, weight: w, unicodeRange: LATIN });
  files.push({ family: "IBM Plex Sans", file: `IBMPlexSans-${w}-ext.woff2`, weight: w, unicodeRange: EXT });
}
for (const w of ["400", "500"]) {
  files.push({ family: "IBM Plex Mono", file: `IBMPlexMono-${w}-latin.woff2`, weight: w, unicodeRange: LATIN });
}
files.push({ family: "Mrs Saint Delafield", file: "MrsSaintDelafield-400-latin.woff2", weight: "400", unicodeRange: LATIN });

export const fontsLoaded = Promise.all(
  files.map((f) =>
    loadFont({ family: f.family, url: staticFile(`fonts/${f.file}`), weight: f.weight, unicodeRange: f.unicodeRange }),
  ),
);
