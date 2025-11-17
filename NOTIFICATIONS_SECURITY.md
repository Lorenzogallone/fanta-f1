# 🛡️ Sicurezza e Protezione Anti-Costi

## Panoramica

Questo documento descrive tutte le protezioni implementate per **garantire costo zero** e prevenire abusi.

---

## 🔒 Protezioni Implementate nel Codice

### 1. Hard Limits su Risorse

**Location:** `functions/index.js` (linee 13-19)

```javascript
const SAFETY_LIMITS = {
  MAX_TOKENS_PER_NOTIFICATION: 1000,    // Max destinatari per notifica
  MAX_NOTIFICATIONS_PER_RUN: 10,         // Max eventi processati per esecuzione
  MAX_FIRESTORE_READS_PER_RUN: 100,      // Previene query explosion
  RATE_LIMIT_WINDOW_MS: 60000,           // Finestra rate limiting (1 min)
  MAX_TEST_CALLS_PER_MINUTE: 3,          // Max chiamate test endpoint
};
```

**Cosa previene:**
- ❌ Invio massivo accidentale a migliaia di utenti
- ❌ Loop infiniti che processano centinaia di eventi
- ❌ Query Firestore illimitate
- ❌ Spam dell'endpoint di test

### 2. Rate Limiting su Endpoint HTTP

**Location:** `functions/index.js` (linee 22-43, 393-411)

**Implementazione:**

```javascript
function isRateLimited(key, maxCalls, windowMs) {
  const now = Date.now();
  const record = rateLimitCache.get(key) || { count: 0, resetTime: now + windowMs };

  if (now > record.resetTime) {
    // Reset window
    rateLimitCache.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (record.count >= maxCalls) {
    return true; // BLOCCATO
  }

  record.count++;
  rateLimitCache.set(key, record);
  return false;
}
```

**Protezione:**
- ✅ Max 3 chiamate/minuto all'endpoint `/testNotification`
- ✅ Rate limit per IP client
- ✅ Risposta HTTP 429 quando superato

**Cosa previene:**
- ❌ Attacchi DDoS all'endpoint di test
- ❌ Loop applicativi che chiamano endpoint ripetutamente
- ❌ Bot malevoli

### 3. Deduplicazione Notifiche

**Location:** `functions/index.js` (linee 71-84)

**Implementazione:**

```javascript
const notificationId = `${raceDoc.id}_${eventType}_30min`;

const notifDoc = await admin
  .firestore()
  .collection('sentNotifications')
  .doc(notificationId)
  .get();

if (notifDoc.exists) {
  console.log(`✓ Notification already sent for ${eventType} ${race.name}`);
  return null; // SALTA
}
```

**Cosa previene:**
- ❌ Invio duplicato della stessa notifica
- ❌ Costi multipli per lo stesso evento
- ❌ Spam agli utenti

### 4. Error Handling Senza Retry

**Location:** `functions/index.js` (linee 280-285, 334-338, 411-416)

**Implementazione:**

```javascript
try {
  // ... operazioni
} catch (error) {
  console.error('❌ Error:', error);
  return null; // NO THROW = NO RETRY
}
```

**Cosa previene:**
- ❌ Retry automatici che moltiplicano i costi
- ❌ Loop infiniti su errori persistenti
- ❌ Esaurimento risorse

**Nota:** Cloud Functions ritenta automaticamente su `throw`. Restituendo `null` preveniamo questo comportamento.

### 5. Token Cleanup Automatico

**Location:** `functions/index.js` (linee 158-173)

**Implementazione:**

```javascript
const tokensToDelete = [];
response.responses.forEach((resp, idx) => {
  if (!resp.success) {
    if (
      resp.error?.code === 'messaging/invalid-registration-token' ||
      resp.error?.code === 'messaging/registration-token-not-registered'
    ) {
      tokensToDelete.push(tokensSnapshot.docs[idx].ref);
    }
  }
});

// Max 50 delete per run (SAFETY)
const toDelete = tokensToDelete.slice(0, 50);
await Promise.all(toDelete.map(ref => ref.delete()));
```

**Cosa previene:**
- ❌ Accumulo token invalidi nel database
- ❌ Invii falliti ripetuti
- ❌ Crescita incontrollata collection

### 6. Limits su Firestore Queries

