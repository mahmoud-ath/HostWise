# HostWise — Vacation Rental Intelligence Platform

> Turn your booking data into a CFO-grade financial intelligence system.

---

## 📖 Overview

**HostWise** is an AI-powered analytics and financial intelligence layer for vacation rental hosts. It sits above your existing data sources — Airbnb, Booking.com, CSV exports — and transforms raw booking data into strategic insights, automated reports, and actionable recommendations.

**What HostWise is NOT:** It's not a PMS. It doesn't manage bookings, process payments, or handle guest communication. It's the brain, not the hands.

### Who It's For
- Individual vacation rental hosts managing 3–50 properties
- Property managers who need portfolio-level financial visibility
- Hosts who want to understand *why* their revenue is changing, not just *that* it changed

---

## 🎯 The Problem

Vacation rental hosts are drowning in data but starving for insight.

- Airbnb and Booking.com give you raw booking data but **no financial analysis**
- Spreadsheets become unmanageable beyond 3 properties
- PMS tools focus on operations, not financial intelligence
- Hosts can't answer basic questions like *"Which property has the best profit margin?"* or *"Why did my net revenue drop 15% this month?"*
- Tax preparation and financial reporting is entirely manual

**Current solutions** force hosts to be part-time accountants, Excel wizards, and data analysts — roles they never signed up for.

---

## 💡 The Solution

HostWise ingests your booking data (CSV imports today, direct API connectors tomorrow), normalizes it, and computes every financial KPI that matters:

- Revenue, expenses, and cashflow per property and across your portfolio
- Occupancy rates, ADR, RevPAR, cancellation rates
- AI-powered recommendations that explain *why* and tell you *what to do*
- Automated monthly and annual financial reports

---

## 📈 System Impact

| Metric | Before HostWise | After HostWise |
|---|---|---|
| Financial report generation | 4–8 hours manually | Instant |
| Identifying underperformers | Guesswork | Data-driven ranking |
| Profit margin visibility | None | Per-property breakdowns |
| Tax preparation | Scattered spreadsheets | Single export |
| Revenue trend analysis | Manual charting | Built-in dashboards |

---

## 🚀 Core Features

- **Financial Dashboard** — Gross revenue, net revenue, expenses, cashflow, and profit margin across your entire portfolio
- **Property Portfolio** — Manage properties, their details, and multiple platform listings
- **Revenue & Expense Tracking** — Categorized income and expenses per property, with CSV import
- **Monthly & Annual Reports** — Auto-generated financial summaries with KPI breakdowns
- **Portfolio Analytics** — Occupancy rates, ADR, RevPAR, booking windows, cancellation rates, seasonality
- **Property Health Score (0–100)** — At-a-glance performance indicator for each property
- **AI Financial Advisor** — Rule-based engine that detects problems and recommends actions

---

## ✨ Elite Features ⭐

### AI Financial Advisor
Not just dashboards — **actionable intelligence**. The AI engine analyzes your data and generates recommendations with:

```
Type: Warning
Cause: "Villa Azur net revenue decreased 22% vs last month"
Business Impact: "Estimated $1,240 monthly loss at current trajectory"
Suggested Action: "Increase minimum stay to 3 nights and adjust pricing +8% on weekends"
Confidence: 0.85
```

### Auto-Calculated KPIs
Revenue, expenses, cashflow, margins — all computed in real-time, never stored redundantly. Every number is traceable to its source.

### Domain-Driven Modular Monolith
Self-contained business domains (properties, finance, analytics, AI) with clear boundaries — simple enough for one dev, structured enough for a team.

### Zero-Config Onboarding
Register → you get an organization auto-created → start adding properties. No setup wizard needed.

### CSV Connector Architecture
The CSV importer implements `ConnectorInterface` — the same interface future Airbnb API, Booking.com, and Vrbo connectors will use. Built for evolution.

---

## 🛠 Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14, TypeScript, TailwindCSS, shadcn/ui, Recharts |
| **Backend** | FastAPI (Python), SQLAlchemy 2.0, Pydantic v2, Alembic |
| **Database** | PostgreSQL 16 |
| **State Management** | TanStack Query (React Query), React Context |
| **Auth** | JWT (python-jose + bcrypt), refresh token rotation |
| **AI Engine** | Rule-based analysis (LLM-ready interface) |
| **Infra** | Docker Compose (3 services: db, backend, frontend) |

---

## ⚙️ Architecture

```
┌──────────────────────────────────────────────────┐
│                  Next.js Frontend                 │
│          Dashboard · Finance · Analytics          │
│          Properties · Reports · AI Advisor        │
└──────────────────────┬───────────────────────────┘
                       │ HTTP REST + JWT
                       ▼
┌──────────────────────────────────────────────────┐
│                FastAPI Backend                    │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │   Auth   │ │Properties│ │     Finance      │ │
│  │  JWT     │ │ Listings │ │ Revenue/Expense  │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Analytics│ │    AI    │ │    Connectors    │ │
│  │ KPIs     │ │ Advisor  │ │ CSV → API future │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
│  ┌──────────────────────────────────────────────┐│
│  │         Organizations (Tenant Boundary)       ││
│  └──────────────────────────────────────────────┘│
└──────────────────────┬───────────────────────────┘
                       │ SQLAlchemy 2.0 (async)
                       ▼
┌──────────────────────────────────────────────────┐
│               PostgreSQL 16                      │
│    users · organizations · properties            │
│    reservations · revenues · expenses            │
│    listings · categories                         │
└──────────────────────────────────────────────────┘
```

