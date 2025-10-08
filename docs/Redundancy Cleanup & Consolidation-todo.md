## 🚧 Tasks
- [ ] Consolidate /auth/register handlers into a single canonical route
  - **Description**: Remove the nested `/api/auth/register/register` handler, keep `/api/auth/register`, and provide a redirect for legacy consumers if required.
  - **Prerequisites**: Confirm current handler behavior and any downstream consumers relying on the nested path.
  - **Expected output**: Only `src/app/api/auth/register/route.ts` handles registrations, and redundant files are removed or redirect to it.
  - **Verification criteria**: Requests to both legacy and canonical endpoints succeed with identical responses; unit/integration tests pass.
- [ ] Unify dev login endpoints under /_dev/login with strict gating
  - **Description**: Remove duplicate dev login route and ensure remaining handler performs environment and role checks.
  - **Prerequisites**: Inventory existing guards and secrets used by both endpoints.
  - **Expected output**: A single safe dev login handler under `/_dev/login`; old path removed or redirected.
  - **Verification criteria**: Automated tests confirm guard enforcement and old path returns redirect or 404 as intended.
- [ ] Merge usePerformanceMonitoring hook into a single TypeScript module
  - **Description**: Combine `.ts` and `.tsx` variants into one non-JSX implementation with consistent exports.
  - **Prerequisites**: Audit hook consumers across the repo.
  - **Expected output**: One `usePerformanceMonitoring.ts` file with shared logic, updated imports everywhere.
  - **Verification criteria**: Type checks succeed and runtime behavior unchanged.
- [ ] Consolidate SettingsNavigation component to one shared implementation
  - **Description**: Combine duplicated navigation components and provide transitional re-exports to prevent breaking imports.
  - **Prerequisites**: Document current props and usage patterns.
  - **Expected output**: Single navigation component under a canonical path with optional barrel re-export.
  - **Verification criteria**: UI snapshots or visual tests pass; no duplicate component files remain.
- [ ] Extract shared health utilities and update all health entry points
  - **Description**: Create `src/lib/health.ts` providing reusable health collection and refactor API routes and Netlify function to use it.
  - **Prerequisites**: Understand existing health check metrics and dependencies.
  - **Expected output**: All health endpoints/functions import from the shared library and return unified response shapes.
  - **Verification criteria**: Unit tests for health utilities pass; endpoints respond consistently.
- [ ] Centralize cron job logic into src/lib/cron modules
  - **Description**: Move reminder and related cron workflows into shared cron utilities consumed by both API and Netlify contexts.
  - **Prerequisites**: Catalog existing cron implementations and shared dependencies.
  - **Expected output**: Netlify functions and API routes call shared cron helpers from `src/lib/cron/*`.
  - **Verification criteria**: Automated tests cover cron helpers; manual spot checks ensure schedules still operate.
- [ ] Standardize Prisma datasource on DATABASE_URL
  - **Description**: Update Prisma schema and env validation scripts to use `DATABASE_URL` consistently, mapping legacy variables if necessary.
  - **Prerequisites**: Review deploy environments for existing variable names.
  - **Expected output**: Prisma config references `DATABASE_URL`, documentation updated, and Netlify/Neon config aligned.
  - **Verification criteria**: `pnpm db:generate` succeeds locally and in CI after env updates.
- [ ] Add CI guardrails against duplicate routes and modules
  - **Description**: Introduce lint/test automation detecting duplicate route files, dev-only exports, and redundant imports.
  - **Prerequisites**: Determine CI hooks and tooling (e.g., ESLint, custom script, or Semgrep).
  - **Expected output**: New CI step failing on detected duplication patterns.
  - **Verification criteria**: Guardrail tests intentionally triggered in local run and prevent merges without fixes.

## ✅ Completed
- None recorded yet.

## ⚠️ Issues / Risks
- Legacy consumers may depend on deprecated routes; redirects must be verified before deletion.

## 🚧 In Progress
- [ ] Pending task selection for current session.

## 🔧 Next Steps
- [ ] Prioritize high-impact route consolidation before deeper refactors.
