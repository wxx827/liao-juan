// 轻量粒子/特效引擎：环境粒子（花瓣/浮尘/雪）+ 一次性爆发（金箔/礼花）
// 环境粒子只在容器可见时运行，节省移动端性能。

const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* ============ 全屏爆发层（金箔、礼花） ============ */
let overlay = null;
let overlayCtx = null;
let bursts = [];
let burstRAF = null;

function ensureOverlay() {
  if (overlay) return;
  overlay = document.createElement('canvas');
  overlay.id = 'fx-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '120',
  });
  document.body.appendChild(overlay);
  overlayCtx = overlay.getContext('2d');
  sizeOverlay();
  window.addEventListener('resize', sizeOverlay);
}

function sizeOverlay() {
  if (!overlay) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  overlay.width = innerWidth * dpr;
  overlay.height = innerHeight * dpr;
  overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function runBursts() {
  overlayCtx.clearRect(0, 0, innerWidth, innerHeight);
  let alive = false;
  for (const p of bursts) {
    if (p.life <= 0) continue;
    alive = true;
    p.life -= 1;
    p.vy += p.g;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    const a = Math.min(1, p.life / 24);
    overlayCtx.save();
    overlayCtx.globalAlpha = a;
    overlayCtx.translate(p.x, p.y);
    overlayCtx.rotate(p.rot);
    overlayCtx.fillStyle = p.color;
    if (p.shape === 'rect') {
      overlayCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else if (p.shape === 'ribbon') {
      overlayCtx.fillRect(-p.size / 2, -p.size / 6, p.size, p.size / 3);
    } else {
      overlayCtx.beginPath();
      overlayCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      overlayCtx.fill();
    }
    overlayCtx.restore();
  }
  bursts = bursts.filter((p) => p.life > 0);
  if (alive) {
    burstRAF = requestAnimationFrame(runBursts);
  } else {
    overlayCtx.clearRect(0, 0, innerWidth, innerHeight);
    burstRAF = null;
  }
}

const GOLD = ['#C9A227', '#E3C567', '#F2D98A', '#B8901E'];
const FEST = ['#A6382E', '#C9A227', '#E3C567', '#F5EFE3', '#1B2F49', '#D8462F'];

// 金箔飞溅：从某点向上迸发再飘落
export function goldBurst(x, y, count = 60) {
  if (prefersReduced) return;
  ensureOverlay();
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const sp = 3 + Math.random() * 9;
    bursts.push({
      x, y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 2,
      g: 0.12 + Math.random() * 0.1,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      size: 5 + Math.random() * 9,
      color: GOLD[(Math.random() * GOLD.length) | 0],
      shape: 'rect',
      life: 90 + Math.random() * 50,
    });
  }
  if (!burstRAF) burstRAF = requestAnimationFrame(runBursts);
}

// 礼花：多点彩带绽放（全站完成彩蛋）
export function confetti(count = 160) {
  if (prefersReduced) return;
  ensureOverlay();
  const origins = [
    { x: innerWidth * 0.5, y: innerHeight * 0.32 },
    { x: innerWidth * 0.2, y: innerHeight * 0.42 },
    { x: innerWidth * 0.8, y: innerHeight * 0.42 },
  ];
  origins.forEach((o) => {
    for (let i = 0; i < count / origins.length; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 11;
      bursts.push({
        x: o.x, y: o.y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 3,
        g: 0.14 + Math.random() * 0.12,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.5,
        size: 7 + Math.random() * 10,
        color: FEST[(Math.random() * FEST.length) | 0],
        shape: Math.random() > 0.4 ? 'ribbon' : 'rect',
        life: 110 + Math.random() * 70,
      });
    }
  });
  if (!burstRAF) burstRAF = requestAnimationFrame(runBursts);
}

/* ============ 环境粒子（花瓣、浮尘、雪） ============ */
export function createAmbient(container, opts = {}) {
  const {
    count = 22,
    type = 'petal',      // petal | dust | snow
    colors = ['#E3C567', '#C9A227', '#A6382E'],
    speed = 1,
    size = [6, 14],
  } = opts;

  if (prefersReduced) return { start() {}, stop() {}, destroy() {} };

  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '2',
  });
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let parts = [];
  let raf = null;
  let running = false;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = container.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn(initial = false) {
    const s = size[0] + Math.random() * (size[1] - size[0]);
    return {
      x: Math.random() * W,
      y: initial ? Math.random() * H : -s,
      s,
      vy: (0.4 + Math.random() * 1.1) * speed * (type === 'dust' ? 0.35 : 1),
      vx: (Math.random() - 0.5) * 0.8 * speed,
      sway: Math.random() * Math.PI * 2,
      swaySp: 0.01 + Math.random() * 0.03,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.05,
      color: colors[(Math.random() * colors.length) | 0],
      alpha: type === 'dust' ? 0.15 + Math.random() * 0.3 : 0.55 + Math.random() * 0.45,
    };
  }

  function draw(p) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (type === 'petal') {
      // 花瓣：椭圆
      ctx.beginPath();
      ctx.ellipse(0, 0, p.s * 0.5, p.s * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'snow' || type === 'dust') {
      ctx.beginPath();
      ctx.arc(0, 0, p.s * (type === 'dust' ? 0.18 : 0.32), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function tick() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.sway += p.swaySp;
      p.x += p.vx + Math.sin(p.sway) * 0.6;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > H + 20) Object.assign(p, spawn(false));
      if (p.x < -20) p.x = W + 10;
      if (p.x > W + 20) p.x = -10;
      draw(p);
    }
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    resize();
    if (!parts.length) parts = Array.from({ length: count }, () => spawn(true));
    running = true;
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }
  function destroy() { stop(); canvas.remove(); }

  window.addEventListener('resize', () => { if (running) resize(); });

  // 只在容器进入视口时运行
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => (e.isIntersecting ? start() : stop()));
  }, { threshold: 0.15 });
  io.observe(container);

  return { start, stop, destroy };
}
