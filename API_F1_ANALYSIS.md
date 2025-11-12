# Analisi API Formula 1 per Fetch Automatico Risultati Gare

## Executive Summary

**Raccomandazione primaria**: **Jolpica F1 API** (http://api.jolpi.ca/ergast/f1/)
- Gratuita e open source
- Retrocompatibile con Ergast (standard de facto)
- Dati completi e storici dal 1950
- Nessuna autenticazione richiesta
- Aggiornata per 2025

---

## 1. ERGAST API (http://ergast.com/api/f1/)

### Status: ❌ DEPRECATA / CHIUSA

**Situazione attuale**:
- API CHIUSA da inizio 2025
- Nessun aggiornamento oltre la stagione 2024
- NON utilizzabile per dati 2025

### Migrazione necessaria
Tutti i progetti basati su Ergast devono migrare a **Jolpica F1 API** che offre endpoint retrocompatibili.

---

## 2. JOLPICA F1 API ⭐ RACCOMANDATO

### Status: ✅ ATTIVA E AGGIORNATA 2025

**Base URL**: `http://api.jolpi.ca/ergast/f1/`

### Caratteristiche Principali
- **Costo**: Gratuito, open source
- **Autenticazione**: Non richiesta
- **Rate Limits**: Non documentati (volontari mantengono il servizio)
- **Dati storici**: Dal 1950 ad oggi
- **Formati**: JSON, XML, JSONP
- **Compatibilità**: Drop-in replacement per Ergast

### Endpoint per Risultati Gare

#### 1. Risultati Gara (Race)
```
GET http://api.jolpi.ca/ergast/f1/{season}/{round}/results.json
```

**Esempi**:
```bash
# Ultima gara della stagione 2024
GET http://api.jolpi.ca/ergast/f1/2024/last/results.json

# Prima gara 2025
GET http://api.jolpi.ca/ergast/f1/2025/1/results.json

# Gara corrente
GET http://api.jolpi.ca/ergast/f1/current/last/results.json
```

**Risposta JSON** (struttura):
```json
{
  "MRData": {
    "xmlns": "",
    "series": "f1",
    "url": "http://api.jolpi.ca/ergast/f1/2024/last/results.json",
    "limit": "30",
    "offset": "0",
    "total": "20",
    "RaceTable": {
      "season": "2024",
      "round": "24",
      "Races": [
        {
          "season": "2024",
          "round": "24",
          "url": "https://en.wikipedia.org/wiki/2024_Abu_Dhabi_Grand_Prix",
          "raceName": "Abu Dhabi Grand Prix",
          "Circuit": {
            "circuitId": "yas_marina",
            "url": "https://en.wikipedia.org/wiki/Yas_Marina_Circuit",
            "circuitName": "Yas Marina Circuit",
            "Location": {
              "lat": "24.4672",
              "long": "54.6031",
              "locality": "Abu Dhabi",
              "country": "UAE"
            }
          },
          "date": "2024-12-08",
          "time": "13:00:00Z",
          "Results": [
            {
              "number": "1",
              "position": "1",
              "positionText": "1",
              "points": "25",
              "Driver": {
                "driverId": "verstappen",
                "permanentNumber": "1",
                "code": "VER",
                "givenName": "Max",
                "familyName": "Verstappen",
                "dateOfBirth": "1997-09-30",
                "nationality": "Dutch"
              },
              "Constructor": {
                "constructorId": "red_bull",
                "url": "http://en.wikipedia.org/wiki/Red_Bull_Racing",
                "name": "Red Bull",
                "nationality": "Austrian"
              },
              "grid": "1",
              "laps": "58",
              "status": "Finished",
              "Time": {
                "millis": "5794334",
                "time": "1:36:34.334"
              },
              "FastestLap": {
                "rank": "1",
                "lap": "45",
                "Time": {
                  "time": "1:26.103"
                },
                "AverageSpeed": {
                  "units": "kph",
                  "speed": "195.863"
                }
              }
            },
            {
              "number": "4",
              "position": "2",
              "positionText": "2",
              "points": "18",
              "Driver": {
                "driverId": "norris",
                "permanentNumber": "4",
                "code": "NOR",
                "givenName": "Lando",
                "familyName": "Norris",
                "dateOfBirth": "1999-11-13",
                "nationality": "British"
              },
              "Constructor": {
                "constructorId": "mclaren",
                "url": "http://en.wikipedia.org/wiki/McLaren",
                "name": "McLaren",
                "nationality": "British"
              },
              "grid": "2",
              "laps": "58",
              "status": "Finished",
              "Time": {
                "millis": "5802544",
                "time": "+8.210"
              }
            },
            {
              "number": "44",
              "position": "3",
              "positionText": "3",
              "points": "15",
              "Driver": {
                "driverId": "hamilton",
                "permanentNumber": "44",
                "code": "HAM",
                "givenName": "Lewis",
                "familyName": "Hamilton",
                "dateOfBirth": "1985-01-07",
                "nationality": "British"
              },
              "Constructor": {
                "constructorId": "mercedes",
                "url": "http://en.wikipedia.org/wiki/Mercedes-Benz_in_Formula_One",
                "name": "Mercedes",
                "nationality": "German"
              },
              "grid": "3",
              "laps": "58",
              "status": "Finished",
              "Time": {
                "millis": "5809785",
                "time": "+15.451"
              }
            }
          ]
        }
      ]
    }
  }
}
```

#### 2. Risultati Sprint
```
GET http://api.jolpi.ca/ergast/f1/{season}/{round}/sprint.json
```

**Esempi**:
```bash
# Sprint della prima gara 2025
GET http://api.jolpi.ca/ergast/f1/2025/1/sprint.json

# Tutti gli sprint del 2024
GET http://api.jolpi.ca/ergast/f1/2024/sprint.json

# Sprint dell'ultimo round
GET http://api.jolpi.ca/ergast/f1/current/last/sprint.json
```

**Risposta JSON** (struttura simile a results):
```json
{
  "MRData": {
    "series": "f1",
    "RaceTable": {
      "season": "2024",
      "round": "19",
      "Races": [
        {
          "raceName": "São Paulo Grand Prix",
          "date": "2024-11-03",
          "Sprint": {
            "date": "2024-11-02",
            "time": "15:00:00Z",
            "SprintResults": [
              {
                "number": "1",
                "position": "1",
                "positionText": "1",
                "points": "8",
                "Driver": { /* ... */ },
                "Constructor": { /* ... */ },
                "grid": "1",
                "laps": "24",
                "status": "Finished"
              }
            ]
          }
        }
      ]
    }
  }
}
```

### Filtri Disponibili

**Per Pilota**:
```
GET http://api.jolpi.ca/ergast/f1/drivers/verstappen/results.json
```

**Per Team**:
```
GET http://api.jolpi.ca/ergast/f1/constructors/ferrari/results.json
```

**Per Circuito**:
```
GET http://api.jolpi.ca/ergast/f1/circuits/monza/results.json
```

**Top 3 (podio) - Filtraggio lato client**:
```javascript
// Dopo aver fetchato i risultati, filtra per position <= 3
const results = data.MRData.RaceTable.Races[0].Results;
const podium = results.filter(r => parseInt(r.position) <= 3);
```

### Parametri Query

- `limit`: max risultati (default: 30, max: 100)
- `offset`: paginazione (default: 0)

```
GET http://api.jolpi.ca/ergast/f1/2024/results.json?limit=100&offset=0
```

### Pro e Contro

✅ **PRO**:
- Completamente gratuito
- Nessuna autenticazione
- Dati storici completi
- API stabile e matura
- Retrocompatibile con Ergast (documentazione abbondante)
- Supporto community attivo
- Formato JSON pulito e ben strutturato
- Dati completi per gare e sprint

❌ **CONTRO**:
- Gestito da volontari (affidabilità dipendente da donazioni)
- Nessun dato real-time durante le gare
- Rate limits non documentati
- Nessuna autenticazione = impossibile tracking usage personale

### Affidabilità 2025: ⭐⭐⭐⭐⭐ (5/5)
- API attiva e mantenuta
- Community attiva
- Sostituto ufficiale di Ergast

---

## 3. OPENF1 API (https://openf1.org/)

### Status: ✅ ATTIVA (con limitazioni per risultati storici)

**Base URL**: `https://api.openf1.org/v1/`

### Caratteristiche Principali
- **Costo**: Gratuito per dati storici, a pagamento per real-time
- **Autenticazione**: Non richiesta (storico), richiesta (real-time)
- **Rate Limits**: Query timeout 10 secondi
- **Formati**: JSON, CSV
- **Focus**: Telemetria e dati real-time

### Endpoint per Risultati

#### Session Result (Classifiche)
```
GET https://api.openf1.org/v1/session_result
```

**Parametri**:
- `session_key`: ID della sessione
- `driver_number`: Numero pilota
- `position<=3`: Filtra primi 3

**Esempio**:
```bash
# Risultati ultima sessione
GET https://api.openf1.org/v1/session_result?session_key=latest

# Top 3 di una sessione specifica
GET https://api.openf1.org/v1/session_result?session_key=9687&position<=3
```

**Risposta JSON** (esempio):
```json
[
  {
    "date": "2024-12-08T15:00:00",
    "driver_number": 1,
    "full_name": "Max VERSTAPPEN",
    "team_name": "Red Bull Racing",
    "position": 1,
    "points": 25.0,
    "dnf": false,
    "dns": false,
    "dsq": false,
    "duration": 5794334,
    "gap_to_leader": 0.0,
    "session_key": 9687,
    "meeting_key": 1245
  },
  {
    "driver_number": 4,
    "full_name": "Lando NORRIS",
    "team_name": "McLaren",
    "position": 2,
    "points": 18.0,
    "duration": 5802544,
    "gap_to_leader": 8.210
  }
]
```

#### Sessions (Per ottenere session_key)
```
GET https://api.openf1.org/v1/sessions?year=2025&session_name=Race
```

**Risposta JSON**:
```json
[
  {
    "circuit_key": 12,
    "circuit_short_name": "Bahrain",
    "country_name": "Bahrain",
    "date_start": "2025-03-01T15:00:00",
    "date_end": "2025-03-01T17:00:00",
    "gmt_offset": "+03:00",
    "location": "Sakhir",
    "meeting_key": 1250,
    "session_key": 9700,
    "session_name": "Race",
    "session_type": "Race",
    "year": 2025
  }
]
```

### Workflow per Ottenere Risultati

```javascript
// 1. Ottieni session_key
const sessions = await fetch('https://api.openf1.org/v1/sessions?year=2025&session_name=Race');
const lastSession = sessions[sessions.length - 1];

// 2. Ottieni risultati con session_key
const results = await fetch(
  `https://api.openf1.org/v1/session_result?session_key=${lastSession.session_key}&position<=3`
);
```

### Pro e Contro

✅ **PRO**:
- Dati telemetrici dettagliati
- Real-time durante gare (a pagamento)
- API moderna e ben documentata
- Formato JSON semplice
- Filtri avanzati (<=, >=, etc.)
- CSV export built-in

❌ **CONTRO**:
- **Non fornisce dati storici completi di gare passate**
- Real-time richiede pagamento
- Workflow più complesso (serve session_key)
- Documentazione meno completa per risultati storici
- Meno mature di Jolpica/Ergast

### Affidabilità 2025: ⭐⭐⭐ (3/5)
- API attiva ma focus su telemetria
- Dati storici limitati
- Meglio per dati real-time che storici

---

## 4. API-SPORTS / RAPIDAPI

### Status: ✅ ATTIVA (commerciale con tier gratuito limitato)

**Base URL**: `https://api-formula-1.p.rapidapi.com/`

