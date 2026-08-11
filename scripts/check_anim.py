# -*- coding: utf-8 -*-
"""动图系列自检：规格核对 + 循环接缝量化 + 抽帧存图供目视验收。

1. ffprobe 逐条核对分辨率 / 编码 / pix_fmt / 帧率 / 时长 / 帧数 / 体积 / 有无音轨；
2. 抽首帧、末帧、倒数第二帧与两张中间帧到 build/anim/qa/；
3. 接缝量化：把"末帧→首帧"的平均像素差，和"倒数第二帧→末帧"这一次普通帧间差比较。
   前者不显著大于后者，就说明循环点和其它任何一帧的过渡一样自然。
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SRC_DIR = os.path.join("提交", "附加交付物", "动图系列")
QA_DIR = os.path.join("build", "anim", "qa")

SAFE = dict(top=120, bottom=120, left=60, right=60)   # 安全区，仅用于报告提示


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format",
                          "-of", "json", path], capture_output=True, text=True,
                         encoding="utf-8").stdout
    info = json.loads(out)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    audio = [s for s in info["streams"] if s["codec_type"] == "audio"]
    num, den = (int(x) for x in v["r_frame_rate"].split("/"))
    return dict(w=v["width"], h=v["height"], codec=v["codec_name"], pix=v["pix_fmt"],
                profile=v.get("profile", "-"), fps=num / den,
                frames=int(v.get("nb_frames", 0)), dur=float(info["format"]["duration"]),
                size=int(info["format"]["size"]), audio=len(audio))


def grab(path, idx, out):
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", path,
                    "-vf", f"select='eq(n\\,{idx})'", "-vsync", "0", "-frames:v", "1", out],
                   check=True)
    return np.asarray(Image.open(out).convert("RGB"), dtype=np.int16)


def sheet(stem):
    """把首帧/末帧（接缝对）与两张中间帧拼成 2×2 检查图，方便一眼看完。"""
    from PIL import ImageDraw
    from guochao_kit import F_KAI, font
    keys = [("first 首帧", "first"), ("last 末帧", "last"), ("mid1", "mid1"), ("mid2", "mid2")]
    out = Image.new("RGB", (1080, 1960), (24, 22, 20))
    d = ImageDraw.Draw(out)
    f = font(F_KAI, 26)
    for i, (label, key) in enumerate(keys):
        im = Image.open(os.path.join(QA_DIR, f"{stem}_{key}.png")).resize((530, 942), Image.LANCZOS)
        x, y = 5 + (i % 2) * 540, 30 + (i // 2) * 972
        out.paste(im, (x, y))
        d.text((x + 6, y - 26), label, font=f, fill=(240, 220, 170))
    p = os.path.join(QA_DIR, f"{stem}_sheet.png")
    out.save(p)
    return p


def main():
    os.makedirs(QA_DIR, exist_ok=True)
    files = sorted(f for f in os.listdir(SRC_DIR) if f.endswith(".mp4"))
    print(f"{'文件':34}{'分辨率':>12}{'编码':>8}{'pix_fmt':>10}{'fps':>6}"
          f"{'时长':>8}{'帧数':>7}{'体积MB':>9}{'音轨':>6}")
    rows = []
    for f in files:
        p = os.path.join(SRC_DIR, f)
        i = probe(p)
        rows.append((f, i))
        print(f"{f:34}{str(i['w']) + 'x' + str(i['h']):>12}{i['codec']:>8}{i['pix']:>10}"
              f"{i['fps']:>6.0f}{i['dur']:>8.2f}{i['frames']:>7}{i['size'] / 1048576:>9.2f}"
              f"{i['audio']:>6}")
        ok = (i["w"], i["h"]) == (1080, 1920) and i["codec"] == "h264" \
            and i["pix"] == "yuv420p" and 3.0 <= i["dur"] <= 6.0 \
            and i["size"] < 10 * 1048576 and i["audio"] == 0
        if not ok:
            print("    !! 规格不达标")

    print("\n循环接缝（平均像素差，0–255）")
    for f, i in rows:
        p = os.path.join(SRC_DIR, f)
        stem = os.path.splitext(f)[0]
        n = i["frames"]
        idx = {"first": 0, "prev": n - 2, "last": n - 1, "mid1": n // 3, "mid2": 2 * n // 3}
        arr = {k: grab(p, v, os.path.join(QA_DIR, f"{stem}_{k}.png")) for k, v in idx.items()}
        seam = float(np.abs(arr["last"] - arr["first"]).mean())
        step = float(np.abs(arr["last"] - arr["prev"]).mean())
        verdict = "无缝" if seam <= max(step * 2.2, step + 0.6) else "疑似跳变"
        print(f"  {f:34} 末→首 {seam:6.3f}   普通帧间 {step:6.3f}   {verdict}")
        print(f"      {sheet(stem)}")


if __name__ == "__main__":
    main()
