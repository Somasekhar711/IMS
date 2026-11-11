import { describe, expect, test } from '@jest/globals';
import { SECURITY_QUESTIONS, normalizeAnswer } from '../../config/securityQuestions.js';

describe('Unit: security answer normalisation', () => {
  test('UT-01 trims surrounding whitespace', () => {
    expect(normalizeAnswer('  Tommy  ')).toBe('tommy');
  });

  test('UT-02 lowercases so answers are not case-sensitive', () => {
    expect(normalizeAnswer('HYDERABAD')).toBe('hyderabad');
  });

  test('UT-03 treats null / undefined as an empty answer', () => {
    expect(normalizeAnswer(null)).toBe('');
    expect(normalizeAnswer(undefined)).toBe('');
  });

  test('UT-04 converts non-string input to a string', () => {
    expect(normalizeAnswer(1999)).toBe('1999');
  });

  test('UT-05 offers a fixed, non-empty, duplicate-free question list', () => {
    expect(SECURITY_QUESTIONS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(SECURITY_QUESTIONS).size).toBe(SECURITY_QUESTIONS.length);
  });
});
