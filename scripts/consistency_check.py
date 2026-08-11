# -*- coding: utf-8 -*-
"""提交包一致性体检：过期数值残留、文件名引用、网址一致性、个人信息扫描。

用法：
    python scripts/consistency_check.py
"""
import os
import re
import sys

# Windows 控制台默认 GBK，重定向输出时会因中文/符号报 UnicodeEncodeError
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUBMIT = os.path.join(ROOT, "提交")
URL = "https://wxx827.github.io/liao-juan/"

# 扫正文时跳过（体积大且非人工撰写）；建磁盘索引时只跳过前三个
SKIP_DIRS = {"node_modules", ".git", "__pycache__", "dist", "build", "shots", ".cursor"}
INDEX_SKIP_DIRS = {"node_modules", ".git", "__pycache__"}
TEXT_EXT = {".md", ".txt", ".js", ".mjs", ".py", ".json", ".html", ".css"}
SELF = os.path.basename(os.path.abspath(__file__))

# README 目录树里的压缩写法，不是磁盘上的真实文件名
SHORTHAND = {"liaofeng/jing/yun/wei/ci/bing/xi.js",
             "ta / tu / zi / lian / xian / zhi / xing .chapter.js"}

# 旧版本成片留下的过期数值。每次重导成片都要把被顶掉的那批数字追加进来。
# 注意只列真正变了的量：时长 58.00 秒与帧数 1740 在重录前后没变，列进来会误报。
STALE = [
    # 更早一版（23.6fps 素材之前）
    r"58\.10", r"58\.1\b", r"15,418,859", r"15418859", r"2123",
    # 上一版（脸谱遮挡修复前、23.6fps 素材）
    r"14\.7\d?\s*MB", r"15,479,787", r"15479787", r"2135",
]

FILE_TOKEN = re.compile(
    r"[0-9A-Za-z\u4e00-\u9fff_\-./·]+\.(?:mp4|png|jpg|jpeg|md|txt|py|mjs|js|css|html|json)")

PERSONAL = [
    r"学号", r"指导教师[:：]\s*\S", r"联系方式[:：]\s*\S",
    # 「辽宁省大学生……比赛」是赛事名不是院校名，用 (?!生) 排除
    r"[\u4e00-\u9fff]{2,8}(?:大学|学院|职业技术学院|师范学院)(?!生)",
    r"1[3-9]\d{9}",                       # 手机号
    r"[\w.+-]+@[\w-]+\.[\w.]+",           # 邮箱
    r"\b\d{8,12}\b",                      # 疑似学号
]

problems = []
notes = []


def walk_text_files():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if os.path.splitext(fn)[1].lower() in TEXT_EXT:
                yield os.path.join(dirpath, fn)


def read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except (UnicodeDecodeError, OSError):
        return None


def disk_index():
    """仓库内所有真实文件：{basename: [相对路径…]}，以及全部相对路径集合。

    这里要连 build/ dist/ 一起收，因为文档会引用 build/qrcode_plain.png 之类的中间产物。
    """
    by_name, rels = {}, set()
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in INDEX_SKIP_DIRS]
        for fn in filenames:
            rel = os.path.relpath(os.path.join(dirpath, fn), ROOT).replace("\\", "/")
            rels.add(rel)
            by_name.setdefault(fn, []).append(rel)
    return by_name, rels


def check_stale():
    print("\n【1】过期数值残留扫描")
    hits = 0
    for p in walk_text_files():
        if os.path.basename(p) == SELF:   # 本脚本自身就写着这些模式
            continue
        txt = read(p)
        if txt is None:
            continue
        for ln, line in enumerate(txt.splitlines(), 1):
            for pat in STALE:
                if re.search(pat, line):
                    rel = os.path.relpath(p, ROOT)
                    print(f"  ✗ {rel}:{ln}  [{pat}]  {line.strip()[:110]}")
                    problems.append(f"过期数值 {pat} 残留于 {rel}:{ln}")
                    hits += 1
    if not hits:
        print("  ✓ 全仓库无旧成片数值残留")


def check_filenames():
    print("\n【2】文档引用的文件名 vs 磁盘真实文件名")
    by_name, rels = disk_index()
    docs = [os.path.join(SUBMIT, "提交说明.md"),
            os.path.join(SUBMIT, "报名表填写速查.md"),
            os.path.join(SUBMIT, "附加交付物", "说明.md"),
            os.path.join(ROOT, "作品说明.md"),
            os.path.join(ROOT, "README.md")]
    bad = 0
    for d in docs:
        if not os.path.isfile(d):
            continue
        txt = read(d) or ""
        seen = set()
        for m in FILE_TOKEN.finditer(txt):
            # 前一个字符是 * < . 时说明匹配是从通配/占位写法中间截出来的，如 *.chapter.js
            if m.start() > 0 and txt[m.start() - 1] in "*<>.":
                continue
            # 目录树里的「… / xing .chapter.js」这类省略写法，只剩个后缀片段
            if m.group(0).startswith("."):
                continue
            tok = m.group(0).strip("./")
            if tok in seen or tok in SHORTHAND:
                continue
            seen.add(tok)
            base = os.path.basename(tok)
            if "/" in tok and tok in rels:
                continue
            if base in by_name:
                continue
            rel = os.path.relpath(d, ROOT)
            print(f"  ✗ {rel} 引用了磁盘上不存在的文件名：{tok}")
            problems.append(f"{rel} 引用不存在的文件名 {tok}")
            bad += 1
    if not bad:
        print("  ✓ 所有文档引用的文件名都能在磁盘上逐字符匹配到")


