# -*- coding: utf-8 -*-
"""素材后处理：裁边、抠底、压缩，输出到 public/assets/img/"""
import os
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

SRC = r"C:\Users\wjx\.cursor\projects\c-Users-wjx-Desktop\assets"
DST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "assets", "img")
os.makedirs(DST, exist_ok=True)


def save_jpg(img: Image.Image, name: str, quality=82):
    img.convert("RGB").save(os.path.join(DST, name), "JPEG", quality=quality, optimize=True, progressive=True)
    print(f"  -> {name}  {img.size}")


def resize_max(img: Image.Image, max_w=None, max_h=None):
    w, h = img.size
    scale = 1.0
    if max_w and w > max_w:
        scale = min(scale, max_w / w)
    if max_h and h > max_h:
        scale = min(scale, max_h / h)
    if scale < 1.0:
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return img


def trim_white_bars(img: Image.Image, thresh=245):
    """裁掉上下接近纯白的信箱条"""
    g = np.asarray(img.convert("L"))
    rows = (g < thresh).mean(axis=1)  # 每行非白像素占比
    keep = np.where(rows > 0.04)[0]
    if len(keep) == 0:
        return img
    top, bottom = keep[0], keep[-1]
    return img.crop((0, int(top), img.width, int(bottom) + 1))


def remove_bg_floodfill(img: Image.Image, tol=42, feather=2):
    """从四边 flood fill 去除近似纯色背景，输出 RGBA"""
    rgb = np.asarray(img.convert("RGB"), dtype=np.int16)
    h, w, _ = rgb.shape
    # 以四角平均色为背景参考色
    corners = np.vstack([rgb[2, 2], rgb[2, w - 3], rgb[h - 3, 2], rgb[h - 3, w - 3]])
    bg = corners.mean(axis=0)
    dist = np.abs(rgb - bg).sum(axis=2)
    similar = dist < tol * 3
    mask = np.zeros((h, w), dtype=bool)  # True = 背景
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if similar[y, x] and not mask[y, x]:
                mask[y, x] = True
                dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if similar[y, x] and not mask[y, x]:
                mask[y, x] = True
                dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and similar[ny, nx] and not mask[ny, nx]:
                mask[ny, nx] = True
                dq.append((ny, nx))
    alpha = np.where(mask, 0, 255).astype(np.uint8)
    a_img = Image.fromarray(alpha, "L").filter(ImageFilter.GaussianBlur(feather))
    out = img.convert("RGBA")
    out.putalpha(a_img)
    return out


def main():
    print("[1/4] 常规图片：压缩")
    plans = [
        ("intro-bg.jpg", "intro-bg.jpg", dict(max_h=1600), 80),
        ("papercut.jpg", "papercut.jpg", dict(max_w=900), 84),
        ("scene-honghaitan.jpg", "scene-honghaitan.jpg", dict(max_w=840), 80),
        ("scene-shuidong.jpg", "scene-shuidong.jpg", dict(max_w=840), 80),
        ("scene-duanqiao.jpg", "scene-duanqiao.jpg", dict(max_w=840), 80),
        ("scene-binhai.jpg", "scene-binhai.jpg", dict(max_w=840), 80),
        ("food-jiaozi.jpg", "food-jiaozi.jpg", dict(max_w=760), 80),
        ("food-xunji.jpg", "food-xunji.jpg", dict(max_w=760), 80),
        ("food-guobaorou.jpg", "food-guobaorou.jpg", dict(max_w=760), 80),
        ("food-haixian.jpg", "food-haixian.jpg", dict(max_w=760), 80),
    ]
    for src_name, dst_name, kw, q in plans:
        img = Image.open(os.path.join(SRC, src_name))
        save_jpg(resize_max(img, **kw), dst_name, q)

    print("[2/4] 全景图：去信箱白边 + 压缩")
    pano = Image.open(os.path.join(SRC, "panorama.jpg"))
    pano = trim_white_bars(pano)
    pano = resize_max(pano, max_h=980)
    save_jpg(pano, "panorama.jpg", 82)

    print("[3/4] 皮影：flood fill 抠底 -> PNG")
    puppet = Image.open(os.path.join(SRC, "puppet-raw.jpg"))
    puppet = resize_max(puppet, max_h=900)
    puppet = remove_bg_floodfill(puppet, tol=40, feather=1.5)
    # 裁掉透明留白
    bbox = puppet.getchannel("A").getbbox()
    if bbox:
        puppet = puppet.crop(bbox)
    puppet.save(os.path.join(DST, "puppet.png"), "PNG", optimize=True)
    print(f"  -> puppet.png  {puppet.size}")

    print("[4/4] 体积统计")
    total = 0
    for f in sorted(os.listdir(DST)):
        size = os.path.getsize(os.path.join(DST, f))
        total += size
        print(f"  {f:26s} {size/1024:8.0f} KB")
    print(f"  TOTAL {total/1024/1024:.2f} MB")


if __name__ == "__main__":
    main()
