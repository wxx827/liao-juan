import './styles/main.css';
import { load, state, bus, SEALS, allSealsLit, litCount } from './state.js';
import { warmup } from './audio.js';
import { goldBurst, confetti, createAmbient } from './fx.js';
import { initLiaofeng } from './chapters/liaofeng.js';
import { initLiaojing } from './chapters/liaojing.js';
import { initLiaoyun } from './chapters/liaoyun.js';
import { initLiaowei } from './chapters/liaowei.js';
import { initLiaoci } from './chapters/liaoci.js';
import { initLiaobing } from './chapters/liaobing.js';
import { initLiaoxi } from './chapters/liaoxi.js';
import { initPostcard } from './chapters/postcard.js';
import { chapters } from './registry.js';
import { initAssistant } from './assistant.js';

/* ---- 自注册章节：eager glob 在此处触发所有 *.chapter.js 的顶层 registerChapter ----
   注意：静态 import 会在模块体执行前完成求值，故 load() 时印章/字段均已就绪。 */
import.meta.glob('./chapters/*.chapter.js', { eager: true });

load();

/* ---- 插入自注册章节的 section（按 order 排序，插到 #final 之前） ---- */
const scrollEl = document.getElementById('scroll');
const finalSection = document.getElementById('final');
[...chapters].sort((a, b) => a.order - b.order).forEach((ch) => {
  if (document.getElementById(ch.id)) return; // 幂等，避免重复插入
  const sec = document.createElement('section');
  sec.className = `chapter ${ch.className || ''}`.trim();
  sec.id = ch.id;
  sec.innerHTML = ch.html;
  scrollEl.insertBefore(sec, finalSection);
});

/* ---- 首屏加载遮罩 + 关键图预加载 ---- */
const loaderEl = document.getElementById('loader');
const loaderBar = document.getElementById('loaderBar');
const KEY_IMAGES = [
  'assets/img/intro-bg.jpg',
  'assets/img/papercut.jpg',
  'assets/img/panorama.jpg',
  'assets/img/puppet.png',
  'assets/img/scene-honghaitan.jpg',
  'assets/img/scene-shuidong.jpg',
  'assets/img/scene-duanqiao.jpg',
  'assets/img/scene-binhai.jpg',
  'assets/img/food-jiaozi.jpg',
  'assets/img/food-xunji.jpg',
  'assets/img/food-guobaorou.jpg',
  'assets/img/food-haixian.jpg',
];

function preload() {
  let done = 0;
  const total = KEY_IMAGES.length;
  return Promise.all(KEY_IMAGES.map((src) => new Promise((res) => {
    const im = new Image();
    const finish = () => {
      done++;
      if (loaderBar) loaderBar.style.width = `${Math.round((done / total) * 100)}%`;
      res();
    };
    im.onload = finish;
    im.onerror = finish;
    im.src = src;
  })));
}

const startedAt = performance.now();
preload().finally(() => {
  const wait = Math.max(0, 900 - (performance.now() - startedAt)); // 至少展示 0.9s
  setTimeout(() => loaderEl?.classList.add('hide'), wait);
});

/* ---- 精简 HUD：已集 N / 总 印 药丸 + 细进度条 ---- */
const hudCount = document.getElementById('hudCount');
const hudBar = document.getElementById('hudBar');
function refreshHud() {
  const lit = litCount();
  const total = SEALS.length;
  if (hudCount) hudCount.textContent = `${lit} / ${total}`;
  if (hudBar) hudBar.style.width = `${total ? Math.round((lit / total) * 100) : 0}%`;
}
bus.addEventListener('seal', refreshHud);
bus.addEventListener('reset', refreshHud);
refreshHud();

/* ---- 移动端音频解锁 ---- */
window.addEventListener('pointerdown', warmup, { once: true });

/* ---- 各章初始化 ---- */
initLiaofeng();
initLiaojing();
initLiaoyun();
initLiaowei();
initLiaoci();
initLiaobing();
initLiaoxi();
// 自注册章节：逐个 init（传入其 section 元素）
chapters.forEach((ch) => {
  try {
    const sec = document.getElementById(ch.id);
    if (sec && typeof ch.init === 'function') ch.init(sec);
  } catch (err) {
    console.error(`章节 ${ch.id} 初始化失败`, err);
  }
});
initPostcard();

/* ---- 卷灵 · AI 智游助手浮层（全局，仅引入一次） ---- */
initAssistant();

/* ---- 环境粒子 ---- */
createAmbient(document.getElementById('intro'), {
  type: 'petal', count: 18,
  colors: ['#E3C567', '#C9A227', '#A6382E', '#F5EFE3'],
  size: [7, 15], speed: 1,
});
createAmbient(document.getElementById('shadowStage'), {
  type: 'dust', count: 28,
  colors: ['#FFE0A8', '#FFD98A', '#E8B36B'],
  size: [4, 10], speed: 0.7,
});

/* ---- 章节进入淡入 ---- */
const chapterIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => e.target.classList.toggle('in-view', e.isIntersecting));
}, { threshold: 0.28 });
document.querySelectorAll('.chapter').forEach((c) => chapterIO.observe(c));

/* ---- 完成庆祝：每完成一枚印章金箔飞溅；集齐所有印礼花 ---- */
const finalBanner = document.getElementById('finalBanner');
let celebrated = false;

function allDone() {
  return allSealsLit();
}
function celebrate() {
  if (celebrated) return;
  if (finalBanner) finalBanner.hidden = false;
  if (loaderEl && !loaderEl.classList.contains('hide')) {
    setTimeout(celebrate, 300);
    return;
  }
  celebrated = true;
  confetti(180);
  setTimeout(() => confetti(120), 700);
}

bus.addEventListener('seal', () => {
  goldBurst(innerWidth / 2, innerHeight * 0.55, 50);
  if (allDone()) setTimeout(celebrate, 400);
});

const finalIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting && allDone()) celebrate();
  });
}, { threshold: 0.5 });
finalIO.observe(finalSection);

if (allDone() && finalBanner) finalBanner.hidden = false;

/* ---- 支持 #<id> 直达章节 ---- */
if (location.hash) {
  const target = document.querySelector(location.hash);
  if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: 'instant' }));
}
