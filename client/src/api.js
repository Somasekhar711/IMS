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

export function register(fullName, email, password, securityQuestion, securityAnswer) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, password, securityQuestion, securityAnswer }),
  });
}

export function getSecurityQuestions() {
  return request('/auth/security-questions');
}

export function getSecurityQuestionForEmail(email) {
  return request('/auth/security-question', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPasswordWithSecurityAnswer(email, securityAnswer, newPassword) {
  return request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, securityAnswer, newPassword }),
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

export function deleteProduct(id) {
  return request(`/products/${id}`, {
    method: 'DELETE',
  });
}

export function updateProduct(id, product) {
  return request(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(product),
  });
}

export function adjustProductStock(id, stockPresent, reason = '') {
  return request(`/products/${id}/stock`, {
    method: 'PATCH',
    body: JSON.stringify({ stockPresent, reason }),
  });
}

export function getCategories(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return request(`/categories${query}`);
}

export function createCategory(name, description = '') {
  return request('/categories', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export function updateCategory(id, name, description = '') {
  return request(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, description }),
  });
}

export function deleteCategory(id) {
  return request(`/categories/${id}`, {
    method: 'DELETE',
  });
}

export function getSuppliers() {
  return request('/suppliers');
}

export function createSupplier(supplier) {
  return request('/suppliers', {
    method: 'POST',
    body: JSON.stringify(supplier),
  });
}

export function updateSupplier(id, supplier) {
  return request(`/suppliers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(supplier),
  });
}

export function deleteSupplier(id) {
  return request(`/suppliers/${id}`, {
    method: 'DELETE',
  });
}

export function getCustomers() {
  return request('/customers');
}

export function createCustomer(customer) {
  return request('/customers', {
    method: 'POST',
    body: JSON.stringify(customer),
  });
}

export function updateCustomer(id, customer) {
  return request(`/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(customer),
  });
}

export function deleteCustomer(id) {
  return request(`/customers/${id}`, {
    method: 'DELETE',
  });
}

export function getPurchaseOrders() {
  return request('/purchase-orders');
}

export function createPurchaseOrder(order) {
  return request('/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(order),
  });
}

export function deletePurchaseOrder(id) {
  return request(`/purchase-orders/${id}`, {
    method: 'DELETE',
  });
}

export function getSalesOrders() {
  return request('/sales-orders');
}

export function createSalesOrder(order) {
  return request('/sales-orders', {
    method: 'POST',
    body: JSON.stringify(order),
  });
}

export function deleteSalesOrder(id) {
  return request(`/sales-orders/${id}`, {
    method: 'DELETE',
  });
}

export function getInventoryMovements(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ).toString();
  return request(`/inventory-movements${query ? `?${query}` : ''}`);
}

export function getReportsSummary(range = '30') {
  return request(`/reports/summary?range=${encodeURIComponent(range)}`);
}

export function getTeamMembers() {
  return request('/team-members');
}

export function createTeamMember(member) {
  return request('/team-members', {
    method: 'POST',
    body: JSON.stringify(member),
  });
}

export function updateTeamMember(id, member) {
  return request(`/team-members/${id}`, {
    method: 'PUT',
    body: JSON.stringify(member),
  });
}

export function deleteTeamMember(id) {
  return request(`/team-members/${id}`, {
    method: 'DELETE',
  });
}

export function getSettings() {
  return request('/settings');
}

export function updateSettings(settings) {
  return request('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export function updateProfile(fullName) {
  return request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify({ fullName }),
  });
}

export function updatePassword(currentPassword, newPassword) {
  return request('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function updateSecurityQuestion(currentPassword, securityQuestion, securityAnswer) {
  return request('/auth/security-question', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, securityQuestion, securityAnswer }),
  });
}
