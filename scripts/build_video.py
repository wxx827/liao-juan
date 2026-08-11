# -*- coding: utf-8 -*-
"""把录制的逐帧素材剪成参赛短视频（1080×1920 / H.264 / ≤60s）。

分阶段执行，便于单独重跑：
    python scripts/build_video.py raw      逐帧 -> CFR 30fps 中间片 build/raw.mp4
    python scripts/build_video.py segs     按分镜切片并叠字幕层
    python scripts/build_video.py master   xfade 串接 -> build/master_silent.mp4
    python scripts/build_video.py mux      混入 build/bgm.wav -> 成片
    python scripts/build_video.py qa       抽帧 + ffprobe + 二维码回读
    python scripts/build_video.py all      raw + segs + master
"""
import json
import os
import shutil
import subprocess
import sys

FFMPEG = "ffmpeg"
FFPROBE = "ffprobe"

BUILD = "build"
FRAMES_JSON = BUILD + "/frames.json"
MARKS_JSON = BUILD + "/marks.json"
CONCAT_TXT = BUILD + "/frames_concat.txt"
RAW = BUILD + "/raw.mp4"
SEG_DIR = BUILD + "/seg"
OVL = BUILD + "/overlay"
MASTER = BUILD + "/master_silent.mp4"
BGM = BUILD + "/bgm.wav"
FINAL = BUILD + "/辽卷_短视频_9x16.mp4"
SUBMIT = "提交/辽卷_指尖上的辽宁_短视频_1080x1920_竖屏.mp4"
QA_DIR = BUILD + "/qa"
URL = "https://wxx827.github.io/liao-juan/"

FPS = 30
XFADE = 0.28          # 相邻镜头交叉溶解时长
D_INTRO = 4.75        # 片头
D_CHAP = 2.48         # 每个章节镜头
D_FINAL = 4.40        # 终章明信片
D_END = 7.40          # 二维码尾板

# 章节镜头顺序；tail = 从该分镜结束往前留多少秒作为取样终点
# （高光都在每章末尾：显形 / 点亮 / 盖印，所以统统贴着区间尾部取）
SHOTS = [
    ("feng", 0.35), ("jing", 0.30), ("yun", 0.30), ("wei", 0.25), ("ci", 0.35),
    ("bing", 0.30), ("gu", 0.35), ("shi", 0.30), ("ren", 0.25), ("yi", 0.30),
    ("bao", 0.30), ("su", 0.30), ("ta", 0.30), ("tu", 0.30), ("zi", 0.35),
    # lian 收到 0.15：眼窝要排在鼻梁/脸颊之后才显色（App 已修），这一镜要吃到
    # 两片白眼窝显现 + 落「开脸成谱」印的整段；zhi 贴到最后，取早了会停在“智绘生成中…”的空屏上
    ("lian", 0.15), ("xian", 0.15), ("zhi", 0.05), ("xing", 0.35),
]


def run(args, quiet=True):
    p = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    out = p.stdout.decode("utf-8", "ignore")
    if p.returncode != 0:
        print(out[-4000:])
        raise SystemExit("命令失败: " + " ".join(args[:6]) + " ...")
    if not quiet:
        print(out[-1500:])
    return out


def load_marks():
    """分镜表 -> {label: (t0, t1)}，单位秒，且已换算到 raw.mp4 的时间轴。"""
    fr = json.load(open(FRAMES_JSON))
    off = (fr["frames"][0]["t"] - fr["start"]) / 1000.0   # 首帧比录制起点晚一点
    marks = {}
    for m in json.load(open(MARKS_JSON)):
        marks[m["label"]] = (m["t0"] / 1000.0 - off, m["t1"] / 1000.0 - off)
    return marks


def stage_raw():
    """逐帧 + 真实时间戳 -> concat demuxer -> CFR 30fps，时间轴与 marks.json 对齐。"""
    fr = json.load(open(FRAMES_JSON))
    fs = fr["frames"]
    lines = ["ffconcat version 1.0"]
    for i, f in enumerate(fs):
        dur = (fs[i + 1]["t"] - f["t"]) / 1000.0 if i + 1 < len(fs) else 1.0 / FPS
        lines.append("file 'frames/%s'" % f["f"])
        lines.append("duration %.4f" % max(dur, 1.0 / 240))
    lines.append("file 'frames/%s'" % fs[-1]["f"])   # 最后一帧再列一次，防被截断
    open(CONCAT_TXT, "w", encoding="utf-8").write("\n".join(lines) + "\n")

    run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", CONCAT_TXT,
         "-fps_mode", "cfr", "-r", str(FPS), "-g", "30",
         "-c:v", "libx264", "-crf", "16", "-preset", "veryfast",
         "-pix_fmt", "yuv420p", RAW])
    print("raw.mp4:", probe_dur(RAW), "s")


