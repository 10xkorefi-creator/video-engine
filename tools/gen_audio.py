"""Synthesise the reel sound kit: SFX (whoosh, impact, riser, tick) and two music beds.

Everything is generated from scratch (pure numpy, seeded), so we own it outright:
no licence paperwork and no Content ID claims. Run once; outputs are committed.

    python3 tools/gen_audio.py      ->  template/assets/audio/*.mp3
"""
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 44100
OUT = Path(__file__).resolve().parent.parent / "template" / "assets" / "audio"
rng = np.random.default_rng(11)


def t(sec):
    return np.arange(int(sec * SR)) / SR


def onepole_lp(x, cutoff):
    """One-pole low-pass; cutoff may be per-sample array."""
    c = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def write(name, x, stereo_width=0.0):
    x = np.asarray(x, float)
    if x.ndim == 1:
        d = int(0.011 * SR)
        r = np.concatenate([np.zeros(d), x[:-d]]) if stereo_width else x
        x = np.stack([x, x * (1 - stereo_width) + r * stereo_width], axis=1)
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89
    wav = OUT / f"{name}.wav"
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-b:a", "160k", str(OUT / f"{name}.mp3")], check=True)
    wav.unlink()
    print("wrote", name)


# ---------- SFX ----------
def whoosh():
    d = 0.45
    tt = t(d)
    n = rng.standard_normal(len(tt))
    env = np.sin(np.pi * np.clip(tt / d, 0, 1)) ** 2.2
    sweep = 300 + 5200 * np.sin(np.pi * tt / d) ** 2
    return onepole_lp(onepole_lp(n, sweep), sweep * 1.3) * env


def impact():
    d = 1.1
    tt = t(d)
    f = 48 + 90 * np.exp(-tt * 22)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 4.5)
    click = onepole_lp(rng.standard_normal(len(tt)), 2500) * np.exp(-tt * 60)
    return body + 0.6 * click


def riser():
    d = 1.6
    tt = t(d)
    n = onepole_lp(rng.standard_normal(len(tt)), 400 + 7000 * (tt / d) ** 2)
    tone = sum(np.sin(2 * np.pi * (220 * k) * (1 + (tt / d) ** 2) * tt) / k for k in (1, 2, 3))
    env = (tt / d) ** 2.5
    return (0.8 * n + 0.25 * tone) * env


def tick():
    d = 0.12
    tt = t(d)
    return np.sin(2 * np.pi * 1800 * tt) * np.exp(-tt * 70) + 0.3 * rng.standard_normal(len(tt)) * np.exp(-tt * 200)


# ---------- music beds ----------
def note_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def bed(name, root, bpm, prog, dur=64.0):
    """Tense documentary bed: dark pad, pulsing sub, soft bell arp, ticking hats."""
    N = int(dur * SR)
    out = np.zeros(N)
    beat = 60.0 / bpm
    bar = beat * 4
    for b in range(int(dur / bar) + 1):
        chord = prog[b % len(prog)]
        s = int(b * bar * SR)
        seg = t(bar * 1.15)
        e = np.minimum(1, seg / 0.6) * np.exp(-np.maximum(0, seg - bar) * 6)
        pad = np.zeros(len(seg))
        for iv in chord:
            f = note_hz(root + iv)
            for det in (-0.12, 0.12):
                ph = 2 * np.pi * f * (1 + det / 100) * seg
                pad += np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)
        pad = onepole_lp(pad * e, 900)
        n = min(len(pad), N - s)
        if n > 0:
            out[s:s + n] += 0.18 * pad[:n]
        # sub pulse on eighths
        for k in range(8):
            p = s + int(k * beat / 2 * SR)
            st = t(beat / 2)
            sub = np.sin(2 * np.pi * note_hz(root - 12 + chord[0]) * st) * np.exp(-st * 7)
            m = min(len(sub), N - p)
            if m > 0:
                out[p:p + m] += 0.45 * sub[:m]
        # bell arp on sixteenths, sparse
        for k in range(16):
            if (k * 7 + b) % 5 not in (0, 2):
                continue
            p = s + int(k * beat / 4 * SR)
            st = t(0.9)
            f = note_hz(root + 24 + chord[k % len(chord)])
            bell = (np.sin(2 * np.pi * f * st) + 0.3 * np.sin(2 * np.pi * f * 2.76 * st)) * np.exp(-st * 5)
            m = min(len(bell), N - p)
            if m > 0:
                out[p:p + m] += 0.07 * bell[:m]
        # hats
        for k in range(8):
            p = s + int((k + 0.5) * beat / 2 * SR)
            st = t(0.05)
            hat = rng.standard_normal(len(st)) * np.exp(-st * 120)
            m = min(len(hat), N - p)
            if m > 0:
                out[p:p + m] += 0.05 * hat[:m]
    fade = int(2 * SR)
    out[-fade:] *= np.linspace(1, 0, fade)
    out[: int(0.5 * SR)] *= np.linspace(0, 1, int(0.5 * SR))
    write(name, out, stereo_width=0.5)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    write("whoosh", whoosh(), 0.6)
    write("impact", impact())
    write("riser", riser(), 0.5)
    write("tick", tick())
    bed("bed_a", root=45, bpm=96, prog=[(0, 3, 7), (-4, 0, 3), (-9, -5, 0), (-2, 2, 5)])   # A minor, i-VI-III-VII
    bed("bed_b", root=50, bpm=104, prog=[(0, 3, 7), (0, 3, 8), (-2, 2, 5), (-5, -2, 2)])   # D minor, darker
