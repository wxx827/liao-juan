# -*- coding: utf-8 -*-
"""《辽·卷》附加交付物 · 9:16 竖屏动图系列（6 张 MP4）。

设计约束
--------
* 1080×1920 / H.264 / yuv420p / 30fps / 无音轨 / 单片 3–6 秒 / 10MB 以内
* **必须无缝循环**：所有动效都是关于归一化时间 t∈[0,1) 的周期函数，
  末帧 t=(n-1)/n 与首帧 t=0 天然衔接；不做任何"一次性播放"的时间线。
  两类手法：① 相位环绕（剪纸的刻刀绕圈、脸谱的彩笔扫描、皮影的走步与滚屏）；
  ② 首尾归零（诗签、印墙的内容 alpha 在 t=0 与 t→1 处同为 0）。
* 与作品本体一致的"零图片程序化美术"——全部用 PIL 逐帧矢量自绘，无外部素材。

版式统一：宣纸底 + 双线金框 + 顶部品牌行 + 章节名 + 中央画台 + 一枚朱印 + 底部文化落点。
安全区：上下各留 120px、左右各留 60px，所有文字与框线均在安全区内。

用法
----
    python scripts/make_anim.py                 # 全部 6 张
    python scripts/make_anim.py 01 04           # 只重出指定几张（调参时用）
    python scripts/make_anim.py preview 01      # 抽 4 个相位存 PNG，目视检查
"""
import math
import os
import random
import subprocess
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from guochao_kit import (BLUE, DEEP, F_KAI, F_SONG, F_TITLE, GOLD, INK, PAPER, RED,
                         bez, bone, cloud, edges, font, glow, mix, polar, ramp, rgba,
                         ribbon, rice_paper, rot_ellipse, row, seal_stamp, smoothstep,
                         soft_disc, subtract, tint)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

W, H = 1080, 1920
FPS = 30
SS = 2                      # 画台超采样倍率
STAGE = 900                 # 画台边长（成片像素）
STAGE_X, STAGE_Y = 90, 430  # 画台左上角
N = STAGE * SS              # 画台内部坐标系边长 = 1800

OUT_DIR = os.path.join("提交", "附加交付物", "动图系列")
WORK_DIR = os.path.join("build", "anim")   # 自己的中间产物目录，不碰 build/frames/


# ══════════════════════════════════════════════════════════════════════════
# 一、统一版式底板
# ══════════════════════════════════════════════════════════════════════════
def build_base(ch):
    """一章一张静态底板：宣纸 + 金框 + 标题 + 朱印 + 文化落点。"""
    img = rice_paper(W, H, seed=ch["seed"])
    d = ImageDraw.Draw(img, "RGBA")

    d.rectangle((58, 118, W - 58, H - 118), outline=rgba(GOLD, 235), width=5)
    d.rectangle((76, 136, W - 76, H - 136), outline=rgba(GOLD, 110), width=2)
    for x, flip in ((176, 1), (W - 176, -1)):
        cloud(d, x, 254, 26, rgba(GOLD, 130), 3, flip)

    row(d, W / 2, 176, "辽 · 卷　指尖上的辽宁", font(F_KAI, 27), rgba((150, 132, 100), 255), spacing=3)
    row(d, W / 2, 254, ch["title"], font(F_TITLE, 82), rgba(DEEP, 255),
        spacing=12, alt=font(F_SONG, 78))
    d.line((W / 2 - 96, 318, W / 2 + 96, 318), fill=rgba(RED, 210), width=4)

    for sx, sy in ((0, 0), (1, 0), (0, 1), (1, 1)):          # 画台金角标
        x, y = STAGE_X + sx * STAGE, STAGE_Y + sy * STAGE
        dx, dy = (34 if sx == 0 else -34), (34 if sy == 0 else -34)
        d.line((x, y, x + dx, y), fill=rgba(GOLD, 165), width=3)
        d.line((x, y, x, y + dy), fill=rgba(GOLD, 165), width=3)

    d.line((W / 2 - 150, 1400, W / 2 + 150, 1400), fill=rgba(GOLD, 120), width=2)
    st = seal_stamp(128, ch["seal"])
    img.paste(st, (int(W / 2 - 64), 1444), st)

    row(d, W / 2, 1626, ch["note"], font(F_KAI, 34), rgba((104, 92, 80), 255), spacing=4)
    row(d, W / 2, 1708, "2026 辽宁国潮 · 传承 · 智绘 · 融合", font(F_KAI, 23),
        rgba((158, 142, 118), 255), spacing=2)
    return img.convert("RGB")


def dust(img, t, seed):
    """全幅金粉：沿直线飘移，两端 alpha 归零，故无接缝。"""
    d = ImageDraw.Draw(img, "RGBA")
    rnd = random.Random(seed)
    for _ in range(30):
        x0, y0 = rnd.uniform(120, W - 120), rnd.uniform(200, H - 200)
        dx, dy = rnd.uniform(-40, 40), rnd.uniform(-260, -120)
        ph, r = rnd.random(), rnd.uniform(1.6, 3.4)
        u = (t + ph) % 1.0
        a = math.sin(math.pi * u) * rnd.uniform(60, 120)
        x, y = x0 + dx * u, y0 + dy * u
        d.ellipse((x - r, y - r, x + r, y + r), fill=rgba(GOLD, a))


def circle(d, cx, cy, r, **kw):
    d.ellipse((cx - r, cy - r, cx + r, cy + r), **kw)


