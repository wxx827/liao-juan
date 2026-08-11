// 辽星 · 尾声：深夜星空，轻点点亮繁星，连成星河，为关外之旅收束（自注册闭章）
import './xing.css';
import { registerChapter } from '../registry.js';
import { state, unlockSeal } from '../state.js';
import { pluck, pop, gong, success } from '../audio.js';

// 12 颗可点亮的星，坐标为百分比（左/上），大小微差以显层次
const STARS = [
  { x: 14, y: 22, r: 5 },
  { x: 27, y: 12, r: 4 },
  { x: 41, y: 26, r: 6 },
  { x: 55, y: 15, r: 4 },
  { x: 69, y: 24, r: 5 },
  { x: 83, y: 16, r: 4 },
  { x: 20, y: 44, r: 4 },
  { x: 36, y: 52, r: 6 },
  { x: 52, y: 43, r: 5 },
  { x: 66, y: 54, r: 4 },
  { x: 79, y: 46, r: 5 },
  { x: 46, y: 66, r: 6 },
];

registerChapter({
  id: 'xing',
  order: 42, // 位于所有章节之后、终章明信片（#final）之前
  seal: { key: 'xing', label: '星' },
  className: 'ch-xing',
  html: `
    <div class="ch-head">
      <span class="ch-no">星</span>
      <div class="ch-name">
        <h2>辽星 · 尾声</h2>
        <p>轻点夜空，点亮繁星，为这趟关外之旅收束</p>
      </div>
    </div>
    <div class="xing-stage" id="xingStage">
      <div class="xing-static" id="xingStatic" aria-hidden="true"></div>
      <svg class="xing-lines" id="xingLines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
      <div class="xing-stars" id="xingStars"></div>
      <div class="xing-hint" id="xingHint">已点亮 0 / ${STARS.length} 颗星</div>
    </div>
    <div class="xing-thanks" id="xingThanks" aria-hidden="true">
      <p class="xing-big">传承 · 智绘 · 融合</p>
      <p class="xing-line">关外风物，尽入此卷。</p>
      <p class="xing-dedication">谨以此卷，致敬辽宁的山河、人物与烟火。</p>
    </div>
    <div class="stamp" id="stampXing">星河<br/>为证</div>
  `,
  init(section) {
    const stage = document.getElementById('xingStage');
    const staticLayer = document.getElementById('xingStatic');
    const starsLayer = document.getElementById('xingStars');
    const linesSvg = document.getElementById('xingLines');
    const hintEl = document.getElementById('xingHint');
    const thanksEl = document.getElementById('xingThanks');
    const stampEl = document.getElementById('stampXing');
    if (!stage || !starsLayer) return;

    // 背景静态微星（纯装饰，不可点）
    if (staticLayer && !staticLayer.childElementCount) {
      let dots = '';
      for (let i = 0; i < 60; i++) {
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const s = (Math.random() * 1.6 + 0.6).toFixed(2);
        const o = (Math.random() * 0.5 + 0.15).toFixed(2);
        const d = (Math.random() * 4).toFixed(2);
        dots += `<i style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;width:${s}px;height:${s}px;opacity:${o};animation-delay:${d}s"></i>`;
      }
      staticLayer.innerHTML = dots;
    }

    // 可点亮的星
    const lit = new Set();
    starsLayer.innerHTML = '';
    const buttons = STARS.map((st, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'xing-star';
      b.dataset.i = String(i);
      b.style.left = st.x + '%';
      b.style.top = st.y + '%';
      b.style.setProperty('--r', st.r + 'px');
      b.setAttribute('aria-label', `点亮第 ${i + 1} 颗星`);
      starsLayer.appendChild(b);
      return b;
    });

    function drawLines() {
      const order = [...lit].sort((a, b) => a - b);
      let d = '';
      for (let k = 1; k < order.length; k++) {
        const a = STARS[order[k - 1]];
        const c = STARS[order[k]];
        d += `<line x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" />`;
      }
      linesSvg.innerHTML = d;
    }

    function refreshHint() {
      if (hintEl) hintEl.textContent = `已点亮 ${lit.size} / ${STARS.length} 颗星`;
    }

    function reveal() {
      thanksEl?.classList.add('show');
      if (hintEl) hintEl.classList.add('done');
    }

    function complete() {
      reveal();
      if (!state.seals.xing) {
        unlockSeal('xing');
        stampEl?.classList.add('show');
        gong();
        setTimeout(success, 450);
      }
    }

    function lightUp(i, silent) {
      if (lit.has(i)) return;
      lit.add(i);
      buttons[i].classList.add('lit');
      buttons[i].disabled = true;
      if (!silent) ((i % 2) ? pop : pluck)();
      drawLines();
      refreshHint();
      if (lit.size >= STARS.length) {
        if (silent) reveal();
        else setTimeout(complete, 260);
      }
    }

    buttons.forEach((b) => {
      b.addEventListener('click', () => lightUp(Number(b.dataset.i), false));
    });

    // 已有存档：直接呈现完成态（全部点亮 + 致谢 + 印章）
    if (state.seals.xing) {
      STARS.forEach((_, i) => lightUp(i, true));
      reveal();
      stampEl?.classList.add('show');
    } else {
      refreshHint();
    }
  },
});
