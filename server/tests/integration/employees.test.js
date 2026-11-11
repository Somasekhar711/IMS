import { describe, expect, test, beforeAll } from '@jest/globals';
import { api, registerAdmin, createProduct } from '../helpers/api.js';

describe('API: employee accounts and per-module permissions', () => {
  let admin;
  let member;
  let employeeAuth;

  beforeAll(async () => {
    admin = await registerAdmin();
    await createProduct(admin.auth, { itemName: 'Shared Product' });
  });

  test('IT-69 admin creates an employee login and receives a one-time temporary password', async () => {
    const res = await api().post('/api/team-members').set(admin.auth).send({
      name: 'Kiran', role: 'staff', status: 'active', enableLogin: true, empId: 'EMP001',
      permissions: { products: 'read', inventory: 'write' },
    });
    expect(res.status).toBe(201);
    expect(res.body.tempPassword).toHaveLength(10);
    expect(res.body.mustChangePassword).toBe(true);
    expect(res.body.permissions).toMatchObject({ products: 'read', inventory: 'write', categories: 'none' });
    member = res.body;
  });

  test('IT-70 login access requires an employee ID', async () => {
    const res = await api().post('/api/team-members').set(admin.auth).send({ name: 'No Id', enableLogin: true });
    expect(res.status).toBe(400);
  });

  test('IT-71 a duplicate employee ID is rejected', async () => {
    const res = await api().post('/api/team-members').set(admin.auth).send({ name: 'Clone', enableLogin: true, empId: 'emp001' });
    expect(res.status).toBe(409);
  });

  test('IT-72 the team list never exposes password hashes', async () => {
    const res = await api().get('/api/team-members').set(admin.auth);
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
    expect(res.body[0].hasLogin).toBe(true);
  });

  test('IT-73 employee logs in with warehouse ID + employee ID + temporary password', async () => {
    const res = await api().post('/api/auth/employee-login').send({ warehouseId: admin.warehouseId, empId: 'emp001', password: member.tempPassword });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ actorType: 'employee', fullName: 'Kiran', mustChangePassword: true });
    employeeAuth = { Authorization: `Bearer ${res.body.token}` };
  });

  test('IT-74 employee login fails with a wrong password or wrong warehouse', async () => {
    const wrongPassword = await api().post('/api/auth/employee-login').send({ warehouseId: admin.warehouseId, empId: 'EMP001', password: 'wrong-pass' });
    expect(wrongPassword.status).toBe(401);
    const wrongWarehouse = await api().post('/api/auth/employee-login').send({ warehouseId: 'WH-000000', empId: 'EMP001', password: member.tempPassword });
    expect(wrongWarehouse.status).toBe(401);
  });

  test('IT-75 "read" permission lets the employee view products', async () => {
    const res = await api().get('/api/products').set(employeeAuth);
    expect(res.status).toBe(200);
    expect(res.body[0].itemName).toBe('Shared Product');
  });

  test('IT-76 "read" permission does not allow creating products', async () => {
    const res = await api().post('/api/products').set(employeeAuth).send({ hsn: 'E1', itemName: 'Nope', itemPrice: 1 });
    expect(res.status).toBe(403);
  });

  test('IT-77 "none" permission blocks the module entirely', async () => {
    const res = await api().get('/api/categories').set(employeeAuth);
    expect(res.status).toBe(403);
  });

  test('IT-78 "write" permission on inventory allows stock adjustments', async () => {
    const product = (await api().get('/api/products').set(employeeAuth)).body[0];
    const res = await api().patch(`/api/products/${product.id}/stock`).set(employeeAuth).send({ stockPresent: 99 });
    expect(res.status).toBe(200);
  });

  test('IT-79 employees cannot reach admin-only areas (team, activity log, profile)', async () => {
    expect((await api().get('/api/team-members').set(employeeAuth)).status).toBe(403);
    expect((await api().get('/api/activity-logs').set(employeeAuth)).status).toBe(403);
    expect((await api().put('/api/auth/profile').set(employeeAuth).send({ fullName: 'Hacker' })).status).toBe(403);
  });

  test('IT-80 the activity log records the employee as the actor', async () => {
    // The audit entry is written in the background after the response, so poll briefly for it.
    let entry;
    for (let attempt = 0; attempt < 20 && !entry; attempt += 1) {
      const res = await api().get('/api/activity-logs').set(admin.auth);
      entry = res.body.find((log) => log.module === 'inventory');
      if (!entry) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(entry).toMatchObject({ actorType: 'employee', actorName: 'Kiran (EMP001)', action: 'update' });
  });

  test('IT-81 employee replaces the temporary password and the flag is cleared', async () => {
    const res = await api().put('/api/auth/employee-password').set(employeeAuth).send({ currentPassword: member.tempPassword, newPassword: 'Kiran@12345' });
    expect(res.status).toBe(200);
    const login = await api().post('/api/auth/employee-login').send({ warehouseId: admin.warehouseId, empId: 'EMP001', password: 'Kiran@12345' });
    expect(login.body.mustChangePassword).toBe(false);
  });

  test('IT-82 permission changes by the admin apply immediately to an existing session', async () => {
    await api().put(`/api/team-members/${member.id}`).set(admin.auth).send({
      name: 'Kiran', status: 'active', enableLogin: true, empId: 'EMP001', permissions: { products: 'none' },
    });
    const res = await api().get('/api/products').set(employeeAuth);
    expect(res.status).toBe(403);
  });

  test('IT-83 a disabled employee is locked out, even with a still-valid token', async () => {
    await api().put(`/api/team-members/${member.id}`).set(admin.auth).send({
      name: 'Kiran', status: 'invited', enableLogin: true, empId: 'EMP001', permissions: { products: 'write' },
    });
    expect((await api().get('/api/products').set(employeeAuth)).status).toBe(403);
    const login = await api().post('/api/auth/employee-login').send({ warehouseId: admin.warehouseId, empId: 'EMP001', password: 'Kiran@12345' });
    expect(login.status).toBe(403);
  });

  test('IT-84 an employee of one warehouse cannot log into another warehouse', async () => {
    const other = await registerAdmin();
    const res = await api().post('/api/auth/employee-login').send({ warehouseId: other.warehouseId, empId: 'EMP001', password: 'Kiran@12345' });
    expect(res.status).toBe(401);
  });
});