### Caratteristiche Principali
- **Costo**: 100 richieste/giorno (gratuito), piani a pagamento
- **Autenticazione**: API Key richiesta (via RapidAPI)
- **Rate Limits**: 100 req/giorno (free), reset 00:00 UTC
- **Formati**: JSON

### Endpoint

```
GET https://api-formula-1.p.rapidapi.com/rankings/drivers
GET https://api-formula-1.p.rapidapi.com/rankings/teams
GET https://api-formula-1.p.rapidapi.com/races
```

**Headers richiesti**:
```javascript
{
  'X-RapidAPI-Key': 'YOUR_API_KEY',
  'X-RapidAPI-Host': 'api-formula-1.p.rapidapi.com'
}
```

### Pro e Contro

✅ **PRO**:
- Dati commerciali affidabili
- Documentazione completa
- Support ufficiale
- Uptime garantito

❌ **CONTRO**:
- Richiede registrazione e API key
- Limite 100 req/giorno (troppo basso)
- Dati meno granulari di Jolpica
- Più costoso per uso intensivo

### Affidabilità 2025: ⭐⭐⭐⭐ (4/5)
- API commerciale affidabile
- Ma limitazioni tier gratuito troppo restrittive

---

## 5. ALTRE API (F1API.dev, etc.)

