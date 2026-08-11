# -*- coding: utf-8 -*-
"""提交包自查：逐条检查视频规格、动图系列、附加交付物、二维码可解性、必需文件是否齐全。

用法：
    python scripts/verify_submit.py            # 检查并把报告写入 提交/自查报告.txt
    python scripts/verify_submit.py --no-write # 只打印，不写文件

全部 PASS 时退出码 0，否则为 1（WARN 不影响退出码）。
"""
import json
import os
import subprocess
import sys
import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUBMIT = os.path.join(ROOT, "提交")
URL = "https://wxx827.github.io/liao-juan/"

VIDEO = "辽卷_指尖上的辽宁_短视频_1080x1920_竖屏.mp4"
QR_POSTER = "辽卷_指尖上的辽宁_二维码.png"
QR_PLAIN = "辽卷_指尖上的辽宁_二维码_素码.png"
DOC_SUBMIT = "提交说明.md"
DOC_FORM = "报名表填写速查.md"

EXTRA = "附加交付物"
ANIM_DIR = os.path.join(EXTRA, "动图系列")
POSTER = os.path.join(EXTRA, "辽卷_分享海报_1080x1920.png")
POSTCARD = os.path.join(EXTRA, "终章明信片样张.jpg")
ANIM_MIN = 5          # 比赛要求：动图系列作品不少于 5 张

MB = 1024 * 1024

rows = []          # (状态, 检查项, 实测/说明)
facts = {}         # 供回填文档用的实测值


def add(status, item, detail):
    rows.append((status, item, detail))


def check(ok, item, detail):
    add("PASS" if ok else "FAIL", item, detail)
    return ok


# ---------------------------------------------------------------- 必需文件
def check_files():
    required = [
        (QR_POSTER, "二维码（装帧版，展板/报名表用）"),
        (QR_PLAIN, "二维码（素码版，表格内嵌用）"),
        (DOC_SUBMIT, "提交说明"),
        (DOC_FORM, "报名表填写速查"),
    ]
    for name, desc in required:
        p = os.path.join(SUBMIT, name)
        check(os.path.isfile(p),
              f"必需文件 · {desc}",
              f"{name} — " + (f"{os.path.getsize(p) / 1024:.0f} KB" if os.path.isfile(p) else "缺失"))

    v = os.path.join(SUBMIT, VIDEO)
    if os.path.isfile(v):
        check(True, "必需文件 · 短视频成片", f"{VIDEO} — {os.path.getsize(v) / MB:.2f} MB")
    else:
        add("WARN", "必需文件 · 短视频成片", f"{VIDEO} — 尚未生成（由短视频环节产出）")

    extra = os.path.join(SUBMIT, "附加交付物")
    if os.path.isdir(extra):
        items = sorted(f for f in os.listdir(extra) if not f.startswith("."))
        n_files = sum(len(fs) for _, _, fs in os.walk(extra))
        if items:
            preview = "、".join(items[:6]) + ("…" if len(items) > 6 else "")
            add("PASS", "附加交付物目录", f"附加交付物/ — 共 {n_files} 个文件，含 {preview}")
        else:
            add("WARN", "附加交付物目录", "附加交付物/ — 空（由附加交付物环节产出）")
    else:
        add("WARN", "附加交付物目录", "附加交付物/ — 不存在")

    strays = [f for f in os.listdir(SUBMIT)
              if os.path.isfile(os.path.join(SUBMIT, f)) and (f.startswith("_") or f.startswith("~")
                                                              or os.path.splitext(f)[1].lower()
                                                              in (".tmp", ".bak", ".log", ".part"))]
    check(not strays, "无临时文件 / 中间产物", "目录干净" if not strays else "发现：" + "、".join(strays))


