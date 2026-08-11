# -*- coding: utf-8 -*-
"""合成《辽·卷 — 指尖上的辽宁》参赛短视频的 60 秒国潮背景音乐。

全部音色现场算出来，不读任何采样、不下载任何素材，和作品里 Web Audio 的做法一致：
  · 拨弦（古筝感）—— Karplus-Strong 弦模型，拨片噪声激励 + 轻微音高漂移
  · 衬底 —— 正弦 + 五度叠置的极轻持续音
  · 打击 —— sine sweep 做鼓心，短噪声包络做鼓边/木击
  · 磬铃 —— 若干非谐分音 + 指数衰减
  · 空间 —— Schroeder 混响（4 路阻尼梳状 + 2 路全通），左右延时错开做真立体声

输出：build/bgm.wav（60.0s / 48kHz / 立体声 / 16-bit）
"""
import glob
import os
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.signal import butter, lfilter, sosfilt

SR = 48000
DUR = 60.0
N = int(SR * DUR)                    # 2 880 000，正好 60.0 秒

BPM = 92                             # 4/4，落在 88–100 区间偏中
BEAT = 60.0 / BPM                    # 0.652174 s
BAR = 4 * BEAT                       # 2.608696 s，60s ≈ 23 小节

PENT = (0, 2, 4, 7, 9)               # 五声：宫 商 角 徵 羽
BASE = 50                            # D3 = MIDI 50，全曲 D 宫

OUT_DIR = os.environ.get("BGM_OUT", "build")
TARGET_RMS_DB = -22.5                # 背景乐，压得比人声低一截
PEAK_CEIL_DB = -1.5                  # 留足混音余量（契约要求 ≤ -1.0）


def tb(bar, beat=0.0):
    """小节 + 拍 → 秒。"""
    return bar * BAR + beat * BEAT


