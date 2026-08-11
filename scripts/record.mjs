// 录制参赛短视频原始素材：CDP 屏幕录制 1080×1920 竖屏，全流程走一遍 22 屏并打点分镜。
// 产物：build/frames/*.jpg（逐帧）+ build/frames.json（帧时间戳）+ build/marks.json（分镜区间）
import puppeteer from 'puppeteer-core';
import { mkdirSync, rmSync, writeFileSync, writeFile } from 'fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE_URL || 'http://localhost:5199/';
const OUT = 'build/frames';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 关键：靠 --force-device-scale-factor=2 拿到真 2 倍像素的录制面。
// 用 Emulation.setDeviceMetricsOverride（即 puppeteer 的 deviceScaleFactor）反而只会得到 CSS 尺寸的帧。
const CSS_W = 540, CSS_H = 960;
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    `--window-size=${CSS_W},${CSS_H}`,
    '--force-device-scale-factor=2',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--disable-lcd-text',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
  ],
  defaultViewport: null,
});
const page = await browser.newPage();

// 窗口尺寸 ≠ 视口尺寸，反馈式校正到 CSS 正好 540×960（即录制帧 1080×1920）
{
  const cdp = await page.createCDPSession();
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  for (let i = 0; i < 5; i++) {
    const [iw, ih] = await page.evaluate(() => [innerWidth, innerHeight]);
    if (iw === CSS_W && ih === CSS_H) break;
    const { bounds } = await cdp.send('Browser.getWindowBounds', { windowId });
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { width: bounds.width + (CSS_W - iw), height: bounds.height + (CSS_H - ih) },
    });
    await new Promise((r) => setTimeout(r, 250));
  }
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  console.log('viewport', await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio].join('x')));
}

// 注入一颗跟手的“指尖”光点，让录像里能看出是有人在操作
await page.evaluateOnNewDocument(() => {
  const add = () => {
    const dot = document.createElement('div');
    dot.id = '__touch';
    Object.assign(dot.style, {
      position: 'fixed', left: '0', top: '0', width: '54px', height: '54px', marginLeft: '-27px',
      marginTop: '-27px', borderRadius: '50%', pointerEvents: 'none', zIndex: '2147483647',
      background: 'radial-gradient(circle, rgba(255,255,255,.85) 0%, rgba(201,162,39,.55) 42%, rgba(166,56,46,0) 72%)',
      boxShadow: '0 0 18px rgba(201,162,39,.7)', opacity: '0',
      transition: 'opacity .18s ease, transform .12s ease', transform: 'scale(.7)',
    });
    document.body.appendChild(dot);
    let hide;
    const move = (e) => {
      dot.style.left = e.clientX + 'px';
      dot.style.top = e.clientY + 'px';
      dot.style.opacity = '1';
      clearTimeout(hide);
      hide = setTimeout(() => { dot.style.opacity = '0'; }, 700);
    };
    addEventListener('pointermove', move, true);
    addEventListener('pointerdown', (e) => { move(e); dot.style.transform = 'scale(1.15)'; }, true);
    addEventListener('pointerup', () => { dot.style.transform = 'scale(.7)'; }, true);
  };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
});

await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await sleep(2000);

/* ---------------- 录制 ---------------- */
const frames = [];
const client = await page.createCDPSession();
let n = 0;
let pending = 0;   // 尚未落盘的帧数
client.on('Page.screencastFrame', ({ data, sessionId }) => {
  // 先 ack 再落盘：screencast 靠 ack 做流控，等写完再 ack 会把帧率压掉一半。
  // 落盘也必须是异步的，同步 writeSync 会阻塞 CDP 事件循环。
  client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  const name = String(n++).padStart(6, '0') + '.jpg';
  frames.push({ f: name, t: Date.now() });
  pending++;
  writeFile(`${OUT}/${name}`, Buffer.from(data, 'base64'), () => { pending--; });
});

