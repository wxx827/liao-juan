// 第一章 · 辽风：指尖剪纸 —— 刮开红纸，剪出满族窗花
import { state, unlockSeal } from '../state.js';
import { snip, gong, success } from '../audio.js';

const DONE_RATIO = 0.55; // 剪开比例达到即完成

export function initLiaofeng() {
  const frame = document.getElementById('paperFrame');
  const canvas = document.getElementById('paperCanvas');
  const img = document.getElementById('papercutImg');
  const bar = document.getElementById('paperBar');
  const stampEl = document.getElementById('stampFeng');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let done = false;
  let strokes = 0;
  let lastSnip = 0;

  function paintCover() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = frame.clientWidth * dpr;
    canvas.height = frame.clientHeight * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    // 红纸底
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, '#B23A2C');
    g.addColorStop(0.5, '#A5352A');
    g.addColorStop(1, '#8E2C22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 纸纹肌理
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 240; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2 + Math.random() * 14);
    }
    ctx.globalAlpha = 1;

    // 窗花残影提示（引导下剪位置）
    if (img.complete && img.naturalWidth) {
      ctx.globalAlpha = 0.16;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }

    // 中央提示字
    ctx.fillStyle = 'rgba(245,239,227,.8)';
    ctx.font = `900 ${Math.round(canvas.width / 9)}px "Noto Serif SC", "SimSun", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('剪', canvas.width / 2, canvas.height / 2);
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  }

  function checkProgress() {
    const step = 10;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0, total = 0;
    for (let i = 3; i < data.length; i += 4 * step) {
      total++;
      if (data[i] === 0) clear++;
    }
    const ratio = clear / total;
    bar.style.width = `${Math.min(100, Math.round((ratio / DONE_RATIO) * 100))}%`;
    if (ratio >= DONE_RATIO) complete();
  }

  function snapshot() {
    if (!img.complete || !img.naturalWidth) return;
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 600;
      const cc = c.getContext('2d');
      cc.drawImage(img, 0, 0, 600, 600);
      state.papercutSnapshot = c.toDataURL('image/jpeg', 0.88);
    } catch { /* 图片跨域时跳过快照 */ }
  }

  function complete() {
    if (done) return;
    done = true;
    frame.classList.add('done');
    bar.style.width = '100%';
    snapshot();
    unlockSeal('feng');
    stampEl.classList.add('show');
    gong();
    setTimeout(success, 500);
  }

  let drawing = false;
  let last = null;

  frame.addEventListener('pointerdown', (e) => {
    if (done) return;
    drawing = true;
    frame.classList.add('touched');
    frame.setPointerCapture(e.pointerId);
    last = pos(e);
  });

  frame.addEventListener('pointermove', (e) => {
    if (!drawing || done) return;
    const p = pos(e);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.lineWidth = canvas.width / 9;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;

    const now = performance.now();
    if (now - lastSnip > 90) { snip(); lastSnip = now; }
    if (++strokes % 14 === 0) checkProgress();
  });

  const stop = () => {
    if (!drawing) return;
    drawing = false;
    if (!done) checkProgress();
  };
  frame.addEventListener('pointerup', stop);
  frame.addEventListener('pointercancel', stop);

  // 已有存档：直接呈现成品
  if (state.seals.feng) {
    frame.classList.add('done', 'touched');
    bar.style.width = '100%';
    stampEl.classList.add('show');
    done = true;
    if (img.complete) snapshot(); else img.addEventListener('load', snapshot, { once: true });
    return;
  }

  if (img.complete) paintCover();
  else img.addEventListener('load', paintCover, { once: true });
  // 图片加载失败也要能玩
  img.addEventListener('error', paintCover, { once: true });
}
