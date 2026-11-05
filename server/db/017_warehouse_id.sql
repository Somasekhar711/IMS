-- Give every admin account a warehouse_id employees use (alongside their emp_id)
-- to log into that account's workspace.

ALTER TABLE users ADD COLUMN IF NOT EXISTS warehouse_id VARCHAR(20) UNIQUE;

UPDATE users
SET warehouse_id = 'WH-' || UPPER(SUBSTRING(MD5(random()::text || id::text), 1, 6))
WHERE warehouse_id IS NULL;

ALTER TABLE users ALTER COLUMN warehouse_id SET NOT NULL;
