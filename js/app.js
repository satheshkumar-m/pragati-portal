/* Pragati Learn portal — student, parent and admin views in one small app. */
const $ = s => document.querySelector(s);
const view = $('#view');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => d ? new Date(d.replace(' ', 'T')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
let toastT; const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2500); };
const go = h => { location.hash = h; };
const STREAMS = { pcm: 'PCM (Engineering)', pcb: 'PCB (Medical)', commerce: 'Commerce', humanities: 'Humanities', undecided: 'Not decided yet' };
const TRACK = { stream: 'Stream', ai: 'AI', academic: 'Class 11' };

const cache = {};
async function weeks() {
  if (!cache.weeks) cache.weeks = await PB.all('weeks', { sort: 'number' });
  return cache.weeks;
}
function unlocked(w, user) {
  if (user.role === 'admin' || user.cohort === 'alpha') return true;
  return w.unlock_date && new Date(w.unlock_date.replace(' ', 'T')) <= new Date();
}
async function currentWeek(user) {
  const ws = await weeks();
  const open = ws.filter(w => unlocked(w, user));
  if (user.cohort === 'alpha' && !ws.some(w => new Date(w.unlock_date.replace(' ', 'T')) <= new Date())) return ws[0];
  return open[open.length - 1] || null;
}

/* ---------- auth ---------- */
async function renderLogin(msg = '') {
  $('#logout').style.display = 'none'; $('#nav-progress').style.display = 'none'; $('#who').textContent = '';
  view.innerHTML = `
  <div class="card" style="max-width:420px;margin:30px auto">
    <h1>Sign in</h1>
    <p class="muted">Students, parents and admin use the same login.</p>
    ${msg ? `<p style="color:var(--danger)">${esc(msg)}</p>` : ''}
    <label>Email</label><input id="email" type="email" autocomplete="username">
    <label>Password</label><input id="pass" type="password" autocomplete="current-password">
    <p style="margin-top:14px"><button id="do-login">Sign in</button></p>
    <p class="small muted">Forgot your password? Message us on WhatsApp and we will reset it.</p>
  </div>`;
  $('#do-login').onclick = async () => {
    try { await PB.login($('#email').value.trim(), $('#pass').value); cache.weeks = null; go('#home'); route(); }
    catch (e) { renderLogin('Wrong email or password.'); }
  };
  $('#pass').onkeydown = e => { if (e.key === 'Enter') $('#do-login').click(); };
}

/* ---------- question rendering & grading ---------- */
function renderQuestions(questions, existing) {
  if (!questions || !questions.length) return '';
  return questions.map((qq, i) => {
    const prev = existing ? existing[i] : undefined;
    const graded = existing !== undefined && qq.type !== 'profile';
    return `<div class="q" data-i="${i}">
      <div class="qt">${i + 1}. ${esc(qq.q)}</div>
      ${qq.hint && !graded ? `<div class="hint" onclick="this.textContent='Hint: ${esc(qq.hint).replace(/'/g, '&#39;')}'">Show hint</div>` : ''}
      ${qq.options.map((o, j) => {
        let cls = '';
        if (graded) { if (j === qq.answer) cls = 'correct'; else if (prev === j) cls = 'wrong'; }
        return `<label class="opt ${cls}"><input type="radio" name="q${i}" value="${j}" ${prev === j ? 'checked' : ''} ${existing !== undefined ? 'disabled' : ''}><span class="k">${'ABCD'[j] || j + 1}</span><span>${esc(o)}</span></label>`;
      }).join('')}
      ${graded && qq.explain ? `<div class="explain">${esc(qq.explain)}</div>` : ''}
    </div>`;
  }).join('');
}
function collectAnswers(questions) {
  return questions.map((_, i) => { const c = document.querySelector(`input[name="q${i}"]:checked`); return c ? Number(c.value) : null; });
}
function grade(questions, answers) {
  let score = 0, total = 0;
  questions.forEach((qq, i) => { if (qq.type === 'profile') return; total++; if (answers[i] === qq.answer) score++; });
  return { score, total };
}

/* ---------- make sure helper scripts exist even when an old app.html is cached ---------- */
function ensureScript(name, glob) {
  return new Promise(res => { if (window[glob]) return res(); const s = document.createElement('script'); s.src = `js/${name}.js?v=${Date.now()}`; s.onload = res; s.onerror = res; document.head.appendChild(s); });
}
const helpersReady = Promise.all([ensureScript('widgets', 'Widgets'), ensureScript('stickman', 'Stickman')]);

