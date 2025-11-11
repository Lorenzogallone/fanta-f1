# 🏎️ Fanta F1

Un'applicazione web per gestire il fantacalcio di Formula 1 tra amici.

## 🎮 Cos'è Fanta F1?

Fanta F1 è un gioco fantasy basato sul campionato mondiale di Formula 1. Ogni partecipante schiera una formazione di piloti per ogni gara e accumula punti in base alle loro prestazioni reali in pista.

## 📋 Come Funziona

### Formazione Gara
Per ogni Gran Premio, ogni giocatore seleziona:
- **3 Piloti (P1, P2, P3)**: I piloti che si pensa finiranno nelle prime posizioni
- **1 Jolly**: Un pilota bonus che raddoppia i punti ottenuti
- **1 Jolly 2 (opzionale)**: Un secondo jolly disponibile dopo 29 punti totali

### Sprint Race
Per i weekend con Sprint Race, si può schierare una formazione separata con:
- 3 Piloti Sprint (SP1, SP2, SP3)
- 1 Jolly Sprint

### Formazione Campionato
Prima dell'inizio della stagione, ogni giocatore pronostica:
- **Top 3 Piloti** del campionato mondiale
- **Top 3 Costruttori** del campionato mondiale

I punti vengono assegnati a fine stagione in base alla correttezza delle previsioni.

## 🏆 Sistema di Punteggio

### Punti per Posizione (Gara Principale)
- **1° posto**: 25 punti
- **2° posto**: 18 punti
- **3° posto**: 15 punti
- **4° posto**: 12 punti
- **5° posto**: 10 punti
- **6°-10° posto**: 8, 6, 4, 2, 1 punti

### Punti Sprint
- **1° posto**: 8 punti
- **2° posto**: 7 punti
- **3° posto**: 6 punti
- E così via...

### Bonus Jolly
- Il pilota scelto come **Jolly** raddoppia i punti ottenuti
- Il **Jolly 2** si sblocca quando un giocatore raggiunge 30 punti totali
- I jolly sono indipendenti tra gara principale e sprint

### Punteggio Campionato
Punti bonus assegnati a fine stagione per previsioni corrette su piloti e costruttori.

## 🖥️ Funzionalità dell'App

### 📊 Classifica
Visualizza la classifica in tempo reale con:
- Posizione e punti totali
- Distacco dal leader
- Jolly disponibili

### 🏁 Storico Gare
Consulta i risultati delle gare passate:
- Risultati ufficiali della gara
- Formazioni schierate da ogni giocatore
- Punti ottenuti per gara

### 🎯 Schiera Formazione
Inserisci la tua formazione per la prossima gara:
- Selezione guidata con loghi dei team
- Validazione anti-duplicati
- Anteprima della formazione
- Supporto per sprint race

### 📅 Formazioni Campionato
Pronostica i top 3 piloti e costruttori prima dell'inizio della stagione.

### ⚙️ Pannello Admin
Gli amministratori possono:
- Gestire i partecipanti
- Inserire formazioni per altri giocatori
- Calcolare i punteggi delle gare
- Gestire il calendario
- Backup e reset del database

## 🎨 Caratteristiche

- ✅ **Design Minimal**: Stile pulito bianco/nero/rosso
- 🌓 **Dark Mode**: Supporto completo per tema scuro
- 📱 **Responsive**: Ottimizzato per desktop e mobile
- ⚡ **Real-time**: Aggiornamenti live tramite Firebase
- 🔒 **Sicuro**: Pannello admin protetto da password

## 🛠️ Stack Tecnologico

- **Frontend**: React 19.1.0 + React Bootstrap 2.10.10
- **Backend**: Firebase/Firestore (NoSQL database)
- **Routing**: React Router v7
- **UI Components**: Material-UI, React-Select
- **Build**: Vite 6.3.5
- **Deploy**: Firebase Hosting

## 🚀 Setup e Installazione

### Prerequisiti
- Node.js 18+
- npm o yarn
- Account Firebase

### Installazione

