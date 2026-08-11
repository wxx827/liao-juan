// 辽宝 · 矿珍：刷开岩层，采出关外矿藏，集齐即成印（自注册章节）
import './liaobao.css';
import { registerChapter } from '../registry.js';
import { state, unlockSeal, persist } from '../state.js';
import { snip, pop, gong, success } from '../audio.js';
import { oreImg, rockCover } from '../art.js';

export const ORES = {
  lingmei:  { name: '菱镁矿', city: '海城 · 大石桥', text: '储量与产量均居世界前列，“镁都”之名享誉全球，是耐火材料的国之重器。' },
  tie:      { name: '铁 矿',  city: '鞍山 · 本溪', text: '“共和国钢都”的底气，鞍钢的第一炉铁水，从这赭红的矿脉里奔涌而出。' },
  mei:      { name: '煤 炭',  city: '阜新 · 抚顺', text: '抚顺西露天矿曾是“亚洲第一大坑”，乌金滚滚，点燃了工业辽宁的炉火。' },
  jingang:  { name: '金刚石', city: '瓦房店', text: '亚洲最大的金刚石产地之一，晶莹坚硬，是辽南地下埋藏的璀璨星辰。' },
  yu:       { name: '岫 玉',  city: '鞍山 · 岫岩', text: '中国四大名玉之一，温润苍翠，孕育了岫岩玉雕这门传世非遗。' },
  peng:     { name: '硼 矿',  city: '丹东 · 宽甸', text: '我国重要的硼矿基地，绿白晶簇深藏山中，是化工与农业的隐形功臣。' },
};

registerChapter({
  id: 'bao',
  order: 26,
  seal: { key: 'bao', label: '宝' },
  state: { minedOres: [] },
  className: 'ch-ore',
  html: `
    <div class="ch-head">
      <span class="ch-no">宝</span>
      <div class="ch-name">
        <h2>辽宝 · 矿珍</h2>
        <p>刷开岩层，采出关外地下矿藏</p>
      </div>
    </div>
    <div class="bao-scroll">
      <div class="bao-grid" id="baoGrid"></div>
    </div>
    <div class="stamp" id="stampBao">矿珍<br/>入卷</div>
    <div class="modal" id="baoModal" hidden>
      <div class="modal-card bao-modal-card">
        <img id="baoModalImg" alt="" />
        <h3 id="baoModalName"></h3>
        <em class="bao-modal-city" id="baoModalCity"></em>
        <p id="baoModalText"></p>
        <button class="btn solid" id="baoModalClose">收入长卷</button>
      </div>
    </div>
  `,
  init() {
    const grid = document.getElementById('baoGrid');
    const stampEl = document.getElementById('stampBao');
    const modal = document.getElementById('baoModal');
    const mImg = document.getElementById('baoModalImg');
    const mName = document.getElementById('baoModalName');
    const mCity = document.getElementById('baoModalCity');
    const mText = document.getElementById('baoModalText');
    const mClose = document.getElementById('baoModalClose');
    if (!grid) return;

    const oreCache = {};
    const getOre = (k) => (oreCache[k] ||= oreImg(k, 300));
    const coverURL = rockCover(300);

    function maybeComplete() {
      if (state.minedOres.length >= Object.keys(ORES).length && !state.seals.bao) {
        unlockSeal('bao');
        stampEl?.classList.add('show');
        gong();
        setTimeout(success, 450);
      }
    }
    function openModal(key) {
      const o = ORES[key];
      if (!o) return;
      mImg.src = getOre(key);
      mName.textContent = o.name;
      mCity.textContent = o.city;
      mText.textContent = o.text;
      modal.hidden = false;
    }

    grid.innerHTML = '';
    Object.entries(ORES).forEach(([key, o]) => {
      const cell = document.createElement('div');
      cell.className = 'ore';
      cell.dataset.ore = key;
      cell.innerHTML = `
        <img class="ore-gem" alt="${o.name}" src="${getOre(key)}" />
        <canvas class="ore-cover" width="300" height="300"></canvas>
        <b class="ore-name">${o.name}</b>`;
      grid.appendChild(cell);
    });
    const cells = [...grid.querySelectorAll('.ore')];

    cells.forEach((cell) => {
      const key = cell.dataset.ore;
      const canvas = cell.querySelector('.ore-cover');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const mined = state.minedOres.includes(key);
      let drawing = false, last = null, strokes = 0, lastSnip = 0, done = mined;

      const cover = new Image();
      cover.onload = () => { if (!mined) ctx.drawImage(cover, 0, 0, 300, 300); };
      cover.src = coverURL;

      if (mined) cell.classList.add('mined');

      function pos(e) {
        const r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (300 / r.width), y: (e.clientY - r.top) * (300 / r.height) };
      }
      function progress() {
        const d = ctx.getImageData(0, 0, 300, 300).data;
        let clear = 0, total = 0;
        for (let i = 3; i < d.length; i += 40) { total++; if (d[i] === 0) clear++; }
        if (clear / total > 0.5) finish();
      }
      function finish() {
        if (done) return;
        done = true;
        cell.classList.add('mined');
        ctx.clearRect(0, 0, 300, 300);
        pop();
        if (!state.minedOres.includes(key)) {
          state.minedOres.push(key);
          persist();
          maybeComplete();
        }
        setTimeout(() => openModal(key), 260);
      }

      cell.addEventListener('pointerdown', (e) => {
        if (done) { openModal(key); return; }
        drawing = true; cell.setPointerCapture(e.pointerId); last = pos(e);
      });
      cell.addEventListener('pointermove', (e) => {
        if (!drawing || done) return;
        const p = pos(e);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineCap = ctx.lineJoin = 'round';
        ctx.lineWidth = 46;
        ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        last = p;
        const now = performance.now();
        if (now - lastSnip > 70) { snip(); lastSnip = now; }
        if (++strokes % 8 === 0) progress();
      });
      const stop = () => { if (drawing) { drawing = false; if (!done) progress(); } };
      cell.addEventListener('pointerup', stop);
      cell.addEventListener('pointercancel', stop);
    });

    mClose.addEventListener('click', () => { modal.hidden = true; pop(); });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

    if (state.seals.bao) stampEl?.classList.add('show');
  },
});
