// All timing comes from the voiceover lengths (make_voice.py) and the website recording (record.mjs).
import voice from "../public/voice/durations.json";
import site from "../public/site-marks.json";

export const FPS = 30;
export const TRANSITION = 20; // frames each chapter transition overlaps

type Line = { id: string; text: string; seconds: number };
const LINES: Record<string, Line> = Object.fromEntries(voice.scenes.map((s) => [s.id, s]));
export const line = (id: string): Line => LINES[id];
export const sec = (s: number) => Math.round(s * FPS);

const marks = site.marks as Record<string, number>;
// Seconds from the start of the website section to the start of a website scene.
export const siteAt = (id: string) => marks[id] - marks.overview;
export const SITE_TRIM = marks.overview; // where the website section starts in site.mp4
export const SITE_SCENES = ["overview", "change", "check1", "check2", "stopped", "fix", "approve", "audit"];

export const VOICE_IN = { title: 0.9, problem: 0.5, proof: 0.5, close: 1.1 };
const PROOF_GAP = 0.6;
export const proof2At = VOICE_IN.proof + line("proof").seconds + PROOF_GAP;

export const DUR = {
  title: sec(VOICE_IN.title + line("title").seconds + 0.9),
  problem: sec(VOICE_IN.problem + line("problem").seconds + 2.2),
  site: sec(marks.end - marks.overview),
  proof: sec(proof2At + line("proof2").seconds + 1.6),
  close: sec(Math.max(VOICE_IN.close + line("close").seconds + 3.2, 6)),
};
export const TOTAL = DUR.title + DUR.problem + DUR.site + DUR.proof + DUR.close - 4 * TRANSITION;