### F1API.dev
- Open source, simile a OpenF1
- Focus su dati realtime
- Documentazione limitata
- Non testata per affidabilità 2025

---

## RACCOMANDAZIONE FINALE

### Per il tuo progetto: **JOLPICA F1 API** ⭐

**Motivazioni**:
1. **Gratuita e senza limiti** (adatta per uso frequente)
2. **Nessuna autenticazione** (setup semplice)
3. **Dati completi** per gare e sprint dal 1950
4. **API stabile** (standard de facto, retrocompatibile Ergast)
5. **Formato JSON pulito** e facile da parsare
6. **Community attiva** e documentazione abbondante

### Implementazione Consigliata

```javascript
// service/f1-api.js
const JOLPICA_BASE_URL = 'http://api.jolpi.ca/ergast/f1';

/**
 * Fetch ultimi risultati gara (top 3)
 */
export async function fetchLatestRaceResults() {
  const response = await fetch(`${JOLPICA_BASE_URL}/current/last/results.json`);
  const data = await response.json();

  const race = data.MRData.RaceTable.Races[0];
  const podium = race.Results.slice(0, 3).map(result => ({
    position: parseInt(result.position),
    driver: {
      code: result.Driver.code,
      firstName: result.Driver.givenName,
      lastName: result.Driver.familyName,
      number: result.Driver.permanentNumber
    },
    team: result.Constructor.name,
    points: parseFloat(result.points),
    time: result.Time?.time || 'DNF'
  }));

  return {
    raceName: race.raceName,
    date: race.date,
    circuit: race.Circuit.circuitName,
    podium
  };
}

/**
 * Fetch ultimi risultati sprint (top 3)
 */
export async function fetchLatestSprintResults() {
  const response = await fetch(`${JOLPICA_BASE_URL}/current/last/sprint.json`);
  const data = await response.json();

  const race = data.MRData.RaceTable.Races[0];
  if (!race.Sprint) {
    return null; // Nessuno sprint questo weekend
  }

  const podium = race.Sprint.SprintResults.slice(0, 3).map(result => ({
    position: parseInt(result.position),
    driver: {
      code: result.Driver.code,
      firstName: result.Driver.givenName,
      lastName: result.Driver.familyName
    },
    team: result.Constructor.name,
    points: parseFloat(result.points)
  }));

  return {
    raceName: race.raceName,
    sprintDate: race.Sprint.date,
    podium
  };
}

/**
 * Fetch risultati gara specifica
 */
export async function fetchRaceResults(season, round) {
  const response = await fetch(`${JOLPICA_BASE_URL}/${season}/${round}/results.json`);
  const data = await response.json();

  const race = data.MRData.RaceTable.Races[0];
  return {
    season: race.season,
    round: race.round,
    raceName: race.raceName,
    date: race.date,
    results: race.Results.map(result => ({
      position: parseInt(result.position),
      driver: result.Driver,
      constructor: result.Constructor,
      points: parseFloat(result.points),
      status: result.status
    }))
  };
}
```

