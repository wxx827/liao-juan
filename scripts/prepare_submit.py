# -*- coding: utf-8 -*-
"""建立 `提交/` 目录并把二维码复制成规范文件名（原文件保留不动）。"""
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUBMIT = os.path.join(ROOT, "提交")

PAIRS = [
    ("build/qrcode_poster.png", "辽卷_指尖上的辽宁_二维码.png"),
    ("build/qrcode_plain.png", "辽卷_指尖上的辽宁_二维码_素码.png"),
]

if __name__ == "__main__":
    os.makedirs(SUBMIT, exist_ok=True)
    os.makedirs(os.path.join(SUBMIT, "附加交付物"), exist_ok=True)
    for src, dst in PAIRS:
        s = os.path.join(ROOT, src)
        d = os.path.join(SUBMIT, dst)
        if not os.path.exists(s):
            print("[缺失]", s)
            continue
        shutil.copy2(s, d)
        print("[复制]", dst, os.path.getsize(d), "bytes")