def probe_dur(path):
    out = run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
               "-of", "default=nw=1:nk=1", path])
    return round(float(out.strip().splitlines()[-1]), 3)


def overlay_seg(src_args, dur, png, out, fin=(0.10, 0.30), fout=0.30):
    """把一张 1080×1920 透明 PNG 淡入淡出地叠在片段上。"""
    vf = ("[1:v]format=rgba,fade=t=in:st=%.2f:d=%.2f:alpha=1,"
          "fade=t=out:st=%.2f:d=%.2f:alpha=1[ov];"
          "[0:v][ov]overlay=0:0:format=auto,format=yuv420p[v]"
          % (fin[0], fin[1], dur - fout - 0.05, fout))
    run([FFMPEG, "-y"] + src_args +
        ["-loop", "1", "-framerate", str(FPS), "-t", "%.3f" % dur, "-i", png,
         "-filter_complex", vf, "-map", "[v]", "-t", "%.3f" % dur,
         "-r", str(FPS), "-c:v", "libx264", "-crf", "14", "-preset", "veryfast",
         "-pix_fmt", "yuv420p", out])


def stage_segs():
    """按分镜切出各镜头并叠好字幕/标题层。"""
    shutil.rmtree(SEG_DIR, ignore_errors=True)
    os.makedirs(SEG_DIR, exist_ok=True)
    marks = load_marks()
    plan = []

    # 片头
    t0 = max(0.10, marks["intro"][0])
    out = "%s/00_intro.mp4" % SEG_DIR
    overlay_seg(["-ss", "%.3f" % t0, "-i", RAW], D_INTRO, OVL + "/title.png", out,
                fin=(0.35, 0.75), fout=0.75)
    plan.append(("intro", out, D_INTRO, t0))

    # 章节蒙太奇：每章都贴着区间尾部取，拿到的是“出效果”的那一瞬
    for i, (cid, tail) in enumerate(SHOTS):
        a, b = marks[cid]
        start = max(a, b - tail - D_CHAP)
        out = "%s/%02d_%s.mp4" % (SEG_DIR, i + 1, cid)
        overlay_seg(["-ss", "%.3f" % start, "-i", RAW], D_CHAP,
                    "%s/cap_%s.png" % (OVL, cid), out)
        plan.append((cid, out, D_CHAP, start))
        print("  %-6s %6.2f -> %6.2f" % (cid, start, start + D_CHAP))

    # 终章
    a, b = marks["final"]
    start = max(a, b - 0.20 - D_FINAL)
    out = "%s/90_final.mp4" % SEG_DIR
    overlay_seg(["-ss", "%.3f" % start, "-i", RAW], D_FINAL,
                OVL + "/cap_final.png", out)
    plan.append(("final", out, D_FINAL, start))

    # 二维码尾板（静帧）
    out = "%s/99_end.mp4" % SEG_DIR
    run([FFMPEG, "-y", "-loop", "1", "-framerate", str(FPS), "-t", "%.3f" % D_END,
         "-i", OVL + "/endcard.png", "-r", str(FPS), "-c:v", "libx264",
         "-crf", "14", "-preset", "veryfast", "-pix_fmt", "yuv420p", out])
    plan.append(("endcard", out, D_END, 0.0))

    # 用 ffprobe 回读每段真实时长：切片可能比请求的短一点（素材尾部不够），
    # 直接拿名义时长去算 xfade 偏移会一路漂。
    rows = [{"id": a, "file": b, "dur": probe_dur(b), "src": d} for a, b, c, d in plan]
    json.dump(rows, open(BUILD + "/plan.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    total = sum(r["dur"] for r in rows) - XFADE * (len(rows) - 1)
    print("segments: %d  预计成片 %.2f s" % (len(rows), total))


def stage_master():
    """xfade 串接所有镜头，一次编码到最终视频参数（音轨后面直接 copy 进来）。"""
    plan = json.load(open(BUILD + "/plan.json", encoding="utf-8"))
    args = [FFMPEG, "-y"]
    for p in plan:
        args += ["-i", p["file"]]

    parts, acc, last = [], plan[0]["dur"], "[0:v]"
    for i in range(1, len(plan)):
        # 全程用溶解，不用 fadeblack：明信片和宣纸尾板都是暖米色，溶接更顺，
        # 也避免中间闪一下纯黑。最后一跳放慢一点，收得从容些。
        d = 0.45 if i == len(plan) - 1 else XFADE
        tag = "[v%d]" % i
        parts.append("%s[%d:v]xfade=transition=fade:duration=%.3f:offset=%.3f%s"
                     % (last, i, d, acc - d, tag))
        acc = acc + plan[i]["dur"] - d
        last = tag
    parts.append("%sformat=yuv420p,fps=%d[vout]" % (last, FPS))

    args += ["-filter_complex", ";".join(parts), "-map", "[vout]",
             "-c:v", "libx264", "-profile:v", "high", "-level", "4.0",
             "-pix_fmt", "yuv420p", "-crf", "21", "-preset", "slow",
             "-r", str(FPS), "-movflags", "+faststart", "-an", MASTER]
    run(args)
    print("master_silent.mp4: %.3f s（预估 %.3f）" % (probe_dur(MASTER), acc))


def stage_mux():
    """混入 BGM：补长/裁切到成片时长，首尾淡入淡出，响度归一并限峰 -1dBFS。"""
    dur = probe_dur(MASTER)
    af = ("[1:a]apad,atrim=0:%.3f,asetpts=N/SR/TB,"
          "afade=t=in:st=0:d=0.9,afade=t=out:st=%.3f:d=1.5,"
          "loudnorm=I=-16:TP=-1.5:LRA=11,"
          # loudnorm 出来的采样率/声道布局不定，先 aformat 钉死再进限幅器，
          # 否则 alimiter 会因为拿不到 channel layout 直接报错
          "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
          "alimiter=limit=0.891[a]"
          % (dur, dur - 1.5))
    run([FFMPEG, "-y", "-i", MASTER, "-i", BGM, "-filter_complex", af,
         "-map", "0:v", "-map", "[a]", "-c:v", "copy",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
         "-shortest", "-movflags", "+faststart", FINAL])
    os.makedirs("提交", exist_ok=True)
    shutil.copyfile(FINAL, SUBMIT)
    print("成片:", FINAL, "->", SUBMIT)


def stage_qa(path=None, n=18):
    """抽帧 + 规格核对 + 尾板二维码回读。"""
    path = path or FINAL
    shutil.rmtree(QA_DIR, ignore_errors=True)
    os.makedirs(QA_DIR, exist_ok=True)
    dur = probe_dur(path)

    info = run([FFPROBE, "-v", "error", "-show_entries",
                "stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate,"
                "profile,level,sample_rate,channels,bit_rate:format=format_name,duration,size,bit_rate",
                "-of", "json", path])
    print(info)

    for i in range(n):
        t = dur * (i + 0.5) / n
        run([FFMPEG, "-y", "-ss", "%.3f" % t, "-i", path, "-frames:v", "1",
             "%s/t%02d_%05.2fs.png" % (QA_DIR, i, t)])

    # 尾板二维码：从成片里截帧回读
    ok = []
    for t in (dur - 4.5, dur - 2.5, dur - 0.8):
        f = "%s/qr_%05.2f.png" % (QA_DIR, t)
        run([FFMPEG, "-y", "-ss", "%.3f" % t, "-i", path, "-frames:v", "1", f])
        try:
            from pyzbar.pyzbar import decode
            from PIL import Image
            got = [d.data.decode() for d in decode(Image.open(f))]
        except Exception as e:                                   # noqa: BLE001
            got = ["<解码器异常 %s>" % e]
        ok.append((round(t, 2), URL in got, got))
    for row in ok:
        print("qr @%.2fs ->" % row[0], row[1], row[2])
    print("size: %.2f MB  duration: %.3f s" % (os.path.getsize(path) / 1048576, dur))


def stage_timeline():
    """打印分镜清单：成片第几秒是哪一章，取自素材的哪一段。"""
    import make_captions as C
    plan = json.load(open(BUILD + "/plan.json", encoding="utf-8"))
    t = 0.0
    print("%-9s %-13s %-8s %s" % ("成片时间", "分镜", "素材起点", "字幕"))
    for i, p in enumerate(plan):
        d = (0.45 if i == len(plan) - 1 else XFADE) if i else 0.0
        t -= d
        title = C.CHAPTERS.get(p["id"], ("片头/尾板", "", ""))[0]
        print("%6.2f-%6.2f  %-10s %7.2fs  %s"
              % (t, t + p["dur"], p["id"], p["src"], title))
        t += p["dur"]
    print("合计 %.2f s" % t)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd == "timeline":
        stage_timeline()
    if cmd in ("raw", "all"):
        stage_raw()
    if cmd in ("segs", "all"):
        stage_segs()
    if cmd in ("master", "all"):
        stage_master()
    if cmd == "mux":
        stage_mux()
    if cmd == "qa":
        stage_qa(sys.argv[2] if len(sys.argv) > 2 else None)
