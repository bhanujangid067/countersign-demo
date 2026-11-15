"""Make a quiet music bed for the video: a slow, warm pad made from sine waves. No samples, no downloads.

Usage:
  python3 video/make_music.py        (needs numpy and ffmpeg)

Writes video/remotion/public/music.m4a (about four minutes; the video fades it in and out).
"""

import subprocess
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
OUT = HERE / "remotion" / "public" / "music.m4a"
RATE = 44100
BAR = 8.0  # seconds per chord
BARS = 30

# D major, slow and open: D, Bm7, Gmaj7, A(sus). Notes as frequencies (Hz).
N = {"D2": 73.42, "G2": 98.0, "A2": 110.0, "B2": 123.47, "D3": 146.83, "E3": 164.81, "F#3": 185.0, "G3": 196.0,
     "A3": 220.0, "B3": 246.94, "C#4": 277.18, "D4": 293.66, "E4": 329.63, "F#4": 369.99, "A4": 440.0}
CHORDS = [
    ["D2", "A3", "D4", "F#4"],
    ["B2", "F#3", "A3", "D4"],
    ["G2", "D3", "B3", "F#4"],
    ["A2", "E3", "A3", "E4"],
]


def tone(freq: float, t: np.ndarray, pan: float) -> np.ndarray:
    """One soft voice: two slightly detuned sines and a faint octave, with a slow wobble in loudness."""
    wob = 1 + 0.15 * np.sin(2 * np.pi * 0.11 * t + freq)
    mono = (np.sin(2 * np.pi * freq * 0.9985 * t) + np.sin(2 * np.pi * freq * 1.0015 * t) + 0.18 * np.sin(2 * np.pi * freq * 2 * t)) * wob
    mono *= min(1.0, 180.0 / freq)  # higher notes quieter, so it stays warm
    return np.stack([mono * (1 - pan), mono * pan], axis=1)


def main() -> None:
    total = int(BAR * BARS * RATE)
    mix = np.zeros((total + int(BAR * RATE), 2))
    n = int(BAR * 1.5 * RATE)  # each chord rings into the next
    t = np.arange(n) / RATE
    env = np.sin(np.pi * np.clip(t / (BAR * 1.5), 0, 1)) ** 1.5  # slow swell in and out
    for bar in range(BARS):
        chord = CHORDS[bar % len(CHORDS)]
        start = int(bar * BAR * RATE)
        for i, name in enumerate(chord):
            mix[start:start + n] += tone(N[name], t, 0.3 + 0.4 * (i % 2)) * env[:, None]
    mix = mix[:total]
    mix /= np.abs(mix).max()
    mix *= 0.5
    pcm = (mix * 32767).astype("<i2")
    tmp = OUT.with_suffix(".wav")
    with wave.open(str(tmp), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())
    # A gentle low-pass and a little room, then AAC.
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", "lowpass=f=1800,aecho=0.8:0.7:90|170:0.25|0.18",
                    "-c:a", "aac", "-b:a", "128k", str(OUT)], check=True)
    tmp.unlink()
    print("saved", OUT)


if __name__ == "__main__":
    main()
