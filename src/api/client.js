const TOKEN_KEY = 'hs_access_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function withCacheBust(path) {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}_hs=${Date.now()}`;
}

async function parseJsonResponse(res) {
  const text = await res.text();
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error('Server je vratio neispravan JSON odgovor.');
    err.status = res.status;
    throw err;
  }
}

const REQUEST_TIMEOUT_MS = 20000;
const AUTH_TIMEOUT_MS = 10000;

async function request(path, options = {}, attempt = 0) {
  const timeoutMs = path.startsWith('/auth') ? AUTH_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
  const headers = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    ...options.headers,
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const { signal: _ignored, ...restOptions } = options;

  let res;
  try {
    res = await fetch(withCacheBust(`/api${path}`), {
      ...restOptions,
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') {
      const err = new Error(
        'Server ne odgovara na vreme. Proverite da li API radi (npm run dev:server ili npm run dev:all).',
      );
      err.status = 0;
      throw err;
    }
    const err = new Error(
      'Ne mogu da se povežem sa serverom. Pokrenite API: npm run dev:server (port 3001).',
    );
    err.status = 0;
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 304 && attempt < 2) {
    return request(path, options, attempt + 1);
  }

  if (!res.ok) {
    const errBody = (await parseJsonResponse(res)) || {};
    const err = new Error(errBody.message || res.statusText || 'Greška servera');
    err.status = res.status;
    err.data = errBody;
    throw err;
  }
  if (res.status === 204) return null;
  return parseJsonResponse(res);
}

function asArray(data) {
  return Array.isArray(data) ? data : [];
}

function entityApi(resource, extra = {}) {
  return {
    ...extra,
    async list(sort) {
      const q = sort ? `?sort=${encodeURIComponent(sort)}` : '';
      const data = await request(`/${resource}${q}`);
      return asArray(data);
    },
    async filter(query = {}, sort) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v != null && v !== '') params.set(k, v);
      });
      if (sort) params.set('sort', sort);
      const qs = params.toString();
      const data = await request(`/${resource}${qs ? `?${qs}` : ''}`);
      return asArray(data);
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
      return request(`/${resource}/bulk`, {
        method: 'POST',
        body: JSON.stringify(Array.isArray(items) ? items : []),
      });
    },
  };
}

