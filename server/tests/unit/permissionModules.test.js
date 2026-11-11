import { describe, expect, test } from '@jest/globals';
import { PERMISSION_MODULES, generateTempPassword, normalizePermissions } from '../../config/permissionModules.js';

describe('Unit: employee permission normalisation', () => {
  test('UT-06 keeps valid levels', () => {
    const result = normalizePermissions({ products: 'read', inventory: 'write' });
    expect(result.products).toBe('read');
    expect(result.inventory).toBe('write');
  });

  test('UT-07 defaults every missing module to "none" (least privilege)', () => {
    const result = normalizePermissions({});
    expect(Object.keys(result).sort()).toEqual([...PERMISSION_MODULES].sort());
    expect(Object.values(result).every((level) => level === 'none')).toBe(true);
  });

  test('UT-08 rejects unknown levels such as "admin"', () => {
    expect(normalizePermissions({ products: 'admin' }).products).toBe('none');
  });

  test('UT-09 drops modules that do not exist', () => {
    expect(normalizePermissions({ payroll: 'write' })).not.toHaveProperty('payroll');
  });

  test('UT-10 copes with null / undefined input', () => {
    expect(normalizePermissions(null).products).toBe('none');
    expect(normalizePermissions(undefined).reports).toBe('none');
  });
});

describe('Unit: temporary password generator', () => {
  test('UT-11 produces a 10-character password', () => {
    expect(generateTempPassword()).toHaveLength(10);
  });

  test('UT-12 avoids look-alike characters (0, O, 1, l, I)', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateTempPassword()).toMatch(/^[A-HJ-NP-Za-km-z2-9]{10}$/);
    }
  });

  test('UT-13 does not repeat across 500 generations', () => {
    const seen = new Set();
    for (let i = 0; i < 500; i += 1) seen.add(generateTempPassword());
    expect(seen.size).toBe(500);
  });
});
