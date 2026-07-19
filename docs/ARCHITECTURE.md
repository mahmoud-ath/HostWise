# HostWise — Vacation Rental Intelligence Platform

## Architecture Document

---

## 1. Product Overview

**HostWise** is **not** a Property Management System. It is **not** a booking platform.

HostWise is an **AI-powered analytics and financial intelligence layer** that sits above vacation rental data sources. It transforms raw booking data, financial records, and market signals into strategic business insights, actionable recommendations, and automated financial reports.

### Core Value Proposition

> "Turn your booking data into a CFO-grade financial intelligence system."

### What HostWise Does

- Answers: "Why is my revenue decreasing?"
- Answers: "Which property is underperforming?"
- Answers: "How can I increase my profit margin?"
- Generates: AI-powered financial recommendations
- Automates: Monthly, quarterly, and annual financial reports

### What HostWise Does NOT Do

- Manage bookings
- Process payments
- Handle guest communications
- Replace Airbnb, Booking.com, or any PMS

---

## 2. Architecture Philosophy

### Modular Monolith

The entire application is a single deployable unit — a **modular monolith**. There are no microservices, no Kubernetes, no event buses, no Kafka. Every domain is a Python package within the same FastAPI application.

**Why:**
- Zero customers → zero need for distributed systems
- Single VPS deployment keeps infra under $20/month
- Domain boundaries are enforced by interfaces, not network boundaries
- Can extract microservices later if/when scale demands it

### Domain-Driven Design

The codebase is organized around business domains, not technical layers. Each domain is self-contained with its own models, schemas, repository, service, and router.

### Evolution Strategy

| Now (MVP) | 6 Months | 2 Years |
|-----------|----------|---------|
| FastAPI monolith | Same monolith + Redis cache | Extract analytics to separate service |
| PostgreSQL | PostgreSQL + read replicas | PostgreSQL + ClickHouse for analytics |
| Local file storage | Cloudflare R2 | Cloudflare R2 + CDN |
| Rule-based AI | LLM integration (OpenAI) | Custom ML models |
| Docker Compose | Docker Compose + CI/CD | Kubernetes (only if justified) |

---

## 3. Domain Model

### Core Entities

```
User
 └── Organization (tenant boundary)
      ├── Property
      │    ├── Listing (Airbnb, Booking, Vrbo, Direct)
      │    ├── Reservation
      │    │    └── Guest
      │    ├── Revenue
      │    └── Expense
      ├── RevenueCategory
      ├── ExpenseCategory
      └── OrganizationMember (User ↔ Organization junction)
```

### Key Relationships

- **Organization** is the tenant boundary — every entity belongs to one
- **Property** is the core asset — everything revolves around it
- **Reservation** is the atomic revenue-generating event
- **Revenue** can be linked to a Reservation or standalone (manual/CSV)
- **Expense** is scoped to a Property within an Organization

### Normalization Strategy

All external data (Airbnb, Booking, CSV) is normalized to internal enums:

| External | Internal |
|----------|----------|
| Airbnb "confirmed" | `ReservationStatus.CONFIRMED` |
| Booking "reserved" | `ReservationStatus.CONFIRMED` |
| Airbnb "cancelled" | `ReservationStatus.CANCELLED` |

---

## 4. Module Breakdown

### `app/core/`
Configuration, database engine, DI container. No business logic.

### `app/shared/`
Base classes: `BaseModel`, `BaseRepository`, shared schemas, exceptions.

### `app/auth/`
JWT authentication, user registration, login, token refresh. Role-based access via `OrganizationMember.role`.

### `app/organizations/`
Tenant management. Each Organization has configurable revenue/expense categories, fiscal year settings, currency, and commission rates.

### `app/properties/`
Property CRUD, listing management. A Property has multiple Listings across different platforms.

### `app/reservations/`
Reservation records — the atomic unit of revenue. Linked to Property and optionally to Listing. Supports filtering by date range, status, property.

### `app/finance/`
**The heart of the platform.**
- **Revenue**: Records with gross_amount, commission_amount, net_amount (auto-calculated)
- **Expense**: Records by category, vendor, payment method
- **FinancialReportingService**: Generates summaries, monthly reports, annual reports, category breakdowns, property rankings
- All KPIs are query-computed — never stored

