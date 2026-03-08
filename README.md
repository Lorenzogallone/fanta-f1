# 🏎️ Fanta F1

A comprehensive web application to manage Formula 1 fantasy league among friends with real-time standings, automatic points calculation, and advanced administration tools.

## 🎮 What is Fanta F1?

Fanta F1 is a fantasy game based on the Formula 1 World Championship. Each participant creates a formation of drivers for every race and accumulates points based on their real performance on track.

## 📋 How It Works

### Race Formation
For each Grand Prix, every player **submits their formation before the race starts**:
- **3 Drivers (P1, P2, P3)**: Prediction of the top 3 finishers in order
- **1 Joker**: A bonus driver that grants 5 extra points if they finish on the podium
- **1 Joker 2 (optional)**: Second joker unlockable with the 29→30 rule

### Sprint Race
For weekends with Sprint Races, a separate formation can be submitted:
- **3 Sprint Drivers (SP1, SP2, SP3)**: Sprint podium prediction
- **1 Sprint Joker**: Bonus of 2 points if they finish on the sprint podium

### Championship Formation
**Mid-season**, each player predicts:
- **Top 3 Drivers** of the drivers' world championship
- **Top 3 Constructors** of the constructors' world championship

Points are awarded at the end of the season using the same system as races.

## 🏆 Scoring System

### Main Race Points
**Only the top 3 finishers award points:**
- **Guess 1st place (P1)**: 12 points
- **Guess 2nd place (P2)**: 10 points
- **Guess 3rd place (P3)**: 8 points

### Sprint Points
**Only the top 3 finishers award points:**
- **Guess 1st place (SP1)**: 8 points
- **Guess 2nd place (SP2)**: 6 points
- **Guess 3rd place (SP3)**: 4 points

### Joker Bonus
- The **race joker** gives **5 fixed points** if the chosen driver finishes on the podium (top 3), **regardless of position**
- **Joker 2** works the same way as the race joker (5 points if on podium)
- The **sprint joker** gives **2 fixed points** if the driver finishes on the sprint podium
- Main race and sprint jokers are independent

### Late Submission Penalty
- Submissions after the qualifying deadline receive a **-3 points penalty**
- Available only within the late submission window (configurable in `racing.js`)
- One-time penalty per user (tracked in database)

### Special Rule: 29→30
- If you guess the entire podium in order (12+10+8 = 30 total points), you earn **1 extra joker** to use in a future race
- Valid for both main race and sprint
- Also valid for championship formation

### Championship Scoring
At the end of the season, the same points as races are awarded:
- Guess 1st driver/constructor: 12 points
- Guess 2nd driver/constructor: 10 points
- Guess 3rd driver/constructor: 8 points
- The 29→30 rule also applies here!

### 🏁 Last Race - Double Points
For the last race of the season, **all points are doubled**:
- Main race: 24, 20, 16 points (instead of 12, 10, 8)
- Sprint (if present): 16, 12, 8 points (instead of 8, 6, 4)
- Race joker: 10 points (instead of 5)
- Sprint joker: 4 points (instead of 2)
- The 29→30 rule points are also doubled!

## 🖥️ App Features

### 📊 Leaderboard
View the real-time standings with:
- Position and total points
- Gap from leader
- Available jokers
- Championship points breakdown
- Interactive chart showing points progression over the season

### 👤 Participant Detail
Click on any participant to see detailed statistics:
- **Points History**: Complete breakdown of points per race (main + sprint)
- **Performance Metrics**: Best race, worst race, average points
- **Jokers Usage**: How many jokers earned and used
- **Championship Predictions**: Drivers and constructors picks
- **Formation History**: All submitted formations with timestamps

### 🏁 Race History
Check past race results with comprehensive cards showing:
- **Official Results**: Podium finishers (main race + sprint)
- **All Formations**: Every player's predictions for that race
- **Points Earned**: Individual points per participant
- **Race Status**: Calculated, cancelled, or pending
- **Sprint Support**: Separate view for sprint races

