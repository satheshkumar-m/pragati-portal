/* Abhi, the mentor. Jointed stick figure with a chalk scarf.
   States: idle | talk | point | think | cheer | throw.  Stickman.set('cheer', 2500); Stickman.say('Nice!') */
window.Stickman = (() => {
  let el = null, state = 'idle', timer = null, observer = null, lastStep = -1, onStep = null;
  const NAME = 'Abhi';
  // Seven looks, one per weekday (scarf, entrance, idle habit). Lines come from the language sets below.
  const DAYS = [
    { scarf: '#ff8fab', enter: 'enter-fade',  fidget: 'fidget-sway' },
    { scarf: '#ffd166', enter: 'enter-walk',  fidget: 'fidget-tap' },
    { scarf: '#7fd1ae', enter: 'enter-drop',  fidget: 'fidget-stretch' },
    { scarf: '#9ecbff', enter: 'enter-slide', fidget: 'fidget-look' },
    { scarf: '#f4a261', enter: 'enter-spin',  fidget: 'fidget-bounce' },
    { scarf: '#c77dff', enter: 'enter-pop',   fidget: 'fidget-scratch' },
    { scarf: '#ffe08a', enter: 'enter-walk',  fidget: 'fidget-juggle' },
  ];
  const LANGS = {
    en:      { label: 'English', greet: ['Sunday special', "Let's start!", 'Ready?', 'Mid-week, keep going', 'Friday brain on', 'Checkpoint day!', 'Chill, but learn'], hook: ['Guess first!', "Don't read ahead"], play: ['Try it yourself', 'Your turn'], name: ['Now it gets a name', 'Notice the pattern?'], doit: ['Use the hints', 'Take your time'], ai: ['Catch the AI out', 'Trust, but verify'], wrong: ['Hmm, think again', 'Try once more'], close: ['So close!', 'Almost!'], right: ['Yes!', 'Nailed it!'], good: ['Brilliant!', 'Top marks'], bad: ['Read the explanations', 'One more read'], idle: ['Still here', 'Take your time', 'Reading?'] },
    hinglish:{ label: 'Hinglish', greet: ['Sunday special, yaar', 'Chalo, shuru karein!', 'Ready ho?', 'Mid-week, lage raho', 'Friday, dimaag on', 'Checkpoint day!', 'Chill, par seekho'], hook: ['Pehle guess karo!', 'Aage mat padho'], play: ['Khud try karo', 'Tumhari baari'], name: ['Ab iska naam', 'Pattern dikha?'], doit: ['Hints use karo', 'Aaram se'], ai: ['AI ko pakdo', 'Bharosa, par check'], wrong: ['Arre, phir socho', 'Ek baar aur'], close: ['Bilkul paas!', 'Almost, yaar'], right: ['Sahi!', 'Ekdum mast!'], good: ['Shabash!', 'Kamaal!'], bad: ['Explanation padho', 'Ek baar aur padho'], idle: ['Main yahin hoon', 'Aaram se', 'Padh rahe ho?'] },
    tamil:   { label: 'Tamil mix', greet: ['Sunday special, da', "Vaa, let's start!", 'Ready-ah?', 'Mid-week, machi', 'Friday, moolai on', 'Checkpoint day!', 'Chill, but learn'], hook: ['Guess first, paaru', "Don't read ahead!"], play: ['Try it, paaru', 'Un turn, machi'], name: ['Now it gets a name', 'Pattern paaru'], doit: ['Hints irukku', 'Take your time, da'], ai: ['Catch the AI out', 'Verify, always'], wrong: ['Aiyo, think again', 'Yosi… once more'], close: ['Kitta vandhuta!', 'Close, da!'], right: ['Semma!', 'Super da!'], good: ['Vera level!', 'Mass!'], bad: ['Explanations paaru', 'Read, then retry'], idle: ['Naan inga dhaan', 'Take your time', 'Padikkariya?'] },
    telugu:  { label: 'Telugu mix', greet: ['Sunday special, ra', 'Randi, start cheddam!', 'Ready-ah?', 'Mid-week, keep going', 'Friday, brain on', 'Checkpoint day!', 'Chill, kani nerchuko'], hook: ['Mundu guess cheyyi', "Don't read ahead!"], play: ['Try cheyyi', 'Nee turn'], name: ['Now it gets a name', 'Pattern chusava?'], doit: ['Hints unnai', 'Take your time'], ai: ['Catch the AI out', 'Verify cheyyi'], wrong: ['Ayyo, malli alochinchu', 'Once more'], close: ['Daggara vachav!', 'Almost!'], right: ['Super!', 'Keka!'], good: ['Adiripoyindi!', 'Mass!'], bad: ['Explanations chudu', 'Read, then retry'], idle: ['Nenu ikkade', 'Take your time', 'Chaduvutunnava?'] },
    kannada: { label: 'Kannada mix', greet: ['Sunday special, guru', 'Banni, start maadona!', 'Ready-na?', 'Mid-week, keep going', 'Friday, brain on', 'Checkpoint day!', 'Chill, aadre kali'], hook: ['Modalu guess maadi', "Don't read ahead!"], play: ['Try maadi', 'Nimma turn'], name: ['Now it gets a name', 'Pattern nodidra?'], doit: ['Hints ive', 'Take your time'], ai: ['Catch the AI out', 'Verify maadi'], wrong: ['Ayyo, innomme yochisi', 'Once more'], close: ['Hattira bandri!', 'Almost!'], right: ['Super!', 'Sakkath!'], good: ['Bombat!', 'Mass!'], bad: ['Explanations nodi', 'Read, then retry'], idle: ['Naanu illi iddini', 'Take your time', 'Odtidira?'] },
  };
  function lang() { return LANGS[window.PRAGATI_LANG] || LANGS.en; }
  const today = DAYS[new Date().getDay()];
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  function line(key) { if (key === 'greet') return lang().greet[new Date().getDay()]; const v = lang()[key]; return Array.isArray(v) ? pick(v) : (v || ''); }
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
        <path class="plait" d="M78 44 Q92 60 86 84 Q84 96 90 104" fill="none"/>
        <circle class="plait-tie" cx="90" cy="105" r="4" fill="#ffd166" stroke="none"/>
        <circle cx="60" cy="52" r="22" fill="#fff"/>
        <path class="fringe" d="M40 46 Q50 28 64 32 Q74 34 80 46" fill="none"/>
        <circle class="bindi" cx="60" cy="38" r="2" fill="#e4572e" stroke="none"/>
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
  .stickman { position: fixed; left: 40px; bottom: 18px; width: 130px; z-index: 5; pointer-events: none; display: none; }
  @media (min-width: 1041px) { .stickman { display: block; } }
  .stickman.rail-mount { position: static; display: block; width: 150px; }
  .stickman.inline { position: static; display: block; width: 96px; margin: 0 auto 6px; }
  .stickman .name { text-align: center; font: 600 12px "Public Sans", sans-serif; color: rgba(255,255,255,.7); margin-top: 2px; }
  .stickman.inline .name { color: #4a5468; }
  .sm path { stroke: #fff; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
  .sm .head > circle { stroke: #fff; stroke-width: 5; }
  .sm .hand { fill: #fff; }
  .stickman.inline .sm path { stroke: #1b2233; } .stickman.inline .sm .head > circle { stroke: #1b2233; stroke-width: 4; } .stickman.inline .sm .hand { fill: #1b2233; }
  .sm .face path { stroke: #1b2233 !important; stroke-width: 2.6; }
  .sm .plait { stroke-width: 7; } .sm .fringe { stroke-width: 4; }
  .sm .bindi, .sm .plait-tie { stroke: none !important; }
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
  /* entrances (one per weekday) */
  .stickman.enter-walk .sm { animation: sm-enter-walk 1.1s ease-out both; }
  .stickman.enter-walk .leg.l { animation: sm-step .28s ease-in-out 4 alternate; } .stickman.enter-walk .leg.r { animation: sm-step .28s ease-in-out 4 alternate-reverse; }
  .stickman.enter-drop .sm { animation: sm-enter-drop .9s cubic-bezier(.3,1.5,.5,1) both; }
  .stickman.enter-fade .sm { animation: sm-enter-fade 1s ease-out both; }
  .stickman.enter-slide .sm { animation: sm-enter-slide .8s ease-out both; }
  .stickman.enter-spin .sm { animation: sm-enter-spin .9s ease-out both; }
  .stickman.enter-pop .sm { animation: sm-enter-pop .7s cubic-bezier(.3,1.6,.5,1) both; }
  .sm { transform-box: view-box; transform-origin: 60px 210px; }
  @keyframes sm-enter-walk { from { transform: translateX(-90px); } to { transform: translateX(0); } }
  @keyframes sm-step { from { transform: rotate(-14deg); } to { transform: rotate(14deg); } }
  @keyframes sm-enter-drop { from { transform: translateY(-160px); } to { transform: translateY(0); } }
  @keyframes sm-enter-fade { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: scale(1); } }
  @keyframes sm-enter-slide { from { transform: translateY(60px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes sm-enter-spin { from { transform: rotate(-200deg) scale(.4); opacity: 0; } to { transform: rotate(0) scale(1); opacity: 1; } }
  @keyframes sm-enter-pop { from { transform: scale(0); } to { transform: scale(1); } }
  /* idle fidgets (one per weekday) */
  .fidget-sway .body { animation: sm-sway 3s ease-in-out infinite; }
  .fidget-tap .leg.r { animation: sm-tap 1s ease-in-out infinite; }
  .fidget-stretch .arm.l { animation: sm-stretch 4s ease-in-out infinite; } .fidget-stretch .arm.r { animation: sm-stretch-r 4s ease-in-out infinite; }
  .fidget-look .eye { animation: sm-look 5s ease-in-out infinite, sm-blink 4.5s infinite; }
  .fidget-bounce .body { animation: sm-bounce 1.4s ease-in-out infinite; }
  .fidget-scratch .arm.r { animation: sm-scratch 3.5s ease-in-out infinite; } .fidget-scratch .arm.r .fore { animation: sm-scratch-fore 3.5s ease-in-out infinite; }
  .fidget-juggle .arm.l { animation: sm-juggle-l .6s ease-in-out infinite alternate; } .fidget-juggle .arm.r { animation: sm-juggle-r .6s ease-in-out infinite alternate-reverse; }
  .fidget-juggle .ball2 { animation: sm-juggle-ball 1.2s ease-in-out infinite; opacity: 1; }
  @keyframes sm-sway { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
  @keyframes sm-tap { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-12deg); } }
  @keyframes sm-stretch { 0%,70%,100% { transform: rotate(8deg); } 85% { transform: rotate(160deg); } }
  @keyframes sm-stretch-r { 0%,70%,100% { transform: rotate(-8deg); } 85% { transform: rotate(-160deg); } }
  @keyframes sm-look { 0%,100% { transform: translateX(0); } 30% { transform: translateX(3px); } 60% { transform: translateX(-3px); } }
  @keyframes sm-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  @keyframes sm-scratch { 0%,60%,100% { transform: rotate(-8deg); } 75%,90% { transform: rotate(-150deg); } }
  @keyframes sm-scratch-fore { 0%,60%,100% { transform: rotate(0); } 75% { transform: rotate(-30deg); } 82% { transform: rotate(-10deg); } 90% { transform: rotate(-30deg); } }
  @keyframes sm-juggle-l { from { transform: rotate(120deg); } to { transform: rotate(135deg); } }
  @keyframes sm-juggle-r { from { transform: rotate(-120deg); } to { transform: rotate(-135deg); } }
  @keyframes sm-juggle-ball { 0% { transform: translate(28px, 60px); } 50% { transform: translate(60px, 10px); } 100% { transform: translate(92px, 60px); } }
  /* small random actions while idle */
  .sm.do-wave .arm.r { animation: sm-wave 1.8s ease-in-out 1; } .sm.do-wave .arm.r .fore { animation: sm-wave-fore 1.8s ease-in-out 1; }
  .sm.do-look .head { animation: sm-lookaround 1.8s ease-in-out 1; }
  .sm.do-stretch .arm.l { animation: sm-stretch-once 1.8s ease-in-out 1; } .sm.do-stretch .arm.r { animation: sm-stretch-once-r 1.8s ease-in-out 1; }
  @keyframes sm-wave { 0%,100% { transform: rotate(-8deg); } 20%,80% { transform: rotate(-160deg); } }
  @keyframes sm-wave-fore { 0%,100% { transform: rotate(0); } 30% { transform: rotate(-35deg); } 50% { transform: rotate(10deg); } 70% { transform: rotate(-35deg); } }
  @keyframes sm-lookaround { 0%,100% { transform: rotate(0); } 30% { transform: rotate(-12deg); } 70% { transform: rotate(12deg); } }
  @keyframes sm-stretch-once { 0%,100% { transform: rotate(8deg); } 50% { transform: rotate(165deg); } }
  @keyframes sm-stretch-once-r { 0%,100% { transform: rotate(-8deg); } 50% { transform: rotate(-165deg); } }
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
    el.querySelectorAll('.scarf').forEach(p => p.setAttribute('fill', today.scarf));
    el.classList.add(today.enter);
    set(state); life();
  }
  function set(s, ms) {
    state = s; if (!el) return;
    el.querySelector('.sm').setAttribute('class', 'sm st-' + s + (s === 'idle' ? ' ' + today.fidget : ''));
    clearTimeout(timer);
    if (ms) timer = setTimeout(() => set('idle'), ms);
  }
  function say(t, ms = 2500) {
    if (!el) return; const b = el.querySelector('.bubble'); el.querySelector('.btext').textContent = t; b.setAttribute('opacity', '1');
    clearTimeout(say.t); say.t = setTimeout(() => b.setAttribute('opacity', '0'), ms);
  }
  let lifeT = null;
  function life() {
    clearInterval(lifeT);
    lifeT = setInterval(() => {
      if (!el || state !== 'idle' || document.hidden) return;
      const acts = ['wave', 'look', 'stretch', 'say'];
      const a = pick(acts);
      if (a === 'say') say(line('idle'), 2200);
      else { el.querySelector('.sm').classList.add('do-' + a); setTimeout(() => el && el.querySelector('.sm').classList.remove('do-' + a), 1800); }
    }, 7000 + Math.random() * 4000);
  }
  function remove() { clearInterval(lifeT); if (el) el.remove(); el = null; if (observer) observer.disconnect(); observer = null; lastStep = -1; }
  const STEP_ACTS = [
    { state: 'point', key: 'hook' },
    { state: 'talk', key: 'play' },
    { state: 'think', key: 'name' },
    { state: 'point', key: 'doit' },
    { state: 'talk', key: 'ai' },
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
        set(act.state, 2600); say(line(act.key), 2600); if (onStep) onStep(i);
      });
    }, { rootMargin: '-25% 0px -60% 0px', threshold: 0 });
    list.forEach(st => observer.observe(st));
  }
  function react(kind, ms = 2600) {
    // kind: wrong | close | right | good | bad | greet
    const map = { wrong: 'think', close: 'think', right: 'cheer', good: 'cheer', bad: 'think', greet: 'point' };
    set(map[kind] || 'idle', ms); say(line(kind), ms);
  }
  return { mount, set, say, react, remove, watchSteps, NAME, line, LANGS, get today() { return today; }, get state() { return state; } };
})();
const Stickman = window.Stickman;
