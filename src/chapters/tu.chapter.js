// 辽图 · 十四市：点亮辽宁十四座地级市，集齐全省入卷（自注册章节）
import './tu.css';
import { registerChapter } from '../registry.js';
import { state, unlockSeal, persist } from '../state.js';
import { pluck, pop, gong, success } from '../audio.js';

export const CITIES = [
  { key: 'shenyang', name: '沈阳', oneLine: '一朝发祥地、共和国工业重镇，盛京故宫红墙金瓦。' },
  { key: 'dalian', name: '大连', oneLine: '浪漫海滨与不冻良港，槐花海风与足球激情。' },
  { key: 'anshan', name: '鞍山', oneLine: '共和国钢都，千山灵秀，岫岩美玉温润。' },
  { key: 'fushun', name: '抚顺', oneLine: '雷锋第二故乡，煤都乌金，萨尔浒古战场。' },
  { key: 'benxi', name: '本溪', oneLine: '山城枫红，本溪水洞地下长河泛舟幽深。' },
  { key: 'dandong', name: '丹东', oneLine: '中国最大边境城市，鸭绿江畔断桥，草莓香甜。' },
  { key: 'jinzhou', name: '锦州', oneLine: '辽西走廊咽喉，笔架山天桥潮起潮落，烧烤一绝。' },
  { key: 'yingkou', name: '营口', oneLine: '辽河入海口，百年港城，望儿山慈母情深。' },
  { key: 'fuxin', name: '阜新', oneLine: '玛瑙之都，查海遗址“中华第一龙”故里。' },
  { key: 'liaoyang', name: '辽阳', oneLine: '东北最古老城市之一，白塔巍峨，襄平故地。' },
  { key: 'tieling', name: '铁岭', oneLine: '关东幽默之乡，莲花湖芦苇连天，榛子飘香。' },
  { key: 'chaoyang', name: '朝阳', oneLine: '“三燕古都”，化石之城，牛河梁红山圣地。' },
  { key: 'panjin', name: '盘锦', oneLine: '红海滩碱蓬如火，芦苇荡万顷，河蟹肥美。' },
  { key: 'huludao', name: '葫芦岛', oneLine: '关外第一城，兴城古城明代砖石完好，海韵悠长。' },
];

registerChapter({
  id: 'tu',
  order: 34,
  seal: { key: 'tu', label: '图' },
  state: { seenCities: [] },
  className: 'ch-tu',
  html: `
    <div class="ch-head">
      <span class="ch-no">图</span>
      <div class="ch-name">
        <h2>辽图 · 十四市</h2>
        <p>点开一座座城，集齐全省十四市入卷</p>
      </div>
    </div>
    <div class="tu-progress" id="tuProgress">已览 0 / 14</div>
    <div class="tu-grid-wrap">
      <div class="tu-grid" id="tuGrid"></div>
    </div>
    <div class="stamp" id="stampTu">全省<br/>入卷</div>
    <div class="modal" id="tuModal" hidden>
      <div class="modal-card tu-card">
        <div class="tu-modal-badge" id="tuModalBadge">图</div>
        <h3 id="tuModalName"></h3>
        <p id="tuModalText"></p>
        <button class="btn solid" id="tuModalClose">收入长卷</button>
      </div>
    </div>
  `,
  init() {
    const grid = document.getElementById('tuGrid');
    const progress = document.getElementById('tuProgress');
    const stampEl = document.getElementById('stampTu');
    const modal = document.getElementById('tuModal');
    const mBadge = document.getElementById('tuModalBadge');
    const mName = document.getElementById('tuModalName');
    const mText = document.getElementById('tuModalText');
    const mClose = document.getElementById('tuModalClose');
    if (!grid) return;

    grid.innerHTML = '';
    CITIES.forEach((c, i) => {
      const chip = document.createElement('button');
      chip.className = 'city-chip';
      chip.dataset.city = c.key;
      chip.style.setProperty('--i', i);
      chip.innerHTML = `
        <span class="city-name">${c.name}</span>
        <span class="city-tick">✓</span>`;
      grid.appendChild(chip);
    });
    const chips = [...grid.querySelectorAll('.city-chip')];

    function refresh() {
      chips.forEach((n) => n.classList.toggle('seen', state.seenCities.includes(n.dataset.city)));
      progress.textContent = `已览 ${state.seenCities.length} / ${CITIES.length}`;
    }
    function maybeComplete() {
      if (state.seenCities.length >= CITIES.length && !state.seals.tu) {
        unlockSeal('tu');
        stampEl?.classList.add('show');
        gong();
        setTimeout(success, 450);
      }
    }
    function open(key) {
      const c = CITIES.find((x) => x.key === key);
      if (!c) return;
      const already = state.seenCities.includes(key);
      already ? pop() : pluck();
      mBadge.textContent = c.name.slice(0, 1);
      mName.textContent = c.name;
      mText.textContent = c.oneLine;
      modal.hidden = false;
      if (!already) {
        state.seenCities.push(key);
        persist();
        refresh();
      }
    }

    chips.forEach((n) => n.addEventListener('click', () => open(n.dataset.city)));
    mClose.addEventListener('click', () => { modal.hidden = true; pluck(); maybeComplete(); });
    modal.addEventListener('click', (ev) => { if (ev.target === modal) { modal.hidden = true; maybeComplete(); } });

    refresh();
    if (state.seals.tu) stampEl?.classList.add('show');
  },
});
