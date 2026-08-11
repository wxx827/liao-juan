// 第六章 · 辽冰：踏雪寻梅 —— 点住飘落的雪花，集齐十二片
import { state, unlockSeal, persist } from '../state.js';
import { pop, gong, success } from '../audio.js';

const NEED = 12;

export function initLiaobing() {
  const stage = document.getElementById('snowCatch');
  const numEl = document.getElementById('snowNum');
  const stampEl = document.getElementById('stampBing');

  // 用收集到的雪花数量做进度；存档只记 seal，恢复时若已完成直接显示
  let caught = state.seals.bing ? NEED : 0;
  let spawnTimer = null;
  let running = false;
  const flakes = new Set();

  numEl.textContent = caught;
  if (state.seals.bing) stampEl.classList.add('show');

  function updateNum() { numEl.textContent = Math.min(caught, NEED); }

  function complete() {
    if (state.seals.bing) return;
    unlockSeal('bing');
    stampEl.classList.add('show');
    gong();
    setTimeout(success, 420);
    stop();
    // 清场
    flakes.forEach((f) => f.remove());
    flakes.clear();
  }

  function catchFlake(flake) {
    if (!flakes.has(flake)) return;
    flakes.delete(flake);
    flake.classList.add('caught');
    pop();
    caught++;
    updateNum();
    setTimeout(() => flake.remove(), 260);
    if (caught >= NEED) complete();
  }

  function spawn() {
    if (state.seals.bing) return;
    const flake = document.createElement('button');
    flake.className = 'flake';
    flake.textContent = Math.random() > 0.5 ? '❄' : '❅';
    const size = 20 + Math.random() * 22;
    const dur = 4200 + Math.random() * 2600;
    flake.style.left = `${5 + Math.random() * 90}%`;
    flake.style.fontSize = `${size}px`;
    flake.style.setProperty('--sway', `${(Math.random() * 40 - 20)}px`);
    flake.style.animationDuration = `${dur}ms`;
    flake.addEventListener('pointerdown', (e) => { e.preventDefault(); catchFlake(flake); });
    flake.addEventListener('animationend', () => { flakes.delete(flake); flake.remove(); });
    stage.appendChild(flake);
    flakes.add(flake);
  }

  function start() {
    if (running || state.seals.bing) return;
    running = true;
    spawnTimer = setInterval(spawn, 620);
    for (let i = 0; i < 3; i++) setTimeout(spawn, i * 200);
  }
  function stop() {
    running = false;
    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = null;
  }

  const io = new IntersectionObserver((es) => {
    es.forEach((e) => (e.isIntersecting ? start() : stop()));
  }, { threshold: 0.3 });
  io.observe(document.getElementById('bing'));
}
