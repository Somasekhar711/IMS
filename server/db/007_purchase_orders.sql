-- Purchase orders: a supplier delivery recorded as line items that add to product stock.

CREATE TABLE IF NOT EXISTS purchase_orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supplier_id BIGINT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference VARCHAR(80),
    notes TEXT,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT purchase_orders_supplier_owner_fk
        FOREIGN KEY (supplier_id, owner_user_id)
        REFERENCES suppliers (id, owner_user_id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS purchase_orders_owner_user_id_idx ON purchase_orders (owner_user_id);
CREATE INDEX IF NOT EXISTS purchase_orders_supplier_id_idx ON purchase_orders (supplier_id);
CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_id_owner_user_id_idx
    ON purchase_orders (id, owner_user_id);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL,
    owner_user_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    line_total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
    CONSTRAINT purchase_order_items_product_owner_fk
        FOREIGN KEY (product_id, owner_user_id)
        REFERENCES products (id, owner_user_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS purchase_order_items_purchase_order_id_idx
    ON purchase_order_items (purchase_order_id);
CREATE INDEX IF NOT EXISTS purchase_order_items_product_id_idx
    ON purchase_order_items (product_id);