/* ---------- read aloud (browser speech; replaced by pre-rendered audio later) ---------- */
const Speech = (() => {
  const ok = 'speechSynthesis' in window;
  let voice = null;
  function pickVoice() {
    const vs = speechSynthesis.getVoices();
    const pref = [/en-IN/i, /India/i, /en-GB/i, /en-US/i];
    for (const p of pref) { const v = vs.find(x => p.test(x.lang) || p.test(x.name)); if (v) return v; }
    return vs[0] || null;
  }
  if (ok) { voice = pickVoice(); speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); }; }
  function textOf(html) {
    const d = document.createElement('div'); d.innerHTML = html;
    d.querySelectorAll('li').forEach(li => li.insertAdjacentText('afterend', '. '));
    d.querySelectorAll('h3,p').forEach(el => el.insertAdjacentText('afterend', ' '));
    return d.textContent.replace(/\s+/g, ' ').trim();
  }
  return {
    ok,
    speak(title, html, btn) {
      if (!ok) return;
      if (speechSynthesis.speaking) { speechSynthesis.cancel(); btn.textContent = '▶ Listen to this lesson'; if (window.Stickman) Stickman.set('idle'); return; }
      const u = new SpeechSynthesisUtterance(title + '. ' + textOf(html));
      if (voice) u.voice = voice; u.rate = 0.95; u.pitch = 1;
      u.onend = u.onerror = () => { btn.textContent = '▶ Listen to this lesson'; if (window.Stickman) Stickman.set('idle'); };
      btn.textContent = '■ Stop'; speechSynthesis.speak(u); if (window.Stickman) Stickman.set('talk');
    },
    stop() { if (ok) speechSynthesis.cancel(); },
  };
})();
window.addEventListener('hashchange', () => { Speech.stop(); if (window.Stickman) Stickman.remove(); });

/* ---------- student ---------- */
async function renderHome(user) {
  const ws = await weeks();
  const cw = await currentWeek(user);
  const [attempts, pAttempts, subs] = await Promise.all([
    PB.all('attempts', { filter: `user = "${user.id}"`, fields: 'lesson,score,total' }),
    PB.all('practice_attempts', { filter: `user = "${user.id}"`, fields: 'set,score,total,created' }),
    PB.all('submissions', { filter: `user = "${user.id}"`, expand: 'week', sort: '-created' }),
  ]);
  const doneLessons = new Set(attempts.map(a => a.lesson));
  const pAvg = pAttempts.length ? Math.round(100 * pAttempts.reduce((s, a) => s + (a.total ? a.score / a.total : 0), 0) / pAttempts.length) : null;
  let lessons = [], todaySet = null;
  if (cw) {
    lessons = await PB.all('lessons', { filter: `week = "${cw.id}"`, sort: 'track,order' });
    const stream = user.stream && user.stream !== 'undecided' ? user.stream : 'pcm';
    const sets = await PB.all('practice_sets', { filter: `week = "${cw.id}" && stream = "${stream}"`, sort: 'day' });
    const doneSets = new Set(pAttempts.map(a => a.set));
    todaySet = sets.find(s => !doneSets.has(s.id)) || null;
  }
  const latestSub = cw ? subs.find(s => s.week === cw.id) : null;
  view.innerHTML = `
  <h1>Hi ${esc(user.name.split(' ')[0])}</h1>
  <div class="grid2" style="grid-template-columns:repeat(3,1fr)">
    <div class="card stat"><b>${user.streak || 0}</b><span>day streak</span></div>
    <div class="card stat"><b>${doneLessons.size}</b><span>lessons done</span></div>
    <div class="card stat"><b>${pAvg === null ? '–' : pAvg + '%'}</b><span>practice avg</span></div>
  </div>
  ${cw ? `
  <div class="card">
    <div class="row spread"><span class="pill">Week ${cw.number}</span><span class="small muted">Stream: ${esc(STREAMS[user.stream || 'undecided'])}</span></div>
    <h2 style="margin-top:8px">${esc(cw.title)}</h2>
    <p class="muted">${esc(cw.summary)}</p>
    <ul class="list">
      ${lessons.map(l => `<li><div><span class="pill ${l.track}">${TRACK[l.track]}</span> <a href="#lesson/${l.id}">${esc(l.title)}</a><div class="small muted">${l.minutes || 20} min</div></div>${doneLessons.has(l.id) ? '<span class="pill ok">Done</span>' : '<a class="btn secondary" href="#lesson/' + l.id + '">Start</a>'}</li>`).join('')}
      ${!lessons.length ? '<li class="muted">Lessons for this week are being prepared.</li>' : ''}
    </ul>
  </div>
  <div class="card">
    <h3>Today's practice</h3>
    ${todaySet ? `<p>${esc(todaySet.title)} · ${todaySet.questions.length} questions · about 20 minutes</p><a class="btn" href="#practice/${todaySet.id}">Start practice</a>`
      : `<p class="muted">${cw.number < 3 ? 'Daily practice starts in week 3, after you pick a stream.' : 'All sets for this week are done. Nice.'}</p>`}
  </div>
  <div class="card">
    <h3>Friday checkpoint</h3>
    ${latestSub ? `<p>Status: <span class="pill ${latestSub.status === 'approved' ? 'ok' : latestSub.status === 'revise' ? 'warn' : ''}">${latestSub.status}</span>${latestSub.feedback ? `<br><span class="small">Feedback: ${esc(latestSub.feedback)}</span>` : ''}</p>` : '<p class="muted">Not submitted yet. Due Friday.</p>'}
    <a class="btn secondary" href="#project">Submit or update</a>
  </div>` : `<div class="card"><p>Your first week unlocks on ${fmtDate(ws[0]?.unlock_date)}. Until then, the parent and student guide is in your WhatsApp group.</p></div>`}
  <div class="card">
    <h3>All weeks</h3>
    <ul class="list">${ws.map(w => `<li><div><b>Week ${w.number}</b> · ${esc(w.title)}</div>${unlocked(w, user) ? '<span class="pill ok">Open</span>' : `<span class="pill locked">${fmtDate(w.unlock_date)}</span>`}</li>`).join('')}</ul>
  </div>
  <div class="card"><h3>Stuck on something?</h3><p class="muted small">Ask here. A person reads every question and answers within a day.</p><a class="btn secondary" href="#ask">Ask the tutor</a></div>`;
}

