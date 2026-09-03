# StockIt Collaborator Context

This document is the current handoff context for collaborators and Copilot sessions working on StockIt.

## Project

StockIt is an inventory management system planned with the PERN stack:

- PostgreSQL: database
- Express and Node.js: backend API
- React and Vite: frontend

The repository is hosted at https://github.com/Somasekhar711/IMS.

## Current Repository State

The frontend is implemented in `client/`. The `server/` directory contains the Express backend and numbered database migrations.

The initial database migration is available at `server/db/001_initial_schema.sql`. Product ownership is added by `002_product_ownership.sql`, and pre-existing products are assigned by `003_backfill_product_owners.sql`.

Authentication, product data, and stock updates are connected to the Express API and PostgreSQL. Product data is scoped to the authenticated account and persists across page refreshes.

## Implemented Features

### Authentication

- Login UI in `client/src/pages/LoginPage.jsx`
- Registration UI in `client/src/pages/RegisterPage.jsx`
- Login and registration mode switching
- Password visibility controls
- Registration password requirements:
  - At least 8 characters
  - One uppercase letter
  - One number
  - One special character
- Confirm-password matching feedback

### Dashboard

- Dashboard UI in `client/src/pages/DashboardPage.jsx`
- Responsive sidebar navigation on desktop
- Hamburger navigation drawer on mobile
- Summary cards for products, stock, value, low stock, out of stock, and expiring items
- Dashboard-supported summary cards derive product and stock metrics from the API
- Warehouse pulse empty state until movement history exists
- Recent activity empty state until movement and purchase APIs exist
- Summary cards and activity items select their related module

### Products

- Products list UI in `client/src/pages/ProductsListPage.jsx`
- Add-product UI in `client/src/pages/AddProductPage.jsx`
- Shared product field definitions in `client/src/pages/productFields.js`
- Add-product form with HSN, name, price, category, GST, discount, dates, stock, and threshold fields
- Product search by name, HSN, or category
- Low-stock highlighting based on current stock and threshold
- Edit and delete product interactions
- Dashboard state mirrors product data loaded from the authenticated API while switching between the list and add screens
- Product reads and writes are scoped to `products.owner_user_id`, so separate accounts have separate catalogs

### Inventory

- Inventory UI in `client/src/pages/InventoryPage.jsx`
- Stock summary counts for total, healthy, low, and out-of-stock items
- Search and status filters
- Stock status indicators based on `stock_present` and `threshold_stock`
- Add-stock and remove-stock adjustment modal
- Stock adjustments update PostgreSQL through the authenticated API and refresh `stock_updated_date`
- Stock movement history is not persisted yet; it will require the planned `inventory_movements` table

## Important Client Flow

`client/src/main.jsx` currently controls the top-level UI state:

1. The app starts on the login page.
2. Submitting the login form authenticates against the API and opens the dashboard.
3. The dashboard navigation can switch to the Products list or Add Product screen.
4. Product CRUD and inventory updates are persisted through the authenticated API and PostgreSQL.
5. Dashboard identity comes from the authenticated user response; no default user is used.
6. Other dashboard modules currently remain dashboard selections/placeholders until their pages are implemented.

The login and registration flow uses JWT authentication. Purchase, sales, and movement history modules remain pending.

## Project Structure

```text
IMS/
├── .github/
│   └── COLLABORATOR_CONTEXT.md
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── AddProductPage.jsx
│   │   │   ├── InventoryPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── ProductsListPage.jsx
│   │   │   ├── productFields.js
│   │   │   └── RegisterPage.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   └── package.json
├── server/
│   └── db/
│       ├── 001_initial_schema.sql
│       ├── 002_product_ownership.sql
│       └── 003_backfill_product_owners.sql
└── README.md
```

## Local Development

Run the client from the `client` directory:

```bash
cd client
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

The default development URL is `http://localhost:5173/`.

## Working Conventions

- Keep each major page in its own file under `client/src/pages/`.
- Preserve the existing StockIt visual language in `client/src/styles.css`.
- Use `lucide-react` for interface icons; it is already installed in the client.
- Keep frontend-only behavior explicit until the server API is implemented.
- Do not commit `client/node_modules/` or `client/dist/`; they are ignored by `.gitignore`.
- Run `npm run build` from `client/` after frontend changes.
- Pull the latest `main` before starting collaborative work and push completed changes with a descriptive commit.

## Suggested Next Steps

1. Initialize the Express server in `server/`.
2. Add PostgreSQL connection and environment configuration.
3. Create authentication endpoints and persist users securely.
4. Connect login and registration forms to the API.
5. Add product endpoints and replace ProductPage local state with API data.
6. Add new numbered migrations for inventory movements, suppliers, purchases, and sales as those modules are implemented.
7. Implement the remaining dashboard modules.
