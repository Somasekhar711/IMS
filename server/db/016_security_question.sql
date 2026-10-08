-- Support "forgot password" via a security question instead of email OTP.
-- Nullable so the migration is safe to run against existing rows; new registrations
-- are required (at the application layer) to set both fields.

ALTER TABLE users ADD COLUMN IF NOT EXISTS security_question TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS security_answer_hash TEXT;