**Location:** `functions/index.js` (linee 235-239, 303-308)

**Implementazione:**

```javascript
// Limit su query races
const racesSnapshot = await admin
  .firestore()
  .collection('races')
  .limit(SAFETY_LIMITS.MAX_NOTIFICATIONS_PER_RUN) // MAX 10
  .get();

// Limit su tokens
const tokensSnapshot = await admin
  .firestore()
  .collection('notificationTokens')
  .limit(SAFETY_LIMITS.MAX_TOKENS_PER_NOTIFICATION) // MAX 1000
  .get();
```

**Cosa previene:**
- ❌ Query che leggono migliaia di documenti
- ❌ Costi Firestore reads elevati
- ❌ Timeout della funzione

### 7. Logging Dettagliato

**Location:** Tutto `functions/index.js`

**Emoji System per Quick Scan:**

```javascript
console.log('🚀 Running...'); // Start
console.log('✓ Success');     // Successo
console.log('⚠️ Warning');     // Attenzione
console.log('❌ Error');        // Errore
console.log('ℹ️ Info');        // Informazione
```

**Benefit:**
- ✅ Debug rapido con emoji visivi
- ✅ Tracciamento completo esecuzioni
- ✅ Identificazione anomalie immediate

---

## 🎯 Budget Alerts (Setup Manuale)

### Alert Level 1: Early Warning (€5)

```
Soglia: €5,00 EUR/mese
Alert a: 50%, 80%, 100%
Azione: Email notifica
Scopo: Avviso precoce anomalie
```

### Alert Level 2: Critical (€10)

```
Soglia: €10,00 EUR/mese
Alert a: 100%, 150%
Azione: Email + SMS
Scopo: Azione immediata richiesta
```

### Come Configurare

Vedi [NOTIFICATIONS_SETUP.md](./NOTIFICATIONS_SETUP.md) → Step 3

---

## 📊 Monitoraggio Continuo

### 1. Cloud Functions Dashboard

**Metriche da monitorare:**
- Invocations/giorno (atteso: ~96)
- Durata media esecuzione (atteso: <2s)
- Errori (atteso: 0%)
- Memory usage (atteso: <50MB)

**Allarmi:**
- ⚠️ Invocations > 500/giorno
- ⚠️ Errori > 1%
- ⚠️ Durata > 10s

### 2. Firestore Dashboard

**Metriche da monitorare:**
- Reads/giorno (atteso: ~1.000)
- Writes/giorno (atteso: ~100)
- Storage (atteso: <100KB)

**Allarmi:**
- ⚠️ Reads > 10.000/giorno
- ⚠️ Writes > 1.000/giorno
- ⚠️ Storage > 1MB (indica leak)

### 3. Logs Analysis

```bash
# Cerca pattern anomali
firebase functions:log | grep "❌"  # Errori
firebase functions:log | grep "⚠️"   # Warning

# Conta esecuzioni
firebase functions:log --only checkUpcomingEvents | grep "🚀" | wc -l

# Cerca rate limiting
firebase functions:log --only testNotification | grep "429"
```

### 4. Stats Endpoint

```bash
# Chiamata giornaliera per controllo
curl https://europe-west1-fantaf1-b5410.cloudfunctions.net/getNotificationStats

# Controlla:
# - totalTokens < 1000
# - totalNotificationsSent crescita lineare
# - No spike anomali
```

---

## 🚨 Scenari di Emergenza

### Scenario 1: Loop Infinito

**Sintomi:**
- Invocations > 10.000 in poche ore
- Costi che crescono rapidamente

**Azione Immediata:**

```bash
# STEP 1: Disabilita funzioni immediatamente
firebase functions:delete checkUpcomingEvents
firebase functions:delete cleanupOldNotifications

# STEP 2: Analizza logs
firebase functions:log --limit 100

# STEP 3: Identifica causa
# - Bug nel codice?
# - Dati corrotti in Firestore?
# - Attacco esterno?

# STEP 4: Fix e redeploy
# (dopo aver identificato e risolto il problema)
firebase deploy --only functions
```

### Scenario 2: Crescita Token Incontrollata

**Sintomi:**
- Collection `notificationTokens` > 10.000 documenti
- Reads/giorno elevate

**Azione:**