# ══════════════════════════════════════════════════════════════════════════
# 二、六个画台场景
# ══════════════════════════════════════════════════════════════════════════
class Jianzhi:
    """壹 · 满族剪纸：刻刀绕团花走一圈。

    刀锋前方是整张未剪的红纸（上有淡淡的粉本线稿），刀锋后方是已镂空的窗花；
    "已剪"区域是一个跟着刀锋旋转的 306° 角窗，转满一圈即回到初态——天然无缝。
    """

    def __init__(self):
        self.cx = self.cy = N / 2
        self.R = R = 0.395 * N
        cx, cy = self.cx, self.cy

        lat = Image.new("RGBA", (N, N), (0, 0, 0, 0))     # 窗棂
        dl = ImageDraw.Draw(lat)
        m = 0.035 * N
        dl.rounded_rectangle((m, m, N - m, N - m), radius=0.02 * N,
                             outline=rgba((140, 108, 74), 105), width=int(0.016 * N))
        for i in (1, 2):
            p = m + (N - 2 * m) * i / 3
            dl.line((p, m, p, N - m), fill=rgba((140, 108, 74), 62), width=int(0.007 * N))
            dl.line((m, p, N - m, p), fill=rgba((140, 108, 74), 62), width=int(0.007 * N))
        self.lattice = lat

        pos = Image.new("L", (N, N), 0)
        neg = Image.new("L", (N, N), 0)
        dp, dn = ImageDraw.Draw(pos), ImageDraw.Draw(neg)

        circle(dp, cx, cy, R * 0.93, outline=255, width=int(R * 0.13))        # 外环
        for k in range(16):                                                    # 环外锯齿
            a = 2 * math.pi * k / 16
            circle(dp, *polar(cx, cy, R * 0.985, a), R * 0.050, fill=255)
        for k in range(8):                                                     # 八枝
            a = 2 * math.pi * k / 8
            dp.polygon(rot_ellipse(*polar(cx, cy, R * 0.54, a), R * 0.36, R * 0.024, a), fill=255)
        for k in range(8):                                                     # 八瓣 + 瓣心孔
            a = 2 * math.pi * k / 8
            dp.polygon(rot_ellipse(*polar(cx, cy, R * 0.52, a), R * 0.29, R * 0.135, a), fill=255)
            dn.polygon(rot_ellipse(*polar(cx, cy, R * 0.55, a), R * 0.155, R * 0.052, a), fill=255)
        for k in range(8):                                                     # 副瓣（错开半格）
            a = 2 * math.pi * k / 8 + math.pi / 8
            dp.polygon(rot_ellipse(*polar(cx, cy, R * 0.34, a), R * 0.15, R * 0.072, a), fill=255)
            circle(dn, *polar(cx, cy, R * 0.34, a), R * 0.028, fill=255)
            circle(dn, *polar(cx, cy, R * 0.93, a), R * 0.036, fill=255)       # 环上钱孔
        circle(dp, cx, cy, R * 0.21, fill=255)                                 # 花心
        circle(dn, cx, cy, R * 0.155, outline=255, width=int(R * 0.045))

        self.mask = subtract(pos, neg)
        red = tint(self.mask, RED, 255)
        rim = subtract(self.mask, self.mask.filter(ImageFilter.MinFilter(9)))
        red.alpha_composite(tint(rim, (124, 32, 26), 140))
        self.red = red

        # 未剪的整张红纸：外轮廓（大圆 + 锯齿）实心
        full = Image.new("L", (N, N), 0)
        fd = ImageDraw.Draw(full)
        circle(fd, cx, cy, R * 0.995, fill=255)
        for k in range(16):
            a = 2 * math.pi * k / 16
            circle(fd, *polar(cx, cy, R * 0.985, a), R * 0.050, fill=255)
        sheet = tint(full, (150, 44, 36), 255)
        sd = ImageDraw.Draw(sheet)
        for k in range(26):                                                    # 纸纹折光
            y = cy - R + 2 * R * k / 26
            sd.line((cx - R, y, cx + R, y), fill=(196, 78, 62, 13), width=6)
        sheet.putalpha(ImageChops.multiply(sheet.getchannel("A"), full))
        self.sheet = sheet
        # 粉本线稿：只画在未剪的红纸上
        self.guide = tint(edges(self.mask, 3).filter(ImageFilter.GaussianBlur(1.6)),
                          (250, 230, 218), 180)

        rnd = random.Random(11)
        self.scraps = [(rnd.uniform(0.30, 0.95), rnd.uniform(0.02, 0.038) * N,
                        rnd.uniform(-0.09, 0.09) * N, rnd.uniform(0, 6.28)) for _ in range(12)]

    def frame(self, t):
        cx, cy, R = self.cx, self.cy, self.R
        img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        img.alpha_composite(self.lattice)

        deg = 360.0 * t - 90.0
        sec = Image.new("L", (N, N), 0)
        ImageDraw.Draw(sec).pieslice((cx - 2 * N, cy - 2 * N, cx + 2 * N, cy + 2 * N),
                                     deg - 306, deg, fill=255)
        sec = sec.filter(ImageFilter.GaussianBlur(9))
        inv = ImageChops.invert(sec)

        uncut = self.sheet.copy()                                    # 刀锋之前：整张红纸
        uncut.putalpha(ImageChops.multiply(uncut.getchannel("A"), inv))
        img.alpha_composite(uncut)
        gd = self.guide.copy()
        gd.putalpha(ImageChops.multiply(gd.getchannel("A"), inv))
        img.alpha_composite(gd)

        cut = self.red.copy()                                        # 刀锋之后：已镂空
        cut.putalpha(ImageChops.multiply(self.red.getchannel("A"), sec))
        img.alpha_composite(cut)

        a = math.radians(deg)
        px, py = polar(cx, cy, R * 0.72, a)
        glow(img, px, py, 0.062 * N, (255, 232, 172), 165)
        glow(img, px, py, 0.020 * N, (255, 253, 242), 245)
        d = ImageDraw.Draw(img)
        for rr in (0.30, 0.95):                                      # 刀口沿半径的一线微光
            gx, gy = polar(cx, cy, R * rr, a)
            circle(d, gx, gy, 0.010 * N, fill=rgba((255, 244, 206), 150))

        for base_u, size, drift, spin in self.scraps:                # 刀口带下的纸屑
            u = (t + base_u) % 1.0
            ea = math.radians(360.0 * (t - u) - 90.0)                # 落下时的刀锋方位
            sx, sy = polar(cx, cy, R * 0.66, ea)
            x, y = sx + drift * u, sy + 0.40 * N * u * u
            al = math.sin(math.pi * u) * 170
            d.polygon(rot_ellipse(x, y, size, size * 0.34, spin + 5 * u, 10), fill=rgba(RED, al))
        return img


