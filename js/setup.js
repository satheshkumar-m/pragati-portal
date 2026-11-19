/* One-time setup: creates PocketBase collections, rules, accounts and week-1 content.
   Run from setup.html in a browser, logged in as the PocketBase superuser.
   Safe to re-run: existing collections and records are skipped. */

const log = (msg, cls = '') => {
  const el = document.getElementById('log');
  const p = document.createElement('div'); p.className = 'logline ' + cls; p.textContent = msg; el.appendChild(p); el.scrollTop = el.scrollHeight;
};

const ADMIN = '@request.auth.role = "admin"';
const LOGGED = '@request.auth.id != ""';
const OWN_OR_PARENT_OR_ADMIN = `user = @request.auth.id || user.parent = @request.auth.id || ${ADMIN}`;

function autodates() {
  return [
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ];
}

async function getCollection(name) {
  try { return await PB.raw(`/api/collections/${name}`); } catch (e) { if (e.status === 404) return null; throw e; }
}

async function ensureCollection(def) {
  const existing = await getCollection(def.name);
  if (existing) { log(`collection ${def.name}: exists, skipped`); return existing; }
  const created = await PB.raw('/api/collections', { method: 'POST', body: { type: 'base', ...def, fields: [...def.fields, ...autodates()] } });
  log(`collection ${def.name}: created`, 'ok');
  return created;
}

async function patchUsers(usersCol) {
  const have = new Set(usersCol.fields.map(f => f.name));
  const add = [
    { name: 'role', type: 'select', values: ['student', 'parent', 'admin'], maxSelect: 1 },
    { name: 'product', type: 'select', values: ['teens', 'kids'], maxSelect: 1 },
    { name: 'class_level', type: 'text' },
    { name: 'stream', type: 'select', values: ['pcm', 'pcb', 'commerce', 'humanities', 'undecided'], maxSelect: 1 },
    { name: 'parent', type: 'relation', collectionId: usersCol.id, maxSelect: 1, cascadeDelete: false },
    { name: 'phone', type: 'text' },
    { name: 'cohort', type: 'text' },
    { name: 'streak', type: 'number' },
  ].filter(f => !have.has(f.name));
  const body = {
    fields: [...usersCol.fields, ...add],
    listRule: `id = @request.auth.id || parent = @request.auth.id || ${ADMIN}`,
    viewRule: `id = @request.auth.id || parent = @request.auth.id || ${ADMIN}`,
    createRule: `@request.body.role != "admin"`,
    updateRule: `(id = @request.auth.id && @request.body.role:isset = false) || ${ADMIN}`,
    deleteRule: ADMIN,
  };
  await PB.raw(`/api/collections/${usersCol.id}`, { method: 'PATCH', body });
  log(`users: ${add.length ? 'added ' + add.map(f => f.name).join(', ') : 'fields already present'}; rules set`, 'ok');
  return getCollection('users');
}

async function createUser(data) {
  const found = await PB.first('users', { filter: `email = "${data.email}"` }).catch(() => null);
  if (found) { log(`user ${data.email}: exists, skipped`); return found; }
  const u = await PB.create('users', { ...data, passwordConfirm: data.password, emailVisibility: true, verified: true });
  log(`user ${data.email} (${data.role}): created`, 'ok');
  return u;
}

async function seed(cols) {
  const res = await fetch('content/week1.json'); const content = await res.json();
  const weekIds = {};
  for (const w of content.weeks) {
    let rec = await PB.first('weeks', { filter: `number = ${w.number}` });
    if (!rec) { rec = await PB.create('weeks', { ...w, product: 'teens' }); log(`week ${w.number}: created`, 'ok'); }
    weekIds[w.number] = rec.id;
  }
  for (const l of content.lessons) {
    const exists = await PB.first('lessons', { filter: `week = "${weekIds[l.week]}" && track = "${l.track}" && order = ${l.order}` });
    if (exists) { await PB.update('lessons', exists.id, { ...l, week: weekIds[l.week] }); log(`lesson "${l.title}": updated`, 'ok'); continue; }
    await PB.create('lessons', { ...l, week: weekIds[l.week], approved: true });
    log(`lesson "${l.title}": created`, 'ok');
  }
  for (const p of content.practice_sets) {
    const exists = await PB.first('practice_sets', { filter: `week = "${weekIds[p.week]}" && stream = "${p.stream}" && day = ${p.day}` });
    if (exists) { await PB.update('practice_sets', exists.id, { ...p, week: weekIds[p.week] }); log(`practice set "${p.title}": updated`, 'ok'); continue; }
    await PB.create('practice_sets', { ...p, week: weekIds[p.week], approved: true });
    log(`practice set "${p.title}": created`, 'ok');
  }
}

