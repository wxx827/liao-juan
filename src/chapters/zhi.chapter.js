// 辽智 · 智绘诗签：端上「生成算法」即时拼出国潮诗签（模板 + 词库 + 加权随机，纯前端离线）
// 说明：这是运行在你手机里的确定性组合算法，非联网大模型；措辞取材辽宁风物，对仗押韵成签。
import './zhi.css';
import { registerChapter } from '../registry.js';
import { state, unlockSeal, persist } from '../state.js';
import { pluck, pop, gong, success, chime } from '../audio.js';

const NEED = 3; // 智绘生成 3 次即点亮「智」印

// —— 主题词库：每主题给一组「意象 + 情态」平行词池，保证上下联对仗 ——
const THEMES = {
  feng: {
    name: '辽风 · 非遗',
    loc: ['窗花', '红纸', '满绣', '皮影', '辽瓷', '年画', '剪彩', '灯影', '云肩', '锦囊'],
    act: ['映日', '传薪', '生辉', '含情', '焕彩', '留香', '入梦', '流芳', '呈祥', '织春'],
  },
  jing: {
    name: '辽景 · 山河',
    loc: ['红滩', '苇荡', '千山', '鸭江', '水洞', '断桥', '海天', '盛京', '关山', '雪原'],
    act: ['落照', '归帆', '染霜', '听涛', '览胜', '觅梅', '凝晖', '含烟', '飞雪', '照晚'],
  },
  yun: {
    name: '辽韵 · 风韵',
    loc: ['皮影', '鼓韵', '秧歌', '评书', '高跷', '唢呐', '灯戏', '弦歌'],
    act: ['铿锵', '起舞', '绕梁', '踏歌', '喧春', '传情', '动地', '和鸣'],
  },
  wei: {
    name: '辽味 · 风味',
    loc: ['饺香', '蟹肥', '熏鸡', '肉酥', '梨甜', '莓红', '参鲜', '酒暖'],
    act: ['盈盘', '醉客', '暖冬', '沁心', '满席', '思乡', '解馋', '传家'],
  },
  siji: {
    name: '四季 · 流转',
    loc: ['春潮', '夏木', '秋枫', '冬雪', '东风', '新绿', '丹叶', '寒梅'],
    act: ['破晓', '成荫', '染岭', '覆原', '解冻', '抽枝', '铺霞', '傲霜'],
  },
  shanhe: {
    name: '山河 · 形胜',
    loc: ['长城', '界江', '群峰', '沧海', '古塔', '要塞', '平原', '林海'],
    act: ['巍峨', '奔流', '叠翠', '扬波', '入云', '镇边', '沃野', '苍茫'],
  },
  fengwu: {
    name: '风物 · 物华',
    loc: ['玉都', '煤海', '钢城', '港湾', '稻乡', '蟹田', '药谷', '枫廊'],
    act: ['生金', '铸魂', '扬帆', '飘香', '丰饶', '焕新', '兴业', '怀古'],
  },
};

const HORIZ = ['关外风华', '山河入卷', '辽韵流芳', '岁稔年丰', '紫气东来', '风物长宜', '锦绣关东', '卷舒天地'];
const BLESS = [
  '愿君此行 · 满载而归', '岁岁平安 · 年年有余', '前程似锦 · 万事顺遂',
  '山高水长 · 福泽绵绵', '所求皆愿 · 所行皆坦', '关山万里 · 归来如少年',
];

// —— 加权随机：靠前的词权重略高，出签更“稳”，多次生成又有变化 ——
function weightedPick(arr, rand) {
  const weights = arr.map((_, i) => 1 + (arr.length - i) * 0.12);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}

let lastSig = '';
function generate(themeKey) {
  const t = THEMES[themeKey] || THEMES.jing;
  const rand = Math.random;
  let up, down, tries = 0;
  do {
    const l1 = weightedPick(t.loc, rand), a1 = weightedPick(t.act, rand);
    let l2 = weightedPick(t.loc, rand), a2 = weightedPick(t.act, rand);
    let guard = 0;
    while ((l2 === l1 || a2 === a1) && guard++ < 12) { l2 = weightedPick(t.loc, rand); a2 = weightedPick(t.act, rand); }
    up = l1 + a1; down = l2 + a2;
  } while (`${up}${down}` === lastSig && tries++ < 6);
  const sign = {
    theme: t.name,
    horiz: weightedPick(HORIZ, rand),
    up, down,
    bless: weightedPick(BLESS, rand),
  };
  lastSig = `${up}${down}`;
  return sign;
}

// —— 竖排文字 ——
const FONT = '"Noto Serif SC", "SimSun", serif';
function vtext(ctx, text, x, y, size, gap, color, weight = 900) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  [...text].forEach((ch, i) => ctx.fillText(ch, x, y + i * (size + gap)));
  ctx.restore();
}