# ---------------------------------------------------------------- 二维码
def decode_all(path):
    """返回 {解码器: 解出的内容或 None}。"""
    out = {}
    try:
        from PIL import Image
        from pyzbar.pyzbar import decode
        got = [d.data.decode() for d in decode(Image.open(path))]
        out["pyzbar"] = got[0] if got else None
    except ImportError:
        out["pyzbar"] = "__missing__"
    try:
        import cv2
        import numpy as np
        # cv2.imread 在 Windows 下读不了含中文的路径，先自己读字节再解码
        buf = np.fromfile(path, dtype=np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        got = cv2.QRCodeDetector().detectAndDecode(img)[0] if img is not None else None
        out["opencv"] = got or None
    except ImportError:
        out["opencv"] = "__missing__"
    return out


def check_qr():
    for name, desc in ((QR_POSTER, "装帧版"), (QR_PLAIN, "素码版")):
        p = os.path.join(SUBMIT, name)
        if not os.path.isfile(p):
            add("FAIL", f"二维码可解 · {desc}", "文件缺失")
            continue
        res = decode_all(p)
        detail = "；".join(
            f"{k}=" + ("解码器未安装" if v == "__missing__" else ("解不出" if v is None else ("命中目标网址" if v == URL else v)))
            for k, v in res.items())
        ok = all(v == URL for v in res.values() if v != "__missing__") and \
             any(v == URL for v in res.values())
        check(ok, f"二维码可解 · {desc}", detail)
        try:
            from PIL import Image
            w, h = Image.open(p).size
            facts.setdefault("qr", {})[desc] = {"size": f"{w}×{h}", "bytes": os.path.getsize(p)}
        except Exception:
            pass
    add("INFO", "二维码指向", URL)


# ---------------------------------------------------------------- 视频
def ffprobe(path):
    cmd = ["ffprobe", "-v", "error", "-print_format", "json",
           "-show_format", "-show_streams", path]
    try:
        raw = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=120)
    except FileNotFoundError:
        return None
    if raw.returncode != 0:
        return None
    return json.loads(raw.stdout)


def rate_of(s):
    """把 ffprobe 的 '30/1' 形式解析为浮点帧率。"""
    try:
        num, den = (int(x) for x in s.split("/"))
        return num / den if den else 0.0
    except Exception:
        return 0.0


def check_video():
    p = os.path.join(SUBMIT, VIDEO)
    if not os.path.isfile(p):
        for item in ("视频 · 容器格式 MP4", "视频 · 视频编码 H.264",
                     "视频 · 分辨率 1080P 及以上", "视频 · 画面比例 9:16 竖屏",
                     "视频 · 时长 ≤ 60 秒", "视频 · 体积 < 100MB"):
            add("WARN", item, "待回填 — 成片尚未产出")
        return

    info = ffprobe(p)
    if not info:
        add("FAIL", "视频 · ffprobe 读取", "ffprobe 不可用或文件损坏")
        return

    fmt = info.get("format", {})
    vs = next((s for s in info["streams"] if s.get("codec_type") == "video"), None)
    as_ = next((s for s in info["streams"] if s.get("codec_type") == "audio"), None)
    if not vs:
        add("FAIL", "视频 · 视频轨", "未找到视频流")
        return

    container = fmt.get("format_name", "")
    vcodec = vs.get("codec_name", "")
    profile = vs.get("profile", "")
    w, h = int(vs.get("width", 0)), int(vs.get("height", 0))
    dur = float(fmt.get("duration") or vs.get("duration") or 0)
    size = int(fmt.get("size") or os.path.getsize(p))
    fps = vs.get("avg_frame_rate", "0/1")
    try:
        num, den = (int(x) for x in fps.split("/"))
        fps_v = num / den if den else 0
    except Exception:
        fps_v = 0
    bitrate = int(fmt.get("bit_rate") or 0)

    pix_fmt = vs.get("pix_fmt", "")

    facts["video"] = {
        "container": container, "vcodec": vcodec, "profile": profile,
        "pix_fmt": pix_fmt,
        "width": w, "height": h, "duration": dur, "size": size,
        "fps": fps_v, "bitrate": bitrate,
        "acodec": (as_ or {}).get("codec_name"),
        "achannels": (as_ or {}).get("channels"),
        "asample": (as_ or {}).get("sample_rate"),
    }

    check("mp4" in container, "视频 · 容器格式 MP4", f"format_name = {container}，扩展名 .mp4")
    check(vcodec == "h264", "视频 · 视频编码 H.264",
          f"codec = {vcodec}" + (f"（profile {profile}）" if profile else ""))
    check(pix_fmt == "yuv420p", "视频 · 像素格式 yuv420p", f"pix_fmt = {pix_fmt}（全平台兼容）")
    check(min(w, h) >= 1080, "视频 · 分辨率 1080P 及以上", f"{w}×{h}（短边 {min(w, h)}）")
    check(w * 16 == h * 9, "视频 · 画面比例 9:16 竖屏",
          f"{w}:{h} = {w / h:.4f}（9:16 = {9 / 16:.4f}）")
    check(0 < dur <= 60, "视频 · 时长 ≤ 60 秒", f"{dur:.2f} 秒")
    check(size < 100 * MB, "视频 · 体积 < 100MB", f"{size / MB:.2f} MB（{size:,} 字节）")

    if as_:
        add("INFO", "视频 · 音轨",
            f"{as_.get('codec_name')} / {as_.get('channels')} 声道 / {as_.get('sample_rate')} Hz")
    else:
        add("WARN", "视频 · 音轨", "无音轨（比赛未强制要求，但建议配乐）")
    add("INFO", "视频 · 帧率与码率", f"{fps_v:.2f} fps / {bitrate / 1000:.0f} kbps")


