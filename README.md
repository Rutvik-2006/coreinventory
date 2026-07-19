# CoreInventory 🏭

A production-grade Inventory Management System built for the hackathon.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + CSS Modules |
| Backend | Node.js + Express.js |
| Database | PostgreSQL (primary) / MySQL (alternative) |
| Auth | JWT + bcrypt |
| Validation | Zod (backend) + custom hooks (frontend) |

## Prerequisites

- Node.js >= 18
- PostgreSQL >= 14 (or MySQL >= 8)
- npm >= 9

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/your-org/coreinventory.git
cd coreinventory

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Database Setup

```bash
# PostgreSQL
createdb coreinventory
cd backend
psql -U postgres -d coreinventory -f src/config/schema.sql
psql -U postgres -d coreinventory -f src/config/seed.sql
```

### 3. Environment Variables

```bash
# backend/.env
cp backend/.env.example backend/.env
# Fill in your DB credentials and JWT secret
```

### 4. Run

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Frontend: http://localhost:5173  
Backend API: http://localhost:4000

## Project Structure

```
coreinventory/
├── backend/
│   ├── src/
│   │   ├── config/         # DB connection, schema, seed
│   │   ├── controllers/    # Business logic
│   │   ├── middleware/     # Auth, error, validation
│   │   ├── models/         # DB query functions
│   │   ├── routes/         # Express routers
│   │   ├── validators/     # Zod schemas
│   │   └── utils/          # Helpers
│   └── server.js
├── frontend/
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── pages/          # Route-level pages
│       ├── hooks/          # Custom React hooks
│       └── utils/          # API client, helpers
└── README.md
```

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Products
- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/products/:id/stock`

### Receipts
- `GET /api/receipts`
- `POST /api/receipts`
- `POST /api/receipts/:id/validate`
- `POST /api/receipts/:id/cancel`

### Deliveries
- `GET /api/deliveries`
- `POST /api/deliveries`
- `POST /api/deliveries/:id/validate`

### Warehouses
- `GET /api/warehouses`
- `POST /api/warehouses`
- `GET /api/warehouses/:id/locations`

### Stock
- `GET /api/stock`
- `POST /api/stock/adjust`
- `GET /api/stock/moves`

### Dashboard
- `GET /api/dashboard/kpis`

## Database Design Highlights

- **stock_moves** table acts as a double-entry ledger (every movement traced)
- **locations** support multi-warehouse hierarchies
- **Soft deletes** on products (is_deleted flag)
- Proper **foreign keys**, **indexes**, and **constraints**
- Trigger-based stock recalculation for consistency

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT tokens with 24h expiry
- Rate limiting on auth routes
- Parameterized queries (no SQL injection)
- Helmet.js for HTTP security headers
- CORS configured per environment
