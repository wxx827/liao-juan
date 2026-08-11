// 抓取"全部完成"状态下的终章礼花彩蛋画面
import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE_URL || 'http://localhost:5199/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--window-size=800,950', '--hide-scrollbars'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
// 在文档加载前就注入完成状态，确保 main.js 的 load() 能读到
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('liaojuan-v1', JSON.stringify({
    seals: { feng: true, jing: true, yun: true, wei: true, ci: true, bing: true, gu: true },
    visitedScenes: ['honghaitan', 'shuidong', 'duanqiao', 'binhai'],
    collectedFoods: ['jiaozi', 'xunji', 'guobaorou', 'haixian'],
  }));
});
await page.goto(BASE + '#final', { waitUntil: 'networkidle0' });
// 等 loader 隐藏
await page.waitForFunction(() => document.getElementById('loader')?.classList.contains('hide'), { timeout: 5000 }).catch(() => {});
await sleep(300);
const info = await page.evaluate(() => {
  const ov = document.getElementById('fx-overlay');
  return { overlay: !!ov, banner: !document.getElementById('finalBanner')?.hidden };
});
console.log('overlay=', info.overlay, 'banner=', info.banner);
await page.screenshot({ path: 'shots/fx-final-confetti.png' });
console.log('saved shots/fx-final-confetti.png');
await browser.close();