### Esempio di Utilizzo

```javascript
// Nella tua applicazione
import { fetchLatestRaceResults, fetchLatestSprintResults } from './service/f1-api';

// Fetch risultati ultima gara
const raceResults = await fetchLatestRaceResults();
console.log('Podio gara:', raceResults.podium);
// Output:
// [
//   { position: 1, driver: { code: 'VER', ... }, team: 'Red Bull', points: 25 },
//   { position: 2, driver: { code: 'NOR', ... }, team: 'McLaren', points: 18 },
//   { position: 3, driver: { code: 'HAM', ... }, team: 'Mercedes', points: 15 }
// ]

// Fetch risultati sprint (se disponibile)
const sprintResults = await fetchLatestSprintResults();
if (sprintResults) {
  console.log('Podio sprint:', sprintResults.podium);
}
```

### Gestione Errori e Edge Cases

```javascript
export async function fetchLatestRaceResults() {
  try {
    const response = await fetch(`${JOLPICA_BASE_URL}/current/last/results.json`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Verifica che ci siano dati
    if (!data.MRData?.RaceTable?.Races?.[0]) {
      throw new Error('No race data available');
    }

    const race = data.MRData.RaceTable.Races[0];

    // Verifica che ci siano risultati
    if (!race.Results || race.Results.length === 0) {
      throw new Error('No results available');
    }

    // ... resto del codice

  } catch (error) {
    console.error('Error fetching race results:', error);
    // Fallback o gestione errore
    return null;
  }
}
```

