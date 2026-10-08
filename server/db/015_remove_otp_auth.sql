-- Remove OTP-based email verification and password reset support.

DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS password_reset_tokens;

ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at;
