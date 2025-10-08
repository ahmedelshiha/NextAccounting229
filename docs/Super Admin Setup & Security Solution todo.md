## ✅ Completed (recent)
- [x] Added scripts/check_admin_rbac.js and GitHub Actions workflow to run RBAC checks
- [x] Updated .github/workflows/check-rbac.yml to install pnpm before using it
- [x] Resolved pnpm version conflict by removing `packageManager` from package.json so workflow-controlled setup is the single source of truth
- [x] Switched to pnpm/action-setup@v4 in check-rbac workflow for robust pnpm installation

## 🚧 In Progress
- [ ] SUPER_ADMIN step-up coverage — final sweep across high‑risk admin endpoints and UI actions; centralize step-up checks while preserving per-route control; document behavior and precedence.

## 🔧 Next Steps
- [ ] Monitor CI run for the updated check-rbac workflow and fix any remaining failures.
- [ ] Optionally pin pnpm version via pnpm/action-setup in workflows if reproducible builds are required.
