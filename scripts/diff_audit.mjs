// 对比修复前（线上旧版）与修复后（本地新构建）的点击可达性审计结果
import { readFileSync } from 'fs';

const load = (p) => JSON.parse(readFileSync(p, 'utf8'));
const after = load('shots/hit-audit.json');
const before = load('shots/hit-audit-online-before.json');

const fmt = (r) => `  ${r.section.padEnd(6)} ${r.label.padEnd(8)} ${String(r.box.w) + 'x' + r.box.h}`
  + `  中心命中=${r.centerOk ? '是' : '否 → ' + r.centerHit}  可点面积比=${r.hitRatio}`;

for (const [title, data] of [['修复前（线上旧版）', before], ['修复后（本地新构建）', after]]) {
  for (const sec of ['lian', 'jing']) {
    const rows = data.filter((r) => r.section === sec);
    console.log(`【${title}】${sec} — ${rows.length} 个目标`);
    rows.forEach((r) => console.log(fmt(r)));
    console.log('');
  }
}
