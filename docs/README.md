# HostWise — Technical Architecture & Workflow Audit

This directory is the official architectural documentation of the HostWise
platform. It was written for **future developers**, **software architects**,
**technical reviewers**, and **investors performing technical due diligence**.

> **Product simplification (v2 overhaul):** HostWise is **auth-free** (local,
> single-user onboarding via name/email only), does **not** track
> occupancy/ADR/RevPAR, and focuses on **profit-driven analytics** with full
> CRUD for properties and finances, **BYOK AI** (bring your own LLM key),
> a professional PDF report layout, and an automated backend test suite.
> See the **What changed** note in [decision-log.md](./decision-log.md).

> **Current status (2026-08-08):** v0.7.6 runs a **native Rust backend**
> (`backend-rs/`, axum + sqlx/SQLite) embedded in-process inside the Tauri
> desktop shell — no Python, no sidecar. A full production & settings audit
> fixed several functional gaps (finance category merge, PDF export fields,
> backup list + restore, AI key clear + base-url validation, CSV import
> encodings, currency-driven charts, About versions). See
> [CHANGELOG.md](./CHANGELOG.md) for what changed and
> [run-and-production.md](./run-and-production.md) / [BUILD.md](./BUILD.md) for
> how to run and build it.

> The guiding principle throughout: HostWise is **not** a booking engine and
> **not** a traditional PMS. It is the **analytics and intelligence layer** that
> sits on top of booking data. Every architectural decision exists to serve
> that one idea — turning raw booking and financial data into **professional
> reports, strategic insights, and actionable recommendations**.

## Document Index

| Document | What it covers |
| --- | --- |
| [overall-architecture.md](./overall-architecture.md) | The whole system: vision, philosophy, stack, architecture style, module map, data flow, principles, decision log, evolution. **Start here.** |
| [frontend-architecture.md](./frontend-architecture.md) | Next.js app structure, providers, contexts, hooks, API client, state management, component patterns. |
| [dashboard-audit.md](./dashboard-audit.md) | The `/` command-center page. |
| [analytics-audit.md](./analytics-audit.md) | The `/analytics` deep-dive page. |
| [finance-audit.md](./finance-audit.md) | The `/finance` transaction-tracking page. |
| [properties-audit.md](./properties-audit.md) | The `/properties` portfolio-management page. |
| [reports-audit.md](./reports-audit.md) | The `/reports` professional reporting page. |
| [ai-advisor-audit.md](./ai-advisor-audit.md) | The `/ai-advisor` financial co-pilot page. |
| [settings-audit.md](./settings-audit.md) | The `/settings` configuration page. |
| [import-audit.md](./import-audit.md) | The `/import` CSV/connector page. |
| [authentication-audit.md](./authentication-audit.md) | The auth flow (frontend) + backend auth domain. |
| [backend-finance-domain.md](./backend-finance-domain.md) | Finance domain deep-dive. |
| [backend-analytics-domain.md](./backend-analytics-domain.md) | Analytics domain deep-dive. |
| [backend-ai-domain.md](./backend-ai-domain.md) | AI domain deep-dive (advisor, chat, scenarios). |
| [backend-reports-domain.md](./backend-reports-domain.md) | Reports domain deep-dive. |
| [backend-auth-domain.md](./backend-auth-domain.md) | Auth domain deep-dive. |
| [database-audit.md](./database-audit.md) | Schema, relationships, normalization, indexes, evolution. |
| [api-design.md](./api-design.md) | Full endpoint inventory with purpose/consumer/logic/security. |
| [decision-log.md](./decision-log.md) | Every important architectural decision: problem, solution, alternatives, trade-offs, rationale. |
| [roadmap.md](./roadmap.md) | Improvement suggestions classified by phase (Immediate / After MVP / Production / Scaling / Enterprise). |

## How to read this audit

1. **Start** with [overall-architecture.md](./overall-architecture.md) to build
   the mental model of the entire system.
2. Read the **page audits** for the user-facing experience, and the **backend
   domain audits** for the server-side mechanics.
3. Use [database-audit.md](./database-audit.md) and [api-design.md](./api-design.md)
   as reference when touching persistence or adding endpoints.
4. Read [decision-log.md](./decision-log.md) **before changing anything
   significant** — it explains *why* the current shape exists, so you know what
   is deliberate vs. accidental.
5. Use [roadmap.md](./roadmap.md) to place any proposed improvement in the
   correct phase of maturity.

> ⚠️ **What should NOT be changed casually:** the computed-on-demand analytics
> philosophy, the repository + service layering, the rule-based AI interface
> (it is deliberately LLM-swappable), the soft-delete + `sync_id` conventions,
> and the local-first data model. Details in [decision-log.md](./decision-log.md).
