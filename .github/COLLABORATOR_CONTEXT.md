# StockIt Collaborator Context

This document is the current handoff context for collaborators and Copilot sessions working on StockIt.

## Project

StockIt is an inventory management system planned with the PERN stack:

- PostgreSQL: database
- Express and Node.js: backend API
- React and Vite: frontend

The repository is hosted at https://github.com/Somasekhar711/IMS.

## Current Repository State

The frontend is implemented in `client/`. The `server/` directory is reserved for the backend and currently contains only a placeholder file.

The current frontend is a UI prototype. Authentication and product data are not connected to an API or database yet. Product data is held in React component state and is lost when the page is refreshed.

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
- Summary cards for products, stock, value, low stock, out of stock, purchases, sales, and expiring items
- Warehouse pulse chart
- Recent activity panel
- Summary cards and activity items select their related module

### Products

- Products UI in `client/src/pages/ProductPage.jsx`
- Add-product form with HSN, name, price, category, GST, discount, dates, stock, and threshold fields
- Product search by name, HSN, or category
- Low-stock highlighting based on current stock and threshold
- Delete product interaction

## Important Client Flow

`client/src/main.jsx` currently controls the top-level UI state:

1. The app starts on the login page.
2. Submitting the login form opens the dashboard UI locally.
3. The dashboard navigation can switch to the Products page.
4. Other dashboard modules currently remain dashboard selections/placeholders until their pages are implemented.

This is a local prototype transition only. Do not treat it as real authentication.

## Project Structure

```text
IMS/
├── .github/
│   └── COLLABORATOR_CONTEXT.md
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── ProductPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   └── package.json
├── server/
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
6. Implement the remaining dashboard modules.
