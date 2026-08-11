# -*- coding: utf-8 -*-
"""校验 build/bgm.wav 是否符合交付契约，并画一张波形 + 频谱图供人眼复核。"""
import os

import numpy as np
from scipy.io import wavfile
import matplotlib
matplotlib.use("Agg")
matplotlib.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei", "DejaVu Sans"]
matplotlib.rcParams["axes.unicode_minus"] = False
import matplotlib.pyplot as plt

WAV = os.environ.get("BGM_WAV", "build/bgm.wav")
PNG = os.environ.get("BGM_PNG", "build/bgm_check.png")

# 设计上的段落分界（秒），用来核对能量起伏是否对得上
MARKS = [(0.0, "引子"), (5.22, "主段A"), (15.65, "主段B"), (26.09, "高潮"),
         (36.52, "再现"), (44.35, "收束"), (52.17, "尾声"), (58.0, "淡出")]


def db(v):
    return 20.0 * np.log10(np.asarray(v) + 1e-12)


def main():
    sr, raw = wavfile.read(WAV)
    ch = raw.shape[1] if raw.ndim > 1 else 1
    x = raw.astype(np.float64) / 32768.0
    n = x.shape[0]

    peak = np.abs(x).max()
    rms = np.sqrt(np.mean(x ** 2))
    clipped = int(np.sum(np.abs(raw) >= 32767))
    print(f"文件     : {WAV}  ({os.path.getsize(WAV) / 1e6:.2f} MB)")
    print(f"时长     : {n / sr:.6f} s   ({n} 样本)")
    print(f"采样率   : {sr} Hz    声道: {ch}    位深: {raw.dtype}")
    print(f"峰值     : {db(peak):+.2f} dBFS   (契约 ≤ -1.00)")
    print(f"RMS      : {db(rms):+.2f} dBFS")
    print(f"削波样本 : {clipped}")
    print(f"直流偏置 : L {x[:, 0].mean():+.3e}   R {x[:, 1].mean():+.3e}")

    # 孤立尖峰会把整首的音量拉低，这里盯一下峰值到底有多"独"
    amp = np.abs(x).max(axis=1)
    ipk = int(np.argmax(amp))
    print(f"峰值位置 : {ipk / sr:.3f} s   波峰因数 {db(peak) - db(rms):+.1f} dB")
    print(f"近顶样本 : {int(np.sum(amp > peak * 0.71)):,} 个在峰值 -3dB 以内 "
          f"({np.sum(amp > peak * 0.71) / n * 100:.3f}%)")

    corr = float(np.corrcoef(x[:, 0], x[:, 1])[0, 1])
    print(f"左右相关 : {corr:+.4f}   (1.0 = 假立体声)")
    print(f"首尾电平 : 起 {db(np.abs(x[:int(sr*0.02)]).max()):+.1f} dBFS   "
          f"末 {db(np.abs(x[-int(sr*0.02):]).max()):+.1f} dBFS")

    mono = x.mean(axis=1)
    win = int(sr * 0.25)
    frames = mono[:n // win * win].reshape(-1, win)
    env = db(np.sqrt(np.mean(frames ** 2, axis=1)))
    te = np.arange(len(env)) * 0.25
    print("\n分段 RMS (dBFS):")
    for (t0, name), (t1, _) in zip(MARKS, MARKS[1:] + [(n / sr, "")]):
        seg = env[(te >= t0) & (te < t1)]
        if len(seg):
            print(f"  {t0:5.1f}–{t1:5.1f}s  {name:4s}  {seg.mean():+6.1f}  峰段 {seg.max():+6.1f}")

    band = np.abs(np.fft.rfft(mono * np.hanning(n)))
    fr = np.fft.rfftfreq(n, 1 / sr)
    print("\n频段能量占比:")
    total = np.sum(band ** 2)
    for lo, hi in ((20, 120), (120, 400), (400, 1200), (1200, 4000), (4000, 12000), (12000, 20000)):
        p = np.sum(band[(fr >= lo) & (fr < hi)] ** 2) / total
        print(f"  {lo:5d}–{hi:5d} Hz  {p * 100:5.1f}%  {'#' * int(p * 60)}")

    fig, ax = plt.subplots(3, 1, figsize=(14, 10), height_ratios=[2, 1.4, 2.6])
    t = np.arange(n) / sr
    ax[0].plot(t, x[:, 0], lw=0.3, color="#a6382e", alpha=.8, label="L")
    ax[0].plot(t, -x[:, 1], lw=0.3, color="#1b2f49", alpha=.8, label="R (inverted)")
    ax[0].set_ylim(-1, 1)
    ax[0].set_ylabel("waveform")
    ax[0].legend(loc="upper right", fontsize=8)

    ax[1].plot(te, env, color="#c9a227", lw=1.4)
    ax[1].set_ylim(-70, 0)
    ax[1].set_ylabel("RMS dBFS / 250ms")

    with np.errstate(divide="ignore"):
        ax[2].specgram(mono, NFFT=2048, Fs=sr, noverlap=1536, cmap="magma", vmin=-140, vmax=-30)
    ax[2].set_yscale("symlog", linthresh=200)
    ax[2].set_ylim(20, 20000)
    ax[2].set_ylabel("Hz")
    ax[2].set_xlabel("seconds")

    for a in ax:
        a.set_xlim(0, n / sr)
        for tm, name in MARKS:
            a.axvline(tm, color="#3a8f6a", ls="--", lw=0.8, alpha=.7)
        a.grid(alpha=.15)
    for tm, name in MARKS:
        ax[0].text(tm + 0.15, 0.82, name, fontsize=8, color="#3a8f6a")

    fig.suptitle(f"bgm.wav  {n/sr:.2f}s  {sr}Hz  {ch}ch   "
                 f"peak {db(peak):+.2f} dBFS   rms {db(rms):+.2f} dBFS", fontsize=11)
    fig.tight_layout()
    fig.savefig(PNG, dpi=110)
    print("\n写出", PNG)


if __name__ == "__main__":
    main()
