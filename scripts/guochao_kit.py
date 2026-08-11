# -*- coding: utf-8 -*-
"""国潮版式工具箱：宣纸底、祥云、朱印、文字排版、柔光圆盘。

动图系列（make_anim.py）与分享海报（make_poster.py）共用同一套配色与笔法，
保证附加交付物与已有的 qrcode_poster / 明信片是同一副面孔。
"""
import functools
import math
import random

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

# ── 配色（与 src/styles/main.css、make_qr.py 一致）────────────────────────────
PAPER = (245, 239, 227)   # 宣纸米白
RED = (166, 56, 46)       # 故宫红
DEEP = (27, 47, 73)       # 靛青
GOLD = (201, 162, 39)     # 鎏金
INK = (58, 50, 44)        # 墨
CELADON = (150, 186, 176)  # 千峰翠色（辽瓷釉）
BLUE = (26, 68, 116)      # 青花蓝

FONTS = "C:/Windows/Fonts/"
F_TITLE = FONTS + "Source Han Serif SC Heavy (TrueType).ttf"
F_KAI = FONTS + "STKAITI.TTF"    # 楷体
F_SONG = FONTS + "STZHONGS.TTF"  # 中宋
F_LI = FONTS + "STLITI.TTF"      # 隶书（印文）
F_XW = FONTS + "STXINWEI.TTF"    # 新魏
F_HEI = FONTS + "msyh.ttc"


@functools.lru_cache(maxsize=512)
def font(path, size):
    try:
        return ImageFont.truetype(path, int(size))
    except OSError:
        return ImageFont.truetype(F_HEI, int(size))


def rgba(c, a):
    return (c[0], c[1], c[2], int(max(0, min(255, a))))


def lerp(a, b, u):
    return a + (b - a) * u


def mix(c1, c2, u):
    return tuple(int(round(lerp(c1[i], c2[i], u))) for i in range(3))


def smoothstep(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ease_out(x, p=3.0):
    return 1 - (1 - max(0.0, min(1.0, x))) ** p


def ramp(x, a, b):
    """把 x 从区间 [a,b] 线性映射到 [0,1] 并做平滑。"""
    if b <= a:
        return 1.0 if x >= b else 0.0
    return smoothstep((x - a) / (b - a))


# ── 文字 ────────────────────────────────────────────────────────────────────
def is_han(ch):
    return "\u3400" <= ch <= "\u9fff"


def row(draw, cx, cy, s, f, fill, spacing=0, alt=None):
    """居中横排一行；spacing 为额外字距。

    alt：非汉字（间隔号、空格、数字）的备用字体——思源宋体 Heavy 这类字重包
    缺标点字形，直接排会出豆腐块，故按字符切换。返回该行像素宽度。
    """
    if not s:
        return 0
    fonts = [f if (alt is None or is_han(ch)) else alt for ch in s]
    widths = [draw.textlength(ch, font=ff) for ch, ff in zip(s, fonts)]
    total = sum(widths) + spacing * (len(s) - 1)
    x = cx - total / 2
    for ch, ff, w in zip(s, fonts, widths):
        draw.text((x + w / 2, cy), ch, font=ff, fill=fill, anchor="mm")
        x += w + spacing
    return total


def col(draw, cx, y0, s, f, fill, gap):
    """竖排一列，y0 为首字中心。返回末字中心 y。"""
    y = y0
    for ch in s:
        draw.text((cx, y), ch, font=f, fill=fill, anchor="mm")
        y += gap
    return y - gap


# ── 底纹 ────────────────────────────────────────────────────────────────────
def rice_paper(w, h, seed=7):
    """宣纸底：暖白基色 + 纤维噪点 + 几处淡茶渍。"""
    rnd = random.Random(seed)
    img = Image.new("RGB", (w, h), PAPER)
    nw, nh = max(1, w // 3), max(1, h // 3)
    noise = Image.new("L", (nw, nh))
    noise.putdata([rnd.randint(118, 138) for _ in range(nw * nh)])
    noise = noise.resize((w, h), Image.BILINEAR).filter(ImageFilter.GaussianBlur(0.6))
    img = Image.blend(img, Image.merge("RGB", (noise, noise, noise)), 0.10)

    stain = Image.new("L", (w, h), 0)
    sd = ImageDraw.Draw(stain)
    for _ in range(16):
        cx, cy = rnd.randint(0, w), rnd.randint(0, h)
        r = rnd.randint(int(w * 0.12), int(w * 0.38))
        sd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=rnd.randint(12, 32))
    stain = stain.filter(ImageFilter.GaussianBlur(w * 0.05))
    tea = Image.new("RGB", (w, h), (214, 196, 166))
    return Image.composite(tea, img, stain.point(lambda v: int(v * 0.7)))


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


@functools.lru_cache(maxsize=8)
def soft_disc(size, power=1.7):
    """径向柔光圆盘（L 通道），用于灯光、晕染、光晕。"""
    c = (size - 1) / 2
    yy, xx = np.mgrid[0:size, 0:size]
    r = np.sqrt(((xx - c) / c) ** 2 + ((yy - c) / c) ** 2)
    a = np.clip(1.0 - r, 0.0, 1.0) ** power
    return Image.fromarray((a * 255).astype(np.uint8), "L")


def glow(img, cx, cy, radius, color, alpha, power=1.7):
    """在 RGBA 图上叠一团柔光。"""
    if alpha <= 1 or radius <= 1:
        return
    d = int(radius * 2)
    m = soft_disc(256, power).resize((d, d), Image.BILINEAR)
    m = m.point(lambda v: int(v * alpha / 255))
    patch = Image.new("RGBA", (d, d), rgba(color, 255))
    patch.putalpha(m)
    img.alpha_composite(patch, (int(cx - radius), int(cy - radius)))


# ── 朱印 ────────────────────────────────────────────────────────────────────
@functools.lru_cache(maxsize=64)
def seal_stamp(size, char, color=RED, font_path=F_LI, seed=3):
    """一枚手钤朱文方印：红底、白文、边缘做旧缺口。返回 RGBA。"""
    ss = 3
    s = size * ss
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=s * 0.07, fill=rgba(color, 255))
    # 内白框
    pad = s * 0.085
    d.rounded_rectangle((pad, pad, s - pad, s - pad), radius=s * 0.04,
                        outline=rgba(PAPER, 235), width=max(2, int(s * 0.016)))
    f = font(font_path, int(s * 0.56))
    d.text((s / 2, s / 2 + s * 0.012), char, font=f, fill=rgba(PAPER, 240), anchor="mm")

    # 做旧：低频噪点让印泥有浓淡，再啃掉几个边角缺口
    rnd = random.Random(seed + len(char))
    nz = Image.new("L", (24, 24))
    nz.putdata([rnd.randint(150, 255) for _ in range(24 * 24)])
    nz = nz.resize((s, s), Image.BICUBIC).filter(ImageFilter.GaussianBlur(s * 0.01))
    a = np.asarray(img.getchannel("A"), dtype=np.float32)
    a *= (0.72 + 0.28 * np.asarray(nz, dtype=np.float32) / 255.0)
    chip = Image.new("L", (s, s), 255)
    cd = ImageDraw.Draw(chip)
    for _ in range(9):
        e = rnd.random()
        if e < 0.25:
            cx, cy = rnd.uniform(0, s), rnd.choice([0, s])
        else:
            cx, cy = rnd.choice([0, s]), rnd.uniform(0, s)
        r = rnd.uniform(s * 0.03, s * 0.08)
        cd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=0)
    a *= np.asarray(chip.filter(ImageFilter.GaussianBlur(s * 0.006)), dtype=np.float32) / 255.0
    img.putalpha(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "L"))
    return img.resize((size, size), Image.LANCZOS)


