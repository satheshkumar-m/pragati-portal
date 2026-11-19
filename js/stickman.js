/* Mentor stick man: lives in the left margin on wide screens, inside the lesson card on phones.
   States: idle | talk | point | think | cheer | throw.  Usage: Stickman.set('cheer') */
const Stickman = (() => {
  let el = null, state = 'idle', timer = null;
  const svg = `
<svg viewBox="0 0 120 220" width="120" height="220" aria-hidden="true">
  <g class="sm">
    <line class="shadow" x1="30" y1="212" x2="90" y2="212" stroke="#d6d2c8" stroke-width="4" stroke-linecap="round"/>
    <g class="body">
      <circle class="head" cx="60" cy="40" r="18" fill="#fff" stroke="#1c1b1a" stroke-width="3"/>
      <g class="face">
        <circle class="eye l" cx="53" cy="37" r="2.2" fill="#1c1b1a"/><circle class="eye r" cx="67" cy="37" r="2.2" fill="#1c1b1a"/>
        <path class="mouth" d="M52 47 Q60 52 68 47" fill="none" stroke="#1c1b1a" stroke-width="2.5" stroke-linecap="round"/>
      </g>
      <line class="spine" x1="60" y1="58" x2="60" y2="130" stroke="#1c1b1a" stroke-width="4" stroke-linecap="round"/>
      <g class="arm l"><line x1="60" y1="72" x2="30" y2="110" stroke="#1c1b1a" stroke-width="4" stroke-linecap="round"/></g>
      <g class="arm r"><line x1="60" y1="72" x2="90" y2="110" stroke="#1c1b1a" stroke-width="4" stroke-linecap="round"/><circle class="ball" cx="92" cy="112" r="6" fill="#e8a33d" stroke="#9a6410" stroke-width="2" opacity="0"/></g>
      <g class="leg l"><line x1="60" y1="130" x2="40" y2="200" stroke="#1c1b1a" stroke-width="4" stroke-linecap="round"/></g>
      <g class="leg r"><line x1="60" y1="130" x2="80" y2="200" stroke="#1c1b1a" stroke-width="4" stroke-linecap="round"/></g>
      <g class="bubble" opacity="0"><rect x="78" y="2" width="38" height="24" rx="8" fill="#fff" stroke="#1c1b1a" stroke-width="2"/><text class="btext" x="97" y="19" text-anchor="middle" font-size="14" font-family="sans-serif">…</text></g>
    </g>
  </g>
</svg>`;
  const css = `
  .stickman { position: fixed; left: max(12px, calc((100vw - 760px) / 2 - 150px)); bottom: 24px; width: 120px; z-index: 5; pointer-events: none; display: none; }
  @media (min-width: 1100px) { .stickman { display: block; } }
  .stickman.inline { position: static; display: block; width: 90px; margin: 0 auto; }
  .sm .arm, .sm .leg, .sm .head, .sm .face, .sm .body { transform-box: fill-box; transform-origin: top center; }
  .sm .arm.l, .sm .arm.r { transform-origin: 60px 72px; }
  .sm .leg.l, .sm .leg.r { transform-origin: 60px 130px; }
  .sm .head { transform-origin: 60px 58px; }
  .sm .body { animation: sm-breathe 3s ease-in-out infinite; transform-origin: 60px 200px; }
  @keyframes sm-breathe { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.015); } }
  /* talk */
  .st-talk .arm.r { animation: sm-wave 1.1s ease-in-out infinite; }
  .st-talk .mouth { animation: sm-mouth .35s ease-in-out infinite alternate; transform-origin: 60px 47px; }
  @keyframes sm-wave { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-70deg); } }
  @keyframes sm-mouth { from { transform: scaleY(.3); } to { transform: scaleY(1.4); } }
  /* point (at content to the right) */
  .st-point .arm.r { transform: rotate(-95deg); transition: transform .4s; }
  .st-point .head { transform: rotate(8deg); transition: transform .4s; }
  /* think */
  .st-think .arm.l { transform: rotate(140deg); transition: transform .4s; }
  .st-think .head { animation: sm-tilt 1.6s ease-in-out infinite; }
  .st-think .mouth { d: path("M52 49 Q60 45 68 49"); }
  .st-think .bubble { opacity: 1; transition: opacity .3s; }
  @keyframes sm-tilt { 0%,100% { transform: rotate(-8deg); } 50% { transform: rotate(6deg); } }
  /* cheer */
  .st-cheer .arm.l { animation: sm-cheer-l .5s ease-in-out infinite alternate; }
  .st-cheer .arm.r { animation: sm-cheer-r .5s ease-in-out infinite alternate; }
  .st-cheer .body { animation: sm-jump .5s ease-in-out infinite alternate; }
  .st-cheer .mouth { d: path("M50 45 Q60 56 70 45"); }
  @keyframes sm-cheer-l { from { transform: rotate(150deg); } to { transform: rotate(170deg); } }
  @keyframes sm-cheer-r { from { transform: rotate(-150deg); } to { transform: rotate(-170deg); } }
  @keyframes sm-jump { from { transform: translateY(0); } to { transform: translateY(-10px); } }
  /* throw */
  .st-throw .ball { opacity: 1; }
  .st-throw .arm.r { animation: sm-throw .6s ease-in forwards; }
  @keyframes sm-throw { 0% { transform: rotate(40deg); } 70% { transform: rotate(-150deg); } 100% { transform: rotate(-160deg); } }
  `;
  function mount(target) {
    if (!document.getElementById('sm-css')) { const s = document.createElement('style'); s.id = 'sm-css'; s.textContent = css; document.head.appendChild(s); }
    if (el) el.remove();
    el = document.createElement('div'); el.className = 'stickman' + (target ? ' inline' : ''); el.innerHTML = svg;
    (target || document.body).appendChild(el);
    set(state);
  }
  function set(s, ms) {
    state = s; if (!el) return;
    el.querySelector('.sm').className.baseVal = 'sm st-' + s;
    clearTimeout(timer);
    if (ms) timer = setTimeout(() => set('idle'), ms);
  }
  function say(t, ms = 2500) { if (!el) return; el.querySelector('.btext').textContent = t; el.querySelector('.bubble').setAttribute('opacity', '1'); clearTimeout(timer); timer = setTimeout(() => { el.querySelector('.bubble').setAttribute('opacity', '0'); set('idle'); }, ms); }
  function remove() { if (el) el.remove(); el = null; }
  return { mount, set, say, remove, get state() { return state; } };
})();
