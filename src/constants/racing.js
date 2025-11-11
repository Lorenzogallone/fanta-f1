// src/constants/racing.js
// Centralizzazione di tutte le costanti relative a piloti, team e punteggi
// per evitare duplicazione in più componenti

/* ==================== PILOTI ==================== */
export const DRIVERS = [
  "Lando Norris",
  "Oscar Piastri",
  "Max Verstappen",
  "Charles Leclerc",
  "Lewis Hamilton",
  "George Russell",
  "Andrea Kimi Antonelli",
  "Yuki Tsunoda",
  "Fernando Alonso",
  "Lance Stroll",
  "Pierre Gasly",
  "Franco Colapinto",
  "Oliver Bearman",
  "Esteban Ocon",
  "Nico Hülkenberg",
  "Gabriel Bortoleto",
  "Liam Lawson",
  "Isack Hadjar",
  "Alexander Albon",
  "Carlos Sainz Jr.",
];

/* ==================== COSTRUTTORI ==================== */
export const CONSTRUCTORS = [
  "Red Bull",
  "Ferrari",
  "Mercedes",
  "McLaren",
  "Aston Martin",
  "Alpine",
  "Haas",
  "Sauber",
  "Vcarb",
  "Williams",
];

/* ==================== MAPPING PILOTA → TEAM ==================== */
export const DRIVER_TEAM = {
  "Max Verstappen": "Red Bull",
  "Yuki Tsunoda": "Red Bull",
  "Charles Leclerc": "Ferrari",
  "Lewis Hamilton": "Ferrari",
  "George Russell": "Mercedes",
  "Andrea Kimi Antonelli": "Mercedes",
  "Lando Norris": "McLaren",
  "Oscar Piastri": "McLaren",
  "Fernando Alonso": "Aston Martin",
  "Lance Stroll": "Aston Martin",
  "Pierre Gasly": "Alpine",
  "Franco Colapinto": "Alpine",
  "Oliver Bearman": "Haas",
  "Esteban Ocon": "Haas",
  "Nico Hülkenberg": "Sauber",
  "Gabriel Bortoleto": "Sauber",
  "Liam Lawson": "Vcarb",
  "Isack Hadjar": "Vcarb",
  "Alexander Albon": "Williams",
  "Carlos Sainz Jr.": "Williams",
};

/* ==================== LOGHI TEAM (percorsi in /public) ==================== */
export const TEAM_LOGOS = {
  Ferrari: "/ferrari.png",
  Mercedes: "/mercedes.png",
  "Red Bull": "/redbull.png",
  McLaren: "/mclaren.png",
  "Aston Martin": "/aston.png",
  Alpine: "/alpine.png",
  Haas: "/haas.png",
  Williams: "/williams.png",
  Sauber: "/sauber.png",
  Vcarb: "/vcarb.png",
};

/* ==================== SISTEMA PUNTEGGI ==================== */
export const POINTS = {
  // Punti per posizione in gara principale
  MAIN: {
    1: 12,
    2: 10,
    3: 8,
  },

  // Punti per posizione in sprint
  SPRINT: {
    1: 8,
    2: 6,
    3: 4,
  },

  // Bonus jolly (indipendente dalla posizione, se finisce sul podio)
  BONUS_JOLLY_MAIN: 5,
  BONUS_JOLLY_SPRINT: 2,

  // Penalità formazione vuota
  PENALTY_EMPTY_LIST: -3,
};

/* ==================== COSTANTI TEMPORALI ==================== */
export const TIME_CONSTANTS = {
  // Minuti di grace period dopo la gara per inserire risultati
  GRACE_PERIOD_MINUTES: 90,
};
