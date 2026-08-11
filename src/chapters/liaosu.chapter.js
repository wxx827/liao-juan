// 辽俗 · 社火：东北大秧歌节奏小游戏 —— 跟着鼓点扭起来、甩红绸（自注册章节）
import './liaosu.css';
import { registerChapter } from '../registry.js';
import { state, unlockSeal } from '../state.js';
import { gong, pop, pluck, success } from '../audio.js';
import { yanggeImg, silk } from '../art.js';

const NEED = 12;        // 累计有效节拍数达成
const BEAT_MS = 640;    // 鼓点间隔
const HIT_WINDOW = 220; // 命中判定窗口(±ms)

registerChapter({
  id: 'su',
  order: 28,
  seal: { key: 'su', label: '俗' },
  className: 'ch-yangge',
  html: `
    <div class="ch-head light">
      <span class="ch-no">俗</span>
      <div class="ch-name">
        <h2>辽俗 · 社火</h2>
        <p>跟着金圈鼓点，点屏扭起大秧歌</p>
      </div>
    </div>
    <div class="su-stage" id="suStage">
      <div class="su-pulse" id="suPulse"></div>
      <img class="su-silk" id="suSilk" alt="红绸" />
      <img class="su-dancer" id="suDancer" alt="秧歌" />
      <div class="su-combo" id="suCombo">节拍 0 / ${NEED}</div>
      <div class="su-hint" id="suHint">点“起鼓”开始，跟着节拍点屏幕</div>
      <button class="su-start" id="suStart">起 鼓</button>
    </div>
    <div class="stamp" id="stampSu">社火<br/>入卷</div>
  `,
  init() {
    const stage = document.getElementById('suStage');
    const stampEl = document.getElementById('stampSu');
    if (!stage) return;

    const dancer = document.getElementById('suDancer');
    const silkEl = document.getElementById('suSilk');
    const pulse = document.getElementById('suPulse');
    const comboEl = document.getElementById('suCombo');
    const hintEl = document.getElementById('suHint');
    const startBtn = document.getElementById('suStart');

    if (dancer) dancer.src = yanggeImg(500, 620);
    if (silkEl) silkEl.src = silk(260);

    let running = false;
    let hits = 0, combo = 0, lastBeat = 0, beatTimer = null, side = 1;
    let doneShown = state.seals.su;

    if (doneShown) stampEl?.classList.add('show');

    function setCombo() { comboEl.textContent = `节拍 ${hits} / ${NEED}`; }

    function beat() {
      lastBeat = performance.now();
      side *= -1;
      pulse.classList.remove('ping');
      void pulse.offsetWidth;
      pulse.classList.add('ping');
      pluck();
      beatTimer = setTimeout(beat, BEAT_MS);
    }

    function finish() {
      running = false;
      clearTimeout(beatTimer);
      hintEl.textContent = '好一场大秧歌，扭得地道！';
      startBtn.textContent = '再扭一段';
      startBtn.hidden = false;
      if (!doneShown) {
        doneShown = true;
        unlockSeal('su');
        stampEl?.classList.add('show');
        gong();
        setTimeout(success, 450);
      }
    }

    function start() {
      running = true;
      hits = 0; combo = 0;
      setCombo();
      startBtn.hidden = true;
      hintEl.textContent = '跟着金圈的鼓点，点屏幕扭起来！';
      beat();
    }

    function tap() {
      if (!running) return;
      const now = performance.now();
      const diff = Math.abs(now - lastBeat);
      const onBeat = diff < HIT_WINDOW || Math.abs(diff - BEAT_MS) < HIT_WINDOW;
      dancer.style.transform = `translateX(-50%) rotate(${side * 7}deg)`;
      silkEl.style.transform = `rotate(${side * 60}deg) scale(${onBeat ? 1.15 : 1})`;
      setTimeout(() => {
        dancer.style.transform = 'translateX(-50%) rotate(0deg)';
        silkEl.style.transform = 'rotate(0deg) scale(1)';
      }, 180);

      if (onBeat) {
        hits++; combo++;
        pop();
        stage.classList.remove('good'); void stage.offsetWidth; stage.classList.add('good');
        setCombo();
        if (hits >= NEED) finish();
      } else {
        combo = 0;
      }
    }

    stage.addEventListener('pointerdown', (e) => {
      if (e.target === startBtn) return;
      tap();
    });
    startBtn.addEventListener('click', (e) => { e.stopPropagation(); start(); });

    let t = 0;
    const idle = () => {
      if (!running && dancer) {
        t += 0.03;
        dancer.style.transform = `translateX(-50%) rotate(${Math.sin(t) * 2.4}deg)`;
      }
      requestAnimationFrame(idle);
    };
    requestAnimationFrame(idle);

    setCombo();
  },
});