async function run() {
  const f = id => document.getElementById(id).value.trim();
  const btn = document.getElementById('run'); btn.disabled = true;
  try {
    log('Logging in as superuser...');
    await PB.login(f('su_email'), f('su_pass'), '_superusers');
    log('Superuser OK', 'ok');

    let users = await getCollection('users');
    users = await patchUsers(users);

    const weeks = await ensureCollection({
      name: 'weeks',
      fields: [
        { name: 'number', type: 'number', required: true },
        { name: 'title', type: 'text', required: true },
        { name: 'summary', type: 'text' },
        { name: 'unlock_date', type: 'date' },
        { name: 'product', type: 'select', values: ['teens', 'kids'], maxSelect: 1 },
      ],
      listRule: LOGGED, viewRule: LOGGED, createRule: ADMIN, updateRule: ADMIN, deleteRule: ADMIN,
    });

    const contentRules = { listRule: `${LOGGED} && (approved = true || ${ADMIN})`, viewRule: `${LOGGED} && (approved = true || ${ADMIN})`, createRule: ADMIN, updateRule: ADMIN, deleteRule: ADMIN };

    const lessons = await ensureCollection({
      name: 'lessons',
      fields: [
        { name: 'week', type: 'relation', collectionId: weeks.id, maxSelect: 1, required: true },
        { name: 'track', type: 'select', values: ['stream', 'ai', 'academic'], maxSelect: 1, required: true },
        { name: 'order', type: 'number' },
        { name: 'title', type: 'text', required: true },
        { name: 'minutes', type: 'number' },
        { name: 'video_url', type: 'text' },
        { name: 'body', type: 'editor' },
        { name: 'questions', type: 'json', maxSize: 500000 },
        { name: 'approved', type: 'bool' },
      ], ...contentRules,
    });

    const sets = await ensureCollection({
      name: 'practice_sets',
      fields: [
        { name: 'week', type: 'relation', collectionId: weeks.id, maxSelect: 1, required: true },
        { name: 'stream', type: 'select', values: ['pcm', 'pcb', 'commerce', 'humanities'], maxSelect: 1 },
        { name: 'day', type: 'number' },
        { name: 'title', type: 'text' },
        { name: 'difficulty', type: 'number' },
        { name: 'questions', type: 'json', maxSize: 500000 },
        { name: 'approved', type: 'bool' },
      ], ...contentRules,
    });

    const ownRules = { listRule: OWN_OR_PARENT_OR_ADMIN, viewRule: OWN_OR_PARENT_OR_ADMIN, createRule: `${LOGGED} && user = @request.auth.id`, updateRule: `user = @request.auth.id || ${ADMIN}`, deleteRule: ADMIN };

    await ensureCollection({
      name: 'attempts',
      fields: [
        { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1, required: true },
        { name: 'lesson', type: 'relation', collectionId: lessons.id, maxSelect: 1, required: true },
        { name: 'answers', type: 'json', maxSize: 100000 },
        { name: 'score', type: 'number' },
        { name: 'total', type: 'number' },
      ], ...ownRules,
    });

    await ensureCollection({
      name: 'practice_attempts',
      fields: [
        { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1, required: true },
        { name: 'set', type: 'relation', collectionId: sets.id, maxSelect: 1, required: true },
        { name: 'answers', type: 'json', maxSize: 100000 },
        { name: 'score', type: 'number' },
        { name: 'total', type: 'number' },
      ], ...ownRules,
    });

    await ensureCollection({
      name: 'submissions',
      fields: [
        { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1, required: true },
        { name: 'week', type: 'relation', collectionId: weeks.id, maxSelect: 1, required: true },
        { name: 'link', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'file', type: 'file', maxSelect: 1, maxSize: 10485760 },
        { name: 'status', type: 'select', values: ['submitted', 'approved', 'revise'], maxSelect: 1 },
        { name: 'feedback', type: 'text' },
        { name: 'score', type: 'number' },
      ], ...ownRules,
    });

    await ensureCollection({
      name: 'tutor_questions',
      fields: [
        { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1, required: true },
        { name: 'lesson', type: 'relation', collectionId: lessons.id, maxSelect: 1 },
        { name: 'question', type: 'text', required: true },
        { name: 'answer', type: 'text' },
        { name: 'status', type: 'select', values: ['open', 'answered'], maxSelect: 1 },
      ],
      listRule: `user = @request.auth.id || ${ADMIN}`, viewRule: `user = @request.auth.id || ${ADMIN}`,
      createRule: `${LOGGED} && user = @request.auth.id`, updateRule: ADMIN, deleteRule: ADMIN,
    });

    await ensureCollection({
      name: 'reports',
      fields: [
        { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1, required: true },
        { name: 'week', type: 'relation', collectionId: weeks.id, maxSelect: 1 },
        { name: 'type', type: 'select', values: ['weekly', 'stream', 'final'], maxSelect: 1 },
        { name: 'body', type: 'editor' },
        { name: 'approved', type: 'bool' },
        { name: 'sent', type: 'bool' },
      ],
      listRule: `((user = @request.auth.id || user.parent = @request.auth.id) && approved = true) || ${ADMIN}`,
      viewRule: `((user = @request.auth.id || user.parent = @request.auth.id) && approved = true) || ${ADMIN}`,
      createRule: ADMIN, updateRule: ADMIN, deleteRule: ADMIN,
    });

    log('Creating accounts...');
    await createUser({ email: f('admin_email'), password: f('admin_pass'), name: 'Admin', role: 'admin', product: 'teens' });
    const parent = await createUser({ email: f('parent_email'), password: f('test_pass'), name: 'Test Parent', role: 'parent', product: 'teens', phone: '' });
    await createUser({ email: f('student_email'), password: f('test_pass'), name: 'Test Student', role: 'student', product: 'teens', class_level: '10', stream: 'undecided', parent: parent.id, cohort: 'alpha', streak: 0 });

    log('Seeding week 1 content...');
    await seed();
    log('DONE. Log out of setup and open app.html.', 'ok');
    PB.logout();
  } catch (e) {
    log('ERROR: ' + e.message, 'err'); console.error(e);
  } finally { btn.disabled = false; }
}

document.getElementById('run').addEventListener('click', run);
