const TOKEN_KEY = 'hs_access_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const err = new Error(errBody.message || res.statusText);
    err.status = res.status;
    err.data = errBody;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

function entityApi(resource, extra = {}) {
  return {
    ...extra,
    list(sort) {
      const q = sort ? `?sort=${encodeURIComponent(sort)}` : '';
      return request(`/${resource}${q}`);
    },
    filter(query = {}, sort) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v != null && v !== '') params.set(k, v);
      });
      if (sort) params.set('sort', sort);
      const qs = params.toString();
      return request(`/${resource}${qs ? `?${qs}` : ''}`);
    },
    create(data) {
      return request(`/${resource}`, { method: 'POST', body: JSON.stringify(data) });
    },
    update(id, data) {
      return request(`/${resource}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    delete(id) {
      return request(`/${resource}/${id}`, { method: 'DELETE' });
    },
    bulkCreate(items) {
      return request(`/${resource}/bulk`, { method: 'POST', body: JSON.stringify(items) });
    },
  };
}

const auth = {
  async me() {
    return request('/auth/me');
  },
  async updateMe(data) {
    return request('/auth/me', { method: 'PUT', body: JSON.stringify(data) });
  },
  async login(email, password) {
    const result = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(result.token);
    return result.user;
  },
  logout() {
    setToken(null);
    window.location.href = '/login';
  },
  redirectToLogin() {
    window.location.href = '/login';
  },
  setToken,
  getToken,
};

const integrations = {
  Core: {
    async UploadFile({ file }) {
      const form = new FormData();
      form.append('file', file);
      const token = getToken();
      const res = await fetch('/api/import/pdf', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error('Upload failed');
      return { file_url: 'local' };
    },
    async ExtractDataFromUploadedFile({ file }) {
      const form = new FormData();
      if (file instanceof File) form.append('file', file);
      const token = getToken();
      const res = await fetch('/api/import/pdf', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        return { status: 'error', details: data.details || data.message };
      }
      return data;
    },
  },
};

export const api = {
  entities: {
    House: entityApi('houses'),
    Room: entityApi('rooms'),
    Column: entityApi('columns'),
    Task: entityApi('tasks'),
    User: entityApi('users'),
  },
  auth,
  integrations,
  appLogs: {
    logUserInApp() {
      return Promise.resolve();
    },
  },
};

/** Kompatibilnost sa starim importima */
export const base44 = api;
