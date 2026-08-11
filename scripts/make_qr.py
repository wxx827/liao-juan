# -*- coding: utf-8 -*-
"""生成参赛用二维码：国潮装帧版（海报式）+ 素码版（贴报名表用）。"""
import os
import math
import random

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw, ImageFont, ImageFilter

URL = os.environ.get("QR_URL", "https://wxx827.github.io/liao-juan/")
OUT_DIR = os.environ.get("QR_OUT", "build")

PAPER = (245, 239, 227)
RED = (166, 56, 46)
DEEP = (27, 47, 73)
GOLD = (201, 162, 39)
INK = (58, 50, 44)

FONTS = "C:/Windows/Fonts/"
F_TITLE = FONTS + "Source Han Serif SC Heavy (TrueType).ttf"
F_KAI = FONTS + "STKAITI.TTF"
F_SONG = FONTS + "STZHONGS.TTF"
F_HEI = FONTS + "msyh.ttc"


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.truetype(F_HEI, size)


def text_wh(draw, s, f):
    box = draw.textbbox((0, 0), s, font=f)
    return box[2] - box[0], box[3] - box[1]


def centered(draw, cx, y, s, f, fill, spacing=0):
    """按字距绘制一行居中文本，返回行高。"""
    if spacing:
        widths = [draw.textbbox((0, 0), ch, font=f)[2] - draw.textbbox((0, 0), ch, font=f)[0] for ch in s]
        total = sum(widths) + spacing * (len(s) - 1)
        x = cx - total / 2
        h = 0
        for ch, w in zip(s, widths):
            draw.text((x, y), ch, font=f, fill=fill)
            box = draw.textbbox((0, 0), ch, font=f)
            h = max(h, box[3])
            x += w + spacing
        return h
    w, _ = text_wh(draw, s, f)
    draw.text((cx - w / 2, y), s, font=f, fill=fill)
    return draw.textbbox((0, 0), s, font=f)[3]


