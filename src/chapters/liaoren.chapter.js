// 辽脉 · 群英：关外群英点将台，逐一点亮看生平（自注册章节）
import './liaoren.css';
import { registerChapter } from '../registry.js';
import { state, unlockSeal, persist } from '../state.js';
import { pluck, gong, success } from '../audio.js';
import { personImg } from '../art.js';

export const PEOPLE = {
  xiaotaihou: {
    name: '萧太后', tag: '辽朝 · 承天太后',
    text: '萧绰临朝摄政，整军经武、澶渊结盟，让契丹辽国走向鼎盛。评书里“杨家将”的对手，正史中的巾帼枭雄。',
  },
  nuerhachi: {
    name: '努尔哈赤', tag: '清 · 太祖',
    text: '以十三副遗甲起兵，统一女真、创八旗、建后金，定都赫图阿拉后迁盛京，为大清三百年基业奠基于辽东。',
  },
  zhangxueliang: {
    name: '张学良', tag: '海城 · 爱国将领',
    text: '“东北易帜”促成国家统一，“西安事变”逼蒋抗日。少帅一生跌宕，家国大义重于个人荣辱。',
  },
  leifeng: {
    name: '雷 锋', tag: '抚顺 · 时代楷模',
    text: '“把有限的生命投入到无限的为人民服务中去。”抚顺是雷锋的第二故乡，一个名字成了一种精神。',
  },
  guomingyi: {
    name: '郭明义', tag: '鞍山 · 当代雷锋',
    text: '鞍钢的“活雷锋”，二十余年献血、助学、捐款不辍，用平凡善举把雷锋精神接力到今天。',
  },
  caoxueqin: {
    name: '曹雪芹', tag: '祖籍辽阳 · 文豪',
    text: '一部《红楼梦》，写尽人间悲欢。曹氏祖籍辽阳，关外的风骨与南国的繁华，共同滋养了这位旷世文才。',
  },
};

registerChapter({
  id: 'ren',
  order: 22,
  seal: { key: 'ren', label: '英' },
  state: { seenPeople: [] },
  className: 'ch-people',
  html: `
    <div class="ch-head">
      <span class="ch-no">英</span>
      <div class="ch-name">
        <h2>辽脉 · 群英</h2>
        <p>点将台上，逐一点亮关外群英</p>
      </div>
    </div>
    <div class="ren-scroll">
      <div class="ren-grid" id="renGrid"></div>
    </div>
    <div class="stamp" id="stampRen">群英<br/>入卷</div>
    <div class="modal" id="renModal" hidden>
      <div class="modal-card ren-modal-card">
        <img id="renModalImg" alt="" />
        <h3 id="renModalName"></h3>
        <em class="ren-modal-tag" id="renModalTag"></em>
        <p id="renModalText"></p>
        <button class="btn solid" id="renModalClose">收入长卷</button>
      </div>
    </div>
  `,
  init() {
    const grid = document.getElementById('renGrid');
    const stampEl = document.getElementById('stampRen');
    const modal = document.getElementById('renModal');
    const mImg = document.getElementById('renModalImg');
    const mName = document.getElementById('renModalName');
    const mTag = document.getElementById('renModalTag');
    const mText = document.getElementById('renModalText');
    const mClose = document.getElementById('renModalClose');
    if (!grid) return;

    const imgCache = {};
    const getImg = (k) => (imgCache[k] ||= personImg(k, 420));

    grid.innerHTML = '';
    Object.entries(PEOPLE).forEach(([key, p]) => {
      const card = document.createElement('button');
      card.className = 'ren-card';
      card.dataset.ren = key;
      card.innerHTML = `
        <span class="ren-portrait"><img alt="${p.name}" /></span>
        <b class="ren-name">${p.name}</b>
        <i class="ren-tag">${p.tag}</i>`;
      grid.appendChild(card);
    });
    const cards = [...grid.querySelectorAll('.ren-card')];

    function refresh() {
      cards.forEach((c) => {
        const seen = state.seenPeople.includes(c.dataset.ren);
        c.classList.toggle('seen', seen);
        const img = c.querySelector('img');
        if (seen && !img.src) img.src = getImg(c.dataset.ren);
      });
    }
    function maybeComplete() {
      if (state.seenPeople.length >= Object.keys(PEOPLE).length && !state.seals.ren) {
        unlockSeal('ren');
        stampEl?.classList.add('show');
        gong();
        setTimeout(success, 450);
      }
    }
    function open(key) {
      const p = PEOPLE[key];
      if (!p) return;
      pluck();
      mImg.src = getImg(key);
      mName.textContent = p.name;
      mTag.textContent = p.tag;
      mText.textContent = p.text;
      modal.hidden = false;
      if (!state.seenPeople.includes(key)) {
        state.seenPeople.push(key);
        persist();
        refresh();
      }
    }

    cards.forEach((c) => c.addEventListener('click', () => open(c.dataset.ren)));
    mClose.addEventListener('click', () => { modal.hidden = true; pluck(); maybeComplete(); });
    modal.addEventListener('click', (e) => { if (e.target === modal) { modal.hidden = true; maybeComplete(); } });

    refresh();
    if (state.seals.ren) stampEl?.classList.add('show');
  },
});