# ---------------------------------------------------------------- 动图系列
def check_anim():
    """比赛「动图」一档：9:16 竖屏、MP4/H.264、系列不少于 5 张、单个 <100MB。"""
    d = os.path.join(SUBMIT, ANIM_DIR)
    if not os.path.isdir(d):
        add("WARN", "动图系列 · 目录", f"{ANIM_DIR}/ — 不存在（由附加交付物环节产出）")
        return

    clips = sorted(f for f in os.listdir(d) if f.lower().endswith(".mp4"))
    check(len(clips) >= ANIM_MIN, f"动图系列 · 不少于 {ANIM_MIN} 张",
          f"实测 {len(clips)} 段 MP4：" + "、".join(clips))
    if not clips:
        return

    bad_spec, bad_size, with_audio, total = [], [], [], 0
    facts["anim"] = []
    for name in clips:
        p = os.path.join(d, name)
        size = os.path.getsize(p)
        total += size
        info = ffprobe(p)
        if not info:
            bad_spec.append(f"{name}(ffprobe 失败)")
            continue
        vs = next((s for s in info["streams"] if s.get("codec_type") == "video"), None)
        a = next((s for s in info["streams"] if s.get("codec_type") == "audio"), None)
        if not vs:
            bad_spec.append(f"{name}(无视频流)")
            continue
        w, h = int(vs.get("width", 0)), int(vs.get("height", 0))
        codec, pix = vs.get("codec_name", ""), vs.get("pix_fmt", "")
        dur = float(info.get("format", {}).get("duration") or 0)

        facts["anim"].append({
            "name": name, "width": w, "height": h, "vcodec": codec, "pix_fmt": pix,
            "duration": dur, "size": size,
            "fps": round(rate_of(vs.get("avg_frame_rate", "0/1")), 2),
            "bitrate": int(info.get("format", {}).get("bit_rate") or 0),
            "audio": (a or {}).get("codec_name"),
        })

        if not (w == 1080 and h == 1920 and codec == "h264" and pix == "yuv420p"):
            bad_spec.append(f"{name}({w}×{h}/{codec}/{pix})")
        if size >= 100 * MB:
            bad_size.append(f"{name}({size / MB:.1f} MB)")
        if a is not None:
            with_audio.append(name)

    check(not bad_spec, "动图系列 · 规格 1080×1920 / h264 / yuv420p / 9:16",
          f"{len(clips)} 段全部达标" if not bad_spec else "不达标：" + "、".join(bad_spec))
    check(not bad_size, "动图系列 · 单个体积 < 100MB",
          (f"最大 {max(f['size'] for f in facts['anim']) / MB:.2f} MB，"
           f"合计 {total / MB:.2f} MB") if not bad_size else "超限：" + "、".join(bad_size))
    check(not with_audio, "动图系列 · 无音轨（动图形态）",
          f"{len(clips)} 段均为纯画面" if not with_audio else "含音轨：" + "、".join(with_audio))
    add("INFO", "动图系列 · 时长分布",
        "、".join(f"{f['name'].split('_')[0]} {f['duration']:.0f}s" for f in facts["anim"]))


