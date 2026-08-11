import puppeteer from 'puppeteer-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5199/';
const ids = ['shi', 'ren', 'yi', 'bao', 'su', 'yan', 'ta', 'tu', 'zi', 'lian', 'xian', 'xing'];
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--hide-scrollbars'],
  defaultViewport: { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
for (const id of ids) {
  await page.evaluate((h) => document.querySelector('#' + h)?.scrollIntoView({ behavior: 'instant' }), id);
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: `shots/chapter-${id}.png` });
  console.log('shot', id);
}
await browser.close();