### 🎯 Submit Formation
Enter your formation for the next race:
- **Smart Driver Selection**: React-Select dropdowns with search
- **Team Logos**: Visual team identification
- **Anti-Duplicate Validation**: Real-time validation prevents selecting same driver twice
- **Formation Preview**: See your complete lineup before submitting
- **Sprint Race Support**: Automatic detection of sprint weekends
- **Deadline Countdown**: Visual countdown to submission deadline

### 📅 Championship Formations
Predict the top 3 drivers and constructors mid-season:
- Select from all active F1 drivers
- Select from all F1 teams
- View all participants' predictions
- Points calculated at season end

### 📈 Statistics Dashboard
Advanced analytics page with:
- **Global Stats**: Total races, active participants, total points distributed
- **Top Performers**: Best average points, most jokers earned
- **Race Insights**: Hardest race to predict, most popular picks
- **Trends**: Points distribution charts and graphs

### ⚙️ Admin Panel
Administrators have full access to all features through a comprehensive admin dashboard:

#### **👥 Participant Management**
- Add new participants with custom starting points
- Edit participant details (name, points, jokers)
- Delete participants with confirmation
- View complete participant roster

#### **📝 Formation Management**
- **Submit formations for any user** (bypass deadline)
- **Edit existing formations** even after deadline
- **Late submission flag**: Mark formations as late with -3 penalty
- **Race selection helper**: Shows which races already have formations
- **Smart validation**: Prevents duplicate drivers, incomplete selections
- **Sprint support**: Manage sprint formations separately

#### **📅 Calendar Management**
- **Modify race dates** (raceUTC, qualiUTC, qualiSprintUTC)
- **Edit formation deadlines** for any race
- **Add/Remove sprint** from race weekends
- **Cancel races/sprints**: Mark as cancelled (skips points calculation)
- **View calendar status**: See which races have results calculated

#### **🧮 Points Calculation**
- **Automatic result fetching** from Ergast F1 API
- **Manual result entry** with podium selection dropdowns
- **One-click calculation** for race or championship points
- **Automatic backup** before each calculation
- **Double points** automatic detection for final race
- **29→30 rule** automatic joker assignment
- **Ranking snapshots** saved after each calculation

#### **💾 Backup Management**
- **Create manual backups**: Full database snapshot (JSON + Firestore)
- **Automatic backups**: Created before critical operations
- **Backup browser**: View all saved backups with metadata
- **Backup preview**: Inspect backup contents before restore
- **One-click restore**: Restore database from any backup point
- **Download backups**: Export as JSON for offline storage

#### **🗑️ Database Operations**
- **Reset formations**: Delete all submissions (keeps participants)
- **Reset scores**: Zero all points (keeps participants and races)
- **Complete reset**: Clear formations + scores
- **Confirmation protection**: Type "RESTORE" to confirm destructive operations

## 🎨 Features

- ✅ **Minimal Design**: Clean white/black/red F1-inspired style
- 🌓 **Dark Mode**: Full dark theme support with persistent preference
- 📱 **Responsive**: Fully optimized for desktop, tablet, and mobile
- ⚡ **Real-time**: Live updates via Firebase Firestore
- 🔒 **Secure**: Admin panel protected by Firebase Custom Claims
- 🌍 **Multi-language**: i18n support for Italian/English (expandable)
- 🔄 **Dynamic Data**: Automatic driver/team sync from Ergast API
- 💾 **Auto-backup**: Automatic backups before critical operations
- 📊 **Advanced Analytics**: Detailed statistics and performance tracking
- 🔔 **Push Notifications**: Automatic qualifying reminders via FCM
- 📲 **PWA**: Installable on mobile and desktop with offline support
- 🚀 **CI/CD**: Automatic deployment via GitHub Actions
- ☁️ **Cloud Functions**: Scheduled notification delivery