```bash
# Clona il repository
git clone <repository-url>
cd fanta-f1

# Installa le dipendenze
npm install

# Configura Firebase
# Crea un progetto Firebase e aggiungi le credenziali in src/firebase.js

# Avvia in modalità sviluppo
npm run dev

# Build per produzione
npm run build

# Deploy su Firebase
firebase deploy
```

### Configurazione Firebase

Crea un file `src/firebase.js` con le tue credenziali:

```javascript
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

## 📁 Struttura del Progetto

```
fanta-f1/
├── public/               # Loghi team e asset statici
├── src/
│   ├── components/       # Componenti riutilizzabili
│   ├── constants/        # Costanti centralizzate (piloti, team)
│   ├── utils/           # Utility per calcolo punteggi
│   ├── App.jsx          # Componente principale
│   ├── Navigation.jsx   # Navbar con dark mode toggle
│   ├── Home.jsx         # Homepage
│   ├── Leaderboard.jsx  # Classifica
│   ├── History.jsx      # Storico gare
│   ├── FormationApp.jsx # Schiera formazione
│   ├── ChampionshipForm.jsx  # Formazioni campionato
│   ├── CalculatePoints.jsx   # Calcolo punteggi (admin)
│   ├── AdminPanel.jsx   # Pannello amministrazione
│   ├── ThemeContext.jsx # Gestione dark/light mode
│   ├── theme.css        # Variabili CSS per temi
│   └── firebase.js      # Configurazione Firebase
├── scripts_calendar/    # Script per importare calendario gare
└── README.md
```

## 🗄️ Struttura Database (Firestore)

### Collection: `ranking`
Documenti con ID utente contenenti:
- `name`: Nome del partecipante
- `puntiTotali`: Punti totali accumulati
- `jolly`: Numero di jolly disponibili
- `pointsByRace`: Oggetto con punteggi per gara
- `championshipPiloti`: Array con i 3 piloti pronosticati
- `championshipCostruttori`: Array con i 3 costruttori pronosticati
- `championshipPts`: Punti campionato

### Collection: `races`
Documenti per ogni gara con:
- `name`: Nome del Gran Premio
- `round`: Numero della gara
- `raceUTC`: Timestamp della gara
- `qualiSprintUTC`: Timestamp sprint (se presente)
- `officialResults`: Array con risultati ufficiali
- `sprintResults`: Array con risultati sprint
- `pointsCalculated`: Boolean

#### Subcollection: `submissions`
Per ogni gara, contiene le formazioni dei giocatori:
- `user`, `userId`: Identificativo utente
- `mainP1`, `mainP2`, `mainP3`, `mainJolly`, `mainJolly2`: Formazione principale
- `sprintP1`, `sprintP2`, `sprintP3`, `sprintJolly`: Formazione sprint
- `submittedAt`: Timestamp di invio

## 🎯 Regole del Gioco

1. **Deadline**: Le formazioni devono essere inviate prima dell'inizio delle qualifiche
2. **No Modifiche**: Una volta inviata, la formazione non può essere modificata
3. **Piloti Unici**: Non si possono selezionare piloti duplicati nella stessa gara
4. **Jolly Multipli**: Si possono usare gli stessi piloti tra gara principale e sprint
5. **Regola 29→30**: Il Jolly 2 si sblocca al raggiungimento di 30 punti totali

## 🔐 Accesso Admin

Il pannello admin è protetto da password. La password predefinita è configurata in `src/AdminPanel.jsx`:

```javascript
const ADMIN_PASSWORD = "SUCASOLERA";
```

**⚠️ Importante**: Cambia questa password prima del deploy in produzione!

## 🤝 Contribuire

Questo è un progetto privato per uso personale. Se hai suggerimenti o trovi bug, contatta il maintainer.

## 📄 Licenza

Uso privato - Tutti i diritti riservati

## 👨‍💻 Autore

Progetto sviluppato per gestire il fantacalcio F1 tra amici.

---

**🏁 Buona gara e che vinca il migliore! 🏆**
