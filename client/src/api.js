const API_BASE = 'http://localhost:3000/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('stockit_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'Something went wrong');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(fullName, email, password) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, password }),
  });
}

export function getProducts(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return request(`/products${query}`);
}

export function createProduct(product) {
  return request('/products', {
    method: 'POST',
    body: JSON.stringify(product),
  });
}

export function updateProduct(id, product) {
  return request(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(product),
  });
}

export function deleteProduct(id) {
  return request(`/products/${id}`, {
    method: 'DELETE',
  });
}

export function adjustStock(id, stockPresent, stockUpdatedDate) {
  return request(`/products/${id}/stock`, {
    method: 'PATCH',
    body: JSON.stringify({ stockPresent, stockUpdatedDate }),
  });
}

export function getCategories() {
  return request('/categories');
}

export function createCategory(name, description = '') {
  return request('/categories', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}