// —— 把当前诗签绘成一张可保存的国潮签（720×1080，宣纸/回纹/竖联/朱印） ——
function buildSignCanvas(sign) {
  const W = 720, H = 1080;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const RED = '#A6382E', RED_DEEP = '#7E2A22', GOLD = '#C9A227', PAPER = '#F5EFE3', INK = '#2B2B2B', INDIGO = '#1B2F49';

  // 宣纸底 + 晕角 + 纸纹
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(126,42,34,.09)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 500; i++) { ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff'; ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2 + Math.random() * 8); }
  ctx.globalAlpha = 1;

  // 双框
  ctx.strokeStyle = RED; ctx.lineWidth = 8; ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5; ctx.strokeRect(48, 48, W - 96, H - 96);
  // 四角回纹
  ctx.strokeStyle = GOLD; ctx.lineWidth = 4;
  const cc = 74, L = 48;
  [[cc, cc, 1, 1], [W - cc, cc, -1, 1], [cc, H - cc, 1, -1], [W - cc, H - cc, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(x + L * sx, y); ctx.lineTo(x, y); ctx.lineTo(x, y + L * sy);
    ctx.moveTo(x + L * 0.55 * sx, y + 18 * sy); ctx.lineTo(x + 18 * sx, y + 18 * sy); ctx.lineTo(x + 18 * sx, y + L * 0.55 * sy);
    ctx.stroke();
  });

  // 顶部横批（红底金字小匾）
  ctx.save();
  ctx.translate(W / 2, 108);
  ctx.fillStyle = RED_DEEP;
  const bw = 300, bh = 66;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.strokeRect(-bw / 2 + 6, -bh / 2 + 6, bw - 12, bh - 12);
  ctx.fillStyle = '#F1E4B0';
  ctx.font = `900 34px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let hx = -((sign.horiz.length - 1) * 44) / 2;
  [...sign.horiz].forEach((ch) => { ctx.fillText(ch, hx, 2); hx += 44; });
  ctx.restore();

  // 竖排上下联（右上→，左下）
  const colSize = 58, gap = 16;
  const topY = 210;
  vtext(ctx, sign.up, W * 0.72, topY, colSize, gap, INK);   // 上联（右）
  vtext(ctx, sign.down, W * 0.28, topY, colSize, gap, INK);  // 下联（左）

  // 中央朱印「智绘」
  ctx.save();
  ctx.translate(W / 2, 470);
  ctx.rotate(-0.06);
  ctx.fillStyle = RED; ctx.fillRect(-64, -64, 128, 128);
  ctx.strokeStyle = 'rgba(245,239,227,.85)'; ctx.lineWidth = 3; ctx.strokeRect(-52, -52, 104, 104);
  ctx.fillStyle = PAPER; ctx.font = `900 50px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('智', 0, -26); ctx.fillText('绘', 0, 28);
  ctx.restore();

  // 主题标签
  ctx.fillStyle = INDIGO; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`— ${sign.theme} —`, W / 2, H - 250);

  // 祝福句
  ctx.fillStyle = RED_DEEP; ctx.font = `900 30px ${FONT}`;
  ctx.fillText(sign.bless, W / 2, H - 196);

  // 落款
  ctx.fillStyle = 'rgba(43,43,43,.55)'; ctx.font = `500 21px ${FONT}`;
  ctx.fillText('辽·卷 · 智绘诗签 · 端上算法即时生成', W / 2, H - 120);
  const d = new Date();
  ctx.fillText(`丙午年 · ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`, W / 2, H - 88);

  return c;
}