```bash
# STEP 1: Conta token
firebase firestore:get notificationTokens --limit 1000

# STEP 2: Identifica duplicati o token bot
# (analizza userAgent, createdAt patterns)

# STEP 3: Cleanup manuale
# Script per eliminare token vecchi/invalidi
```

### Scenario 3: Attacco DDoS su Endpoint

**Sintomi:**
- Logs mostrano migliaia di chiamate `/testNotification`
- Possibile costo elevato

**Azione:**

```bash
# STEP 1: Controlla logs
firebase functions:log --only testNotification | tail -100

# STEP 2: Verifica rate limiting funziona
# (dovresti vedere molti 429)

# STEP 3: Se rate limiting bypassato, disabilita endpoint
firebase functions:delete testNotification

# STEP 4: Aumenta protezioni e redeploy
# (es. autenticazione richiesta, captcha, etc.)
```

---

## 🔐 Firestore Security Rules

### Rules Consigliate

Aggiungi a `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Tokens: solo proprietario può leggere/scrivere
    match /notificationTokens/{userId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;

      // Previene write massive
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.writeFields.size() <= 10; // Max 10 campi
    }

    // Sent notifications: read per autenticati, write solo functions
    match /sentNotifications/{notifId} {
      allow read: if request.auth != null;
      allow write: if false; // Solo Cloud Functions
    }

    // Previeni accesso altre collection
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Deploy:**

```bash
firebase deploy --only firestore:rules
```

---

## 📈 Metriche di Successo

### KPI Mensili Attesi

```
✅ Invocations: 2.500 - 3.500
✅ FCM Messages: 60 - 80
✅ Firestore Reads: 25.000 - 35.000
✅ Firestore Writes: 2.000 - 4.000
✅ Errori: 0%
✅ Costo: €0,00
```

### Red Flags

```
❌ Invocations > 10.000
❌ Firestore Reads > 100.000
❌ Errori > 1%
❌ Costo > €1,00
```

---

## 🧪 Test di Stress (Opzionale)

### Test 1: Verifica Hard Limits

Crea gara di test con evento tra 35 minuti:

```javascript
// In Firestore Console, aggiungi documento temporaneo
races/{test-race-id}:
{
  name: "TEST RACE",
  qualiUTC: Timestamp(ora + 35 minuti),
  // ...
}
```

Verifica logs:
- ✅ Funzione rileva evento
- ✅ Invia max 1000 token (anche se ce ne sono 1001)
- ✅ Non reinvia su esecuzione successiva

### Test 2: Verifica Rate Limiting

```bash
# Script per testare rate limit
for i in {1..10}; do
  echo "Call $i:"
  curl -X POST https://europe-west1-fantaf1-b5410.cloudfunctions.net/testNotification
  sleep 1
done

# Verifica: dopo 3 chiamate dovresti vedere 429
```

### Test 3: Verifica Error Handling

Causa errore intenzionale (es. rimuovi temporaneamente VAPID key):

```bash
# Triggera funzione
# Verifica logs
firebase functions:log --only checkUpcomingEvents

# Controlla:
# - ✅ Errore loggato
# - ✅ Funzione NON va in retry infinito
# - ✅ Ritorna null e termina
```

---

## 📞 Contatti Emergenza

In caso di costi imprevisti o problemi:

1. **Disabilita immediatamente:**
   ```bash
   firebase functions:delete checkUpcomingEvents cleanupOldNotifications testNotification
   ```

2. **Contatta Firebase Support:**
   - Console → Help → Contact Support
   - Spiega situazione
   - Richiedi credit se bug di Firebase

3. **Rivedi logs:**
   - Identifica causa root
   - Documenta per prevenzione futura

---

## ✅ Checklist Sicurezza

Prima di andare in produzione:

- [ ] Tutti i `SAFETY_LIMITS` configurati
- [ ] Rate limiting testato e funzionante
- [ ] Budget alerts configurati su Google Cloud
- [ ] Firestore rules deployate
- [ ] Logs monitoring attivo
- [ ] Endpoint stats funzionante
- [ ] Documentazione letta e compresa
- [ ] Piano d'emergenza definito
- [ ] Email alerts verificate

---

**Versione:** 2.0.0
**Ultimo aggiornamento:** Novembre 2025
**Prossima revisione:** Marzo 2026
