/**
 * Carica formazioni + punti delle prime 4 gare 2025
 *   Australia · Cina · Giappone · Bahrain
 * Ora salva in ranking per ogni utente un oggetto pointsByRace con i punteggi “main + sprint”
 * e aggiorna ‘puntiTotali’ ricalcolandolo come somma di tutti i singoli valori in pointsByRace.
 *
 * IMPORTANT: prima di lanciare
 *   1) npm i firebase-admin
 *   2) imposta GOOGLE_APPLICATION_CREDENTIALS
 *      oppure sostituisci la lettura di serviceAccount con path al tuo JSON
 */

import fs from "fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  await fs.readFile(new URL("./serviceAccount.json", import.meta.url), "utf8")
);
initializeApp({
  credential: cert(serviceAccount),
});
const db = getFirestore();

/* ─────────────────────────────────────────────────────────────── */
/*    MAPPINGS                                                     */
/* ─────────────────────────────────────────────────────────────── */

// slug documento gara  ➜   riga del foglio
const raceSlug = {
  aus: "gran-premio-d-australia",
  chn: "gran-premio-di-cina",
  jpn: "gran-premio-del-giappone",
  bhr: "gran-premio-del-bahrein",
  saudi: "gran-premio-dell-arabia-saudita",
  miami: "gran-premio-di-miami",
  imo: "gran-premio-dell-emilia-romagna",
  mon: "gran-premio-di-monaco",
  spa: "gran-premio-di-spagna",
};

// soprannome scritto nel foglio  ➜  id documento in /ranking
const playerId = {
  chiaretta: "chiaretta",
  vitto: "vitto",
  ale: "ale",
  albi: "albi",
  "riki m.": "riki-m",
  matte: "matte",
  "steu p.": "steu-p",
  gallo: "gallo",
  dave: "dave",
  baba: "baba",
  casetz: "casetz",
  helmut: "helmut",
  fede: "fede",
  raffaele: "raffaele",
  sbin: "sbin",
};

// sigla  ➜  nome pilota
const drv = {
  Nor: "Lando Norris",
  Pia: "Oscar Piastri",
  Lec: "Charles Leclerc",
  Ver: "Max Verstappen",
  Rus: "George Russell",
  Ham: "Lewis Hamilton",
  Ant: "Andrea Kimi Antonelli",
  Alo: "Fernando Alonso",
  Str: "Lance Stroll",
  Gas: "Pierre Gasly",
  Col: "Franco Colapinto",
  Bea: "Oliver Bearman",
  Oco: "Esteban Ocon",
  Hul: "Nico Hülkenberg",
  Bor: "Gabriel Bortoleto",
  Law: "Liam Lawson",
  Had: "Isack Hadjar",
  Alb: "Alexander Albon",
  Sai: "Carlos Sainz Jr.",
  // Varianti maiuscole
  RUS: "George Russell",
  HUL: "Nico Hülkenberg"
};

/* ─────────────────────────────────────────────────────────────── */
/*    DATI UFFICIALI (da sostituire con i risultati reali)         */
/* ─────────────────────────────────────────────────────────────── */
const officialResults = {
      aus: {
    P1: "Lando Norris",
    P2: "Max Verstappen",
    P3: "George Russell",
    doublePoints: false,
    savedAt: new Date(),
  },
  chn: {
    P1: "Oscar Piastri",
    P2: "Lando Norris",
    P3: "George Russell",
    SP1: "Lewis Hamilton",
    SP2: "Oscar Piastri",
    SP3: "Max Verstappen",
    doublePoints: false,
    savedAt: new Date(),
  },
  jpn: {
    P1: "Max Verstappen",
    P2: "Lando Norris",
    P3: "Oscar Piastri",
    doublePoints: false,
    savedAt: new Date(),
  },
  bhr: {
    P1: "Oscar Piastri",
    P2: "George Russell",
    P3: "Lando Norris",
    doublePoints: false,
    savedAt: new Date(),
  },
  saudi: {
    P1: "Oscar Piastri",
    P2: "Max Verstappen",
    P3: "Charles Leclerc",
    doublePoints: false,
    savedAt: new Date(),
  },
  miami: {
    P1: "Oscar Piastri",
    P2: "Lando Norris",
    P3: "George Russell",
    SP1: "Lando Norris",
    SP2: "Oscar Piastri",
    SP3: "Lewis Hamilton",
    doublePoints: false,
    savedAt: new Date(),
  },
  imo: {
    P1: "Max Verstappen",
    P2: "Lando Norris",
    P3: "Oscar Piastri",
    doublePoints: false,
    savedAt: new Date(),
  },
  mon: {
    P1: "Lando Norris",
    P2: "Charles Leclerc",
    P3: "Oscar Piastri",
    doublePoints: false,
    savedAt: new Date(),
  },
  spa: {
    P1: "Oscar Piastri",
    P2: "Lando Norris",
    P3: "Charles Leclerc",
    doublePoints: false,
    savedAt: new Date(),
  },
};