---

## BACKUP / ALTERNATIVE

### Piano B: OpenF1 API
Se Jolpica dovesse avere problemi:
- Usare OpenF1 per dati recenti
- Workflow più complesso ma API moderna

### Piano C: API-Sports
Per uso limitato (< 100 req/giorno):
- Affidabilità commerciale
- Richiede gestione API key

---

## TESTING DELLE API

### Test Jolpica
```bash
# Test disponibilità
curl "http://api.jolpi.ca/ergast/f1/2024/last/results.json"

# Test sprint
curl "http://api.jolpi.ca/ergast/f1/2024/sprint.json"

# Test dati 2025 (quando disponibili)
curl "http://api.jolpi.ca/ergast/f1/2025/1/results.json"
```

### Test OpenF1
```bash
# Test sessions
curl "https://api.openf1.org/v1/sessions?year=2024&session_name=Race"

# Test results
curl "https://api.openf1.org/v1/session_result?session_key=9687&position<=3"
```

---

## CONCLUSIONI

**Jolpica F1 API** è la scelta migliore per il tuo caso d'uso:
- Fetch automatico risultati gare e sprint
- Dati storici completi
- Nessun costo o limite
- API matura e affidabile
- Facilità di implementazione

**OpenF1** è un'ottima alternativa se hai bisogno di:
- Dati telemetrici
- Real-time durante gare
- Ma non è ottimale per risultati storici

**API-Sports** è da considerare solo se:
- Hai budget per tier a pagamento
- Servono garanzie SLA commerciali
- 100 req/giorno sono sufficienti

---

## RISORSE UTILI

### Jolpica F1
- **API Base**: http://api.jolpi.ca/ergast/f1/
- **Documentazione**: https://github.com/jolpica/jolpica-f1/tree/main/docs
- **GitHub**: https://github.com/jolpica/jolpica-f1

### OpenF1
- **Website**: https://openf1.org/
- **GitHub**: https://github.com/br-g/openf1

### Community
- **F1 Data Subreddit**: r/F1Technical
- **Fast-F1 Python Library**: https://github.com/theOehrly/Fast-F1 (usa Jolpica)
