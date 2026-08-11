// 端到端交互冒烟测试：核心 7 章针对性测试 + 全部自注册章节遍历断言印章点亮
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
const dispatchClick = (sel) => page.$eval(sel, (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))).catch(() => {});
const keysOf = (sel, attr) => page.$$eval(sel, (els, a) => els.map((e) => e.dataset[a]), attr);

// 在给定盒子上做密集来回涂抹（用于 canvas 刮开/描红类交互）
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

/* ============ 核心 7 章：针对性测试 ============ */

/* ---------- 辽风 · 剪纸 ---------- */
await goto('#feng');
await scrub(await boxOf('#paperFrame'), 2);
await sleep(900);
ok('辽风 · 剪纸完成印章', await stampShown('stampFeng'));
await page.screenshot({ path: 'shots/e2e-feng-done.png' });

/* ---------- 辽景 · 四景 ---------- */
await goto('#jing');
for (const scene of ['honghaitan', 'shuidong', 'duanqiao', 'binhai']) {
  await page.evaluate((s) => document.querySelector(`.pin[data-scene="${s}"]`)?.click(), scene);
  await sleep(500);
  await page.click('#modalClose').catch(() => {});
  await sleep(300);
}
ok('辽景 · 四景完成印章', await stampShown('stampJing'));

/* ---------- 辽韵 · 皮影 ---------- */
await goto('#yun');
{
  const s = await boxOf('#shadowStage');
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(cx, cy); await page.mouse.down();
    for (let step = 0; step <= 10; step++) { await page.mouse.move(cx + Math.sin(step / 10 * Math.PI * 2) * 90, cy); await sleep(16); }
    await page.mouse.up(); await sleep(250);
  }
  for (let i = 0; i < 2; i++) { await page.mouse.click(cx, cy, { delay: 30 }); await sleep(1000); }
}
ok('辽韵 · 皮影完成印章', await stampShown('stampYun'));

/* ---------- 辽味 · 四宝 ---------- */
await goto('#wei');
for (const food of ['jiaozi', 'xunji', 'guobaorou', 'haixian']) {
  await page.evaluate((k) => document.querySelector(`.food[data-food="${k}"]`)?.click(), food);
  await sleep(900);
}
ok('辽味 · 四宝完成印章', await stampShown('stampWei'));

/* ---------- 辽瓷 · 点釉 ---------- */
await goto('#ci');
await scrub(await boxOf('#vaseFrame'), 2);
await sleep(900);
ok('辽瓷 · 点釉完成印章', await stampShown('stampCi'));

/* ---------- 辽冰 · 接雪花 ---------- */
await goto('#bing');
for (let i = 0; i < 40 && !(await stampShown('stampBing')); i++) {
  const flakes = await page.$$('#snowCatch .flake');
  for (const f of flakes) { try { await f.click({ delay: 5 }); } catch { /* 已飘走 */ } }
  await sleep(200);
}
ok('辽冰 · 接雪花完成印章', await stampShown('stampBing'));

/* ---------- 辽戏 · 击鼓 ---------- */
await goto('#gu');
{
  const d = await boxOf('#drumBtn');
  for (let i = 0; i < 14; i++) { await page.mouse.click(d.x + d.w / 2, d.y + d.h / 2); await sleep(120); }
}
ok('辽戏 · 击鼓完成印章', await stampShown('stampGu'));

/* ============ 自注册新章：遍历触发并断言 ============ */

/* ---------- 辽史 · 长河（点亮六里程碑） ---------- */
await goto('#shi');
for (const key of await keysOf('#shiTrack .era-node', 'era')) {
  await dispatchClick(`#shiTrack .era-node[data-era="${key}"]`);
  await sleep(120);
  await dispatchClick('#shiModalClose');
  await sleep(120);
}
ok('辽史 · 长河完成印章', await stampShown('stampShi'));

/* ---------- 辽脉 · 群英 ---------- */
await goto('#ren');
for (const key of await keysOf('#renGrid .ren-card', 'ren')) {
  await dispatchClick(`#renGrid .ren-card[data-ren="${key}"]`);
  await sleep(100);
  await dispatchClick('#renModalClose');
  await sleep(100);
}
ok('辽脉 · 群英完成印章', await stampShown('stampRen'));

/* ---------- 辽艺 · 百工（翻牌） ---------- */
await goto('#yi');
for (const key of await keysOf('#yiGrid .craft', 'craft')) {
  await dispatchClick(`#yiGrid .craft[data-craft="${key}"]`);
  await sleep(160);
}
ok('辽艺 · 百工完成印章', await stampShown('stampYi'));

/* ---------- 辽宝 · 矿珍（刮开岩层） ---------- */
await goto('#bao');
{
  const cells = await page.$$('#baoGrid .ore');
  for (const cell of cells) {
    const box = await cell.boundingBox();
    if (box) await scrub({ x: box.x, y: box.y, w: box.width, h: box.height }, 2);
    await sleep(500);
    await dispatchClick('#baoModalClose');
    await sleep(200);
  }
}
ok('辽宝 · 矿珍完成印章', await stampShown('stampBao'));

/* ---------- 辽俗 · 社火（秧歌打拍，尽力触发） ---------- */
await goto('#su');
await dispatchClick('#suStart');
await sleep(120);
{
  const s = await boxOf('#suStage');
  const cx = s.x + s.w / 2, cy = s.y + s.h * 0.5;
  for (let i = 0; i < 44 && !(await stampShown('stampSu')); i++) {
    await page.mouse.click(cx, cy);
    await sleep(95);
  }
}
ok('辽俗 · 社火完成印章', await stampShown('stampSu'));