const marks = [];
const T0 = () => Date.now();
let recStart = 0;
async function shot(label, fn) {
  const t0 = Date.now();
  try { await fn(); } catch (e) { console.log('  ! ' + label + ' ' + e.message); }
  marks.push({ label, t0: t0 - recStart, t1: Date.now() - recStart });
  console.log(`${label.padEnd(8)} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

/* ---------------- 交互工具 ---------------- */
const boxOf = (sel) => page.$eval(sel, (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
});
const tap = async (x, y, hold = 60) => {
  await page.mouse.move(x, y);
  await sleep(50);
  await page.mouse.down();
  await sleep(hold);
  await page.mouse.up();
};
const tapSel = async (sel, hold = 60) => {
  const b = await boxOf(sel).catch(() => null);
  if (!b) return false;
  await tap(b.x + b.w / 2, b.y + b.h / 2, hold);
  return true;
};
const clickJs = (sel) => page.$eval(sel, (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))).catch(() => {});

// SVG 异形分区（月牙形下巴、弧形脸颊）的外接框中心常常落在图形之外，
// 扫一遍网格找一个 elementFromPoint 真能命中它的坐标再点。
const tapInside = async (sel, hold = 60) => {
  const p = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    for (let gy = 1; gy <= 9; gy++) {
      for (let gx = 1; gx <= 9; gx++) {
        const x = r.left + (r.width * gx) / 10;
        const y = r.top + (r.height * gy) / 10;
        const hit = document.elementFromPoint(x, y);
        if (hit === el || el.contains(hit)) return { x, y };
      }
    }
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, sel).catch(() => null);
  if (!p) return false;
  await tap(p.x, p.y, hold);
  return true;
};
const keysOf = (sel, attr) => page.$$eval(sel, (els, a) => els.map((e) => e.dataset[a]), attr).catch(() => []);

// 平滑滚到某章，像真人上滑翻页
const glide = async (hash, wait = 900) => {
  await page.evaluate((h) => document.querySelector(h)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), hash);
  await sleep(wait);
};

// 慢速来回涂抹（剪纸 / 点釉 / 描红 / 刮矿）
async function paint(box, rows = 8, passes = 2, stepMs = 12) {
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < rows; i++) {
      const y = box.y + box.h * (0.12 + (0.78 * i) / (rows - 1));
      const l2r = i % 2 === 0;
      const xs = l2r ? [0.08, 0.94] : [0.94, 0.08];
      await page.mouse.move(box.x + box.w * xs[0], y);
      await page.mouse.down();
      for (let s = 0; s <= 18; s++) {
        const r = xs[0] + ((xs[1] - xs[0]) * s) / 18;
        await page.mouse.move(box.x + box.w * r, y);
        await sleep(stepMs);
      }
      await page.mouse.up();
    }
  }
}

// everyNthFrame 必须是 1：设成 2 等于主动丢掉一半帧，实测只能拿到 19–24fps，
// 转成 CFR 30 后会有三成重复帧，横滑和涂抹笔触明显发涩。
await client.send('Page.startScreencast', { format: 'jpeg', quality: 86, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
recStart = T0();
await sleep(400);
if (!frames.length) throw new Error('screencast 没出帧');
console.log('recording…');

/* ---------------- 分镜 ---------------- */

await shot('intro', async () => {
  await sleep(2600);
  await page.mouse.move(270, 700);
  await sleep(300);
});

await shot('feng', async () => {
  await glide('#feng');
  await paint(await boxOf('#paperFrame'), 8, 2, 4);
  await sleep(1100);
});

await shot('jing', async () => {
  await glide('#jing');
  for (const s of ['honghaitan', 'shuidong', 'duanqiao', 'binhai']) {
    // 四景挂在横向长卷上，先把地标滑进视野再点，顺带把视差横滑也录进去
    await page.evaluate((k) => {
      const wrap = document.getElementById('panWrap');
      const pin = document.querySelector(`.pin[data-scene="${k}"]`);
      if (!wrap || !pin) return;
      const wr = wrap.getBoundingClientRect();
      const pr = pin.getBoundingClientRect();
      wrap.scrollTo({ left: wrap.scrollLeft + (pr.left + pr.width / 2) - (wr.left + wr.width / 2), behavior: 'smooth' });
    }, s);
    await sleep(760);
    await tapSel(`.pin[data-scene="${s}"]`);
    await sleep(700);
    await tapSel('#modalClose');
    await sleep(240);
  }
  await sleep(500);
});

await shot('yun', async () => {
  await glide('#yun');
  const s = await boxOf('#shadowStage');
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  // 走台 + 作揖一共要满 5 次互动才落印，这里给到 6 次
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let k = 0; k <= 24; k++) {
      await page.mouse.move(cx + Math.sin((k / 24) * Math.PI * 2) * 95, cy + Math.cos((k / 24) * Math.PI * 2) * 12);
      await sleep(16);
    }
    await page.mouse.up();
    await sleep(160);
  }
  for (let i = 0; i < 2; i++) {
    await tap(cx, cy);
    await sleep(420);
  }
  await sleep(700);
});

await shot('wei', async () => {
  await glide('#wei');
  for (const k of ['jiaozi', 'xunji', 'guobaorou', 'haixian']) {
    await tapSel(`.food[data-food="${k}"]`);
    await sleep(520);
  }
  await sleep(500);
});

await shot('ci', async () => {
  await glide('#ci');
  await paint(await boxOf('#vaseFrame'), 7, 2, 4);
  await sleep(900);
});

await shot('bing', async () => {
  await glide('#bing');
  for (let i = 0; i < 30; i++) {
    const done = await page.$eval('#stampBing', (el) => el.classList.contains('show')).catch(() => false);
    if (done) break;
    const flakes = await page.$$('#snowCatch .flake');
    for (const f of flakes.slice(0, 3)) {
      const b = await f.boundingBox().catch(() => null);
      if (b) await tap(b.x + b.width / 2, b.y + b.height / 2, 30);
    }
    await sleep(120);
  }
  await sleep(600);
});

await shot('gu', async () => {
  await glide('#gu');
  const d = await boxOf('#drumBtn');
  for (let i = 0; i < 14; i++) {
    await tap(d.x + d.w / 2, d.y + d.h / 2, 40);
    await sleep(105);
  }
  await sleep(700);
});

await shot('shi', async () => {
  await glide('#shi');
  for (const k of await keysOf('#shiTrack .era-node', 'era')) {
    await tapSel(`#shiTrack .era-node[data-era="${k}"]`);
    await sleep(330);
    await clickJs('#shiModalClose');
    await sleep(140);
  }
  await sleep(500);
});