async function renderLesson(user, id) {
  const l = await PB.getOne('lessons', id, 'week');
  const existing = await PB.first('attempts', { filter: `user = "${user.id}" && lesson = "${id}"` });
  const qs = l.questions || [];
  const body = (l.body || '').replace(/<p>\s*\[\[widget:([a-z0-9-]+)\]\]\s*<\/p>|\[\[widget:([a-z0-9-]+)\]\]/g, (m, x, y) => `<div data-widget="${x || y}"></div>`);
  const stepNames = ['Hook', 'Play', 'Name it', 'Do it', 'AI twist'];
  const trackName = { stream: 'Stream taster', ai: 'AI', academic: 'Class 11' }[l.track];
  view.parentElement.classList.add('wide');
  view.innerHTML = `
  <div class="lesson-wrap">
    <aside class="rail">
      <a class="back" href="#home">← Week ${l.expand?.week?.number || ''}</a>
      <ol id="rail-steps">${stepNames.map(s => `<li>${s}</li>`).join('')}<li>Check yourself</li></ol>
      <div class="mentor" id="rail-mentor"></div>
    </aside>
    <div class="main">
      <div class="card notebook">
        <div class="lesson-head">
          <span class="pill ${l.track}">${trackName}</span>
          <h1 style="margin-top:10px">${esc(l.title)}</h1>
          <div class="meta"><span>${l.minutes || 20} minutes</span><span>Week ${l.expand?.week?.number || ''}</span>${qs.length ? `<span>${qs.filter(q => q.type !== 'profile').length} questions</span>` : ''}</div>
          ${Speech.ok ? '<div class="listen"><button id="listen" class="secondary">▶ Listen to this lesson</button></div>' : ''}
          <div class="mini-steps" id="mini-steps">${stepNames.map(() => '<i></i>').join('')}<i></i></div>
          <div id="sm-slot"></div>
        </div>
        ${l.video_url ? `<iframe class="video" src="${esc(l.video_url)}" allowfullscreen></iframe>` : ''}
        <div class="lesson-body">${body}</div>
        ${qs.length ? `<div class="step" id="check"><span class="pill">${qs.every(q => q.type === 'profile') ? 'Your answers' : 'Check yourself'}</span>
          ${renderQuestions(qs, existing ? existing.answers : undefined)}
          ${existing ? `<p class="muted">${existing.total ? `You scored ${existing.score}/${existing.total}.` : 'Saved. Thank you for answering honestly.'}</p>` : '<p style="margin-top:14px"><button id="submit-q" class="primary">Check my answers</button></p>'}
        </div>` : (existing ? '<div class="step"><span class="pill ok">Done</span></div>' : '<div class="step"><button id="mark-read" class="primary">Mark as done</button></div>')}
      </div>
      <div class="card"><h3>Stuck on something in this lesson?</h3><p class="muted small">Ask ${window.Stickman ? Stickman.NAME : 'the tutor'}. A person reads every question and answers within a day.</p><textarea id="ask-text" placeholder="What is confusing? Be specific."></textarea><p style="margin-top:10px"><button id="ask-btn" class="secondary">Send question</button></p></div>
    </div>
  </div>`;
  await helpersReady;
  const wide = window.innerWidth > 1040;
  Stickman.mount(wide ? $('#rail-mentor') : $('#sm-slot'), wide ? 'rail-mount' : 'inline');
  Stickman.set('point', 3500); Stickman.say('Read this first', 3500);
  const steps = [...view.querySelectorAll('.lesson-body .step'), $('#check')].filter(Boolean);
  const railItems = view.querySelectorAll('#rail-steps li'), miniItems = view.querySelectorAll('#mini-steps i');
  Stickman.watchSteps(steps, i => {
    railItems.forEach((li, j) => { li.classList.toggle('active', j === i); li.classList.toggle('done', j < i); });
    miniItems.forEach((it, j) => { it.classList.toggle('active', j === i); it.classList.toggle('done', j < i); });
  });
  document.querySelectorAll('[data-widget]').forEach(el => { const w = window.Widgets && Widgets[el.dataset.widget]; if (w) w(el); });
  const save = async answers => {
    const { score, total } = grade(qs, answers);
    await PB.create('attempts', { user: user.id, lesson: id, answers, score, total });
    toast(total ? `Scored ${score}/${total}` : 'Saved'); await renderLesson(user, id);
    location.hash = location.hash; document.getElementById('check')?.scrollIntoView({ block: 'start' });
    if (window.Stickman && total) { if (score / total >= 0.75) Stickman.set('cheer', 3000); else { Stickman.set('think'); Stickman.say('Read the explanations', 3500); } }
  };
  $('#submit-q')?.addEventListener('click', () => {
    const a = collectAnswers(qs);
    if (a.some(x => x === null)) return toast('Answer every question first');
    save(a);
  });
  $('#mark-read')?.addEventListener('click', () => save([]));
  $('#listen')?.addEventListener('click', e => Speech.speak(l.title, l.body || '', e.target));
  $('#ask-btn').onclick = async () => {
    const t = $('#ask-text').value.trim(); if (!t) return;
    await PB.create('tutor_questions', { user: user.id, lesson: id, question: t, status: 'open' });
    $('#ask-text').value = ''; toast('Sent. You will get an answer within a day.');
  };
}

