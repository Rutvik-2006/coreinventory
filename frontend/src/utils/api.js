const BASE_URL = '/api';

const getToken = () => localStorage.getItem('ci_token');

class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function request(method, path, body = null, params = null) {
  const url = new URL(BASE_URL + path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }

  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json().catch(() => ({ message: 'Invalid server response' }));

  if (!res.ok) {
    throw new ApiError(
      data.message || `Request failed (${res.status})`,
      res.status,
      data.errors
    );
  }

  return data;
}

export const api = {
  get:    (path, params) => request('GET',    path, null, params),
  post:   (path, body)   => request('POST',   path, body),
  put:    (path, body)   => request('PUT',    path, body),
  delete: (path)         => request('DELETE', path),
};

export { ApiError };

// ── Typed API methods ─────────────────────────────────────────────────────────

export const authApi = {
  login:         (body) => api.post('/auth/login', body),
  register:      (body) => api.post('/auth/register', body),
  forgotPassword:(body) => api.post('/auth/forgot-password', body),
  resetPassword: (body) => api.post('/auth/reset-password', body),
  me:            ()     => api.get('/auth/me'),
};

export const dashboardApi = {
  kpis:     () => api.get('/dashboard/kpis'),
  overview: () => api.get('/dashboard/overview'),
};

export const productsApi = {
  list:       (params) => api.get('/products', params),
  get:        (id)     => api.get(`/products/${id}`),
  create:     (body)   => api.post('/products', body),
  update:     (id, b)  => api.put(`/products/${id}`, b),
  remove:     (id)     => api.delete(`/products/${id}`),
  categories: ()       => api.get('/products/categories'),
};

export const movesApi = {
  list:     (params) => api.get('/moves', params),
  get:      (id)     => api.get(`/moves/${id}`),
  create:   (body)   => api.post('/moves', body),
  validate: (id, b)  => api.post(`/moves/${id}/validate`, b || {}),
  cancel:   (id)     => api.post(`/moves/${id}/cancel`, {}),
};

export const stockApi = {
  adjust: (body) => api.post('/stock/adjust', body),
};

export const warehousesApi = {
  list:            ()       => api.get('/warehouses'),
  create:          (body)   => api.post('/warehouses', body),
  locations:       (id)     => api.get(`/warehouses/${id}/locations`),
  allLocations:    ()       => api.get('/warehouses/locations'),
  createLocation:  (id, b)  => api.post(`/warehouses/${id}/locations`, b),
};
