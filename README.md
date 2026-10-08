# StockIt

StockIt is an inventory management system being built with the PERN stack:

- PostgreSQL for data storage
- Express and Node.js for the API
- React and Vite for the client

For the latest implementation notes and collaborator handoff, see [COLLABORATOR_CONTEXT.md](.github/COLLABORATOR_CONTEXT.md).

## Current Status

The client currently includes the authentication UI:

- Login page
- Registration page, with a security question and answer set at sign-up
- Password confirmation
- Password requirements for minimum length, uppercase letter, number, and special character
- Forgot-password recovery via the account's security question (no email required)
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

PostgreSQL is used for the StockIt database. Run the numbered migrations in order from [server/db](server/db): initial schema, product ownership, product owner backfill, category ownership, suppliers, customers, purchase orders, sales orders, inventory movements, team roster, user preferences, three migrations (012–014) that added and then removed (015) an email-based OTP auth flow that is no longer part of the app, and a security-question column pair (016). Migrations 012–015 must still be run in order on a fresh database since each is an append-only step, but `users` ends up with no trace of them afterward.

The migrations build up all the tables the app uses:

- `users`: account details, password hashes, roles, a security question/answer hash for password recovery, and preferences (phone, currency symbol, low-stock alert toggle)
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
psql -U postgres -d stockit -f server/db/015_remove_otp_auth.sql
psql -U postgres -d stockit -f server/db/016_security_question.sql
```

Do not store plain-text passwords in `users.password_hash`; the backend will hash passwords before inserting them.

Future schema changes should be added as new numbered migrations (the next one would be `017_...sql`), rather than editing or replacing an already-run migration.

### Password Recovery

Instead of email, forgotten passwords are recovered with a security question chosen at registration from a fixed list (`GET /api/auth/security-questions`). The answer is normalized (trimmed, lowercased) and stored as a bcrypt hash, never in plain text.

- `POST /api/auth/security-question` (body: `email`) returns the account's question.
- `POST /api/auth/reset-password` (body: `email`, `securityAnswer`, `newPassword`) applies the reset if the answer matches.
- `PUT /api/auth/security-question` (authenticated, body: `currentPassword`, `securityQuestion`, `securityAnswer`) lets a signed-in user change their question/answer from Settings.

## Repository

GitHub: https://github.com/Somasekhar711/IMS