-- Cost price and barcode per product, and the unit cost captured on every
-- sales line so gross profit for a past sale stays correct even after the
-- product's cost price changes later.

ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) CHECK (cost_price >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS products_owner_barcode_idx
    ON products (owner_user_id, barcode)
    WHERE barcode IS NOT NULL;

ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2) CHECK (unit_cost >= 0);

-- Products already received through purchase orders: cost = latest purchase cost.
UPDATE products p
SET cost_price = latest.unit_cost
FROM (
    SELECT DISTINCT ON (poi.product_id) poi.product_id, poi.unit_cost
    FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.purchase_order_id
    ORDER BY poi.product_id, po.order_date DESC, poi.id DESC
) latest
WHERE p.id = latest.product_id
  AND p.cost_price IS NULL;

-- Past sales lines: use the product's cost where one is now known.
UPDATE sales_order_items soi
SET unit_cost = p.cost_price
FROM products p
WHERE p.id = soi.product_id
  AND soi.unit_cost IS NULL
  AND p.cost_price IS NOT NULL;
