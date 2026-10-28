"""Synthesise the transition sound kit (owned outright, no licences, no Content ID).

Ten varied sounds so cuts never sound the same twice in a row:
swish_air, swish_soft, swoosh_deep, zip_up, pop, shutter, glitch, paper, scratch, heartbeat.

    python3 tools/gen_sfx.py      ->  template/assets/audio/sfx_*.mp3
"""
import numpy as np

from gen_audio import SR, onepole_lp, t, write

rng = np.random.default_rng(2026)


def band(x, lo, hi):
    """Band-pass as the difference of two one-pole low-passes (cutoffs may be per-sample arrays)."""
    return onepole_lp(x, hi) - onepole_lp(x, lo)


def pan(x, start, end):
    """Constant-power pan from start to end (-1 left .. +1 right)."""
    p = np.linspace(start, end, len(x))
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def env_ar(n, attack, release_pow=2.0):
    x = np.linspace(0, 1, n)
    a = np.clip(x / max(attack, 1e-3), 0, 1)
    return a * (1 - x) ** release_pow


def swish_air():
    d = 0.3
    tt = t(d)
    c = 6500 * np.exp(-tt * 9) + 1200
    x = band(rng.standard_normal(len(tt)), c * 0.35, c) * env_ar(len(tt), 0.18, 1.6)
    return pan(x, -0.7, 0.7)


def swish_soft():
    d = 0.38
    tt = t(d)
    c = 2600 * np.exp(-tt * 5) + 500
    x = onepole_lp(onepole_lp(rng.standard_normal(len(tt)), c), c * 1.4) * np.sin(np.pi * tt / d) ** 1.5
    return pan(x, 0.6, -0.6)


def swoosh_deep():
    d = 0.55
    tt = t(d)
    c = 900 * np.exp(-tt * 4) + 150
    air = onepole_lp(onepole_lp(rng.standard_normal(len(tt)), c), c) * np.sin(np.pi * tt / d) ** 2
    body = np.sin(2 * np.pi * np.cumsum(110 * np.exp(-tt * 3) + 45) / SR) * np.exp(-((tt - 0.22) ** 2) / 0.01)
    return pan(air * 1.2 + body * 0.5, -0.3, 0.3)


def zip_up():
    d = 0.32
    tt = t(d)
    c = 700 + 7000 * (tt / d) ** 1.6
    x = band(rng.standard_normal(len(tt)), c * 0.5, c) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 38 * tt)))
    return pan(x * np.sin(np.pi * tt / d) ** 1.2, -0.2, 0.4)


def pop():
    d = 0.14
    tt = t(d)
    f = 320 + 700 * np.exp(-tt * 45)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 32)
    click = band(rng.standard_normal(len(tt)), 2000, 7000) * np.exp(-tt * 400) * 0.4
    return x + click


def shutter():
    d = 0.2
    tt = t(d)
    n = rng.standard_normal(len(tt))
    k1 = np.exp(-tt * 260)
    k2 = np.exp(-np.clip(tt - 0.065, 0, None) * 220) * (tt >= 0.065)
    return band(n, 1500, 9000) * (k1 + 0.8 * k2) + 0.3 * np.sin(2 * np.pi * 180 * tt) * k1


def glitch():
    d = 0.26
    tt = t(d)
    out = np.zeros(len(tt))
    for i, (s, f) in enumerate([(0.0, 900), (0.05, 1500), (0.09, 600), (0.14, 2200), (0.18, 1100)]):
        m = (tt >= s) & (tt < s + 0.035)
        out[m] = np.sign(np.sin(2 * np.pi * f * tt[m])) * (0.9 - i * 0.12)
    crushed = np.round(out * 6) / 6
    return band(crushed, 300, 6000) * np.exp(-tt * 3)


def paper():
    d = 0.36
    tt = t(d)
    x = band(rng.standard_normal(len(tt)), 2200, 9000)
    flutter = 0.7 + 0.3 * np.sin(2 * np.pi * 23 * tt + 4 * np.sin(2 * np.pi * 3 * tt))
    return pan(x * flutter * np.sin(np.pi * tt / d) ** 1.8, 0.4, -0.2)


def scratch():
    """Record scratch: the 'needle' speed swings forward and back, sweeping a resonant band."""
    d = 0.5
    tt = t(d)
    speed = np.interp(tt, [0, 0.12, 0.2, 0.32, 0.5], [0.2, 1.0, -0.6, 0.9, 0.1])
    c = 900 + 2600 * np.abs(speed)
    n = rng.standard_normal(len(tt))
    grit = band(n, c * 0.6, c)
    tone = np.sin(2 * np.pi * np.cumsum(260 + 520 * speed) / SR) * 0.35
    return (grit + tone) * np.clip(np.abs(speed) * 1.4, 0, 1) * np.exp(-tt * 1.5)


def heartbeat():
    d = 1.45
    tt = t(d)
    out = np.zeros(len(tt))
    for s, a in [(0.0, 1.0), (0.26, 0.7), (0.85, 1.0), (1.11, 0.7)]:
        u = np.clip(tt - s, 0, None)
        out += a * (tt >= s) * np.sin(2 * np.pi * (52 + 25 * np.exp(-u * 30)) * u) * np.exp(-u * 18)
    return onepole_lp(out, 220)


if __name__ == "__main__":
    for fn in [swish_air, swish_soft, swoosh_deep, zip_up, pop, shutter, glitch, paper, scratch, heartbeat]:
        write(f"sfx_{fn.__name__}", fn())
