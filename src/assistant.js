// 卷灵 · AI 智游助手：纯前端规则引擎（内置知识库 + 关键词匹配 + 章节跳转），离线可用。
import './assistant.css';
import { pluck, pop } from './audio.js';

// —— 知识库：关键词 → 预置答案（可带章节跳转 go）——
const KB = [
  { keys: ['你是谁', '卷灵', '助手', '你好', '在吗', 'hi', 'hello'], a: '我是「卷灵」——《辽·卷》的智游小助手。我能给你讲讲每一章的门道、辽宁的风物，还能带你直达任意一章。试试问我「怎么玩」「有哪些印章」，或点下面的快捷问题～' },
  { keys: ['什么作品', '这是什么', '介绍', '简介', '关于'], a: '《辽·卷 — 指尖上的辽宁》是一幅可用指尖滑动展开的国潮互动长卷：从剪纸、山河、皮影、辽味，到辽史、群英、非遗、矿珍、方言、古塔、脸谱、智绘诗签……共 21 屏、20 枚游印，最后合成你专属的国潮明信片。主题是「传承 · 智绘 · 融合」。' },
  { keys: ['怎么玩', '玩法', '如何', '教程', '开始'], a: '很简单：像刷短视频一样上滑，逐屏体验。每一章有一个小互动（剪、点、涂、答、拼…），完成即点亮一枚印章；集齐全部印章会放礼花，终章还能生成并保存你的国潮明信片。' },
  { keys: ['印章', '印', '进度', '收集', '几枚', '多少'], a: '共 20 枚游印：风·景·韵·味·瓷·冰·鼓·史·英·艺·宝·俗·言·塔·图·字·脸·鲜·智·星。右上角药丸实时显示「已集 N / 20」，进度会自动存到本地，下次打开接着玩。' },
  { keys: ['明信片', '保存', '下载', '分享', '图片'], a: '走到终章「卷成 · 留印」，系统会用 Canvas 把你的游历合成一张 1080×1920 的国潮明信片，点「保存明信片」即可下载分享。智绘诗签那一章也能单独保存诗签图。', go: 'final' },
  { keys: ['ai', '智绘', '人工智能', '生成', '算法', '大模型'], a: '「智绘」体现在两处：① 智绘诗签章用「端上生成算法」（模板+词库+加权随机）即时拼出国潮诗联；② 我（卷灵）是纯前端规则引擎。二者都<b>离线运行、不调用云端大模型</b>，如实标注为端上算法——这正契合大赛「智绘」而又诚信合规。', go: 'zhi' },
  { keys: ['融合', '主题', '传承', '创新', '亮点'], a: '「传承」是把非遗、山河、历史、人物、辽味搬进作品；「智绘」是用算法与交互重新表达；「融合」是让传统纹样与现代 H5 手势、程序化美术在同一块屏上共生。后 12 章更是零图片、全程序化自绘。' },
  { keys: ['离线', '联网', '网络', '流量', '断网'], a: '整个作品纯前端、可离线运行：音效由 Web Audio 实时合成，后半程美术全靠代码绘制，连「智绘」也是本地算法。断网也能顺畅玩，只是网络字体会回退成系统宋体。' },
  { keys: ['辽宁', '概况', '有啥', '特色', '文化'], a: '辽宁地处关外，山海形胜、底蕴深厚：红山文化的曙光、契丹辽国、清朝肇兴、共和国工业长子；有满族剪纸、凌源皮影、辽瓷、东北大鼓等非遗，红海滩、本溪水洞、辽塔古建等胜景，还有锅包肉、南果梨、大连海参等风物。' },
  // —— 各章跳转 ——
  { keys: ['剪纸', '窗花', '辽风', '满族剪纸'], a: '「辽风 · 剪纸」：用手指在红纸上来回滑动，剪出一扇满族窗花。', go: 'feng' },
  { keys: ['四景', '山河', '辽景', '红海滩', '水洞', '断桥', '滨海'], a: '「辽景 · 山河」：横滑视差长卷，点亮红海滩、本溪水洞、鸭绿江断桥、大连滨海四景。', go: 'jing' },
  { keys: ['皮影', '辽韵', '走台'], a: '「辽韵 · 皮影」：拖动影人走台、轻点听一声锣，重温凌源灯影。', go: 'yun' },
  { keys: ['辽味', '美食', '好吃', '饺子', '锅包肉', '熏鸡', '四宝'], a: '「辽味 · 四宝」：点选老边饺子、沟帮子熏鸡、锅包肉、渤海飞蟹，收入食盒。', go: 'wei' },
  { keys: ['辽瓷', '点釉', '青花', '瓷'], a: '「辽瓷 · 千峰翠色」：轻点涂抹瓶身点釉显色。', go: 'ci' },
  { keys: ['辽冰', '雪花', '踏雪', '冰嬉', '雪'], a: '「辽冰 · 踏雪寻梅」：点住飘落的雪花，集齐十二片。', go: 'bing' },
  { keys: ['辽戏', '击鼓', '大鼓', '鼓', '节拍'], a: '「辽戏 · 鼓韵」：跟着节拍连击东北大鼓十二记。', go: 'gu' },
  { keys: ['辽史', '历史', '长河', '红山', '契丹', '盛京'], a: '「辽史 · 长河」：顺时间轴点亮红山文化→契丹立辽→清肇兴京→工业辽宁等里程碑。', go: 'shi' },
  { keys: ['群英', '人物', '名人', '萧太后', '努尔哈赤', '张学良', '雷锋', '曹雪芹'], a: '「辽脉 · 群英」：点将台上逐一点亮关外群英，看他们的生平。', go: 'ren' },
  { keys: ['百工', '非遗', '手工', '玉雕', '玛瑙', '刺绣', '贝雕', '年画'], a: '「辽艺 · 百工」：翻牌集齐岫岩玉雕、阜新玛瑙、满族刺绣、大连贝雕等非遗百工。', go: 'yi' },
  { keys: ['矿', '矿珍', '菱镁', '金刚石', '煤', '铁', '岫玉'], a: '「辽宝 · 矿珍」：刷开岩层，采出关外地下矿藏。', go: 'bao' },
  { keys: ['社火', '秧歌', '扭'], a: '「辽俗 · 社火」：跟着金圈鼓点，点屏扭起东北大秧歌。', go: 'su' },
  { keys: ['方言', '唠嗑', '东北话', '整两口', '埋汰'], a: '「辽言 · 唠嗑」：东北方言趣味问答，答对过半算你地道。', go: 'yan' },
  { keys: ['辽塔', '古塔', '白塔', '北塔', '古建'], a: '「辽塔 · 古建」：点亮辽阳白塔、朝阳北塔等程序化自绘的密檐砖塔。', go: 'ta' },
  { keys: ['十四市', '地图', '城市', '地市', '沈阳', '大连', '几个市'], a: '「辽图 · 十四市」：点开辽宁十四座地级市，看一句风物简介。', go: 'tu' },
  { keys: ['墨宝', '书法', '描红', '写字', '毛笔'], a: '「辽字 · 墨宝」：以指为笔，在宣纸上蘸墨描红一个「辽」字。', go: 'zi' },
  { keys: ['脸谱', '开脸', '戏曲', '点色'], a: '「辽韵 · 脸谱」：轻点分区，为戏曲脸谱点色开脸。', go: 'lian' },
  { keys: ['山珍', '特产', '南果梨', '草莓', '海参', '河蟹', '林蛙', '板栗'], a: '「辽鲜 · 山珍」：点选南果梨、丹东草莓、大连海参等山海时鲜，收入食篓。', go: 'xian' },
  { keys: ['诗签', '智绘诗签', '对联', '祝福', '生成诗'], a: '「辽智 · 智绘诗签」：选一个主题，端上算法即兴为你生成国潮诗联，可保存分享。', go: 'zhi' },
  { keys: ['星空', '尾声', '致谢', '结束', '星', '结尾'], a: '「辽星 · 尾声」：点亮夜空繁星连成星河，为这趟关外之旅收束。', go: 'xing' },
];

