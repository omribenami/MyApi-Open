const BASE = 'http://localhost:4501';

function headers() {
  const h = { 'Content-Type': 'application/json' };
  const t = localStorage.getItem('token');
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

export async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), ...opts });
  if (res.status === 401) { localStorage.removeItem('token'); window.location.hash = '#/login'; throw new Error('Unauthorized'); }
  return res.json();
}

export const get = (p) => api(p);
export const post = (p, body) => api(p, { method: 'POST', body: JSON.stringify(body) });
export const put = (p, body) => api(p, { method: 'PUT', body: JSON.stringify(body) });
export const del = (p) => api(p, { method: 'DELETE' });