def midi_of(idx):
    """五声音阶级进序号 → MIDI 音高。idx=0 为 D3，每 5 个序号升一个八度。"""
    return BASE + 12 * (idx // 5) + PENT[idx % 5]


def hz(midi):
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


# ---------------------------------------------------------------- 基础工具

def _fade_edges(y, attack=0.0015, release=0.06):
    """给单个音头尾抹一点斜坡，避免截断出咔哒声。"""
    na = min(int(SR * attack), len(y) // 4)
    nr = min(int(SR * release), len(y) // 2)
    if na > 1:
        y[:na] *= np.linspace(0.0, 1.0, na)
    if nr > 1:
        y[-nr:] *= np.linspace(1.0, 0.0, nr) ** 1.5
    return y


def _ks_loop(x, ni, coef, g):
    """块化求解 y[n] = x[n] + g·(c0·y[n-ni] + c1·y[n-ni-1] + c2·y[n-ni-2])。

    最短依赖是 n-ni，所以每块取 ni-2 个样本就能整块向量化，比逐样本快两个数量级。
    """
    n = len(x)
    pad = ni + 2
    xx = np.zeros(n + pad)
    xx[pad:] = x
    y = np.zeros(n + pad)
    c0, c1, c2 = coef
    step = max(1, ni - 2)
    i = pad
    while i < n + pad:
        j = min(i + step, n + pad)
        y[i:j] = xx[i:j] + g * (c0 * y[i - ni:j - ni]
                                + c1 * y[i - ni - 1:j - ni - 1]
                                + c2 * y[i - ni - 2:j - ni - 2])
        i = j
    return y[pad:]


def _drift(y, rng, depth=10.0):
    """时变分数延时读取 → 轻微音高漂移。没有它拨弦会僵得像 MIDI。"""
    n = len(y)
    t = np.arange(n, dtype=np.float64)
    knots = rng.normal(0.0, 1.0, n // 2048 + 3)
    walk = np.cumsum(knots)
    walk = np.interp(np.linspace(0, len(walk) - 1, n), np.arange(len(walk)), walk)
    walk /= np.abs(walk).max() + 1e-9
    lfo = np.sin(2 * np.pi * rng.uniform(3.6, 5.4) * t / SR + rng.uniform(0, 6.283))
    lfo *= np.clip(t / SR / 0.4, 0.0, 1.0)          # 揉弦总是起音之后才来
    return np.interp(t + depth * (0.7 * walk + 0.3 * lfo), t, y)


# ---------------------------------------------------------------- 音色

def pluck(midi, dur_s, vel, rng, bright=0.62, damp=0.12, tilt=9500.0):
    """Karplus-Strong 拨弦。dur_s 只决定让它响多久，弦本身按 T60 自然衰减。"""
    f = hz(midi) * 2.0 ** (rng.normal(0.0, 4.0) / 1200.0)   # ±几音分的失谐
    dtot = SR / f
    r = dtot - damp
    ni = max(6, int(r))
    frac = r - ni
    coef = ((1 - frac) * (1 - damp),
            (1 - frac) * damp + frac * (1 - damp),
            frac * damp)

    t60 = float(np.clip(3.3 * (220.0 / f) ** 0.5, 0.7, 4.6))
    g = 10.0 ** (-3.0 * dtot / (SR * t60))
    n = int(SR * float(np.clip(max(dur_s * 2.3, 0.6), 0.45, min(3.6, t60 * 0.95))))

    exc = rng.uniform(-1.0, 1.0, ni)
    exc = lfilter([bright], [1.0, -(1.0 - bright)], exc)     # 低通 → 拨片软硬
    exc[:max(3, ni // 12)] *= 1.9                            # 指甲触弦的那一下
    exc -= exc.mean()                                        # 去直流，否则会被环路养大
    exc /= np.abs(exc).max() + 1e-9

    x = np.zeros(n)
    x[:min(ni, n)] = exc[:min(ni, n)]
    y = _ks_loop(x, ni, coef, g)
    y = _drift(y, rng, depth=9.0)

    a = np.exp(-2 * np.pi * tilt / SR)                       # 一点点箱体阻尼
    y = lfilter([1 - a], [1.0, -a], y)
    y /= np.abs(y).max() + 1e-9
    return _fade_edges(y * vel * 0.55, attack=0.0008, release=0.08)


def bell(midi, vel, rng, ring=4.0, air=1.28):
    """磬 / 铃：几路非谐分音各自衰减，高分音掉得快，尾巴留长。"""
    n = int(SR * ring)
    t = np.arange(n) / SR
    f0 = hz(midi) * 2.0 ** (rng.normal(0.0, 3.0) / 1200.0)
    parts = ((1.000, 1.00, 1.0), (2.013, 0.52, 1.6), (2.985, 0.40, 2.0),
             (4.208, 0.26, 2.7), (5.431, 0.17, 3.4), (6.792, 0.11, 4.2),
             (8.147, 0.06, 5.0))
    y = np.zeros(n)
    for ratio, amp, dk in parts:
        f = f0 * ratio * (1.0 + rng.normal(0.0, 0.0016))
        env = np.exp(-t * dk * 3.0 / ring)
        y += amp * air ** (dk - 1.0) * env * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.283))
        # 同一分音再叠一个微失谐的孪生分音，让尾音自己打拍子
        y += 0.45 * amp * air ** (dk - 1.0) * env * np.sin(
            2 * np.pi * f * (1.0 + rng.uniform(0.0006, 0.0022)) * t + rng.uniform(0, 6.283))

    strike = rng.uniform(-1.0, 1.0, n) * np.exp(-t / 0.006) * 0.22
    sos = butter(2, [1200 / (SR / 2), 9000 / (SR / 2)], "bandpass", output="sos")
    y += sosfilt(sos, strike)

    y *= 1.0 - np.exp(-t / 0.0025)                            # 起音去咔哒
    y /= np.abs(y).max() + 1e-9
    return _fade_edges(y * vel * 0.5, attack=0.001, release=0.25)


def kick(vel, rng, low=52.0, high=150.0, decay=0.085):
    """鼓心：指数下滑的正弦扫频 + 一点噪声点火。故意不留长尾，免得低频糊住整首。"""
    n = int(SR * 0.4)
    t = np.arange(n) / SR
    f = low + (high - low) * np.exp(-t / 0.030)
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.exp(-t / decay) * (1.0 - np.exp(-t / 0.0018))
    y = np.sin(ph) * env
    y += rng.uniform(-1.0, 1.0, n) * np.exp(-t / 0.004) * 0.30
    sos = butter(2, 42.0 / (SR / 2), "highpass", output="sos")
    y = sosfilt(sos, y)
    return _fade_edges(y * vel * 0.58, attack=0.0002, release=0.05)


def ban(vel, rng):
    """鼓边 / 板：窄带噪声急促衰减，掺一点点音高感。"""
    n = int(SR * 0.11)
    t = np.arange(n) / SR
    sos = butter(2, [1500 / (SR / 2), 4600 / (SR / 2)], "bandpass", output="sos")
    y = sosfilt(sos, rng.uniform(-1.0, 1.0, n)) * np.exp(-t / 0.017)
    y += np.sin(2 * np.pi * 430 * t) * np.exp(-t / 0.011) * 0.3
    y /= np.abs(y).max() + 1e-9
    return _fade_edges(y * vel * 0.62, attack=0.0003, release=0.02)


def tick(vel, rng):
    """木质轻击，垫在十六分格子上做律动。"""
    n = int(SR * 0.06)
    t = np.arange(n) / SR
    sos = butter(2, [2600 / (SR / 2), 8500 / (SR / 2)], "bandpass", output="sos")
    y = sosfilt(sos, rng.uniform(-1.0, 1.0, n)) * np.exp(-t / 0.0075)
    y /= np.abs(y).max() + 1e-9
    return _fade_edges(y * vel * 0.4, attack=0.0002, release=0.012)


def drone(midi, dur_s, vel, rng):
    """衬底：根音 + 五度叠置，慢速起伏，只用来占空间。

    重心刻意压在五度和八度上而不是基频，再切掉 55Hz 以下——不然 22 屏蒙太奇一叠
    整首就糊成一团低频。
    """
    n = int(SR * dur_s)
    t = np.arange(n) / SR
    f = hz(midi)
    y = np.zeros(n)
    for mult, amp in ((1.0, 0.55), (1.5, 0.85), (2.0, 0.5), (3.0, 0.26), (4.0, 0.12)):
        det = 1.0 + rng.normal(0.0, 0.0008)
        y += amp * np.sin(2 * np.pi * f * mult * det * t + rng.uniform(0, 6.283))
    y *= 1.0 + 0.30 * np.sin(2 * np.pi * rng.uniform(0.05, 0.09) * t + rng.uniform(0, 6.283))
    sos = butter(2, 55.0 / (SR / 2), "highpass", output="sos")
    y = sosfilt(sos, y)
    y /= np.abs(y).max() + 1e-9
    edge = int(SR * min(1.4, dur_s / 3))
    y[:edge] *= np.linspace(0, 1, edge) ** 2
    y[-edge:] *= np.linspace(1, 0, edge) ** 2
    return y * vel


# ---------------------------------------------------------------- 混响

def _comb(x, d, g, damp):
    """带阻尼的反馈梳状：反馈路上串一个一阶低通，尾巴才不会金属化。"""
    n = len(x)
    xx = np.concatenate([np.zeros(d), x])
    y = np.zeros(n + d)
    b, a = [1.0 - damp], [1.0, -damp]
    zi = np.zeros(1)
    for i in range(d, n + d, d):
        j = min(i + d, n + d)
        f, zi = lfilter(b, a, y[i - d:j - d], zi=zi)
        y[i:j] = xx[i:j] + g * f
    return y[d:]


def _allpass(x, d, g):
    n = len(x)
    xx = np.concatenate([np.zeros(d), x])
    y = np.zeros(n + d)
    for i in range(d, n + d, d):
        j = min(i + d, n + d)
        y[i:j] = -g * xx[i:j] + xx[i - d:j - d] + g * y[i - d:j - d]
    return y[d:]


def reverb(stereo, rt60=2.1, damp=0.32):
    """Schroeder：4 路梳状并联 → 2 路全通串联；左右用不同延时长度拉开宽度。"""
    combs_ms = ((29.7, 37.1, 41.1, 43.7), (31.3, 38.6, 42.9, 45.5))
    aps_ms = ((5.0, 1.7), (5.4, 1.9))
    out = np.zeros_like(stereo)
    for ch in (0, 1):
        acc = np.zeros(stereo.shape[1])
        for ms in combs_ms[ch]:
            d = int(SR * ms / 1000.0)
            g = 10.0 ** (-3.0 * d / (SR * rt60))
            acc += _comb(stereo[ch], d, g, damp)
        acc /= len(combs_ms[ch])
        for ms in aps_ms[ch]:
            acc = _allpass(acc, int(SR * ms / 1000.0), 0.7)
        out[ch] = acc
    return out


# ---------------------------------------------------------------- 编排

def place(dry, snd, sig, t, pan=0.0, send=0.45):
    """把一个音摆到时间轴上，等功率声像，并按比例送一份进混响。"""
    i0 = int(round(t * SR))
    if i0 >= N:
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), N - i0)
    if n <= 0:
        return
    s = sig[:n]
    ang = (np.clip(pan, -1, 1) + 1) * 0.25 * np.pi
    gl, gr = np.cos(ang), np.sin(ang)
    dry[0, i0:i0 + n] += s * gl
    dry[1, i0:i0 + n] += s * gr
    if send > 0:
        snd[0, i0:i0 + n] += s * gl * send
        snd[1, i0:i0 + n] += s * gr * send


# 主题句：(拍位, 音阶序号, 时值拍数, 力度)。序号 5=D4 6=E4 7=F#4 8=A4 9=B4 10=D5 …
PH_A = [(0.0, 7, 1.0, .90), (1.0, 9, 0.5, .70), (1.5, 8, 0.5, .66), (2.0, 7, 1.0, .80),
        (3.0, 5, 1.0, .72), (4.0, 6, 1.5, .85), (5.5, 7, 0.5, .60), (6.0, 9, 2.0, .88),
        (8.0, 8, 1.0, .78), (9.0, 7, 0.5, .64), (9.5, 6, 0.5, .60), (10.0, 5, 1.5, .80),
        (11.5, 4, 0.5, .62), (12.0, 5, 2.0, .85), (14.0, 8, 1.0, .66), (15.0, 7, 1.0, .58)]

PH_B = [(0.0, 10, 0.5, .86), (0.5, 9, 0.5, .70), (1.0, 8, 1.0, .80), (2.0, 9, 0.5, .72),
        (2.5, 10, 0.5, .78), (3.0, 12, 1.0, .90), (4.0, 11, 1.0, .78), (5.0, 10, 0.5, .70),
        (5.5, 9, 0.5, .66), (6.0, 8, 2.0, .82), (8.0, 9, 0.5, .76), (8.5, 10, 0.5, .72),
        (9.0, 11, 1.5, .86), (10.5, 10, 0.5, .62), (11.0, 8, 1.0, .74), (12.0, 9, 0.5, .70),
        (12.5, 8, 0.5, .64), (13.0, 6, 1.0, .78), (14.0, 7, 2.0, .72)]

PH_C = [(0.0, 12, 0.5, .95), (0.5, 11, .25, .70), (0.75, 10, .25, .68), (1.0, 11, 0.5, .80),
        (1.5, 12, 0.5, .85), (2.0, 13, 1.0, .95), (3.0, 12, 0.5, .78), (3.5, 11, 0.5, .74),
        (4.0, 10, 0.5, .85), (4.5, 11, .25, .66), (4.75, 12, .25, .68), (5.0, 13, 1.0, .90),
        (6.0, 12, 0.5, .76), (6.5, 10, 0.5, .72), (7.0, 11, 1.0, .80), (8.0, 12, 0.5, .88),
        (8.5, 13, 0.5, .80), (9.0, 12, 0.5, .74), (9.5, 11, 0.5, .70), (10.0, 10, 1.0, .84),
        (11.0, 9, 1.0, .72), (12.0, 10, 0.5, .82), (12.5, 11, 0.5, .74), (13.0, 12, 1.0, .88),
        (14.0, 10, 0.5, .70), (14.5, 9, 0.5, .66), (15.0, 8, 1.0, .78)]

PH_D = [(0.0, 7, 1.0, .88), (1.0, 9, 0.5, .72), (1.5, 10, 0.5, .76), (2.0, 9, 1.0, .82),
        (3.0, 7, 1.0, .70), (4.0, 8, 1.5, .84), (5.5, 7, 0.5, .62), (6.0, 5, 2.0, .80),
        (8.0, 6, 1.0, .70), (9.0, 7, 1.0, .66), (10.0, 5, 2.0, .74)]

PH_E = [(0.0, 8, 2.0, .60), (2.5, 7, 1.5, .52), (4.0, 5, 2.0, .56), (6.5, 6, 1.0, .46),
        (8.0, 7, 2.0, .50), (10.5, 5, 1.5, .42)]

PH_INTRO = [(1.5, 5, 2.0, .50), (4.0, 7, 1.5, .44), (6.5, 8, 1.5, .38)]

# 打击型：以十六分为格，(鼓心, 板, 木击)
PAT = {
    "a": ({0, 6, 10}, {4, 12}, {2, 8, 14}),
    "b": ({0, 10}, {4, 12}, {2, 6, 8, 11, 14}),
    "c": ({0, 3, 6, 10}, {4, 12}, {2, 8, 9, 14, 15}),
    "d": ({0, 3, 6, 8, 10, 13}, {4, 12}, {1, 2, 5, 7, 9, 11, 14, 15}),
}
# 每小节挑一型，刻意不让相邻小节重样
BAR_PAT = {2: "a", 3: "b", 4: "a", 5: "c", 6: "b", 7: "c", 8: "b", 9: "d",
           10: "c", 11: "d", 12: "c", 13: "d", 14: "c", 15: "b", 16: "a"}


def play(dry, snd, phrase, bar0, rng, gain=1.0, pan_c=0.05, send=0.5, octave=0):
    for beat, idx, dur, vel in phrase:
        t = tb(bar0) + beat * BEAT + rng.normal(0.0, 0.010)      # 时间 humanize
        v = vel * gain * float(np.clip(rng.normal(1.0, 0.10), 0.55, 1.35))
        sig = pluck(midi_of(idx) + 12 * octave, dur * BEAT, v, rng,
                    bright=float(np.clip(rng.normal(0.55, 0.07), 0.35, 0.8)))
        place(dry, snd, sig, t, pan_c + rng.normal(0.0, 0.13), send)


def gliss(dry, snd, t0, lo, hi, rng, vel=0.5, step=0.036, down=False):
    """刮奏：顺着五声音阶快速掠一串音，做段落转接。"""
    seq = list(range(lo, hi))
    if down:
        seq = seq[::-1]
    for k, idx in enumerate(seq):
        v = vel * (0.45 + 0.55 * (1 - k / max(1, len(seq) - 1)) if down else
                   0.45 + 0.55 * k / max(1, len(seq) - 1))
        sig = pluck(midi_of(idx), 0.35, v, rng, bright=0.7)
        place(dry, snd, sig, t0 + k * step * rng.uniform(0.9, 1.1),
              -0.25 + 0.5 * k / max(1, len(seq) - 1), 0.6)


def build():
    rng = np.random.default_rng(20260811)
    dry = np.zeros((2, N))
    snd = np.zeros((2, N))

    # —— 0–5.2s 引子：一声磬，三个稀疏拨弦，大量留白
    place(dry, snd, bell(midi_of(10), 0.62, rng, ring=6.0), 0.05, -0.16, 0.75)
    place(dry, snd, bell(midi_of(13), 0.22, rng, ring=3.2), 0.09, 0.38, 0.85)
    play(dry, snd, PH_INTRO, 0, rng, gain=0.95, pan_c=0.0, send=0.7)
    place(dry, snd, drone(BASE - 12, 8.0, 0.085, rng), 0.4, 0.0, 0.35)

    # —— 5.2–44.3s 主段：衬底进场，四个乐句一路推到小高潮再回落
    for bar0, root, span in ((2, BASE - 12, 4), (6, BASE - 5, 4),
                             (10, BASE - 12, 4), (14, BASE - 12, 3.4)):
        place(dry, snd, drone(root, span * BAR + 1.2, 0.085, rng), tb(bar0) - 0.55, 0.0, 0.4)

    play(dry, snd, PH_A, 2, rng, gain=0.95, pan_c=0.04, send=0.55)
    play(dry, snd, PH_B, 6, rng, gain=1.0, pan_c=0.08, send=0.5)
    play(dry, snd, PH_C, 10, rng, gain=1.05, pan_c=0.02, send=0.45)
    play(dry, snd, PH_D, 14, rng, gain=0.95, pan_c=0.06, send=0.55)

    # 低音区伴奏：每小节换一种落点，避免机械重复
    figs = ([0.0, 1.5, 2.5], [0.5, 2.0, 3.5], [0.0, 1.0, 2.5, 3.0], [0.5, 1.5, 3.0])
    prev = -1
    for bar in range(2, 17):
        k = rng.integers(0, len(figs))
        while k == prev:
            k = rng.integers(0, len(figs))
        prev = k
        low = 0 if bar < 6 or bar >= 10 else 2      # 跟着衬底换根音
        for beat in figs[k]:
            idx = low + int(rng.integers(0, 4))
            v = 0.34 * (1.0 + 0.25 * (bar >= 10)) * rng.uniform(0.8, 1.15)
            sig = pluck(midi_of(idx), 1.1, v, rng, bright=0.48)
            place(dry, snd, sig, tb(bar) + beat * BEAT + rng.normal(0, 0.012),
                  -0.42 + rng.normal(0, 0.12), 0.5)

    # 打击：5.2s 进，44.3s 收；小节末尾偶尔加个小过门
    for bar, key in BAR_PAT.items():
        ks, bs, ts = PAT[key]
        grow = 0.78 + 0.22 * min(1.0, (bar - 2) / 8.0)
        for slot in range(16):
            t = tb(bar) + slot * BEAT / 4 + rng.normal(0.0, 0.008)
            if slot in ks:
                v = (1.0 if slot == 0 else 0.72) * grow * rng.uniform(0.9, 1.08)
                place(dry, snd, kick(v, rng), t, 0.0, 0.16)
            if slot in bs:
                place(dry, snd, ban(0.78 * grow * rng.uniform(0.85, 1.1), rng),
                      t, 0.22 + rng.normal(0, 0.08), 0.42)
            if slot in ts:
                place(dry, snd, tick(0.6 * grow * rng.uniform(0.7, 1.15), rng),
                      t, -0.48 + rng.normal(0, 0.14), 0.3)
        if bar in (5, 9, 13):                        # 四小节一收的过门
            for slot, v in ((13, .5), (14, .62), (15, .8)):
                place(dry, snd, tick(v, rng), tb(bar) + slot * BEAT / 4, rng.uniform(-.5, .5), 0.4)

    # 钟磬点缀：段落起点用大颗，乐句中间撒几粒高音铃提亮
    # 大颗磬故意提前一点点落，别和乐句首音、重音鼓撞成一根尖峰
    for bar, idx, v, pan, off in ((2, 15, .30, .34, -.02), (6, 13, .26, -.36, -.03),
                                  (10, 15, .34, .26, -.055), (13, 16, .24, -.30, -.02),
                                  (14, 13, .30, -.24, -.035), (17, 12, .34, .20, -.02)):
        place(dry, snd, bell(midi_of(idx), v, rng, ring=4.2), tb(bar) + off, pan, 0.8)
    for bar, beat, idx, v in ((3, 2.5, 17, .13), (5, 1.0, 16, .11), (7, 3.0, 18, .12),
                              (9, 1.5, 17, .12), (11, 2.0, 18, .15), (12, 0.5, 16, .13),
                              (15, 2.5, 17, .11), (18, 1.0, 16, .10)):
        place(dry, snd, bell(midi_of(idx), v, rng, ring=2.6, air=1.4),
              tb(bar, beat) + rng.normal(0, 0.02), rng.uniform(-.55, .55), 0.9)

    # 转接刮奏
    gliss(dry, snd, tb(9, 3.2), 5, 13, rng, vel=0.30, step=0.048)             # 推进高潮
    gliss(dry, snd, tb(16, 3.1), 5, 13, rng, vel=0.24, step=0.052, down=True)  # 落回收束
    place(dry, snd, kick(0.55, rng, low=46, high=158, decay=0.12), tb(10) + 0.018, 0.0, 0.3)

    # —— 44.3–52.2s 收束：鼓全退，只剩拨弦和衬底
    play(dry, snd, PH_E, 17, rng, gain=0.9, pan_c=0.0, send=0.75)
    place(dry, snd, drone(BASE - 12, 10.5, 0.072, rng), tb(17) - 0.3, 0.0, 0.45)

    # —— 52.2–60s 尾声：一声长磬 + 余韵，自然消散
    place(dry, snd, bell(midi_of(10), 0.58, rng, ring=7.0), tb(20) + 0.15, -0.10, 0.9)
    place(dry, snd, bell(midi_of(15), 0.22, rng, ring=4.5), tb(20) + 0.20, 0.34, 0.9)
    place(dry, snd, pluck(midi_of(5), 2.4, 0.44, rng, bright=0.45), tb(20, 2.6), 0.06, 0.8)
    place(dry, snd, pluck(midi_of(8), 2.0, 0.30, rng, bright=0.4), tb(21, 1.4), -0.18, 0.85)
    place(dry, snd, bell(midi_of(13), 0.26, rng, ring=5.5), tb(22) + 0.1, 0.12, 0.95)
    place(dry, snd, drone(BASE - 12, 9.4, 0.068, rng), tb(19) + 0.4, 0.0, 0.5)

    return dry, snd


def _shelf(x, f, gain_db, kind):
    """一阶意义上的搁架 EQ：拿滤出来的那一半按增益补回干信号。"""
    sos = butter(2, f / (SR / 2), kind, output="sos")
    return x + (10.0 ** (gain_db / 20.0) - 1.0) * sosfilt(sos, x, axis=1)


def _limit(x, ceil, look=0.012):
    """前瞻峰值限制器：只压那几个孤立的尖峰，别让它们替整首决定音量。

    先算逐样本需要的增益，取前瞻窗内的最小值（提前把音量拉下来），再做箱式平滑
    去掉增益的硬拐角。平滑窗比前瞻窗窄，所以平滑后的增益必然不高于所需增益。
    """
    w = int(SR * look)
    need = np.minimum(1.0, ceil / (np.abs(x).max(axis=0) + 1e-12))
    g = minimum_filter1d(need, size=2 * w + 1, mode="nearest")
    g = uniform_filter1d(uniform_filter1d(g, w, mode="nearest"), w // 2, mode="nearest")
    return x * g


# 全曲响度走向（秒, dB）：引子留白、高潮抬头、收束回落，避免整首一个音量
ARC = ((0.0, -7.5), (2.2, -6.4), (5.2, -3.6), (10.4, -2.6), (15.7, -1.9),
       (21.0, -0.9), (26.1, 0.0), (31.3, 0.2), (36.5, -1.0), (41.7, -2.9),
       (44.4, -6.2), (48.0, -7.8), (52.2, -6.4), (55.5, -8.4), (60.0, -9.6))


def master(dry, snd):
    mix = dry + 0.95 * reverb(snd)

    mix -= mix.mean(axis=1, keepdims=True)                     # 去直流
    # 42Hz 以下没有乐音（鼓心基频 52Hz、衬底最低分音 73Hz），全是白占动态的隆隆声
    sos = butter(4, 42.0 / (SR / 2), "highpass", output="sos")
    mix = sosfilt(sos, mix, axis=1)

    mix = _shelf(mix, 150.0, -6.0, "lowpass")                  # 收掉衬底和鼓堆出来的低频
    mix = _shelf(mix, 2400.0, 1.5, "highpass")                 # 让拨弦的颗粒出来
    mix = _shelf(mix, 6000.0, 4.0, "highpass")                 # 补空气感

    t = np.arange(N) / SR
    ctrl = np.arange(0.0, DUR + 0.02, 0.01)                    # 100Hz 控制率上做平滑，够快也够细
    arc = np.interp(ctrl, [a for a, _ in ARC], [b for _, b in ARC])
    k = np.hanning(61)
    arc = np.convolve(np.pad(arc, 30, mode="edge"), k / k.sum(), mode="valid")
    mix *= 10.0 ** (np.interp(t, ctrl, arc) / 20.0)

    fi, fo = int(SR * 0.3), int(SR * 2.0)
    env = np.ones(N)
    env[:fi] = 0.5 - 0.5 * np.cos(np.pi * np.linspace(0, 1, fi))     # 0.3s 淡入
    env[-fo:] = (0.5 + 0.5 * np.cos(np.pi * np.linspace(0, 1, fo))) ** 1.4   # 2s 淡出
    mix *= env

    ceil = 10.0 ** (PEAK_CEIL_DB / 20.0)
    mix *= 10.0 ** (TARGET_RMS_DB / 20.0) / (np.sqrt(np.mean(mix ** 2)) + 1e-12)
    mix = _limit(mix, ceil)
    mix *= min(1.0, ceil / (np.abs(mix).max() + 1e-12))        # 兜底，保证绝不越顶

    dither = (np.random.default_rng(7).random(mix.shape)
              - np.random.default_rng(8).random(mix.shape)) / 32768.0
    return mix + dither * 0.5, t


def report(x):
    peak = np.abs(x).max()
    rms = np.sqrt(np.mean(x ** 2))
    print(f"  时长   : {x.shape[1] / SR:.4f} s")
    print(f"  采样率 : {SR} Hz   声道: {x.shape[0]}")
    print(f"  峰值   : {20 * np.log10(peak + 1e-12):+.2f} dBFS")
    print(f"  RMS    : {20 * np.log10(rms + 1e-12):+.2f} dBFS")
    print(f"  直流   : L {x[0].mean():+.2e}  R {x[1].mean():+.2e}")


def encode_mp3(wav, mp3):
    """挑一个能用的 ffmpeg 编 128kbps 预览。

    PATH 上那个 ffmpeg 只有 MediaFoundation 的 mp3_mf，它不写 Xing 头，
    播放器和 ffprobe 会把 60 秒读成 55 秒；所以优先找带 libmp3lame 的版本。
    """
    cands = ["ffmpeg"] + glob.glob(os.path.expandvars(
        r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\*\bin\ffmpeg.exe"))
    found = []
    for exe in cands:
        try:
            r = subprocess.run([exe, "-hide_banner", "-encoders"],
                               capture_output=True, text=True)
        except OSError:
            continue
        if r.returncode == 0:
            for codec in ("libmp3lame", "mp3_mf"):
                if codec in r.stdout:
                    found.append((0 if codec == "libmp3lame" else 1, exe, codec))
    for _, exe, codec in sorted(found):
        r = subprocess.run([exe, "-y", "-loglevel", "error", "-i", wav,
                            "-codec:a", codec, "-b:a", "128k", mp3],
                           capture_output=True, text=True)
        if r.returncode == 0:
            return codec
    raise SystemExit("没有可用的 mp3 编码器")


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    mix, _ = master(*build())
    report(mix)

    # 有同伴 agent 在轮询这个文件，先写临时文件再原子替换，别让人读到半截
    wav = os.path.join(OUT_DIR, "bgm.wav")
    tmp = wav + ".tmp"
    wavfile.write(tmp, SR, (np.clip(mix.T, -1.0, 1.0) * 32767.0).astype(np.int16))
    os.replace(tmp, wav)
    print("写出", wav)

    mp3 = os.path.join(OUT_DIR, "bgm_preview.mp3")
    print("写出", mp3, f"({encode_mp3(wav, mp3)})")
