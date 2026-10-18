"""Original 20 s score for the Signal Garden intro, cut to the storyboard beats.
Deterministic (seeded). Output: score.wav, 48 kHz stereo.

Beats (seconds): 0 collect · 4.2 filter/scan 4.7–7.9 · 9.2 list lands
                 · 14.6 focus · 17.3 logo resolve · 20 end
Key: D minor-ish (Dmaj9 colour on the resolve). Tempo feel 96 BPM for pulses.
"""
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 48000
DUR = 20.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)

def env(a, b, fade_in=0.5, fade_out=0.5):
    e = np.zeros(N)
    i0, i1 = int(a * SR), int(b * SR)
    seg = np.ones(i1 - i0)
    fi, fo = int(fade_in * SR), int(fade_out * SR)
    if fi: seg[:fi] = np.sin(np.linspace(0, np.pi / 2, fi)) ** 2
    if fo: seg[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
    e[i0:i1] = seg
    return e

def hz(m): return 440 * 2 ** ((m - 69) / 12)

def pad_voice(freq, detune=0.12):
    out = np.zeros(N)
    for d in (-detune, 0, detune):
        f = freq * 2 ** (d / 12)
        ph = rng.uniform(0, 2 * np.pi)
        # soft saw-ish: a few harmonics with 1/n^1.6 rolloff
        for k in range(1, 7):
            out += np.sin(2 * np.pi * f * k * t + ph * k) / k ** 1.6
    return out / 3

def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, btype="low", fs=SR, output="sos"), x)

def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, btype="high", fs=SR, output="sos"), x)

def lp_sweep(x, f0, f1, a, b, blocks=200):
    """time-varying low-pass via block crossfade (deterministic, good enough for a pad)."""
    y = np.zeros_like(x)
    edges = np.linspace(0, N, blocks + 1).astype(int)
    for i in range(blocks):
        s0, s1 = edges[i], edges[i + 1]
        tc = (s0 + s1) / 2 / SR
        p = np.clip((tc - a) / (b - a), 0, 1)
        fc = f0 * (f1 / f0) ** p
        pad = 4096
        lo = max(0, s0 - pad)
        seg = lp(x[lo:s1], fc)
        y[s0:s1] = seg[s0 - lo:]
    return y

L = np.zeros(N); R = np.zeros(N)
def add(sig, gain=1.0, pan=0.0):
    global L, R
    L += sig * gain * np.sqrt(0.5 * (1 - pan))
    R += sig * gain * np.sqrt(0.5 * (1 + pan))

# 1) drone bed: D2 + A2, whole piece, darker at start, opens on the list, warms on resolve
drone = pad_voice(hz(38)) + 0.7 * pad_voice(hz(45))
drone = lp_sweep(drone, 260, 1400, 1.0, 10.0)
drone = hp(drone, 65)
add(drone * env(0, 20, 2.2, 1.6), 0.10)

# 2) noise texture for "the noise of the web": filtered noise, fades out after scan
nz = rng.standard_normal(N)
nz = hp(lp(nz, 3800), 900)
nz *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.37 * t) ** 2
add(nz * env(0.2, 8.6, 1.8, 1.4), 0.014, -0.3)
nz2 = hp(lp(rng.standard_normal(N), 5200), 1600)
add(nz2 * env(0.4, 8.6, 2.0, 1.4), 0.010, 0.35)

# 3) data ticks while names pour in (0.3–4.4s), seeded random sparse blips
def blip(at, f, dur=0.05, g=1.0):
    i0 = int(at * SR); n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 70)
    out = np.zeros(N); out[i0:i0 + n] = s[: max(0, min(n, N - i0))]
    return out * g
ticks = np.zeros(N)
for k in range(46):
    at = 0.35 + rng.uniform(0, 3.9)
    ticks += blip(at, rng.choice([1760, 2093, 2349, 2637, 3136]), 0.04, rng.uniform(0.4, 1.0))
add(ticks, 0.07, 0.0)

# 4) scan riser 4.4→7.9: rising filtered noise + rising tone, then a soft drop
pr = np.clip((t - 4.4) / 3.5, 0, 1)
rise_f = 300 * (2400 / 300) ** pr
phase = 2 * np.pi * np.cumsum(rise_f) / SR
riser_tone = np.sin(phase) * 0.5 + 0.3 * np.sin(phase * 1.5)
riser = (riser_tone + 0.0) * (pr ** 1.6) * env(4.4, 8.0, 0.3, 0.12)
add(lp(riser, 3000), 0.07, 0.0)
rn = lp_sweep(rng.standard_normal(N), 400, 7000, 4.4, 7.9) * (pr ** 2) * env(4.4, 8.0, 0.2, 0.15)
add(rn, 0.05, 0.0)

