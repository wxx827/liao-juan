# -*- coding: utf-8 -*-
"""实测 提交/ 下所有交付文件的真实规格，输出 JSON 供文档回填核对。

用法：
    python scripts/measure_deliverables.py
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUBMIT = os.path.join(ROOT, "提交")
MB = 1024 * 1024


def ffprobe(path):
    cmd = ["ffprobe", "-v", "error", "-print_format", "json",
           "-show_format", "-show_streams", path]
    raw = subprocess.run(cmd, capture_output=True, text=True,
                         encoding="utf-8", timeout=180)
    if raw.returncode != 0:
        return None
    return json.loads(raw.stdout)


def rate(s):
    try:
        num, den = (int(x) for x in s.split("/"))
        return num / den if den else 0.0
    except Exception:
        return 0.0


def probe_video(path):
    info = ffprobe(path)
    if not info:
        return {"error": "ffprobe 失败"}
    fmt = info.get("format", {})
    vs = next((s for s in info["streams"] if s.get("codec_type") == "video"), None)
    a = next((s for s in info["streams"] if s.get("codec_type") == "audio"), None)
    size = int(fmt.get("size") or os.path.getsize(path))
    w, h = int(vs.get("width", 0)), int(vs.get("height", 0))
    dur = float(fmt.get("duration") or vs.get("duration") or 0)
    nb = vs.get("nb_frames")
    return {
        "file": os.path.relpath(path, SUBMIT),
        "container": fmt.get("format_name", ""),
        "vcodec": vs.get("codec_name", ""),
        "profile": vs.get("profile", ""),
        "level": vs.get("level"),
        "pix_fmt": vs.get("pix_fmt", ""),
        "width": w,
        "height": h,
        "aspect": f"{w}:{h}",
        "aspect_is_9_16": w * 16 == h * 9,
        "fps": round(rate(vs.get("avg_frame_rate", "0/1")), 4),
        "r_frame_rate": vs.get("r_frame_rate"),
        "nb_frames": int(nb) if nb and str(nb).isdigit() else None,
        "duration_s": round(dur, 3),
        "duration_video_s": round(float(vs.get("duration") or 0), 3),
        "bitrate_bps": int(fmt.get("bit_rate") or 0),
        "bitrate_kbps": round(int(fmt.get("bit_rate") or 0) / 1000),
        "size_bytes": size,
        "size_bytes_grouped": f"{size:,}",
        "size_mb": round(size / MB, 2),
        "audio": None if a is None else {
            "codec": a.get("codec_name"),
            "channels": a.get("channels"),
            "sample_rate": a.get("sample_rate"),
            "bitrate_kbps": round(int(a.get("bit_rate") or 0) / 1000) or None,
        },
    }


def probe_image(path):
    from PIL import Image
    with Image.open(path) as im:
        w, h = im.size
        mode = im.mode
        fmt = im.format
    size = os.path.getsize(path)
    return {
        "file": os.path.relpath(path, SUBMIT),
        "format": fmt,
        "mode": mode,
        "width": w,
        "height": h,
        "size_bytes": size,
        "size_bytes_grouped": f"{size:,}",
        "size_kb": round(size / 1024, 1),
        "size_mb": round(size / MB, 2),
    }


def main():
    out = {"videos": [], "images": [], "tree": []}
    for dirpath, dirnames, filenames in os.walk(SUBMIT):
        dirnames.sort()
        for fn in sorted(filenames):
            p = os.path.join(dirpath, fn)
            rel = os.path.relpath(p, SUBMIT)
            out["tree"].append({"rel": rel, "bytes": os.path.getsize(p)})
            ext = os.path.splitext(fn)[1].lower()
            if ext == ".mp4":
                out["videos"].append(probe_video(p))
            elif ext in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
                out["images"].append(probe_image(p))
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if not os.path.isdir(SUBMIT):
        print("提交/ 目录不存在")
        sys.exit(1)
    main()
