// 辽言 · 唠嗑：东北方言趣味问答，答对过半即成印（自注册章节）
import './liaoyan.css';
import { registerChapter } from '../registry.js';
import { state, unlockSeal, persist } from '../state.js';
import { pluck, pop, gong, success } from '../audio.js';

export const QUIZ = [
  { q: '“整两口”里的“整”，最贴切的意思是？', opts: ['整理', '喝 / 弄', '完整', '严肃'], a: 1,
    tip: '“整”是东北话的万能动词：整点饭、整明白、整两口——啥都能“整”。' },
  { q: '老铁说菜“埋汰”了，是指菜？', opts: ['很好吃', '不新鲜/脏', '分量足', '太辣'], a: 1,
    tip: '“埋汰(mái tai)”＝脏、不干净，也可引申为言语上损人。' },
  { q: '“你可拉倒吧”表达的是？', opts: ['热情邀请', '不相信/别扯了', '让人坐下', '夸赞'], a: 1,
    tip: '“拉倒吧”是经典的不以为然，约等于“得了吧、别闹了”。' },
  { q: '“这嘎达”指的是？', opts: ['这个东西', '这地方', '这时候', '这个人'], a: 1,
    tip: '“嘎达(gá da)”＝地方。“你在哪嘎达？”就是“你在哪儿”。' },
  { q: '夸人“这人真敞亮”，是说他？', opts: ['长得高', '大方爽快', '爱干净', '声音大'], a: 1,
    tip: '“敞亮”形容人豪爽、大气、不小气，是地道的褒义。' },
  { q: '“得(děi)瑟”通常形容？', opts: ['勤快能干', '显摆/张扬', '沉稳老实', '生病难受'], a: 1,
    tip: '“得瑟”＝显摆、张扬折腾，常带一点儿嗔怪的亲昵。' },
  { q: '“贼拉好吃”里的“贼拉”是？', opts: ['偷偷地', '非常/特别', '勉强', '一点点'], a: 1,
    tip: '“贼(拉)”＝很、非常。贼好、贼冷、贼拉香，程度拉满。' },
  { q: '“你咋整的？”里“咋整”意思最接近？', opts: ['怎么弄的', '在哪儿', '什么时候', '为谁'], a: 0,
    tip: '“咋整”＝怎么办 / 怎么弄，东北话的高频疑问。' },
  { q: '“整个大金链子——嘚瑟”这话的味道是？', opts: ['羡慕赞叹', '善意调侃', '严肃批评', '毫无感情'], a: 1,
    tip: '东北话的精髓在于幽默与自嘲，调侃里全是亲近劲儿。' },
];

const PASS = Math.ceil(QUIZ.length / 2); // 答对过半即通关

registerChapter({
  id: 'yan',
  order: 30,
  seal: { key: 'yan', label: '言' },
  state: { dialectScore: 0 },
  className: 'ch-dialect',
  html: `
    <div class="ch-head">
      <span class="ch-no">言</span>
      <div class="ch-name">
        <h2>辽言 · 唠嗑</h2>
        <p>唠几句东北话，答对过半算你地道</p>
      </div>
    </div>
    <div class="yan-stage" id="yanStage">
      <div class="yan-top">
        <span class="yan-no" id="yanNo"></span>
        <span class="yan-score" id="yanScore"></span>
      </div>
      <div class="yan-q" id="yanQ"></div>
      <div class="yan-opts" id="yanOpts"></div>
      <div class="yan-tip" id="yanTip"></div>
      <button class="yan-next" id="yanNext" hidden>下一唠</button>
    </div>
    <div class="stamp" id="stampYan">唠嗑<br/>入卷</div>
  `,
  init() {
    const stage = document.getElementById('yanStage');
    const stampEl = document.getElementById('stampYan');
    if (!stage) return;

    const qNo = document.getElementById('yanNo');
    const qText = document.getElementById('yanQ');
    const optWrap = document.getElementById('yanOpts');
    const tipEl = document.getElementById('yanTip');
    const nextBtn = document.getElementById('yanNext');
    const scoreEl = document.getElementById('yanScore');

    let idx = 0, correct = 0, answered = false;

    function renderScore() { scoreEl.textContent = `唠对 ${correct} / ${QUIZ.length}`; }

    function finish() {
      state.dialectScore = Math.max(state.dialectScore, correct);
      persist();
      optWrap.innerHTML = '';
      qNo.textContent = '唠完';
      const passed = correct >= PASS;
      qText.textContent = passed ? '中！你这东北话，地道！' : '差点意思，回头再唠唠～';
      tipEl.textContent = `本轮唠对 ${correct} / ${QUIZ.length} 题`;
      tipEl.classList.add('show');
      nextBtn.textContent = '再唠一轮';
      nextBtn.hidden = false;
      nextBtn.onclick = () => { idx = 0; correct = 0; renderScore(); render(); pluck(); };
      if (passed && !state.seals.yan) {
        unlockSeal('yan');
        stampEl?.classList.add('show');
        gong();
        setTimeout(success, 450);
      }
    }

    function render() {
      answered = false;
      const item = QUIZ[idx];
      qNo.textContent = `第 ${idx + 1} / ${QUIZ.length} 唠`;
      qText.textContent = item.q;
      tipEl.classList.remove('show');
      tipEl.textContent = '';
      nextBtn.hidden = true;
      optWrap.innerHTML = '';
      item.opts.forEach((opt, i) => {
        const b = document.createElement('button');
        b.className = 'yan-opt';
        b.textContent = opt;
        b.onclick = () => choose(b, i, item);
        optWrap.appendChild(b);
      });
    }

    function choose(btn, i, item) {
      if (answered) return;
      answered = true;
      const all = [...optWrap.querySelectorAll('.yan-opt')];
      all.forEach((b, k) => {
        b.disabled = true;
        if (k === item.a) b.classList.add('right');
      });
      if (i === item.a) { correct++; pop(); }
      else { btn.classList.add('wrong'); pluck(); }
      renderScore();
      tipEl.textContent = item.tip;
      tipEl.classList.add('show');
      nextBtn.textContent = idx < QUIZ.length - 1 ? '下一唠' : '看结果';
      nextBtn.hidden = false;
      nextBtn.onclick = () => {
        pluck();
        if (idx < QUIZ.length - 1) { idx++; render(); }
        else finish();
      };
    }

    renderScore();
    render();
    if (state.seals.yan) stampEl?.classList.add('show');
  },
});
