import { describe, expect, test } from '@jest/globals';
import { passwordProblem } from '../../config/passwordPolicy.js';

describe('Unit: password policy', () => {
  test('UT-22 accepts a password that meets all four rules', () => {
    expect(passwordProblem('Stock@1234')).toBeNull();
  });

  test('UT-23 boundary: 7 characters is rejected, 8 is accepted', () => {
    expect(passwordProblem('Ab@1234')).toMatch(/at least 8 characters/);
    expect(passwordProblem('Ab@12345')).toBeNull();
  });

  test('UT-24 requires a capital letter', () => {
    expect(passwordProblem('stock@1234')).toMatch(/capital letter/);
  });

  test('UT-25 requires a number', () => {
    expect(passwordProblem('Stock@abcd')).toMatch(/number/);
  });

  test('UT-26 requires a special character', () => {
    expect(passwordProblem('Stock12345')).toMatch(/special character/);
  });

  test('UT-27 rejects values that are not strings', () => {
    expect(passwordProblem(undefined)).toBe('Password is required');
    expect(passwordProblem(12345678)).toBe('Password is required');
  });
});
