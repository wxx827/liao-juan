# -*- coding: utf-8 -*-
"""《辽·卷》附加交付物 · 1080×1920 国潮竖版分享海报（朋友圈 / 社群传播用）。

要点：主标题 + 副标题 + 大赛主题 + 一句勾点击的文案 + 四个关键数字 + 大二维码 + 网址。
二维码直接复用 build/qrcode_plain.png（已双解码校验过的素码），
放大后四周留足静区，出图后再用 pyzbar 回读一次，确认没有被版式压坏。
"""
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from guochao_kit import (DEEP, F_KAI, F_SONG, F_TITLE, GOLD, INK, RED, cloud, font,
                         rgba, rice_paper, row, seal_stamp)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

W, H = 1080, 1920
URL = "https://wxx827.github.io/liao-juan/"
QR_SRC = os.path.join("build", "qrcode_plain.png")
OUT = os.path.join("提交", "附加交付物", "辽卷_分享海报_1080x1920.png")

NUMBERS = [("22", "屏 长 卷"), ("20", "枚 游 印"), ("0", "张 图 片"), ("AI", "端 上 智 绘")]


def build():
    img = rice_paper(W, H, seed=91)
    d = ImageDraw.Draw(img, "RGBA")

    d.rectangle((56, 116, W - 56, H - 116), outline=rgba(GOLD, 235), width=5)
    d.rectangle((74, 134, W - 74, H - 134), outline=rgba(GOLD, 110), width=2)
    for x, flip in ((168, 1), (W - 168, -1)):
        cloud(d, x, 300, 34, rgba(GOLD, 135), 4, flip)

    row(d, W / 2, 184, "国 潮 数 字 长 卷 · H5 互 动", font(F_KAI, 26),
        rgba((150, 132, 100), 255), spacing=2)
    row(d, W / 2, 302, "辽 · 卷", font(F_TITLE, 148), rgba(DEEP, 255),
        spacing=6, alt=font(F_SONG, 132))
    row(d, W / 2, 406, "指尖上的辽宁", font(F_KAI, 54), rgba(RED, 255), spacing=18)
    d.line((W / 2 - 130, 452, W / 2 + 130, 452), fill=rgba(RED, 200), width=4)

    d.rounded_rectangle((W / 2 - 232, 486, W / 2 + 232, 548), radius=31,
                        outline=rgba(GOLD, 200), width=3)
    row(d, W / 2, 518, "传 承 · 智 绘 · 融 合", font(F_KAI, 34), rgba(INK, 255), spacing=6)

    row(d, W / 2, 622, "滑开二十二屏关外长卷", font(F_SONG, 46), rgba(DEEP, 255), spacing=6)
    row(d, W / 2, 686, "集齐二十枚游印，带走一张专属明信片", font(F_KAI, 34),
        rgba((104, 92, 80), 255), spacing=2)

    # 四个关键数字
    top, cell = 762, 960 / 4
    for i, (num, label) in enumerate(NUMBERS):
        cx = 60 + cell * (i + 0.5)
        row(d, cx, top + 38, num, font(F_SONG, 62), rgba(GOLD, 255), spacing=2)
        row(d, cx, top + 96, label, font(F_KAI, 24), rgba((116, 104, 92), 255), spacing=1)
        if i:
            d.line((60 + cell * i, top + 14, 60 + cell * i, top + 106), fill=rgba(GOLD, 95), width=2)
    row(d, W / 2, top + 146, "零图片 · 全程 canvas 程序化自绘 · 端上算法即兴成联",
        font(F_KAI, 24), rgba((150, 136, 116), 255), spacing=1)

    # 二维码：卡片 640×640，码本身 560px，四周静区合计约 86px
    card, qr_px = 640, 560
    cx0, cy0 = (W - card) / 2, 962
    d.rounded_rectangle((cx0 + 10, cy0 + 12, cx0 + card + 10, cy0 + card + 12),
                        radius=26, fill=(120, 100, 78, 60))
    d.rounded_rectangle((cx0, cy0, cx0 + card, cy0 + card), radius=24,
                        fill=(255, 255, 255), outline=rgba(RED, 235), width=4)
    d.rounded_rectangle((cx0 + 14, cy0 + 14, cx0 + card - 14, cy0 + card - 14),
                        radius=16, outline=rgba(GOLD, 150), width=2)
    qr = Image.open(QR_SRC).convert("RGB").resize((qr_px, qr_px), Image.LANCZOS)
    img.paste(qr, (int(cx0 + (card - qr_px) / 2), int(cy0 + (card - qr_px) / 2)))

    row(d, W / 2, cy0 + card + 68, "手机扫码 · 展开长卷", font(F_SONG, 46), rgba(DEEP, 255), spacing=8)
    row(d, W / 2, cy0 + card + 130, "建议开启声音，横竖屏均可，中途退出可续玩",
        font(F_KAI, 26), rgba((128, 116, 104), 255), spacing=1)
    row(d, W / 2, cy0 + card + 186, URL, font(F_KAI, 24), rgba((150, 136, 116), 255), spacing=0)

    st = seal_stamp(104, "辽")          # 避开右上角的祥云，落在副标题右侧的空处
    img.paste(st, (858, 352), st)
    return img.convert("RGB")


def verify(path):
    """回读二维码：pyzbar 贴近手机相机的识别行为，opencv 作为第二道保险。"""
    out = []
    try:
        from pyzbar.pyzbar import decode
        got = [x.data.decode() for x in decode(Image.open(path))]
        out.append(("pyzbar", URL in got, got))
    except ImportError:
        out.append(("pyzbar", None, []))
    try:
        import cv2
        import numpy as np
        # cv2.imread 走 ANSI 码页，读不了中文路径，改用 imdecode
        buf = np.fromfile(path, dtype=np.uint8)
        got = cv2.QRCodeDetector().detectAndDecode(cv2.imdecode(buf, cv2.IMREAD_COLOR))[0]
        out.append(("opencv", got == URL, [got]))
    except Exception as exc:
        out.append(("opencv", None, [repr(exc)]))
    return out


if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    poster = build()
    poster.save(OUT)
    print(OUT, poster.size, f"{os.path.getsize(OUT) / 1024:.0f} KB")
    for name, ok, got in verify(OUT):
        print(f"  {name}: {ok}  {got}")
