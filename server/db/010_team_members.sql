-- A contact roster of people and roles for the account. These are not separate
-- login accounts; they do not grant shared access to the owner's data.

CREATE TABLE IF NOT EXISTS team_members (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(40),
    role VARCHAR(30) NOT NULL DEFAULT 'staff',
    status VARCHAR(20) NOT NULL DEFAULT 'invited',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT team_members_role_check CHECK (role IN ('admin', 'manager', 'staff')),
    CONSTRAINT team_members_status_check CHECK (status IN ('invited', 'active'))
);

CREATE INDEX IF NOT EXISTS team_members_owner_user_id_idx ON team_members (owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS team_members_owner_email_idx
    ON team_members (owner_user_id, LOWER(email))
    WHERE email IS NOT NULL;
