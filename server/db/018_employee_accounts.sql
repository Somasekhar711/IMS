-- Let a team_members row optionally become a real login-capable employee account,
-- with an emp_id + password, forced password change, and per-module permissions.
-- Nullable: existing rows stay pure contacts until an admin opts them into login.

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS emp_id VARCHAR(40);
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS team_members_owner_emp_id_idx
    ON team_members (owner_user_id, UPPER(emp_id))
    WHERE emp_id IS NOT NULL;
