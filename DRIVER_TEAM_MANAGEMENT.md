# Sistema di Gestione Piloti e Costruttori

## 📋 Panoramica

Questo progetto ora utilizza un **sistema ibrido intelligente** per gestire piloti e costruttori con risoluzione automatica da API e fallback manuali.

## 🏗️ Architettura

### File Principali

```
src/
├── data/
│   └── f1-data.json              # Database manuale (fallback e override)
├── services/
│   ├── f1DataResolver.js         # Servizio centrale di risoluzione
│   ├── f1ResultsFetcher.js       # Fetcher risultati gare (aggiornato)
│   └── f1SessionsFetcher.js      # Fetcher sessioni (aggiornato)
└── constants/
    └── racing.js                 # Costanti statiche + helper dinamici
```

### Priorità di Risoluzione (Cascading Fallback)

```
1️⃣ API Cache (priorità MASSIMA)
    ↓ (se non trovato)
2️⃣ Database JSON Manuale
    ↓ (se non trovato)
3️⃣ Inferenza da API response (usa Constructor.name dalla risposta)
    ↓ (se fallisce tutto)
4️⃣ Fallback generico (mostra solo nome e cognome)
```

## 🔧 Configurazione

### `src/data/f1-data.json`

Questo file contiene:
- **teams**: Tutti i team con loghi e alias API
- **drivers**: Tutti i piloti 2025 con team e alias API
- **config**: Configurazione del sistema

```json
{
  "config": {
    "enableApiSync": true,          // Abilita sync automatico
    "cacheExpirationHours": 24,     // Scadenza cache (24 ore)
    "preferApiData": true           // Priorità API (true) o manuale (false)
  }
}
```

## 🔄 Sincronizzazione Automatica

### All'avvio app

La sincronizzazione avviene **automaticamente** all'avvio dell'app (`App.jsx`):

```javascript
useEffect(() => {
  syncFromAPI().catch(err => console.warn('Sync failed:', err));
}, []);
```

### Manuale (Console Browser)

Puoi forzare un sync manualmente dalla console del browser:

```javascript
import { syncFromAPI, exportUnknownDrivers } from './services/f1DataResolver.js';

// Sincronizza ora
await syncFromAPI();

// Esporta piloti sconosciuti trovati
exportUnknownDrivers();
```

## 📊 Come Funziona

### Quando arriva un pilota dall'API

1. **API restituisce**: `{ givenName: "Max", familyName: "Verstappen" }`
2. **Resolver cerca**:
   - Prima in **cache API** (se `preferApiData: true`)
   - Poi in **f1-data.json** (cerca negli `apiAliases`)
   - Poi in **cache API** come fallback (se `preferApiData: false`)
   - Se l'API ha anche fornito `Constructor.name`, prova a **inferire il team**
   - Altrimenti restituisce solo **nome e cognome**

3. **Risultato**:
   ```javascript
   {
     displayName: "Max Verstappen",
     currentTeam: "red-bull",
     teamData: {
       displayName: "Red Bull",
       logo: "/redbull.png"
     },
     source: "api-cache" | "manual" | "inferred" | "fallback"
   }
   ```

### Quando arriva un team dall'API

Stesso meccanismo, ma cerca in `teams` invece di `drivers`.

## 🆕 Aggiungere un Nuovo Pilota

### Opzione 1: Automatico (consigliato)

1. Il pilota viene trovato dalla API Ergast standings
2. Viene automaticamente aggiunto alla cache
3. Se ha un team associato, viene inferito automaticamente

### Opzione 2: Manuale

Aggiungi il pilota in `src/data/f1-data.json`:

```json
{
  "drivers": {
    "nuovo-pilota": {
      "id": "nuovo-pilota",
      "displayName": "Nome Cognome",
      "firstName": "Nome",
      "lastName": "Cognome",
      "number": 99,
      "currentTeam": "team-id",
      "apiAliases": [
        "Cognome",
        "Nome Cognome",
        "NCO"
      ]
    }
  }
}
```

## 🔄 Cambiare Team a un Pilota

### Modifica in `f1-data.json`

```json
{
  "drivers": {
    "lewis-hamilton": {
      ...
      "currentTeam": "ferrari",  // Cambia da "mercedes" a "ferrari"
      ...
    }
  }
}
```

Il cambio sarà **immediato** al prossimo reload della pagina (o dopo `syncFromAPI()`).

