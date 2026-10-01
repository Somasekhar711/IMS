-- Add account-scoped suppliers and many-to-many product associations.

CREATE TABLE IF NOT EXISTS suppliers (
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

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_id_owner_user_id_idx
    ON suppliers (id, owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_owner_name_idx
    ON suppliers (owner_user_id, LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS products_id_owner_user_id_idx
    ON products (id, owner_user_id);

CREATE TABLE IF NOT EXISTS supplier_products (
    supplier_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    owner_user_id BIGINT NOT NULL,
    PRIMARY KEY (supplier_id, product_id),
    CONSTRAINT supplier_products_supplier_owner_fk
        FOREIGN KEY (supplier_id, owner_user_id)
        REFERENCES suppliers (id, owner_user_id)
        ON DELETE CASCADE,
    CONSTRAINT supplier_products_product_owner_fk
        FOREIGN KEY (product_id, owner_user_id)
        REFERENCES products (id, owner_user_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS supplier_products_product_id_idx
    ON supplier_products (product_id);