/* ─────────────────────────────────────────────────────────────── */
/*    DATI FORMAZIONI + PUNTI                                      */
/*    (i “-3” indicano assenza di submission)                      */
/* ─────────────────────────────────────────────────────────────── */

export const data = {
    aus: [
    // Australia 16/03 🇦🇺
    { n: "Chiaretta", pts: -3 },
    { n: "Vitto", p1: "Lec", p2: "Pia", p3: "Nor", j: "Ham", pts: 0 },
    { n: "Ale", p1: "Lec", p2: "Nor", p3: "Ver", j: "Ham", pts: 0 },
    { n: "Albi", p1: "Nor", p2: "Lec", p3: "Pia", j: "Ham", pts: 12 },
    { n: "Riki M.", p1: "Ham", p2: "Lec", p3: "Pia", j: "Nor", pts: 5 },
    { n: "Matte", p1: "Nor", p2: "Lec", p3: "Pia", j: "Ver", pts: 17 },
    { n: "Steu P.", p1: "Lec", p2: "Pia", p3: "Ham", j: "Nor", pts: 5 },
    { n: "Gallo", p1: "Nor", p2: "Lec", p3: "Pia", j: "Rus", pts: 17 },
    { n: "Dave", p1: "Nor", p2: "Lec", p3: "Ver", j: "Pia", pts: 12 },
    { n: "Baba", p1: "Lec", p2: "Nor", p3: "Ham", j: "Ver", pts: 5 },
    { n: "Casetz", p1: "Lec", p2: "Nor", p3: "Ham", j: "Ver", pts: 5 },
    { n: "Helmut", p1: "Nor", p2: "Ver", p3: "Pia", j: "Ham", pts: 22 },
    { n: "Fede", p1: "Lec", p2: "Nor", p3: "Pia", j: "Ver", pts: 5 },
    { n: "Raffaele", p1: "Lec", p2: "Nor", p3: "Pia", j: "Ham", pts: 0 },
    { n: "Sbin", pts: -3 },
  ],

  chn: [
    // Cina 22–23/03 🇨🇳 (main + sprint)
    {
      n: "Chiaretta",
      p1: "Nor",
      p2: "Pia",
      p3: "Ver",
      j: "Ham",
      pts: 0,
      p1_sp: "Nor",
      p2_sp: "Pia",
      p3_sp: "Rus",
      j_sp: "Ver",
      pts_sp: 8,
    },
    {
      n: "Vitto",
      p1: "Nor",
      p2: "Pia",
      p3: "Ham",
      j: "Ver",
      pts: 0,
      p1_sp: "Ver",
      p2_sp: "Pia",
      p3_sp: "Rus",
      j_sp: "Nor",
      pts_sp: 6,
    },
    {
      n: "Ale",
      p1: "Ham",
      p2: "Pia",
      p3: "Nor",
      j: "Ver",
      pts: 0,
      p1_sp: "Nor",
      p2_sp: "Pia",
      p3_sp: "Lec",
      j_sp: "Rus",
      pts_sp: 6,
    },
    {
      n: "Albi",
      pts: -3, // main assente
      p1_sp: "Nor",
      p2_sp: "Pia",
      p3_sp: "Ver",
      j_sp: "Ham",
      pts_sp: 12,
    },
    {
      n: "Riki M.",
      p1: "Nor",
      p2: "Pia",
      p3: "Ver",
      j: "Ham",
      pts: 0,
      pts_sp: -3, // sprint assente
    },
    {
      n: "Matte",
      p1: "Ver",
      p2: "Pia",
      p3: "Lec",
      j: "Ham",
      pts: 0,
      pts_sp: -3,
    },
    {
      n: "Steu P.",
      p1: "Ham",
      p2: "Nor",
      p3: "Lec",
      j: "Ver",
      pts: 10,
      p1_sp: "Nor",
      p2_sp: "Pia",
      p3_sp: "Ver",
      j_sp: "Lec",
      pts_sp: 10,
    },
    {
      n: "Gallo",
      p1: "Ham",
      p2: "Nor",
      p3: "Ver",
      j: "Lec",
      pts: 10,
      pts_sp: -3,
    },
    {
      n: "Dave",
      p1: "Pia",
      p2: "Nor",
      p3: "Ver",
      j: "Ham",
      pts: 22,
      p1_sp: "Nor",
      p2_sp: "Pia",
      p3_sp: "Lec",
      j_sp: "Ver",
      pts_sp: 8,
    },
    {
      n: "Baba",
      p1: "Ham",
      p2: "Nor",
      p3: "Pia",
      j: "Lec",
      pts: 10,
      pts_sp: -3,
    },
    {
      n: "Casetz",
      p1: "Ham",
      p2: "Nor",
      p3: "Pia",
      j: "Ver",
      pts: 10,
      p1_sp: "Nor",
      p2_sp: "Rus",
      p3_sp: "Pia",
      j_sp: "Ver",
      pts_sp: 2,
    },
    {
      n: "Helmut",
      p1: "Nor",
      p2: "Ver",
      p3: "Ham",
      j: "Pia",
      pts: 5,
      p1_sp: "Nor",
      p2_sp: "Ver",
      p3_sp: "Lec",
      j_sp: "Pia",
      pts_sp: 2,
    },
    {
      n: "Fede",
      p1: "Nor",
      p2: "Ver",
      p3: "Ham",
      j: "Lec",
      pts: 0,
      p1_sp: "Nor",
      p2_sp: "Pia",
      p3_sp: "Ver",
      j_sp: "Lec",
      pts_sp: 10,
    },
    {
      n: "Raffaele",
      p1: "Ham",
      p2: "Nor",
      p3: "Pia",
      j: "Ver",
      pts: 10,
      p1_sp: "Nor",
      p2_sp: "Pia",
      p3_sp: "Lec",
      j_sp: "Ver",
      pts_sp: 8,
    },
    {
      n: "Sbin",
      p1: "Pia",
      p2: "Ham",
      p3: "Ver",
      j: "Nor",
      pts: 17,
      p1_sp: "Nor",
      p2_sp: "Rus",
      p3_sp: "Pia",
      j_sp: "Ver",
      pts_sp: 2,
    },
  ],

  jpn: [
    // Giappone 06/04 🇯🇵 (senza sprint)
    { n: "Chiaretta", p1: "Nor", p2: "Pia", p3: "Ver", j: "Rus", pts: 0 },
    { n: "Vitto", pts: -3 },
    { n: "Ale", p1: "Nor", p2: "Pia", p3: "Rus", j: "Ver", pts: 5 },
    { n: "Albi", p1: "Nor", p2: "Pia", p3: "Ver", j: "Rus", pts: 0 },
    { n: "Riki M.", p1: "Pia", p2: "Nor", p3: "Ham", j: "Ver", pts: 15 },
    { n: "Matte", pts: -3 },
    { n: "Steu P.", pts: -3 },
    { n: "Gallo", p1: "Nor", p2: "Pia", p3: "Rus", j: "Ver", pts: 5 },
    { n: "Dave", p1: "Nor", p2: "Pia", p3: "Rus", j: "Ham", pts: 0 },
    { n: "Baba", pts: -3 },
    { n: "Casetz", p1: "Nor", p2: "Pia", p3: "Ham", j: "Rus", pts: 0 },
    { n: "Helmut", p1: "Nor", p2: "Pia", p3: "Rus", j: "Ver", pts: 5 },
    { n: "Fede", p1: "Nor", p2: "Pia", p3: "Ham", j: "Lec", pts: 0 },
    { n: "Raffaele", p1: "Nor", p2: "Pia", p3: "Lec", j: "Ver", pts: 5 },
    { n: "Sbin", p1: "Nor", p2: "Rus", p3: "Ver", j: "Pia", pts: 5 },
  ],

  bhr: [
    // Bahrain 13/04 🇧🇭 (senza sprint)
    { n: "Chiaretta", p1: "Nor", p2: "Pia", p3: "Ver", j: "Ham", pts: 0 },
    { n: "Vitto", pts: -3 },
    { n: "Ale", p1: "Nor", p2: "Pia", p3: "Ant", j: "Ver", pts: 0 },
    { n: "Albi", p1: "Nor", p2: "Pia", p3: "Lec", j: "Rus", pts: 5 },
    { n: "Riki M.", pts: -3 },
    { n: "Matte", pts: -3 },
    { n: "Steu P.", p1: "Nor", p2: "Pia", p3: "Lec", j: "Ver", pts: 0 },
    { n: "Gallo", p1: "Pia", p2: "Nor", p3: "Lec", j: "Ver", pts: 12 },
    { n: "Dave", p1: "Pia", p2: "Nor", p3: "Rus", j: "Ver", pts: 12 },
    { n: "Baba", p1: "Pia", p2: "Nor", p3: "Rus", j: "Ver", pts: 12 },
    { n: "Casetz", p1: "Nor", p2: "Pia", p3: "Ham", j: "Rus", pts: 5 },
    { n: "Helmut", p1: "Nor", p2: "Rus", p3: "Pia", j: "Ver", pts: 10 },
    { n: "Fede", p1: "Nor", p2: "Pia", p3: "Ham", j: "Lec", pts: 0 },
    { n: "Raffaele", p1: "Pia", p2: "Nor", p3: "Lec", j: "Ver", pts: 12 },
    { n: "Sbin", pts: -3 },
  ],
  saudi: [
    // Saudi Arabia 20/04 🇸🇦
    { n: "Chiaretta",  p1: "Pia", p2: "Nor",  p3: "Rus",  j: "Lec", pts: 12 },
    { n: "Vitto",      p1: "Pia", p2: "Nor",  p3: "Lec",  j: "Ver", pts: 17 },
    { n: "Ale",        p1: "Pia", p2: "Nor",  p3: "RUS",  j: "Ver", pts: 17 },
    { n: "Albi",       p1: "Nor", p2: "Pia",  p3: "Lec",  j: "Rus", pts: 0  },
    { n: "Riki M.",   /* non schierata */            pts: -3 },
    { n: "Matte",     /* non schierata */            pts: -3 },
    { n: "Steu P.",    p1: "Nor", p2: "Pia",  p3: "Ver",  j: "Rus", pts: 0  },
    { n: "Gallo",      p1: "Pia", p2: "Nor",  p3: "Lec",  j: "Ver", pts: 17 },
    { n: "Dave",       p1: "Nor", p2: "Pia",  p3: "Rus",  j: "Ver", pts: 5  },
    { n: "Baba",       p1: "pia", p2: "nor",  p3: "rus",  j: "ver", pts: 17 },
    { n: "Casetz",     p1: "Nor", p2: "Pia",  p3: "Ver",  j: "Rus", pts: 0  },
    { n: "Helmut",    /* non schierata */            pts: -3 },
    { n: "Fede",       p1: "Pia", p2: "Nor",  p3: "Ver",  j: "Rus", pts: 12 },
    { n: "Raffaele",   p1: "Nor", p2: "Pia",  p3: "Rus",  j: "Ver", pts: 5  },
    { n: "Sbin",       p1: "Nor", p2: "Pia",  p3: "Lec",  j: "Ver", pts: 5  },
  ],

  miami: [
    // Miami 03-04/05 🇺🇸 (main + sprint)
    {
      n:     "Chiaretta",
      p1:    "Pia",  p2: "Nor",  p3: "RUS",  j:   "Ant",  pts:    30,
      p1_sp: "Pia",  p2_sp: "Nor", p3_sp: "RUS", j_sp: "Ver", pts_sp: 0
    },
    {
      n:     "Vitto",
      p1:    "pia",  p2: "Nor",  p3: "RUS",  j:   "Ver",  pts:    30,
      /* non schierata Sprint */     pts_sp: -3
    },
    {
      n:     "Ale",
      p1:    "Pia",  p2: "Nor",  p3: "RUS",  j:   "Ant",  pts:    30,
      p1_sp: "Pia",  p2_sp: "Nor", p3_sp: "RUS", j_sp: "Ver", pts_sp: 0
    },
    {
      n:    "Albi",
      p1:   "Pia", p2: "Nor", p3: "Ant", j: "Ver", pts: 0,
      /* non schierata Sprint */                 pts_sp: -3
    },
    {
      n:    "Riki M.",
      /* non schierata main */             pts:   -3,
      /* non schierata Sprint */            pts_sp: -3
    },
    {
      n:    "Matte",
      /* non schierata main */             pts:   -3,
      /* non schierata Sprint */            pts_sp: -3
    },
    {
      n:    "Steu P.",
      p1:   "Pia", p2: "Nor", p3: "Ver", j: "Rus", pts: 27,
      p1_sp: "Pia", p2_sp: "Nor", p3_sp: "Ver", j_sp: "Lec", pts_sp:  0
    },
    {
      n:    "Gallo",
      /* non schierata main */          pts: -3,
      p1_sp: "Nor", p2_sp: "Pia", p3_sp: "Lec", j_sp: "Ver", pts_sp:  14
    },
    {
      n:    "Dave",
      p1:   "Nor", p2: "Pia", p3: "Ver", j: "Rus", pts: 5,
      p1_sp: "Pia", p2_sp: "Nor", p3_sp: "Rus", j_sp: "Lec", pts_sp:  0
    },
    {
      n:    "Baba",
      /* non schierata main */          pts: -3,
      /* non schierata Sprint */         pts_sp: -3
    },
    {
      n:    "Casetz",
      /* non schierata main */          pts: -3,
      p1_sp: "Pia", p2_sp: "Nor", p3_sp: "Rus", j_sp: "Lec", pts_sp:  0
    },
    {
      n:    "Helmut",
      p1:   "Nor", p2: "Ver", p3: "Rus", j: "Pia", pts: 12,
      p1_sp: "Nor", p2_sp: "Ver", p3_sp: "Lec", j_sp: "Pia", pts_sp:  10
    },
    {
      n:    "Fede",
      /* non schierata main */          pts: -3,
      /* non schierata Sprint */         pts_sp: -3
    },
    {
      n:    "Raffaele",
      p1:   "Pia", p2: "Nor", p3: "Rus", j: "Ver", pts: 30,
      p1_sp: "Pia", p2_sp: "Nor", p3_sp: "Rus", j_sp: "Ver", pts_sp:  0
    },
    {
      n:    "Sbin",
      /* non schierata main */          pts: -3,
      /* non schierata Sprint */         pts_sp: -3
    },
  ],

  imo: [
    // Imola 18/05 🇮🇹
    { n: "Chiaretta", p1: "Nor", p2: "Pia", p3: "Rus", j: "Ant",   pts:  0 },
    { n: "Vitto",     p1: "Pia", p2: "Rus", p3: "Ver", j: "",      pts:  0 },
    { n: "Ale",       p1: "Nor", p2: "Pia", p3: "Ant", j: "Ver",   pts:  5 },
    { n: "Albi",      pts: -3 }, 
    { n: "Riki M.",   p1: "Pia", p2: "Nor", p3: "Rus", j: "Ver",   pts: 15 },
    { n: "Matte",     p1: "Ver", p2: "Nor", p3: "Ham", j: "Lec",   pts: 22 },
    { n: "Steu P.",   p1: "Nor", p2: "Pia", p3: "Rus", j: "Ver",   pts:  5 },
    { n: "Gallo",     p1: "Nor", p2: "Pia", p3: "Ver", j: "Ant",   pts:  0 },
    { n: "Dave",      p1: "Nor", p2: "Pia", p3: "Ver", j: "Lec",   pts:  0 },
    { n: "Baba",      p1: "Nor", p2: "Pia", p3: "Ant", j: "Lec",   pts:  0 },
    { n: "Casetz",    p1: "Nor", p2: "Pia", p3: "Ver", j: "Ant",   pts:  0 },
    { n: "Helmut",    p1: "Nor", p2: "Pia", p3: "Ver", j: "Ant",   pts:  0 },
    { n: "Fede",      pts: -3 },
    { n: "Raffaele",  p1: "Pia", p2: "Nor", p3: "Rus", j: "Ver",   pts: 15 },
    { n: "Sbin",      p1: "Nor", p2: "Pia", p3: "Ver", j: "Ant",   pts:  0 }
  ],

  mon: [
    // Monaco 25/05 🇲🇨
    { n: "Chiaretta", p1: "Lec", p2: "Pia", p3: "Nor", j: "Ver",   pts:  0 },
    { n: "Vitto",     p1: "Ver", p2: "Pia", p3: "Nor", j: "Lec",   pts:  5 },
    { n: "Ale",       p1: "Lec", p2: "Ver", p3: "Nor", j: "Ant",   pts:  0 },
    { n: "Albi",      pts: -3 },
    { n: "Riki M.",   p1: "Nor", p2: "Pia", p3: "Lec", j: "Ver",   pts: 12 },
    { n: "Matte",     p1: "Pia", p2: "Lec", p3: "Nor", j: "Ver",   pts: 10 },
    { n: "Steu P.",   p1: "Nor", p2: "Ver", p3: "Pia", j: "Lec",   pts: 24 },
    { n: "Gallo",     p1: "Lec", p2: "Ver", p3: "Nor", j: "Pia",   pts:  5 },
    { n: "Dave",      p1: "Lec", p2: "Nor", p3: "Ver", j: "Pia",   pts:  5 },
    { n: "Baba",      p1: "Lec", p2: "Pia", p3: "Ver", j: "Nor",   pts:  5 },
    { n: "Casetz",    p1: "Nor", p2: "Ver", p3: "Ham", j: "Lec",   pts: 17 },
    { n: "Helmut",    p1: "Ver", p2: "Nor", p3: "Lec", j: "Pia",   pts:  5 },
    { n: "Fede",      p1: "Lec", p2: "Ver", p3: "Pia", j: "Ham",   pts:  7 },
    { n: "Raffaele",  p1: "Lec", p2: "Pia", p3: "Nor", j: "Ver",   pts:  0 },
    { n: "Sbin",      p1: "Ver", p2: "Pia", p3: "Nor", j: "Lec",   pts:  5 }
  ],

  spa: [
    // Spagna 01/06 🇪🇸
    { n: "Chiaretta", p1: "Pia", p2: "Nor", p3: "Lec", j: "Ver",   pts: 30 },
    { n: "Vitto",     p1: "Nor", p2: "Pia", p3: "",    j: "",     pts:  0 },
    { n: "Ale",       p1: "Nor", p2: "Pia", p3: "Ant", j: "Ver",   pts:  0 },
    { n: "Albi",      pts: -3 },
    { n: "Riki M.",   p1: "Ver", p2: "Nor", p3: "Lec", j: "Pia",   pts: 22 },
    { n: "Matte",     p1: "Pia", p2: "Nor", p3: "Ant", j: "Ver",   pts: 22 },
    { n: "Steu P.",   p1: "Pia", p2: "Nor", p3: "Lec", j: "Ver",   pts: 30 },
    { n: "Gallo",     p1: "Nor", p2: "Pia", p3: "Lec", j: "Lec",   pts: 12 },
    { n: "Dave",      p1: "Pia", p2: "Nor", p3: "Ver", j: "Rus",   pts: 22 },
    { n: "Baba",      p1: "Nor", p2: "Pia", p3: "Ver", j: "Lec",   pts:  5 },
    { n: "Casetz",    pts: -3 },
    { n: "Helmut",    p1: "Pia", p2: "Nor", p3: "Lec", j: "Ver",   pts: 30 },
    { n: "Fede",      pts: -3 },
    { n: "Raffaele",  p1: "Nor", p2: "Pia", p3: "Lec", j: "Ver",   pts:  7 },
    { n: "Sbin",      pts: -3 }
  ],
};
/* ============ Helpers ============ */

