// 真实指针事件验证：全程用 page.mouse.click(x, y) 打在坐标上（会走浏览器命中测试），
// 不用 element.dispatchEvent(new MouseEvent('click'))——后者绕过命中测试，正是脸谱眼窝
// 被鼻梁/脸颊盖住却长期没被发现的原因。
// 断言：脸谱 7/7 且中心点可点、HUD 20/20、终章明信片合成。
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE_URL || 'http://localhost:5199/';
const results = [];
const ok = (name, pass, extra = '') => {
  results.push([name, pass]);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=800,1000', '--hide-scrollbars'],
  defaultViewport: { width: 390, height: 844, isMobile: true, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await sleep(1500);

const boxOf = async (sel) => page.$eval(sel, (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
});
const goto = async (hash) => {
  await page.evaluate((h) => { document.querySelector(h)?.scrollIntoView({ behavior: 'instant' }); }, hash);
  await sleep(500);
};
const stampShown = (id) => page.$eval(`#${id}`, (el) => el.classList.contains('show')).catch(() => false);
const keysOf = (sel, attr) => page.$$eval(sel, (els, a) => els.map((e) => e.dataset[a]), attr);

// 找一个「点下去真能命中该元素」的视口坐标：优先外接框中心，命中不了再扫网格
async function hitPoint(sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return { ok: false, reason: 'not-found' };
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return { ok: false, reason: 'zero-size' };
    const test = (x, y) => {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
      const h = document.elementFromPoint(x, y);
      return !!h && (h === el || el.contains(h));
    };
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (test(cx, cy)) return { ok: true, x: cx, y: cy, center: true };
    const N = 15;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = r.left + (r.width * (i + 0.5)) / N;
        const y = r.top + (r.height * (j + 0.5)) / N;
        if (test(x, y)) return { ok: true, x, y, center: false };
      }
    }
    return { ok: false, reason: 'unreachable' };
  }, sel);
}

// 真实指针点击：解析坐标 → page.mouse.click
async function realClick(sel, { optional = false } = {}) {
  const p = await hitPoint(sel);
  if (!p.ok) {
    if (!optional) console.log(`      ! 无法命中 ${sel} (${p.reason})`);
    return p;
  }
  await page.mouse.click(p.x, p.y, { delay: 20 });
  return p;
}

async function scrub(box, passes = 2) {
  for (let p = 0; p < passes; p++) {
    for (let ry = 0.12; ry <= 0.9; ry += 0.09) {
      const y = box.y + box.h * ry;
      await page.mouse.move(box.x + box.w * 0.08, y);
      await page.mouse.down();
      for (let rx = 0.08; rx <= 0.94; rx += 0.05) await page.mouse.move(box.x + box.w * rx, y);
      await page.mouse.up();
    }
  }
}

/* ================= 重点：辽韵 · 脸谱（真实点击 7 个分区） ================= */
await goto('#lian');
const lianRegions = await keysOf('#lianMask .mask-region', 'region');
const lianReport = [];
for (const r of lianRegions) {
  const sel = `#lianMask .mask-region[data-region="${r}"]`;
  const p = await realClick(sel);
  lianReport.push({ region: r, ...p });
  await sleep(120);
}
const lianCount = await page.$eval('#lianCount', (el) => Number(el.textContent)).catch(() => -1);
console.log('  脸谱分区命中明细：');
for (const d of lianReport) {
  console.log(`    ${d.ok ? '命中' : '未命中'} ${d.region.padEnd(10)} ${d.ok ? `(${Math.round(d.x)},${Math.round(d.y)}) ${d.center ? '外接框中心' : '网格回退点'}` : d.reason}`);
}
ok('脸谱 · 7 个分区外接框中心均可直接点中', lianReport.length === 7 && lianReport.every((d) => d.ok && d.center));
ok('脸谱 · 真实点击点满 7/7', lianCount === lianRegions.length, `(${lianCount}/${lianRegions.length})`);
ok('脸谱 · 第 20 枚印 stampLian 点亮', await stampShown('stampLian'));
await page.screenshot({ path: 'shots/verify-lian.png' });