### `app/analytics/`
Property and portfolio analytics:
- Occupancy Rate
- ADR (Average Daily Rate)
- RevPAR
- Booking Window
- Cancellation Rate
- Average Stay Length
- Property Health Score (0-100)
- Seasonality Analysis

### `app/ai/`
AI Financial Advisor:
- Rule-based analysis for MVP
- Generates 5 types of recommendations: critical, warning, positive, info
- Each recommendation includes: cause, business impact, suggested action, expected improvement, confidence score
- Executive summary generation
- Interface designed for LLM replacement later

### `app/reports/`
Report generation: weekly, monthly, annual, executive summaries. Combines financial data with AI insights.

### `app/connectors/`
Data source connectors. Every connector implements `ConnectorInterface`:
- `import_properties()`
- `import_reservations()`
- `import_revenue()`
- `import_expenses()`

Current: CSV connector. Future: Airbnb API, Booking.com, Vrbo, iCal.

---

## 5. Database Design

### PostgreSQL 16

All tables use:
- UUID primary keys
- `created_at` / `updated_at` timestamps
- Soft delete (`deleted_at` + `is_deleted`)
- Foreign keys with CASCADE or SET NULL
- Appropriate indexes on: `organization_id`, `property_id`, `date`, `status`

### Key Tables

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `users` | Authentication | email (unique) |
| `organizations` | Tenant boundary | slug (unique) |
| `organization_members` | User-Org junction | user_id, organization_id |
| `properties` | Core asset | organization_id |
| `listings` | Platform listing | property_id |
| `reservations` | Booking record | organization_id, property_id, check_in, status |
| `revenues` | Revenue entries | organization_id, property_id, date |
| `expenses` | Expense entries | organization_id, property_id, date |
| `revenue_categories` | Configurable categories | organization_id |
| `expense_categories` | Configurable categories | organization_id |

---

## 6. API Design

### RESTful conventions

- `/api/v1/auth/*` — Authentication
- `/api/v1/organizations/*` — Tenant management
- `/api/v1/properties/*` — Property & listing CRUD
- `/api/v1/finance/{org_id}/revenue` — Revenue entries
- `/api/v1/finance/{org_id}/expense` — Expense entries
- `/api/v1/finance/{org_id}/summary` — Financial KPI dashboard
- `/api/v1/finance/{org_id}/report/monthly` — Monthly report
- `/api/v1/finance/{org_id}/report/annual` — Annual report
- `/api/v1/analytics/{org_id}/property/{prop_id}` — Property analytics
- `/api/v1/analytics/{org_id}/portfolio` — Portfolio analytics
- `/api/v1/ai/{org_id}/analyze` — AI financial analysis
- `/api/v1/reports/{org_id}/*` — Formatted reports
- `/api/v1/connectors/*` — Data import

### Authentication

All protected endpoints require: `Authorization: Bearer <jwt_token>`

---

## 7. Frontend Architecture

### Next.js 14 with App Router

- **`src/app/page.tsx`** — Main dashboard with KPIs, charts, AI recommendations
- **`src/app/finance/`** — Revenue & expense management
- **`src/app/properties/`** — Property portfolio
- **`src/app/analytics/`** — Deep analytics
- **`src/app/ai-advisor/`** — AI recommendations
- **`src/app/reports/`** — Report generation
- **`src/app/import/`** — CSV upload & connector management
- **`src/app/settings/`** — Organization & user settings

### Component Architecture

```
components/
├── ui/              # shadcn/ui primitives (Button, Card, Input, Badge, Tabs)
├── layout/          # AppShell, Sidebar
├── dashboard/       # KPICards, RevenueBarChart, CashflowLineChart
├── auth/            # LoginPage
├── finance/         # Revenue form, expense form (extensible)
└── properties/      # Property cards (extensible)
```

### State Management

- **React Query** for server state (TanStack Query)
- **React Context** for auth state only
- No Redux — unnecessary for this architecture

---

## 8. Infrastructure

