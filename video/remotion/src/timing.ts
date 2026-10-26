// All timing comes from the voiceover lengths (make_voice.py) and the website recording (record.mjs).
import voice from "../public/voice/durations.json";
import site from "../public/site-marks.json";

export const FPS = 30;
export const TRANSITION = 20; // frames each chapter transition overlaps

type Line = { id: string; text: string; seconds: number };
const LINES: Record<string, Line> = Object.fromEntries(voice.scenes.map((s) => [s.id, s]));
export const line = (id: string): Line => LINES[id];
export const sec = (s: number) => Math.round(s * FPS);
// Roughly when a phrase is spoken inside a voice line (seconds from the line's start), by its position in the text.
export function said(id: string, phrase: string) {
  const l = line(id);
  const i = l.text.indexOf(phrase);
  if (i < 0) throw new Error(`"${phrase}" is not in the ${id} line`);
  return (i / l.text.length) * l.seconds;
}

const marks = site.marks as Record<string, number>;
const moments = site.moments as Record<string, number>;
export type Box = { x: number; y: number; w: number; h: number };
export const boxes = site.boxes as Record<string, Box | null>;
// Seconds from the start of the website section to the start of a website scene, or to a moment inside one.
export const siteAt = (id: string) => marks[id] - marks.overview;
export const momentAt = (name: string) => moments[name] - marks.overview;
export const SITE_TRIM = marks.overview; // where the website section starts in site.mp4
export const SITE_SCENES = ["overview", "change", "check1", "check2", "stopped", "fix", "rewind", "approve", "audit"];
export const VOICED = new Set(["overview", "change", "check1", "check2", "stopped", "fix", "approve", "audit"]);

export const VOICE_IN = { title: 1.5, problem: 0.5, close: 1.4 };

// The GitHub section: five voice lines, one after another.
export const GH_LINES = ["gh1", "gh2", "gh3", "gh4", "gh5"];
const GH_IN = 0.7, GH_GAP = 0.6;
const ghStarts: Record<string, number> = {};
let at = GH_IN;
for (const id of GH_LINES) {
  ghStarts[id] = at;
  at += line(id).seconds + GH_GAP;
}
export const ghAt = (id: string) => ghStarts[id]; // seconds into the GitHub section
export const ghSaid = (id: string, phrase: string) => ghAt(id) + said(id, phrase);

export const DUR = {
  title: sec(VOICE_IN.title + line("title").seconds + 1.0),
  problem: sec(VOICE_IN.problem + line("problem").seconds + 2.2),
  site: sec(marks.end - marks.overview),
  github: sec(at + 1.2),
  close: sec(Math.max(VOICE_IN.close + line("close").seconds + 3.6, 6.5)),
};
export const TOTAL = DUR.title + DUR.problem + DUR.site + DUR.github + DUR.close - 4 * TRANSITION;