## 🛠️ Tech Stack

### Frontend
- **React 19.2**: Latest React with concurrent features
- **React Router v7**: Client-side routing
- **React Bootstrap 2.10.10**: UI component library
- **React-Select**: Searchable dropdown selectors
- **Recharts**: Data visualization and charts
- **react-hot-toast**: Toast notifications
- **vite-plugin-pwa**: Progressive Web App support with Workbox

### Backend & Database
- **Firebase Firestore**: NoSQL real-time database
- **Firebase Authentication**: Email/password + Google sign-in
- **Firebase Cloud Messaging (FCM)**: Push notifications
- **Firebase Cloud Functions**: Scheduled tasks (Node.js 20)
- **Firebase Hosting**: Static site deployment with global CDN
- **Ergast F1 API**: Automatic race results fetching

### Build & Deployment
- **Vite 6.3.5**: Lightning-fast build tool with ES2020 target
- **GitHub Actions**: CI/CD pipeline for automatic deployment
- **ESLint**: Code quality enforcement
- **Environment Variables**: Secure configuration management

## 📁 Project Structure

```
fanta-f1/
├── .github/
│   └── workflows/
│       └── deploy.yml           # GitHub Actions CI/CD pipeline
├── functions/                   # Firebase Cloud Functions
│   ├── index.js                 # Scheduled notification functions
│   └── package.json             # Functions dependencies
├── public/                      # Static assets
│   ├── *.webp                   # Team logos (11 teams, WebP format)
│   ├── FantaF1_Logo*.png        # App logos (multiple sizes)
│   └── FantaF1_Logo*.webp       # App logos (WebP for navbar)
├── src/
│   ├── pages/                   # Route components
│   │   ├── Home.jsx             # Landing page with rules
│   │   ├── Leaderboard.jsx      # Real-time standings + chart
│   │   ├── History.jsx          # Race history viewer
│   │   ├── FormationApp.jsx     # Formation submission
│   │   ├── ChampionshipForm.jsx # Championship predictions
│   │   ├── ParticipantDetail.jsx# Individual participant stats
│   │   ├── RaceResults.jsx      # Race results viewer
│   │   ├── LoginPage.jsx        # Authentication page
│   │   ├── Statistics.jsx       # Global statistics dashboard
│   │   ├── CalculatePoints.jsx  # Points calculation (admin)
│   │   └── AdminPanel.jsx       # Complete admin dashboard
│   ├── components/              # Reusable components
│   │   ├── Navigation.jsx       # Navbar with dark mode toggle
│   │   ├── RaceHistoryCard.jsx  # Unified race result card
│   │   ├── ChampionshipSubmissions.jsx # Championship view
│   │   ├── SubmissionsList.jsx  # Formation list component
│   │   ├── PlayerStatsView.jsx  # Unified player statistics
│   │   ├── AdminRoute.jsx       # Custom claim route protection
│   │   ├── ProtectedRoute.jsx   # Auth route guard
│   │   ├── Footer.jsx           # App footer
│   │   ├── ErrorBoundary.jsx    # Error boundary wrapper
│   │   ├── InstallPwaBanner.jsx # PWA install prompt
│   │   ├── NotificationPromptModal.jsx # Push notification opt-in
│   │   ├── NotificationSettings.jsx    # Notification toggle
│   │   └── CompleteProfileModal.jsx    # Nickname setup modal
│   ├── contexts/                # React Context API
│   │   ├── ThemeContext.jsx     # Dark/light mode state
│   │   ├── LanguageContext.jsx  # i18n language state
│   │   └── AuthContext.jsx      # Firebase auth state
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.js           # Auth state hook
│   │   └── useLanguage.js       # Language hook
│   ├── services/                # Business logic & Firebase
│   │   ├── firebase.js          # Firebase initialization
│   │   ├── notificationService.js # FCM push notification service
│   │   ├── pointsCalculator.js  # Race points calculation engine
│   │   ├── championshipPointsCalculator.js # Championship scoring
│   │   ├── f1DataResolver.js    # Dynamic driver/team resolver
│   │   ├── f1ResultsFetcher.js  # Ergast API integration
│   │   ├── backupService.js     # Backup/restore operations
│   │   ├── statisticsService.js # Statistics calculations
│   │   └── rankingSnapshot.js   # Ranking history tracking
│   ├── data/
│   │   └── f1-data.json         # Manual driver/team database
│   ├── utils/                   # Helper functions
│   │   └── logger.js            # Console logging wrapper (dev-only)
│   ├── constants/               # Configuration
│   │   └── racing.js            # Drivers, teams, points, rules
│   ├── styles/                  # CSS modules
│   │   ├── theme.css            # CSS variables (dark/light)
│   │   ├── App.css              # Global styles
│   │   ├── index.css            # CSS reset
│   │   ├── statistics.css       # Statistics page styles
│   │   └── customSelect.css     # React-select theming
│   ├── sw.js                    # Service worker (Workbox + FCM)
│   ├── App.jsx                  # Main app + routing
│   └── main.jsx                 # React DOM entry point
├── scripts/                     # Utility scripts
│   ├── backup.js                # CLI backup tool
│   ├── restoreBackup.js         # CLI restore tool
│   └── setAdminClaim.js         # Admin privileges script
├── .env.example                 # Environment variables template
├── firebase.json                # Firebase hosting + rules config
├── firestore.rules              # Firestore security rules
├── vite.config.js               # Vite + PWA configuration
└── README.md                    # This file
```

