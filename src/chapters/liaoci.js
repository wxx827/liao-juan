// 第五章 · 辽瓷：点釉 —— 轻点/涂抹让素坯绽出青花釉色
import { state, unlockSeal } from '../state.js';
import { chime, gong, success } from '../audio.js';

const DONE_RATIO = 0.5;

export function initLiaoci() {
  const frame = document.getElementById('vaseFrame');
  const canvas = document.getElementById('vaseCanvas');
  const img = document.getElementById('vaseImg');
  const bar = document.getElementById('vaseBar');
  const stampEl = document.getElementById('stampCi');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let done = false;
  let checks = 0;
  let lastChime = 0;

  function paintCover() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = frame.clientWidth * dpr;
    canvas.height = frame.clientHeight * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    // 素坯：把瓷瓶画上后覆一层米灰釉前色，显得黯淡未上釉
    if (img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(228,224,208,0.82)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // 提示字
    ctx.fillStyle = 'rgba(120,110,90,.6)';
    ctx.font = `900 ${Math.round(canvas.width / 8)}px "Noto Serif SC","SimSun",serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('釉', canvas.width / 2, canvas.height / 2);
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  }

  function bloom(x, y) {
    const rad = canvas.width / 4.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.65, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    const now = performance.now();
    if (now - lastChime > 120) { chime(); lastChime = now; }
  }

  function progress() {
    const step = 10;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0, total = 0;
    for (let i = 3; i < data.length; i += 4 * step) {
      total++;
      if (data[i] < 40) clear++;
    }
    const ratio = clear / total;
    bar.style.width = `${Math.min(100, Math.round((ratio / DONE_RATIO) * 100))}%`;
    if (ratio >= DONE_RATIO) complete();
  }

  function complete() {
    if (done) return;
    done = true;
    frame.classList.add('done');
    bar.style.width = '100%';
    unlockSeal('ci');
    stampEl.classList.add('show');
    gong();
    setTimeout(success, 480);
  }

  let drawing = false;
  frame.addEventListener('pointerdown', (e) => {
    if (done) return;
    drawing = true;
    frame.classList.add('touched');
    frame.setPointerCapture(e.pointerId);
    const p = pos(e);
    bloom(p.x, p.y);
    progress();
  });
  frame.addEventListener('pointermove', (e) => {
    if (!drawing || done) return;
    const p = pos(e);
    bloom(p.x, p.y);
    if (++checks % 6 === 0) progress();
  });
  const stop = () => { if (drawing) { drawing = false; if (!done) progress(); } };
  frame.addEventListener('pointerup', stop);
  frame.addEventListener('pointercancel', stop);

  if (state.seals.ci) {
    frame.classList.add('done', 'touched');
    bar.style.width = '100%';
    stampEl.classList.add('show');
    done = true;
    return;
  }
  if (img.complete) paintCover();
  else img.addEventListener('load', paintCover, { once: true });
  img.addEventListener('error', paintCover, { once: true });
}
