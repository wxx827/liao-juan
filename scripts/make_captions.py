# -*- coding: utf-8 -*-
"""预渲染短视频的所有叠加层：片头标题条幅、各章字幕条、片尾二维码板。

全部输出 1080×1920 PNG（字幕层带 alpha），交给 ffmpeg overlay 叠加，
这样中文不用经过命令行，省掉 drawtext 的编码坑。

思源宋体 Heavy 缺「·」「空格」这类符号，直接画会出豆腐块，
所以统一走 rich() 逐字回退到备用字体。
"""
import os
from functools import lru_cache

from fontTools.ttLib import TTCollection, TTFont
from PIL import Image, ImageDraw, ImageFilter

import make_qr as Q

W, H = 1080, 1920
OUT_DIR = os.environ.get("CAP_OUT", "build/overlay")
URL = "https://wxx827.github.io/liao-juan/"

PAPER = Q.PAPER
RED = Q.RED
DEEP = Q.DEEP
GOLD = Q.GOLD
INK = Q.INK

F_TITLE = Q.F_TITLE
F_KAI = Q.F_KAI
F_SONG = Q.F_SONG
F_HEI = Q.F_HEI
FALLBACK = [F_SONG, F_KAI, F_HEI]

# 章节字幕文案：id -> (标题, 印字, 文化落点)
CHAPTERS = {
    "feng": ("辽风 · 剪纸", "风", "满族剪纸 · 国家级非遗"),
    "jing": ("辽景 · 山河", "景", "红海滩 · 本溪水洞 · 鸭绿江断桥 · 大连滨海"),
    "yun": ("辽韵 · 皮影", "韵", "凌源皮影"),
    "wei": ("辽味 · 四宝", "味", "老边饺子 · 沟帮子熏鸡 · 锅包肉 · 渤海飞蟹"),
    "ci": ("辽瓷 · 千峰翠色", "瓷", "辽瓷青花"),
    "bing": ("辽冰 · 踏雪寻梅", "冰", "冰嬉 · 冰雪辽宁"),
    "gu": ("辽戏 · 鼓韵", "鼓", "东北大鼓"),
    "shi": ("辽史 · 长河", "史", "红山文化 · 契丹立辽 · 盛京 · 工业辽宁"),
    "ren": ("辽脉 · 群英", "英", "萧太后 · 张学良 · 雷锋 · 郭明义"),
    "yi": ("辽艺 · 百工", "艺", "岫岩玉雕 · 阜新玛瑙 · 满族刺绣 · 大连贝雕"),
    "bao": ("辽宝 · 矿珍", "宝", "菱镁矿 · 铁 · 煤 · 岫玉"),
    "su": ("辽俗 · 社火", "俗", "东北大秧歌"),
    "yan": ("辽言 · 唠嗑", "言", "东北方言"),
    "ta": ("辽塔 · 古建", "塔", "辽阳白塔 · 朝阳北塔"),
    "tu": ("辽图 · 十四市", "图", "辽宁十四市风物"),
    "zi": ("辽字 · 墨宝", "字", "蘸墨描红一个「辽」"),
    "lian": ("辽韵 · 脸谱", "脸", "戏曲脸谱 · 分区开脸"),
    "xian": ("辽鲜 · 山珍", "鲜", "南果梨 · 丹东草莓 · 大连海参 · 盘锦河蟹"),
    "zhi": ("辽智 · 智绘诗签", "智", "端上算法即兴成联，非云端大模型"),
    "juanling": ("卷灵 · 智游助手", "", "离线规则引擎，随行答疑"),
    "xing": ("辽星 · 尾声", "星", "点亮星河，收束长卷"),
    "final": ("卷成 · 留印", "", "二十印集齐，生成专属明信片"),
}

# 个别章节 App 自己在底部有浮层，字幕块得让开
# （辽星那屏的「已点 N 颗星」进度胶囊正好压在标题行上）
CAP_DY = {"xing": -122}


@lru_cache(maxsize=None)
def cmap_of(path):
    """字体覆盖的码点集合，用来判断会不会画成豆腐块。"""
    f = TTCollection(path).fonts[0] if path.lower().endswith(".ttc") else TTFont(path, lazy=True)
    pts = set()
    for t in f["cmap"].tables:
        pts |= set(t.cmap.keys())
    f.close()
    return pts


@lru_cache(maxsize=None)
def font(path, size):
    return Q.font(path, size)


def pick(ch, path):
    """给单个字选一个真有这个字形的字体。"""
    if ord(ch) in cmap_of(path):
        return path
    for fb in FALLBACK:
        if fb != path and ord(ch) in cmap_of(fb):
            return fb
    return F_HEI


def measure(d, s, path, size, spacing=0):
    total = 0
    for ch in s:
        f = font(pick(ch, path), size)
        box = d.textbbox((0, 0), ch, font=f)
        total += box[2] - box[0] if ch.strip() else size * 0.32
    return total + spacing * max(0, len(s) - 1)


