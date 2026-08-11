// 章节自注册中心：每个 *.chapter.js 在模块顶层调用 registerChapter 声明自己。
// main.js 用 import.meta.glob 在 load() 之前统一装载全部章节。
import { registerSeal, registerStateFields } from './state.js';

// 章节描述符契约：
// {
//   id: 'shi',                     // section 的 DOM id，也用于 #id 直达
//   order: 20,                     // 排序权重（越小越靠前，插入到 #final 之前）
//   seal: { key, label, order },   // 该章对应印章（可选；纯展示章可省略）
//   state: { unlockedEras: [] },   // 需持久化的默认字段（可选）
//   className: 'ch-history',        // 追加到 section 的 class
//   html: '<div class="ch-head">…</div>…', // section 内部 HTML 字符串
//   init(section) { /* 章节逻辑 */ },       // DOM 插入后调用
// }
export const chapters = [];

export function registerChapter(desc) {
  if (!desc || !desc.id) return;
  chapters.push(desc);
  if (desc.seal) {
    registerSeal({ ...desc.seal, order: desc.seal.order ?? desc.order });
  }
  if (desc.state) registerStateFields(desc.state);
}