### MVP Deployment (Under $20/month)

```
┌─────────────────────────────────────┐
│         Ubuntu VPS ($12-20/mo)      │
│                                     │
│  ┌──────────┐  ┌──────────────────┐ │
│  │ Nginx    │  │ Docker Compose   │ │
│  │ (reverse │  │                  │ │
│  │  proxy)  │  │  ┌────────────┐  │ │
│  │          │  │  │ FastAPI    │  │ │
│  │          │  │  │ (backend)  │  │ │
│  │          │  │  └────────────┘  │ │
│  │          │  │  ┌────────────┐  │ │
│  │          │  │  │ Next.js    │  │ │
│  │          │  │  │ (frontend) │  │ │
│  │          │  │  └────────────┘  │ │
│  │          │  │  ┌────────────┐  │ │
│  │          │  │  │ PostgreSQL │  │ │
│  │          │  │  │ 16 Alpine  │  │ │
│  │          │  │  └────────────┘  │ │
│  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────┘
```

### Docker Compose Services

1. **db** — PostgreSQL 16 Alpine
2. **backend** — FastAPI with uvicorn
3. **frontend** — Next.js dev server

---

## 9. Security

- JWT with access/refresh token rotation
- Password hashing with bcrypt
- Organization-scoped data access
- Role-based permissions (admin, owner, manager, viewer)
- All inputs validated with Pydantic
- SQL injection prevention via SQLAlchemy parameterized queries
- CORS restricted to frontend origin
- Rate limiting (configurable)

---

## 10. Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 22+ (for local frontend dev)
- Python 3.12+ (for local backend dev)

### Quick Start

```bash
# Clone and start everything
cd HostWise-PMS
docker compose up -d

# Backend API at http://localhost:8000
# API Docs at http://localhost:8000/api/docs
# Frontend at http://localhost:3000

# Create first user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@hostwise.app","password":"demo123456","full_name":"Demo User"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@hostwise.app","password":"demo123456"}'
```

### Database Migrations

```bash
cd backend
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

---

## 11. Future Roadmap

### Phase 1 (Now — MVP)
- [x] User authentication & organizations
- [x] Property management
- [x] Revenue & expense tracking
- [x] Financial dashboard with KPIs
- [x] Monthly & annual reports
- [x] Rule-based AI advisor
- [x] CSV import connector
- [x] Property health score

### Phase 2 (3-6 months)
- [ ] Airbnb iCal connector
- [ ] Airbnb official API connector
- [ ] Advanced pricing recommendations
- [ ] LLM-powered AI advisor
- [ ] Email reports
- [ ] Guest profiles & repeat guest analytics

### Phase 3 (6-12 months)
- [ ] Booking.com connector
- [ ] Vrbo connector
- [ ] Guesty & Hostaway PMS connectors
- [ ] Market data integration
- [ ] Forecasting engine
- [ ] Multi-currency support

### Phase 4 (12-24 months)
- [ ] ClickHouse for analytics at scale
- [ ] Redis caching layer
- [ ] Celery for background tasks
- [ ] White-label reports
- [ ] Public API for partners
- [ ] Mobile app

---

## 12. Design Decisions Log

| Decision | Rationale |
|----------|-----------|
| Modular monolith over microservices | Zero customers. Monolith is simpler, cheaper, and can be extracted later. |
| FastAPI over Django | Async-native, Pydantic validation, better for API-first design. |
| PostgreSQL over MongoDB | Relational data model is critical for financial records. |
| No Redis (yet) | PostgreSQL handles MVP query load. Add Redis when caching is needed. |
| Rule-based AI over LLM | LLM costs are unpredictable. Rules work for MVP and provide deterministic results. |
| shadcn/ui over Material UI | Lighter, more customizable, better developer experience. |
| Recharts over D3 | Simpler API, good enough for business charts. |
| UUIDs over auto-increment IDs | Multi-tenant safety, no ID collision, better for future distributed systems. |
| Soft deletes | Financial data should never be truly deleted — audit trail is critical. |

---

*Built with the philosophy: "Simplicity is the ultimate sophistication." — Leonardo da Vinci*
