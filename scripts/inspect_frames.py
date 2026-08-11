# -*- coding: utf-8 -*-
"""看一眼录制素材：帧数、分辨率、体积、各分镜时间轴。"""
import json
import os

from PIL import Image

fr = json.load(open("build/frames.json"))
frames = fr["frames"]
print("frames:", len(frames), " span:", round((frames[-1]["t"] - frames[0]["t"]) / 1000, 1), "s")
print("size:", Image.open("build/frames/" + frames[0]["f"]).size)
print("bytes:", round(sum(os.path.getsize("build/frames/" + f["f"]) for f in frames) / 1048576, 1), "MB")

marks = json.load(open("build/marks.json"))
for m in marks:
    print("  {:10s} {:7.1f} - {:7.1f}  ({:.1f}s)".format(
        m["label"], m["t0"] / 1000, m["t1"] / 1000, (m["t1"] - m["t0"]) / 1000))