async function renderPractice(user, id) {
  const s = await PB.getOne('practice_sets', id);
  const existing = await PB.first('practice_attempts', { filter: `user = "${user.id}" && set = "${id}"` });
  view.innerHTML = `
  <a href="#home" class="small">← Home</a>
  <div class="card"><span class="pill academic">Practice</span><h1 style="margin-top:8px">${esc(s.title)}</h1>
  ${renderQuestions(s.questions, existing ? existing.answers : undefined)}
  ${existing ? `<p class="muted">You scored ${existing.score}/${existing.total}. ${existing.score === existing.total ? 'Perfect.' : 'Read the explanations above; tomorrow\'s set adjusts to this.'}</p><a class="btn" href="#home">Back</a>` : '<p style="margin-top:12px"><button id="submit-p">Submit</button></p>'}</div>`;
  $('#submit-p')?.addEventListener('click', async () => {
    const a = collectAnswers(s.questions);
    if (a.some(x => x === null)) return toast('Answer every question first');
    const { score, total } = grade(s.questions, a);
    await PB.create('practice_attempts', { user: user.id, set: id, answers: a, score, total });
    try { const u = await PB.update('users', user.id, { streak: (user.streak || 0) + 1 }); user.streak = u.streak; } catch {}
    toast(`Scored ${score}/${total}`); renderPractice(user, id);
  });
}

async function renderProject(user) {
  const ws = (await weeks()).filter(w => unlocked(w, user));
  const subs = await PB.all('submissions', { filter: `user = "${user.id}"`, expand: 'week', sort: '-created' });
  const cw = await currentWeek(user);
  view.innerHTML = `
  <a href="#home" class="small">← Home</a>
  <div class="card"><h1>Friday checkpoint</h1>
    <p class="muted">Submit a link (your website, Replit, a Google Doc) or upload a screenshot or PDF, plus a few lines on what you did and what was hard.</p>
    <label>Week</label><select id="s-week">${ws.map(w => `<option value="${w.id}" ${cw && w.id === cw.id ? 'selected' : ''}>Week ${w.number}: ${esc(w.title)}</option>`).join('')}</select>
    <label>Link (optional)</label><input id="s-link" placeholder="https://">
    <label>Notes</label><textarea id="s-notes" placeholder="What did you build or write? What was hard?"></textarea>
    <label>File (optional, up to 10 MB)</label><input id="s-file" type="file">
    <p style="margin-top:12px"><button id="s-send">Submit</button></p>
  </div>
  <div class="card"><h3>Your submissions</h3>
    <ul class="list">${subs.map(s => `<li><div><b>Week ${s.expand?.week?.number}</b> · ${fmtDate(s.created)}<div class="small muted">${esc(s.notes || '').slice(0, 120)}</div>${s.feedback ? `<div class="small">Feedback: ${esc(s.feedback)}</div>` : ''}</div><span class="pill ${s.status === 'approved' ? 'ok' : s.status === 'revise' ? 'warn' : ''}">${s.status}</span></li>`).join('') || '<li class="muted">Nothing yet.</li>'}</ul>
  </div>`;
  $('#s-send').onclick = async () => {
    const notes = $('#s-notes').value.trim(); if (!notes) return toast('Add a few lines of notes');
    const fd = new FormData();
    fd.append('user', user.id); fd.append('week', $('#s-week').value); fd.append('link', $('#s-link').value.trim()); fd.append('notes', notes); fd.append('status', 'submitted');
    const f = $('#s-file').files[0]; if (f) fd.append('file', f);
    try { await PB.createForm('submissions', fd); toast('Submitted'); renderProject(user); } catch (e) { toast('Could not submit: ' + e.message); }
  };
}

