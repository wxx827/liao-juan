// 辽鲜 · 山珍：点选关外山海时鲜收入食篓，集齐六味程序化山珍（自注册章节）
import './xian.css';
import { registerChapter } from '../registry.js';
import { state, unlockSeal, persist } from '../state.js';
import { pluck, pop, gong, success } from '../audio.js';

export const XIAN = [
  { key: 'nanguoli', name: '南果梨', city: '鞍山' },
  { key: 'caomei', name: '丹东草莓', city: '丹东' },
  { key: 'haishen', name: '大连海参', city: '大连' },
  { key: 'hexie', name: '盘锦河蟹', city: '盘锦' },
  { key: 'banli', name: '宽甸板栗', city: '丹东宽甸' },
  { key: 'linwa', name: '林蛙', city: '本溪' },
];

/* ---------- 程序化图标：每味山珍一张简笔 canvas，绘制后缓存 ---------- */
function makeCanvas() {
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = 88;
  c.width = size * dpr;
  c.height = size * dpr;
  c.className = 'xian-canvas';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  return { c, ctx, s: size };
}

const DRAWERS = {
  // 南果梨：金黄小梨
  nanguoli(ctx, s) {
    const cx = s / 2;
    ctx.strokeStyle = '#6b4a1f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, 20);
    ctx.lineTo(cx + 1, 34);
    ctx.stroke();
    ctx.fillStyle = '#7a9b3f';
    ctx.beginPath();
    ctx.ellipse(cx + 9, 22, 8, 4, -0.6, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(cx - 6, 44, 4, cx, 52, 26);
    g.addColorStop(0, '#F7DE8B');
    g.addColorStop(1, '#D9A62E');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, 40, 12, 0, Math.PI * 2);
    ctx.arc(cx, 56, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,80,20,.35)';
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(cx - 12 + Math.random() * 24, 46 + Math.random() * 18, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  // 丹东草莓：红果绿蒂
  caomei(ctx, s) {
    const cx = s / 2;
    const g = ctx.createLinearGradient(cx, 30, cx, 74);
    g.addColorStop(0, '#E4462F');
    g.addColorStop(1, '#B01B1B');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - 20, 36);
    ctx.quadraticCurveTo(cx, 30, cx + 20, 36);
    ctx.quadraticCurveTo(cx + 14, 72, cx, 74);
    ctx.quadraticCurveTo(cx - 14, 72, cx - 20, 36);
    ctx.fill();
    ctx.fillStyle = '#5a8a2e';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, 28);
      ctx.lineTo(cx + i * 8, 20);
      ctx.lineTo(cx + i * 8 + 4, 30);
      ctx.fill();
    }
    ctx.fillStyle = '#F7DE8B';
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(cx - 14 + Math.random() * 28, 40 + Math.random() * 30, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  // 大连海参：褐色带刺
  haishen(ctx, s) {
    const cx = s / 2;
    const cy = s / 2 + 2;
    const g = ctx.createLinearGradient(cx - 26, cy, cx + 26, cy);
    g.addColorStop(0, '#4a2f1a');
    g.addColorStop(0.5, '#7a4a24');
    g.addColorStop(1, '#3d2614');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 27, 12, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a5a2e';
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 7, cy - 12);
      ctx.lineTo(cx + i * 7 - 3, cy - 20);
      ctx.lineTo(cx + i * 7 + 3, cy - 20);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + i * 7, cy - 6);
      ctx.lineTo(cx + i * 7 - 2, cy - 13);
      ctx.lineTo(cx + i * 7 + 2, cy - 13);
      ctx.fill();
    }
  },
  // 盘锦河蟹：青壳大螯
  hexie(ctx, s) {
    const cx = s / 2;
    const cy = s / 2 + 4;
    ctx.strokeStyle = '#37506b';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i += 2) {
      for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 12, cy);
        ctx.quadraticCurveTo(cx + i * (26 + j * 4), cy - 6 + j * 10, cx + i * (30 + j * 3), cy + 6 + j * 10);
        ctx.stroke();
      }
    }
    const g = ctx.createRadialGradient(cx, cy - 4, 4, cx, cy, 20);
    g.addColorStop(0, '#5c7a4a');
    g.addColorStop(1, '#33502f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 17, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c94a2f';
    ctx.lineWidth = 5;
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 15, cy - 4);
      ctx.lineTo(cx + i * 28, cy - 14);
      ctx.stroke();
      ctx.fillStyle = '#c94a2f';
      ctx.beginPath();
      ctx.arc(cx + i * 29, cy - 15, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  // 宽甸板栗：褐色栗子
  banli(ctx, s) {
    const cx = s / 2;
    const cy = s / 2 + 6;
    const g = ctx.createRadialGradient(cx - 6, cy - 6, 4, cx, cy, 26);
    g.addColorStop(0, '#a5713a');
    g.addColorStop(1, '#5a3717');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy + 12);
    ctx.quadraticCurveTo(cx - 22, cy - 22, cx, cy - 22);
    ctx.quadraticCurveTo(cx + 22, cy - 22, cx + 22, cy + 12);
    ctx.quadraticCurveTo(cx, cy + 20, cx - 22, cy + 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(245,222,139,.5)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 12, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245,222,139,.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy - 22, 3, 0, Math.PI * 2);
    ctx.stroke();
  },
  // 本溪林蛙
  linwa(ctx, s) {
    const cx = s / 2;
    const cy = s / 2 + 4;
    const g = ctx.createLinearGradient(cx, cy - 16, cx, cy + 16);
    g.addColorStop(0, '#7d9b46');
    g.addColorStop(1, '#4f6b28');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, 20, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - 9, cy - 12, 8, 8, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 9, cy - 12, 8, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f3ecd8';
    ctx.beginPath();
    ctx.arc(cx - 9, cy - 13, 4, 0, Math.PI * 2);
    ctx.arc(cx + 9, cy - 13, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.arc(cx - 9, cy - 12, 2, 0, Math.PI * 2);
    ctx.arc(cx + 9, cy - 12, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3d5420';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy + 14);
    ctx.lineTo(cx - 26, cy + 20);
    ctx.moveTo(cx + 18, cy + 14);
    ctx.lineTo(cx + 26, cy + 20);
    ctx.stroke();
  },
};

registerChapter({
  id: 'xian',
  order: 40,
  seal: { key: 'xian', label: '鲜' },
  state: { collectedXian: [] },
  className: 'ch-xian',
  html: `
    <div class="ch-head">
      <span class="ch-no">鲜</span>
      <div class="ch-name">
        <h2>辽鲜 · 山珍</h2>
        <p>点选关外山海时鲜，收入你的食篓</p>
      </div>
    </div>
    <div class="xian-grid" id="xianGrid"></div>
    <div class="xian-tray" id="xianTray">
      <span class="tray-label">食篓</span>
      <span class="tray-slots" id="xianSlots"></span>
      <span class="tray-count"><b id="xianCount">0</b> / 6</span>
    </div>
    <div class="stamp" id="stampXian">山海<br/>入篓</div>
  `,
  init(section) {
    const grid = document.getElementById('xianGrid');
    const slotsWrap = document.getElementById('xianSlots');
    const countEl = document.getElementById('xianCount');
    const stampEl = document.getElementById('stampXian');
    if (!grid) return;

    grid.innerHTML = '';
    slotsWrap.innerHTML = '';
    const cards = {};
    const slots = {};

    XIAN.forEach((item, i) => {
      const card = document.createElement('button');
      card.className = 'xian-card';
      card.dataset.key = item.key;
      card.style.setProperty('--i', i);

      const tile = document.createElement('span');
      tile.className = 'xian-tile';
      const { c, ctx, s } = makeCanvas();
      DRAWERS[item.key]?.(ctx, s);
      tile.appendChild(c);

      const info = document.createElement('span');
      info.className = 'xian-info';
      info.innerHTML = `<b class="xian-name">${item.name}</b><em class="xian-city">${item.city}</em>`;

      const badge = document.createElement('span');
      badge.className = 'xian-badge';
      badge.textContent = '已入篓';

      card.append(tile, info, badge);
      grid.appendChild(card);
      cards[item.key] = card;

      const slot = document.createElement('span');
      slot.className = 'tray-slot';
      slot.dataset.key = item.key;
      slotsWrap.appendChild(slot);
      slots[item.key] = slot;
    });

    function refreshCount() {
      countEl.textContent = String(state.collectedXian.length);
    }

    function markGot(key, instant = false) {
      cards[key]?.classList.add('got');
      const slot = slots[key];
      if (slot) {
        slot.classList.add('filled');
        if (instant) slot.style.animation = 'none';
      }
    }

    function maybeComplete() {
      if (state.collectedXian.length >= XIAN.length && !state.seals.xian) {
        unlockSeal('xian');
        stampEl?.classList.add('show');
        gong();
        setTimeout(success, 450);
      }
    }

    function collect(key) {
      if (state.collectedXian.includes(key)) return;
      state.collectedXian.push(key);
      persist();
      pop();
      markGot(key);
      refreshCount();
      maybeComplete();
    }

    Object.entries(cards).forEach(([key, card]) => {
      card.addEventListener('click', () => {
        if (state.collectedXian.includes(key)) { pluck(); return; }
        collect(key);
      });
    });

    // 恢复存档
    state.collectedXian.forEach((key) => markGot(key, true));
    refreshCount();
    if (state.seals.xian) stampEl?.classList.add('show');
  },
});