class Piying:
    """叁 · 凌源皮影：影人原地走台，山影循环滚屏，灯火摇曳——全部为 t 的周期函数。"""

    SKIN = (206, 126, 68, 214)
    LIMB = (156, 58, 42, 220)
    ROBE = (184, 78, 48, 214)
    DARK = (112, 38, 28, 230)
    HOLE = (244, 230, 200, 215)

    def __init__(self):
        self.h = 0.60 * N
        self.feet = 0.815 * N
        self.cx = 0.45 * N

        cur = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        ImageDraw.Draw(cur).rounded_rectangle((0.02 * N, 0.05 * N, 0.98 * N, 0.92 * N),
                                              radius=0.015 * N, fill=(240, 226, 196, 255))
        self.curtain = cur

        vg = Image.new("L", (N, N), 0)
        ImageDraw.Draw(vg).rounded_rectangle((0.02 * N, 0.05 * N, 0.98 * N, 0.92 * N),
                                             radius=0.015 * N, fill=255)
        inner = soft_disc(256, 1.1).resize((int(N * 1.16), int(N * 1.16)), Image.BILINEAR)
        big = Image.new("L", (N, N), 0)
        big.paste(inner, (int(-N * 0.08), int(-N * 0.08)))
        self.vignette = tint(ImageChops.subtract(vg, big).point(lambda v: int(v * 0.42)),
                             (86, 58, 32), 255)

        bam = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        db = ImageDraw.Draw(bam)
        for y0 in (0.028 * N, 0.905 * N):
            db.rounded_rectangle((0.0, y0, N, y0 + 0.048 * N), radius=0.022 * N,
                                 fill=(104, 72, 42, 255))
            for k in range(9):
                x = 0.06 * N + k * 0.105 * N
                db.line((x, y0 + 0.004 * N, x, y0 + 0.044 * N), fill=(72, 48, 26, 200), width=4)
        self.bamboo = bam

        self.hills = self._hills()
        self.ground = self._ground()

    def _hills(self):
        # 瓦高一直铺到幕布下沿，避免山脚出现一条横向"搁板"硬边
        tile = Image.new("RGBA", (N, int(0.42 * N)), (0, 0, 0, 0))
        d = ImageDraw.Draw(tile)
        hh = tile.height
        for depth, alpha, scale in ((0, 40, 0.40), (1, 66, 0.60)):
            pts = [(0, hh)]
            peaks = 5 + depth
            for k in range(peaks + 1):
                x = N * k / peaks
                y = hh - hh * scale * (0.42 + 0.34 * math.sin(k * 2.1 + depth * 1.7) ** 2)
                pts += [(x - N / peaks * 0.26, hh - hh * 0.10), (x, y)]
            pts += [(N, hh)]
            d.polygon(pts, fill=(96, 62, 38, alpha))
        return tile

    def _ground(self):
        tile = Image.new("RGBA", (N, int(0.07 * N)), (0, 0, 0, 0))
        d = ImageDraw.Draw(tile)
        rnd = random.Random(5)
        for k in range(52):
            x = N * k / 52 + rnd.uniform(-6, 6)
            hgt = rnd.uniform(8, 24)
            d.line((x, 10, x + rnd.uniform(-7, 7), 10 + hgt), fill=(104, 68, 40, 95), width=3)
        d.line((0, 8, N, 8), fill=(104, 68, 40, 90), width=4)
        return tile.filter(ImageFilter.GaussianBlur(1.2))

    def _head(self, d, hx, hy, s, p):
        """侧脸影人头（面朝右）：额、鼻、唇、颔一气呵成，配髯口、幞头与翎子。"""
        d.polygon([(hx + 0.58 * s, hy + 0.58 * s), (hx + 0.96 * s, hy + 0.74 * s),
                   (hx + 0.62 * s, hy + 2.00 * s), (hx + 0.30 * s, hy + 2.10 * s),
                   (hx + 0.06 * s, hy + 1.10 * s)], fill=(138, 48, 34, 205))   # 髯口
        P = [(-0.92, -0.52), (-0.72, -1.00), (-0.08, -1.20), (0.55, -0.98), (0.86, -0.60),
             (0.94, -0.24), (0.76, -0.10), (1.18, 0.20), (0.86, 0.32), (1.00, 0.46),
             (0.74, 0.56), (0.90, 0.76), (0.50, 1.00), (-0.26, 1.06), (-0.88, 0.56)]
        pts = [(hx + x * s, hy + y * s) for x, y in P]
        d.polygon(pts, fill=self.SKIN)
        d.line(pts + [pts[0]], fill=self.DARK, width=max(2, int(0.085 * s)), joint="curve")
        d.polygon(rot_ellipse(hx + 0.38 * s, hy - 0.14 * s, 0.27 * s, 0.13 * s, -0.16),
                  fill=self.HOLE)                                              # 镂空眼
        d.polygon(rot_ellipse(hx + 0.46 * s, hy - 0.14 * s, 0.09 * s, 0.09 * s, 0), fill=self.DARK)
        d.line(bez((hx - 0.02 * s, hy - 0.44 * s), (hx + 0.36 * s, hy - 0.58 * s),
                   (hx + 0.72 * s, hy - 0.36 * s), 14), fill=self.DARK,
               width=max(2, int(0.09 * s)), joint="curve")                     # 眉
        d.line((hx + 0.66 * s, hy + 0.46 * s, hx + 0.90 * s, hy + 0.44 * s),
               fill=self.DARK, width=max(2, int(0.06 * s)))                    # 唇线
        crown = [(-1.00, -0.86), (-0.94, -1.20), (-0.44, -1.42), (0.18, -1.44),
                 (0.66, -1.24), (0.78, -0.90), (0.30, -1.02), (-0.30, -1.02)]
        d.polygon([(hx + x * s, hy + y * s) for x, y in crown], fill=self.DARK)
        circle(d, hx - 0.12 * s, hy - 1.52 * s, 0.16 * s, fill=self.DARK)       # 顶珠
        for k in range(3):
            circle(d, hx + (-0.52 + k * 0.44) * s, hy - 1.14 * s, 0.078 * s, fill=self.HOLE)
        for sgn in (1, -1):                                                    # 翎子
            tip = (hx - (1.65 + 0.28 * sgn) * s,
                   hy - (2.25 + 0.24 * sgn) * s + 0.16 * s * math.sin(p + sgn))
            d.line(bez((hx - 0.30 * s, hy - 1.34 * s), (hx - 1.55 * s, hy - 1.28 * s), tip, 18),
                   fill=(150, 54, 40, 205), width=max(2, int(0.095 * s)), joint="curve")
            circle(d, *tip, 0.095 * s, fill=(150, 54, 40, 205))

    def _puppet(self, layer, t):
        h, cx = self.h, self.cx
        d = ImageDraw.Draw(layer)
        p = 2 * math.pi * (2 * t)                       # 一个循环走两步
        bob = 0.014 * h * (1 - math.cos(2 * p)) / 2
        fy = self.feet - bob
        hip = (cx, fy - 0.47 * h)
        sho = (cx + 0.012 * h * math.sin(p), fy - 0.78 * h)

        def leg(ph, color):
            a1 = math.radians(25) * math.sin(p + ph)
            a2 = a1 - math.radians(18) * (1 + math.sin(p + ph - 1.1)) / 2
            knee = (hip[0] + 0.26 * h * math.sin(a1), hip[1] + 0.26 * h * math.cos(a1))
            foot = (knee[0] + 0.24 * h * math.sin(a2), knee[1] + 0.24 * h * math.cos(a2))
            bone(d, hip, knee, 0.090 * h, 0.072 * h, color)
            bone(d, knee, foot, 0.068 * h, 0.050 * h, color)
            d.polygon([(foot[0] - 0.020 * h, foot[1] - 0.004 * h),
                       (foot[0] + 0.078 * h, foot[1] - 0.016 * h),
                       (foot[0] + 0.074 * h, foot[1] + 0.026 * h),
                       (foot[0] - 0.024 * h, foot[1] + 0.024 * h)], fill=color)

        def arm(ph, color, sleeve=None):
            a1 = -math.radians(24) * math.sin(p + ph)
            a2 = a1 + math.radians(38) * (1 + math.sin(p + ph + 0.5)) / 2
            elb = (sho[0] + 0.20 * h * math.sin(a1), sho[1] + 0.20 * h * math.cos(a1))
            hnd = (elb[0] + 0.19 * h * math.sin(a2), elb[1] + 0.19 * h * math.cos(a2))
            bone(d, sho, elb, 0.098 * h, 0.078 * h, sleeve or color)          # 广袖
            bone(d, elb, hnd, 0.074 * h, 0.042 * h, sleeve or color)
            circle(d, *hnd, 0.026 * h, fill=color)
            return hnd

        leg(math.pi, self.DARK)
        far_hand = arm(math.pi + 0.3, self.DARK)

        hem = fy - 0.19 * h
        sw = 0.030 * h * math.sin(p)
        robe = [(sho[0] - 0.145 * h, sho[1] + 0.015 * h), (sho[0] + 0.145 * h, sho[1] + 0.015 * h),
                (cx + 0.230 * h + sw, hem - 0.012 * h)]
        for k in range(6, -1, -1):
            x = cx - 0.230 * h + (0.46 * h) * k / 6 + sw
            robe.append((x, hem + 0.024 * h * math.sin(k * 1.6 + p)))
        robe.append((cx - 0.230 * h + sw, hem - 0.012 * h))
        d.polygon(robe, fill=self.ROBE)
        d.line(robe + [robe[0]], fill=self.DARK, width=max(2, int(0.010 * h)), joint="curve")
        d.polygon([(sho[0] - 0.10 * h, sho[1] + 0.015 * h), (sho[0] + 0.10 * h, sho[1] + 0.015 * h),
                   (sho[0] + 0.02 * h, sho[1] + 0.14 * h)], fill=self.DARK)     # 交领
        for k in range(3):                                                      # 袍上团花镂空
            fy2 = sho[1] + 0.20 * h + k * 0.135 * h
            for j in range(6):
                a = 2 * math.pi * j / 6
                d.polygon(rot_ellipse(*polar(cx + sw * 0.5, fy2, 0.030 * h, a),
                                      0.024 * h, 0.011 * h, a), fill=self.HOLE)
            circle(d, cx + sw * 0.5, fy2, 0.013 * h, fill=self.HOLE)
        d.line((cx - 0.230 * h + sw, hem, cx + 0.230 * h + sw, hem - 0.004 * h),
               fill=self.DARK, width=max(2, int(0.012 * h)))                    # 袍脚滚边
        d.line((sho[0] - 0.135 * h, sho[1] + 0.30 * h, sho[0] + 0.150 * h, sho[1] + 0.305 * h),
               fill=self.DARK, width=max(2, int(0.030 * h)))                    # 腰带
        circle(d, sho[0] + 0.02 * h, sho[1] + 0.303 * h, 0.024 * h, fill=self.HOLE)

        leg(0, self.LIMB)
        hand = arm(0.3, self.LIMB, sleeve=(202, 96, 60, 228))
        self._head(d, sho[0] + 0.03 * h, fy - 0.90 * h, 0.112 * h, p)

        for hp in (hand, far_hand):                                             # 竹签
            d.line((hp[0], hp[1], hp[0] + 0.50 * h, hp[1] + 0.85 * h),
                   fill=(76, 52, 32, 175), width=max(2, int(0.009 * h)))

    def frame(self, t):
        img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        img.alpha_composite(self.curtain)

        flick = 0.5 + 0.28 * math.sin(2 * math.pi * 3 * t) + 0.22 * math.sin(2 * math.pi * 5 * t + 1.1)
        glow(img, 0.42 * N, 0.34 * N, 0.62 * N, (255, 216, 148), 78 + 44 * flick, power=1.3)

        off = int((t % 1.0) * N)
        for x in (-off, N - off):
            img.alpha_composite(self.hills, (x, int(0.50 * N)))
        off2 = int((t * 2 % 1.0) * N)
        for x in (-off2, N - off2):
            img.alpha_composite(self.ground, (x, int(0.812 * N)))

        pl = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        self._puppet(pl, t)
        sh = tint(pl.getchannel("A").filter(ImageFilter.GaussianBlur(10)), (92, 52, 30), 66)
        img.alpha_composite(sh, (int(12 + 6 * math.sin(2 * math.pi * t)), 14))
        img.alpha_composite(pl)

        img.alpha_composite(self.vignette)
        img.alpha_composite(self.bamboo)
        return img


