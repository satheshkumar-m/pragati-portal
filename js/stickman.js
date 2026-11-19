/* Abhi, the mentor. Jointed stick figure with a chalk scarf.
   States: idle | talk | point | think | cheer | throw.  Stickman.set('cheer', 2500); Stickman.say('Nice!') */
const Stickman = (() => {
  let el = null, state = 'idle', timer = null, observer = null, lastStep = -1, onStep = null;
  const NAME = 'Abhi';
  // Joints (viewBox coords): shoulder (60,80), elbows (36,104)/(84,104), hip (60,138). Limb groups pivot on their joint (transform-box: view-box).
  const svg = `
<svg viewBox="0 -40 120 262" width="130" aria-hidden="true">
  <g class="sm st-idle">
    <ellipse class="shadow" cx="60" cy="214" rx="30" ry="4" fill="rgba(0,0,0,.35)"/>
    <g class="body">
      <g class="leg l"><path d="M60 138 L44 176 L40 208" fill="none"/><path d="M40 208 L30 210" fill="none"/></g>
      <g class="leg r"><path d="M60 138 L76 176 L80 208" fill="none"/><path d="M80 208 L90 210" fill="none"/></g>
      <path class="spine" d="M60 78 L60 138" fill="none"/>
      <path class="scarf" d="M46 74 Q60 84 74 74 L72 68 Q60 76 48 68 Z" fill="#ffd166"/>
      <path class="scarf" d="M66 76 Q72 92 62 104 Q70 94 64 78 Z" fill="#ffd166"/>
      <g class="arm l"><path d="M60 80 L36 104" fill="none"/><g class="fore"><path d="M36 104 L24 126" fill="none"/><circle class="hand" cx="24" cy="126" r="3.5"/></g></g>
      <g class="arm r"><path d="M60 80 L84 104" fill="none"/><g class="fore"><path d="M84 104 L96 126" fill="none"/><circle class="hand" cx="96" cy="126" r="3.5"/></g></g>
      <g class="head">
        <circle cx="60" cy="52" r="22" fill="#fff"/>
        <g class="face">
          <circle class="eye l" cx="52" cy="48" r="2.6" fill="#1b2233"/><circle class="eye r" cx="68" cy="48" r="2.6" fill="#1b2233"/>
          <path class="brow l" d="M47 41 Q52 38 57 41" fill="none"/><path class="brow r" d="M63 41 Q68 38 73 41" fill="none"/>
          <path class="mouth" d="M51 60 Q60 66 69 60" fill="none"/>
        </g>
      </g>
      <circle class="ball2" cx="0" cy="0" r="7" fill="#ffd166" stroke="#c98f00" stroke-width="2" opacity="0"/>
      <g class="bubble" opacity="0"><rect x="0" y="-36" width="120" height="28" rx="10" fill="#fff"/><path d="M60 -8 l-6 8 l12 0 z" fill="#fff" stroke="none"/><text class="btext" x="60" y="-17" text-anchor="middle" font-size="12" font-weight="600" font-family="Public Sans, sans-serif" fill="#1b2233">…</text></g>
    </g>
  </g>
</svg>`;
  const css = `
  .stickman { position: fixed; left: max(10px, calc((100vw - 1120px) / 2 + 30px)); bottom: 18px; width: 130px; z-index: 5; pointer-events: none; display: none; }
  @media (min-width: 1041px) { .stickman { display: block; } }
  .stickman.rail-mount { position: static; display: block; width: 130px; }
  .stickman.inline { position: static; display: block; width: 96px; margin: 0 auto 6px; }
  .stickman .name { text-align: center; font: 600 12px "Public Sans", sans-serif; color: rgba(255,255,255,.7); margin-top: 2px; }
  .stickman.inline .name { color: #4a5468; }
  .sm path { stroke: #fff; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
  .sm .head > circle { stroke: #fff; stroke-width: 5; }
  .sm .hand { fill: #fff; }
  .stickman.inline .sm path { stroke: #1b2233; } .stickman.inline .sm .head > circle { stroke: #1b2233; stroke-width: 4; } .stickman.inline .sm .hand { fill: #1b2233; }
  .sm .face path { stroke: #1b2233 !important; stroke-width: 2.6; }
  .sm .scarf { stroke: none !important; }
  .sm .bubble path { stroke: none !important; }
  .sm .arm, .sm .leg, .sm .head, .sm .fore, .sm .body, .sm .eye, .sm .mouth { transform-box: view-box; }
  .sm .arm { transform-origin: 60px 80px; }
  .sm .arm.l .fore { transform-origin: 36px 104px; } .sm .arm.r .fore { transform-origin: 84px 104px; }
  .sm .leg { transform-origin: 60px 138px; }
  .sm .head { transform-origin: 60px 74px; }
  .sm .body { transform-origin: 60px 210px; animation: sm-breathe 3.2s ease-in-out infinite; }
  .sm .eye { transform-origin: center; transform-box: fill-box; animation: sm-blink 4.5s infinite; }
  .sm .mouth { transform-origin: 60px 60px; }
  .sm .arm, .sm .head, .sm .fore { transition: transform .35s cubic-bezier(.3,1.4,.5,1); }
  @keyframes sm-breathe { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.012); } }
  @keyframes sm-blink { 0%,93%,100% { transform: scaleY(1); } 96% { transform: scaleY(.1); } }
  .st-idle .arm.l { transform: rotate(8deg); } .st-idle .arm.r { transform: rotate(-8deg); }
  .st-talk .arm.r { animation: sm-gesture 1.2s ease-in-out infinite; }
  .st-talk .arm.r .fore { animation: sm-gesture-fore 1.2s ease-in-out infinite; }
  .st-talk .mouth { animation: sm-mouth .3s ease-in-out infinite alternate; }
  .st-talk .head { animation: sm-nod 1.2s ease-in-out infinite; }
  @keyframes sm-gesture { 0%,100% { transform: rotate(-60deg); } 50% { transform: rotate(-95deg); } }
  @keyframes sm-gesture-fore { 0%,100% { transform: rotate(-20deg); } 50% { transform: rotate(-70deg); } }
  @keyframes sm-mouth { from { transform: scaleY(.4); } to { transform: scaleY(1.5); } }
  @keyframes sm-nod { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
  .st-point .arm.r { transform: rotate(-125deg); } .st-point .arm.r .fore { transform: rotate(-25deg); }
  .st-point .head { transform: rotate(10deg); }
  .st-think .arm.l { transform: rotate(110deg); } .st-think .arm.l .fore { transform: rotate(115deg); }
  .st-think .head { animation: sm-tilt 1.8s ease-in-out infinite; }
  .st-think .mouth { d: path("M52 62 Q60 58 68 62"); }
  .st-think .brow.l { d: path("M47 42 Q52 36 57 40"); }
  @keyframes sm-tilt { 0%,100% { transform: rotate(-9deg); } 50% { transform: rotate(5deg); } }
  .st-cheer .arm.l { animation: sm-cheer-l .45s ease-in-out infinite alternate; } .st-cheer .arm.l .fore { transform: rotate(-20deg); }
  .st-cheer .arm.r { animation: sm-cheer-r .45s ease-in-out infinite alternate; } .st-cheer .arm.r .fore { transform: rotate(20deg); }
  .st-cheer .body { animation: sm-jump .45s ease-in-out infinite alternate; }
  .st-cheer .mouth { d: path("M49 58 Q60 70 71 58"); }
  @keyframes sm-cheer-l { from { transform: rotate(150deg); } to { transform: rotate(170deg); } }
  @keyframes sm-cheer-r { from { transform: rotate(-150deg); } to { transform: rotate(-170deg); } }
  @keyframes sm-jump { from { transform: translateY(0); } to { transform: translateY(-9px); } }
  .st-throw .arm.r { animation: sm-throw .7s ease-in forwards; }
  .st-throw .arm.r .fore { animation: sm-throw-fore .7s ease-in forwards; }
  .st-throw .ball2 { animation: sm-ballfly 1.7s ease-out .4s forwards; }
  .st-throw .head { transform: rotate(-8deg); }
  @keyframes sm-throw { 0% { transform: rotate(50deg); } 60% { transform: rotate(-165deg); } 100% { transform: rotate(-160deg); } }
  @keyframes sm-throw-fore { 0% { transform: rotate(80deg); } 60% { transform: rotate(-10deg); } 100% { transform: rotate(0deg); } }
  @keyframes sm-ballfly { 0% { transform: translate(88px, 40px); opacity: 1; } 45% { transform: translate(96px, -30px); opacity: 1; } 90% { transform: translate(104px, 40px); opacity: 1; } 100% { transform: translate(104px, 44px); opacity: 0; } }
  `;
  function mount(target, cls) {
    if (!document.getElementById('sm-css')) { const s = document.createElement('style'); s.id = 'sm-css'; s.textContent = css; document.head.appendChild(s); }
    if (el) el.remove();
    el = document.createElement('div'); el.className = 'stickman ' + (cls || (target ? 'inline' : '')); el.innerHTML = svg + `<div class="name">${NAME}</div>`;
    (target || document.body).appendChild(el);
    set(state);
  }
  function set(s, ms) {
    state = s; if (!el) return;
    el.querySelector('.sm').setAttribute('class', 'sm st-' + s);
    clearTimeout(timer);
    if (ms) timer = setTimeout(() => set('idle'), ms);
  }
  function say(t, ms = 2500) {
    if (!el) return; const b = el.querySelector('.bubble'); el.querySelector('.btext').textContent = t; b.setAttribute('opacity', '1');
    clearTimeout(say.t); say.t = setTimeout(() => b.setAttribute('opacity', '0'), ms);
  }
  function remove() { if (el) el.remove(); el = null; if (observer) observer.disconnect(); observer = null; lastStep = -1; }
  const STEP_ACTS = [
    { state: 'point', line: 'Guess first!' },
    { state: 'throw', line: 'Guess, then throw' },
    { state: 'think', line: 'See the square?' },
    { state: 'point', line: 'Use the hints' },
    { state: 'talk', line: 'Catch the AI out' },
  ];
  function watchSteps(steps, cb) {
    onStep = cb || null;
    if (!('IntersectionObserver' in window) || !steps.length) return;
    if (observer) observer.disconnect();
    const list = [...steps];
    observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const i = list.indexOf(e.target); if (i === lastStep) return; lastStep = i;
        const act = STEP_ACTS[i] || STEP_ACTS[0];
        set(act.state, 2600); say(act.line, 2600); if (onStep) onStep(i);
      });
    }, { rootMargin: '-25% 0px -60% 0px', threshold: 0 });
    list.forEach(st => observer.observe(st));
  }
  return { mount, set, say, remove, watchSteps, NAME, get state() { return state; } };
})();
