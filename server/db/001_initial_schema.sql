-- StockIt initial schema
-- Scope: authentication and product catalog only.
-- Run this migration once against the StockIt database.

CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'staff'))
);

CREATE TABLE IF NOT EXISTS categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hsn VARCHAR(20) NOT NULL,
    item_name VARCHAR(180) NOT NULL,
    item_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (item_price >= 0),
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (gst_percent >= 0 AND gst_percent <= 100),
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    manufactured_date DATE,
    expiry_date DATE,
    stock_updated_date DATE,
    stock_present INTEGER NOT NULL DEFAULT 0 CHECK (stock_present >= 0),
    threshold_stock INTEGER NOT NULL DEFAULT 0 CHECK (threshold_stock >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT products_expiry_check CHECK (
        expiry_date IS NULL OR manufactured_date IS NULL OR expiry_date >= manufactured_date
    )
);

CREATE INDEX IF NOT EXISTS products_item_name_idx ON products (LOWER(item_name));
CREATE INDEX IF NOT EXISTS products_hsn_idx ON products (hsn);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS products_low_stock_idx ON products (stock_present, threshold_stock);
