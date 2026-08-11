// 点击可达性审计：用 elementFromPoint 检查每个可点击分区在「外接框中心」与「框内采样网格」
// 上真正命中的是不是它自己。输出问题清单（shots/hit-audit.json）。
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE_URL || 'http://localhost:5199/';
const OUT = process.env.OUT || 'shots/hit-audit.json';
const GRID = 9; // 采样网格 9x9

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=800,1000', '--hide-scrollbars'],
  defaultViewport: { width: 390, height: 844, isMobile: true, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await sleep(1500);

const sections = await page.$$eval('section[id]', (els) => els.map((e) => e.id));
const findings = [];

for (const id of sections) {
  await page.evaluate((sid) => {
    document.getElementById(sid)?.scrollIntoView({ behavior: 'instant' });
  }, id);
  await sleep(600);

  const rows = await page.evaluate((sid, grid) => {
    const sec = document.getElementById(sid);
    if (!sec) return [];
    const vw = innerWidth, vh = innerHeight;

    const isCandidate = (el) => {
      if (!(el instanceof Element)) return false;
      const cs = getComputedStyle(el);
      if (cs.pointerEvents === 'none' || cs.visibility === 'hidden' || cs.display === 'none') return false;
      if (el.closest('[hidden]')) return false;
      const tagOk = el.matches('button, a[href], [role="button"], [tabindex]:not([tabindex="-1"])');
      return tagOk || cs.cursor === 'pointer';
    };

    const all = [...sec.querySelectorAll('*')].filter(isCandidate);
    // 只留最外层候选：内层元素被点中时事件照样冒泡到外层，算命中
    const outer = all.filter((el) => !all.some((o) => o !== el && o.contains(el)));

    const describe = (el) => {
      if (!el) return 'null';
      const cls = typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
      return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls.trim().split(/\s+/).join('.') : ''}`;
    };

    const inView = (r) => r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;

    return outer.map((el) => {
      let r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return null;
      // 横滑长卷等容器里的目标初始在视口外：先滑到可见再测（真人也是先滑再点）
      if (!inView(r)) {
        el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' });
        r = el.getBoundingClientRect();
      }
      if (!inView(r)) return null;

      const hitsSelf = (x, y) => {
        if (x < 0 || y < 0 || x >= vw || y >= vh) return null;
        const h = document.elementFromPoint(x, y);
        if (!h) return null;
        return { self: h === el || el.contains(h), hit: h };
      };

      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const c = hitsSelf(cx, cy);

      let inGrid = 0, hitGrid = 0, firstGood = null;
      for (let i = 0; i < grid; i++) {
        for (let j = 0; j < grid; j++) {
          const x = r.left + (r.width * (i + 0.5)) / grid;
          const y = r.top + (r.height * (j + 0.5)) / grid;
          const g = hitsSelf(x, y);
          if (!g) continue;
          inGrid++;
          if (g.self) {
            hitGrid++;
            if (!firstGood) firstGood = { x: Math.round(x), y: Math.round(y) };
          }
        }
      }

      return {
        section: sid,
        sel: describe(el),
        label: el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 14),
        box: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        centerOk: !!(c && c.self),
        centerHit: c ? describe(c.hit) : 'offscreen',
        hitRatio: inGrid ? +(hitGrid / inGrid).toFixed(3) : 0,
        firstGood,
      };
    }).filter(Boolean);
  }, id, GRID);

  findings.push(...rows);
}

mkdirSync('shots', { recursive: true });
writeFileSync(OUT, JSON.stringify(findings, null, 2));

const cls = (f) => {
  if (f.hitRatio === 0) return 'CRITICAL';           // 整个外接框内没有一个点能命中它
  if (!f.centerOk) return 'CENTER-BLOCKED';          // 中心点被挡，但图形内别处可点
  if (Math.min(f.box.w, f.box.h) < 24) return 'SMALL'; // 触摸热区偏小
  if (f.hitRatio < 0.35) return 'NARROW';            // 异形/细长，可点面积占比低
  return 'OK';
};

const groups = {};
for (const f of findings) (groups[cls(f)] ||= []).push(f);

console.log(`审计 ${findings.length} 个可点击目标，来自 ${sections.length} 屏\n`);
for (const level of ['CRITICAL', 'CENTER-BLOCKED', 'NARROW', 'SMALL', 'OK']) {
  const list = groups[level] || [];
  console.log(`== ${level}: ${list.length}`);
  if (level === 'OK') continue;
  for (const f of list) {
    console.log(`   [${f.section}] ${f.sel} "${f.label}" ${f.box.w}x${f.box.h} `
      + `中心命中=${f.centerOk ? '是' : '否 → ' + f.centerHit} 可点比=${f.hitRatio}`);
  }
}

await browser.close();
process.exit(0);
