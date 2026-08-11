// Web Audio 轻量音效合成：无外部音频文件，包体为零
let ctx = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// 首次触摸时预热（移动端自动播放策略）
export function warmup() {
  try { ac(); } catch { /* 不支持则全程静音 */ }
}

function tone({ freq = 440, type = 'sine', dur = 0.3, gain = 0.2, when = 0, sweep = 0 }) {
  try {
    const c = ac();
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch { /* noop */ }
}

// 一声锣：基音 + 失谐泛音 + 长衰减
export function gong() {
  tone({ freq: 160, type: 'sine', dur: 1.4, gain: 0.3 });
  tone({ freq: 227, type: 'sine', dur: 1.1, gain: 0.14 });
  tone({ freq: 341, type: 'triangle', dur: 0.8, gain: 0.08 });
  tone({ freq: 96, type: 'sine', dur: 1.6, gain: 0.18 });
}

// 短促弹拨（点击反馈）
export function pluck() {
  tone({ freq: 660, type: 'triangle', dur: 0.16, gain: 0.16, sweep: -160 });
}

// 收集"啵"声
export function pop() {
  tone({ freq: 300, type: 'sine', dur: 0.14, gain: 0.22, sweep: 320 });
}

// 剪纸沙沙声（滑动时节流调用）
export function snip() {
  tone({ freq: 1900 + Math.random() * 700, type: 'triangle', dur: 0.05, gain: 0.045 });
}

// 一记鼓：低频冲击 + 短噪声敲击感
export function drum() {
  try {
    const c = ac();
    const t0 = c.currentTime;
    // 鼓身低频
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.18);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.5, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.4);
    // 鼓面敲击噪声
    const dur = 0.09;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const noise = c.createBufferSource();
    noise.buffer = buf;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.25, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    noise.connect(ng).connect(c.destination);
    noise.start(t0);
  } catch { /* noop */ }
}

// 清脆瓷音（点釉反馈）
export function chime() {
  tone({ freq: 880 + Math.random() * 220, type: 'sine', dur: 0.5, gain: 0.12 });
  tone({ freq: 1320, type: 'sine', dur: 0.35, gain: 0.06 });
}

// 五声音阶上行：达成成就
export function success() {
  const scale = [523.25, 587.33, 659.25, 783.99, 1046.5]; // 宫商角徵 + 高宫
  scale.forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.34, gain: 0.16, when: i * 0.09 }));
  tone({ freq: 130, type: 'sine', dur: 1.1, gain: 0.12, when: 0.36 });
}
