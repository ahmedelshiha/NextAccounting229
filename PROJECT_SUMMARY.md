# Project Summary & Technical Audit — 2025-02

## Platform Overview
- Full-stack Accounting Firm platform built on Next.js App Router with React 19 and TypeScript.
- Multi-tenant architecture supporting admin operators, staff, and client portal experiences.
- Feature domains cover analytics dashboards, booking lifecycle, service requests, tasks, invoicing, communications, uploads, and compliance.
- Operational footprint includes Netlify scheduled functions, standalone monitoring assets, and a ClamAV microservice for antivirus scanning.

## Architecture Map
| Layer | Key Assets |
|-------|------------|
| UI / App | `src/app` routes (admin, portal, booking, marketing, auth), `src/components` shared UI, shadcn/ui primitives, Radix bindings |
| Domain Logic | `src/services`, `src/lib`, `src/stores`, `src/hooks`, schema validation in `src/schemas` and Zod definitions |
| Data Layer | Prisma client (`src/lib/prisma.ts`), migrations under `prisma/`, tenant filters, caching adapters (`src/lib/cache/redis.ts`) |
| APIs & Integrations | App Router API routes under `src/app/api/*`, Netlify functions (`netlify/functions`), Stripe, SendGrid, Sentry, Redis/Upstash, ClamAV |
| Tooling & Automation | `scripts/` maintenance/backfill utilities, `monitoring/` dashboards, Playwright + Vitest test suites, lint/typecheck/test commands |

## Major Feature Areas
- **Admin Suite** (`src/app/admin`): dashboards, analytics, bookings, services, service-requests, tasks (board/calendar/table/gantt), compliance, roles/permissions, settings, reports, notifications, reminders, integrations, perf metrics.
- **Client Portal** (`src/app/portal`): bookings, service requests, expenses scanning, settings, realtime chat, financial dashboards, secure uploads.
- **Public Site** (`src/app` root): marketing pages (landing variants, services, blog, faq, about, careers), auth flows, booking experience, resources.
- **Communications**: admin chat console, notifications pipelines, newsletters, automated email flows via SendGrid, cron reminders.
- **Financial Operations**: invoices, payments (Stripe), expenses ingestion, pricing tools, ROI/tax calculators.
- **Content & SEO**: blog system, schema markup utilities, localization with RTL support (en/ar/hi) and extendable locale registry.

## Data & Integrations
- Prisma ORM for PostgreSQL with multi-tenancy guardrails and optional `NETLIFY_DATABASE_URL` fallback.
- Stripe SDK for checkout, COD, webhook handling, and invoice sequences.
- SendGrid for transactional emails; fallback logging enabled when keys absent.
- Redis/Upstash adapters for realtime notifications, plus optional Postgres logical decoding via `realtime-enhanced` utilities.
- Netlify Blobs upload provider with antivirus pipeline (clamav-service) and quarantine management.
- Sentry (client/server/edge configs) and monitoring scripts for observability.

## Testing & Quality Gates
- Vitest suites across `tests/` covering API routes, admin layouts, tenant filters, uploads, cron handlers, and performance budgets (`tests/thresholds.test.ts`).
- Playwright E2E specs in `e2e/tests/` for admin settings, services, portal flows, uploads, and login health checks with preview support.
- Environment validation script (`scripts/check-required-envs.sh`) enforces config hygiene.
- Linting (`pnpm lint`) and type-checking (`pnpm typecheck`) required for CI stability.

## Automation & Operations
- Extensive scripts for database migrations, RLS enablement, tenant audits, backfills, monitoring setup, security checks, and cron telemetry.
- Netlify scheduled functions (`cron-reminders`, `cron-payments-reconcile`, `health-monitor`) complement App Router cron endpoints.
- Monitoring assets in `monitoring/` and production health scripts (`scripts/production-monitoring.js`, `scripts/health-check.js`).

## Security & Compliance Highlights
- Role-based access control with dedicated admin layout store and permissions inspectors.
- Tenant scoping via filter providers, Prisma middleware, and guard utilities with regression tests.
- Secure uploads workflow with antivirus scanning, quarantine review UI, and provider abstractions.
- NextAuth.js with Prisma adapter and bcrypt hashing; login throttling via dev login guard rails for previews.
- Environment-driven feature toggles (multi-tenancy, realtime transport, fetch debug) for safe ops.

## Risks & Opportunities
- Dependencies `import-in-the-middle` / `require-in-the-middle` use wildcards; pin versions to reduce supply-chain exposure.
- Large archive/docs directories contain legacy material—review for deprecation or consolidation.
- React 19 and Next.js 15 adoption requires continued validation of third-party compatibility (Radix, shadcn/ui, chart.js).
- Ensure ClamAV microservice deployment remains part of infra playbooks (currently scoped in `clamav-service/`).
- Confirm Redis / Realtime adapters have production credentials or fallbacks to avoid silent degradation.
- Maintain Netlify cron secrets and Stripe webhook secret rotation schedules.

## Recommended Next Steps
1. **Dependency Hygiene:** lock wildcard packages, audit transitive deps, and schedule routine `pnpm audit` checks.
2. **Documentation Expansion:** add runbooks for ClamAV deployment, tenant migration scripts, and realtime adapter configuration.
3. **CI Hardening:** enforce lint/typecheck/test across all PRs; add Playwright smoke workflow with preview credentials.
4. **Monitoring Enhancements:** integrate Sentry releases, ensure `monitoring/` dashboards are wired to production metrics.
5. **Module Cleanup:** evaluate archived templates/docs for removal or migration to knowledge base; document feature ownership updates.
