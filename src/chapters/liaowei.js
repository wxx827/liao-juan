// 第四章 · 辽味：点选佳肴收入食盒，集齐"辽味四宝"
import { state, unlockSeal, persist } from '../state.js';
import { pop, gong, success } from '../audio.js';

export const FOODS = {
  jiaozi:    { name: '老边饺子',   img: 'assets/img/food-jiaozi.jpg' },
  xunji:     { name: '沟帮子熏鸡', img: 'assets/img/food-xunji.jpg' },
  guobaorou: { name: '锅包肉',     img: 'assets/img/food-guobaorou.jpg' },
  haixian:   { name: '渤海飞蟹',   img: 'assets/img/food-haixian.jpg' },
};

export function initLiaowei() {
  const grid = document.getElementById('foodGrid');
  const stampEl = document.getElementById('stampWei');
  const cards = [...grid.querySelectorAll('.food')];
  const slots = {};
  document.querySelectorAll('.food-tray .slot').forEach((s) => { slots[s.dataset.slot] = s; });

  function fillSlot(key, instant = false) {
    const slot = slots[key];
    if (!slot) return;
    slot.classList.add('filled');
    slot.style.backgroundImage = `url('${FOODS[key].img}')`;
    if (instant) slot.style.animation = 'none';
  }

  function maybeComplete() {
    if (state.collectedFoods.length >= Object.keys(FOODS).length && !state.seals.wei) {
      unlockSeal('wei');
      stampEl.classList.add('show');
      gong();
      setTimeout(success, 400);
    }
  }

  function collect(card) {
    const key = card.dataset.food;
    if (state.collectedFoods.includes(key)) return;
    state.collectedFoods.push(key);
    persist();
    pop();

    // 飞入食盒动画
    const imgEl = card.querySelector('img');
    const from = imgEl.getBoundingClientRect();
    const to = slots[key].getBoundingClientRect();
    const fly = document.createElement('img');
    fly.className = 'fly-food';
    fly.src = FOODS[key].img;
    fly.style.left = `${from.left + from.width / 2 - 36}px`;
    fly.style.top = `${from.top + from.height / 2 - 36}px`;
    document.body.appendChild(fly);
    requestAnimationFrame(() => {
      fly.style.left = `${to.left + to.width / 2 - 36}px`;
      fly.style.top = `${to.top + to.height / 2 - 36}px`;
      fly.style.transform = 'scale(.42)';
      fly.style.opacity = '.9';
    });
    setTimeout(() => {
      fly.remove();
      fillSlot(key);
      card.classList.add('got');
      maybeComplete();
    }, 740);
  }

  cards.forEach((card) => card.addEventListener('click', () => collect(card)));

  // 恢复存档
  state.collectedFoods.forEach((key) => {
    const card = cards.find((c) => c.dataset.food === key);
    if (card) card.classList.add('got');
    fillSlot(key, true);
  });
  if (state.seals.wei) stampEl.classList.add('show');
}