class Liaoci:
    """伍 · 辽瓷千峰翠色：青花釉色一团团在瓶身晕开（每团 alpha 首尾归零，错相排布）。"""

    def __init__(self):
        self.cx = cx = N / 2
        top, bot = 0.075 * N, 0.925 * N
        ku = [0, .028, .055, .085, .13, .20, .28, .40, .55, .70, .84, .915, .945, .968, 1.0]
        kr = [.056, .052, .042, .045, .072, .168, .224, .218, .188, .152, .124, .116, .134, .142, .142]
        us = np.linspace(0, 1, 460)
        rs = np.interp(us, ku, kr) * N
        rs = np.convolve(np.pad(rs, 5, mode="edge"), np.ones(11) / 11.0, mode="valid")
        ys = top + (bot - top) * us
        self.ys, self.rs = ys, rs

        pts = [(cx - r, y) for r, y in zip(rs, ys)] + [(cx + r, y) for r, y in zip(rs[::-1], ys[::-1])]
        m = Image.new("L", (N, N), 0)
        ImageDraw.Draw(m).polygon(pts, fill=255)
        self.mask = m

        grad = np.zeros((N, N, 3), dtype=np.uint8)
        for y in range(N):
            grad[y, :] = mix((224, 238, 230), (140, 176, 170), smoothstep(y / (N - 1) * 1.1))
        body = Image.fromarray(grad, "RGB").convert("RGBA")
        body.putalpha(m)

        hl = Image.new("RGBA", (N, N), (0, 0, 0, 0))                 # 左侧柔和高光
        hd = ImageDraw.Draw(hl)
        hd.polygon([(cx - r * 0.64, y) for r, y in zip(rs, ys)]
                   + [(cx - r * 0.28, y) for r, y in zip(rs[::-1], ys[::-1])],
                   fill=(255, 255, 255, 80))
        hd.polygon([(cx + r * 0.42, y) for r, y in zip(rs, ys)]
                   + [(cx + r * 0.72, y) for r, y in zip(rs[::-1], ys[::-1])],
                   fill=(70, 108, 108, 46))                          # 右侧暗面
        hl = hl.filter(ImageFilter.GaussianBlur(30))
        hl.putalpha(ImageChops.multiply(hl.getchannel("A"), m))
        body.alpha_composite(hl)

        d = ImageDraw.Draw(body)
        rnd = random.Random(9)
        for _ in range(110):                                          # 开片
            x0 = rnd.uniform(cx - 0.22 * N, cx + 0.22 * N)
            y0 = rnd.uniform(top, bot)
            seg = [(x0, y0)]
            for _ in range(3):
                seg.append((seg[-1][0] + rnd.uniform(-34, 34), seg[-1][1] + rnd.uniform(-34, 34)))
            d.line(seg, fill=(120, 148, 146, 48), width=2)
        body.putalpha(ImageChops.multiply(body.getchannel("A"), m))
        self.body = body

        dec = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        dd = ImageDraw.Draw(dec)
        for y0 in (0.135 * N, 0.885 * N):                             # 回纹带
            i = int(np.argmin(np.abs(ys - y0)))
            r = rs[i]
            dd.rectangle((cx - r, y0, cx + r, y0 + 0.026 * N), fill=rgba(BLUE, 125))
            step = 2 * r / 12
            for k in range(12):
                dd.rectangle((cx - r + k * step + 4, y0 + 5,
                              cx - r + (k + 1) * step - 4, y0 + 0.026 * N - 5), fill=rgba(PAPER, 165))
        for y0 in (0.185 * N, 0.815 * N):                             # 弦纹
            dd.line((0, y0, N, y0), fill=rgba(BLUE, 110), width=5)
            dd.line((0, y0 + 0.016 * N, N, y0 + 0.016 * N), fill=rgba(BLUE, 80), width=3)
        for k in range(3):                                            # 缠枝莲
            y0 = 0.285 * N + k * 0.205 * N
            for sgn in (1, -1):
                stem = bez((cx + sgn * 0.02 * N, y0 - 0.055 * N),
                           (cx + sgn * 0.27 * N, y0 + 0.010 * N),
                           (cx + sgn * 0.06 * N, y0 + 0.135 * N), 26)
                dd.line(stem, fill=rgba(BLUE, 130), width=6, joint="curve")
                for j in (6, 13, 20):
                    ax = math.atan2(stem[j + 1][1] - stem[j - 1][1],
                                    stem[j + 1][0] - stem[j - 1][0]) + sgn * 1.15
                    lx, ly = polar(stem[j][0], stem[j][1], 0.030 * N, ax)
                    dd.polygon(rot_ellipse(lx, ly, 0.030 * N, 0.012 * N, ax), fill=rgba(BLUE, 118))
            for j in range(8):                                        # 莲花八瓣
                a = 2 * math.pi * j / 8
                dd.polygon(rot_ellipse(*polar(cx, y0, 0.042 * N, a), 0.030 * N, 0.014 * N, a),
                           fill=rgba(BLUE, 152))
            circle(dd, cx, y0, 0.021 * N, fill=rgba(BLUE, 195))
            circle(dd, cx, y0, 0.010 * N, fill=rgba(PAPER, 190))
        dec.putalpha(ImageChops.multiply(dec.getchannel("A"), m))
        self.dec = dec
        self.outline = tint(edges(m, 5).filter(ImageFilter.GaussianBlur(1.6)), (44, 74, 88), 155)

        rnd = random.Random(21)
        self.blooms = []
        for i in range(9):
            u = 0.16 + 0.68 * (i / 8) + rnd.uniform(-0.03, 0.03)
            idx = int(u * (len(ys) - 1))
            self.blooms.append((cx + rnd.uniform(-0.55, 0.55) * rs[idx], ys[idx],
                                rnd.uniform(0.14, 0.21) * N, i / 9))
        self.spark = [(rnd.uniform(0.32, 0.68) * N, rnd.random(), rnd.uniform(2, 5)) for _ in range(18)]
        self.disc = soft_disc(256, 1.9)

    def frame(self, t):
        img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        img.alpha_composite(self.body)

        acc = Image.new("L", (N, N), 0)
        for bx, by, br, ph in self.blooms:
            u = (t + ph) % 1.0
            r = br * (0.25 + 0.75 * (1 - (1 - u) ** 2))
            a = math.sin(math.pi * u) ** 0.75
            if a < 0.02:
                continue
            dsz = max(4, int(r * 2))
            patch = self.disc.resize((dsz, dsz), Image.BILINEAR).point(lambda v: int(v * a * 0.60))
            x0, y0 = int(bx - r), int(by - r)
            reg = acc.crop((x0, y0, x0 + dsz, y0 + dsz))
            acc.paste(ImageChops.lighter(reg, patch), (x0, y0))
        img.alpha_composite(tint(ImageChops.multiply(acc, self.mask), BLUE, 235))

        yy = np.arange(N, dtype=np.float32)                          # 自下而上的一道釉光
        yc = N * (1.02 - 1.06 * t)
        wave = np.exp(-((yy - yc) / (0.10 * N)) ** 2) * math.sin(math.pi * t) * 92
        band = Image.fromarray(np.tile(wave.astype(np.uint8)[:, None], (1, N)), "L")
        img.alpha_composite(tint(ImageChops.multiply(band, self.mask), (238, 252, 246), 255))

        img.alpha_composite(self.dec)
        img.alpha_composite(self.outline)

        d = ImageDraw.Draw(img)
        for sx, ph, r in self.spark:
            u = (t + ph) % 1.0
            y = 0.90 * N - 0.72 * N * u
            circle(d, sx, y, r, fill=rgba((255, 246, 214), math.sin(math.pi * u) * 175))
        return img


