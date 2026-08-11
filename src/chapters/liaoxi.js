// 第七章 · 辽戏：鼓韵 —— 跟着节拍擂响东北大鼓，连击十二记
import { state, unlockSeal } from '../state.js';
import { drum, gong, success } from '../audio.js';

const NEED = 12;
const BEAT = 720; // 节拍周期 ms

export function initLiaoxi() {
  const btn = document.getElementById('drumBtn');
  const stage = document.getElementById('drumStage');
  const comboEl = document.getElementById('drumCombo');
  const ring = document.getElementById('beatRing');
  const hint = document.getElementById('drumHint');
  const stampEl = document.getElementById('stampGu');

  let combo = 0;
  let best = 0;
  let done = state.seals.gu;
  let beatT0 = performance.now();
  let beatRAF = null;

  if (done) { stampEl.classList.add('show'); comboEl.textContent = '鼓韵铿锵'; }

  // 节拍环脉动
  function beatLoop(now) {
    const phase = ((now - beatT0) % BEAT) / BEAT;
    const scale = 1 + Math.sin(phase * Math.PI) * 0.35;
    ring.style.transform = `translate(-50%,-50%) scale(${scale})`;
    ring.style.opacity = `${0.25 + (1 - phase) * 0.5}`;
    beatRAF = requestAnimationFrame(beatLoop);
  }

  function ripple() {
    const r = document.createElement('span');
    r.className = 'drum-ripple';
    stage.appendChild(r);
    setTimeout(() => r.remove(), 620);
  }

  function complete() {
    if (state.seals.gu) return;
    done = true;
    unlockSeal('gu');
    stampEl.classList.add('show');
    comboEl.textContent = '鼓韵铿锵';
    gong();
    setTimeout(success, 420);
  }

  function hit() {
    if (done) return;
    drum();
    ripple();
    btn.classList.remove('bounce'); void btn.offsetWidth; btn.classList.add('bounce');

    // 是否踩在节拍点上（±150ms）
    const now = performance.now();
    const phase = ((now - beatT0) % BEAT);
    const onBeat = phase < 150 || phase > BEAT - 150;
    combo++;
    best = Math.max(best, combo);
    comboEl.textContent = `连击 ${combo}`;
    if (onBeat) {
      ring.classList.remove('flash'); void ring.offsetWidth; ring.classList.add('flash');
      comboEl.classList.remove('good'); void comboEl.offsetWidth; comboEl.classList.add('good');
    }
    if (hint) hint.style.opacity = '0';
    if (combo >= NEED) complete();
  }

  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(); });
  btn.addEventListener('animationend', () => btn.classList.remove('bounce'));

  // 只在可见时跑节拍动画
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (e.isIntersecting) { beatT0 = performance.now(); if (!beatRAF) beatRAF = requestAnimationFrame(beatLoop); }
      else if (beatRAF) { cancelAnimationFrame(beatRAF); beatRAF = null; }
    });
  }, { threshold: 0.3 });
  io.observe(document.getElementById('gu'));
}
