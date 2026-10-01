# StockIt

StockIt is an inventory management system being built with the PERN stack:

- PostgreSQL for data storage
- Express and Node.js for the API
- React and Vite for the client

For the latest implementation notes and collaborator handoff, see [COLLABORATOR_CONTEXT.md](.github/COLLABORATOR_CONTEXT.md).

## Current Status

The client currently includes the authentication UI:

- Login page
- Registration page
- Password confirmation
- Password requirements for minimum length, uppercase letter, number, and special character
- Responsive StockIt branding

The client also includes the full set of dashboard modules:

- Dashboard summary cards with inventory and sales information, backed by live stock movement data
- Responsive hamburger navigation for inventory modules
- Warehouse pulse chart and recent activity panel, populated from the inventory movements ledger
- Separate Products list and Add Product screens
- Product create, read, update, and delete interactions
- Product search and stock threshold highlighting
- Inventory page with stock summaries, filters, status indicators, and stock adjustments
- User-scoped category management with product listings and safe deletion
- Supplier and customer directories with contact details and (for suppliers) product associations
- Purchase orders: record stock received from suppliers as line items; saving adds straight to inventory
- Sales orders: record stock sold to customers as line items; saving removes it from inventory and is rejected if it would oversell
- Purchase and sales orders can be deleted, which reverses their stock impact
- Stock movements: a read-only, filterable ledger of every purchase, sale, and manual stock adjustment
- Reports: sales/purchases totals, order counts, top-selling products, and stock health for a selected date range
- Users & roles: an account-scoped team roster (name, role, status, contact details) for tracking who does what — a contact list, not a shared login
- Settings: profile editing, password change, and preferences (currency symbol, low-stock alert toggle) that apply across the dashboard
- Product catalogs, suppliers, customers, orders, and the team roster are all isolated per authenticated user

Authentication, products, stock adjustments, categories, suppliers, customers, purchase orders, sales orders, stock movements, reports, the team roster, and account settings are all connected to the Express API and PostgreSQL.

## Project Structure

```text
IMS/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── ProductsListPage.jsx
│   │   │   ├── AddProductPage.jsx
│   │   │   ├── InventoryPage.jsx
│   │   │   ├── CategoriesPage.jsx
│   │   │   ├── SuppliersPage.jsx
│   │   │   ├── CustomersPage.jsx
│   │   │   ├── PurchaseOrdersPage.jsx
│   │   │   ├── SalesOrdersPage.jsx
│   │   │   ├── StockMovementsPage.jsx
│   │   │   ├── ReportsPage.jsx
│   │   │   ├── UsersRolesPage.jsx
│   │   │   └── SettingsPage.jsx
│   │   ├── main.jsx
│   │   ├── api.js
│   │   ├── settingsContext.jsx
│   │   └── styles.css
│   ├── index.html
│   └── package.json
└── server/
	├── routes/
	│   ├── auth.js
	│   ├── products.js
	│   ├── categories.js
	│   ├── suppliers.js
	│   ├── customers.js
	│   ├── purchaseOrders.js
	│   ├── salesOrders.js
	│   ├── inventoryMovements.js
	│   ├── reports.js
	│   ├── teamMembers.js
	│   └── settings.js
	└── db/
		└── 001_initial_schema.sql
```

## Run the Client

From the repository root:

```bash
cd client
npm install
npm run dev
```

The development server runs at `http://localhost:5173/` by default.

To create a production build:

```bash
npm run build
```

## Database Setup

PostgreSQL is used for the StockIt database. Run the numbered migrations in order from [server/db](server/db): initial schema, product ownership, product owner backfill, category ownership, suppliers, customers, purchase orders, sales orders, inventory movements, team roster, user preferences, password reset tokens, email verification tokens, and the OTP auth update.

The migrations build up all the tables the app uses:

- `users`: account details, password hashes, roles, verification status, and preferences (phone, currency symbol, low-stock alert toggle)
- `password_reset_tokens`: short-lived, single-use OTP codes backing the "forgot password" email flow
- `email_verification_tokens`: short-lived, single-use OTP codes backing the "verify your email" flow sent on registration
- `categories`: product categories
- `products`: catalog, pricing, tax, expiry, and stock information
- `suppliers` / `customers`: account-scoped contact directories
- `supplier_products`: account-validated links between suppliers and products
- `purchase_orders` / `purchase_order_items`: stock received from suppliers; posting adds to product stock
- `sales_orders` / `sales_order_items`: stock sold to customers; posting removes from product stock (rejected if it would oversell)
- `inventory_movements`: a ledger every purchase, sale, and manual stock adjustment writes to
- `team_members`: an account-scoped contact roster of roles (not separate login accounts)

Each of these rows belongs to the account that created it, so users cannot see or modify another user's data.

### Create the Database

Create a database named `stockit` using pgAdmin or SQL Shell. Then run the numbered SQL migrations in order while connected to `stockit`.

If the PostgreSQL command-line client is installed, the equivalent commands are:

```bash
createdb -U postgres stockit
psql -U postgres -d stockit -f server/db/001_initial_schema.sql
psql -U postgres -d stockit -f server/db/002_product_ownership.sql
psql -U postgres -d stockit -f server/db/003_backfill_product_owners.sql
psql -U postgres -d stockit -f server/db/004_category_ownership.sql
psql -U postgres -d stockit -f server/db/005_suppliers.sql
psql -U postgres -d stockit -f server/db/006_customers.sql
psql -U postgres -d stockit -f server/db/007_purchase_orders.sql
psql -U postgres -d stockit -f server/db/008_sales_orders.sql
psql -U postgres -d stockit -f server/db/009_inventory_movements.sql
psql -U postgres -d stockit -f server/db/010_team_members.sql
psql -U postgres -d stockit -f server/db/011_user_preferences.sql
psql -U postgres -d stockit -f server/db/012_password_reset.sql
psql -U postgres -d stockit -f server/db/013_email_verification.sql
psql -U postgres -d stockit -f server/db/014_otp_auth.sql
```

Do not store plain-text passwords in `users.password_hash`; the backend will hash passwords before inserting them.

Future schema changes should be added as new numbered migrations (the next one would be `015_...sql`), rather than editing or replacing an already-run migration.

### Account Emails

Both the "forgot password" and "verify your email" flows send a 6-digit OTP code via SMTP (hashed at rest, single-use, and locked out after 5 wrong guesses):

- `POST /api/auth/forgot-password` (body: `email`) emails a reset code, expires in 10 minutes; `POST /api/auth/reset-password` (body: `email`, `otp`, `newPassword`) applies it.
- Registration automatically emails a verification code, expires in 30 minutes. New accounts can sign in right away — the dashboard shows a "Verify your email" banner where the code is entered (`POST /api/auth/verify-email`, authenticated, body: `otp`); `POST /api/auth/resend-verification` (authenticated) sends a new one.

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM` in `server/.env` (see `server/.env.example`). If `SMTP_HOST` is left unset, codes are logged to the server console instead of emailed, which is useful for local development.

## Repository

GitHub: https://github.com/Somasekhar711/IMS