async function renderAsk(user) {
  const qs = await PB.all('tutor_questions', { filter: `user = "${user.id}"`, sort: '-created', expand: 'lesson' });
  view.innerHTML = `
  <a href="#home" class="small">← Home</a>
  <div class="card"><h1>Ask the tutor</h1><p class="muted small">Anything about a lesson, a practice question, or your stream choice. A person reads every question.</p>
    <textarea id="ask-text"></textarea><p style="margin-top:8px"><button id="ask-btn">Send</button></p></div>
  <div class="card"><h3>Your questions</h3><ul class="list">${qs.map(q => `<li style="display:block"><div><b>You:</b> ${esc(q.question)}</div>${q.answer ? `<div style="margin-top:6px;padding:8px 10px;background:#eef3f0;border-radius:8px"><b>Tutor:</b> ${esc(q.answer)}</div>` : '<div class="small muted">Waiting for an answer</div>'}</li>`).join('') || '<li class="muted">No questions yet.</li>'}</ul></div>`;
  $('#ask-btn').onclick = async () => {
    const t = $('#ask-text').value.trim(); if (!t) return;
    await PB.create('tutor_questions', { user: user.id, question: t, status: 'open' }); toast('Sent'); renderAsk(user);
  };
}

async function progressFor(student) {
  const [attempts, pAttempts, subs, reports] = await Promise.all([
    PB.all('attempts', { filter: `user = "${student.id}"`, expand: 'lesson', sort: '-created' }),
    PB.all('practice_attempts', { filter: `user = "${student.id}"`, expand: 'set', sort: '-created' }),
    PB.all('submissions', { filter: `user = "${student.id}"`, expand: 'week', sort: '-created' }),
    PB.all('reports', { filter: `user = "${student.id}"`, expand: 'week', sort: '-created' }),
  ]);
  const pAvg = pAttempts.length ? Math.round(100 * pAttempts.reduce((s, a) => s + (a.total ? a.score / a.total : 0), 0) / pAttempts.length) : null;
  return `
  <div class="grid2" style="grid-template-columns:repeat(3,1fr)">
    <div class="card stat"><b>${student.streak || 0}</b><span>day streak</span></div>
    <div class="card stat"><b>${attempts.length}</b><span>lessons done</span></div>
    <div class="card stat"><b>${pAvg === null ? '–' : pAvg + '%'}</b><span>practice avg</span></div>
  </div>
  <div class="card"><h3>Reports</h3><ul class="list">${reports.map(r => `<li style="display:block"><b>${esc(r.type)} report${r.expand?.week ? ' · week ' + r.expand.week.number : ''}</b> <span class="small muted">${fmtDate(r.created)}</span><div class="lesson-body">${r.body}</div></li>`).join('') || '<li class="muted">The first report arrives at the end of week 2.</li>'}</ul></div>
  <div class="card"><h3>Lessons</h3><ul class="list">${attempts.map(a => `<li><span>${esc(a.expand?.lesson?.title)}</span><span class="small muted">${a.total ? a.score + '/' + a.total : 'done'}</span></li>`).join('') || '<li class="muted">None yet.</li>'}</ul></div>
  <div class="card"><h3>Practice</h3><ul class="list">${pAttempts.map(a => `<li><span>${esc(a.expand?.set?.title)}</span><span class="small muted">${a.score}/${a.total} · ${fmtDate(a.created)}</span></li>`).join('') || '<li class="muted">None yet.</li>'}</ul></div>
  <div class="card"><h3>Checkpoints</h3><ul class="list">${subs.map(s => `<li><span>Week ${s.expand?.week?.number}${s.feedback ? ' · ' + esc(s.feedback) : ''}</span><span class="pill ${s.status === 'approved' ? 'ok' : s.status === 'revise' ? 'warn' : ''}">${s.status}</span></li>`).join('') || '<li class="muted">None yet.</li>'}</ul></div>`;
}
async function renderProgress(user) { view.innerHTML = `<a href="#home" class="small">← Home</a><h1>Your progress</h1>` + await progressFor(user); }