def rice_paper(w, h, seed=7):
    """宣纸底：暖白基色 + 纤维噪点 + 四角淡淡的茶渍。"""
    rnd = random.Random(seed)
    img = Image.new("RGB", (w, h), PAPER)
    noise = Image.new("L", (w // 3, h // 3))
    noise.putdata([rnd.randint(118, 138) for _ in range((w // 3) * (h // 3))])
    noise = noise.resize((w, h), Image.BILINEAR).filter(ImageFilter.GaussianBlur(0.6))
    img = Image.blend(img, Image.merge("RGB", (noise, noise, noise)), 0.10)

    stain = Image.new("L", (w, h), 0)
    sd = ImageDraw.Draw(stain)
    for _ in range(14):
        cx, cy = rnd.randint(0, w), rnd.randint(0, h)
        r = rnd.randint(int(w * 0.12), int(w * 0.35))
        sd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=rnd.randint(14, 34))
    stain = stain.filter(ImageFilter.GaussianBlur(w * 0.06))
    tea = Image.new("RGB", (w, h), (214, 196, 166))
    return Image.composite(tea, img, stain.point(lambda v: int(v * 0.75)))


def cloud(draw, cx, cy, s, color, width, flip=1):
    """祥云纹样：三卷云头 + 一道云尾。flip=-1 左右镜像。"""
    s = abs(s)
    for dx, r in ((-1.0, 0.52), (0.0, 0.72), (1.05, 0.46)):
        x = cx + dx * s * flip
        rr = r * s
        draw.arc((x - rr, cy - rr, x + rr, cy + rr), 165, 375, fill=color, width=width)
        ir = rr * 0.45
        draw.arc((x - ir, cy - ir * 0.2, x + ir, cy + ir * 1.8), 180, 360, fill=color, width=width)
    draw.arc((cx - 1.9 * s, cy + 0.1 * s, cx + 1.9 * s, cy + 1.5 * s), 200, 340, fill=color, width=width)


def qr_matrix(url):
    qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_H, box_size=1, border=0)
    qr.add_data(url)
    qr.make(fit=True)
    return qr.get_matrix()


def draw_qr(matrix, target_px, fg=RED, bg=None, seal_text=None, seal_font=F_TITLE):
    """把 QR 矩阵画成圆点风格；三个定位角画成印章式回字方框，中心可嵌一枚朱印。"""
    n = len(matrix)
    m = max(6, target_px // n)          # 单模块像素
    size = n * m
    ss = 4                               # 超采样，边缘更干净
    img = Image.new("RGBA", (size * ss, size * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if bg:
        d.rectangle((0, 0, size * ss, size * ss), fill=bg)

    def is_finder(r, c):
        return (r < 7 and c < 7) or (r < 7 and c >= n - 7) or (r >= n - 7 and c < 7)

    dot = m * ss
    pad = dot * 0.06                     # 留一点点缝就够出圆角质感，再大会掉识别率
    for r in range(n):
        for c in range(n):
            if not matrix[r][c] or is_finder(r, c):
                continue
            x0, y0 = c * dot + pad, r * dot + pad
            d.rounded_rectangle((x0, y0, x0 + dot - 2 * pad, y0 + dot - 2 * pad),
                                radius=(dot - 2 * pad) * 0.28, fill=fg)

    # 定位角严格按 7-5-3 模块的直角方框画：识别器靠它定位，圆角化会显著掉识别率
    for (r0, c0) in ((0, 0), (0, n - 7), (n - 7, 0)):
        x0, y0 = c0 * dot, r0 * dot
        ring = ((0, 0, 7, 1), (0, 6, 7, 7), (0, 1, 1, 6), (6, 1, 7, 6))
        for a, b, cc, dd in ring:
            d.rectangle((x0 + a * dot, y0 + b * dot, x0 + cc * dot - 1, y0 + dd * dot - 1), fill=fg)
        d.rectangle((x0 + 2 * dot, y0 + 2 * dot, x0 + 5 * dot - 1, y0 + 5 * dot - 1), fill=fg)

    if seal_text:
        s = size * ss
        side = s * 0.185
        x0 = y0 = (s - side) / 2
        d.rounded_rectangle((x0 - side * 0.16, y0 - side * 0.16, x0 + side * 1.16, y0 + side * 1.16),
                            radius=side * 0.18, fill=(255, 255, 255, 235))
        d.rounded_rectangle((x0, y0, x0 + side, y0 + side), radius=side * 0.13, fill=fg)
        f = font(seal_font, int(side * 0.66))
        box = d.textbbox((0, 0), seal_text, font=f)
        d.text((x0 + side / 2 - (box[2] + box[0]) / 2, y0 + side / 2 - (box[3] + box[1]) / 2),
               seal_text, font=f, fill=PAPER)

    return img.resize((size, size), Image.LANCZOS)


def make_poster(url, path):
    W, H = 1080, 1500
    img = rice_paper(W, H)
    d = ImageDraw.Draw(img, "RGBA")

    # 双线金框
    d.rectangle((38, 38, W - 38, H - 38), outline=GOLD, width=5)
    d.rectangle((54, 54, W - 54, H - 54), outline=(GOLD[0], GOLD[1], GOLD[2], 120), width=2)
    for cx, flip in ((152, 1), (W - 152, -1)):
        cloud(d, cx, 150, 34, (GOLD[0], GOLD[1], GOLD[2], 150), 4, flip)

    # 竖排主标题：辽 · 卷
    ft = font(F_TITLE, 132)
    y = 132
    for ch in "辽卷":
        w, _ = text_wh(d, ch, ft)
        d.text((W / 2 - w / 2, y), ch, font=ft, fill=DEEP)
        y += 150
    d.line((W / 2, 128 + 150 - 22, W / 2, 128 + 150 - 4), fill=RED, width=6)

    fs = font(F_KAI, 46)
    centered(d, W / 2, y + 14, "指尖上的辽宁", fs, RED, spacing=14)

    fd = font(F_KAI, 30)
    centered(d, W / 2, y + 84, "传承 · 智绘 · 融合", fd, (INK[0], INK[1], INK[2]), spacing=10)

    # 二维码卡片
    card_top = y + 140
    card_w = 660
    card_x = (W - card_w) / 2
    d.rounded_rectangle((card_x + 8, card_top + 10, card_x + card_w + 8, card_top + card_w + 10),
                        radius=26, fill=(120, 100, 78, 60))
    d.rounded_rectangle((card_x, card_top, card_x + card_w, card_top + card_w),
                        radius=24, fill=(252, 249, 242), outline=RED, width=4)
    d.rounded_rectangle((card_x + 14, card_top + 14, card_x + card_w - 14, card_top + card_w - 14),
                        radius=16, outline=(GOLD[0], GOLD[1], GOLD[2], 160), width=2)

    qr = draw_qr(qr_matrix(url), card_w - 110, fg=RED, seal_text="辽")
    img.paste(qr, (int(card_x + (card_w - qr.width) / 2), int(card_top + (card_w - qr.height) / 2)), qr)

    # 底部指引
    by = card_top + card_w + 40
    fb = font(F_SONG, 40)
    centered(d, W / 2, by, "手机扫码 · 展开长卷", fb, DEEP, spacing=8)
    fu = font(F_HEI, 24)
    centered(d, W / 2, by + 62, url, fu, (120, 108, 96))
    fh = font(F_KAI, 24)
    centered(d, W / 2, by + 104, "22 屏 · 20 印 · 建议开启声音，横竖屏均可", fh, (128, 116, 104), spacing=3)

    img.save(path, quality=95)
    return path


def make_plain(url, path):
    """素码版：白底红码，四周留白，任何报名表都能直接贴。"""
    qr = draw_qr(qr_matrix(url), 900, fg=RED, seal_text="辽")
    pad = 90
    canvas = Image.new("RGB", (qr.width + pad * 2, qr.height + pad * 2), (255, 255, 255))
    canvas.paste(qr, (pad, pad), qr)
    canvas.save(path, quality=96)
    return path


def verify(path, url):
    """双解码器校验：pyzbar（贴近手机相机）+ OpenCV，两者都过才算稳。"""
    marks = []
    try:
        from pyzbar.pyzbar import decode
        got = [d.data.decode() for d in decode(Image.open(path))]
        marks.append(("pyzbar", url in got))
    except ImportError:
        marks.append(("pyzbar", None))
    try:
        import cv2
        got = cv2.QRCodeDetector().detectAndDecode(cv2.imread(path))[0]
        marks.append(("opencv", got == url))
    except ImportError:
        marks.append(("opencv", None))
    return marks


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for f in (make_poster(URL, os.path.join(OUT_DIR, "qrcode_poster.png")),
              make_plain(URL, os.path.join(OUT_DIR, "qrcode_plain.png"))):
        print(f, verify(f, URL))
