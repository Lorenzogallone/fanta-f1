---
name: backup-and-deploy
description: Safe workflow before touching production Firestore data or deploying rules/functions - lint, build, backup, then deploy. Use when the user asks to deploy, migrate data, or run scripts in scripts/ that write to Firestore.
disable-model-invocation: true
---

Production deploys happen automatically from GitHub Actions on push to `main` (hosting, firestore rules, functions). Manual steps are only for data scripts.

1. `npm run lint && npm run build` - must pass.
2. Before ANY script that writes data (`scripts/migrate-f1-data.mjs`, `backfillProvider.js`, `restoreBackup.js`, recalculations): run `node scripts/backup.js` and confirm a fresh file exists in `backups/`. Needs `scripts/serviceAccount.json` locally; never print or commit it.
3. Prefer dry runs first (`scripts/sync-dry-run.mjs`, or a `--dry-run` flag if the script has one) and show the user the output.
4. Ask for explicit confirmation before the real run. Never run scripts against production without it.
5. For rules/functions changes: merge to `main` via PR and let CI deploy; do not run `firebase deploy` by hand unless asked.