await shot('ren', async () => {
  await glide('#ren');
  for (const k of await keysOf('#renGrid .ren-card', 'ren')) {
    await tapSel(`#renGrid .ren-card[data-ren="${k}"]`);
    await sleep(300);
    await clickJs('#renModalClose');
    await sleep(120);
  }
  await sleep(400);
});

await shot('yi', async () => {
  await glide('#yi');
  for (const k of await keysOf('#yiGrid .craft', 'craft')) {
    await tapSel(`#yiGrid .craft[data-craft="${k}"]`);
    await sleep(280);
  }
  await sleep(700);
});

await shot('bao', async () => {
  await glide('#bao');
  const cells = await page.$$('#baoGrid .ore');
  for (const cell of cells) {
    const b = await cell.boundingBox();
    if (b) await paint({ x: b.x, y: b.y, w: b.width, h: b.height }, 4, 1, 3);
    await sleep(320);
    await clickJs('#baoModalClose');
    await sleep(120);
  }
});

await shot('su', async () => {
  await glide('#su');
  await tapSel('#suStart');
  await sleep(200);
  const s = await boxOf('#suStage');
  for (let i = 0; i < 40; i++) {
    const done = await page.$eval('#stampSu', (el) => el.classList.contains('show')).catch(() => false);
    if (done) break;
    await tap(s.x + s.w / 2, s.y + s.h * 0.5, 35);
    await sleep(85);
  }
  await sleep(600);
});

await shot('yan', async () => {
  await glide('#yan');
  const ANS = [1, 1, 1, 1, 1, 1, 1, 0, 1];
  for (const a of ANS) {
    const opts = await page.$$('#yanOpts .yan-opt');
    if (opts[a]) {
      const b = await opts[a].boundingBox().catch(() => null);
      if (b) await tap(b.x + b.width / 2, b.y + b.height / 2, 40);
    }
    await sleep(240);
    await clickJs('#yanNext');
    await sleep(200);
  }
  await sleep(500);
});

await shot('ta', async () => {
  await glide('#ta');
  for (const k of await keysOf('#taGrid .ta-card', 'key')) {
    await tapSel(`#taGrid .ta-card[data-key="${k}"]`);
    await sleep(260);
  }
  await sleep(600);
});

