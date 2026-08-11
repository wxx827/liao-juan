// 第二章 · 辽景：横滑视差长卷，点亮辽宁四景
import { state, unlockSeal, persist } from '../state.js';
import { pluck, gong, success } from '../audio.js';

export const SCENES = {
  honghaitan: {
    title: '盘锦 · 红海滩',
    img: 'assets/img/scene-honghaitan.jpg',
    desc: '碱蓬草织就的绯色大地，湿地之上，丹顶鹤掠过，如画卷落笔。',
  },
  shuidong: {
    title: '本溪 · 水洞',
    img: 'assets/img/scene-shuidong.jpg',
    desc: '亿万年钟乳凝成的地下银河，一叶轻舟，穿行千载光阴。',
  },
  duanqiao: {
    title: '丹东 · 鸭绿江断桥',
    img: 'assets/img/scene-duanqiao.jpg',
    desc: '弹痕犹在的钢铁脊梁，江风阵阵，讲述着英雄城市的往事。',
  },
  binhai: {
    title: '大连 · 滨海路',
    img: 'assets/img/scene-binhai.jpg',
    desc: '山海相拥的北方明珠，灯塔与浪花，写下浪漫的注脚。',
  },
};

export function initLiaojing() {
  const wrap = document.getElementById('panWrap');
  const pan = document.getElementById('pan');
  const modal = document.getElementById('sceneModal');
  const modalImg = document.getElementById('modalImg');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const modalClose = document.getElementById('modalClose');
  const stampEl = document.getElementById('stampJing');
  const pins = [...document.querySelectorAll('.pin')];

  // 视差：背景比前景滚得慢
  wrap.addEventListener('scroll', () => {
    pan.style.backgroundPosition = `${-wrap.scrollLeft * 0.35}px center`;
  }, { passive: true });

  function refreshPins() {
    pins.forEach((p) => {
      p.classList.toggle('visited', state.visitedScenes.includes(p.dataset.scene));
    });
  }

  function maybeComplete() {
    if (state.visitedScenes.length >= Object.keys(SCENES).length && !state.seals.jing) {
      unlockSeal('jing');
      stampEl.classList.add('show');
      gong();
      setTimeout(success, 500);
    }
  }

  pins.forEach((pin) => {
    pin.addEventListener('click', () => {
      const key = pin.dataset.scene;
      const s = SCENES[key];
      if (!s) return;
      pluck();
      modalImg.src = s.img;
      modalTitle.textContent = s.title;
      modalDesc.textContent = s.desc;
      modal.hidden = false;
      if (!state.visitedScenes.includes(key)) {
        state.visitedScenes.push(key);
        persist();
      }
      refreshPins();
    });
  });

  modalClose.addEventListener('click', () => {
    modal.hidden = true;
    pluck();
    maybeComplete();
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) { modal.hidden = true; maybeComplete(); }
  });

  refreshPins();
  if (state.seals.jing) stampEl.classList.add('show');
}
