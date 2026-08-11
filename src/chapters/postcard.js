// 终章：Canvas 合成专属国潮明信片（1080 x 1920）
import { state, reset, SEALS } from '../state.js';
import { pluck, success } from '../audio.js';
import { SCENES } from './liaojing.js';
import { FOODS } from './liaowei.js';

const W = 1080, H = 1920;
const FONT = '"Noto Serif SC", "SimSun", serif';
const RED = '#A6382E', RED_DEEP = '#7E2A22', GOLD = '#C9A227',
      PAPER = '#F5EFE3', INK = '#2B2B2B', INDIGO = '#1B2F49';

function loadImage(src) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

function drawVerticalText(ctx, text, x, y, size, gap, style) {
  ctx.save();
  Object.assign(ctx, style);
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  [...text].forEach((ch, i) => ctx.fillText(ch, x, y + i * (size + gap)));
  ctx.restore();
}

function drawSpacedText(ctx, text, cx, y, size, spacing, color, weight = 700) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const chars = [...text];
  const total = chars.length * size + (chars.length - 1) * spacing;
  let x = cx - total / 2 + size / 2;
  chars.forEach((ch) => { ctx.fillText(ch, x, y); x += size + spacing; });
  ctx.restore();
}

export async function buildPostcard() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  try { await document.fonts.ready; } catch { /* 字体未就绪时用回退字体 */ }

  // —— 宣纸底 ——
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(126,42,34,0.08)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  // 纸纹
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2 + Math.random() * 10);
  }
  ctx.globalAlpha = 1;

  // —— 边框 ——
  ctx.strokeStyle = RED;
  ctx.lineWidth = 10;
  ctx.strokeRect(42, 42, W - 84, H - 84);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(66, 66, W - 132, H - 132);
  // 四角回纹意象
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 5;
  const c = 96, L = 64;
  [[c, c, 1, 1], [W - c, c, -1, 1], [c, H - c, 1, -1], [W - c, H - c, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(x + L * sx, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + L * sy);
    ctx.moveTo(x + L * 0.55 * sx, y + 22 * sy);
    ctx.lineTo(x + 22 * sx, y + 22 * sy);
    ctx.lineTo(x + 22 * sx, y + L * 0.55 * sy);
    ctx.stroke();
  });

  // —— 竖排大标题 ——
  drawVerticalText(ctx, '辽卷', 190, 160, 150, 36, { fillStyle: RED });
  ctx.fillStyle = GOLD;
  ctx.fillRect(272, 176, 6, 460);
  drawVerticalText(ctx, '指尖上的辽宁', 330, 190, 46, 22, { fillStyle: INK });

  // —— 红印章 ——
  ctx.save();
  ctx.translate(W - 210, 210);
  ctx.rotate(-0.06);
  ctx.fillStyle = RED;
  ctx.fillRect(-72, -72, 144, 144);
  ctx.strokeStyle = 'rgba(245,239,227,.85)';
  ctx.lineWidth = 4;
  ctx.strokeRect(-58, -58, 116, 116);
  ctx.fillStyle = PAPER;
  ctx.font = `900 56px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('游', 0, -28);
  ctx.fillText('印', 0, 30);
  ctx.restore();

  // —— 主题句 ——
  drawSpacedText(ctx, '传承·智绘·融合', W / 2, 700, 46, 14, INDIGO, 700);

  // —— 中央剪纸圆窗 ——
  const cy = 1010, r = 250;
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, cy, r + 16, 0, Math.PI * 2);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, cy, r + 2, 0, Math.PI * 2);
  ctx.strokeStyle = RED;
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, cy, r - 6, 0, Math.PI * 2);
  ctx.clip();
  const snap = state.papercutSnapshot ? await loadImage(state.papercutSnapshot) : null;
  if (snap) {
    ctx.drawImage(snap, W / 2 - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = RED_DEEP;
    ctx.fillRect(W / 2 - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(245,239,227,.9)';
    ctx.font = `900 110px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('辽', W / 2, cy - 62);
    ctx.fillText('风', W / 2, cy + 62);
  }
  ctx.restore();

  // —— 印章墙（数据驱动，多行自适应数量：印章多时自动排成 2~3 行） ——
  const n = SEALS.length;
  const rows = Math.ceil(n / 10);                 // 每行至多约 10 枚
  const perRow = Math.ceil(n / rows);
  const rad = rows > 1 ? 36 : Math.min(58, (W - 200) / n / 2 - 12);
  const gap = Math.min(rows > 1 ? 92 : 170, (W - 160) / perRow);
  const rowGap = rad * 2 + 18;
  const firstRowY = 1420 - ((rows - 1) * rowGap) / 2;
  SEALS.forEach(({ key, label }, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const countInRow = Math.min(perRow, n - row * perRow);
    const rowStartX = W / 2 - (gap * (countInRow - 1)) / 2;
    const x = rowStartX + col * gap;
    const y = firstRowY + row * rowGap;
    const lit = state.seals[key];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.07);
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    if (lit) {
      ctx.fillStyle = RED;
      ctx.fill();
      ctx.strokeStyle = RED_DEEP;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = PAPER;
    } else {
      ctx.setLineDash([8, 7]);
      ctx.strokeStyle = 'rgba(43,43,43,.35)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(43,43,43,.3)';
    }
    ctx.font = `900 ${Math.round(rad * 0.88)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 2);
    ctx.restore();
  });

  const printBottom = firstRowY + (rows - 1) * rowGap + rad;

  // —— 游历与寻味小结（位置随印墙高度自适应） ——
  const short = { honghaitan: '红海滩', shuidong: '水洞', duanqiao: '断桥', binhai: '滨海' };
  const sceneLine = state.visitedScenes.length
    ? state.visitedScenes.map((k) => short[k] || SCENES[k]?.title || k).join(' · ')
    : '山河待游';
  const foodLine = state.collectedFoods.length
    ? state.collectedFoods.map((k) => FOODS[k]?.name || k).join(' · ')
    : '佳肴待寻';
  const sumY1 = printBottom + 58;
  const sumY2 = sumY1 + 60;
  ctx.font = `700 36px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(`游历 ｜ ${sceneLine}`, W / 2, sumY1);
  ctx.fillText(`寻味 ｜ ${foodLine}`, W / 2, sumY2);

  // —— 落款 ——
  drawSpacedText(ctx, '关外风物 尽入此卷', W / 2, sumY2 + 90, 44, 18, RED_DEEP, 900);
  const today = new Date();
  ctx.font = `500 30px ${FONT}`;
  ctx.fillStyle = 'rgba(43,43,43,.55)';
  ctx.fillText(
    `丙午年 · ${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')} · 辽卷同游`,
    W / 2, sumY2 + 168,
  );

  return canvas;
}

export function initPostcard() {
  const preview = document.getElementById('postcardPreview');
  const btnSave = document.getElementById('btnSave');
  const btnReset = document.getElementById('btnReset');
  const section = document.getElementById('final');

  let rendering = false;
  async function render() {
    if (rendering) return;
    rendering = true;
    try {
      const canvas = await buildPostcard();
      preview.src = canvas.toDataURL('image/jpeg', 0.9);
    } finally {
      rendering = false;
    }
  }

  // 滑到终章时重新合成（带上最新进度）
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) render(); });
  }, { threshold: 0.4 });
  io.observe(section);

  btnSave.addEventListener('click', async () => {
    pluck();
    const canvas = await buildPostcard();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '辽卷·明信片.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      success();
    }, 'image/jpeg', 0.95);
  });

  btnReset.addEventListener('click', () => {
    reset();
    location.reload();
  });

  render();
}
