import { describe, expect, jest, test } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { authRequired } from '../../middleware/auth.js';
import { requireAdmin, requirePermission } from '../../middleware/permissions.js';

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('Unit: authRequired middleware', () => {
  test('UT-14 rejects a request with no Authorization header', () => {
    const res = mockRes();
    const next = jest.fn();
    authRequired({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('UT-15 rejects a header that is not a Bearer token', () => {
    const res = mockRes();
    const next = jest.fn();
    authRequired({ headers: { authorization: 'Basic abc123' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('UT-16 rejects a token signed with the wrong secret', () => {
    const token = jwt.sign({ id: 1 }, 'some-other-secret');
    const res = mockRes();
    const next = jest.fn();
    authRequired({ headers: { authorization: `Bearer ${token}` } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('UT-17 rejects an expired token', () => {
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = mockRes();
    const next = jest.fn();
    authRequired({ headers: { authorization: `Bearer ${token}` } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
  });

  test('UT-18 accepts a valid token and attaches the decoded user', () => {
    const token = jwt.sign({ id: 42, actorType: 'admin' }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();
    authRequired(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 42, actorType: 'admin' });
  });
});

describe('Unit: role middleware', () => {
  test('UT-19 requireAdmin lets an admin through', () => {
    const next = jest.fn();
    requireAdmin({ user: { actorType: 'admin' } }, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('UT-20 requireAdmin blocks an employee with 403', () => {
    const res = mockRes();
    const next = jest.fn();
    requireAdmin({ user: { actorType: 'employee' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('UT-21 requirePermission never restricts the admin (no database lookup)', async () => {
    const next = jest.fn();
    await requirePermission('products', 'write')({ user: { actorType: 'admin' } }, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
