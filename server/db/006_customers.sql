-- Add account-scoped customers for sales orders.

CREATE TABLE IF NOT EXISTS customers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    contact_person VARCHAR(120),
    phone VARCHAR(40),
    email VARCHAR(255),
    address TEXT,
    tax_id VARCHAR(40),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_id_owner_user_id_idx
    ON customers (id, owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS customers_owner_name_idx
    ON customers (owner_user_id, LOWER(name));
CREATE INDEX IF NOT EXISTS customers_owner_user_id_idx
    ON customers (owner_user_id);
