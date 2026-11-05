import crypto from 'crypto';

export const PERMISSION_MODULES = [
  'products',
  'inventory',
  'categories',
  'suppliers',
  'customers',
  'purchaseOrders',
  'salesOrders',
  'stockMovements',
  'reports',
];

const LEVELS = ['none', 'read', 'write'];

export function normalizePermissions(input) {
  const normalized = {};
  for (const moduleKey of PERMISSION_MODULES) {
    const level = input?.[moduleKey];
    normalized[moduleKey] = LEVELS.includes(level) ? level : 'none';
  }
  return normalized;
}

export function generateTempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 10; i += 1) {
    password += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return password;
}
