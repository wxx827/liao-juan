// 辽韵 · 脸谱：点色开脸，为戏曲脸谱逐区上色，集齐即成谱（自注册章节）
import './lian.css';
import { registerChapter } from '../registry.js';
import { state, unlockSeal } from '../state.js';
import { pluck, pop, gong, success } from '../audio.js';

// 七个可点色分区：每区一种传统脸谱定性之色
export const REGIONS = [
  { id: 'forehead',  name: '额头', color: '#A6382E', d: 'M150,42 C206,44 235,90 236,152 L64,152 C65,90 94,44 150,42 Z' },
  { id: 'leftEye',   name: '左眼窝', color: '#F5EFE3', el: 'ellipse', cx: 113, cy: 178, rx: 33, ry: 24 },
  { id: 'rightEye',  name: '右眼窝', color: '#F5EFE3', el: 'ellipse', cx: 187, cy: 178, rx: 33, ry: 24 },
  { id: 'nose',      name: '鼻梁', color: '#C9A227', d: 'M140,150 L160,150 L167,292 L133,292 Z' },
  { id: 'leftCheek', name: '左脸颊', color: '#1B2F49', d: 'M64,152 L133,152 L133,300 C99,296 74,250 64,152 Z' },
  { id: 'rightCheek',name: '右脸颊', color: '#1B2F49', d: 'M236,152 L167,152 L167,300 C201,296 226,250 236,152 Z' },
  { id: 'chin',      name: '下巴', color: '#2E7D5B', d: 'M96,292 C120,330 150,346 150,346 C150,346 180,330 204,292 C168,312 132,312 96,292 Z' },
];

function regionSvg(r) {
  const common = `class="mask-region" data-region="${r.id}" data-color="${r.color}" role="button" tabindex="0" aria-label="${r.name}"`;
  if (r.el === 'ellipse') {
    return `<ellipse ${common} cx="${r.cx}" cy="${r.cy}" rx="${r.rx}" ry="${r.ry}"/>`;
  }
  return `<path ${common} d="${r.d}"/>`;
}

registerChapter({
  id: 'lian',
  order: 38,
  seal: { key: 'lian', label: '脸' },
  className: 'ch-lian',
  html: `
    <div class="ch-head">
      <span class="ch-no">脸</span>
      <div class="ch-name">
        <h2>辽韵 · 脸谱</h2>
        <p>轻点分区，为戏曲脸谱点色开脸</p>
      </div>
    </div>
    <div class="lian-stage">
      <svg class="lian-mask" id="lianMask" viewBox="0 0 300 388" xmlns="http://www.w3.org/2000/svg" aria-label="戏曲脸谱">
        <defs>
          <filter id="lianGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#C9A227" flood-opacity="0.9"/>
          </filter>
        </defs>
        <!-- 脸型底 -->
        <path class="mask-face" d="M150,35 C212,35 242,82 242,152 C242,244 210,326 150,352 C90,326 58,244 58,152 C58,82 88,35 150,35 Z"/>
        <!-- 可点色分区 -->
        <g class="mask-regions">
          ${REGIONS.map(regionSvg).join('\n          ')}
        </g>
        <!-- 固定装饰五官（不可点，浮于色块之上） -->
        <g class="mask-features" pointer-events="none">
          <!-- 眉 -->
          <path class="mf-brow" d="M84,150 C100,132 128,132 142,150 C126,144 100,144 84,150 Z"/>
          <path class="mf-brow" d="M216,150 C200,132 172,132 158,150 C174,144 200,144 216,150 Z"/>
          <!-- 眼 -->
          <path class="mf-eye" d="M92,180 C104,168 124,168 136,180 C124,190 104,190 92,180 Z"/>
          <path class="mf-eye" d="M208,180 C196,168 176,168 164,180 C176,190 196,190 208,180 Z"/>
          <circle class="mf-pupil" cx="114" cy="180" r="5"/>
          <circle class="mf-pupil" cx="186" cy="180" r="5"/>
          <!-- 鼻孔 -->
          <path class="mf-nose" d="M142,278 C146,286 154,286 158,278"/>
          <!-- 口 -->
          <path class="mf-mouth" d="M120,314 C138,326 162,326 180,314 C162,322 138,322 120,314 Z"/>
          <!-- 额心纹样 -->
          <path class="mf-motif" d="M150,58 L158,78 L150,98 L142,78 Z"/>
        </g>
      </svg>
      <div class="lian-progress"><span id="lianCount">0</span> / ${REGIONS.length}</div>
    </div>
    <p class="ch-note">脸谱以色定性：红表忠勇，黑蓝表刚直，金表神怪，白表奸诈，绿表勇烈。</p>
    <div class="stamp" id="stampLian">开脸<br/>成谱</div>
  `,
  init(section) {
    const svg = document.getElementById('lianMask');
    const countEl = document.getElementById('lianCount');
    const stampEl = document.getElementById('stampLian');
    if (!svg) return;

    const nodes = [...svg.querySelectorAll('.mask-region')];
    const colored = new Set();

    function updateCount() {
      if (countEl) countEl.textContent = String(colored.size);
    }

    function paint(node, silent) {
      const id = node.dataset.region;
      if (colored.has(id)) return;
      colored.add(id);
      node.style.fill = node.dataset.color;
      node.classList.add('colored');
      updateCount();
      if (!silent) (colored.size % 2 ? pop() : pluck());
      maybeComplete(silent);
    }

    function maybeComplete(silent) {
      if (colored.size < nodes.length) return;
      svg.classList.add('done');
      if (!state.seals.lian) {
        unlockSeal('lian');
        stampEl?.classList.add('show');
        if (!silent) { gong(); setTimeout(success, 450); }
      } else {
        stampEl?.classList.add('show');
      }
    }

    nodes.forEach((node) => {
      node.addEventListener('click', () => paint(node, false));
      node.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); paint(node, false); }
      });
    });

    // 已有存档：直接呈现完成态（全部上色 + 印章）
    if (state.seals.lian) {
      nodes.forEach((node) => paint(node, true));
    }
    updateCount();
  },
});
