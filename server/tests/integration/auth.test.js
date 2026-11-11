import { describe, expect, test, beforeAll } from '@jest/globals';
import { api, registerAdmin, uniqueEmail, STRONG_PASSWORD, SECURITY_QUESTION, SECURITY_ANSWER } from '../helpers/api.js';

const validBody = () => ({
  fullName: 'Asha Rao',
  email: uniqueEmail('asha'),
  password: STRONG_PASSWORD,
  securityQuestion: SECURITY_QUESTION,
  securityAnswer: SECURITY_ANSWER,
});

describe('API: server basics', () => {
  test('IT-01 health check responds with status ok', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('IT-02 unknown route returns a JSON 404', async () => {
    const res = await api().get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Not found');
  });

  test('IT-03 malformed JSON body returns a clean 400 (no stack trace)', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
    expect(res.text).not.toMatch(/node_modules|at\s+\w+\s+\(/);
  });
});

describe('API: registration', () => {
  test('IT-04 registers a new admin and returns a token + warehouse ID', async () => {
    const body = validBody();
    const res = await api().post('/api/auth/register').send(body);
    expect(res.status).toBe(201);
    expect(res.body.email).toBe(body.email);
    expect(res.body.role).toBe('admin');
    expect(res.body.warehouseId).toMatch(/^WH-[0-9A-F]{6}$/);
    expect(res.body.token).toEqual(expect.any(String));
  });

  test('IT-05 never returns the password or its hash', async () => {
    const res = await api().post('/api/auth/register').send(validBody());
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
  });

  test.each([
    ['fullName'], ['email'], ['password'], ['securityQuestion'], ['securityAnswer'],
  ])('IT-06 rejects registration when %s is missing', async (field) => {
    const body = validBody();
    delete body[field];
    const res = await api().post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
  });

  test('IT-07 rejects a password shorter than 8 characters (boundary: 7)', async () => {
    const res = await api().post('/api/auth/register').send({ ...validBody(), password: 'Ab@1234' });
    expect(res.status).toBe(400);
  });

  test('IT-08 accepts a password of exactly 8 characters (boundary: 8)', async () => {
    const res = await api().post('/api/auth/register').send({ ...validBody(), password: 'Ab@12345' });
    expect(res.status).toBe(201);
  });

  test.each([
    ['no capital letter', 'stock@1234'],
    ['no number', 'Stock@abcd'],
    ['no special character', 'Stock12345'],
  ])('IT-09 rejects a weak password on the server too (%s)', async (_label, password) => {
    const res = await api().post('/api/auth/register').send({ ...validBody(), password });
    expect(res.status).toBe(400);
  });

  test('IT-10 rejects a security question that is not on the list', async () => {
    const res = await api().post('/api/auth/register').send({ ...validBody(), securityQuestion: 'Favourite colour?' });
    expect(res.status).toBe(400);
  });

  test('IT-11 rejects a duplicate email with 409', async () => {
    const body = validBody();
    await api().post('/api/auth/register').send(body);
    const res = await api().post('/api/auth/register').send(body);
    expect(res.status).toBe(409);
  });

  test('IT-12 treats emails as case-insensitive when checking duplicates', async () => {
    const body = validBody();
    await api().post('/api/auth/register').send(body);
    const res = await api().post('/api/auth/register').send({ ...body, email: body.email.toUpperCase() });
    expect(res.status).toBe(409);
  });
});

describe('API: login', () => {
  let admin;
  beforeAll(async () => { admin = await registerAdmin(); });

  test('IT-13 logs in with correct credentials', async () => {
    const res = await api().post('/api/auth/login').send({ email: admin.email, password: admin.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.warehouseId).toBe(admin.warehouseId);
  });

  test('IT-14 login works regardless of email letter case', async () => {
    const res = await api().post('/api/auth/login').send({ email: admin.email.toUpperCase(), password: admin.password });
    expect(res.status).toBe(200);
  });

  test('IT-15 rejects a wrong password with 401', async () => {
    const res = await api().post('/api/auth/login').send({ email: admin.email, password: 'Wrong@1234' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  test('IT-16 rejects an unknown email with the same message (no account enumeration)', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'nobody@stockit.test', password: 'Wrong@1234' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  test('IT-17 rejects a login with missing fields', async () => {
    const res = await api().post('/api/auth/login').send({ email: admin.email });
    expect(res.status).toBe(400);
  });

  test('IT-18 SQL-injection style input does not bypass login', async () => {
    const res = await api().post('/api/auth/login').send({ email: "' OR '1'='1", password: "' OR '1'='1" });
    expect(res.status).toBe(401);
  });
});

describe('API: protected routes', () => {
  test('IT-19 rejects a request with no token', async () => {
    const res = await api().get('/api/products');
    expect(res.status).toBe(401);
  });

  test('IT-20 rejects a tampered token', async () => {
    const res = await api().get('/api/products').set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});

describe('API: password recovery by security question', () => {
  let admin;
  beforeAll(async () => { admin = await registerAdmin(); });

  test('IT-21 returns the account security question for a known email', async () => {
    const res = await api().post('/api/auth/security-question').send({ email: admin.email });
    expect(res.status).toBe(200);
    expect(res.body.securityQuestion).toBe(SECURITY_QUESTION);
  });

  test('IT-22 returns 404 for an unknown email', async () => {
    const res = await api().post('/api/auth/security-question').send({ email: 'ghost@stockit.test' });
    expect(res.status).toBe(404);
  });

  test('IT-23 rejects a reset with the wrong answer', async () => {
    const res = await api().post('/api/auth/reset-password').send({ email: admin.email, securityAnswer: 'Chennai', newPassword: 'NewPass@123' });
    expect(res.status).toBe(400);
  });

  test('IT-24 resets the password when the answer matches (case-insensitive) and the old password stops working', async () => {
    const reset = await api().post('/api/auth/reset-password').send({ email: admin.email, securityAnswer: '  HYDERABAD ', newPassword: 'NewPass@123' });
    expect(reset.status).toBe(200);

    const oldLogin = await api().post('/api/auth/login').send({ email: admin.email, password: admin.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await api().post('/api/auth/login').send({ email: admin.email, password: 'NewPass@123' });
    expect(newLogin.status).toBe(200);
  });
});

describe('API: account settings', () => {
  let admin;
  beforeAll(async () => { admin = await registerAdmin(); });

  test('IT-25 updates the profile name', async () => {
    const res = await api().put('/api/auth/profile').set(admin.auth).send({ fullName: '  Asha R.  ' });
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Asha R.');
  });

  test('IT-26 refuses a password change when the current password is wrong', async () => {
    const res = await api().put('/api/auth/password').set(admin.auth).send({ currentPassword: 'Nope@1234', newPassword: 'Another@123' });
    expect(res.status).toBe(401);
  });

  test('IT-27 saves preferences and falls back to the default currency symbol', async () => {
    const saved = await api().put('/api/settings').set(admin.auth).send({ phone: '9876543210', currencySymbol: '$', lowStockAlertEnabled: false });
    expect(saved.body).toEqual({ phone: '9876543210', currencySymbol: '$', lowStockAlertEnabled: false });

    const blank = await api().put('/api/settings').set(admin.auth).send({ currencySymbol: '   ' });
    expect(blank.body.currencySymbol).toBe('₹');
  });
});
