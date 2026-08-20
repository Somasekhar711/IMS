# StockIt

StockIt is an inventory management system being built with the PERN stack:

- PostgreSQL for data storage
- Express and Node.js for the API
- React and Vite for the client

## Current Status

The client currently includes the authentication UI:

- Login page
- Registration page
- Password confirmation
- Password requirements for minimum length, uppercase letter, number, and special character
- Responsive StockIt branding

Authentication is currently UI-only. The Express API and PostgreSQL integration will be added next.

## Project Structure

```text
IMS/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   └── package.json
└── server/
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

## Repository

GitHub: https://github.com/Somasekhar711/IMS