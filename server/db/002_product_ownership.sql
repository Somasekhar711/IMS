-- Give every product an account owner so catalogs are isolated per user.
-- Existing products are left nullable for a safe rollout; new API-created products
-- always receive the authenticated user's id.

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS owner_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS products_owner_user_id_idx ON products (owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS products_owner_hsn_idx ON products (owner_user_id, hsn);
