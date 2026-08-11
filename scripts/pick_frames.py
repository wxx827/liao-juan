# -*- coding: utf-8 -*-
"""按秒抽出录制素材里最接近的那一帧，用来肉眼确认各章高光时刻拍到了没有。

    python scripts/pick_frames.py 15.0 22.5 44.1 ...
不带参数时，按 marks.json 每个分镜结束前 0.3s 各抽一帧。
"""
import json
import os
import shutil
import sys

OUT = "build/check"
fr = json.load(open("build/frames.json"))
frames = fr["frames"]
t0 = frames[0]["t"]

if len(sys.argv) > 1:
    want = [(("t%07.2f" % float(a)).replace(".", "_"), float(a)) for a in sys.argv[1:]]
else:
    want = [(m["label"], m["t1"] / 1000.0 - (t0 - fr["start"]) / 1000.0 - 0.30)
            for m in json.load(open("build/marks.json"))]

shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT, exist_ok=True)
for name, sec in want:
    tgt = t0 + sec * 1000
    best = min(frames, key=lambda f: abs(f["t"] - tgt))
    dst = "%s/%s_%.2fs.jpg" % (OUT, name, sec)
    shutil.copyfile("build/frames/" + best["f"], dst)
    print(dst)
