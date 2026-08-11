// 辽艺 · 百工：非遗手工艺翻牌图鉴，翻阅集齐即成印（自注册章节）
import './liaoyi.css';
import { registerChapter } from '../registry.js';
import { state, unlockSeal, persist } from '../state.js';
import { pluck, pop, gong, success } from '../audio.js';
import { craftImg } from '../art.js';

export const CRAFTS = {
  yuyu:    { name: '岫岩玉雕', city: '鞍山 · 岫岩', text: '“玉都”岫岩产玉极丰，匠人因材施艺，一块顽石里雕出山水、花鸟与祥龙。' },
  manao:   { name: '阜新玛瑙', city: '阜新', text: '“玛瑙之都”的巧作，俏色套雕借天然纹理，方寸之间藏山河万象。' },
  liaoci:  { name: '辽 瓷',   city: '辽代', text: '鸡冠壶、凤首瓶——契丹人把游牧的皮囊烧进了瓷里，粗犷中见温润。' },
  cixiu:   { name: '满族刺绣', city: '锦州', text: '一针一线绣出关东的枝繁叶茂，色彩浓烈，是满族人家嫁妆里的吉祥。' },
  beidiao: { name: '大连贝雕', city: '大连', text: '取渤海之贝，磨其光华，拼作花鸟山水，是浪花凝成的立体画。' },
  nianhua: { name: '木版年画', city: '辽南', text: '一版一色套印出的门神与福娃，把关东人家过年的红火贴上门楣。' },
};

registerChapter({
  id: 'yi',
  order: 24,
  seal: { key: 'yi', label: '艺' },
  state: { seenCrafts: [] },
  className: 'ch-craft',
  html: `
    <div class="ch-head">
      <span class="ch-no">艺</span>
      <div class="ch-name">
        <h2>辽艺 · 百工</h2>
        <p>轻点翻牌，集齐关外非遗百工</p>
      </div>
    </div>
    <div class="yi-scroll">
      <div class="yi-grid" id="yiGrid"></div>
    </div>
    <div class="stamp" id="stampYi">百工<br/>入卷</div>
  `,
  init() {
    const grid = document.getElementById('yiGrid');
    const stampEl = document.getElementById('stampYi');
    if (!grid) return;

    grid.innerHTML = '';
    Object.entries(CRAFTS).forEach(([key, c]) => {
      const card = document.createElement('button');
      card.className = 'craft';
      card.dataset.craft = key;
      card.innerHTML = `
        <div class="craft-inner">
          <div class="craft-face craft-front">
            <span class="craft-q">?</span>
            <b>${c.name}</b>
            <i>轻点翻阅</i>
          </div>
          <div class="craft-face craft-back">
            <img alt="${c.name}" />
            <div class="craft-back-text">
              <b>${c.name}</b>
              <em>${c.city}</em>
              <p>${c.text}</p>
            </div>
          </div>
        </div>`;
      grid.appendChild(card);
    });
    const cards = [...grid.querySelectorAll('.craft')];

    function maybeComplete() {
      if (state.seenCrafts.length >= Object.keys(CRAFTS).length && !state.seals.yi) {
        unlockSeal('yi');
        stampEl?.classList.add('show');
        gong();
        setTimeout(success, 450);
      }
    }

    cards.forEach((card) => {
      const key = card.dataset.craft;
      const flipped = state.seenCrafts.includes(key);
      if (flipped) {
        card.classList.add('flipped');
        card.querySelector('img').src = craftImg(key, 420);
      }
      card.addEventListener('click', () => {
        const isFlipped = card.classList.toggle('flipped');
        if (isFlipped) {
          const img = card.querySelector('img');
          if (!img.src) img.src = craftImg(key, 420);
          pop();
          if (!state.seenCrafts.includes(key)) {
            state.seenCrafts.push(key);
            persist();
            maybeComplete();
          }
        } else {
          pluck();
        }
      });
    });

    if (state.seals.yi) stampEl?.classList.add('show');
  },
});
