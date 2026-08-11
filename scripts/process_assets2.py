# -*- coding: utf-8 -*-
"""新章素材后处理：辽瓷瓶、雪景背景、大鼓"""
import os
from PIL import Image

SRC = r"C:\Users\wjx\.cursor\projects\c-Users-wjx-Desktop\assets"
DST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "assets", "img")
os.makedirs(DST, exist_ok=True)


def save_jpg(img, name, quality=82):
    img.convert("RGB").save(os.path.join(DST, name), "JPEG", quality=quality, optimize=True, progressive=True)
    print(f"  -> {name}  {img.size}  {os.path.getsize(os.path.join(DST, name))/1024:.0f}KB")


def resize_max(img, max_w=None, max_h=None):
    w, h = img.size
    scale = 1.0
    if max_w and w > max_w:
        scale = min(scale, max_w / w)
    if max_h and h > max_h:
        scale = min(scale, max_h / h)
    if scale < 1.0:
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return img


plans = [
    ("ci-vase.jpg", "ci-vase.jpg", dict(max_w=820), 84),
    ("bing-bg.jpg", "bing-bg.jpg", dict(max_h=1600), 80),
    ("gu-drum.jpg", "gu-drum.jpg", dict(max_w=820), 84),
]
for src, dst, kw, q in plans:
    save_jpg(resize_max(Image.open(os.path.join(SRC, src)), **kw), dst, q)
print("done")
