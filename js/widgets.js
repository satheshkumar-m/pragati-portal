/* Interactive lesson widgets. A lesson body includes [[widget:name]]; app.js mounts it. */
const Widgets = {};

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
        if (window.Stickman) { if (off <= 10) Stickman.set('cheer', 2500); else { Stickman.set('think', 2500); Stickman.say(off > 50 ? 'Hmm…' : 'Close!', 2500); } }
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
