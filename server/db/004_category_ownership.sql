-- Make categories belong to the authenticated account so each user sees only their own taxonomy.
-- Existing categories are assigned to the first user to keep the migration safe.

ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS owner_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;

UPDATE categories
SET owner_user_id = (
    SELECT id
    FROM users
    ORDER BY id
    LIMIT 1
)
WHERE owner_user_id IS NULL
  AND EXISTS (SELECT 1 FROM users);

ALTER TABLE categories
    DROP CONSTRAINT IF EXISTS categories_name_key;

CREATE INDEX IF NOT EXISTS categories_owner_user_id_idx ON categories (owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS categories_owner_name_idx ON categories (owner_user_id, LOWER(name));

ALTER TABLE categories
    ALTER COLUMN owner_user_id SET NOT NULL;
