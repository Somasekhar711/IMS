// Single source of truth for password strength, enforced on the server so the
// rules cannot be bypassed by calling the API directly (the client shows the
// same four rules while the user types).
const RULES = [
  { test: (value) => value.length >= 8, message: 'Password must be at least 8 characters' },
  { test: (value) => /[A-Z]/.test(value), message: 'Password must include a capital letter' },
  { test: (value) => /\d/.test(value), message: 'Password must include a number' },
  { test: (value) => /[^A-Za-z0-9]/.test(value), message: 'Password must include a special character' },
];

// Returns the first rule the password breaks, or null when it is acceptable.
export function passwordProblem(password) {
  if (typeof password !== 'string') return 'Password is required';
  const failed = RULES.find((rule) => !rule.test(password));
  return failed ? failed.message : null;
}
