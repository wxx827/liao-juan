// 程序化国潮矢量美术引擎：全部 canvas 绘制，零图片依赖
// 输出 dataURL，直接喂给 <img> 或 background-image，保证画面在无素材时依旧完整。

export const PALETTE = {
  red: '#A6382E',
  redDeep: '#7E2A22',
  redSoft: '#C24E3E',
  gold: '#C9A227',
  goldSoft: '#E3C567',
  paper: '#F5EFE3',
  paperDark: '#EAE0CB',
  ink: '#2B2B2B',
  indigo: '#1B2F49',
  indigoDeep: '#121F33',
  indigoSoft: '#33507A',
};

// —— 确定性随机（同一 seed 出同一图案）——
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function make(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return { c, ctx: c.getContext('2d') };
}

function paperTexture(ctx, w, h, alpha = 0.04) {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < (w * h) / 900; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2 + Math.random() * 10);
  }
  ctx.restore();
}

// 祥云（如意云头）
function cloud(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 20, Math.PI * 0.1, Math.PI * 1.9);
  ctx.arc(26, -4, 15, Math.PI * 0.9, Math.PI * 2.1, true);
  ctx.arc(48, 2, 12, Math.PI * 1.0, Math.PI * 2.2, true);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

// 层叠远山
function mountainLayer(ctx, w, baseY, height, color, jag = 5, rand = Math.random) {
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  const seg = w / jag;
  for (let i = 0; i <= jag; i++) {
    const x = i * seg;
    const peak = baseY - height * (0.45 + rand() * 0.55);
    ctx.lineTo(x - seg * 0.5, baseY - height * 0.15);
    ctx.lineTo(x, peak);
  }
  ctx.lineTo(w, baseY);
  ctx.lineTo(w, baseY + 400);
  ctx.lineTo(0, baseY + 400);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// 海浪（工笔波纹）
function waves(ctx, x, y, w, rows, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let r = 0; r < rows; r++) {
    ctx.beginPath();
    for (let i = 0; i < w; i += 26) {
      ctx.moveTo(x + i, y + r * 14);
      ctx.arc(x + i + 13, y + r * 14, 13, Math.PI, Math.PI * 2, false);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ================= 序章水墨背景 =================
export function introBg(w = 1080, h = 1920) {
  const { c, ctx } = make(w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0E1828');
  sky.addColorStop(0.45, '#1B2F49');
  sky.addColorStop(1, '#2A2320');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // 明月
  const mx = w * 0.72, my = h * 0.2, mr = w * 0.16;
  const mg = ctx.createRadialGradient(mx, my, mr * 0.2, mx, my, mr);
  mg.addColorStop(0, 'rgba(245,239,227,.95)');
  mg.addColorStop(0.7, 'rgba(227,197,103,.5)');
  mg.addColorStop(1, 'rgba(227,197,103,0)');
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();

  // 星点
  const r = rng(77);
  ctx.fillStyle = 'rgba(245,239,227,.6)';
  for (let i = 0; i < 90; i++) {
    const x = r() * w, y = r() * h * 0.55, s = r() * 2 + 0.5;
    ctx.globalAlpha = 0.3 + r() * 0.6;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;

  // 祥云
  cloud(ctx, w * 0.16, h * 0.16, 2.2, 'rgba(201,162,39,.22)');
  cloud(ctx, w * 0.5, h * 0.3, 1.6, 'rgba(201,162,39,.16)');

  // 远近山峦
  const rm = rng(21);
  mountainLayer(ctx, w, h * 0.72, h * 0.16, 'rgba(27,47,73,.9)', 4, rm);
  mountainLayer(ctx, w, h * 0.82, h * 0.2, 'rgba(18,31,51,.95)', 5, rm);
  mountainLayer(ctx, w, h * 0.95, h * 0.22, '#0C1522', 6, rm);

  // 水墨晕染
  const ink = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, h * 0.5);
  ink.addColorStop(0, 'rgba(0,0,0,0)');
  ink.addColorStop(1, 'rgba(10,16,26,.5)');
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, w, h);

  return c.toDataURL('image/jpeg', 0.86);
}

// ================= 满族窗花剪纸（镜像对称） =================
export function papercut(size = 600, seed = 7) {
  const { c, ctx } = make(size, size);
  const r = rng(seed);
  const cx = size / 2, cy = size / 2;
  ctx.translate(cx, cy);

  const petals = 6 + Math.floor(r() * 3); // 6~8 瓣旋转对称
  const layers = 3 + Math.floor(r() * 2);
  ctx.fillStyle = PALETTE.red;

  const drawUnit = () => {
    for (let l = 0; l < layers; l++) {
      const rr = size * (0.12 + l * 0.11);
      const pw = size * (0.03 + r() * 0.04);
      ctx.beginPath();
      ctx.moveTo(0, -rr * 0.4);
      ctx.quadraticCurveTo(pw, -rr * 0.75, 0, -rr);
      ctx.quadraticCurveTo(-pw, -rr * 0.75, 0, -rr * 0.4);
      ctx.fill();
      // 镂空小孔
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(0, -rr * 0.72, size * 0.014, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // 叶片
    ctx.beginPath();
    ctx.ellipse(size * 0.09, -size * 0.16, size * 0.05, size * 0.02, -0.6, 0, Math.PI * 2);
    ctx.fill();
  };

  for (let p = 0; p < petals; p++) {
    ctx.save();
    ctx.rotate((Math.PI * 2 * p) / petals);
    drawUnit();
    ctx.restore();
  }

  // 中心团花
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.028, 0, Math.PI * 2);
  ctx.fill();

  // 外圈连珠
  for (let i = 0; i < 24; i++) {
    ctx.save();
    ctx.rotate((Math.PI * 2 * i) / 24);
    ctx.beginPath();
    ctx.arc(0, -size * 0.46, size * 0.012, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return c.toDataURL('image/png');
}

// ================= 辽宁山河长卷（横向） =================
export function panorama(w = 1800, h = 520) {
  const { c, ctx } = make(w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#24405F');
  sky.addColorStop(0.6, '#3A5A7D');
  sky.addColorStop(1, '#C9A98A');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // 落日
  const sx = w * 0.12, sy = h * 0.32, sr = h * 0.14;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
  sg.addColorStop(0, 'rgba(245,239,227,.95)');
  sg.addColorStop(1, 'rgba(201,162,39,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();

  const rm = rng(99);
  mountainLayer(ctx, w, h * 0.62, h * 0.28, 'rgba(27,47,73,.55)', 10, rm);
  mountainLayer(ctx, w, h * 0.72, h * 0.32, 'rgba(27,47,73,.78)', 12, rm);

  // 红海滩（左段）
  ctx.fillStyle = 'rgba(166,56,46,.85)';
  ctx.fillRect(0, h * 0.8, w * 0.28, h * 0.2);
  waves(ctx, 0, h * 0.82, w * 0.28, 3, 'rgba(245,239,227,.4)');

  // 城市天际线（中段，象征沈阳）
  ctx.fillStyle = 'rgba(18,31,51,.9)';
  const bx = w * 0.42;
  for (let i = 0; i < 8; i++) {
    const bw = 26 + rm() * 22, bh = 60 + rm() * 150;
    ctx.fillRect(bx + i * 40, h * 0.78 - bh, bw, bh + h * 0.22);
  }

  // 海与灯塔（右段，象征大连）
  ctx.fillStyle = 'rgba(27,47,73,.9)';
  ctx.fillRect(w * 0.72, h * 0.82, w * 0.28, h * 0.18);
  waves(ctx, w * 0.72, h * 0.84, w * 0.28, 3, 'rgba(245,239,227,.35)');
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(w * 0.9, h * 0.5, 12, h * 0.34);
  ctx.fillStyle = PALETTE.red;
  ctx.fillRect(w * 0.9, h * 0.5, 12, 16);
  ctx.beginPath();
  ctx.arc(w * 0.9 + 6, h * 0.5, 14, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(227,197,103,.7)';
  ctx.fill();

  // 前景芦苇
  ctx.strokeStyle = 'rgba(43,43,43,.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i < w; i += 34) {
    const gh = 40 + Math.random() * 70;
    ctx.beginPath();
    ctx.moveTo(i, h);
    ctx.quadraticCurveTo(i + 6, h - gh * 0.6, i + 2, h - gh);
    ctx.stroke();
  }

  return c.toDataURL('image/jpeg', 0.85);
}

// ================= 单景插画（弹窗用） =================
export function sceneImg(key, w = 720, h = 960) {
  const { c, ctx } = make(w, h);
  const conf = SCENE_ART[key] || SCENE_ART._default;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, conf.sky[0]);
  sky.addColorStop(1, conf.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  conf.draw(ctx, w, h);
  // 暗角
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(10,16,26,.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.85);
}

const SCENE_ART = {
  honghaitan: {
    sky: ['#2A4160', '#E7C9A0'],
    draw(ctx, w, h) {
      const sx = w * 0.7, sy = h * 0.3, sr = h * 0.1;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3);
      g.addColorStop(0, 'rgba(255,240,210,.95)'); g.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, sr * 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#B23A2C'; ctx.fillRect(0, h * 0.55, w, h * 0.45);
      ctx.fillStyle = '#8E2C22';
      for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * w, h * 0.55 + Math.random() * h * 0.45, 6, 12);
      waves(ctx, 0, h * 0.58, w, 4, 'rgba(245,239,227,.35)');
    },
  },
  shuidong: {
    sky: ['#0B1D2E', '#12314A'],
    draw(ctx, w, h) {
      ctx.fillStyle = '#0A1622'; ctx.fillRect(0, 0, w, h);
      // 钟乳石
      ctx.fillStyle = '#33507A';
      for (let i = 0; i < 10; i++) {
        const x = (i / 10) * w + 20;
        ctx.beginPath(); ctx.moveTo(x - 24, 0); ctx.lineTo(x + 24, 0); ctx.lineTo(x, 120 + Math.random() * 160); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 20, h); ctx.lineTo(x + 20, h); ctx.lineTo(x, h - 80 - Math.random() * 120); ctx.fill();
      }
      // 地下河 + 舟
      ctx.fillStyle = 'rgba(51,80,122,.7)'; ctx.fillRect(0, h * 0.7, w, h * 0.3);
      ctx.fillStyle = PALETTE.gold; ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.78, 60, 16, 0, 0, 7); ctx.fill();
    },
  },
  duanqiao: {
    sky: ['#33507A', '#C9A98A'],
    draw(ctx, w, h) {
      ctx.fillStyle = 'rgba(27,47,73,.6)'; ctx.fillRect(0, h * 0.68, w, h * 0.32);
      // 桁架桥
      ctx.strokeStyle = '#2B2B2B'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(0, h * 0.68); ctx.lineTo(w * 0.62, h * 0.68); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const x = i * (w * 0.62 / 5);
        ctx.beginPath();
        ctx.moveTo(x, h * 0.68); ctx.quadraticCurveTo(x + w * 0.06, h * 0.5, x + w * 0.124, h * 0.68);
        ctx.stroke();
      }
      // 断裂
      ctx.fillStyle = PALETTE.red; ctx.fillRect(w * 0.6, h * 0.64, 10, 40);
    },
  },
  binhai: {
    sky: ['#1B2F49', '#E3C567'],
    draw(ctx, w, h) {
      ctx.fillStyle = 'rgba(27,47,73,.85)'; ctx.fillRect(0, h * 0.6, w, h * 0.4);
      waves(ctx, 0, h * 0.62, w, 5, 'rgba(245,239,227,.4)');
      ctx.fillStyle = PALETTE.paper; ctx.fillRect(w * 0.18, h * 0.3, 16, h * 0.32);
      ctx.fillStyle = PALETTE.red; ctx.fillRect(w * 0.18, h * 0.3, 16, 20);
      const g = ctx.createRadialGradient(w * 0.19, h * 0.3, 0, w * 0.19, h * 0.3, 40);
      g.addColorStop(0, 'rgba(227,197,103,.9)'); g.addColorStop(1, 'rgba(227,197,103,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w * 0.19, h * 0.3, 40, 0, 7); ctx.fill();
    },
  },
  gugong: {
    sky: ['#2A4160', '#B98A6A'],
    draw(ctx, w, h) {
      ctx.fillStyle = '#7E2A22'; ctx.fillRect(w * 0.2, h * 0.5, w * 0.6, h * 0.35);
      // 屋顶
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath(); ctx.moveTo(w * 0.14, h * 0.5); ctx.lineTo(w * 0.5, h * 0.32); ctx.lineTo(w * 0.86, h * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8C6D1E';
      ctx.beginPath(); ctx.moveTo(w * 0.14, h * 0.5); ctx.quadraticCurveTo(w * 0.5, h * 0.44, w * 0.86, h * 0.5); ctx.lineTo(w * 0.86, h * 0.52); ctx.quadraticCurveTo(w * 0.5, h * 0.46, w * 0.14, h * 0.52); ctx.fill();
      // 立柱
      ctx.fillStyle = '#5E1F18';
      for (let i = 0; i < 4; i++) ctx.fillRect(w * 0.26 + i * w * 0.16, h * 0.52, 12, h * 0.32);
    },
  },
  qianshan: {
    sky: ['#3A5A7D', '#CBB89A'],
    draw(ctx, w, h) {
      const rm = rng(5);
      mountainLayer(ctx, w, h * 0.55, h * 0.3, 'rgba(27,47,73,.4)', 6, rm);
      mountainLayer(ctx, w, h * 0.7, h * 0.36, 'rgba(27,47,73,.7)', 8, rm);
      mountainLayer(ctx, w, h * 0.85, h * 0.4, '#1B2F49', 10, rm);
      cloud(ctx, w * 0.3, h * 0.4, 2, 'rgba(245,239,227,.5)');
      cloud(ctx, w * 0.66, h * 0.5, 1.6, 'rgba(245,239,227,.4)');
    },
  },
  niaohuashi: {
    sky: ['#243B2E', '#C9B98A'],
    draw(ctx, w, h) {
      ctx.fillStyle = '#5B4A2E'; ctx.fillRect(0, h * 0.4, w, h * 0.6);
      for (let l = 0; l < 6; l++) {
        ctx.strokeStyle = `rgba(43,43,43,${0.15 + l * 0.08})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, h * 0.42 + l * h * 0.09);
        for (let x = 0; x <= w; x += 40) ctx.lineTo(x, h * 0.42 + l * h * 0.09 + Math.sin(x / 60 + l) * 6);
        ctx.stroke();
      }
      // 化石鸟骨意象
      ctx.strokeStyle = PALETTE.paper; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(w * 0.4, h * 0.55); ctx.quadraticCurveTo(w * 0.5, h * 0.4, w * 0.62, h * 0.5);
      ctx.quadraticCurveTo(w * 0.7, h * 0.58, w * 0.5, h * 0.62); ctx.stroke();
    },
  },
  xingcheng: {
    sky: ['#2A4160', '#C9A98A'],
    draw(ctx, w, h) {
      // 古城墙
      ctx.fillStyle = '#6E4A38'; ctx.fillRect(0, h * 0.6, w, h * 0.4);
      ctx.fillStyle = '#5A3B2C';
      for (let i = 0; i < w; i += 60) ctx.fillRect(i, h * 0.56, 40, 30);
      // 城楼
      ctx.fillStyle = '#7E2A22'; ctx.fillRect(w * 0.38, h * 0.4, w * 0.24, h * 0.2);
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath(); ctx.moveTo(w * 0.34, h * 0.4); ctx.lineTo(w * 0.5, h * 0.28); ctx.lineTo(w * 0.66, h * 0.4); ctx.closePath(); ctx.fill();
    },
  },
  _default: {
    sky: ['#2A4160', '#C9A98A'],
    draw(ctx, w, h) {
      const rm = rng(3);
      mountainLayer(ctx, w, h * 0.7, h * 0.3, 'rgba(27,47,73,.7)', 7, rm);
    },
  },
};

// ================= 皮影人 =================
export function puppet(w = 500, h = 720) {
  const { c, ctx } = make(w, h);
  ctx.translate(w / 2, h * 0.1);
  ctx.fillStyle = '#3A140C';
  ctx.strokeStyle = 'rgba(255,210,140,.35)';
  ctx.lineWidth = 2;

  const cut = (fn) => { ctx.save(); fn(); ctx.restore(); };

  // 头（侧脸 + 高冠）
  cut(() => {
    ctx.beginPath();
    ctx.arc(0, 60, 52, Math.PI * 0.6, Math.PI * 2.1);
    ctx.lineTo(30, 40);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  });
  // 冠帽
  cut(() => {
    ctx.beginPath();
    ctx.moveTo(-46, 30); ctx.quadraticCurveTo(-20, -40, 40, 8);
    ctx.quadraticCurveTo(10, 20, -46, 30); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.arc(-6, 6, 8, 0, 7); ctx.fill();
  });
  // 镂空眼
  cut(() => {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.ellipse(6, 56, 8, 4, 0, 0, 7); ctx.fill();
  });
  // 身躯（袍）
  cut(() => {
    ctx.beginPath();
    ctx.moveTo(-40, 120);
    ctx.quadraticCurveTo(-70, 320, -50, 470);
    ctx.lineTo(60, 470);
    ctx.quadraticCurveTo(70, 300, 40, 120);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  });
  // 袍上镂空花纹
  cut(() => {
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.arc(-10 + (i % 2) * 24, 180 + i * 55, 9, 0, 7); ctx.fill();
    }
  });
  // 手臂（可摆动的关节意象）
  cut(() => {
    ctx.beginPath();
    ctx.moveTo(40, 150); ctx.quadraticCurveTo(120, 200, 150, 300);
    ctx.lineTo(132, 312); ctx.quadraticCurveTo(100, 220, 30, 175);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  });
  return c.toDataURL('image/png');
}

// ================= 美食徽记 =================
export function foodImg(key, size = 400) {
  const { c, ctx } = make(size, size);
  const g = ctx.createRadialGradient(size / 2, size * 0.4, size * 0.1, size / 2, size / 2, size * 0.7);
  g.addColorStop(0, '#F3E4CC'); g.addColorStop(1, '#D8C39C');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const s = size / 400;
  ctx.save(); ctx.scale(s, s);
  (FOOD_ART[key] || FOOD_ART._default)(ctx);
  ctx.restore();
  paperTexture(ctx, size, size, 0.03);
  return c.toDataURL('image/jpeg', 0.85);
}

const plate = (ctx) => {
  ctx.fillStyle = '#EFE7D6'; ctx.beginPath(); ctx.ellipse(200, 240, 150, 90, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = PALETTE.indigo; ctx.lineWidth = 6; ctx.stroke();
  ctx.strokeStyle = 'rgba(27,47,73,.4)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(200, 240, 120, 70, 0, 0, 7); ctx.stroke();
};

const FOOD_ART = {
  jiaozi(ctx) {
    plate(ctx);
    ctx.fillStyle = '#EAD9B0'; ctx.strokeStyle = '#B89A5E'; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const x = 120 + (i % 2) * 90, y = 210 + Math.floor(i / 2) * 55;
      ctx.beginPath(); ctx.ellipse(x, y, 44, 26, 0.1, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); for (let k = 0; k <= 6; k++) { ctx.moveTo(x - 40 + k * 13, y); ctx.lineTo(x - 34 + k * 13, y - 18); } ctx.stroke();
    }
  },
  xunji(ctx) {
    plate(ctx);
    ctx.fillStyle = '#8A4B22'; ctx.beginPath(); ctx.ellipse(200, 235, 95, 60, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5E3016'; ctx.beginPath(); ctx.ellipse(200, 215, 60, 34, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3A1E0E'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(150, 250); ctx.lineTo(120, 300); ctx.moveTo(250, 250); ctx.lineTo(280, 300); ctx.stroke();
  },
  guobaorou(ctx) {
    plate(ctx);
    ctx.fillStyle = '#E0952F'; ctx.strokeStyle = '#B9701A'; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const x = 130 + (i % 3) * 60, y = 210 + Math.floor(i / 3) * 45;
      ctx.beginPath(); ctx.roundRect(x, y, 52, 34, 10); ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = PALETTE.red; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(140, 210); ctx.quadraticCurveTo(200, 190, 260, 240); ctx.stroke();
  },
  haixian(ctx) {
    plate(ctx);
    ctx.fillStyle = PALETTE.red; ctx.strokeStyle = PALETTE.redDeep; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(200, 240, 60, 42, 0, 0, 7); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = -0.6 + i * 0.4;
      ctx.beginPath(); ctx.moveTo(150, 230); ctx.quadraticCurveTo(110 - i * 8, 230 + Math.sin(a) * 40, 90, 250 + i * 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(250, 230); ctx.quadraticCurveTo(290 + i * 8, 230 + Math.sin(a) * 40, 310, 250 + i * 14); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(180, 220, 6, 0, 7); ctx.arc(220, 220, 6, 0, 7); ctx.fillStyle = '#2B2B2B'; ctx.fill();
  },
  menzi(ctx) {
    plate(ctx);
    ctx.fillStyle = '#C9A24E'; ctx.strokeStyle = '#8C6D1E'; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const x = 120 + (i % 3) * 70, y = 215 + Math.floor(i / 3) * 48;
      ctx.beginPath(); ctx.roundRect(x, y, 46, 40, 8); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(166,56,46,.5)'; ctx.beginPath(); ctx.ellipse(200, 235, 90, 50, 0, 0, 7); ctx.fill();
  },
  malaban(ctx) {
    plate(ctx);
    const cols = ['#A6382E', '#C9A227', '#3E7A3A', '#8A4B22'];
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = 5;
      const x = 130 + Math.random() * 140, y = 200 + Math.random() * 80;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 20, y + 10, x + 34, y - 6); ctx.stroke();
    }
  },
  zhenzi(ctx) {
    plate(ctx);
    ctx.fillStyle = '#8A5A2E'; ctx.strokeStyle = '#5E3A18'; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const x = 140 + (i % 3) * 60, y = 200 + Math.floor(i / 3) * 46;
      ctx.beginPath(); ctx.arc(x, y, 22, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 14, y - 14); ctx.lineTo(x + 14, y + 14); ctx.stroke();
    }
  },
  caomei(ctx) {
    plate(ctx);
    ctx.fillStyle = PALETTE.red; ctx.strokeStyle = PALETTE.redDeep; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const x = 130 + (i % 3) * 70, y = 210 + Math.floor(i / 2) * 40;
      ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.quadraticCurveTo(x + 26, y - 10, x, y + 26); ctx.quadraticCurveTo(x - 26, y - 10, x, y - 20); ctx.fill(); ctx.stroke();
      ctx.fillStyle = PALETTE.goldSoft; for (let k = 0; k < 4; k++) ctx.fillRect(x - 8 + k * 5, y - 6 + (k % 2) * 8, 2, 2);
      ctx.fillStyle = '#3E7A3A'; ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x - 8, y - 30); ctx.lineTo(x + 8, y - 30); ctx.fill();
      ctx.fillStyle = PALETTE.red;
    }
  },
  _default(ctx) { plate(ctx); },
};

// ================= 群英肖像（半抽象剪影徽章） =================
export function personImg(key, size = 420) {
  const { c, ctx } = make(size, size);
  const conf = PERSON_ART[key] || PERSON_ART._default;
  const g = ctx.createRadialGradient(size / 2, size * 0.36, size * 0.1, size / 2, size / 2, size * 0.72);
  g.addColorStop(0, conf.bg[0]);
  g.addColorStop(1, conf.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(size / 420, size / 420);
  // 通用肩颈
  ctx.fillStyle = conf.robe;
  ctx.beginPath();
  ctx.moveTo(-150, 210); ctx.quadraticCurveTo(-120, 70, -60, 60);
  ctx.lineTo(60, 60); ctx.quadraticCurveTo(120, 70, 150, 210);
  ctx.closePath(); ctx.fill();
  // 脸
  ctx.fillStyle = '#E9CBA6';
  ctx.beginPath(); ctx.ellipse(0, -20, 58, 70, 0, 0, 7); ctx.fill();
  // 五官
  ctx.strokeStyle = 'rgba(60,40,20,.65)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-30, -28); ctx.lineTo(-12, -28); ctx.moveTo(12, -28); ctx.lineTo(30, -28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-10, 6); ctx.quadraticCurveTo(0, 12, 10, 6); ctx.stroke();
  // 专属头饰
  conf.draw(ctx);
  ctx.restore();
  // 暗角
  const vg = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,16,26,.4)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.86);
}

const PERSON_ART = {
  xiaotaihou: { // 萧太后（辽朝女政治家）
    bg: ['#3A2440', '#180C1B'], robe: '#6E2A5A',
    draw(ctx) {
      ctx.fillStyle = PALETTE.gold; // 凤冠
      ctx.beginPath(); ctx.moveTo(-64, -70); ctx.quadraticCurveTo(0, -140, 64, -70);
      ctx.quadraticCurveTo(30, -84, 0, -80); ctx.quadraticCurveTo(-30, -84, -64, -70); ctx.fill();
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 26, -96, 7, 0, 7); ctx.fillStyle = i === 0 ? PALETTE.red : PALETTE.goldSoft; ctx.fill(); }
      ctx.fillStyle = PALETTE.red; ctx.beginPath(); ctx.arc(0, 30, 6, 0, 7); ctx.fill(); // 唇
    },
  },
  nuerhachi: { // 努尔哈赤（清太祖）
    bg: ['#3A2418', '#160C08'], robe: '#7E2A22',
    draw(ctx) {
      ctx.fillStyle = '#2B2B2B'; // 暖帽
      ctx.beginPath(); ctx.ellipse(0, -86, 74, 32, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -96, 42, Math.PI, 0); ctx.fill();
      ctx.fillStyle = PALETTE.gold; ctx.beginPath(); ctx.arc(0, -120, 9, 0, 7); ctx.fill();
      ctx.strokeStyle = '#3A2A1A'; ctx.lineWidth = 8; // 须
      ctx.beginPath(); ctx.moveTo(-24, 30); ctx.quadraticCurveTo(0, 70, 24, 30); ctx.stroke();
    },
  },
  zhangxueliang: { // 张学良（爱国将领）
    bg: ['#20364F', '#0C1826'], robe: '#33507A',
    draw(ctx) {
      ctx.fillStyle = '#1B2F49'; // 军帽
      ctx.beginPath(); ctx.ellipse(0, -78, 70, 24, 0, 0, 7); ctx.fill();
      ctx.fillRect(-58, -110, 116, 40);
      ctx.beginPath(); ctx.arc(-58, -90, 20, Math.PI * 0.5, Math.PI * 1.5); ctx.arc(58, -90, 20, Math.PI * 1.5, Math.PI * 0.5); ctx.fill();
      ctx.fillStyle = PALETTE.gold; ctx.beginPath(); ctx.arc(0, -100, 10, 0, 7); ctx.fill(); // 帽徽
      ctx.fillStyle = '#0E1B2B'; ctx.fillRect(-60, -74, 120, 8); // 帽檐
    },
  },
  leifeng: { // 雷锋（抚顺）
    bg: ['#2A4160', '#0E1B2B'], robe: '#3E6B3A',
    draw(ctx) {
      ctx.fillStyle = '#3E6B3A'; // 雷锋帽
      ctx.beginPath(); ctx.arc(0, -70, 62, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-62, -70); ctx.quadraticCurveTo(-90, -30, -60, -10); ctx.lineTo(-40, -40); ctx.fill();
      ctx.beginPath(); ctx.moveTo(62, -70); ctx.quadraticCurveTo(90, -30, 60, -10); ctx.lineTo(40, -40); ctx.fill();
      ctx.fillStyle = PALETTE.red; ctx.beginPath(); // 红五星
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 0.8; const r = i % 2 ? 6 : 14; ctx.lineTo(Math.cos(a) * r, -96 + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
    },
  },
  guomingyi: { // 郭明义（当代雷锋，鞍山）
    bg: ['#3A2418', '#160C08'], robe: '#A6382E',
    draw(ctx) {
      ctx.fillStyle = '#F5B301'; // 安全帽
      ctx.beginPath(); ctx.arc(0, -70, 60, Math.PI, 0); ctx.fill();
      ctx.fillRect(-70, -74, 140, 8);
      ctx.fillStyle = '#C99000'; ctx.fillRect(-6, -128, 12, 60);
      ctx.fillStyle = PALETTE.red; ctx.beginPath(); ctx.arc(0, 34, 6, 0, 7); ctx.fill();
    },
  },
  caoxueqin: { // 曹雪芹（祖籍辽阳）
    bg: ['#28323A', '#0E1418'], robe: '#3A4A52',
    draw(ctx) {
      ctx.fillStyle = '#2B2B2B'; // 文士巾
      ctx.beginPath(); ctx.moveTo(-58, -66); ctx.quadraticCurveTo(0, -128, 58, -66);
      ctx.quadraticCurveTo(40, -80, 0, -78); ctx.quadraticCurveTo(-40, -80, -58, -66); ctx.fill();
      ctx.fillRect(-14, -128, 28, 24);
      ctx.strokeStyle = '#3A2A1A'; ctx.lineWidth = 6; // 长须
      ctx.beginPath(); ctx.moveTo(-18, 30); ctx.quadraticCurveTo(0, 96, 18, 30); ctx.stroke();
    },
  },
  _default: {
    bg: ['#2A4160', '#0E1B2B'], robe: '#33507A',
    draw() {},
  },
};

// ================= 秧歌 · 社火视觉 =================
export function yanggeImg(w = 500, h = 620) {
  const { c, ctx } = make(w, h);
  ctx.translate(w / 2, h * 0.12);
  // 头（扎花）
  ctx.fillStyle = '#E9CBA6'; ctx.beginPath(); ctx.arc(0, 40, 40, 0, 7); ctx.fill();
  ctx.fillStyle = PALETTE.red; ctx.beginPath(); ctx.arc(-30, 14, 14, 0, 7); ctx.fill();
  ctx.fillStyle = PALETTE.goldSoft; ctx.beginPath(); ctx.arc(30, 14, 12, 0, 7); ctx.fill();
  ctx.fillStyle = '#2B2B2B'; ctx.beginPath(); ctx.arc(-12, 40, 4, 0, 7); ctx.arc(12, 40, 4, 0, 7); ctx.fill();
  ctx.fillStyle = PALETTE.red; ctx.beginPath(); ctx.arc(0, 56, 5, 0, 7); ctx.fill();
  // 花袄身
  const g = ctx.createLinearGradient(0, 90, 0, 360);
  g.addColorStop(0, '#C24E3E'); g.addColorStop(1, '#7E2A22');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-70, 360); ctx.quadraticCurveTo(-90, 150, -40, 100);
  ctx.lineTo(40, 100); ctx.quadraticCurveTo(90, 150, 70, 360);
  ctx.closePath(); ctx.fill();
  // 花纹
  ctx.fillStyle = PALETTE.goldSoft;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-30 + (i % 2) * 60, 150 + i * 32, 9, 0, 7); ctx.fill(); }
  // 绿裤
  ctx.fillStyle = '#3E7A3A';
  ctx.fillRect(-56, 360, 44, 150); ctx.fillRect(12, 360, 44, 150);
  return c.toDataURL('image/png');
}

// 红绸扇（独立旋转元素）
export function silk(size = 260) {
  const { c, ctx } = make(size, size);
  ctx.translate(size / 2, size / 2);
  const g = ctx.createLinearGradient(-size / 2, 0, size / 2, 0);
  g.addColorStop(0, '#E3423A'); g.addColorStop(0.5, '#A6382E'); g.addColorStop(1, '#E3423A');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let a = 0; a <= Math.PI; a += 0.05) {
    const r = size * 0.46 * (0.8 + 0.2 * Math.sin(a * 6));
    ctx.lineTo(Math.cos(a - Math.PI / 2) * r, Math.sin(a - Math.PI / 2) * r);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = PALETTE.goldSoft; ctx.lineWidth = 4; ctx.stroke();
  return c.toDataURL('image/png');
}

// ================= 矿珍（矿石本体 + 岩层覆盖） =================
export function oreImg(key, size = 400) {
  const { c, ctx } = make(size, size);
  const g = ctx.createRadialGradient(size / 2, size * 0.38, size * 0.1, size / 2, size / 2, size * 0.72);
  g.addColorStop(0, '#2A2622'); g.addColorStop(1, '#0E0C0A');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(size / 400, size / 400);
  (ORE_ART[key] || ORE_ART._default)(ctx);
  ctx.restore();
  return c.toDataURL('image/jpeg', 0.86);
}

// 岩层覆盖（刷开前盖在矿石上的一层灰岩）
export function rockCover(size = 400) {
  const { c, ctx } = make(size, size);
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#6E655C'); g.addColorStop(0.5, '#544C44'); g.addColorStop(1, '#3E3833');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  // 岩石肌理
  const r = rng(31);
  for (let i = 0; i < 260; i++) {
    ctx.globalAlpha = 0.08 + r() * 0.14;
    ctx.fillStyle = r() > 0.5 ? '#000' : '#8A8078';
    const x = r() * size, y = r() * size, s = 2 + r() * 8;
    ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // 裂纹
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    let x = r() * size, y = 0;
    ctx.moveTo(x, y);
    while (y < size) { x += (r() - 0.5) * 40; y += 20 + r() * 30; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return c.toDataURL('image/png');
}

const gem = (ctx, colors, facets = 6) => {
  ctx.save();
  const grad = ctx.createLinearGradient(-90, -90, 90, 90);
  colors.forEach((col, i) => grad.addColorStop(i / (colors.length - 1), col));
  ctx.fillStyle = grad;
  ctx.beginPath();
  for (let i = 0; i < facets; i++) {
    const a = (Math.PI * 2 * i) / facets - Math.PI / 2;
    const r = i % 2 ? 70 : 100;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill();
  // 切面高光
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
  for (let i = 0; i < facets; i++) {
    const a = (Math.PI * 2 * i) / facets - Math.PI / 2;
    const r = i % 2 ? 70 : 100;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
  }
  ctx.restore();
};

const ORE_ART = {
  lingmei(ctx) { // 菱镁矿（辽宁储量冠绝）——白中带黄的结晶块
    ctx.fillStyle = '#EDE6D4';
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.rotate(i * 1.2); ctx.fillStyle = ['#F3EEDE', '#D9CFB4', '#EAE0C6'][i % 3];
      ctx.beginPath(); ctx.rect(-30 - i * 6, -70 + i * 10, 60, 90); ctx.fill();
      ctx.strokeStyle = 'rgba(120,110,80,.5)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
  },
  jingang(ctx) { gem(ctx, ['#FFFFFF', '#CFE6FF', '#8AB4E0'], 8); }, // 瓦房店金刚石
  yu(ctx) { gem(ctx, ['#CFF0D6', '#5FA985', '#2E6B52'], 6); },      // 岫岩玉
  peng(ctx) { // 硼矿——绿白晶簇
    for (let i = 0; i < 7; i++) {
      ctx.save(); ctx.rotate((Math.PI * 2 * i) / 7);
      ctx.fillStyle = ['#DDECD0', '#B8D8A8', '#9AC488'][i % 3];
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-16, -90); ctx.lineTo(16, -90); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.stroke();
      ctx.restore();
    }
  },
  mei(ctx) { // 煤（阜新/抚顺）——乌金亮块
    ctx.fillStyle = '#161616';
    for (let i = 0; i < 4; i++) {
      ctx.save(); ctx.rotate(i * 0.9);
      ctx.beginPath(); ctx.rect(-40 + i * 8, -60, 80, 100); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(120,140,180,.5)';
    ctx.beginPath(); ctx.moveTo(-40, -30); ctx.lineTo(-10, -50); ctx.lineTo(0, -20); ctx.fill();
  },
  tie(ctx) { // 铁矿（鞍山）——赭红条带磁铁矿
    for (let i = -3; i <= 3; i++) {
      ctx.fillStyle = i % 2 ? '#5A2A20' : '#8A4030';
      ctx.fillRect(-95, i * 26 - 13, 190, 26);
    }
    ctx.fillStyle = 'rgba(200,120,90,.5)';
    ctx.beginPath(); ctx.arc(-30, -20, 10, 0, 7); ctx.arc(40, 30, 8, 0, 7); ctx.fill();
  },
  _default(ctx) { gem(ctx, ['#E3C567', '#C9A227', '#8C6D1E'], 6); },
};

// ================= 非遗百工纹样 =================
export function craftImg(key, size = 480) {
  const { c, ctx } = make(size, size);
  const conf = CRAFT_ART[key] || CRAFT_ART._default;
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, conf.bg[0]); g.addColorStop(1, conf.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  ctx.save(); ctx.translate(size / 2, size / 2); ctx.scale(size / 480, size / 480);
  conf.draw(ctx);
  ctx.restore();
  return c.toDataURL('image/jpeg', 0.86);
}

const CRAFT_ART = {
  yuyu: { // 岫岩玉雕
    bg: ['#1E3A34', '#0E1F1B'],
    draw(ctx) {
      const g = ctx.createRadialGradient(-30, -40, 20, 0, 0, 180);
      g.addColorStop(0, '#BFE6C8'); g.addColorStop(0.6, '#5FA985'); g.addColorStop(1, '#2E6B52');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 130, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(-30, -30, 60, 0, Math.PI); ctx.stroke();
      // 云龙纹
      ctx.strokeStyle = 'rgba(14,31,27,.5)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-80, 20); ctx.quadraticCurveTo(0, -60, 80, 30); ctx.quadraticCurveTo(20, 90, -50, 60); ctx.stroke();
    },
  },
  manao: { // 阜新玛瑙
    bg: ['#3A1E22', '#180B0D'],
    draw(ctx) {
      for (let i = 6; i > 0; i--) {
        ctx.fillStyle = ['#7E2A22', '#A6382E', '#C24E3E', '#E3C567', '#F5EFE3', '#C9A227'][i % 6];
        ctx.beginPath(); ctx.arc(0, 0, i * 22, 0, 7); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2;
      for (let i = 1; i <= 6; i++) { ctx.beginPath(); ctx.arc(0, 0, i * 22, 0, 7); ctx.stroke(); }
    },
  },
  liaoci: { // 辽瓷（鸡冠壶）
    bg: ['#E8E0CE', '#C9BC9C'],
    draw(ctx) {
      ctx.fillStyle = '#F7F3E8'; ctx.strokeStyle = '#7E6A3A'; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-60, -80); ctx.quadraticCurveTo(-90, 40, -70, 120);
      ctx.lineTo(70, 120); ctx.quadraticCurveTo(90, 20, 60, -60);
      ctx.quadraticCurveTo(20, -90, -60, -80); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = PALETTE.indigo; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 20, 44, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-20, -70); ctx.lineTo(20, -70); ctx.lineTo(0, -100); ctx.closePath(); ctx.fillStyle = '#F7F3E8'; ctx.fill(); ctx.stroke();
    },
  },
  cixiu: { // 满族刺绣
    bg: ['#7E2A22', '#4E1712'],
    draw(ctx) {
      const cols = ['#E3C567', '#F5EFE3', '#33507A', '#3E7A3A'];
      for (let p = 0; p < 8; p++) {
        ctx.save(); ctx.rotate((Math.PI * 2 * p) / 8);
        ctx.fillStyle = cols[p % cols.length];
        ctx.beginPath(); ctx.ellipse(0, -70, 22, 46, 0, 0, 7); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = PALETTE.gold; ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fill();
    },
  },
  beidiao: { // 大连贝雕
    bg: ['#20364F', '#0C1826'],
    draw(ctx) {
      const g = ctx.createLinearGradient(-100, -100, 100, 100);
      g.addColorStop(0, '#F5EFE3'); g.addColorStop(0.5, '#C9C1E0'); g.addColorStop(1, '#8AA0C9');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, 110);
      for (let i = 0; i <= 12; i++) { const a = Math.PI + (Math.PI * i) / 12; ctx.lineTo(Math.cos(a) * 120, 110 + Math.sin(a) * 120); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(27,47,73,.5)'; ctx.lineWidth = 3;
      for (let i = 0; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(0, 100); const a = Math.PI + (Math.PI * i) / 8; ctx.lineTo(Math.cos(a) * 118, 100 + Math.sin(a) * 110); ctx.stroke(); }
    },
  },
  nianhua: { // 木版年画
    bg: ['#F0E6D2', '#D6C6A2'],
    draw(ctx) {
      ctx.fillStyle = PALETTE.red; ctx.beginPath(); ctx.arc(0, -20, 70, 0, 7); ctx.fill();
      ctx.fillStyle = PALETTE.paper; ctx.beginPath(); ctx.arc(-24, -30, 12, 0, 7); ctx.arc(24, -30, 12, 0, 7); ctx.fill();
      ctx.fillStyle = '#2B2B2B'; ctx.beginPath(); ctx.arc(-24, -30, 5, 0, 7); ctx.arc(24, -30, 5, 0, 7); ctx.fill();
      ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 30, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.fillStyle = PALETTE.indigo; ctx.fillRect(-60, 70, 120, 40);
      ctx.fillStyle = PALETTE.goldSoft; ctx.font = '900 34px serif'; ctx.textAlign = 'center'; ctx.fillText('福', 0, 100);
    },
  },
  _default: {
    bg: ['#7E2A22', '#4E1712'],
    draw(ctx) { ctx.fillStyle = PALETTE.gold; ctx.beginPath(); ctx.arc(0, 0, 80, 0, 7); ctx.fill(); },
  },
};