## 🗄️ Database Structure (Firestore)

### Collection: `ranking`
Documents with user ID containing:
```json
{
  "name": "Participant Name",
  "puntiTotali": 125,              // Total points
  "jolly": 2,                      // Available jokers
  "pointsByRace": {                // Points breakdown per race
    "race-id": {
      "mainPts": 22,
      "sprintPts": 8
    }
  },
  "championshipPiloti": ["Driver1", "Driver2", "Driver3"],
  "championshipCostruttori": ["Team1", "Team2", "Team3"],
  "championshipPts": 30,           // Championship points
  "usedLateSubmission": false      // Late submission tracker
}
```

### Collection: `races`
Documents for each race with:
```json
{
  "name": "Australian Grand Prix",
  "round": 1,
  "raceUTC": Timestamp,            // Race start time
  "qualiUTC": Timestamp,           // Qualifying deadline
  "qualiSprintUTC": Timestamp,     // Sprint deadline (optional)
  "hasSprint": true,               // Sprint flag
  "officialResults": {
    "P1": "Driver Name",
    "P2": "Driver Name",
    "P3": "Driver Name",
    "doublePoints": false
  },
  "sprintResults": {               // Optional
    "SP1": "Driver Name",
    "SP2": "Driver Name",
    "SP3": "Driver Name"
  },
  "pointsCalculated": true,
  "cancelledMain": false,          // Race cancellation flag
  "cancelledSprint": false
}
```

#### Subcollection: `races/{raceId}/submissions`
Player formations:
```json
{
  "user": "Participant Name",
  "userId": "user-id",
  "mainP1": "Driver Name",
  "mainP2": "Driver Name",
  "mainP3": "Driver Name",
  "mainJolly": "Driver Name",
  "mainJolly2": "Driver Name",     // Optional (from 29→30)
  "sprintP1": "Driver Name",       // Optional
  "sprintP2": "Driver Name",
  "sprintP3": "Driver Name",
  "sprintJolly": "Driver Name",
  "submittedAt": Timestamp,
  "isLate": false,                 // Late submission flag
  "latePenalty": -3,               // Applied if late
  "pointsEarned": 27,              // Calculated points
  "pointsEarnedSprint": 10
}
```

