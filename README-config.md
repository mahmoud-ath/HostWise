# HostWise — Vacation Rental Intelligence Platform

**Not a PMS. Not a booking platform.** An AI-powered analytics and financial intelligence layer for vacation rental hosts.

---

## Prerequisites

- **Python 3.10+** (3.12 recommended)
- **PostgreSQL 16+** (local or Docker)
- **Bun** (JavaScript runtime) or **Node.js 22+**
- **Docker & Docker Compose** (optional, for containerized setup)

---

## Quick Start — Local Development

### 1. Clone & enter the project

```bash
cd HostWise-PMS
```

### 2. Set up PostgreSQL

If you already have PostgreSQL running locally:

```bash
sudo -u postgres psql -c "CREATE USER hostwise WITH PASSWORD 'hostwise' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE hostwise OWNER hostwise;"
```

Or use Docker just for the database:

```bash
docker compose up -d db
```

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment (edit if your Postgres differs)
cp .env.example .env
# .env is pre-configured for localhost:5432 with user/pass hostwise/hostwise

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend is now live at **http://localhost:8000**
API docs at **http://localhost:8000/api/docs**

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
bun install

# Run the dev server
bun run dev
```

Frontend is now live at **http://localhost:3000**

---

## Quick Start — Docker (All-in-One)

```bash
# Build and start everything
docker compose up -d

# Check status
docker compose ps
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/api/docs |
| Database | localhost:5433 |

---

## First Run — Create Your Account

```bash
# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@hostwise.app","password":"demo123456","full_name":"Demo User"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@hostwise.app","password":"demo123456"}'
```

Or just open http://localhost:3000 and use the UI.

---

## Project Structure

```
HostWise-PMS/
├── backend/                    # FastAPI modular monolith
│   ├── app/
│   │   ├── auth/               # JWT authentication
│   │   ├── organizations/      # Tenant management
│   │   ├── properties/         # Property & listing CRUD
│   │   ├── reservations/       # Booking records
│   │   ├── finance/            # Revenue, expenses, reports
│   │   ├── analytics/          # KPIs, health scores
│   │   ├── ai/                 # Financial advisor engine
│   │   ├── reports/            # Report generation
│   │   ├── connectors/         # CSV & future API connectors
│   │   ├── core/               # Config, DB engine, DI
│   │   └── shared/             # Base classes, exceptions
│   ├── alembic/                # Database migrations
│   └── requirements.txt
├── frontend/                   # Next.js 14 + shadcn/ui
│   └── src/
│       ├── app/                # Page routes
│       ├── components/         # UI, dashboard, layout
│       ├── hooks/              # TanStack Query hooks
│       ├── contexts/           # Auth state
│       └── lib/                # API client, utilities
├── docker/                     # Dockerfiles
├── docker-compose.yml          # 3-service stack
└── docs/ARCHITECTURE.md        # Full architecture docs
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://hostwise:hostwise@localhost:5432/hostwise` | Async DB connection |
| `DATABASE_URL_SYNC` | `postgresql+psycopg2://hostwise:hostwise@localhost:5432/hostwise` | Sync DB (Alembic) |
| `JWT_SECRET_KEY` | *(change in production)* | JWT signing key |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token lifetime |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed frontend origins |

---

## Database Migrations

```bash
cd backend
source .venv/bin/activate

# Generate migration from model changes
alembic revision --autogenerate -m "Describe your change"

# Apply migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1
```

---

## API Overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/auth/register` | Create account |
| `POST /api/v1/auth/login` | Get JWT tokens |
| `GET /api/v1/auth/me` | Current user profile |
| `POST /api/v1/organizations` | Create organization |
| `GET /api/v1/properties/{org_id}` | List properties |
| `POST /api/v1/finance/{org_id}/revenue` | Record revenue |
| `POST /api/v1/finance/{org_id}/expense` | Record expense |
| `GET /api/v1/finance/{org_id}/summary` | Financial dashboard |
| `GET /api/v1/finance/{org_id}/report/monthly` | Monthly report |
| `GET /api/v1/finance/{org_id}/report/annual` | Annual report |
| `GET /api/v1/analytics/{org_id}/property/{id}` | Property analytics |
| `GET /api/v1/analytics/{org_id}/property/{id}/health` | Health score (0-100) |
| `GET /api/v1/ai/{org_id}/analyze` | AI recommendations |

Full interactive docs at http://localhost:8000/api/docs

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic, Alembic |
| Database | PostgreSQL 16 |
| Frontend | Next.js 14, TypeScript, TailwindCSS, shadcn/ui |
| Charts | Recharts |
| State | TanStack Query (React Query) |
| Auth | JWT (python-jose + bcrypt) |
| Runtime | Bun (frontend), Python 3.10+ (backend) |
| Infra | Docker Compose (optional) |

---

## License

Private — HostWise Platform
