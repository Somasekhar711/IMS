-- Profile and preference fields for the Settings page.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone VARCHAR(40),
    ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(5) NOT NULL DEFAULT '₹',
    ADD COLUMN IF NOT EXISTS low_stock_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE;