def rich(d, x, y, s, path, size, fill, spacing=0, shadow=None, center=None):
    """逐字选字体绘制一行；center 给定则以该 x 居中。shadow=(dx,dy,rgba)。"""
    if center is not None:
        x = center - measure(d, s, path, size, spacing) / 2
    for ch in s:
        f = font(pick(ch, path), size)
        box = d.textbbox((0, 0), ch, font=f)
        w = box[2] - box[0] if ch.strip() else size * 0.32
        if ch.strip():
            if shadow:
                d.text((x - box[0] + shadow[0], y + shadow[1]), ch, font=f, fill=shadow[2])
            d.text((x - box[0], y), ch, font=f, fill=fill)
        x += w + spacing
    return x


def vgrad(top, bottom, c_top, c_bottom, a_top, a_bottom, gamma=1.0):
    """竖向渐变遮罩层（整幅 1080×1920，区间外全透明）。"""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    n = bottom - top
    strip = Image.new("RGBA", (1, n))
    px = strip.load()
    span = max(1, n - 1)
    for i in range(n):
        k = (i / span) ** gamma
        px[0, i] = (int(c_top[0] + (c_bottom[0] - c_top[0]) * k),
                    int(c_top[1] + (c_bottom[1] - c_top[1]) * k),
                    int(c_top[2] + (c_bottom[2] - c_top[2]) * k),
                    int(a_top + (a_bottom - a_top) * k))
    layer.paste(strip.resize((W, n), Image.BILINEAR), (0, top))
    return layer