/* ---------- parent ---------- */
async function renderParent(user) {
  const kids = await PB.all('users', { filter: `parent = "${user.id}"` });
  let html = `<h1>Hello ${esc(user.name.split(' ')[0])}</h1><p class="muted">Progress updates for your child. A fuller report comes every Sunday on WhatsApp and email.</p>`;
  for (const k of kids) html += `<div class="card flat"><h2>${esc(k.name)}</h2><p class="small muted">Class ${esc(k.class_level || '10')} · Stream: ${esc(STREAMS[k.stream || 'undecided'])}</p></div>` + await progressFor(k);
  if (!kids.length) html += '<div class="card"><p>No student is linked to this account yet. Message us on WhatsApp and we will link it.</p></div>';
  view.innerHTML = html;
}

/* ---------- content sync: content/*.json is the source of truth; admin visit upserts it ---------- */
async function syncContent() {
  if (cache.synced) return; cache.synced = true;
  const res = await fetch('content/week1.json?v=' + Date.now()); const content = await res.json();
  const ws = await PB.all('weeks', { sort: 'number' }); const weekIds = {};
  let n = 0;
  for (const w of content.weeks) {
    let rec = ws.find(x => x.number === w.number);
    if (!rec) { rec = await PB.create('weeks', { ...w, product: 'teens' }); n++; }
    else if (rec.title !== w.title || rec.summary !== w.summary) { await PB.update('weeks', rec.id, w); n++; }
    weekIds[w.number] = rec.id;
  }
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const ls = await PB.all('lessons');
  for (const l of content.lessons) {
    const data = { ...l, week: weekIds[l.week] };
    const rec = ls.find(x => x.week === data.week && x.track === l.track && x.order === l.order);
    if (!rec) { await PB.create('lessons', { ...data, approved: true }); n++; }
    else if (rec.title !== l.title || rec.body !== l.body || !same(rec.questions, l.questions) || rec.minutes !== l.minutes || rec.video_url !== l.video_url) { await PB.update('lessons', rec.id, data); n++; }
  }
  const ss = await PB.all('practice_sets');
  for (const p of content.practice_sets) {
    const data = { ...p, week: weekIds[p.week] };
    const rec = ss.find(x => x.week === data.week && x.stream === p.stream && x.day === p.day);
    if (!rec) { await PB.create('practice_sets', { ...data, approved: true }); n++; }
    else if (rec.title !== p.title || !same(rec.questions, p.questions)) { await PB.update('practice_sets', rec.id, data); n++; }
  }
  cache.weeks = null;
  if (n) toast(`Content synced: ${n} item${n > 1 ? 's' : ''} updated`);
}