/* ================= 其余章节：全部真实指针事件走一遍 ================= */

await goto('#feng');
await scrub(await boxOf('#paperFrame'), 2);
await sleep(900);
ok('辽风 · 剪纸', await stampShown('stampFeng'));

await goto('#jing');
for (const s of await keysOf('#pan .pin', 'scene')) {
  const sel = `#pan .pin[data-scene="${s}"]`;
  // 四景排在横滑长卷上，真人要先横向滑动才看得到后三景
  await page.evaluate((q) => document.querySelector(q)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' }), sel);
  await sleep(450);
  await realClick(sel);
  await sleep(500);
  await realClick('#modalClose', { optional: true });
  await sleep(300);
}
ok('辽景 · 四景', await stampShown('stampJing'));

await goto('#yun');
{
  const s = await boxOf('#shadowStage');
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(cx, cy); await page.mouse.down();
    for (let step = 0; step <= 10; step++) { await page.mouse.move(cx + Math.sin((step / 10) * Math.PI * 2) * 90, cy); await sleep(16); }
    await page.mouse.up(); await sleep(250);
  }
  for (let i = 0; i < 2; i++) { await page.mouse.click(cx, cy, { delay: 30 }); await sleep(1000); }
}
ok('辽韵 · 皮影', await stampShown('stampYun'));

await goto('#wei');
for (const f of await keysOf('.food-grid .food', 'food')) {
  await realClick(`.food-grid .food[data-food="${f}"]`);
  await sleep(900);
}
ok('辽味 · 四宝', await stampShown('stampWei'));

await goto('#ci');
await scrub(await boxOf('#vaseFrame'), 2);
await sleep(900);
ok('辽瓷 · 点釉', await stampShown('stampCi'));

// 辽冰：雪花是下落中的动态目标，只点「此刻真的能命中」的那些
await goto('#bing');
{
  let tries = 0, clicked = 0, skippedClipped = 0;
  while (tries++ < 90 && !(await stampShown('stampBing'))) {
    const pts = await page.$$eval('#snowCatch .flake', (els) => els.map((el, i) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const h = document.elementFromPoint(x, y);
      return { i, x, y, hittable: !!h && (h === el || el.contains(h)) };
    })).catch(() => []);
    for (const p of pts) {
      if (p.hittable) { await page.mouse.click(p.x, p.y); clicked++; }
      else skippedClipped++;
      await sleep(30);
    }
    await sleep(160);
  }
  console.log(`      雪花真实点击 ${clicked} 次（${skippedClipped} 次因刚出生仍被顶部标题遮住而跳过）`);
}
ok('辽冰 · 接雪花', await stampShown('stampBing'));

await goto('#gu');
{
  const p = await hitPoint('#drumBtn');
  for (let i = 0; i < 14; i++) { await page.mouse.click(p.x, p.y); await sleep(120); }
}
ok('辽戏 · 击鼓', await stampShown('stampGu'));

await goto('#shi');
for (const key of await keysOf('#shiTrack .era-node', 'era')) {
  await realClick(`#shiTrack .era-node[data-era="${key}"]`);
  await sleep(200);
  await realClick('#shiModalClose', { optional: true });
  await sleep(200);
}
ok('辽史 · 长河', await stampShown('stampShi'));

await goto('#ren');
for (const key of await keysOf('#renGrid .ren-card', 'ren')) {
  await realClick(`#renGrid .ren-card[data-ren="${key}"]`);
  await sleep(200);
  await realClick('#renModalClose', { optional: true });
  await sleep(200);
}
ok('辽脉 · 群英', await stampShown('stampRen'));

await goto('#yi');
for (const key of await keysOf('#yiGrid .craft', 'craft')) {
  await realClick(`#yiGrid .craft[data-craft="${key}"]`);
  await sleep(220);
}
ok('辽艺 · 百工', await stampShown('stampYi'));

await goto('#bao');
{
  const cells = await page.$$('#baoGrid .ore');
  for (const cell of cells) {
    const b = await cell.boundingBox();
    if (b) await scrub({ x: b.x, y: b.y, w: b.width, h: b.height }, 2);
    await sleep(500);
    await realClick('#baoModalClose', { optional: true });
    await sleep(250);
  }
}
ok('辽宝 · 矿珍', await stampShown('stampBao'));

