#!/usr/bin/env python3
"""~5s inhale / exhale: simple pure-tone cues (sine + smooth envelope). Mono 44.1kHz 16-bit LE."""
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

SR = 44_100
DURATION_S = 5.0
OUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "sounds"


def write_wav(path: Path, samples: list[float], gain: float = 0.42) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    saturated = [math.tanh(1.02 * s) for s in samples]
    peak = max(abs(s) for s in saturated) or 1.0
    scale = gain / peak
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        for s in saturated:
            v = max(-32768, min(32767, int(s * scale * 32767)))
            w.writeframes(struct.pack("<h", v))


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def simple_inhale() -> list[float]:
    """Single sine, gentle swell in then taper — slightly higher pitch (draw in)."""
    n = int(SR * DURATION_S)
    f_hz = 247.0
    ph = 0.0
    out: list[float] = []
    for i in range(n):
        p = i / max(1, n - 1)
        ph += 2.0 * math.pi * f_hz / SR
        # Smooth rise ~0–35%, hold, soft fall at end
        edge = smoothstep(0.0, 0.08, p) * (1.0 - smoothstep(0.82, 1.0, p))
        bell = math.sin(min(1.0, p / 0.9) * math.pi)
        env = edge * (0.35 + 0.65 * (bell**1.15))
        out.append(math.sin(ph) * env)
    return out


def simple_exhale() -> list[float]:
    """Single sine, slightly lower pitch, louder start then long soft decay (let go)."""
    n = int(SR * DURATION_S)
    f_hz = 196.0
    ph = 0.0
    out: list[float] = []
    for i in range(n):
        p = i / max(1, n - 1)
        ph += 2.0 * math.pi * f_hz / SR
        fade_in = smoothstep(0.0, 0.06, p)
        fade_out = (1.0 - smoothstep(0.2, 1.0, p)) ** 0.85
        env = fade_in * fade_out
        out.append(math.sin(ph) * env)
    return out


def main() -> None:
    write_wav(OUT_DIR / "breath-exhale.wav", simple_exhale(), gain=0.42)
    write_wav(OUT_DIR / "breath-inhale.wav", simple_inhale(), gain=0.42)
    print(f"Wrote {OUT_DIR / 'breath-exhale.wav'}")
    print(f"Wrote {OUT_DIR / 'breath-inhale.wav'}")


if __name__ == "__main__":
    main()
