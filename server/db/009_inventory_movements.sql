-- A single ledger every stock-affecting action writes to: purchases, sales, and
-- manual adjustments made from the Inventory page.

CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL,
    movement_type VARCHAR(20) NOT NULL,
    quantity_change INTEGER NOT NULL,
    reference_type VARCHAR(20),
    reference_id BIGINT,
    note TEXT,
    stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT inventory_movements_type_check
        CHECK (movement_type IN ('purchase', 'sale', 'adjustment')),
    CONSTRAINT inventory_movements_product_owner_fk
        FOREIGN KEY (product_id, owner_user_id)
        REFERENCES products (id, owner_user_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS inventory_movements_owner_created_idx
    ON inventory_movements (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_movements_product_id_idx
    ON inventory_movements (product_id);
CREATE INDEX IF NOT EXISTS inventory_movements_reference_idx
    ON inventory_movements (reference_type, reference_id);