class Lianpu:
    """拾柒 · 戏曲脸谱：一道彩笔自上而下扫过"开脸"，尾部回墨，扫描位置环绕即无缝。"""

    def __init__(self):
        self.cx = cx = N / 2
        top, bot = 0.10 * N, 0.90 * N
        ku = [0, .07, .18, .34, .52, .70, .84, .93, 1.0]
        kw = [.115, .215, .272, .292, .278, .232, .168, .098, .030]
        us = np.linspace(0, 1, 320)
        ws = np.interp(us, ku, kw) * N
        ys = top + (bot - top) * us
        outline_pts = ([(cx - w, y) for w, y in zip(ws, ys)]
                       + [(cx + w, y) for w, y in zip(ws[::-1], ys[::-1])])
        m = Image.new("L", (N, N), 0)
        ImageDraw.Draw(m).polygon(outline_pts, fill=255)
        self.mask, self.ys, self.ws = m, ys, ws

        self.white = tint(m, (250, 245, 234), 255)

        color = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        c = ImageDraw.Draw(color)
        BLACK = (36, 31, 28, 255)

        red_poly = [(cx - 0.48 * N, -0.06 * N), (cx + 0.48 * N, -0.06 * N)]
        for k in range(26, -1, -1):                                   # 额红（下缘在眉心处下探）
            x = cx + (k / 26 - 0.5) * 0.96 * N
            red_poly.append((x, 0.352 * N + 0.062 * N * math.cos(2 * math.pi * (x - cx) / (0.80 * N))))
        c.polygon(red_poly, fill=rgba((174, 44, 38), 255))

        for i, (dx, hgt, w) in enumerate(((-0.058, 0.105, 0.030), (0.0, 0.150, 0.038),
                                          (0.058, 0.105, 0.030))):    # 额心火焰
            x0 = cx + dx * N
            tipx = x0 + (0.020 if dx >= 0 else -0.020) * N
            path = bez((x0, 0.318 * N), (x0 - 0.028 * N, 0.318 * N - hgt * N * 0.55),
                       (tipx, 0.318 * N - hgt * N), 18)
            c.polygon(ribbon(path, w * N, w * N * 0.72, 0.004 * N), fill=rgba(GOLD, 250))

        jaw = [(cx - 0.48 * N, 1.06 * N), (cx + 0.48 * N, 1.06 * N)]
        for k in range(26, -1, -1):                                   # 青下颌
            x = cx + (k / 26 - 0.5) * 0.96 * N
            jaw.append((x, 0.800 * N + 0.030 * N * math.cos(2 * math.pi * (x - cx) / (0.70 * N))))
        c.polygon(jaw, fill=rgba(DEEP, 255))

        for sgn in (1, -1):
            socket = bez((cx + sgn * 0.030 * N, 0.480 * N), (cx + sgn * 0.170 * N, 0.470 * N),
                         (cx + sgn * 0.340 * N, 0.320 * N), 24)
            c.polygon(ribbon(socket, 0.038 * N, 0.132 * N, 0.046 * N), fill=BLACK)
            brow = bez((cx + sgn * 0.048 * N, 0.322 * N), (cx + sgn * 0.185 * N, 0.248 * N),
                       (cx + sgn * 0.330 * N, 0.286 * N), 22)
            c.polygon(ribbon(brow, 0.020 * N, 0.058 * N, 0.010 * N), fill=BLACK)
            c.polygon(ribbon(bez((cx + sgn * 0.062 * N, 0.318 * N),
                                 (cx + sgn * 0.180 * N, 0.256 * N),
                                 (cx + sgn * 0.300 * N, 0.288 * N), 20),
                             0.008 * N, 0.018 * N, 0.005 * N), fill=rgba(GOLD, 235))
            nose = bez((cx + sgn * 0.034 * N, 0.470 * N), (cx + sgn * 0.082 * N, 0.580 * N),
                       (cx + sgn * 0.046 * N, 0.672 * N), 18)
            c.polygon(ribbon(nose, 0.010 * N, 0.034 * N, 0.008 * N), fill=BLACK)
            c.polygon(rot_ellipse(cx + sgn * 0.205 * N, 0.585 * N, 0.086 * N, 0.048 * N, sgn * 0.42),
                      fill=rgba((176, 48, 40), 235))                  # 颊红
        lip_u = bez((cx - 0.098 * N, 0.718 * N), (cx, 0.678 * N), (cx + 0.098 * N, 0.718 * N), 18)
        lip_d = bez((cx - 0.098 * N, 0.724 * N), (cx, 0.782 * N), (cx + 0.098 * N, 0.724 * N), 18)
        c.polygon(ribbon(lip_u, 0.004 * N, 0.030 * N, 0.004 * N), fill=rgba((158, 34, 30), 255))
        c.polygon(ribbon(lip_d, 0.004 * N, 0.036 * N, 0.004 * N), fill=rgba((158, 34, 30), 255))
        color.putalpha(ImageChops.multiply(color.getchannel("A"), m))
        self.color = color

        lines = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lines)
        ld.line(outline_pts + [outline_pts[0]], fill=rgba((40, 34, 30), 240), width=8, joint="curve")
        for sgn in (1, -1):
            ex = cx + sgn * 0.128 * N
            ld.polygon(rot_ellipse(ex, 0.418 * N, 0.052 * N, 0.028 * N, -sgn * 0.16),
                       fill=(250, 245, 234, 255), outline=(26, 22, 20, 255), width=6)
            circle(ld, ex + sgn * 0.010 * N, 0.418 * N, 0.017 * N, fill=(24, 20, 18, 255))
        ld.line((cx, 0.470 * N, cx, 0.655 * N), fill=rgba((70, 58, 50), 165), width=5)
        ld.line(lip_u, fill=rgba((40, 34, 30), 235), width=6, joint="curve")
        ld.line(lip_d, fill=rgba((40, 34, 30), 235), width=6, joint="curve")
        ld.line((cx - 0.094 * N, 0.721 * N, cx + 0.094 * N, 0.721 * N),
                fill=rgba((250, 245, 234), 215), width=5)
        lines.putalpha(ImageChops.multiply(lines.getchannel("A"), m.filter(ImageFilter.MaxFilter(9))))
        self.lines = lines

    def frame(self, t):
        img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        img.alpha_composite(self.white)

        head = t * N
        yy = np.arange(N, dtype=np.float32)
        dd = (head - yy) % N
        L, e_lead, e_tail = 0.70 * N, 0.035 * N, 0.20 * N
        a = np.clip(dd / e_lead, 0, 1)
        a = np.where(dd > L, np.clip(1 - (dd - L) / e_tail, 0, 1), a)
        band = Image.fromarray(np.tile((a * 255).astype(np.uint8)[:, None], (1, N)), "L")
        painted = self.color.copy()
        painted.putalpha(ImageChops.multiply(painted.getchannel("A"), band))
        img.alpha_composite(painted)

        if self.ys[0] <= head <= self.ys[-1]:
            idx = int((head - self.ys[0]) / (self.ys[-1] - self.ys[0]) * (len(self.ys) - 1))
            hw = self.ws[min(idx, len(self.ws) - 1)]
            d = ImageDraw.Draw(img)
            d.line((self.cx - hw, head, self.cx + hw, head), fill=rgba((255, 236, 176), 185), width=7)
            glow(img, self.cx, head, 0.14 * N, (255, 226, 150), 115)
            rnd = random.Random(int(head) // 40)
            for _ in range(7):
                circle(ImageDraw.Draw(img), self.cx + rnd.uniform(-hw, hw),
                       head + rnd.uniform(-24, 24), rnd.uniform(3, 7),
                       fill=rgba((255, 240, 190), 200))

        img.alpha_composite(self.lines)
        return img


class Shiqian:
    """拾玖 · 智绘诗签：诗联逐字落笔、朱印钤下，随后整体淡出回到空签（首尾皆空）。"""

    UP = "红滩雁字千帆过"
    DOWN = "白塔风铃万象新"
    TOP = "辽海生辉"

    def __init__(self):
        cw, chh = 0.62 * N, 0.90 * N
        self.x0, self.y0, self.cw, self.ch = (N - cw) / 2, (N - chh) / 2, cw, chh
        card = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        d = ImageDraw.Draw(card)
        d.rounded_rectangle((self.x0 + 12, self.y0 + 16, self.x0 + cw + 12, self.y0 + chh + 16),
                            radius=0.02 * N, fill=(120, 100, 78, 70))
        d.rounded_rectangle((self.x0, self.y0, self.x0 + cw, self.y0 + chh),
                            radius=0.02 * N, fill=(251, 247, 237, 255),
                            outline=rgba(RED, 235), width=7)
        d.rounded_rectangle((self.x0 + 22, self.y0 + 22, self.x0 + cw - 22, self.y0 + chh - 22),
                            radius=0.014 * N, outline=rgba(GOLD, 150), width=3)
        d.line((self.x0 + 0.10 * cw, self.y0 + 0.165 * chh,
                self.x0 + 0.90 * cw, self.y0 + 0.165 * chh), fill=rgba(RED, 120), width=3)
        for x, flip in ((self.x0 + 0.15 * cw, 1), (self.x0 + 0.85 * cw, -1)):
            cloud(d, x, self.y0 + 0.078 * chh, 0.016 * N, rgba(GOLD, 125), 3, flip)
        self.card = card

        self.f_big = font(F_KAI, int(0.064 * N))
        self.f_top = font(F_TITLE, int(0.048 * N))
        self.gap = 0.083 * chh
        self.col_y = self.y0 + 0.245 * chh
        self.col_dx = 0.190 * cw
        self.seal = seal_stamp(int(0.090 * N), "智")

    def frame(self, t):
        img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        img.alpha_composite(self.card)
        d = ImageDraw.Draw(img)
        fade = 1.0 - ramp(t, 0.88, 0.97)

        seq = [(self.x0 + self.cw / 2 + (i - 1.5) * 0.058 * N, self.y0 + 0.100 * self.ch,
                ch, self.f_top, DEEP) for i, ch in enumerate(self.TOP)]
        for i, ch in enumerate(self.UP):
            seq.append((self.x0 + self.cw / 2 + self.col_dx, self.col_y + i * self.gap,
                        ch, self.f_big, INK))
        for i, ch in enumerate(self.DOWN):
            seq.append((self.x0 + self.cw / 2 - self.col_dx, self.col_y + i * self.gap,
                        ch, self.f_big, INK))

        for i, (x, y, ch, f, cl) in enumerate(seq):
            a = ramp(t, 0.05 + 0.029 * i, 0.05 + 0.029 * i + 0.055) * fade
            if a <= 0.01:
                continue
            d.text((x, y - (1 - a) * 16), ch, font=f, fill=rgba(cl, 250 * a), anchor="mm")

        t_seal = 0.05 + 0.029 * len(seq) + 0.015
        sp = ramp(t, t_seal, t_seal + 0.075)
        if sp > 0.01:
            sx, sy = self.x0 + self.cw / 2, self.y0 + 0.865 * self.ch
            sz = max(4, int(self.seal.width * (1 + 0.55 * (1 - sp) ** 2)))
            st = self.seal.resize((sz, sz), Image.LANCZOS)
            st.putalpha(st.getchannel("A").point(lambda v: int(v * min(1.0, sp * 1.4) * fade)))
            img.alpha_composite(st, (int(sx - sz / 2), int(sy - sz / 2)))
            rg = ramp(t, t_seal + 0.04, t_seal + 0.20)
            if 0.02 < rg < 0.99:
                rr = self.seal.width * (0.6 + 1.5 * rg)
                d.ellipse((sx - rr, sy - rr, sx + rr, sy + rr),
                          outline=rgba(RED, 150 * (1 - rg) * fade), width=6)
        return img


class Liuyin:
    """终章 · 卷成留印：二十枚游印依次钤落成印墙，金光掠过后淡出（首尾皆空）。"""

    SEALS = "风景韵味瓷冰鼓史英艺宝俗言塔图字脸鲜智星"

    def __init__(self):
        chh = 0.94 * N
        cw = chh * 9 / 16
        self.x0, self.y0, self.cw, self.ch = (N - cw) / 2, (N - chh) / 2, cw, chh

        card = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        d = ImageDraw.Draw(card)
        d.rounded_rectangle((self.x0 + 12, self.y0 + 16, self.x0 + cw + 12, self.y0 + chh + 16),
                            radius=0.018 * N, fill=(120, 100, 78, 70))
        d.rounded_rectangle((self.x0, self.y0, self.x0 + cw, self.y0 + chh),
                            radius=0.018 * N, fill=(250, 245, 234, 255),
                            outline=rgba(DEEP, 220), width=6)
        d.rounded_rectangle((self.x0 + 18, self.y0 + 18, self.x0 + cw - 18, self.y0 + chh - 18),
                            radius=0.012 * N, outline=rgba(GOLD, 140), width=3)
        row(d, self.x0 + cw / 2, self.y0 + 0.068 * chh, "辽 · 卷", font(F_TITLE, int(0.050 * N)),
            rgba(DEEP, 255), spacing=8, alt=font(F_SONG, int(0.046 * N)))
        row(d, self.x0 + cw / 2, self.y0 + 0.120 * chh, "二 十 印 集 齐", font(F_KAI, int(0.025 * N)),
            rgba((132, 118, 100), 255), spacing=2)
        d.line((self.x0 + 0.16 * cw, self.y0 + 0.152 * chh,
                self.x0 + 0.84 * cw, self.y0 + 0.152 * chh), fill=rgba(GOLD, 150), width=2)
        row(d, self.x0 + cw / 2, self.y0 + 0.948 * chh, "指尖上的辽宁 · 专属明信片",
            font(F_KAI, int(0.024 * N)), rgba((140, 126, 108), 255), spacing=2)

        self.sz = int(0.090 * N)
        cols = 4
        gx = (cw - 2 * 0.105 * cw) / (cols - 1)
        gy = 0.132 * chh
        self.slots = []
        for i, chn in enumerate(self.SEALS):
            r, c = divmod(i, cols)
            x = self.x0 + 0.105 * cw + c * gx
            y = self.y0 + 0.245 * chh + r * gy
            self.slots.append((x, y, chn))
            d.rounded_rectangle((x - self.sz * 0.62, y - self.sz * 0.62,
                                 x + self.sz * 0.62, y + self.sz * 0.62),
                                radius=self.sz * 0.10, outline=rgba((198, 184, 160), 205), width=2)
        self.card = card
        self.stamps = [seal_stamp(self.sz, chn, seed=7 + i) for i, (_, _, chn) in enumerate(self.slots)]

        cm = Image.new("L", (N, N), 0)
        ImageDraw.Draw(cm).rounded_rectangle((self.x0, self.y0, self.x0 + cw, self.y0 + chh),
                                             radius=0.018 * N, fill=255)
        self.card_mask = cm

    def frame(self, t):
        img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        img.alpha_composite(self.card)
        d = ImageDraw.Draw(img)
        fade = 1.0 - ramp(t, 0.88, 0.97)
        step = 0.029

        for i, ((x, y, _), st) in enumerate(zip(self.slots, self.stamps)):
            t0 = 0.035 + i * step
            u = ramp(t, t0, t0 + 0.055)
            if u <= 0.01:
                continue
            sz = max(4, int(self.sz * (1 + 0.75 * (1 - u) ** 2)))
            s2 = st.resize((sz, sz), Image.LANCZOS)
            s2.putalpha(s2.getchannel("A").point(lambda v: int(v * min(1.0, u * 1.5) * fade)))
            img.alpha_composite(s2, (int(x - sz / 2), int(y - sz / 2)))
            rg = ramp(t, t0 + 0.02, t0 + 0.13)
            if 0.02 < rg < 0.99:
                rr = self.sz * (0.5 + 0.9 * rg)
                d.ellipse((x - rr, y - rr, x + rr, y + rr),
                          outline=rgba(RED, 130 * (1 - rg) * fade), width=4)

        t_sw = 0.035 + len(self.slots) * step
        sw = ramp(t, t_sw, t_sw + 0.17)
        if 0.01 < sw < 0.99:
            lay = Image.new("RGBA", (N, N), (0, 0, 0, 0))
            cxs = self.x0 - 0.30 * N + sw * (self.cw + 0.60 * N)
            ImageDraw.Draw(lay).polygon(
                [(cxs - 0.10 * N, self.y0 - 0.05 * N), (cxs + 0.10 * N, self.y0 - 0.05 * N),
                 (cxs + 0.24 * N, self.y0 + self.ch + 0.05 * N),
                 (cxs + 0.04 * N, self.y0 + self.ch + 0.05 * N)],
                fill=rgba((255, 238, 186), int(125 * math.sin(math.pi * sw))))
            lay = lay.filter(ImageFilter.GaussianBlur(26))
            lay.putalpha(ImageChops.multiply(lay.getchannel("A"), self.card_mask))
            img.alpha_composite(lay)
        return img


# ══════════════════════════════════════════════════════════════════════════
# 三、章节表
# ══════════════════════════════════════════════════════════════════════════
CHAPTERS = [
    dict(key="01", file="动图01_辽风剪纸.mp4", title="辽风 · 剪纸", seal="风", seconds=5.0, seed=11,
         note="满族剪纸 · 国家级非物质文化遗产", scene=Jianzhi),
    dict(key="02", file="动图02_辽韵皮影.mp4", title="辽韵 · 皮影", seal="韵", seconds=4.0, seed=23,
         note="凌源皮影 · 一盏灯里的关外戏台", scene=Piying),
    dict(key="03", file="动图03_辽瓷千峰翠色.mp4", title="辽瓷 · 千峰翠色", seal="瓷", seconds=5.0,
         seed=37, note="辽瓷青花 · 千峰翠色入釉来", scene=Liaoci),
    dict(key="04", file="动图04_辽韵脸谱.mp4", title="辽韵 · 脸谱", seal="脸", seconds=5.0, seed=41,
         note="戏曲脸谱 · 一笔一笔开出面相", scene=Lianpu),
    dict(key="05", file="动图05_辽智诗签.mp4", title="辽智 · 智绘诗签", seal="智", seconds=6.0, seed=53,
         note="端上智绘 · 算法即兴对出一联", scene=Shiqian),
    dict(key="06", file="动图06_卷成留印.mp4", title="卷成 · 留印", seal="卷", seconds=6.0, seed=67,
         note="二十印集齐 · 生成专属明信片", scene=Liuyin),
]


def encode(ch, out_path):
    n = int(round(FPS * ch["seconds"]))
    base = build_base(ch)
    scene = ch["scene"]()
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "21",
           "-profile:v", "high", "-level", "4.0", "-pix_fmt", "yuv420p",
           "-threads", "2", "-movflags", "+faststart", out_path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n):
        img = base.copy()
        st = scene.frame(i / n).resize((STAGE, STAGE), Image.LANCZOS)
        img.paste(st, (STAGE_X, STAGE_Y), st)
        dust(img, i / n, ch["seed"])
        p.stdin.write(img.convert("RGB").tobytes())
    p.stdin.close()
    if p.wait() != 0:
        raise RuntimeError(f"ffmpeg 失败：{ch['file']}")
    return n


