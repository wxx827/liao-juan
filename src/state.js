// 全局游历状态：印章（数据驱动，支持章节自注册动态扩展）+ 收集进度 + 剪纸快照
const KEY = 'liaojuan-v1';

// 印章登记表：顺序即游历顺序（按 order 排序），label 为印面单字。
// 内置 7 章静态登记；新章节通过 registerSeal 动态追加。
export const SEALS = [
  { key: 'feng', label: '风', order: 1 },
  { key: 'jing', label: '景', order: 2 },
  { key: 'yun', label: '韵', order: 3 },
  { key: 'wei', label: '味', order: 4 },
  { key: 'ci', label: '瓷', order: 5 },
  { key: 'bing', label: '冰', order: 6 },
  { key: 'gu', label: '鼓', order: 7 },
];

// 动态可持久字段登记表：字段名 -> 默认值模板（用于 load/persist/reset）
const dynamicFields = {};

function clone(v) {
  try { return structuredClone(v); }
  catch { return JSON.parse(JSON.stringify(v)); }
}

function sortSeals() {
  SEALS.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function emptySeals() {
  return SEALS.reduce((o, s) => { o[s.key] = false; return o; }, {});
}

export const bus = new EventTarget();

export const state = {
  seals: emptySeals(),
  visitedScenes: [],
  collectedFoods: [],
  papercutSnapshot: null, // dataURL，仅存内存（体积大不进 localStorage）
};

/* ---- 自注册 API（供 registry.js 调用；state.js 不反向依赖 registry，避免循环） ---- */

// 追加一枚印章（幂等）；order 决定其在印墙/HUD 里的次序
export function registerSeal(seal) {
  if (!seal || !seal.key) return;
  if (!SEALS.some((s) => s.key === seal.key)) {
    SEALS.push({ key: seal.key, label: seal.label, order: seal.order ?? 999 });
    sortSeals();
  }
  if (!(seal.key in state.seals)) state.seals[seal.key] = false;
}

// 登记一批默认持久字段，例如 { unlockedEras: [], seenPeople: [] }
export function registerStateFields(fields) {
  if (!fields) return;
  Object.entries(fields).forEach(([name, def]) => {
    dynamicFields[name] = def;
    if (!(name in state)) state[name] = clone(def);
  });
}

export function allSealsLit() {
  return SEALS.every((s) => state.seals[s.key]);
}

export function litCount() {
  return SEALS.filter((s) => state.seals[s.key]).length;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.assign(state.seals, saved.seals || {});
    // 兼容旧版固定字段
    state.visitedScenes = saved.visitedScenes || [];
    state.collectedFoods = saved.collectedFoods || [];
    // 动态登记字段
    Object.keys(dynamicFields).forEach((name) => {
      if (name in saved) state[name] = saved[name];
    });
  } catch { /* 存档损坏则从头开始 */ }
}

export function persist() {
  try {
    const payload = {
      seals: state.seals,
      visitedScenes: state.visitedScenes,
      collectedFoods: state.collectedFoods,
    };
    Object.keys(dynamicFields).forEach((name) => { payload[name] = state[name]; });
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch { /* 隐私模式下静默失败 */ }
}

export function unlockSeal(key) {
  if (state.seals[key]) return;
  state.seals[key] = true;
  persist();
  bus.dispatchEvent(new CustomEvent('seal', { detail: key }));
}

export function reset() {
  state.seals = emptySeals();
  state.visitedScenes = [];
  state.collectedFoods = [];
  state.papercutSnapshot = null;
  Object.entries(dynamicFields).forEach(([name, def]) => { state[name] = clone(def); });
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
  bus.dispatchEvent(new Event('reset'));
}