registerChapter({
  id: 'zhi',
  order: 41, // 位于辽鲜(40)之后、辽星尾声(42)之前
  seal: { key: 'zhi', label: '智' },
  state: { zhiCount: 0 },
  className: 'ch-zhi',
  html: `
    <div class="ch-head">
      <span class="ch-no">智</span>
      <div class="ch-name">
        <h2>辽智 · 智绘诗签</h2>
        <p>选一个主题，让「智绘」为你即兴生成国潮诗签</p>
      </div>
    </div>
    <div class="zhi-stage">
      <div class="zhi-themes" id="zhiThemes"></div>
      <div class="zhi-card-wrap">
        <img class="zhi-card" id="zhiCard" alt="智绘诗签" />
        <div class="zhi-loading" id="zhiLoading" hidden><i></i><i></i><i></i><b>智绘生成中…</b></div>
        <div class="zhi-placeholder" id="zhiPlaceholder">选主题 · 点「智绘生成」</div>
      </div>
      <div class="zhi-actions">
        <button class="btn solid" id="zhiGen">智绘生成</button>
        <button class="btn ghost" id="zhiSave" hidden>保存诗签</button>
      </div>
      <div class="zhi-meta">
        <span class="zhi-count" id="zhiCountLabel">智绘 0 / ${NEED}</span>
        <button class="zhi-how" id="zhiHow">这是 AI 吗？ ⓘ</button>
      </div>
    </div>
    <div class="stamp" id="stampZhi">智绘<br/>成签</div>
    <div class="modal" id="zhiHowModal" hidden>
      <div class="modal-card zhi-how-card">
        <h3>关于「智绘」生成</h3>
        <p style="text-align:left">
          本诗签由<b>运行在你手机本地的生成算法</b>即时拼成：<br/>
          ① 按你选的<b>主题</b>取对应意象词库；<br/>
          ② 用<b>加权随机</b>抽取平行意象，套入<b>对仗模板</b>组成上下联；<br/>
          ③ 匹配横批与祝福，避免与上一签重复。<br/><br/>
          它<b>不联网、不调用云端大模型</b>，是一种可离线运行的端上智能生成——
          呼应大赛「智绘」主题：以算法与交互重新表达传统。
        </p>
        <button class="btn solid" id="zhiHowClose">明白了</button>
      </div>
    </div>
  `,
  init() {
    const themesWrap = document.getElementById('zhiThemes');
    const cardImg = document.getElementById('zhiCard');
    const loading = document.getElementById('zhiLoading');
    const placeholder = document.getElementById('zhiPlaceholder');
    const genBtn = document.getElementById('zhiGen');
    const saveBtn = document.getElementById('zhiSave');
    const countLabel = document.getElementById('zhiCountLabel');
    const howBtn = document.getElementById('zhiHow');
    const howModal = document.getElementById('zhiHowModal');
    const howClose = document.getElementById('zhiHowClose');
    const stampEl = document.getElementById('stampZhi');
    if (!themesWrap) return;

    let currentTheme = 'jing';
    let currentSign = null;
    let busy = false;

    // 主题切换按钮
    themesWrap.innerHTML = '';
    Object.entries(THEMES).forEach(([key, t], i) => {
      const b = document.createElement('button');
      b.className = 'zhi-theme' + (i === 1 ? ' on' : '');
      b.dataset.theme = key;
      b.textContent = t.name.split(' · ')[0];
      themesWrap.appendChild(b);
    });
    // 默认选中 jing（index 1）
    currentTheme = 'jing';
    const themeBtns = [...themesWrap.querySelectorAll('.zhi-theme')];
    themeBtns.forEach((b) => b.addEventListener('click', () => {
      themeBtns.forEach((x) => x.classList.toggle('on', x === b));
      currentTheme = b.dataset.theme;
      pluck();
    }));

    function refreshCount() {
      countLabel.textContent = `智绘 ${Math.min(state.zhiCount, NEED)} / ${NEED}`;
    }

    function maybeComplete() {
      if (state.zhiCount >= NEED && !state.seals.zhi) {
        unlockSeal('zhi');
        stampEl?.classList.add('show');
        gong();
        setTimeout(success, 450);
      }
    }

    function showSign(sign) {
      currentSign = sign;
      const canvas = buildSignCanvas(sign);
      cardImg.src = canvas.toDataURL('image/jpeg', 0.92);
      cardImg.classList.add('show');
      placeholder.hidden = true;
      saveBtn.hidden = false;
    }

    function doGenerate() {
      if (busy) return;
      busy = true;
      genBtn.disabled = true;
      loading.hidden = false;
      cardImg.classList.remove('show');
      placeholder.hidden = true;
      chime();
      // 模拟“智绘”推理节奏（纯本地，短延时以呈现生成观感）
      setTimeout(() => {
        const sign = generate(currentTheme);
        loading.hidden = true;
        showSign(sign);
        pop();
        state.zhiCount = (state.zhiCount || 0) + 1;
        persist();
        refreshCount();
        maybeComplete();
        genBtn.textContent = '再生成一签';
        genBtn.disabled = false;
        busy = false;
      }, 620);
    }

    genBtn.addEventListener('click', doGenerate);

    saveBtn.addEventListener('click', () => {
      if (!currentSign) return;
      pluck();
      const canvas = buildSignCanvas(currentSign);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = '辽卷·智绘诗签.jpg';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        success();
      }, 'image/jpeg', 0.95);
    });

    howBtn.addEventListener('click', () => { howModal.hidden = false; pluck(); });
    howClose.addEventListener('click', () => { howModal.hidden = true; pluck(); });
    howModal.addEventListener('click', (e) => { if (e.target === howModal) howModal.hidden = true; });

    refreshCount();
    if (state.seals.zhi) {
      stampEl?.classList.add('show');
      genBtn.textContent = '再生成一签';
    }
  },
});
