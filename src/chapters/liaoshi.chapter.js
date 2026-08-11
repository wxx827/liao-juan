// 辽史 · 长河：竖向时间轴，点亮关外文明的六座里程碑（自注册参考实现）
import './liaoshi.css';
import { registerChapter } from '../registry.js';
import { state, unlockSeal, persist } from '../state.js';
import { pluck, gong, success } from '../audio.js';

export const ERAS = [
  {
    key: 'hongshan', era: '约六千年前', title: '红山文化', icon: '玉',
    text: '牛河梁遗址女神庙、积石冢惊世出土，“C形玉猪龙”被誉为“中华第一龙”，将中华文明的曙光照进辽西大地。',
  },
  {
    key: 'yan', era: '战国 · 秦汉', title: '燕辽襄平', icon: '燕',
    text: '燕将秦开却东胡，设辽东、辽西郡，襄平（今辽阳）自此为东北重镇，中原文明与关外血脉在此交汇。',
  },
  {
    key: 'liao', era: '公元 907—1125', title: '契丹立辽', icon: '辽',
    text: '耶律阿保机建契丹国，后称“辽”，创契丹文、行南北面官。辽塔巍然、辽瓷温润，游牧与农耕在此融为一体。',
  },
  {
    key: 'qing', era: '公元 1616 起', title: '清肇兴京', icon: '清',
    text: '努尔哈赤于赫图阿拉建后金，迁都盛京（沈阳）。一朝发祥地、两代帝王都，盛京城的红墙自此写入国史。',
  },
  {
    key: 'gongye', era: '二十世纪', title: '共和国长子', icon: '工',
    text: '沈阳铁西、鞍钢、抚顺煤都……第一炉钢、第一架飞机在此诞生。“辽老大”以钢铁脊梁扛起共和国的工业黎明。',
  },
  {
    key: 'kanglian', era: '烽火年代', title: '白山黑水', icon: '旗',
    text: '东北抗日联军转战林海雪原，杨靖宇、赵一曼血沃关东。这片土地的风骨，是宁折不弯的家国信念。',
  },
];

registerChapter({
  id: 'shi',
  order: 20,
  seal: { key: 'shi', label: '史' },
  state: { unlockedEras: [] },
  className: 'ch-history',
  html: `
    <div class="ch-head">
      <span class="ch-no">史</span>
      <div class="ch-name">
        <h2>辽史 · 长河</h2>
        <p>顺流而下，点亮关外文明六座里程碑</p>
      </div>
    </div>
    <div class="shi-scroll">
      <div class="shi-track" id="shiTrack"></div>
    </div>
    <div class="stamp" id="stampShi">长河<br/>入卷</div>
    <div class="modal" id="shiModal" hidden>
      <div class="modal-card shi-card">
        <div class="shi-modal-icon" id="shiModalIcon">辽</div>
        <em class="shi-modal-era" id="shiModalEra"></em>
        <h3 id="shiModalTitle"></h3>
        <p id="shiModalText"></p>
        <button class="btn solid" id="shiModalClose">收入长卷</button>
      </div>
    </div>
  `,
  init() {
    const track = document.getElementById('shiTrack');
    const stampEl = document.getElementById('stampShi');
    const modal = document.getElementById('shiModal');
    const mIcon = document.getElementById('shiModalIcon');
    const mEra = document.getElementById('shiModalEra');
    const mTitle = document.getElementById('shiModalTitle');
    const mText = document.getElementById('shiModalText');
    const mClose = document.getElementById('shiModalClose');
    if (!track) return;

    track.innerHTML = '';
    ERAS.forEach((e, i) => {
      const node = document.createElement('button');
      node.className = 'era-node';
      node.dataset.era = e.key;
      node.style.setProperty('--i', i);
      node.innerHTML = `
        <span class="era-dot"><span class="era-icon">${e.icon}</span></span>
        <span class="era-info">
          <b class="era-when">${e.era}</b>
          <b class="era-title">${e.title}</b>
        </span>`;
      track.appendChild(node);
    });
    const nodes = [...track.querySelectorAll('.era-node')];

    function refresh() {
      nodes.forEach((n) => n.classList.toggle('lit', state.unlockedEras.includes(n.dataset.era)));
    }
    function maybeComplete() {
      if (state.unlockedEras.length >= ERAS.length && !state.seals.shi) {
        unlockSeal('shi');
        stampEl?.classList.add('show');
        gong();
        setTimeout(success, 450);
      }
    }
    function open(key) {
      const e = ERAS.find((x) => x.key === key);
      if (!e) return;
      pluck();
      mIcon.textContent = e.icon;
      mEra.textContent = e.era;
      mTitle.textContent = e.title;
      mText.textContent = e.text;
      modal.hidden = false;
      if (!state.unlockedEras.includes(key)) {
        state.unlockedEras.push(key);
        persist();
        refresh();
      }
    }

    nodes.forEach((n) => n.addEventListener('click', () => open(n.dataset.era)));
    mClose.addEventListener('click', () => { modal.hidden = true; pluck(); maybeComplete(); });
    modal.addEventListener('click', (ev) => { if (ev.target === modal) { modal.hidden = true; maybeComplete(); } });

    refresh();
    if (state.seals.shi) stampEl?.classList.add('show');
  },
});
