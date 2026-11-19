/* Interactive lesson widgets. A lesson body includes [[widget:name]]; app.js mounts it. */
window.Widgets = window.Widgets || {};
const Widgets = window.Widgets;

/* Ball throw: predict the height, throw, see the truth, find the pattern. */
Widgets['ball-throw'] = function (root) {
  const G = 10, MAXV = 40, MAXH = MAXV * MAXV / (2 * G); // 80 m
  root.innerHTML = `
    <div class="widget">
      <canvas class="sim"></canvas>
      <div class="controls">
        <label>Throw speed <b class="vlabel">20</b> m/s<input class="speed" type="range" min="5" max="${MAXV}" step="1" value="20"></label>
        <div></div>
        <label>Your guess: how high will it go? (metres)<input class="guess" type="number" min="0" step="1" placeholder="type a number, then throw"></label>
        <button class="throw">Throw</button>
        <div class="result"></div>
        <table class="rounds" style="display:none"><thead><tr><th>Speed</th><th>Your guess</th><th>Actual</th><th>Time in air</th></tr></thead><tbody></tbody></table>
        <div class="pattern" style="display:none"></div>
      </div>
    </div>`;
  const cv = root.querySelector('.sim'), ctx = cv.getContext('2d');
  const speed = root.querySelector('.speed'), vlabel = root.querySelector('.vlabel'), guess = root.querySelector('.guess');
  const btn = root.querySelector('.throw'), result = root.querySelector('.result'), table = root.querySelector('.rounds'), tbody = table.querySelector('tbody'), pattern = root.querySelector('.pattern');
  const rounds = []; let anim = null; const H = window.innerWidth >= 1400 ? 420 : 320;
  const stars = Array.from({ length: 40 }, () => [Math.random(), Math.random() * 0.6, Math.random() * 1.2 + 0.4]);

  function size() { const w = cv.clientWidth || 600; cv.width = w * devicePixelRatio; cv.height = H * devicePixelRatio; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }

  function thrower(px, py, swing) {
    // swing 0..1 : arm from wound-back to released overhead
    const armAng = Math.PI * 0.35 - swing * Math.PI * 0.95;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(px, py - 60, 10, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(px, py - 50); ctx.lineTo(px, py - 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px, py - 24); ctx.lineTo(px - 9, py); ctx.moveTo(px, py - 24); ctx.lineTo(px + 9, py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px, py - 44); ctx.lineTo(px - 14, py - 26); ctx.stroke();
    const ex = px + Math.cos(armAng) * 16, ey = py - 44 + Math.sin(armAng) * 16;
    ctx.beginPath(); ctx.moveTo(px, py - 44); ctx.lineTo(ex, ey); ctx.lineTo(ex + Math.cos(armAng - 0.5) * 14, ey + Math.sin(armAng - 0.5) * 14); ctx.stroke();
    // scarf
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(px - 8, py - 50); ctx.quadraticCurveTo(px, py - 44, px + 8, py - 50); ctx.lineTo(px + 7, py - 47); ctx.quadraticCurveTo(px, py - 41, px - 7, py - 47); ctx.closePath(); ctx.fill();
    return [ex + Math.cos(armAng - 0.5) * 14, ey + Math.sin(armAng - 0.5) * 14];
  }

  function draw(h, v, t, peak, swing = 0) {
    const W = cv.clientWidth || 600, ground = H - 34, scale = (ground - 44) / MAXH;
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, ground); sky.addColorStop(0, '#0b1526'); sky.addColorStop(0.6, '#1c3059'); sky.addColorStop(1, '#5a4a6a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; stars.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x * W, y * ground, r, 0, Math.PI * 2); ctx.fill(); });
    // height lines
    ctx.font = '12px "Public Sans", sans-serif'; ctx.textAlign = 'left';
    for (let m = 20; m <= MAXH; m += 20) { const y = ground - m * scale; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(44, y); ctx.lineTo(W - 12, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillText(m + ' m', 10, y + 4); }
    // ground
    const gr = ctx.createLinearGradient(0, ground, 0, H); gr.addColorStop(0, '#2f6b4f'); gr.addColorStop(1, '#1d4a36');
    ctx.fillStyle = gr; ctx.fillRect(0, ground, W, H - ground);
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(0, ground, W, 2);
    // guess line
    const g = Number(guess.value);
    if (g > 0) { const y = ground - Math.min(g, MAXH) * scale; ctx.strokeStyle = '#ff9a7a'; ctx.setLineDash([8, 6]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(44, y); ctx.lineTo(W - 12, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#ff9a7a'; ctx.textAlign = 'right'; ctx.fillText('your guess ' + g + ' m', W - 16, y - 6); }
    if (peak !== undefined) { const y = ground - peak * scale; ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(44, y); ctx.lineTo(W - 12, y); ctx.stroke(); ctx.fillStyle = '#ffd166'; ctx.textAlign = 'right'; ctx.font = '600 12px "Public Sans", sans-serif'; ctx.fillText('actual ' + peak + ' m', W - 16, y + 16); }
    // thrower + ball
    const [hx, hy] = thrower(W / 2 - 40, ground, swing);
    const bx = h > 0 || swing >= 1 ? W / 2 : hx, by = h > 0 || swing >= 1 ? ground - h * scale - 12 : hy;
    const glow = ctx.createRadialGradient(bx, by, 2, bx, by, 26); glow.addColorStop(0, 'rgba(255,209,102,.55)'); glow.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(bx, by, 26, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2); ctx.fillStyle = '#ffd166'; ctx.fill(); ctx.strokeStyle = '#c98f00'; ctx.lineWidth = 2; ctx.stroke();
    if (t !== undefined) { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '600 14px "Public Sans", sans-serif'; ctx.fillText(`${t.toFixed(1)} s   ·   ${Math.abs(v).toFixed(0)} m/s ${v > 0.5 ? '↑' : v < -0.5 ? '↓' : ''}`, W / 2, 26); }
  }
  size(); draw(0); window.addEventListener('resize', () => { size(); draw(0); });
  speed.oninput = () => { vlabel.textContent = speed.value; if (!anim) draw(0); };
  guess.oninput = () => { if (!anim) draw(0); };

  btn.onclick = () => {
    const g = Number(guess.value);
    if (!(g > 0)) { result.textContent = 'Type a guess first. Being wrong is the point.'; guess.focus(); return; }
    if (anim) return;
    const u = Number(speed.value), peak = u * u / (2 * G), T = 2 * u / G;
    const slow = 1.2, wind = 0.35; const t0 = performance.now();
    btn.disabled = true;
    if (window.Stickman) Stickman.set('throw', 1200);
    function frame(now) {
      const el = (now - t0) / 1000;
      if (el < wind) { draw(0, u, undefined, undefined, el / wind); anim = requestAnimationFrame(frame); return; }
      const t = Math.min(T, (el - wind) / slow);
      const h = u * t - 0.5 * G * t * t, v = u - G * t;
      draw(Math.max(0, h), v, t, t >= T ? peak : undefined, 1);
      if (t < T) anim = requestAnimationFrame(frame);
      else {
        anim = null; btn.disabled = false;
        rounds.push({ u, g, peak, T });
        tbody.insertAdjacentHTML('beforeend', `<tr><td>${u} m/s</td><td class="guessv">${g} m</td><td class="actualv">${peak} m</td><td>${T} s</td></tr>`);
        table.style.display = '';
        const off = Math.round(100 * Math.abs(g - peak) / peak);
        result.textContent = off <= 10 ? `Close: within ${off}%. Now try a very different speed.` : (g > peak ? `Too high by ${g - peak} m. Try a different speed and guess again.` : `Too low by ${peak - g} m. Try a different speed and guess again.`);
        if (window.Stickman) Stickman.react(off <= 10 ? 'right' : off <= 30 ? 'close' : 'wrong');
        guess.value = '';
        if (rounds.length >= 3) showPattern();
      }
    }
    anim = requestAnimationFrame(frame);
  };

  function showPattern() {
    const sorted = [...rounds].sort((a, b) => a.u - b.u);
    const lo = sorted[0], hi = sorted[sorted.length - 1];
    if (hi.u === lo.u) return;
    const r = (hi.u / lo.u).toFixed(1), rh = (hi.peak / lo.peak).toFixed(1);
    pattern.style.display = '';
    if (window.Stickman) Stickman.set('cheer', 3000);
    pattern.innerHTML = `<b>Look at your own table.</b> From ${lo.u} m/s to ${hi.u} m/s is ${r}× the speed, but the ball went ${rh}× as high. Time in the air only grew ${(hi.T / lo.T).toFixed(1)}×, the same as the speed.<br><br><b>Height grows with the square of the speed; time grows in a straight line with it.</b> You just discovered that. Keep reading to see what it is called.`;
  }
};

/* ===================== Animated explainer engine =====================
   [[widget:explainer:key]]  — scenes drawn on canvas, a caption per scene, Listen reads it. */
const SCENES = {};
Widgets['explainer'] = function (root, ctx, key) {
  const scenes = SCENES[key]; if (!scenes) { root.innerHTML = ''; return; }
  root.innerHTML = `<div class="widget explainer">
    <canvas class="sim"></canvas>
    <div class="controls" style="grid-template-columns:1fr auto auto;align-items:center">
      <div class="cap"><span class="n"></span><span class="t"></span></div>
      <button class="secondary replay">Replay</button><button class="next">Next</button>
    </div></div>`;
  const cv = root.querySelector('.sim'), c = cv.getContext('2d'), cap = root.querySelector('.cap .t'), num = root.querySelector('.cap .n');
  const nextB = root.querySelector('.next'), replayB = root.querySelector('.replay');
  const H = window.innerWidth >= 1400 ? 360 : 280; let i = 0, raf = null, t0 = 0;
  function size() { const w = cv.clientWidth || 600; cv.width = w * devicePixelRatio; cv.height = H * devicePixelRatio; c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }
  function play() {
    cancelAnimationFrame(raf); size(); const s = scenes[i]; cap.textContent = s.text; num.textContent = `${i + 1}/${scenes.length} `;
    nextB.textContent = i === scenes.length - 1 ? 'Done' : 'Next'; t0 = performance.now();
    if (window.Speech && Speech.ok && root.dataset.voice === 'on') Speech.say(s.text);
    const dur = s.dur || 3000;
    (function frame(now) { const p = Math.min(1, (now - t0) / dur); c.clearRect(0, 0, cv.clientWidth, H); s.draw(c, cv.clientWidth, H, p); if (p < 1) raf = requestAnimationFrame(frame); })(t0);
  }
  nextB.onclick = () => { if (i < scenes.length - 1) { i++; play(); if (window.Stickman) Stickman.set('talk', 1500); } else { nextB.disabled = true; if (window.Stickman) Stickman.react('right'); } };
  replayB.onclick = () => { nextB.disabled = false; play(); };
  window.addEventListener('resize', () => play());
  root.dataset.voice = 'on';
  play();
};

/* drawing helpers */
const D = {
  bg(c, W, H) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1526'); g.addColorStop(1, '#1c3059'); c.fillStyle = g; c.fillRect(0, 0, W, H); },
  ground(c, W, H, y) { c.fillStyle = '#2f6b4f'; c.fillRect(0, y, W, H - y); },
  ball(c, x, y, r = 10) { const g = c.createRadialGradient(x, y, 2, x, y, r * 2.6); g.addColorStop(0, 'rgba(255,209,102,.55)'); g.addColorStop(1, 'rgba(255,209,102,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.6, 0, 7); c.fill(); c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = '#ffd166'; c.fill(); c.strokeStyle = '#c98f00'; c.lineWidth = 2; c.stroke(); },
  arrow(c, x, y, dx, dy, color = '#fff', w = 3) { const L = Math.hypot(dx, dy); if (L < 2) return; c.strokeStyle = color; c.fillStyle = color; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx, y + dy); c.stroke(); const a = Math.atan2(dy, dx); c.beginPath(); c.moveTo(x + dx, y + dy); c.lineTo(x + dx - 10 * Math.cos(a - .5), y + dy - 10 * Math.sin(a - .5)); c.lineTo(x + dx - 10 * Math.cos(a + .5), y + dy - 10 * Math.sin(a + .5)); c.closePath(); c.fill(); },
  text(c, s, x, y, o = {}) { c.fillStyle = o.color || '#fff'; c.font = `${o.weight || 500} ${o.size || 14}px "Public Sans", sans-serif`; c.textAlign = o.align || 'center'; c.fillText(s, x, y); },
  chip(c, s, x, y, o = {}) { c.font = `${o.weight || 600} ${o.size || 15}px "Public Sans", sans-serif`; const w = c.measureText(s).width + 20, h = 30; c.fillStyle = o.bg || '#ffd166'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 8); c.fill(); c.fillStyle = o.color || '#1b2233'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, x, y); c.textBaseline = 'alphabetic'; return w; },
  ease: p => 1 - Math.pow(1 - p, 3),
};

/* --- kinematics explainer --- */
SCENES.kinematics = [
  { text: 'Throw a ball up at 20 m/s. Every second, gravity takes 10 m/s off its speed.', dur: 3200, draw(c, W, H, p) {
      D.bg(c, W, H); const gy = H - 30; D.ground(c, W, H, gy); const t = p * 2, h = 20 * t - 5 * t * t, v = 20 - 10 * t;
      const x = W / 2, y = gy - 14 - h * (gy - 60) / 22; D.ball(c, x, y); D.arrow(c, x + 34, y, 0, -v * 3.2, '#ffd166', 4);
      D.text(c, `${v.toFixed(0)} m/s`, x + 34, y + 22, { color: '#ffd166', weight: 700 }); D.text(c, `t = ${t.toFixed(1)} s`, 60, 30, { align: 'left' });
      D.text(c, 'gravity', W - 70, 40, { color: '#ff9a7a' }); D.arrow(c, W - 70, 48, 0, 40, '#ff9a7a', 3); } },
  { text: 'At the very top it stops for an instant. Speed zero. Gravity is still pulling, so it comes straight back.', dur: 3000, draw(c, W, H, p) {
      D.bg(c, W, H); const gy = H - 30; D.ground(c, W, H, gy); const x = W / 2, top = 60; D.ball(c, x, top, 10 + Math.sin(p * 6) * 1.5);
      D.text(c, '0 m/s', x + 34, top + 5, { color: '#ffd166', weight: 700 }); D.text(c, 'gravity still on', W - 90, 40, { color: '#ff9a7a' }); D.arrow(c, W - 90, 48, 0, 40, '#ff9a7a', 3);
      D.text(c, 'height = 20 m', x, gy - 10, { color: 'rgba(255,255,255,.7)' }); } },
  { text: 'Double the speed to 40 m/s: it climbs for twice as long AND it is moving faster the whole way. Twice × twice = four times the height.', dur: 3600, draw(c, W, H, p) {
      D.bg(c, W, H); const gy = H - 30; D.ground(c, W, H, gy); const e = D.ease(p); const sc = (gy - 60) / 80;
      const h1 = 20 * e, h2 = 80 * e; D.ball(c, W * .32, gy - 14 - h1 * sc); D.ball(c, W * .68, gy - 14 - h2 * sc);
      D.text(c, '20 m/s', W * .32, gy + 20, { color: '#ffd166' }); D.text(c, '40 m/s', W * .68, gy + 20, { color: '#ffd166' });
      if (p > .9) { D.chip(c, '20 m', W * .32, gy - 40 - h1 * sc); D.chip(c, '80 m  (4×)', W * .68, gy - 40 - h2 * sc); } } },
  { text: 'That is the whole secret: height grows with the SQUARE of the speed. Time in the air just doubles.', dur: 2500, draw(c, W, H, p) {
      D.bg(c, W, H); D.text(c, 'height = u² ÷ 2g', W / 2, H / 2 - 16, { size: 30, weight: 700, color: '#ffd166' }); D.text(c, 'time = 2u ÷ g', W / 2, H / 2 + 30, { size: 22, color: '#fff' });
      if (p > .5) D.text(c, 'u is the throw speed, g is 10 m/s²', W / 2, H / 2 + 64, { color: 'rgba(255,255,255,.6)' }); } },
];

/* --- how an AI model works --- */
SCENES.llm = [
  { text: 'Step 1: your words are chopped into tokens — small pieces, roughly word-sized.', dur: 3000, draw(c, W, H, p) {
      D.bg(c, W, H); const words = ['Chennai', 'is', 'famous', 'for', 'its', 'filter', 'coffee']; const n = Math.floor(p * words.length + .999);
      let x = 40; words.forEach((w, i) => { const col = i < n ? '#ffd166' : 'rgba(255,255,255,.15)'; const wd = D.chip(c, w, x + 40, H / 2, { bg: col, color: i < n ? '#1b2233' : 'rgba(255,255,255,.4)' }); x += wd + 10; }); } },
  { text: 'Step 2: each token becomes a list of numbers. The model only ever sees numbers.', dur: 3000, draw(c, W, H, p) {
      D.bg(c, W, H); const e = D.ease(p); const words = ['filter', 'coffee']; words.forEach((w, i) => { const y = H * (.35 + .3 * i); D.chip(c, w, 90, y);
        const nums = ['0.21', '-1.07', '0.88', '…', '0.05']; nums.forEach((nm, j) => { if (e * nums.length > j) D.text(c, nm, 190 + j * 60, y + 5, { color: '#9ecbff', size: 16 }); }); }); } },
  { text: 'Step 3: it predicts the next token. Then adds it, and predicts again. One token at a time.', dur: 3600, draw(c, W, H, p) {
      D.bg(c, W, H); const s = 'Chennai is famous for its'; const nxt = [['filter', 61], ['beaches', 14], ['temples', 9], ['heat', 6]]; D.text(c, s + ' ▌', 40, 60, { align: 'left', size: 20, weight: 600 });
      nxt.forEach(([w, pc], i) => { const y = 110 + i * 38; const bw = (W - 220) * (pc / 100) * D.ease(Math.min(1, p * 1.4)); c.fillStyle = i === 0 ? '#ffd166' : 'rgba(255,255,255,.25)'; c.beginPath(); c.roundRect(150, y - 14, bw, 24, 6); c.fill(); D.text(c, w, 140, y + 4, { align: 'right', size: 16 }); D.text(c, pc + '%', 160 + bw, y + 4, { align: 'left', color: 'rgba(255,255,255,.7)' }); });
      if (p > .85) D.chip(c, 'picks "filter"', W - 110, H - 30); } },
  { text: 'Step 4: it does not look anything up. It produces what sounds likely — so it can be fluent and wrong. That is a hallucination.', dur: 3200, draw(c, W, H, p) {
      D.bg(c, W, H); D.text(c, 'Q: When was my school founded?', 40, 60, { align: 'left', size: 18, weight: 600 });
      const a = 'A: Your school was founded in 1962 by'; const n = Math.floor(p * a.length); D.text(c, a.slice(0, n) + (p < 1 ? '▌' : ''), 40, 110, { align: 'left', size: 18, color: '#ffd166' });
      if (p > .95) { D.text(c, '…confident. Fluent. Made up.', 40, 160, { align: 'left', size: 18, color: '#ff9a7a', weight: 700 }); D.text(c, 'Always check facts you have not verified.', 40, 200, { align: 'left', color: 'rgba(255,255,255,.7)' }); } } },
];

/* ===================== Next-word toy ===================== */
Widgets['nextword'] = function (root) {
  const corpus = `chennai is famous for its filter coffee. chennai is famous for its beaches. chennai is famous for its temples. chennai is hot in may. the ball goes up and comes down. the ball goes up and stops at the top. gravity pulls the ball down. gravity pulls everything down. my school is near the beach. my school is famous for cricket. my school starts at eight. cricket is popular in india. india won the match yesterday. india won the world cup. the exam is on monday. the exam is hard but fair. physics is about why things move. physics is fun when you throw things. ai predicts the next word. ai predicts one token at a time. ai can be wrong. ai can be confident and wrong. the teacher said read the question twice. the teacher said guess first. i like filter coffee. i like physics now. the speed doubles and the height goes four times. the height depends on the square of the speed. the next word is chosen by probability. the model picks the most likely word.`;
  const sents = corpus.split('.').map(s => s.trim()).filter(Boolean).map(s => ['<s>', ...s.split(/\s+/), '</s>']);
  const bi = {}; sents.forEach(w => { for (let i = 0; i < w.length - 1; i++) { (bi[w[i]] = bi[w[i]] || {}); bi[w[i]][w[i + 1]] = (bi[w[i]][w[i + 1]] || 0) + 1; } });
  const top = w => { const m = bi[w] || bi['<s>']; const tot = Object.values(m).reduce((a, b) => a + b, 0); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => [k, Math.round(100 * v / tot)]); };
  root.innerHTML = `<div class="widget nextword"><div class="controls" style="grid-template-columns:1fr">
    <label>Start a sentence (try: <i>chennai is</i>, <i>the ball</i>, <i>ai can</i>)<input class="seed" placeholder="type two or three words"></label>
    <div class="cands"></div>
    <div class="out"></div>
    <div class="row"><button class="go">Let it write</button><button class="secondary step">One word at a time</button></div>
    <div class="result">This toy knows 30 sentences. ChatGPT knows most of the internet. Same idea: predict the next piece, repeat.</div></div></div>`;
  const seed = root.querySelector('.seed'), cands = root.querySelector('.cands'), out = root.querySelector('.out');
  let words = [];
  function render() { out.innerHTML = words.map((w, i) => `<span class="tok ${i >= seedLen ? 'gen' : ''}">${w}</span>`).join(' '); const last = words[words.length - 1] || '<s>'; const t = top(last); cands.innerHTML = `<div class="small" style="opacity:.7;margin-bottom:6px">After “${last === '<s>' ? 'start' : last}”, most likely next:</div>` + t.map(([k, p]) => `<span class="cand">${k === '</s>' ? '(end)' : k} <b>${p}%</b></span>`).join(' '); }
  let seedLen = 0;
  function start() { words = seed.value.trim().toLowerCase().split(/\s+/).filter(Boolean); seedLen = words.length; render(); }
  function stepOne() { const last = words[words.length - 1] || '<s>'; const t = top(last); if (!t.length || t[0][0] === '</s>' || words.length - seedLen > 14) return false; words.push(t[0][0]); render(); return true; }
  seed.oninput = start;
  root.querySelector('.step').onclick = () => { if (!words.length) start(); stepOne(); };
  root.querySelector('.go').onclick = () => { if (!words.length) start(); let n = 0; const tick = () => { if (stepOne() && n++ < 14) setTimeout(tick, 260); else if (window.Stickman) Stickman.react('right'); }; tick(); };
  start();
};

/* ===================== Spot the slip (hallucination game) ===================== */
Widgets['spot'] = function (root) {
  const items = [
    { s: 'The Indian Constitution came into effect on 26 January 1950.', ok: true, why: 'True. Republic Day marks it.' },
    { s: 'A ball thrown up at 20 m/s reaches 40 m (g = 10).', ok: false, why: 'False. 20² ÷ 20 = 20 m. The AI doubled instead of squaring-and-halving.' },
    { s: 'Water boils at 100 °C at sea level.', ok: true, why: 'True at normal pressure.' },
    { s: 'The Chennai Super Kings won the first-ever IPL season in 2008.', ok: false, why: 'False. Rajasthan Royals won 2008. Fluent, confident, wrong.' },
    { s: 'The mole is a unit for counting particles: 6.022 × 10²³ of them.', ok: true, why: 'True. You will meet it in week 2 chemistry.' },
    { s: 'Your Class 11 physics textbook has exactly 15 chapters on kinematics.', ok: false, why: 'False, and notice the trick: it sounds specific. Specific is not the same as true.' },
  ];
  root.innerHTML = `<div class="widget spot"><div class="controls" style="grid-template-columns:1fr">
    <div class="small" style="opacity:.75">An AI wrote these six lines. Mark each one. You get the answers only after all six.</div>
    ${items.map((it, i) => `<div class="spot-item" data-i="${i}"><div class="st">${it.s}</div><div class="row"><button class="secondary v" data-v="1">True</button><button class="secondary v" data-v="0">False</button><button class="secondary v" data-v="2">Can't tell</button></div><div class="why" style="display:none"></div></div>`).join('')}
    <button class="check" disabled>Reveal</button><div class="result"></div></div></div>`;
  const picks = {};
  root.querySelectorAll('.spot-item').forEach(el => el.querySelectorAll('.v').forEach(b => b.onclick = () => { el.querySelectorAll('.v').forEach(x => x.classList.remove('picked')); b.classList.add('picked'); picks[el.dataset.i] = Number(b.dataset.v); root.querySelector('.check').disabled = Object.keys(picks).length < items.length; }));
  root.querySelector('.check').onclick = () => {
    let score = 0;
    root.querySelectorAll('.spot-item').forEach(el => { const it = items[el.dataset.i]; const p = picks[el.dataset.i]; const right = (p === 1) === it.ok && p !== 2; if (right) score++; const w = el.querySelector('.why'); w.style.display = ''; w.innerHTML = `<b style="color:${right ? '#7fd1ae' : '#ff9a7a'}">${right ? 'You caught it.' : p === 2 ? 'Fair: you could not know. Now you do.' : 'It fooled you.'}</b> ${it.why}`; el.querySelectorAll('.v').forEach(x => x.disabled = true); });
    root.querySelector('.result').innerHTML = `<b>${score}/6.</b> ${score >= 5 ? 'You verify before you trust. That is the skill.' : 'Fluent is not the same as true. The habit to build: check anything you have not verified yourself.'}`;
    root.querySelector('.check').disabled = true; if (window.Stickman) Stickman.react(score >= 5 ? 'good' : 'bad');
  };
};

/* ===================== Card deck questionnaire ===================== */
Widgets['cards'] = function (root, ctx) {
  const CARDS = [
    ['When something at home breaks, I want to open it and see why', 'pcm'],
    ['I would read about how vaccines train the immune system', 'pcb'],
    ['A 20-minute maths problem feels satisfying when it finally works', 'pcm'],
    ['I notice prices, discounts and how shops make money', 'commerce'],
    ['I enjoy arguing a point and winning on reasons', 'humanities'],
    ['I like living things: plants, animals, how bodies work', 'pcb'],
    ['I would rather build the thing than write about it', 'pcm'],
    ['I like planning, budgeting and keeping a group on track', 'commerce'],
    ['Stories, history and people interest me more than machines', 'humanities'],
    ['I want to know exactly why something is true, not just that it is', 'pcm'],
    ['I could spend an hour on a biology documentary', 'pcb'],
    ['Markets, startups and how companies grow fascinate me', 'commerce'],
    ['I write well and people say so', 'humanities'],
    ['I am fine memorising lots of names and facts if I see the point', 'pcb'],
    ['Graphs and numbers make more sense to me than long paragraphs', 'commerce'],
    ['I care how society works: laws, elections, rights', 'humanities'],
  ];
  const tally = { pcm: 0, pcb: 0, commerce: 0, humanities: 0 }; let i = 0; const answers = [];
  root.innerHTML = `<div class="widget cards"><div class="controls" style="grid-template-columns:1fr">
    <div class="small" style="opacity:.75">16 cards. Tap what is true of you. First instinct; no right answers.</div>
    <div class="deck"><div class="cardq"></div></div>
    <div class="row" style="justify-content:center"><button class="secondary no">Not me</button><button class="yes">That's me</button></div>
    <div class="prog small" style="opacity:.6;text-align:center"></div>
    <div class="summary" style="display:none"></div></div></div>`;
  const cq = root.querySelector('.cardq'), prog = root.querySelector('.prog'), btns = root.querySelectorAll('.yes,.no');
  const LABEL = { pcm: 'PCM (engineering, maths, physics)', pcb: 'PCB (medicine, biology)', commerce: 'Commerce (business, finance)', humanities: 'Humanities (law, writing, society)' };
  function show() { if (i >= CARDS.length) return finish(); cq.textContent = CARDS[i][0]; cq.classList.remove('swipe-l', 'swipe-r'); prog.textContent = `${i + 1} of ${CARDS.length}`; }
  function answer(yes) { const [, s] = CARDS[i]; if (yes) tally[s]++; answers.push(yes ? 1 : 0); cq.classList.add(yes ? 'swipe-r' : 'swipe-l'); i++; setTimeout(show, 220); }
  btns.forEach(b => b.onclick = () => answer(b.classList.contains('yes')));
  async function finish() {
    btns.forEach(b => b.disabled = true); cq.textContent = 'Done'; prog.textContent = '';
    const max = Math.max(...Object.values(tally)) || 1;
    const sum = root.querySelector('.summary'); sum.style.display = '';
    sum.innerHTML = `<div class="small" style="opacity:.75;margin-bottom:8px">Where your instincts leaned today. This is one input of four for your Stream Report, not a verdict.</div>` + Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="bar"><span>${LABEL[k]}</span><i style="width:${Math.round(100 * v / max)}%"></i><b>${v}</b></div>`).join('');
    if (ctx && ctx.onDeck) ctx.onDeck({ tally, answers });
    if (window.Stickman) Stickman.react('right');
  }
  show();
};