def seal(size, ch, fill=RED, fg=PAPER):
    """朱红方印：外框 + 内缩细边 + 印字，再做一点做旧斑驳。"""
    import random
    ss = 4
    s = size * ss
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=s * 0.08, fill=fill)
    d.rounded_rectangle((s * 0.075, s * 0.075, s * 0.925, s * 0.925),
                        radius=s * 0.05, outline=(fg[0], fg[1], fg[2], 170), width=int(s * 0.022))
    f = font(pick(ch, F_TITLE), int(s * 0.56))
    box = d.textbbox((0, 0), ch, font=f)
    d.text((s / 2 - (box[2] + box[0]) / 2, s / 2 - (box[3] + box[1]) / 2), ch, font=f, fill=fg)
    img = img.resize((size, size), Image.LANCZOS)

    rnd = random.Random(ord(ch))
    a = img.split()[3]
    ad = ImageDraw.Draw(a)
    for _ in range(size // 3):
        x, y = rnd.randint(0, size), rnd.randint(0, size)
        r = rnd.randint(1, max(2, size // 26))
        ad.ellipse((x - r, y - r, x + r, y + r), fill=rnd.randint(120, 205))
    img.putalpha(a.filter(ImageFilter.GaussianBlur(0.4)))
    return img


def caption(cid, path):
    """一条国潮字幕条：底部渐变压暗 + 朱印 + 章节名 + 文化落点小字。"""
    title, mark, note = CHAPTERS[cid]
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # 两段渐变在 y=1620 处 alpha 相接，避免横向硬边。
    # 起点压到 1360 是为了别把 App 自己的落款印章（y≈1470-1630）糊死。
    img.alpha_composite(vgrad(1360, 1620, DEEP, DEEP, 0, 168, gamma=1.7))
    img.alpha_composite(vgrad(1620, H, DEEP, (10, 16, 26), 168, 248, gamma=0.9))

    d = ImageDraw.Draw(img)
    base_y = 1622 + CAP_DY.get(cid, 0)
    x = 88

    d.line((x, base_y - 26, W - x, base_y - 26), fill=(*GOLD, 110), width=2)
    d.line((x, base_y - 26, x + 150, base_y - 26), fill=(*GOLD, 240), width=4)

    tx = x
    if mark:
        sz = 118
        img.alpha_composite(seal(sz, mark), (x, base_y + 6))
        tx = x + sz + 32

    def fit(s, path_, size, spacing):
        """右侧留够 110px 安全边距，撑不下就把字号收一点。"""
        while size > 18 and measure(d, s, path_, size, spacing) > W - tx - 110:
            size -= 2
        return size

    ts = fit(title, F_TITLE, 64, 0)
    rich(d, tx, base_y, title, F_TITLE, ts, (248, 243, 233, 255), shadow=(2, 3, (0, 0, 0, 160)))
    ns = fit(note, F_KAI, 34, 1)
    rich(d, tx + 3, base_y + 88, note, F_KAI, ns, (233, 206, 148, 246),
         spacing=1, shadow=(1, 2, (0, 0, 0, 150)))

    img.save(path)
    return path


def title_card(path):
    """片头标题层：宣纸条幅上竖排「辽·卷」，下接副标题与主题词。"""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    img.alpha_composite(vgrad(0, H, (12, 20, 32), (12, 20, 32), 68, 104))

    bw, bh = 560, 1010
    bx, by = (W - bw) // 2, 428
    panel = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    pd = ImageDraw.Draw(panel)
    # 条幅必须完全不透明：留一点透明度，App 自己那行白色大字「辽·卷」会从纸背透出来，像印歪了
    pd.rounded_rectangle((0, 0, bw - 1, bh - 1), radius=16, fill=(*PAPER, 255))
    pd.rounded_rectangle((0, 0, bw - 1, bh - 1), radius=16, outline=(*RED, 225), width=5)
    pd.rounded_rectangle((16, 16, bw - 17, bh - 17), radius=10, outline=(*GOLD, 175), width=2)
    Q.cloud(pd, bw / 2, 78, 30, (*GOLD, 135), 3, 1)
    Q.cloud(pd, bw / 2, bh - 172, 26, (*GOLD, 110), 3, -1)
    img.alpha_composite(panel, (bx, by))

    d = ImageDraw.Draw(img)
    cx = W / 2
    size = 172
    ft = font(F_TITLE, size)
    y0 = by + 118
    step = 232
    for i, ch in enumerate("辽卷"):
        box = d.textbbox((0, 0), ch, font=ft)
        d.text((cx - (box[2] + box[0]) / 2, y0 + i * step), ch, font=ft, fill=DEEP)
    # 红点落在两字之间的空档正中
    gap_top = y0 + d.textbbox((0, 0), "辽", font=ft)[3]
    gap_bot = y0 + step + d.textbbox((0, 0), "卷", font=ft)[1]
    dot_y = (gap_top + gap_bot) / 2
    d.ellipse((cx - 11, dot_y - 11, cx + 11, dot_y + 11), fill=RED)

    y = y0 + step + size + 34
    rich(d, 0, y, "指尖上的辽宁", F_KAI, 56, RED, spacing=16, center=cx)
    d.line((cx - 152, y + 108, cx + 152, y + 108), fill=(*GOLD, 190), width=2)
    rich(d, 0, y + 132, "传承 · 智绘 · 融合", F_SONG, 38, INK, spacing=12, center=cx)

    img.alpha_composite(seal(96, "辽"), (int(cx - 48), by + bh - 142))
    img.save(path)
    return path


def end_card(path):
    """片尾二维码板：宣纸底 + 金框 + 大二维码，扫码就能开卷。"""
    img = Q.rice_paper(W, H, seed=11).convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")

    d.rectangle((44, 44, W - 44, H - 44), outline=GOLD, width=5)
    d.rectangle((62, 62, W - 62, H - 62), outline=(*GOLD, 120), width=2)
    for cx0, flip in ((168, 1), (W - 168, -1)):
        Q.cloud(d, cx0, 168, 34, (*GOLD, 150), 4, flip)

    rich(d, 0, 256, "辽 · 卷", F_TITLE, 116, DEEP, spacing=8, center=W / 2)
    rich(d, 0, 418, "指尖上的辽宁", F_KAI, 52, RED, spacing=16, center=W / 2)

    # 二维码卡片：码面 660px ≈ 画面宽度 61%，四周留白充足
    card, cy0 = 800, 540
    cx0 = (W - card) // 2
    d.rounded_rectangle((cx0 + 9, cy0 + 11, cx0 + card + 9, cy0 + card + 11), radius=28, fill=(120, 100, 78, 60))
    d.rounded_rectangle((cx0, cy0, cx0 + card, cy0 + card), radius=26, fill=(252, 249, 242, 255), outline=RED, width=4)
    d.rounded_rectangle((cx0 + 16, cy0 + 16, cx0 + card - 16, cy0 + card - 16), radius=18, outline=(*GOLD, 160), width=2)
    qr = Q.draw_qr(Q.qr_matrix(URL), 660, fg=RED, seal_text="辽")
    img.paste(qr, (cx0 + (card - qr.width) // 2, cy0 + (card - qr.height) // 2), qr)

    by = cy0 + card + 62
    rich(d, 0, by, "手机扫码 · 展开长卷", F_SONG, 54, DEEP, spacing=10, center=W / 2)
    rich(d, 0, by + 88, URL, F_HEI, 30, (122, 110, 98), center=W / 2)
    rich(d, 0, by + 150, "传承 · 智绘 · 融合", F_KAI, 36, RED, spacing=12, center=W / 2)
    rich(d, 0, by + 214, "22 屏 · 20 印 · 一卷读懂辽宁", F_KAI, 28, (128, 116, 104), spacing=4, center=W / 2)

    img.convert("RGB").save(path, quality=96)
    return path


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    made = [title_card(os.path.join(OUT_DIR, "title.png")),
            end_card(os.path.join(OUT_DIR, "endcard.png"))]
    for cid in CHAPTERS:
        made.append(caption(cid, os.path.join(OUT_DIR, "cap_%s.png" % cid)))
    print("overlays:", len(made))
    print("endcard qr:", Q.verify(os.path.join(OUT_DIR, "endcard.png"), URL))