# ── 形状 ────────────────────────────────────────────────────────────────────
def rot_ellipse(cx, cy, a, b, ang, n=52):
    """旋转椭圆的多边形近似（PIL 不支持旋转椭圆）。"""
    ca, sa = math.cos(ang), math.sin(ang)
    pts = []
    for i in range(n):
        th = 2 * math.pi * i / n
        x, y = a * math.cos(th), b * math.sin(th)
        pts.append((cx + x * ca - y * sa, cy + x * sa + y * ca))
    return pts


def bone(draw, p0, p1, w0, w1, fill):
    """两端不同粗细的骨节（皮影关节肢体）。"""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    ln = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / ln, dx / ln
    draw.polygon([(p0[0] + nx * w0 / 2, p0[1] + ny * w0 / 2),
                  (p1[0] + nx * w1 / 2, p1[1] + ny * w1 / 2),
                  (p1[0] - nx * w1 / 2, p1[1] - ny * w1 / 2),
                  (p0[0] - nx * w0 / 2, p0[1] - ny * w0 / 2)], fill=fill)
    for (px, py), w in ((p0, w0), (p1, w1)):
        draw.ellipse((px - w / 2, py - w / 2, px + w / 2, py + w / 2), fill=fill)


def polar(cx, cy, r, ang):
    return (cx + r * math.cos(ang), cy + r * math.sin(ang))


def bez(p0, p1, p2, n=26):
    """二次贝塞尔采样点。"""
    out = []
    for i in range(n):
        u = i / (n - 1)
        v = 1 - u
        out.append((v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0],
                    v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1]))
    return out


def ribbon(pts, w0, w1, w2):
    """把折线加粗成两端收尖的飘带多边形（脸谱的眉、眼窝、鼻窝都靠它）。"""
    n = len(pts)
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        u = i / (n - 1)
        w = (w0 + (w1 - w0) * (u / 0.5)) if u < 0.5 else (w1 + (w2 - w1) * ((u - 0.5) / 0.5))
        j0, j1 = max(0, i - 1), min(n - 1, i + 1)
        dx, dy = pts[j1][0] - pts[j0][0], pts[j1][1] - pts[j0][1]
        ln = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / ln * w / 2, dx / ln * w / 2
        left.append((x + nx, y + ny))
        right.append((x - nx, y - ny))
    return left + right[::-1]


def subtract(pos, neg):
    return ImageChops.subtract(pos, neg)


def edges(mask, width=3):
    """取遮罩轮廓线（用作"描线稿"）。"""
    e = mask.filter(ImageFilter.FIND_EDGES)
    if width > 1:
        e = e.filter(ImageFilter.MaxFilter(width if width % 2 else width + 1))
    return e


def tint(mask, color, alpha=255):
    """把 L 遮罩染成一张 RGBA 色块。"""
    img = Image.new("RGBA", mask.size, rgba(color, 255))
    if alpha >= 255:
        img.putalpha(mask)
    else:
        img.putalpha(mask.point(lambda v: int(v * alpha / 255)))
    return img
