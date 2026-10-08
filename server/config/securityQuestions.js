export const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'What was your childhood nickname?',
  'What is your mother\'s maiden name?',
  'What was the name of your first school?',
  'What city were you born in?',
  'What was the make of your first car?',
  'What is your favorite book?',
];

export function normalizeAnswer(answer) {
  return String(answer ?? '').trim().toLowerCase();
}
