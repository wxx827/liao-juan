// 辽塔 · 古建：点亮五座辽宁密檐砖塔，塔影皆由 canvas 程序化绘制（自注册）
import './ta.css';
import { registerChapter } from '../registry.js';
import { state, unlockSeal, persist } from '../state.js';
import { pluck, pop, gong, success } from '../audio.js';

export const PAGODAS = [
  {
    key: 'baita', name: '辽阳白塔', city: '辽阳',
    oneLine: '现存最高的砖筑佛塔之一，十三级密檐，通体涂白，巍然千年。',
    tiers: 13, spread: 0.90, taper: 0.052, stone: '#EDE6D6', shade: '#CBBFA4',
  },
  {
    key: 'beita', name: '朝阳北塔', city: '朝阳',
    oneLine: '“五世同堂”一塔见证三燕至辽金，塔宫曾出土佛舍利。',
    tiers: 11, spread: 0.82, taper: 0.058, stone: '#D9B98A', shade: '#B08A57',
  },
  {
    key: 'guangji', name: '广济寺塔', city: '锦州',
    oneLine: '辽代砖塔，八角十三级，檐角风铎叮咚，古城地标。',
    tiers: 13, spread: 0.80, taper: 0.050, stone: '#D2A96F', shade: '#A97E45',
  },
  {
    key: 'shuangta', name: '崇兴寺双塔', city: '北镇',
    oneLine: '辽代一东一西两塔并峙，比肩而立，秀美端庄。',
    tiers: 12, spread: 0.86, taper: 0.055, stone: '#E0C79B', shade: '#B99A63',
    twin: true,
  },
  {
    key: 'wugou', name: '无垢净光舍利塔', city: '沈阳',
    oneLine: '辽代密檐砖塔，塔身佛龛庄严，塔铃迎风。',
    tiers: 11, spread: 0.78, taper: 0.060, stone: '#CBA976', shade: '#A07C4A',
  },
];

const TOTAL = PAGODAS.length;
const drawCache = {};

// 程序化绘制一座多层密檐砖塔（暖石色，靛青夜空背景）
function drawPagoda(p) {
  if (drawCache[p.key]) return drawCache[p.key];
  const W = 260, H = 340, dpr = 2;
  const cv = document.createElement('canvas');
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);

  // 夜空
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#12233a');
  sky.addColorStop(1, '#22344d');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // 月
  g.fillStyle = 'rgba(227,197,103,.28)';
  g.beginPath(); g.arc(W - 46, 52, 26, 0, Math.PI * 2); g.fill();

  const drawOne = (cx) => {
    const baseY = H - 34;
    const baseW = W * 0.30 * p.spread;

    // 台基
    g.fillStyle = p.shade;
    g.fillRect(cx - baseW * 1.15, baseY, baseW * 2.3, 22);
    g.fillStyle = p.stone;
    g.fillRect(cx - baseW * 0.95, baseY - 16, baseW * 1.9, 18);

    // 塔身：自下而上逐层收分
    let y = baseY - 16;
    let bodyW = baseW * 1.05;
    const tierH = (baseY - 78) / p.tiers;
    for (let t = 0; t < p.tiers; t++) {
      const w = bodyW * (1 - p.taper * t);
      const top = y - tierH;
      // 塔身砖体
      g.fillStyle = t % 2 === 0 ? p.stone : p.shade;
      g.fillRect(cx - w / 2, top, w, tierH);
      // 首层佛龛
      if (t === 0) {
        g.fillStyle = 'rgba(27,47,73,.55)';
        const nw = w * 0.24, nh = tierH * 0.6;
        g.fillRect(cx - nw / 2, top + tierH * 0.3, nw, nh);
      }
      // 密檐（外挑）
      const eaveW = w * 1.34;
      g.fillStyle = '#7E2A22';
      g.beginPath();
      g.moveTo(cx - eaveW / 2, top);
      g.lineTo(cx + eaveW / 2, top);
      g.lineTo(cx + w / 2, top - tierH * 0.42);
      g.lineTo(cx - w / 2, top - tierH * 0.42);
      g.closePath();
      g.fill();
      // 檐口鎏金线
      g.strokeStyle = 'rgba(201,162,39,.85)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(cx - eaveW / 2, top);
      g.lineTo(cx + eaveW / 2, top);
      g.stroke();
      y = top - tierH * 0.42;
    }

    // 宝顶（塔刹）
    const topW = bodyW * (1 - p.taper * (p.tiers - 1));
    g.fillStyle = p.stone;
    g.beginPath();
    g.moveTo(cx - topW * 0.34, y);
    g.lineTo(cx + topW * 0.34, y);
    g.lineTo(cx, y - 20);
    g.closePath();
    g.fill();
    g.fillStyle = '#C9A227';
    g.fillRect(cx - 2, y - 42, 4, 24);
    g.beginPath(); g.arc(cx, y - 46, 5, 0, Math.PI * 2); g.fill();
  };

  if (p.twin) { drawOne(W * 0.34); drawOne(W * 0.66); }
  else drawOne(W * 0.5);

  const url = cv.toDataURL();
  drawCache[p.key] = url;
  return url;
}

registerChapter({
  id: 'ta',
  order: 32,
  seal: { key: 'ta', label: '塔' },
  state: { seenTa: [] },
  className: 'ch-ta',
  html: `
    <div class="ch-head">
      <span class="ch-no">塔</span>
      <div class="ch-name">
        <h2>辽塔 · 古建</h2>
        <p>轻点每座密檐砖塔，将千年塔影收入长卷</p>
      </div>
    </div>
    <div class="ta-stage">
      <div class="ta-hint" id="taHint">已点亮 0 / ${TOTAL} 座辽塔</div>
      <div class="ta-grid" id="taGrid"></div>
    </div>
    <div class="stamp" id="stampTa">古塔<br/>入卷</div>
  `,
  init() {
    const grid = document.getElementById('taGrid');
    const hint = document.getElementById('taHint');
    const stampEl = document.getElementById('stampTa');
    if (!grid) return;

    grid.innerHTML = '';
    PAGODAS.forEach((p) => {
      const card = document.createElement('button');
      card.className = 'ta-card';
      card.dataset.key = p.key;
      card.innerHTML = `
        <span class="ta-canvas"><img alt="${p.name}" src="${drawPagoda(p)}" /></span>
        <span class="ta-meta">
          <b class="ta-title">${p.name}</b>
          <em class="ta-city">${p.city}</em>
        </span>
        <span class="ta-desc">${p.oneLine}</span>
        <span class="ta-check">✓</span>`;
      grid.appendChild(card);
    });
    const cards = [...grid.querySelectorAll('.ta-card')];

    function updateHint() {
      hint.textContent = `已点亮 ${state.seenTa.length} / ${TOTAL} 座辽塔`;
    }
    function refresh() {
      cards.forEach((c) => c.classList.toggle('lit', state.seenTa.includes(c.dataset.key)));
      updateHint();
    }
    function maybeComplete() {
      if (state.seenTa.length >= TOTAL && !state.seals.ta) {
        unlockSeal('ta');
        stampEl?.classList.add('show');
        gong();
        setTimeout(success, 450);
      }
    }
    function light(key, card) {
      const already = state.seenTa.includes(key);
      card.classList.add('lit', 'open');
      if (!already) {
        state.seenTa.push(key);
        persist();
        pop();
        updateHint();
        maybeComplete();
      } else {
        pluck();
      }
    }

    cards.forEach((c) => c.addEventListener('click', () => light(c.dataset.key, c)));

    refresh();
    if (state.seals.ta) stampEl?.classList.add('show');
  },
});