const CHIPS = ['这是什么作品？', '怎么玩？', '有哪些印章？', '带我去智绘诗签', '辽宁有啥好吃的？'];

const FALLBACK = '这个我还没学会呢～你可以问我：某一章怎么玩（如「皮影」「智绘诗签」）、有哪些印章、怎么保存明信片，或者让我「带你去」任意一章。';

function match(text) {
  const q = (text || '').toLowerCase().trim();
  if (!q) return null;
  for (const item of KB) {
    if (item.keys.some((k) => q.includes(k.toLowerCase()))) return item;
  }
  return null;
}

function gotoSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

export function initAssistant() {
  const host = document.getElementById('app') || document.body;

  const fab = document.createElement('button');
  fab.className = 'jl-fab';
  fab.id = 'jlFab';
  fab.setAttribute('aria-label', '打开智游助手 卷灵');
  fab.innerHTML = '<span class="jl-fab-face">卷<br/>灵</span>';

  const panel = document.createElement('div');
  panel.className = 'jl-panel';
  panel.id = 'jlPanel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="jl-head">
      <span class="jl-avatar">灵</span>
      <div class="jl-title"><b>卷灵</b><i>智游助手 · 离线可用</i></div>
      <button class="jl-close" id="jlClose" aria-label="收起">×</button>
    </div>
    <div class="jl-msgs" id="jlMsgs"></div>
    <div class="jl-chips" id="jlChips"></div>
    <form class="jl-input" id="jlForm">
      <input id="jlText" type="text" autocomplete="off" placeholder="问问卷灵，或让我带你去某章…" />
      <button type="submit" class="jl-send" aria-label="发送">➤</button>
    </form>
  `;

  host.appendChild(fab);
  host.appendChild(panel);

  const msgs = panel.querySelector('#jlMsgs');
  const chipsWrap = panel.querySelector('#jlChips');
  const form = panel.querySelector('#jlForm');
  const input = panel.querySelector('#jlText');

  function addMsg(who, htmlText, go) {
    const row = document.createElement('div');
    row.className = `jl-msg ${who}`;
    const bubble = document.createElement('div');
    bubble.className = 'jl-bubble';
    bubble.innerHTML = htmlText;
    row.appendChild(bubble);
    if (go && document.getElementById(go)) {
      const btn = document.createElement('button');
      btn.className = 'jl-goto';
      btn.textContent = '▶ 带我去这一章';
      btn.addEventListener('click', () => { pop(); gotoSection(go); close(); });
      bubble.appendChild(btn);
    }
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function respond(text) {
    addMsg('me', text.replace(/</g, '&lt;'));
    const hit = match(text);
    setTimeout(() => {
      if (hit) addMsg('bot', hit.a, hit.go);
      else addMsg('bot', FALLBACK);
    }, 260);
  }

  function renderChips() {
    chipsWrap.innerHTML = '';
    CHIPS.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'jl-chip';
      b.textContent = c;
      b.addEventListener('click', () => { respond(c); });
      chipsWrap.appendChild(b);
    });
  }

  let greeted = false;
  function open() {
    panel.hidden = false;
    fab.classList.add('active');
    pluck();
    if (!greeted) {
      greeted = true;
      addMsg('bot', '你好，我是卷灵～这幅《辽·卷》里藏着 20 枚游印。想了解哪一章，或者让我带你去逛逛？');
      renderChips();
    }
    setTimeout(() => input.focus(), 120);
  }
  function close() {
    panel.hidden = true;
    fab.classList.remove('active');
  }

  fab.addEventListener('click', () => (panel.hidden ? open() : close()));
  panel.querySelector('#jlClose').addEventListener('click', close);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    respond(v);
    input.value = '';
  });
}