/* ---------- 辽言 · 唠嗑（方言问答，按正确答案逐题作答） ---------- */
await goto('#yan');
const YAN_ANS = [1, 1, 1, 1, 1, 1, 1, 0, 1]; // 对应 QUIZ 各题正解下标
for (let i = 0; i < YAN_ANS.length; i++) {
  await page.evaluate((ans) => {
    const opts = [...document.querySelectorAll('#yanOpts .yan-opt')];
    if (opts[ans] && !opts[ans].disabled) opts[ans].click();
  }, YAN_ANS[i]);
  await sleep(180);
  await dispatchClick('#yanNext'); // 下一唠 / 看结果
  await sleep(180);
}
ok('辽言 · 唠嗑完成印章', await stampShown('stampYan'));

/* ---------- 辽塔 · 古建 ---------- */
await goto('#ta');
for (const key of await keysOf('#taGrid .ta-card', 'key')) {
  await dispatchClick(`#taGrid .ta-card[data-key="${key}"]`);
  await sleep(120);
}
ok('辽塔 · 古建完成印章', await stampShown('stampTa'));

/* ---------- 辽图 · 十四市 ---------- */
await goto('#tu');
for (const key of await keysOf('#tuGrid .city-chip', 'city')) {
  await dispatchClick(`#tuGrid .city-chip[data-city="${key}"]`);
  await sleep(80);
  await dispatchClick('#tuModalClose');
  await sleep(80);
}
ok('辽图 · 十四市完成印章', await stampShown('stampTu'));

/* ---------- 辽字 · 墨宝（描红） ---------- */
await goto('#zi');
await scrub(await boxOf('#ziFrame'), 3);
await sleep(600);
ok('辽字 · 墨宝完成印章', await stampShown('stampZi'));

/* ---------- 辽韵 · 脸谱（分区点色） ---------- */
await goto('#lian');
for (const r of await keysOf('#lianMask .mask-region', 'region')) {
  await dispatchClick(`#lianMask .mask-region[data-region="${r}"]`);
  await sleep(90);
}
ok('辽韵 · 脸谱完成印章', await stampShown('stampLian'));

/* ---------- 辽鲜 · 山珍 ---------- */
await goto('#xian');
for (const key of await keysOf('#xianGrid .xian-card', 'key')) {
  await dispatchClick(`#xianGrid .xian-card[data-key="${key}"]`);
  await sleep(120);
}
ok('辽鲜 · 山珍完成印章', await stampShown('stampXian'));

/* ---------- 辽智 · 智绘诗签（生成 3 次） ---------- */
await goto('#zhi');
await dispatchClick('#zhiThemes .zhi-theme');
await sleep(150);
for (let i = 0; i < 3; i++) {
  await dispatchClick('#zhiGen');
  await sleep(900); // 覆盖“智绘生成中”约 620ms 的节奏
}
ok('辽智 · 智绘诗签完成印章', await stampShown('stampZhi'));
await page.screenshot({ path: 'shots/chapter-zhi.png' });

/* ---------- 卷灵 · 智游助手浮层 ---------- */
await dispatchClick('#jlFab');
await sleep(400);
const panelOpen = await page.$eval('#jlPanel', (el) => !el.hidden).catch(() => false);
ok('卷灵助手 · 浮层展开', panelOpen);
await dispatchClick('#jlChips .jl-chip'); // 触发一条快捷问答
await sleep(400);
const botReplied = await page.$$eval('#jlMsgs .jl-msg.bot', (els) => els.length > 0).catch(() => false);
ok('卷灵助手 · 规则引擎应答', botReplied);
await page.screenshot({ path: 'shots/assistant-open.png' });
await dispatchClick('#jlClose');
await sleep(200);

/* ---------- 辽星 · 尾声（点亮繁星） ---------- */
await goto('#xing');
{
  const stars = await page.$$('#xingStars .xing-star');
  for (const st of stars) { await st.evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))); await sleep(80); }
}
await sleep(400);
ok('辽星 · 尾声完成印章', await stampShown('stampXing'));

/* ============ 终章 · 明信片 ============ */
await goto('#final');
await sleep(2500);
const srcLen = await page.$eval('#postcardPreview', (el) => (el.src || '').length).catch(() => 0);
ok('终章 · 明信片已合成', srcLen > 20000, `(dataURL ${Math.round(srcLen / 1024)}KB)`);
await page.screenshot({ path: 'shots/e2e-final.png' });

const dataUrl = await page.$eval('#postcardPreview', (el) => el.src).catch(() => '');
if (dataUrl.startsWith('data:image')) {
  const b64 = dataUrl.split(',')[1];
  const { writeFileSync } = await import('fs');
  writeFileSync('shots/e2e-postcard.jpg', Buffer.from(b64, 'base64'));
  console.log('明信片导出 shots/e2e-postcard.jpg');
}

/* ---------- HUD 进度显示 ---------- */
const hud = await page.$eval('#hudCount', (el) => el.textContent).catch(() => '');
console.log('HUD 进度:', hud);
ok('HUD 进度条更新', /\d+\s*\/\s*\d+/.test(hud));

/* ---------- 存档恢复 ---------- */
await page.reload({ waitUntil: 'networkidle0' });
await sleep(1500);
const restored = await stampShown('stampFeng');
ok('刷新后存档恢复（辽风印仍在）', restored);

if (consoleErrors.length) {
  console.log('\n控制台错误:');
  consoleErrors.forEach((e) => console.log('  ' + e));
} else {
  console.log('\n无控制台错误');
}

const failed = results.filter(([, p]) => !p).length;
console.log(`\n== ${results.length - failed}/${results.length} 项通过 ==`);
await browser.close();
process.exit(failed ? 1 : 0);