/* ---------- admin ---------- */
async function renderAdmin(user, tab = 'queue') {
  try { await syncContent(); } catch (e) { toast('Content sync failed: ' + e.message); }
  const tabs = ['queue', 'questions', 'reports', 'students', 'content'];
  let body = '';
  if (tab === 'queue') {
    const subs = await PB.all('submissions', { filter: 'status = "submitted"', expand: 'user,week', sort: 'created' });
    body = `<h2>Checkpoints to review (${subs.length})</h2>` + (subs.map(s => `<div class="card" data-id="${s.id}">
      <div class="row spread"><b>${esc(s.expand?.user?.name)}</b><span class="small muted">Week ${s.expand?.week?.number} · ${fmtDate(s.created)}</span></div>
      <p>${esc(s.notes)}</p>${s.link ? `<p><a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.link)}</a></p>` : ''}${s.file ? `<p><a href="${PB.fileUrl(s, s.file)}" target="_blank" rel="noopener">Open attached file</a></p>` : ''}
      <label>Feedback</label><textarea class="fb" placeholder="Two or three specific sentences. Claude can draft this; you decide."></textarea>
      <label>Score (0–10)</label><input class="sc" type="number" min="0" max="10" value="7">
      <p class="row" style="margin-top:10px"><button class="approve">Approve</button><button class="revise secondary">Ask to revise</button></p></div>`).join('') || '<p class="muted">Queue is empty.</p>');
  } else if (tab === 'questions') {
    const qs = await PB.all('tutor_questions', { filter: 'status = "open"', expand: 'user,lesson', sort: 'created' });
    body = `<h2>Open questions (${qs.length})</h2>` + (qs.map(q => `<div class="card" data-id="${q.id}"><div class="row spread"><b>${esc(q.expand?.user?.name)}</b><span class="small muted">${q.expand?.lesson ? esc(q.expand.lesson.title) : 'General'} · ${fmtDate(q.created)}</span></div><p>${esc(q.question)}</p><textarea class="ans" placeholder="Answer in plain words. Paste the question into Claude for a draft if useful."></textarea><p style="margin-top:8px"><button class="answer">Send answer</button></p></div>`).join('') || '<p class="muted">No open questions.</p>');
  } else if (tab === 'reports') {
    const [students, ws, reports] = await Promise.all([PB.all('users', { filter: 'role = "student"', sort: 'name' }), weeks(), PB.all('reports', { expand: 'user,week', sort: '-created' })]);
    body = `<div class="card"><h2>New report</h2>
      <label>Student</label><select id="r-user">${students.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
      <div class="grid2"><div><label>Type</label><select id="r-type"><option value="weekly">Weekly</option><option value="stream">Stream recommendation</option><option value="final">Final</option></select></div>
      <div><label>Week</label><select id="r-week"><option value="">—</option>${ws.map(w => `<option value="${w.id}">Week ${w.number}</option>`).join('')}</select></div></div>
      <label>Body (HTML or plain text)</label><textarea id="r-body" style="min-height:160px" placeholder="Draft it with Claude from the student's data, paste here, read it once, then approve."></textarea>
      <p class="row" style="margin-top:10px"><button id="r-save">Save as draft</button><button id="r-save-approve" class="secondary">Save and approve</button></p></div>
      <h2>All reports</h2><ul class="list">${reports.map(r => `<li data-id="${r.id}"><div><b>${esc(r.expand?.user?.name)}</b> · ${r.type}${r.expand?.week ? ' · week ' + r.expand.week.number : ''}<div class="small muted">${fmtDate(r.created)}</div></div><div class="row">${r.approved ? '<span class="pill ok">Approved</span>' : '<button class="r-approve ghost">Approve</button>'}${r.sent ? '<span class="pill ok">Sent</span>' : (r.approved ? '<button class="r-sent ghost">Mark sent</button>' : '')}</div></li>`).join('') || '<li class="muted">None yet.</li>'}</ul>`;
  } else if (tab === 'students') {
    const all = await PB.all('users', { sort: 'role,name', expand: 'parent' });
    body = `<div class="card"><h2>Add a student and parent</h2>
      <div class="grid2"><div><label>Student name</label><input id="n-sname"></div><div><label>Student email</label><input id="n-semail"></div>
      <div><label>Parent name</label><input id="n-pname"></div><div><label>Parent email</label><input id="n-pemail"></div>
      <div><label>Parent phone</label><input id="n-phone"></div><div><label>Password for both</label><input id="n-pass" value="Pragati2027!"></div>
      <div><label>Cohort</label><input id="n-cohort" value="pilot-2027"></div></div>
      <p style="margin-top:10px"><button id="n-add">Create accounts</button></p></div>
      <h2>Accounts</h2><ul class="list">${all.map(u => `<li data-id="${u.id}"><div><b>${esc(u.name)}</b> <span class="pill">${u.role}</span><div class="small muted">${esc(u.email)}${u.role === 'student' ? ' · ' + esc(STREAMS[u.stream || 'undecided']) + ' · ' + esc(u.cohort || '') + (u.expand?.parent ? ' · parent: ' + esc(u.expand.parent.name) : '') : ''}</div></div>${u.role === 'student' ? `<select class="set-stream" style="width:auto">${Object.entries(STREAMS).map(([k, v]) => `<option value="${k}" ${u.stream === k ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ''}</li>`).join('')}</ul>`;
  } else if (tab === 'content') {
    const byWeek = (a, b) => (a.expand?.week?.number || 0) - (b.expand?.week?.number || 0);
    const [ls, ss] = await Promise.all([PB.all('lessons', { expand: 'week', sort: 'track,order' }), PB.all('practice_sets', { expand: 'week', sort: 'stream,day' })]);
    ls.sort(byWeek); ss.sort(byWeek);
    body = `<p class="muted small">Toggle approval. Content itself is edited in the PocketBase admin panel (<a href="/_/" target="_blank" rel="noopener">open</a>) or by uploading a new content file.</p>
      <h2>Lessons</h2><ul class="list">${ls.map(l => `<li data-col="lessons" data-id="${l.id}"><div>W${l.expand?.week?.number} <span class="pill ${l.track}">${TRACK[l.track]}</span> ${esc(l.title)}</div><button class="toggle ghost">${l.approved ? 'Approved ✓' : 'Approve'}</button></li>`).join('')}</ul>
      <h2>Practice sets</h2><ul class="list">${ss.map(s => `<li data-col="practice_sets" data-id="${s.id}"><div>W${s.expand?.week?.number} · ${s.stream} · day ${s.day} · ${esc(s.title)}</div><button class="toggle ghost">${s.approved ? 'Approved ✓' : 'Approve'}</button></li>`).join('')}</ul>`;
  }
  view.innerHTML = `<h1>Admin</h1><div class="tabs">${tabs.map(t => `<button class="${t === tab ? 'active' : ''}" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>${body}`;
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => renderAdmin(user, b.dataset.tab));
  const idOf = el => el.closest('[data-id]').dataset.id;
  document.querySelectorAll('.approve, .revise').forEach(b => b.onclick = async () => {
    const card = b.closest('.card');
    await PB.update('submissions', idOf(b), { status: b.classList.contains('approve') ? 'approved' : 'revise', feedback: card.querySelector('.fb').value.trim(), score: Number(card.querySelector('.sc').value) });
    toast('Saved'); renderAdmin(user, 'queue');
  });
  document.querySelectorAll('.answer').forEach(b => b.onclick = async () => {
    const a = b.closest('.card').querySelector('.ans').value.trim(); if (!a) return toast('Write an answer first');
    await PB.update('tutor_questions', idOf(b), { answer: a, status: 'answered' }); toast('Answered'); renderAdmin(user, 'questions');
  });
  const saveReport = async approved => {
    const body = $('#r-body').value.trim(); if (!body) return toast('Report is empty');
    await PB.create('reports', { user: $('#r-user').value, type: $('#r-type').value, week: $('#r-week').value || null, body: body.includes('<') ? body : '<p>' + esc(body).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>') + '</p>', approved, sent: false });
    toast(approved ? 'Saved and approved' : 'Draft saved'); renderAdmin(user, 'reports');
  };
  $('#r-save')?.addEventListener('click', () => saveReport(false));
  $('#r-save-approve')?.addEventListener('click', () => saveReport(true));
  document.querySelectorAll('.r-approve').forEach(b => b.onclick = async () => { await PB.update('reports', idOf(b), { approved: true }); renderAdmin(user, 'reports'); });
  document.querySelectorAll('.r-sent').forEach(b => b.onclick = async () => { await PB.update('reports', idOf(b), { sent: true }); renderAdmin(user, 'reports'); });
  $('#n-add')?.addEventListener('click', async () => {
    const v = id => $(id).value.trim(); const pass = v('#n-pass');
    if (!v('#n-sname') || !v('#n-semail') || !v('#n-pemail')) return toast('Name and both emails are required');
    try {
      const p = await PB.create('users', { email: v('#n-pemail'), password: pass, passwordConfirm: pass, name: v('#n-pname') || 'Parent', role: 'parent', product: 'teens', phone: v('#n-phone'), emailVisibility: true, verified: true });
      await PB.create('users', { email: v('#n-semail'), password: pass, passwordConfirm: pass, name: v('#n-sname'), role: 'student', product: 'teens', class_level: '10', stream: 'undecided', parent: p.id, cohort: v('#n-cohort'), streak: 0, emailVisibility: true, verified: true });
      toast('Accounts created'); renderAdmin(user, 'students');
    } catch (e) { toast('Failed: ' + e.message); }
  });
  document.querySelectorAll('.set-stream').forEach(s => s.onchange = async () => { await PB.update('users', idOf(s), { stream: s.value }); toast('Stream updated'); });
  document.querySelectorAll('.toggle').forEach(b => b.onclick = async () => {
    const li = b.closest('[data-id]'); const col = li.dataset.col; const rec = await PB.getOne(col, li.dataset.id);
    await PB.update(col, li.dataset.id, { approved: !rec.approved }); renderAdmin(user, 'content');
  });
}

/* ---------- router ---------- */
async function route() {
  const user = PB.isLoggedIn() ? (PB.user || await PB.refresh()) : null;
  if (!user) return renderLogin();
  $('#logout').style.display = ''; $('#who').textContent = user.role === 'admin' ? 'admin' : user.name.split(' ')[0];
  $('#nav-progress').style.display = user.role === 'student' ? '' : 'none';
  const [path, arg] = location.hash.replace('#', '').split('/');
  view.innerHTML = '<p class="muted">Loading…</p>'; view.parentElement.classList.remove('wide');
  try {
    if (user.role === 'admin') return renderAdmin(user, path && path !== 'home' ? path : 'queue');
    if (user.role === 'parent') return renderParent(user);
    switch (path) {
      case 'lesson': return renderLesson(user, arg);
      case 'practice': return renderPractice(user, arg);
      case 'project': return renderProject(user);
      case 'ask': return renderAsk(user);
      case 'progress': return renderProgress(user);
      default: return renderHome(user);
    }
  } catch (e) { view.innerHTML = `<div class="card"><p style="color:var(--danger)">Something went wrong: ${esc(e.message)}</p><p><a href="#home">Back home</a></p></div>`; }
}
$('#logout').onclick = () => { PB.logout(); cache.weeks = null; go('#home'); renderLogin(); };
$('#nav-progress').onclick = () => go('#progress');
window.addEventListener('hashchange', route);
PB.refresh().finally(route);
