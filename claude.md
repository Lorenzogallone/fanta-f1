# Fanta F1 - Development Context

## Overview
Fantasy F1 web app for a group of friends. Players submit race formations (predict top 3 + joker) per Grand Prix and earn points based on real results. Built with React + Firebase Firestore.

## Tech Stack
- **Frontend**: React 19, React Router 7, React Bootstrap, MUI 7, React-Select, Recharts
- **Backend**: Firebase Firestore (NoSQL, real-time), Firebase Hosting
- **Build**: Vite 6, ESLint 9
- **APIs**: Jolpica/Ergast (`api.jolpi.ca/ergast/f1`) for race results, OpenF1 (`api.openf1.org/v1`) as fallback

## Project Structure
```
src/
  pages/           # Route pages (Home, Leaderboard, FormationApp, AdminPanel, etc.)
  components/      # Reusable UI (Navigation, RaceHistoryCard, AdminLogin, etc.)
  contexts/        # ThemeContext (dark/light/auto), LanguageContext (it/en)
  services/        # Core logic:
    firebase.js              # Firebase init (config hardcoded, not from env)
    pointsCalculator.js      # Race points engine
    championshipPointsCalculator.js  # Championship scoring
    f1DataResolver.js        # Driver/team resolution (manual → API cache → fallback)
    f1ResultsFetcher.js      # Ergast + OpenF1 race results
    f1SessionsFetcher.js     # Session data (FP, Quali, Sprint)
    backupService.js         # Backup/restore to Firestore
    statisticsService.js     # Stats calculations
    rankingSnapshot.js       # Ranking history
  data/
    f1-data.json     # Manual driver/team database with API aliases (update yearly)
  constants/
    racing.js        # DRIVERS, CONSTRUCTORS, DRIVER_TEAM, TEAM_LOGOS, POINTS, scoring rules
  translations/      # it.js, en.js - i18n strings
  hooks/             # useLanguage, useThemeColors, useToast, useTranslation
  utils/             # logger.js (dev-only), icsParser.js, lateSubmissionHelper.js
  styles/            # theme.css (CSS vars), App.css, customSelect.css
scripts/
  backup.js          # CLI backup (Firebase Admin SDK)
  restoreBackup.js   # CLI restore
public/
  *.png              # Team logos (referenced by filename in TEAM_LOGOS constant)
```

## Season Data (2026)
**11 teams, 22 drivers.** Data lives in two places:
1. `src/constants/racing.js` - Static arrays used by UI dropdowns, scoring, team logos
2. `src/data/f1-data.json` - API alias resolution (maps "Verstappen"/"VER"/"Max Verstappen" → display name)

Both must be updated together when changing driver/team data. The `f1DataResolver.js` reads from `f1-data.json` and provides cascading fallback resolution.

### Current Grid (2026)
| Team | Driver 1 | Driver 2 |
|------|----------|----------|
| McLaren | Norris #1 | Piastri #81 |
| Ferrari | Leclerc #16 | Hamilton #44 |
| Red Bull | Verstappen #3 | Hadjar #6 |
| Mercedes | Russell #63 | Antonelli #12 |
| Aston Martin | Alonso #14 | Stroll #18 |
| Williams | Albon #23 | Sainz #55 |
| Racing Bulls | Lawson #30 | Lindblad #41 |
| Alpine | Gasly #10 | Colapinto #43 |
| Haas | Ocon #31 | Bearman #87 |
| Audi | Hulkenberg #27 | Bortoleto #5 |
| Cadillac | Perez #11 | Bottas #77 |

### Team logos
Stored as PNG in `public/`. New teams reuse old logos until replaced:
- Audi → `/sauber.png` (ex-Sauber)
- Racing Bulls → `/vcarb.png` (ex-VCARB)
- Cadillac → `/cadillac.png` (needs to be added)

## Scoring System
- Main race: P1=12, P2=10, P3=8 points
- Sprint: SP1=8, SP2=6, SP3=4 points
- Joker: +5 if on podium (main), +2 (sprint) - position-independent
- 29→30 rule: perfect podium (30pts) = +1 extra joker for future use
- Late submission: -3 penalty (within configurable window after deadline)
- Last race: all points x2

## Firestore Collections
- `ranking` - Participant scores, jokers, championship picks, pointsByRace breakdown
- `races` - Race definitions, official results, sprint results, submissions subcollection
- `races/{raceId}/submissions` - Player formations per race
- `backups` - Auto/manual database snapshots
- `rankingHistory` - Ranking state after each calculation
- `championship` - End-of-season championship results

## Key Patterns
- **Data resolution**: `f1DataResolver.js` singleton with cascading fallback: static mapping → manual JSON → API cache (localStorage, 24h TTL) → inference from team → fallback display name
- **i18n**: `useLanguage()` hook returns `t("section.key")`, stored in localStorage
- **Theme**: CSS variables in `theme.css`, 3 modes (auto/light/dark), `ThemeContext`
- **Admin auth**: Password from `VITE_ADMIN_PASSWORD` env var, stored as `localStorage.adminAuth = "true"` after login
- **Backup before destructive ops**: Auto-backup created before each points calculation

## Common Tasks

### Update season data
1. Edit `src/constants/racing.js`: DRIVERS, CONSTRUCTORS, DRIVER_TEAM, TEAM_LOGOS
2. Edit `src/data/f1-data.json`: version, teams, drivers (with API aliases and numbers)
3. Edit `src/services/f1SessionsFetcher.js`: DRIVER_NUMBER_MAPPING
4. Add team logo PNGs to `public/` if new teams added

### Add a translation key
1. Add key to both `src/translations/it.js` and `src/translations/en.js`
2. Use via `const { t } = useLanguage(); t("section.key")`

### Run locally
```bash
npm install && npm run dev  # http://localhost:5173
```

### Deploy
```bash
npm run build && firebase deploy --only hosting
```

## Known Issues / Tech Debt
- Firebase config hardcoded in `firebase.js` instead of using env vars
- Firestore rules are `allow read, write: if true` (no auth enforcement)
- Admin auth trivially bypassable via localStorage manipulation
- `AdminPanel.jsx` is 2200+ lines - should be split into sub-components
- Some Italian strings not yet in i18n translation files
- No Cadillac team logo PNG yet (needs `/public/cadillac.png`)
- `f1SessionsFetcher.js` has driver number mapping that needs yearly updates
