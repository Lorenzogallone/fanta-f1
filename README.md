# 🏎️ Fanta F1

A web application to manage Formula 1 fantasy league among friends.

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

### 🏁 Race History
Check past race results:
- Official race results
- Formations submitted by each player
- Points earned per race

### 🎯 Submit Formation
Enter your formation for the next race:
- Guided selection with team logos
- Anti-duplicate validation
- Formation preview
- Sprint race support

### 📅 Championship Formations
Predict the top 3 drivers and constructors mid-season to earn bonus points at year's end.

### ⚙️ Admin Panel
Administrators have full access to all features:

**👥 Participant Management**
- Add new participants
- Modify points and jokers for each participant
- Delete participants

**📝 Formation Management**
- **Submit late formations** for any user (bypass deadline)
- **Edit existing formations** even after deadline
- View which races already have formations submitted
- Works for main races, sprints, and championship formations

**📅 Calendar Management**
- **Modify race dates and times** (raceUTC, qualiUTC)
- **Modify formation deadlines** (qualiUTC and qualiSprintUTC)
- Add or remove sprint from a race
- View results status for each race

**🗑️ Database Reset**
- Complete database backup (download JSON)
- Reset formations (delete all submissions)
- Reset scores (zero points keeping participants)
- Complete reset (scores + formations)

## 🎨 Features

- ✅ **Minimal Design**: Clean white/black/red style
- 🌓 **Dark Mode**: Full dark theme support
- 📱 **Responsive**: Optimized for desktop and mobile
- ⚡ **Real-time**: Live updates via Firebase
- 🔒 **Secure**: Admin panel protected by password

## 🛠️ Tech Stack

- **Frontend**: React 19.1.0 + React Bootstrap 2.10.10
- **Backend**: Firebase/Firestore (NoSQL database)
- **Routing**: React Router v7
- **UI Components**: Material-UI, React-Select
- **Build**: Vite 6.3.5
- **Deploy**: Firebase Hosting

## 📁 Project Structure

```
fanta-f1/
├── public/                   # Team logos and static assets
├── src/
│   ├── pages/                # Page components (routes)
│   │   ├── Home.jsx          # Homepage
│   │   ├── History.jsx       # Race history
│   │   ├── Leaderboard.jsx   # Standings
│   │   ├── FormationApp.jsx  # Submit formation
│   │   ├── ChampionshipForm.jsx # Championship formations
│   │   ├── CalculatePoints.jsx  # Points calculation (admin)
│   │   └── AdminPanel.jsx    # Administration panel
│   ├── components/           # Reusable components
│   │   ├── Navigation.jsx    # Navbar with dark mode toggle
│   │   ├── RaceHistoryCard.jsx # Unified race card
│   │   ├── ChampionshipSubmissions.jsx
│   │   └── SubmissionsList.jsx
│   ├── contexts/             # React Context providers
│   │   └── ThemeContext.jsx  # Dark/light mode management
│   ├── services/             # Backend services and calculations
│   │   ├── firebase.js       # Firebase configuration
│   │   ├── pointsCalculator.js # Race points calculation
│   │   └── championshipPointsCalculator.js
│   ├── utils/                # Utility functions
│   │   └── pointsCalculation.js
│   ├── constants/            # Centralized constants
│   │   └── racing.js         # Drivers, teams, scores
│   ├── styles/               # CSS files
│   │   ├── theme.css         # CSS dark/light variables
│   │   ├── App.css           # Global styles
│   │   ├── index.css         # Reset and base
│   │   └── customSelect.css  # React-select styles
│   ├── App.jsx               # Main component + routing
│   └── main.jsx              # Application entry point
├── scripts_calendar/         # Scripts to import race calendar
└── README.md
```

## 🗄️ Database Structure (Firestore)

### Collection: `ranking`
Documents with user ID containing:
- `name`: Participant name
- `puntiTotali`: Total accumulated points
- `jolly`: Number of available jokers
- `pointsByRace`: Object with points per race
- `championshipPiloti`: Array with 3 predicted drivers
- `championshipCostruttori`: Array with 3 predicted constructors
- `championshipPts`: Championship points

### Collection: `races`
Documents for each race with:
- `name`: Grand Prix name
- `round`: Race number
- `raceUTC`: Race timestamp
- `qualiSprintUTC`: Sprint timestamp (if present)
- `officialResults`: Array with official results
- `sprintResults`: Array with sprint results
- `pointsCalculated`: Boolean

#### Subcollection: `submissions`
For each race, contains player formations:
- `user`, `userId`: User identifier
- `mainP1`, `mainP2`, `mainP3`, `mainJolly`, `mainJolly2`: Main formation
- `sprintP1`, `sprintP2`, `sprintP3`, `sprintJolly`: Sprint formation
- `submittedAt`: Submission timestamp

## 🎯 Game Rules

1. **Deadline**: Formations must be submitted before the race starts
2. **No Modifications**: Once submitted, the formation cannot be modified
3. **Unique Drivers**: You cannot select duplicate drivers in the same race
4. **Multiple Jokers**: You can use the same drivers between main race and sprint
5. **29→30 Rule**: By guessing the entire podium (30 points), you unlock 1 extra joker
6. **Race joker = 5 points**: The race joker doesn't double points, but adds 5 fixed points if on podium
7. **Sprint joker = 2 points**: The sprint joker adds 2 fixed points if the driver finishes on the sprint podium
8. **Last race x2**: In the last race of the season, all points are doubled

## 🔐 Admin Access

The admin panel is password-protected and offers special privileges:

### Password
The password is configured in `src/pages/AdminPanel.jsx`:
Since it's just a friend game it's based on mutual trust, it's just a very basic safety measure.

### Admin Privileges

Admins have special powers that normal users don't have:

1. **✅ Formation Deadline Bypass**
   - Admins can submit formations **at any time**
   - There are no deadline checks (qualiUTC, qualiSprintUTC)
   - Normal users are blocked after the deadline

2. **✅ Edit Existing Formations**
   - Admins can modify already submitted formations
   - When selecting user+race, the form pre-fills if it already exists
   - Saving overwrites the previous formation

3. **✅ Modify Race Dates**
   - Admins can change formation deadlines
   - They can postpone or bring forward qualifying and races
   - They can add/remove sprints

4. **✅ Full Database Management**
   - Complete backup before critical operations
   - Selective reset (only formations or only scores)
   - Complete system status visualization

## 🤝 Contributing

This is a private project for personal use. If you have suggestions or find bugs, contact the maintainer.

## 📄 License

Private use - All rights reserved

## 👨‍💻 Author

Project developed to manage F1 fantasy league among friends.

---

**🏁 Good race and may the best win! 🏆**
