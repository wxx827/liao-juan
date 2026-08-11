// 辽字 · 墨宝：以指为笔，在宣纸上描红一个「辽」字（描红 / tracing）
import './zi.css';
import { registerChapter } from '../registry.js';
import { state, unlockSeal } from '../state.js';
import { snip, gong, success } from '../audio.js';

const TARGET = '辽';
const THRESHOLD = 0.6; // 覆盖到导引字面积的 60% 即成

registerChapter({
  id: 'zi',
  order: 36,
  seal: { key: 'zi', label: '字' },
  className: 'ch-zi',
  html: `
    <div class="ch-head">
      <span class="ch-no">字</span>
      <div class="ch-name">
        <h2>辽字 · 墨宝</h2>
        <p>以指为笔，在宣纸上描红一个「辽」字</p>
      </div>
    </div>
    <div class="zi-stage">
      <div class="zi-frame" id="ziFrame">
        <canvas id="ziGuide"></canvas>
        <canvas id="ziInk"></canvas>
        <span class="zi-hint" id="ziHint">蘸墨描红 · 把「辽」字写满</span>
      </div>
      <div class="paper-progress"><i id="ziBar"></i></div>
      <p class="zi-tip">拖动手指，沿灰色笔画反复涂写</p>
    </div>
    <div class="stamp" id="stampZi">墨成<br/>字立</div>
  `,
  init(section) {
    const frame = document.getElementById('ziFrame');
    const guide = document.getElementById('ziGuide');
    const ink = document.getElementById('ziInk');
    const bar = document.getElementById('ziBar');
    const hint = document.getElementById('ziHint');
    const stampEl = document.getElementById('stampZi');
    if (!frame || !guide || !ink) return;

    const gctx = guide.getContext('2d');
    const ictx = ink.getContext('2d', { willReadFrequently: true });

    // 离屏字形遮罩：用于统计"墨"落在字面积内的比例
    const mask = document.createElement('canvas');
    const mctx = mask.getContext('2d', { willReadFrequently: true });

    let done = false;
    let dpr = 1;
    let W = 0, H = 0;                 // 位图像素尺寸
    let maskIdx = [];                 // 字形非空像素（采样后）的像素下标（*4 后的 alpha 位）
    let strokes = 0;
    let lastSnip = 0;

    function fontFor(px) {
      return `900 ${px}px "Noto Serif SC", "SimSun", serif`;
    }

    // 尺寸 & 三层画布重建（含 DPR）
    function setup() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(frame.clientWidth * dpr));
      H = Math.max(1, Math.round(frame.clientHeight * dpr));
      guide.width = ink.width = mask.width = W;
      guide.height = ink.height = mask.height = H;

      const size = Math.round(Math.min(W, H) * 0.72);

      // 1) 导引层（浅灰双钩感）
      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.clearRect(0, 0, W, H);
      gctx.textAlign = 'center';
      gctx.textBaseline = 'middle';
      gctx.font = fontFor(size);
      // 浅灰描边 + 极淡填充，形成"双钩描红"引导
      gctx.lineWidth = Math.max(2, size * 0.012);
      gctx.strokeStyle = 'rgba(43,43,43,.28)';
      gctx.fillStyle = 'rgba(43,43,43,.08)';
      gctx.fillText(TARGET, W / 2, H / 2);
      gctx.strokeText(TARGET, W / 2, H / 2);

      // 2) 遮罩层（实心字形，只用于像素统计）
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.clearRect(0, 0, W, H);
      mctx.textAlign = 'center';
      mctx.textBaseline = 'middle';
      mctx.font = fontFor(size);
      mctx.fillStyle = '#000';
      mctx.fillText(TARGET, W / 2, H / 2);

      // 采样字形非空像素下标（每隔 step 采一个，取 alpha 通道位）
      const step = 6;
      const mdata = mctx.getImageData(0, 0, W, H).data;
      maskIdx = [];
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          const a = (y * W + x) * 4 + 3;
          if (mdata[a] > 40) maskIdx.push(a);
        }
      }

      ictx.setTransform(1, 0, 0, 1, 0, 0);
      ictx.lineCap = ictx.lineJoin = 'round';
    }

    function coverage() {
      if (!maskIdx.length) return 0;
      const idata = ictx.getImageData(0, 0, W, H).data;
      let hit = 0;
      for (let k = 0; k < maskIdx.length; k++) {
        if (idata[maskIdx[k]] > 40) hit++; // 该字形像素处已落墨
      }
      return hit / maskIdx.length;
    }

    function updateBar(ratio) {
      bar.style.width = `${Math.min(100, Math.round((ratio / THRESHOLD) * 100))}%`;
    }

    // 完成态：把「辽」字浓墨重绘为成品
    function renderFinished() {
      const size = Math.round(Math.min(W, H) * 0.72);
      ictx.setTransform(1, 0, 0, 1, 0, 0);
      ictx.clearRect(0, 0, W, H);
      ictx.globalCompositeOperation = 'source-over';
      ictx.textAlign = 'center';
      ictx.textBaseline = 'middle';
      ictx.font = fontFor(size);
      ictx.fillStyle = '#2B2B2B';
      ictx.fillText(TARGET, W / 2, H / 2);
      // 朱红点睛边
      ictx.lineWidth = Math.max(1.5, size * 0.008);
      ictx.strokeStyle = 'rgba(166,56,46,.65)';
      ictx.strokeText(TARGET, W / 2, H / 2);
      gctx.clearRect(0, 0, W, H); // 撤去灰色导引
    }

    function finish() {
      if (done) return;
      done = true;
      bar.style.width = '100%';
      frame.classList.add('done', 'touched');
      renderFinished();
      if (!state.seals.zi) {
        unlockSeal('zi');
        stampEl?.classList.add('show');
        gong();
        setTimeout(success, 500);
      }
    }

    function pos(e) {
      const r = ink.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (W / r.width),
        y: (e.clientY - r.top) * (H / r.height),
      };
    }

    let drawing = false;
    let last = null;

    frame.addEventListener('pointerdown', (e) => {
      if (done) return;
      drawing = true;
      frame.classList.add('touched');
      try { frame.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      last = pos(e);
      // 起笔点一笔
      ictx.globalCompositeOperation = 'source-over';
      ictx.fillStyle = '#2B2B2B';
      ictx.beginPath();
      ictx.arc(last.x, last.y, W / 22, 0, Math.PI * 2);
      ictx.fill();
    });

    frame.addEventListener('pointermove', (e) => {
      if (!drawing || done) return;
      const p = pos(e);
      ictx.globalCompositeOperation = 'source-over';
      ictx.strokeStyle = '#2B2B2B';
      ictx.lineCap = ictx.lineJoin = 'round';
      ictx.lineWidth = W / 11;
      ictx.beginPath();
      ictx.moveTo(last.x, last.y);
      ictx.lineTo(p.x, p.y);
      ictx.stroke();
      last = p;

      const now = performance.now();
      if (now - lastSnip > 90) { snip(); lastSnip = now; }
      if (++strokes % 8 === 0) {
        const ratio = coverage();
        updateBar(ratio);
        if (ratio >= THRESHOLD) finish();
      }
    });

    const stop = () => {
      if (!drawing) return;
      drawing = false;
      if (done) return;
      const ratio = coverage();
      updateBar(ratio);
      if (ratio >= THRESHOLD) finish();
    };
    frame.addEventListener('pointerup', stop);
    frame.addEventListener('pointercancel', stop);

    setup();
    window.addEventListener('resize', () => {
      if (done) { setup(); renderFinished(); bar.style.width = '100%'; }
    });

    // 已有存档：直接呈现成品并禁用输入
    if (state.seals.zi) {
      done = true;
      frame.classList.add('done', 'touched');
      bar.style.width = '100%';
      renderFinished();
      stampEl?.classList.add('show');
    }
  },
});