# ---------------------------------------------------------------- 附加交付物
def image_size(path):
    from PIL import Image
    with Image.open(path) as im:
        return im.size


def check_extra_assets():
    for rel, desc, exp in ((POSTER, "分享海报", (1080, 1920)),
                           (POSTCARD, "终章明信片样张", (1080, 1920))):
        p = os.path.join(SUBMIT, rel)
        if not os.path.isfile(p):
            add("FAIL", f"附加交付物 · {desc}", f"{rel} — 缺失")
            continue
        try:
            w, h = image_size(p)
        except Exception as e:
            add("FAIL", f"附加交付物 · {desc}", f"{rel} — 读取失败：{e}")
            continue
        size = os.path.getsize(p)
        facts.setdefault("extra", {})[desc] = {"size": f"{w}×{h}", "bytes": size}
        check((w, h) == exp, f"附加交付物 · {desc}",
              f"{os.path.basename(rel)} — {w}×{h}（期望 {exp[0]}×{exp[1]}）、{size / 1024:.0f} KB")

    # 海报里印着二维码，回读一次确认仍指向线上地址
    p = os.path.join(SUBMIT, POSTER)
    if os.path.isfile(p):
        res = decode_all(p)
        detail = "；".join(
            f"{k}=" + ("解码器未安装" if v == "__missing__" else
                       ("解不出" if v is None else ("命中目标网址" if v == URL else v)))
            for k, v in res.items())
        check(res.get("pyzbar") == URL, "二维码可解 · 分享海报内嵌码", detail)


# ---------------------------------------------------------------- 报告
def render():
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    n_pass = sum(1 for s, _, _ in rows if s == "PASS")
    n_fail = sum(1 for s, _, _ in rows if s == "FAIL")
    n_warn = sum(1 for s, _, _ in rows if s == "WARN")

    w_item = max(len(i) for _, i, _ in rows)
    lines = [
        "《辽·卷 — 指尖上的辽宁》提交包自查报告",
        f"生成时间：{now}",
        f"检查目录：{SUBMIT}",
        "=" * 78,
    ]
    for status, item, detail in rows:
        lines.append(f"[{status:<4}] {item.ljust(w_item)}  {detail}")
    lines += [
        "=" * 78,
        f"结论：PASS {n_pass} 条 / FAIL {n_fail} 条 / WARN {n_warn} 条",
        ("★ 全部硬性检查通过，可以提交。" if n_fail == 0 and n_warn == 0 else
         ("★ 无硬性不达标项；WARN 项为尚未产出或非强制项，补齐后重跑本脚本。" if n_fail == 0 else
          "× 存在不达标项，请修正后重跑本脚本。")),
        "",
        "以下几条机器无法判定，需人工确认：",
        "  1. 提交当天再扫一次二维码，确认 https://wxx827.github.io/liao-juan/ 仍可访问。",
        "  2. 通看一遍成片，确认画面中未意外出现姓名、院校、水印等个人信息。",
        "  3. 与指导教师确认 AI 辅助素材的署名口径，并按报名表要求填写个人信息字段。",
        "  4. 核对报名系统对文件命名、单文件体积与上传格式的具体规定。",
    ]
    return "\n".join(lines), n_fail


if __name__ == "__main__":
    if not os.path.isdir(SUBMIT):
        print("提交/ 目录不存在，请先运行 scripts/prepare_submit.py")
        sys.exit(1)
    check_files()
    check_qr()
    check_video()
    check_anim()
    check_extra_assets()
    report, fails = render()
    print(report)
    if "--no-write" not in sys.argv:
        with open(os.path.join(SUBMIT, "自查报告.txt"), "w", encoding="utf-8") as f:
            f.write(report + "\n")
    if "--facts" in sys.argv:
        print("\n--- FACTS ---")
        print(json.dumps(facts, ensure_ascii=False, indent=2))
    sys.exit(1 if fails else 0)
