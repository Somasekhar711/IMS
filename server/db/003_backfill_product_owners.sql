-- Assign products created before account ownership to the first existing account.
-- Run this after 002_product_ownership.sql.

UPDATE products
SET owner_user_id = (SELECT id FROM users ORDER BY id LIMIT 1)
WHERE owner_user_id IS NULL
  AND EXISTS (SELECT 1 FROM users);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM products WHERE owner_user_id IS NULL) THEN
        ALTER TABLE products ALTER COLUMN owner_user_id SET NOT NULL;
    END IF;
END $$;