const auth = {
  async me() {
    const user = await request('/auth/me');
    if (!user) throw new Error('Niste prijavljeni');
    return user;
  },
  async profileImage() {
    return request('/auth/me/profile-image');
  },
  async updateMe(data) {
    return request('/auth/me', { method: 'PUT', body: JSON.stringify(data) });
  },
  async changePassword({ current_password, new_password }) {
    return request('/auth/me', {
      method: 'PUT',
      body: JSON.stringify({ current_password, new_password }),
    });
  },
  async login(email, password) {
    const result = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!result?.token) throw new Error('Prijava nije uspela');
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

async function apiFetch(path, options = {}) {
  const headers = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    ...options.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(withCacheBust(`/api${path}`), {
    ...options,
    headers,
    cache: 'no-store',
  });
}

const integrations = {
  Core: {
    async UploadFile({ file }) {
      const form = new FormData();
      form.append('file', file);
      const res = await apiFetch('/import/pdf', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      return { file_url: 'local' };
    },
    async ExtractDataFromUploadedFile({ file }) {
      try {
        const form = new FormData();
        if (file instanceof File) form.append('file', file);
        const res = await apiFetch('/import/pdf', { method: 'POST', body: form });
        let data = {};
        try {
          data = (await parseJsonResponse(res)) || {};
        } catch {
          return {
            status: 'error',
            details:
              res.status === 401
                ? 'Sesija je istekla — prijavite se ponovo.'
                : 'Server je vratio neispravan odgovor (nije JSON).',
          };
        }
        if (!res.ok) {
          return {
            status: 'error',
            details: data.details || data.message || `Greška servera (${res.status})`,
          };
        }
        return data;
      } catch (e) {
        return {
          status: 'error',
          details:
            e.message ||
            'Ne mogu da se povežem sa serverom. Proverite da li API radi na portu 3001.',
        };
      }
    },
    /** Atomski snimi preview redove u bazu (kuće + sobe) */
    async CommitPdfImport({ location, entries }) {
      return request('/import/commit', {
        method: 'POST',
        body: JSON.stringify({
          location: location ?? null,
          entries: Array.isArray(entries) ? entries : [],
        }),
      });
    },
  },
};

const invites = {
  list() {
    return request('/invites').then(asArray);
  },
  create(data) {
    return request('/invites', { method: 'POST', body: JSON.stringify(data) });
  },
  delete(id) {
    return request(`/invites/${id}`, { method: 'DELETE' });
  },
  preview(token) {
    return request(`/invites/preview/${token}`);
  },
  accept(token, data) {
    return request(`/invites/accept/${token}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

const info = {
  browse(parentId = null) {
    const q =
      parentId == null || parentId === ''
        ? ''
        : `?parent_id=${encodeURIComponent(parentId)}`;
    return request(`/info/browse${q}`);
  },
  createFolder(name, parentId = null, color = null) {
    return request('/info/folders', {
      method: 'POST',
      body: JSON.stringify({
        name,
        parent_id: parentId ?? null,
        color: color ?? null,
      }),
    });
  },
  updateFolder(id, data) {
    return request(`/info/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteFolder(id) {
    return request(`/info/folders/${id}`, { method: 'DELETE' });
  },
  async uploadFile(folderId, file) {
    const form = new FormData();
    form.append('file', file);
    form.append('folder_id', folderId);
    return request('/info/files', { method: 'POST', body: form });
  },
  async fetchFileBlob(id, { inline = false } = {}) {
    const token = getToken();
    const q = inline ? '?inline=1' : '';
    const res = await fetch(withCacheBust(`/api/info/files/${id}/download${q}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    });
    if (!res.ok) {
      const errBody = (await parseJsonResponse(res)) || {};
      throw new Error(errBody.message || 'Fajl nije mogao biti učitan');
    }
    return res.blob();
  },
  async downloadFile(id, filename) {
    const blob = await this.fetchFileBlob(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  async previewFile(file) {
    const blob = await this.fetchFileBlob(file.id, { inline: true });
    const url = URL.createObjectURL(blob);
    return { url, blob };
  },
  deleteFile(id) {
    return request(`/info/files/${id}`, { method: 'DELETE' });
  },
};

const notifications = {
  list(limit) {
    const q = limit ? `?limit=${limit}` : '';
    return request(`/notifications${q}`).then(asArray);
  },
  unreadCount() {
    return request('/notifications/unread-count');
  },
  markRead(id) {
    return request(`/notifications/${id}/read`, { method: 'PATCH' });
  },
  markAllRead() {
    return request('/notifications/read-all', { method: 'PATCH' });
  },
};

export const api = {
  entities: {
    House: entityApi('houses'),
    Room: entityApi('rooms'),
    Column: entityApi('columns'),
    Task: entityApi('tasks'),
    User: {
      ...entityApi('users'),
      assignable() {
        return request('/users/assignable').then(asArray);
      },
      createAccount(data) {
        return request('/users', { method: 'POST', body: JSON.stringify(data) });
      },
      resetPassword(id) {
        return request(`/users/${id}/password`, { method: 'PATCH' });
      },
    },
  },
  invites,
  info,
  notifications,
  houses: {
    setMembers(houseId, userIds) {
      return request(`/houses/${houseId}/members`, {
        method: 'PUT',
        body: JSON.stringify({ user_ids: userIds }),
      });
    },
  },
  auth,
  integrations,
  appLogs: {
    logUserInApp() {
      return Promise.resolve();
    },
  },
};

export const base44 = api;