# 5) gate checks (5.4 + i*0.42): soft glassy ticks, pitched up each time (D pentatonic)
for i, m in enumerate([74, 76, 78, 81, 83]):
    add(blip(5.4 + i * 0.42, hz(m), 0.35, 1.0) * 1.0, 0.07, -0.2 + i * 0.1)
    add(blip(5.4 + i * 0.42, hz(m + 12), 0.2, 0.5), 0.03, 0.2 - i * 0.1)

# 6) the "drop" at 9.2: list lands — low thump + chord bloom (Dmaj9: D F# A C# E)
def thump(at, f0=70, g=1.0):
    i0 = int(at * SR); n = int(0.9 * SR)
    tt = np.arange(n) / SR
    f = f0 * (1 + 1.2 * np.exp(-tt * 18))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 5.5)
    out = np.zeros(N); out[i0:i0 + n] = s[: N - i0] if i0 + n > N else s
    return out * g
add(thump(9.18, 62), 0.30)

chord_list = sum(pad_voice(hz(m), 0.08) for m in (50, 57, 62, 66, 69))
chord_list = lp(chord_list, 2400)
add(hp(chord_list, 120) * env(9.15, 14.9, 0.6, 0.8), 0.09)

# 7) pulse: soft muted plucks at 96 BPM eighths from 9.2 to 16.9 — "steady daily rhythm"
beat = 60 / 96 / 2
arp = [62, 69, 74, 69, 66, 69, 76, 69]
plk = np.zeros(N)
k = 0
x = 9.2
while x < 16.9:
    m = arp[k % len(arp)]
    i0 = int(x * SR); n = int(0.45 * SR)
    tt = np.arange(n) / SR
    s = (np.sin(2 * np.pi * hz(m) * tt) + 0.35 * np.sin(2 * np.pi * hz(m) * 2 * tt)) * np.exp(-tt * 9)
    end = min(N, i0 + n)
    plk[i0:end] += s[: end - i0] * (0.75 if k % 2 else 1.0)
    k += 1; x += beat
plk = lp(plk, 2600) * env(9.2, 17.0, 0.4, 0.4)
add(plk, 0.10, 0.15)

# list rows arriving (10.35 + i*0.12): tiny ascending ticks
for i in range(10):
    add(blip(10.35 + i * 0.12, hz(81 + [0, 2, 4, 7, 9][i % 5] + (12 if i >= 5 else 0)), 0.12, 1.0), 0.028, -0.4 + i * 0.08)

# 8) focus 14.6: gentle lift — filtered swell into hyperframes
sw = lp_sweep(pad_voice(hz(74), 0.1) + pad_voice(hz(78), 0.1), 500, 3600, 14.5, 16.8)
add(sw * env(14.5, 17.4, 0.5, 0.6), 0.05)
for i in range(10):  # 10/10 gate dots at 15.7 + i*0.04
    add(blip(15.7 + i * 0.04, hz(86 + (i % 3) * 2), 0.08, 1.0), 0.02, -0.3 + i * 0.06)

# 9) resolve 17.3: hit + warm Dmaj9 with high shimmer, long tail to 20 s
add(thump(17.32, 55), 0.28)
chord_end = sum(pad_voice(hz(m), 0.1) for m in (38, 50, 57, 61, 64, 66))
chord_end = lp(chord_end, 3200)
add(hp(chord_end, 90) * env(17.25, 20.0, 0.25, 1.4), 0.10)
shim = sum(np.sin(2 * np.pi * hz(m) * t + i) for i, m in enumerate((86, 90, 93)))
shim *= 0.5 + 0.5 * np.sin(2 * np.pi * 5.5 * t)
add(shim * env(17.6, 20.0, 0.8, 1.2), 0.012, 0.0)

# simple stereo "room": two short delays, feedback-free
def delay(x, ms, g):
    d = int(SR * ms / 1000); y = np.zeros_like(x); y[d:] = x[:-d] * g; return y
L2 = L + delay(R, 23, 0.25) + delay(L, 97, 0.18) + delay(R, 211, 0.10)
R2 = R + delay(L, 29, 0.25) + delay(R, 113, 0.18) + delay(L, 239, 0.10)

mix = np.stack([L2, R2], axis=1)
mix = hp(mix.T, 28).T
# global fade, soft clip, normalise to -1 dBFS peak
mix *= env(0, 20, 0.05, 0.6)[:, None]
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix /= np.max(np.abs(mix)) / 10 ** (-1 / 20)
wavfile.write("score.wav", SR, (mix * 32767).astype(np.int16))
print("ok", mix.shape)
