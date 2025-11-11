# 🏎️ Fanta F1

Un'applicazione web per gestire il fantacalcio di Formula 1 tra amici.

## 🎮 Cos'è Fanta F1?

Fanta F1 è un gioco fantasy basato sul campionato mondiale di Formula 1. Ogni partecipante schiera una formazione di piloti per ogni gara e accumula punti in base alle loro prestazioni reali in pista.

## 📋 Come Funziona

### Formazione Gara
Per ogni Gran Premio, ogni giocatore **schiera la formazione prima dell'inizio della gara**:
- **3 Piloti (P1, P2, P3)**: Pronostico dei primi 3 classificati in ordine
- **1 Jolly**: Un pilota bonus che garantisce 5 punti extra se finisce sul podio
- **1 Jolly 2 (opzionale)**: Secondo jolly sbloccabile con la regola 29→30

### Sprint Race
Per i weekend con Sprint Race, si può schierare una formazione separata:
- **3 Piloti Sprint (SP1, SP2, SP3)**: Pronostico podio sprint
- **1 Jolly Sprint**: Bonus di 5 punti se finisce sul podio sprint
- Puoi usare gli stessi piloti della gara principale

### Formazione Campionato
**A metà stagione**, ogni giocatore pronostica:
- **Top 3 Piloti** del campionato mondiale piloti
- **Top 3 Costruttori** del campionato mondiale costruttori

I punti vengono assegnati a fine stagione con lo stesso sistema delle gare.

## 🏆 Sistema di Punteggio

### Punti Gara Principale
**Solo i primi 3 classificati assegnano punti:**
- **Indovini il 1° classificato (P1)**: 12 punti
- **Indovini il 2° classificato (P2)**: 10 punti
- **Indovini il 3° classificato (P3)**: 8 punti

### Punti Sprint
**Solo i primi 3 classificati assegnano punti:**
- **Indovini il 1° classificato (SP1)**: 8 punti
- **Indovini il 2° classificato (SP2)**: 6 punti
- **Indovini il 3° classificato (SP3)**: 4 punti

### Bonus Jolly
- Il **Jolly** dà **5 punti fissi** se il pilota scelto finisce sul podio (top 3), **indipendentemente dalla posizione**
- Il **Jolly 2** funziona allo stesso modo (5 punti se sul podio)
- Jolly gara principale e sprint sono indipendenti

### Regola Speciale: 29→30
- Se indovini tutto il podio in ordine (12+10+8 = 30 punti totali), guadagni **1 jolly extra** da usare in una gara futura
- Vale sia per gara principale che per sprint
- Vale anche per la formazione campionato

### Punteggio Campionato
A fine stagione, si assegnano gli stessi punti delle gare:
- Indovini il 1° pilota/costruttore: 12 punti
- Indovini il 2° pilota/costruttore: 10 punti
- Indovini il 3° pilota/costruttore: 8 punti
- Anche qui vale la regola 29→30!

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
Pronostica i top 3 piloti e costruttori a metà stagione per guadagnare punti bonus a fine anno.

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

1. **Deadline**: Le formazioni devono essere inviate prima dell'inizio della gara
2. **No Modifiche**: Una volta inviata, la formazione non può essere modificata
3. **Piloti Unici**: Non si possono selezionare piloti duplicati nella stessa gara
4. **Jolly Multipli**: Si possono usare gli stessi piloti tra gara principale e sprint
5. **Regola 29→30**: Indovinando tutto il podio (30 punti), si sblocca 1 jolly extra
6. **Jolly = 5 punti**: Il jolly non raddoppia i punti, ma aggiunge sempre 5 punti fissi se il pilota finisce sul podio

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
