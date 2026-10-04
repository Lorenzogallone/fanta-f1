# Fanta F1

Fantasy F1 web app (React 19 + Vite PWA, react-bootstrap, Firebase 12: Auth/Firestore/Functions/Hosting). UI text is Italian/English via `src/translations`.

## Commands
- `npm run dev` / `npm run build` / `npm run lint` (no test suite yet)
- `cd functions && npm ci` - Cloud Functions (Node 22, CommonJS, push notifications)
- Deploy: automatic via GitHub Actions on push to `main`. Don't deploy by hand.

## Layout
- `src/pages` (+ `pages/admin`), `src/components`, `src/contexts` (Auth, F1Data, Language, Theme), `src/hooks`
- `src/services`: points calculation (`pointsCalculator`, `championshipPointsCalculator`, `recalculateAllRaces`), Jolpica API sync (`f1*`, `calendarSyncService`), notifications
- `functions/shared/*.mjs`: Jolpica sync shared with the functions; `functions/index.js`: scheduled notifications
- `firestore.rules`: server-side enforcement of deadlines, jolly and points - keep in sync with client writes
- `scripts/`: admin Node scripts using `scripts/serviceAccount*.json` (gitignored, never touch)

## Rules
- Scoring rules are specified in README.md; change code and README together.
- Any write path touching points/jolly/penalties needs a matching check in `firestore.rules`.
- Run `node scripts/backup.js` before scripts that write production data (see `/backup-and-deploy`).
- Commits: conventional style (`fix:`, `feat:`, `chore:`), PR-based on `main`.