def preview(keys):
    """调参用：每章抽 4 个相位存成 PNG，放进 build/anim/preview/ 目视检查。"""
    out = os.path.join(WORK_DIR, "preview")
    os.makedirs(out, exist_ok=True)
    for ch in CHAPTERS:
        if keys and ch["key"] not in keys:
            continue
        base = build_base(ch)
        scene = ch["scene"]()
        for t in (0.0, 0.25, 0.5, 0.75):
            img = base.copy()
            st = scene.frame(t).resize((STAGE, STAGE), Image.LANCZOS)
            img.paste(st, (STAGE_X, STAGE_Y), st)
            dust(img, t, ch["seed"])
            p = os.path.join(out, f"{ch['key']}_t{int(t * 100):03d}.png")
            img.convert("RGB").save(p)
            print("  ", p, flush=True)


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(WORK_DIR, exist_ok=True)
    if sys.argv[1:2] == ["preview"]:
        preview(set(sys.argv[2:]))
        sys.exit(0)
    want = set(sys.argv[1:])
    for ch in CHAPTERS:
        if want and ch["key"] not in want:
            continue
        out = os.path.join(OUT_DIR, ch["file"])
        print(f"[{ch['key']}] {ch['title']} -> {out}", flush=True)
        n = encode(ch, out)
        print(f"    完成 {n} 帧 / {os.path.getsize(out) / 1048576:.2f} MB", flush=True)
