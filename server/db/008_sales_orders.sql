-- Sales orders: a customer sale recorded as line items that remove from product stock.

CREATE TABLE IF NOT EXISTS sales_orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id BIGINT,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference VARCHAR(80),
    notes TEXT,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_orders_customer_owner_fk
        FOREIGN KEY (customer_id, owner_user_id)
        REFERENCES customers (id, owner_user_id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS sales_orders_owner_user_id_idx ON sales_orders (owner_user_id);
CREATE INDEX IF NOT EXISTS sales_orders_customer_id_idx ON sales_orders (customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS sales_orders_id_owner_user_id_idx
    ON sales_orders (id, owner_user_id);

CREATE TABLE IF NOT EXISTS sales_order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sales_order_id BIGINT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL,
    owner_user_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
    line_total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
    CONSTRAINT sales_order_items_product_owner_fk
        FOREIGN KEY (product_id, owner_user_id)
        REFERENCES products (id, owner_user_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sales_order_items_sales_order_id_idx
    ON sales_order_items (sales_order_id);
CREATE INDEX IF NOT EXISTS sales_order_items_product_id_idx
    ON sales_order_items (product_id);
