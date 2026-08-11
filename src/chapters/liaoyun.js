// 第三章 · 辽韵：皮影戏台 —— 拖动走台、轻点作揖听锣
import { state, unlockSeal } from '../state.js';
import { gong, pluck, success } from '../audio.js';

const NEED = 5; // 互动次数达到即"好戏开场"

export function initLiaoyun() {
  const stage = document.getElementById('shadowStage');
  const puppet = document.getElementById('puppet');
  const stampEl = document.getElementById('stampYun');

  let px = 0;          // 水平位移
  let rot = 0;         // 摆动角度
  let vel = 0;
  let dragging = false;
  let startX = 0, startPx = 0, moved = 0, lastX = 0, lastT = 0;
  let count = 0;
  let doneShown = state.seals.yun;
  let raf = null;

  if (doneShown) stampEl.classList.add('show');

  function apply() {
    puppet.style.setProperty('--px', `calc(-50% + ${px}px)`);
    puppet.style.transform = `translateX(calc(-50% + ${px}px)) rotate(${rot}deg)`;
  }

  function tickInteraction() {
    count++;
    if (count >= NEED && !doneShown) {
      doneShown = true;
      unlockSeal('yun');
      stampEl.classList.add('show');
      gong();
      setTimeout(success, 500);
    }
  }

  // 惯性回摆
  function settle() {
    cancelAnimationFrame(raf);
    const step = () => {
      rot *= 0.88;
      vel *= 0.9;
      apply();
      if (Math.abs(rot) > 0.15) raf = requestAnimationFrame(step);
      else { rot = 0; apply(); }
    };
    raf = requestAnimationFrame(step);
  }

  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = 0;
    startX = lastX = e.clientX;
    startPx = px;
    lastT = performance.now();
    cancelAnimationFrame(raf);
    stage.setPointerCapture(e.pointerId);
  });

  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    const limit = stage.clientWidth * 0.32;
    px = Math.max(-limit, Math.min(limit, startPx + dx));

    const now = performance.now();
    const dt = Math.max(8, now - lastT);
    vel = (e.clientX - lastX) / dt;
    lastX = e.clientX;
    lastT = now;
    rot = Math.max(-14, Math.min(14, vel * 40));
    apply();
  });

  function up(canceled = false) {
    if (!dragging) return;
    dragging = false;
    if (canceled) { settle(); return; } // 竖滑翻页触发的取消，不作数
    if (moved < 8) {
      // 视作轻点：作揖 + 锣声
      puppet.classList.remove('bow');
      void puppet.offsetWidth; // 重启动画
      puppet.classList.add('bow');
      gong();
    } else {
      pluck();
      settle();
    }
    tickInteraction();
  }
  stage.addEventListener('pointerup', () => up(false));
  stage.addEventListener('pointercancel', () => up(true));
  puppet.addEventListener('animationend', () => puppet.classList.remove('bow'));

  // 待机时轻轻呼吸摆动
  let idleT = 0;
  const idle = () => {
    if (!dragging && Math.abs(rot) < 0.2) {
      idleT += 0.016;
      puppet.style.transform = `translateX(calc(-50% + ${px}px)) rotate(${Math.sin(idleT * 1.4) * 1.6}deg)`;
    }
    requestAnimationFrame(idle);
  };
  requestAnimationFrame(idle);
}
