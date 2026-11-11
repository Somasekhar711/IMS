// Small helpers shared by the API (integration) tests.
import request from 'supertest';
import app from '../../app.js';

export const api = () => request(app);

export const STRONG_PASSWORD = 'Stock@1234';
export const SECURITY_QUESTION = 'What city were you born in?';
export const SECURITY_ANSWER = 'Hyderabad';

let counter = 0;
export function uniqueEmail(prefix = 'user') {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@stockit.test`;
}

// Registers a brand-new admin account and returns its details plus a ready auth header.
export async function registerAdmin(overrides = {}) {
  const body = {
    fullName: 'Test Admin',
    email: uniqueEmail(),
    password: STRONG_PASSWORD,
    securityQuestion: SECURITY_QUESTION,
    securityAnswer: SECURITY_ANSWER,
    ...overrides,
  };
  const res = await api().post('/api/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { ...res.body, password: body.password, auth: { Authorization: `Bearer ${res.body.token}` } };
}

export async function createProduct(auth, overrides = {}) {
  counter += 1;
  const res = await api().post('/api/products').set(auth).send({
    hsn: `H${Date.now() % 100000}${counter}`,
    itemName: `Product ${counter}`,
    itemPrice: 100,
    stockPresent: 10,
    thresholdStock: 2,
    ...overrides,
  });
  if (res.status !== 201) throw new Error(`createProduct failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export async function getProduct(auth, id) {
  const res = await api().get('/api/products').set(auth);
  return res.body.find((product) => String(product.id) === String(id));
}