const fullDriver = s =>
  drv[s?.trim().replace(/^\w/, m => m.toUpperCase())] || s;

const uid       = nick => playerId[nick.toLowerCase().trim()];

function newBatch() { return { batch: db.batch(), ops: 0 }; }

/* ============ RESET ranking ============ */
async function resetRanking() {
  let { batch, ops } = newBatch();
  for (const id of Object.values(playerId)) {
    batch.set(
      db.doc(`ranking/${id}`),
      { puntiTotali: 0, pointsByRace: {} },
      { merge: true }
    );
    if (++ops === 480) { await batch.commit(); ({ batch, ops } = newBatch()); }
  }
  if (ops) await batch.commit();
  console.log("↻ Ranking azzerato");
}

/* ============ MAIN UPLOAD ============ */
async function run() {
  await resetRanking();

  let { batch, ops } = newBatch();

  for (const [raceKey, subs] of Object.entries(data)) {
    const raceId = raceSlug[raceKey];
    if (!raceId) {
      console.warn("Slug mancante per", raceKey);
      continue;
    }

    /* 1️⃣  salva /races/{slug}.officialResults */
    const official = officialResults[raceKey];
    if (official) {
      batch.set(
        db.doc(`races/${raceId}`),
        { officialResults: official },
        { merge: true }
      );
      if (++ops === 480) {
        await batch.commit();
        ({ batch, ops } = newBatch());
      }
    }

    /* 2️⃣  loop submission */
    for (const sub of subs) {
      const id = uid(sub.n);
      if (!id) {
        console.warn("UserId mancante per", sub.n);
        continue;
      }

      // **NON “appiattiamo” più i -3**: li lasciamo così come arrivano
      const mainPts   = sub.pts;
      const sprintPts = "pts_sp" in sub ? sub.pts_sp : 0;

      /* ---- /races/{slug}/submissions/{id} ---- */
      const subPayload = {
        mainP1:       fullDriver(sub.p1 || ""),
        mainP2:       fullDriver(sub.p2 || ""),
        mainP3:       fullDriver(sub.p3 || ""),
        mainJolly:    fullDriver(sub.j  || ""),
        pointsEarned: mainPts,
      };
      if ("pts_sp" in sub || "p1_sp" in sub) {
        Object.assign(subPayload, {
          sprintP1:           fullDriver(sub.p1_sp || ""),
          sprintP2:           fullDriver(sub.p2_sp || ""),
          sprintP3:           fullDriver(sub.p3_sp || ""),
          sprintJolly:        fullDriver(sub.j_sp  || ""),
          pointsEarnedSprint: sprintPts,
        });
      }
      batch.set(
        db.doc(`races/${raceId}/submissions/${id}`),
        subPayload,
        { merge: true }
      );
      ops++;

      /* ---- /ranking/{id} ---- */
      batch.set(
        db.doc(`ranking/${id}`),
        {
          pointsByRace: {
            [raceId]: { mainPts, sprintPts },
          },
          puntiTotali: FieldValue.increment(mainPts + sprintPts),
        },
        { merge: true }
      );
      if (++ops >= 480) {
        await batch.commit();
        ({ batch, ops } = newBatch());
      }
    }
  }

  if (ops) await batch.commit();
  console.log("✅ Upload completato!");
}

run().catch(console.error);