def check_url():
    print("\n【3】网址一致性")
    urls = set()
    for p in walk_text_files():
        txt = read(p)
        if txt is None:
            continue
        for u in re.findall(r"https://[\w.-]+\.github\.io/[\w\-./]*", txt):
            urls.add(u.rstrip("）) ,，。"))
    for u in sorted(urls):
        flag = "✓" if u == URL else "✗"
        print(f"  {flag} 文档中出现：{u}")
        if u != URL:
            problems.append(f"文档中出现不一致的网址 {u}")

    for name in ("辽卷_指尖上的辽宁_二维码.png",
                 "辽卷_指尖上的辽宁_二维码_素码.png",
                 os.path.join("附加交付物", "辽卷_分享海报_1080x1920.png")):
        p = os.path.join(SUBMIT, name)
        if not os.path.isfile(p):
            continue
        got = decode(p)
        flag = "✓" if got == URL else "✗"
        print(f"  {flag} 扫码 {os.path.basename(name)} → {got}")
        if got != URL:
            problems.append(f"{name} 解出的网址为 {got}")


def decode(path):
    try:
        from PIL import Image
        from pyzbar.pyzbar import decode as zdec
        got = [d.data.decode() for d in zdec(Image.open(path))]
        return got[0] if got else None
    except Exception as e:
        return f"<解码失败 {e}>"


def check_personal():
    print("\n【4】个人信息扫描（提交/ 与根目录文档）")
    targets = [os.path.join(SUBMIT, f) for f in os.listdir(SUBMIT)
               if os.path.splitext(f)[1].lower() in (".md", ".txt")]
    targets.append(os.path.join(SUBMIT, "附加交付物", "说明.md"))
    targets += [os.path.join(ROOT, "作品说明.md"), os.path.join(ROOT, "README.md")]
    hits = 0
    for p in targets:
        if not os.path.isfile(p):
            continue
        txt = read(p) or ""
        for ln, line in enumerate(txt.splitlines(), 1):
            for pat in PERSONAL:
                m = re.search(pat, line)
                if m:
                    rel = os.path.relpath(p, ROOT)
                    print(f"  ? {rel}:{ln}  命中 [{pat}] → 「{m.group(0)}」  {line.strip()[:90]}")
                    notes.append(f"{rel}:{ln} 命中个人信息模式 {m.group(0)}")
                    hits += 1
    if not hits:
        print("  ✓ 未命中任何个人信息模式")
    else:
        print("  （以上为模式命中，需人工判断是否为「声明不含个人信息」这类正当语境）")


def check_stray():
    print("\n【5】提交/ 目录洁净度")
    bad = []
    for dirpath, dirnames, filenames in os.walk(SUBMIT):
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            if (fn.startswith("_") or fn.startswith("~") or fn.startswith(".")
                    or ext in (".tmp", ".bak", ".log", ".part", ".ini", ".db")):
                bad.append(os.path.relpath(os.path.join(dirpath, fn), SUBMIT))
    sizes = {}
    for dirpath, dirnames, filenames in os.walk(SUBMIT):
        for fn in filenames:
            p = os.path.join(dirpath, fn)
            sizes.setdefault((fn, os.path.getsize(p)), []).append(
                os.path.relpath(p, SUBMIT))
    dups = {k: v for k, v in sizes.items() if len(v) > 1}
    if bad:
        print("  ✗ 临时/隐藏文件：" + "、".join(bad))
        problems.append("提交/ 含临时文件：" + "、".join(bad))
    else:
        print("  ✓ 无临时文件 / 中间产物 / 隐藏文件")
    if dups:
        for (fn, _), v in dups.items():
            print(f"  ✗ 重复文件 {fn}：" + "、".join(v))
            problems.append(f"提交/ 内重复文件 {fn}")
    else:
        print("  ✓ 无同名同尺寸的重复文件")


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        if arg.startswith("--out="):
            sys.stdout = open(arg[6:], "w", encoding="utf-8")
    print("=" * 78)
    print("《辽·卷 — 指尖上的辽宁》提交包一致性体检")
    print("=" * 78)
    check_stale()
    check_filenames()
    check_url()
    check_personal()
    check_stray()
    print("\n" + "=" * 78)
    print(f"硬性问题 {len(problems)} 条 / 待人工判断 {len(notes)} 条")
    for x in problems:
        print("  ! " + x)
    sys.exit(1 if problems else 0)