### Data Flow

```
User uploads CSV  →  Connector normalizes  →  Database
                                                 ↓
User opens Dashboard  →  Query-computed KPIs  →  Recharts visualization
                                                 ↓
AI Engine analyzes  →  Rule-based detection  →  Actionable recommendations
```

---

## 🧠 Development Journey

### Biggest Challenges

**1. Financial calculation accuracy**
Revenue and expense tracking for vacation rentals is more complex than it seems — partial refunds, platform commissions, cleaning fees, taxes. Built a normalized `Revenue` model with `gross_amount`, `commission_amount`, and auto-calculated `net_amount` to ensure every number is correct.

**2. Making AI useful, not gimmicky**
Instead of jumping straight to LLM integration (expensive, unpredictable), built a rule-based engine with structured output (`cause`, `impact`, `action`, `confidence`). The interface is designed for easy LLM replacement later — same output schema, different brain.

**3. Multi-tenant without complexity**
Needed organization-scoped data but didn't want microservice complexity. Solved with a modular monolith where every query filters by `organization_id` and domain boundaries are enforced by package structure, not network calls.

**4. UUID routing conflicts**
FastAPI routes with UUID path parameters collided when `/{org_id}` and `/{property_id}` shared the same pattern. Solved by separating routes with distinct prefixes (`/detail/{property_id}`, `/{property_id}/listings`) and letting FastAPI's type system validate UUIDs automatically.

### Interesting Technical Decisions

- **Modular monolith over microservices** — Zero customers means zero distributed systems overhead
- **Rule-based AI over LLM** — Deterministic, free, and the interface is LLM-swappable later
- **Query-computed KPIs** — Never store derived data; always compute from source of truth
- **Soft deletes everywhere** — Financial audit trail is critical; nothing is truly deleted

---

## 📚 What I Learned

### Technical
- FastAPI's dependency injection system enables clean, testable service layers
- SQLAlchemy 2.0 async with `mapped_column` is a massive improvement over the old imperative style
- TanStack Query eliminates 90% of the state management headaches in React
- Pydantic v2's `model_validate()` makes ORM-to-schema mapping trivial

### Architecture
- Domain-Driven Design works beautifully in a monolith — package boundaries *are* domain boundaries
- Always design interfaces before implementations (the ConnectorInterface pattern paid off immediately)
- Auto-creating defaults on registration eliminates onboarding friction

### Problem Solving
- "What's the simplest thing that works?" beats "What's the most scalable architecture?" at MVP stage
- Financial software demands correctness over cleverness — every KPI must be traceable
- User experience is not just UI — it's also the API contract, error messages, and onboarding flow

---

## ⚡ Getting Started

### Prerequisites

- **Python 3.10+** (3.12 recommended)
- **PostgreSQL 16+** (local or Docker)
- **Bun** or **Node.js 22+**
- **Docker & Docker Compose** (optional)

### Installation

```bash
# Clone the repo
git clone https://github.com/your-org/HostWise-PMS.git
cd HostWise-PMS

# Option A: Docker (all-in-one)
docker compose up -d

# Option B: Manual setup

# 1. Database
sudo -u postgres psql -c "CREATE USER hostwise WITH PASSWORD 'hostwise' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE hostwise OWNER hostwise;"

# 2. Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3. Frontend (new terminal)
cd frontend
bun install
bun run dev
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://hostwise:hostwise@localhost:5432/hostwise` | Async DB connection |
| `JWT_SECRET_KEY` | *(change in production)* | JWT signing key |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed frontend origins |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | Backend API URL |

### Create Your Account

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@hostwise.app","password":"demo123456","full_name":"Demo User"}'
```

Or open **http://localhost:3000** and use the UI. An organization is auto-created on registration — you can start adding properties immediately.

### Services

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/api/docs |
| Database | localhost:5432 |

---

## 🖼 Screenshots

> *Dashboard, Finance, Analytics, and Properties screenshots coming soon.*

---

## 🔮 Future Improvements

### Phase 2 (3–6 months)
- [ ] Airbnb iCal & official API connector
- [ ] LLM-powered AI advisor (OpenAI integration)
- [ ] Email report delivery
- [ ] Guest profiles & repeat guest analytics
- [ ] Advanced pricing recommendations

### Phase 3 (6–12 months)
- [ ] Booking.com & Vrbo connectors
- [ ] Guesty & Hostaway PMS connectors
- [ ] Market data integration (AirDNA-style comps)
- [ ] Revenue forecasting engine
- [ ] Multi-currency support

### Phase 4 (12–24 months)
- [ ] ClickHouse for analytics at scale
- [ ] Redis caching layer
- [ ] Celery for background tasks
- [ ] White-label reports
- [ ] Public API for partners
- [ ] Mobile app

---

## 📄 License

Private — HostWise Platform. All rights reserved.

---

## 👨‍💻 Author

Built with the philosophy: *"Simplicity is the ultimate sophistication."* — Leonardo da Vinci

---

<p align="center">
  <b>HostWise</b> — Know your numbers. Grow your portfolio.
</p>
