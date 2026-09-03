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

The client also includes the first dashboard modules:

- Dashboard summary cards with inventory and sales information
- Responsive hamburger navigation for inventory modules
- Warehouse pulse chart and recent activity panel
- Separate Products list and Add Product screens
- Product create, read, update, and delete interactions
- Product search and stock threshold highlighting

Authentication and product data are currently UI-only and stored in client state. The Express API and PostgreSQL integration will be added next.

## Project Structure

```text
IMS/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   └── ProductPage.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   └── package.json
└── server/
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

PostgreSQL is used for the StockIt database. The first migration is in [server/db/001_initial_schema.sql](server/db/001_initial_schema.sql).

The initial schema contains only the tables needed for the current features:

- `users`: account details, password hashes, and roles
- `categories`: product categories
- `products`: catalog, pricing, tax, expiry, and stock information

### Create the Database

Create a database named `stockit` using pgAdmin or SQL Shell. Then open `server/db/001_initial_schema.sql` in pgAdmin's Query Tool and execute it while connected to `stockit`.

If the PostgreSQL command-line client is installed, the equivalent commands are:

```bash
createdb -U postgres stockit
psql -U postgres -d stockit -f server/db/001_initial_schema.sql
```

Do not store plain-text passwords in `users.password_hash`; the backend will hash passwords before inserting them.

Future schema changes should be added as new numbered migrations, such as `002_inventory_movements.sql`, rather than editing or replacing an already-run migration.

## Repository

GitHub: https://github.com/Somasekhar711/IMS