## 🏁 Aggiungere un Nuovo Team

1. Aggiungi il logo PNG in `/public/` (es: `/public/nuovo-team.png`)
2. Aggiungi il team in `f1-data.json`:

```json
{
  "teams": {
    "nuovo-team": {
      "id": "nuovo-team",
      "displayName": "Nuovo Team",
      "logo": "/nuovo-team.png",
      "apiAliases": [
        "Nuovo Team F1",
        "Nuovo Team Racing",
        "nuovo_team"
      ]
    }
  }
}
```

## 🐛 Debug e Troubleshooting

### Verificare cache

Console browser:

```javascript
// Verifica cache localStorage
console.log(JSON.parse(localStorage.getItem('fanta-f1-drivers-cache')));
console.log(JSON.parse(localStorage.getItem('fanta-f1-teams-cache')));
```

### Pulire cache

Console browser:

```javascript
import { clearCache } from './services/f1DataResolver.js';
clearCache();
```

### Vedere piloti/team sconosciuti

Console browser:

```javascript
import { exportUnknownDrivers, exportUnknownTeams } from './services/f1DataResolver.js';

// Mostra piloti non mappati trovati durante l'uso
exportUnknownDrivers();

// Mostra team non mappati
exportUnknownTeams();
```

Questo stamperà un JSON pronto da copiare in `f1-data.json`.

## 📝 Funzioni Helper Disponibili

### In `src/constants/racing.js`

```javascript
import {
  getDriverTeamDynamic,
  getTeamLogoDynamic,
  getAllDriversDynamic,
  getAllTeamsDynamic,
  isDriverValid,
  isTeamValid
} from './constants/racing.js';

// Ottieni team di un pilota (con fallback API)
const team = getDriverTeamDynamic("Max Verstappen"); // "Red Bull"

// Ottieni logo di un team
const logo = getTeamLogoDynamic("Ferrari"); // "/ferrari.png"

// Ottieni tutti i piloti (statici + API cache)
const allDrivers = getAllDriversDynamic();

// Verifica se un pilota è valido
const valid = isDriverValid("Max Verstappen"); // true
```

### In `src/services/f1DataResolver.js`

```javascript
import {
  resolveDriver,
  resolveTeam,
  syncFromAPI,
  exportUnknownDrivers,
  clearCache
} from './services/f1DataResolver.js';

// Risolvi un pilota da API response
const driver = resolveDriver(
  { givenName: "Max", familyName: "Verstappen" },
  { name: "Red Bull Racing" }
);

// Risolvi un team
const team = resolveTeam("Red Bull Racing");

// Sync da API
await syncFromAPI();
```

## ⚙️ Comportamento in Produzione

- **Sync automatico**: All'avvio app (background, non blocca UI)
- **Cache**: 24 ore (configurabile in `f1-data.json`)
- **Fallback**: Se API down, usa sempre `f1-data.json`
- **Piloti sconosciuti**: Vengono mostrati con nome/cognome anche se non mappati

## 📊 Vantaggi del Sistema

✅ **Auto-aggiornamento**: Nuovi piloti vengono rilevati automaticamente
✅ **Affidabilità**: Se API down, usa database manuale
✅ **Flessibilità**: Puoi prioritizzare API o dati manuali
✅ **Tracciabilità**: Ogni dato ha un `source` field
✅ **Manutenzione**: Funzione `exportUnknownDrivers()` genera JSON da aggiungere
✅ **Performance**: Cache locale evita richieste ripetute
✅ **Inferenza**: Usa Constructor.name dall'API per mappare team automaticamente

## 🎯 Casi d'Uso

### Inizio Stagione 2026

1. API Ergast già ha i nuovi piloti/team
2. `syncFromAPI()` li scarica automaticamente
3. Se mancano loghi, aggiungi solo i PNG in `/public/`
4. Aggiorna `f1-data.json` con i nuovi team/loghi

### Cambio Team Mid-Season

1. Modifica `currentTeam` in `f1-data.json`
2. O aspetta che `syncFromAPI()` lo rilevi automaticamente

### Pilota di Riserva (non in standings)

1. Aggiungi manualmente in `f1-data.json`
2. Verrà usato quando l'API lo restituisce nei risultati

## 📞 Supporto

Per domande o problemi, controlla:
- Console browser per log dettagliati
- `exportUnknownDrivers()` per vedere cosa non è mappato
- Cache localStorage per vedere dati sincronizzati