await goto('#su');
await realClick('#suStart', { optional: true });
await sleep(200);
{
  const s = await boxOf('#suStage');
  const cx = s.x + s.w / 2, cy = s.y + s.h * 0.5;
  for (let i = 0; i < 50 && !(await stampShown('stampSu')); i++) {
    await page.mouse.click(cx, cy);
    await sleep(95);
  }
}
ok('辽俗 · 社火', await stampShown('stampSu'));

await goto('#yan');
{
  const YAN_ANS = [1, 1, 1, 1, 1, 1, 1, 0, 1];
  for (const ans of YAN_ANS) {
    await realClick(`#yanOpts .yan-opt:nth-of-type(${ans + 1})`, { optional: true });
    await sleep(260);
    await realClick('#yanNext', { optional: true });
    await sleep(260);
  }
}
ok('辽言 · 唠嗑', await stampShown('stampYan'));

await goto('#ta');
for (const key of await keysOf('#taGrid .ta-card', 'key')) {
  await realClick(`#taGrid .ta-card[data-key="${key}"]`);
  await sleep(200);
}
ok('辽塔 · 古建', await stampShown('stampTa'));

await goto('#tu');
for (const key of await keysOf('#tuGrid .city-chip', 'city')) {
  await realClick(`#tuGrid .city-chip[data-city="${key}"]`);
  await sleep(160);
  await realClick('#tuModalClose', { optional: true });
  await sleep(160);
}
ok('辽图 · 十四市', await stampShown('stampTu'));

await goto('#zi');
await scrub(await boxOf('#ziFrame'), 3);
await sleep(600);
ok('辽字 · 墨宝', await stampShown('stampZi'));

await goto('#xian');
for (const key of await keysOf('#xianGrid .xian-card', 'key')) {
  await realClick(`#xianGrid .xian-card[data-key="${key}"]`);
  await sleep(220);
}
ok('辽鲜 · 山珍', await stampShown('stampXian'));

await goto('#zhi');
await realClick('#zhiThemes .zhi-theme', { optional: true });
await sleep(200);
for (let i = 0; i < 3; i++) { await realClick('#zhiGen'); await sleep(1000); }
ok('辽智 · 智绘诗签', await stampShown('stampZhi'));

await goto('#xing');
{
  const n = await page.$$eval('#xingStars .xing-star', (els) => els.length);
  for (let i = 0; i < n; i++) { await realClick(`#xingStars .xing-star[data-i="${i}"]`); await sleep(110); }
}
await sleep(500);
ok('辽星 · 尾声', await stampShown('stampXing'));

/* ================= HUD 20/20 与终章明信片 ================= */
const hud = await page.$eval('#hudCount', (el) => el.textContent.trim()).catch(() => '');
const m = hud.match(/(\d+)\s*\/\s*(\d+)/);
ok('HUD 集齐 20/20', !!m && m[1] === m[2] && Number(m[2]) === 20, `(HUD="${hud}")`);

await goto('#final');
await sleep(2800);
const srcLen = await page.$eval('#postcardPreview', (el) => (el.src || '').length).catch(() => 0);
ok('终章 · 明信片合成', srcLen > 20000, `(dataURL ${Math.round(srcLen / 1024)}KB)`);
await page.screenshot({ path: 'shots/verify-final.png' });

const dataUrl = await page.$eval('#postcardPreview', (el) => el.src).catch(() => '');
if (dataUrl.startsWith('data:image')) {
  const { writeFileSync } = await import('fs');
  writeFileSync('shots/verify-postcard.jpg', Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('明信片导出 shots/verify-postcard.jpg');
}

if (consoleErrors.length) {
  console.log('\n控制台错误:');
  consoleErrors.forEach((e) => console.log('  ' + e));
} else {
  console.log('\n无控制台错误');
}

const failed = results.filter(([, p]) => !p).length;
console.log(`\n== 真实指针验证 ${results.length - failed}/${results.length} 项通过 ==`);
await browser.close();
process.exit(failed ? 1 : 0);
