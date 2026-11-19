/* Interactive lesson widgets. A lesson body includes <div data-widget="name"></div>; app.js mounts it. */
const Widgets = {};

/* Ball throw: predict the height, throw, see the truth, find the pattern. */
Widgets['ball-throw'] = function (root) {
  const G = 10, MAXV = 40, MAXH = MAXV * MAXV / (2 * G); // 80 m
  root.innerHTML = `
    <div class="widget">
      <canvas class="sim" height="280"></canvas>
      <div class="row" style="margin-top:10px">
        <label style="flex:1;margin:0">Throw speed: <b class="vlabel">20</b> m/s<input class="speed" type="range" min="5" max="${MAXV}" step="1" value="20" style="margin-top:4px"></label>
      </div>
      <div class="row" style="margin-top:10px">
        <label style="flex:1;margin:0">Your guess: how high will it go? (m)<input class="guess" type="number" min="0" step="1" placeholder="type a number first"></label>
        <button class="throw" style="align-self:flex-end">Throw</button>
      </div>
      <div class="result muted small" style="margin-top:8px"></div>
      <table class="rounds" style="width:100%;margin-top:10px;border-collapse:collapse;font-size:.9rem;display:none">
        <thead><tr><th style="text-align:left">Speed</th><th>Your guess</th><th>Actual</th><th>Time in air</th></tr></thead><tbody></tbody>
      </table>
      <div class="pattern" style="display:none;margin-top:12px;padding:12px;background:#fff4e3;border-radius:10px"></div>
    </div>`;
  const cv = root.querySelector('.sim'), ctx = cv.getContext('2d');
  const speed = root.querySelector('.speed'), vlabel = root.querySelector('.vlabel'), guess = root.querySelector('.guess');
  const btn = root.querySelector('.throw'), result = root.querySelector('.result'), table = root.querySelector('.rounds'), tbody = table.querySelector('tbody'), pattern = root.querySelector('.pattern');
  const rounds = [];
  let anim = null;

  function size() { cv.width = cv.clientWidth * devicePixelRatio; cv.height = 280 * devicePixelRatio; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }
  function draw(h, v, t, peak) {
    const W = cv.clientWidth, H = 280, ground = H - 24, scale = (ground - 30) / MAXH;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#eef3f0'; ctx.fillRect(0, 0, W, H);
    // height ticks
    ctx.strokeStyle = '#d6d2c8'; ctx.fillStyle = '#6b6a66'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    for (let m = 0; m <= MAXH; m += 20) { const y = ground - m * scale; ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W, y); ctx.stroke(); ctx.fillText(m + ' m', 4, y + 4); }
    ctx.fillStyle = '#8a7f6a'; ctx.fillRect(0, ground, W, 24);
    // guess line
    const g = Number(guess.value);
    if (g > 0) { const y = ground - Math.min(g, MAXH) * scale; ctx.strokeStyle = '#b43c2a'; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#b43c2a'; ctx.textAlign = 'right'; ctx.fillText('your guess ' + g + ' m', W - 6, y - 4); }
    if (peak !== undefined) { const y = ground - peak * scale; ctx.strokeStyle = '#1f5f4a'; ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W, y); ctx.stroke(); ctx.fillStyle = '#1f5f4a'; ctx.textAlign = 'right'; ctx.fillText('actual ' + peak + ' m', W - 6, y + 14); }
    // ball
    const y = ground - h * scale - 10;
    ctx.beginPath(); ctx.arc(W / 2, y, 10, 0, Math.PI * 2); ctx.fillStyle = '#e8a33d'; ctx.fill(); ctx.strokeStyle = '#9a6410'; ctx.stroke();
    if (t !== undefined) { ctx.fillStyle = '#1c1b1a'; ctx.textAlign = 'center'; ctx.font = 'bold 13px sans-serif'; ctx.fillText(`t = ${t.toFixed(1)} s   v = ${v.toFixed(0)} m/s`, W / 2, 20); }
  }
  size(); draw(0); window.addEventListener('resize', () => { size(); draw(0); });
  speed.oninput = () => { vlabel.textContent = speed.value; if (!anim) draw(0); };
  guess.oninput = () => { if (!anim) draw(0); };

  btn.onclick = () => {
    const g = Number(guess.value);
    if (!(g > 0)) { result.textContent = 'Guess first. Being wrong is the point.'; guess.focus(); return; }
    if (anim) return;
    const u = Number(speed.value), peak = u * u / (2 * G), T = 2 * u / G;
    const t0 = performance.now(); const slow = 1.2; // slow motion
    btn.disabled = true;
    function frame(now) {
      const t = Math.min(T, (now - t0) / 1000 / slow);
      const h = u * t - 0.5 * G * t * t, v = u - G * t;
      draw(Math.max(0, h), v, t, t >= T ? peak : undefined);
      if (t < T) anim = requestAnimationFrame(frame);
      else {
        anim = null; btn.disabled = false;
        rounds.push({ u, g, peak, T });
        tbody.insertAdjacentHTML('beforeend', `<tr><td>${u} m/s</td><td style="text-align:center;color:#b43c2a">${g} m</td><td style="text-align:center;color:#1f5f4a"><b>${peak} m</b></td><td style="text-align:center">${T} s</td></tr>`);
        table.style.display = '';
        const off = Math.round(100 * Math.abs(g - peak) / peak);
        result.textContent = off <= 10 ? `Close: you were within ${off}%. Try a very different speed now.` : (g > peak ? `Too high by ${g - peak} m. Now try a different speed and guess again.` : `Too low by ${peak - g} m. Now try a different speed and guess again.`);
        guess.value = '';
        if (rounds.length >= 3) showPattern();
      }
    }
    anim = requestAnimationFrame(frame);
  };

  function showPattern() {
    const sorted = [...rounds].sort((a, b) => a.u - b.u);
    const lo = sorted[0], hi = sorted[sorted.length - 1];
    const r = (hi.u / lo.u).toFixed(1), rh = (hi.peak / lo.peak).toFixed(1);
    pattern.style.display = '';
    pattern.innerHTML = `<b>Look at your own table.</b> Going from ${lo.u} m/s to ${hi.u} m/s is ${r}× the speed, but the ball went ${rh}× as high. Time in the air, though, only grew ${(hi.T / lo.T).toFixed(1)}×, the same as the speed.<br><br>So: <b>height grows with the square of the speed; time grows in a straight line with it.</b> You just discovered that. Keep reading to see what it is called.`;
  }
};