### Collection: `backups`
Automated and manual backups:
```json
{
  "type": "auto",                  // "auto" | "manual"
  "timestamp": Timestamp,
  "createdBy": "admin",
  "description": "Backup before calculation",
  "races": [...],                  // Full races snapshot
  "ranking": [...],                // Full ranking snapshot
  "championship": {...},           // Championship results
  "metadata": {
    "totalRaces": 24,
    "totalParticipants": 8,
    "appVersion": "2.0"
  }
}
```

### Collection: `rankingSnapshots`
Historical ranking states:
```json
{
  "timestamp": Timestamp,
  "raceId": "australia-2025",      // Associated race
  "type": "after-race",            // "after-race" | "after-championship"
  "rankings": [                    // Full ranking at that moment
    {
      "userId": "user-id",
      "name": "Name",
      "puntiTotali": 125,
      "jolly": 2,
      "position": 1
    }
  ]
}
```

### Collection: `championship`
Championship results:
```json
{
  "results": {
    "P1": "Driver 1",              // Championship winner
    "P2": "Driver 2",
    "P3": "Driver 3",
    "C1": "Constructor 1",         // Constructor champion
    "C2": "Constructor 2",
    "C3": "Constructor 3"
  }
}
```

## 🎯 Game Rules

1. **Deadline**: Formations must be submitted before qualifying starts
2. **Late Submission**: Available within 30-45 minutes window with -3 penalty
3. **No Modifications**: Once submitted, formations cannot be modified (admin can override)
4. **Unique Drivers**: Cannot select duplicate drivers in the same race
5. **Multiple Jokers**: Can use same drivers between main race and sprint
6. **29→30 Rule**: Guessing entire podium (30 points) unlocks 1 extra joker
7. **Race Joker**: Adds 5 fixed points if driver finishes on podium
8. **Sprint Joker**: Adds 2 fixed points if driver finishes on sprint podium
9. **Last Race x2**: All points doubled in final race of season
10. **Cancelled Races**: No points awarded, formations not required

## 🔐 Authentication & Login

The application uses **Firebase Authentication** to manage users securely.
- **Email & Password**: Standard registration and login flow.
- **Google Sign-In**: Faster login directly using Google accounts.
- **Account Linking**: If you register with an email and later sign in with Google using the same email, the app seamlessly links the two credentials to the same user profile so both methods work interchangeably.
- **Unique Nickname Enforcement**: Participants are required to choose a unique nickname upon registration or Google profile completion.
- **Password Reset**: Integrated "Forgot Password" functionality via Firebase's secure email system.

## 👑 Admin Access

Administrators have access to a comprehensive dashboard with full management tools.
Admin privileges are managed securely through **Firebase Custom Claims** (`admin: true`), entirely bypassing the need for a shared configuration password.

### How to make a profile Admin

To grant admin privileges to a user, a special Node.js script must be executed locally by the repository owner. This is a one-time operation for each admin user.

1. **Obtain the Service Account Key**:
   - Go to the **Firebase Console** > **Project Settings** > **Service Accounts**.
   - Click **Generate New Private Key**.
   - Save the downloaded `.json` file exactly as `scripts/serviceAccountKey.json` inside the project directory. *(This file is ignored by git to prevent security leaks).*

2. **Run the admin script**:
   Open a terminal in the project root and run:
   ```bash
   node scripts/setAdminClaim.js <user_email>
   ```

*Note: For the new privileges to take effect, the target user must log out and log back in, or wait up to 1 hour.*

### Admin Privileges

Admins have special powers that bypass normal user restrictions:

#### ✅ Formation Management Bypass
- Submit formations **at any time** (no deadline checks)
- Edit existing formations (pre-fills form with saved data)
- Override late submission penalties
- Submit formations on behalf of other users

#### ✅ Calendar Control
- Modify race dates and times (raceUTC, qualiUTC)
- Change formation deadlines retroactively
- Add/remove sprint races from any weekend
- Mark races as cancelled

