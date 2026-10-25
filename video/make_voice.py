"""Make the voiceover with Kokoro, a free AI voice that runs offline on this Mac.

Usage:
  video/.tts/bin/python video/make_voice.py              one audio file per scene, using the voice in script.json
  video/.tts/bin/python video/make_voice.py samples      one short sample per candidate voice, to choose from
  video/.tts/bin/python video/make_voice.py am_michael   use a different voice this time

Writes video/out/voice/<scene>.wav and video/out/voice/durations.json (or video/out/samples/*.wav).
The model files live in video/models/ (downloaded once, about 200 MB).
"""

import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

# Kokoro uses espeak-ng for pronunciation. The copy bundled with its Python package is broken on
# Apple Silicon Macs, so use Homebrew's (brew install espeak-ng).
ESPEAK_LIB = "/opt/homebrew/opt/espeak-ng/lib/libespeak-ng.dylib"
ESPEAK_DATA = "/opt/homebrew/opt/espeak-ng/share/espeak-ng-data"
from kokoro_onnx import EspeakConfig, Kokoro

HERE = Path(__file__).resolve().parent
MODELS = HERE / "models"
SAMPLE_VOICES = ["af_heart", "af_bella", "am_michael", "bf_emma", "bm_george"]
SAMPLE_TEXT = ("Countersign checks every pull request that touches money. "
               "A refund of nine hundred rupees would have gone out as ninety thousand. So the change is stopped.")


# Words the voice gets wrong, respelled for the voice only (captions keep the real spelling).
SAY_AS = {r"\bpaise\b": "pie-say"}


def speak(kokoro: Kokoro, text: str, voice: str, speed: float) -> tuple[np.ndarray, int]:
    for word, said in SAY_AS.items():
        text = re.sub(word, said, text)
    audio, rate = kokoro.create(text, voice=voice, speed=speed, lang="en-us")
    # A little silence at both ends so lines don't start or stop abruptly.
    pad = np.zeros(int(rate * 0.12), dtype=audio.dtype)
    return np.concatenate([pad, audio, pad]), rate


def main() -> None:
    script = json.loads((HERE / "script.json").read_text())
    espeak = EspeakConfig(lib_path=ESPEAK_LIB, data_path=ESPEAK_DATA)
    kokoro = Kokoro(str(MODELS / "kokoro-v1.0.fp16.onnx"), str(MODELS / "voices-v1.0.bin"), espeak_config=espeak)
    arg = sys.argv[1] if len(sys.argv) > 1 else None

    if arg == "samples":
        out = HERE / "out" / "samples"
        out.mkdir(parents=True, exist_ok=True)
        for v in SAMPLE_VOICES:
            audio, rate = speak(kokoro, SAMPLE_TEXT, v, script["speed"])
            sf.write(out / f"{v}.wav", audio, rate)
            print(f"sample {v}.wav")
        return

    voice = arg or script["voice"]
    out = HERE / "out" / "voice"
    out.mkdir(parents=True, exist_ok=True)
    durations = []
    for scene in script["scenes"]:
        audio, rate = speak(kokoro, scene["text"], voice, script["speed"])
        sf.write(out / f"{scene['id']}.wav", audio, rate)
        seconds = len(audio) / rate
        durations.append({"id": scene["id"], "text": scene["text"], "seconds": round(seconds, 2)})
        print(f"{scene['id']:9} {seconds:5.1f}s")
    (out / "durations.json").write_text(json.dumps({"voice": voice, "scenes": durations}, indent=2))
    print(f"total {sum(d['seconds'] for d in durations):.0f}s of speech, voice {voice}")


if __name__ == "__main__":
    main()