await shot('tu', async () => {
  await glide('#tu');
  for (const k of (await keysOf('#tuGrid .city-chip', 'city')).slice(0, 8)) {
    await tapSel(`#tuGrid .city-chip[data-city="${k}"]`);
    await sleep(240);
    await clickJs('#tuModalClose');
    await sleep(100);
  }
  for (const k of (await keysOf('#tuGrid .city-chip', 'city')).slice(8)) {
    await clickJs(`#tuGrid .city-chip[data-city="${k}"]`);
    await sleep(70);
    await clickJs('#tuModalClose');
    await sleep(60);
  }
  await sleep(500);
});

await shot('zi', async () => {
  await glide('#zi');
  await paint(await boxOf('#ziFrame'), 8, 2, 4);
  await sleep(900);
});

await shot('lian', async () => {
  await glide('#lian');
  const regions = await keysOf('#lianMask .mask-region', 'region');
  for (const r of regions) {
    await tapInside(`#lianMask .mask-region[data-region="${r}"]`);
    await sleep(230);
  }
  // 左右眼窝这两块被后画的鼻梁/脸颊完全盖住，指针点不到（App 侧的遮挡问题），
  // 剩下没上色的补一次程序化 click，保证这一章能收印。
  for (const r of regions) {
    const done = await page.$eval(`#lianMask .mask-region[data-region="${r}"]`,
      (el) => el.classList.contains('colored')).catch(() => true);
    if (!done) {
      await clickJs(`#lianMask .mask-region[data-region="${r}"]`);
      await sleep(260);
    }
  }
  await sleep(800);
});

await shot('xian', async () => {
  await glide('#xian');
  for (const k of await keysOf('#xianGrid .xian-card', 'key')) {
    await tapSel(`#xianGrid .xian-card[data-key="${k}"]`);
    await sleep(260);
  }
  await sleep(600);
});

await shot('zhi', async () => {
  await glide('#zhi');
  await tapSel('#zhiThemes .zhi-theme');
  await sleep(300);
  // 要生成满 3 签才落印
  for (let i = 0; i < 3; i++) {
    await tapSel('#zhiGen');
    await sleep(1250);
  }
  await sleep(900);
});

await shot('juanling', async () => {
  await tapSel('#jlFab');
  await sleep(700);
  await tapSel('#jlChips .jl-chip');
  await sleep(1600);
  await clickJs('#jlClose');
  await sleep(300);
});

await shot('xing', async () => {
  await glide('#xing');
  const stars = await page.$$('#xingStars .xing-star');
  for (const st of stars) {
    const b = await st.boundingBox().catch(() => null);
    if (b) await tap(b.x + b.width / 2, b.y + b.height / 2, 25);
    await sleep(70);
  }
  await sleep(900);
});

await shot('final', async () => {
  await glide('#final', 1400);
  await sleep(3600);
});

await client.send('Page.stopScreencast');
await sleep(400);
// 等异步写盘排空，否则 frames.json 里会有还没落地的帧
while (pending > 0) await sleep(120);

// 自检：列出没点亮的印。缺印就说明那一章的交互没走通，得先修再剪。
const missing = await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      if (v && v.seals) return Object.entries(v.seals).filter(([, on]) => !on).map(([n]) => n);
    } catch { /* 不是本站的存档 */ }
  }
  return ['<未读到存档>'];
});
console.log('未点亮的印:', missing.length ? missing.join(', ') : '无，20/20 集齐');

writeFileSync('build/frames.json', JSON.stringify({ start: recStart, frames }));
writeFileSync('build/marks.json', JSON.stringify(marks, null, 2));
const span = (frames[frames.length - 1].t - frames[0].t) / 1000;
console.log(`\n${frames.length} frames, ${((Date.now() - recStart) / 1000).toFixed(1)}s`
  + `, 平均 ${(frames.length / span).toFixed(1)} fps`);

// 顺便导出终章明信片原图，尾板可以用
const dataUrl = await page.$eval('#postcardPreview', (el) => el.src).catch(() => '');
if (dataUrl.startsWith('data:image')) {
  writeFileSync('build/postcard.jpg', Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('postcard saved');
}

await browser.close();