#### ✅ Points Calculation
- Fetch automatic results from Ergast F1 API
- Manual result entry with validation
- Recalculate points for any race
- Automatic backups before calculations
- View calculation history and snapshots

#### ✅ Database Management
- Create manual backups with descriptions
- Browse all backups with metadata
- Preview backup contents before restore
- One-click restore with confirmation
- Download backups as JSON files
- Selective reset operations

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Firebase project with Firestore enabled
- Firebase CLI (for deployment)

### Firebase Project Setup (From Scratch)

Before installing the app, you need to create a new Firebase project and configure the required services.

1. **Create a Firebase Project:**
   - Go to the [Firebase Console](https://console.firebase.google.com/).
   - Click **Add project** and follow the steps.
   - Disable Google Analytics if not needed.

2. **Enable Authentication:**
   - In the sidebar, go to **Build > Authentication**.
   - Click **Get Started**.
   - Under the **Sign-in method** tab, add two providers:
     - **Email/Password**: Enable it.
     - **Google**: Enable it. Configure the support email and save.
   - Go to the **Settings** tab (within Authentication), then under **User account linking**, select **Link accounts that use the same email**. This ensures the account linking flow works securely.

3. **Enable Firestore Database:**
   - In the sidebar, go to **Build > Firestore Database**.
   - Click **Create database**.
   - Start in **Test mode** (you can secure rules later) and choose a location close to your users.
   - *Note on Rules*: Once configured, update the rules to secure your data (`users`, `ranking`, `races`, etc.).

4. **Register the Web App:**
   - Go to the **Project Overview** (home icon).
   - Click the **Web** icon (`</>`) to add a Firebase app.
   - Register the app with a nickname (e.g., "Fanta F1 Web").
   - You will see a `firebaseConfig` object containing your keys. Keep this handy for the `.env` file.

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd fanta-f1
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Copy `.env.example` to `.env` and fill in your Firebase credentials:
```bash
cp .env.example .env
```

Edit `.env`:
```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Admin Password
VITE_ADMIN_PASSWORD=your_secure_password

# Push Notifications (Firebase Cloud Messaging)
VITE_FIREBASE_VAPID_KEY=your_vapid_key
```

4. **Run development server**
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Deployment

The project uses **GitHub Actions** for automatic CI/CD deployment.

#### Automatic (CI/CD)
Every push to the `main` branch triggers the deployment pipeline:
1. Builds the app with Vite
2. Deploys to Firebase Hosting
3. Deploys Firestore security rules

Environment variables are managed via **GitHub Secrets**.

#### Manual
```bash
npm run build
firebase deploy --only hosting
```

## 🔔 Push Notifications

The app sends automatic qualifying reminders via **Firebase Cloud Messaging (FCM)**.

### How it works
- **1 hour before** qualifying: first reminder
- **5 minutes before** qualifying: final reminder
- **Night sessions** (qualifying after midnight CET): reminder sent at 21:00 the evening before

### User opt-in
- Users are prompted to enable notifications when the PWA is first installed
- Notifications can be toggled on/off from the user menu (⚙️ Notification Settings)
- Requires the app to be installed as a PWA (browser push not supported)

### Technical details
- **Firebase Cloud Functions** run on a schedule to send notifications
- **Service Worker** (`src/sw.js`) handles background message delivery via Workbox + FCM
- Token management and permission handling in `src/services/notificationService.js`

## 📲 Progressive Web App (PWA)

FantaF1 is a fully installable PWA:

- **Installable** on Android, iOS, and desktop (Chrome, Safari, Edge)
- **Offline-capable** via Workbox service worker with precaching
- **Auto-update**: New versions are detected and applied automatically
- **Custom install banner**: Guides users through installation on both Android (native prompt) and iOS (manual Add to Home Screen)
- **Splash screen**: SVG logo animation with theme-aware loading screen

## 🔧 Configuration

### Points System
Edit `src/constants/racing.js` to customize:
- Points per position (main race, sprint)
- Joker bonuses
- Late submission penalty
- Deadlines and grace periods

### F1 Data
- **Automatic**: Drivers and teams sync from Ergast API (cached 72h)
- **Manual**: Edit `src/data/f1-data.json` for custom drivers/teams
- **Logos**: Add team logos to `public/` directory (WebP format, max 128x128px)

### Theme Colors
Customize in `src/styles/theme.css`:
- Primary color (red)
- Dark mode palette
- Accent colors

## 📊 Analytics & Monitoring

The app includes comprehensive logging and monitoring:

- **Development Logs**: Detailed console logs (auto-disabled in production)
- **Error Tracking**: All errors logged with context
- **Performance**: Firestore query optimization
- **Backup History**: Full audit trail of all operations

## 🐛 Troubleshooting

### Common Issues

**Formation not saving**
- Check browser console for errors
- Verify Firebase connection
- Ensure all required fields are filled

**Points not calculating**
- Verify official results are entered in admin panel
- Check for cancelled races
- Ensure race deadline has passed

**Dark mode not persisting**
- Check localStorage permissions
- Clear browser cache
- Verify ThemeContext is properly initialized

**API sync failing**
- Check Ergast API status (api.jolpi.ca/ergast)
- Verify internet connection
- Clear localStorage cache: `localStorage.clear()`

## 🤝 Contributing

This is a private project for personal use. If you have suggestions or find bugs:
1. Open an issue with detailed description
2. Include browser console logs
3. Specify steps to reproduce

## 📄 License

Private use - All rights reserved

## 👨‍💻 Author

Project developed to manage F1 fantasy league among friends.

Built with ❤️ for Formula 1 enthusiasts.

---

## 📝 Changelog

### Version 2.2 (Current)
- ✅ **Performance**: Converted all images to WebP format (~95% size reduction)
- ✅ **Performance**: Resized PWA icons (512px, 192px) from original 1.1MB logo
- ✅ **Performance**: Added lazy loading to below-the-fold team logo images
- ✅ **Performance**: Added preconnect/dns-prefetch hints for Firebase services
- ✅ **Performance**: Removed MUI dependency (replaced 5 icons with inline SVGs)
- ✅ **Performance**: Added `useMemo` for chart data in Statistics page
- ✅ **Performance**: Separated recharts into dedicated chunk for lazy loading
- ✅ **Performance**: Set ES2020 build target for smaller bundle output
- ✅ **UX**: Added SVG path animation splash screen with theme-aware loading
- ✅ **Docs**: Updated README with Push Notifications, PWA, CI/CD, Cloud Functions docs
- ✅ **Docs**: Updated project structure to reflect all components and services
- ✅ Added `claude.md` and `CLAUDE.md` to `.gitignore`

### Version 2.1 (2026 Season)
- ✅ Updated to 2026 F1 season grid (11 teams, 22 drivers)
- ✅ New teams: Audi (ex-Sauber), Cadillac (11th team)
- ✅ Racing Bulls rebrand (ex-VCARB)
- ✅ New drivers: Arvid Lindblad, Sergio Pérez (Cadillac), Valtteri Bottas (Cadillac)
- ✅ Updated driver numbers (Norris #1, Verstappen #3, etc.)

### Version 2.0
- ✅ Complete admin panel redesign
- ✅ Backup & restore system
- ✅ Automatic result fetching from Ergast API
- ✅ Ranking snapshots after each calculation
- ✅ Statistics dashboard
- ✅ Participant detail view
- ✅ Late submission system with penalties
- ✅ Race cancellation support
- ✅ Dynamic driver/team resolution
- ✅ Multi-language support (i18n)
- ✅ Dark mode improvements
- ✅ Mobile responsiveness
- ✅ All code comments in English
- ✅ Removed notification system (deprecated)

### Version 1.0
- Initial release with basic features

---

**🏁 Good race and may the best win! 🏆**
