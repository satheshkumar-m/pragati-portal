/* Tiny PocketBase REST client. No SDK, no build step.
   Base URL = same origin (PocketBase lives under /api on this site). */
const PB = (() => {
  const BASE = window.PB_BASE || location.origin;
  const KEY = 'pragati_auth';
  let auth = JSON.parse(localStorage.getItem(KEY) || 'null');

  function save(a) { auth = a; a ? localStorage.setItem(KEY, JSON.stringify(a)) : localStorage.removeItem(KEY); }

  async function req(path, { method = 'GET', body, form, retry = true, token } = {}) {
    const headers = {};
    const t = token || (auth && auth.token);
    if (t) headers['Authorization'] = t;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    let res;
    try {
      res = await fetch(BASE + path, { method, headers, body: payload });
    } catch (e) {
      if (retry) { await new Promise(r => setTimeout(r, 3000)); return req(path, { method, body, form, retry: false, token }); }
      throw e;
    }
    if (res.status === 503 && retry) { await new Promise(r => setTimeout(r, 4000)); return req(path, { method, body, form, retry: false, token }); }
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) {
      const msg = data.message || res.statusText;
      const details = data.data ? ' ' + JSON.stringify(data.data) : '';
      const err = new Error(msg + details); err.status = res.status; err.data = data; throw err;
    }
    return data;
  }

  const q = obj => Object.entries(obj).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');

  return {
    get user() { return auth && auth.record; },
    get token() { return auth && auth.token; },
    isLoggedIn() { return !!(auth && auth.token); },
    logout() { save(null); },
    async login(identity, password, collection = 'users') {
      const d = await req(`/api/collections/${collection}/auth-with-password`, { method: 'POST', body: { identity, password } });
      save({ token: d.token, record: d.record, collection });
      return d.record;
    },
    async refresh() {
      if (!auth) return null;
      try {
        const d = await req(`/api/collections/${auth.collection || 'users'}/auth-refresh`, { method: 'POST' });
        save({ ...auth, token: d.token, record: d.record });
        return d.record;
      } catch { save(null); return null; }
    },
    async list(col, { filter, sort, expand, page = 1, perPage = 200, fields } = {}) {
      return req(`/api/collections/${col}/records?` + q({ filter, sort, expand, page, perPage, fields }));
    },
    async all(col, opts = {}) { const d = await this.list(col, opts); return d.items; },
    async first(col, opts = {}) { const d = await this.list(col, { ...opts, perPage: 1 }); return d.items[0] || null; },
    async getOne(col, id, expand) { return req(`/api/collections/${col}/records/${id}?` + q({ expand })); },
    async create(col, body) { return req(`/api/collections/${col}/records`, { method: 'POST', body }); },
    async createForm(col, form) { return req(`/api/collections/${col}/records`, { method: 'POST', form }); },
    async update(col, id, body) { return req(`/api/collections/${col}/records/${id}`, { method: 'PATCH', body }); },
    async remove(col, id) { return req(`/api/collections/${col}/records/${id}`, { method: 'DELETE' }); },
    fileUrl(record, filename) { return `${BASE}/api/files/${record.collectionId}/${record.id}/${filename}`; },
    raw: req,
  };
})();
