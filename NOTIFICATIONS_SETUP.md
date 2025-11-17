# 🔔 Guida Completa: Setup Notifiche FantaF1

## 📋 Indice

1. [Panoramica](#panoramica)
2. [Costi e Sicurezza](#costi-e-sicurezza)
3. [Setup Passo-Passo](#setup-passo-passo)
4. [Configurazione Budget Alerts](#configurazione-budget-alerts)
5. [Deploy e Test](#deploy-e-test)
6. [Monitoraggio](#monitoraggio)
7. [Troubleshooting](#troubleshooting)

---

## 📊 Panoramica

Il sistema di notifiche FantaF1 invia promemoria push 30 minuti prima di:
- ⏱️ **Qualifiche** (ogni GP)
- 🏃 **Qualifiche Sprint** (weekend con sprint)
- 🏁 **Gara** (ogni GP)

### Architettura

```
Frontend (React)
    ↓ Registra FCM token
Firestore (notificationTokens)
    ↑ Legge tokens ogni 15 min
Cloud Functions
    ↓ Invia notifiche FCM
Dispositivi utente
```

### Caratteristiche

✅ **Notifiche automatiche** per tutti gli eventi
✅ **Rate limiting** e protezioni anti-costi
✅ **Cleanup automatico** token invalidi
✅ **Deduplicazione** notifiche
✅ **Monitoraggio** statistiche

---

## 💰 Costi e Sicurezza

### Piano Firebase Blaze

**IMPORTANTE:** Le notifiche richiedono il piano **Blaze (Pay-as-you-go)**, MA rimarrai nel **FREE TIER**.

### Utilizzo Stimato (stagione F1 completa)

```
Eventi F1 2025: 24 GP + 6 Sprint = ~78 eventi totali
Notifiche all'anno: 78 × 10 utenti = 780 messaggi
Funzioni eseguite: 96/giorno × 365 = ~35.000/anno

TUTTI DENTRO I LIMITI GRATUITI! ✅
```

### Limiti Gratuiti Blaze

| Servizio | Limite Gratuito | Tuo Utilizzo | % Usato |
|----------|----------------|--------------|---------|
| **Cloud Functions Invocations** | 2M/mese | ~3.000/mese | **0,15%** |
| **Cloud Functions Compute** | 400K GB-sec | ~1K GB-sec | **0,25%** |
| **FCM Messages** | Unlimited | 780/anno | **FREE** |
| **Firestore Reads** | 50K/giorno | ~1K/giorno | **2%** |
| **Firestore Writes** | 20K/giorno | ~100/giorno | **0,5%** |

### 🛡️ Protezioni Anti-Costi Implementate

Il codice include protezioni per evitare costi imprevisti:

1. **Hard Limits**
   ```javascript
   MAX_TOKENS_PER_NOTIFICATION: 1000    // Max destinatari
   MAX_NOTIFICATIONS_PER_RUN: 10        // Max eventi per esecuzione
   MAX_FIRESTORE_READS_PER_RUN: 100     // Previene query explosion
   ```

2. **Rate Limiting**
   - Endpoint di test limitato a 3 chiamate/minuto
   - Previene abusi e loop accidentali

3. **Error Handling**
   - Catch di tutti gli errori
   - No retry automatici (prevenzione loop costosi)
   - Logging dettagliato per debug

4. **Deduplicazione**
   - Ogni notifica inviata una sola volta
   - Check su Firestore prima dell'invio

---

## 🚀 Setup Passo-Passo

### Step 1: Verifica Prerequisiti

```bash
# Verifica che hai Firebase CLI installato
firebase --version

# Se non installato:
npm install -g firebase-tools

# Login a Firebase
firebase login
```

### Step 2: Upgrade a Piano Blaze (SICURO)

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Seleziona il progetto **fantaf1-b5410**
3. Clicca su **⚙️ Impostazioni Progetto** (in basso a sinistra)
4. Vai alla tab **Utilizzo e fatturazione**
5. Clicca su **Modifica piano**
6. Seleziona **Piano Blaze**
7. Inserisci carta di credito (richiesta per verifica, non verrai addebitato nei limiti free)
8. Conferma

**⚠️ NOTA:** Anche se inserisci la carta, rimarrai nei limiti gratuiti. Vedi Step 3 per impostare alert.

### Step 3: Configurare Budget Alerts (FONDAMENTALE)

#### 3.1 Google Cloud Console

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Seleziona il progetto **fantaf1-b5410**
3. Nel menu laterale, vai a **Fatturazione → Budget e avvisi**
4. Clicca **+ Crea budget**

#### 3.2 Configurazione Budget

**Budget 1: Warning Precoce**
```
Nome: FantaF1 - Warning Budget
Importo: €5,00 EUR
Avvisi a:
  - 50% (€2,50) → Email
  - 80% (€4,00) → Email
  - 100% (€5,00) → Email + SMS (se configurato)
```

**Budget 2: Hard Alert**
```
Nome: FantaF1 - Critical Budget
Importo: €10,00 EUR
Avvisi a:
  - 100% (€10,00) → Email + SMS
  - 150% (€15,00) → Email + SMS
```

#### 3.3 Configurazione Email Alerts

1. Inserisci la tua email nell'area **Destinatari avvisi**
2. Seleziona tutte le caselle:
   - ✅ Amministratori progetto
   - ✅ Utenti fatturazione
   - ✅ Email personalizzata: `tua-email@example.com`
3. Salva

### Step 4: Generare VAPID Key

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Seleziona progetto **fantaf1-b5410**
3. Vai su **⚙️ Impostazioni Progetto → Cloud Messaging**
4. Scorri a **Configurazione Web**
5. Se non esiste, clicca **Genera coppia di chiavi**
6. Copia la **chiave pubblica** (VAPID key)

Esempio:
```
BNj8F_xyz123...abc789 (formato Base64)
```

### Step 5: Configurare Variabili d'Ambiente

Crea un file `.env` nella root del progetto:

```bash
# Copia il template
cp .env.example .env

# Modifica il file
nano .env
```

Aggiungi la VAPID key:

```env
# Push Notifications
VITE_FIREBASE_VAPID_KEY=BNj8F_xyz123...abc789
```

**⚠️ NON committare `.env` su git!** (già in `.gitignore`)

### Step 6: Installare Dipendenze Cloud Functions

```bash
cd functions
npm install
cd ..
```

### Step 7: Configurare URL App in Functions

```bash
# Imposta l'URL della tua app Vercel
firebase functions:config:set app.url="https://fanta-f1-rho.vercel.app"

# Verifica
firebase functions:config:get
```

Output atteso:
```json
{
  "app": {
    "url": "https://fanta-f1-rho.vercel.app"
  }
}
```

### Step 8: Deploy Cloud Functions

```bash
# Deploy solo functions (primo deploy)
firebase deploy --only functions

# Output atteso:
# ✔  functions[checkUpcomingEvents(europe-west1)] Successful create operation.
# ✔  functions[cleanupOldNotifications(europe-west1)] Successful create operation.
# ✔  functions[testNotification(europe-west1)] Successful create operation.
# ✔  functions[getNotificationStats(europe-west1)] Successful create operation.
```

⏱️ **Tempo:** ~3-5 minuti per il primo deploy

### Step 9: Deploy Frontend (con VAPID key)

```bash
# Build con env variables
npm run build

# Deploy hosting
firebase deploy --only hosting
```

---

## 🎯 Deploy e Test

### Test 1: Verificare Statistiche

```bash
curl https://europe-west1-fantaf1-b5410.cloudfunctions.net/getNotificationStats
```

Output atteso:
```json
{
  "totalTokens": 0,
  "totalNotificationsSent": 0,
  "recentNotifications": [],
  "safetyLimits": {
    "MAX_TOKENS_PER_NOTIFICATION": 1000,
    "MAX_NOTIFICATIONS_PER_RUN": 10,
    ...
  }
}
```

### Test 2: Registrare Dispositivo

1. Apri l'app: https://fanta-f1-rho.vercel.app
2. Vai su **Impostazioni** o pagina con `<NotificationSettings>`
3. Clicca su **Abilita Notifiche**
4. Accetta permesso browser
5. Verifica toast "Notifiche attivate!"

### Test 3: Inviare Notifica di Test

```bash
curl -X POST https://europe-west1-fantaf1-b5410.cloudfunctions.net/testNotification
```

Output atteso:
```json
{
  "success": true,
  "message": "Test notification sent",
  "totalTokens": 1,
  "successCount": 1,
  "failureCount": 0
}
```

Dovresti ricevere notifica "🧪 Test Notification" sul dispositivo!

### Test 4: Rate Limiting

Prova a chiamare il test 4 volte in 1 minuto:

```bash
for i in {1..4}; do
  echo "Attempt $i:"
  curl -X POST https://europe-west1-fantaf1-b5410.cloudfunctions.net/testNotification
  echo "\n"
done
```

La 4a chiamata dovrebbe restituire:
```json
{
  "error": "Rate limit exceeded. Max 3 calls per minute.",
  "retryAfter": 60
}
```

✅ Rate limiting funziona!

---

## 📈 Monitoraggio

### Logs Cloud Functions

```bash
# Tail live logs
firebase functions:log

# Logs specifici
firebase functions:log --only checkUpcomingEvents
firebase functions:log --only testNotification
```

### Firebase Console

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Seleziona **fantaf1-b5410**
3. Menu laterale → **Functions**
4. Vedi esecuzioni, errori, durata

### Statistiche Firestore

Controlla le collection:

```
notificationTokens/     → Dispositivi registrati
sentNotifications/      → Storia notifiche inviate
```

### Google Cloud Monitoring

1. Vai su [Cloud Console](https://console.cloud.google.com/)
2. Menu → **Monitoraggio**
3. Crea dashboard personalizzata:
   - Invocazioni Cloud Functions
   - Durata esecuzione
   - Errori
   - Costi stimati

---

## 🔧 Troubleshooting

### Problema: "VAPID key not configured"

**Soluzione:**
1. Verifica che `.env` esista nella root
2. Controlla che contenga `VITE_FIREBASE_VAPID_KEY=...`
3. Rebuild: `npm run build`
4. Redeploy: `firebase deploy --only hosting`

### Problema: "No permission to access project"

**Soluzione:**
```bash
firebase login --reauth
firebase use fantaf1-b5410
```

### Problema: Cloud Functions non si deployan

**Errore comune:** "Billing account not configured"

**Soluzione:**
1. Verifica piano Blaze attivo
2. Vai su Cloud Console → Fatturazione
3. Collega account fatturazione al progetto

### Problema: Rate limit su deploy

**Errore:** "Quota exceeded for quota metric"

**Soluzione:**
Aspetta 1-2 minuti tra deploy consecutivi.

### Problema: Notifiche non arrivano

**Checklist:**
1. ✅ VAPID key configurato correttamente?
2. ✅ Cloud Functions deployate?
3. ✅ Token salvato in Firestore? (controlla collection `notificationTokens`)
4. ✅ Evento nelle prossime 30-45 minuti?
5. ✅ Logs Cloud Functions per errori?

**Debug:**
```bash
# Controlla logs in tempo reale
firebase functions:log --only checkUpcomingEvents

# Testa manualmente
curl -X POST https://europe-west1-fantaf1-b5410.cloudfunctions.net/testNotification
```

### Problema: Costi inaspettati

**Azione immediata:**
1. Vai su Cloud Console → Cloud Functions
2. **Disabilita funzioni** temporaneamente:
   ```bash
   firebase functions:delete checkUpcomingEvents
   firebase functions:delete cleanupOldNotifications
   ```
3. Analizza logs per loop o bug
4. Controlla collection Firestore per dimensioni eccessive

**Contatta:** Firebase Support se necessario

---

## 📝 Checklist Finale

Prima di considerare il setup completo:

- [ ] Piano Blaze attivato
- [ ] Budget alerts configurati (€5 e €10)
- [ ] VAPID key generato e configurato
- [ ] Cloud Functions deployate con successo
- [ ] Test notifica inviata e ricevuta
- [ ] Rate limiting verificato
- [ ] Statistiche endpoint funzionante
- [ ] Logs monitorati per errori
- [ ] Email alerts ricevute (testa con budget basso)

---

## 🎉 Conclusione

Se hai seguito tutti gli step, il tuo sistema di notifiche è:

✅ **Operativo** - Invia notifiche automatiche
✅ **Sicuro** - Protetto da costi imprevisti
✅ **Monitorato** - Alert configurati
✅ **Gratuito** - Rimane nei limiti free tier

### Uso Stimato

```
📊 Utilizzo mensile:
  - Invocations: 3.000 / 2.000.000 (0,15%)
  - FCM Messages: 65 / Unlimited (FREE)
  - Firestore Reads: 30.000 / 1.500.000 (2%)

💰 Costo mensile: €0,00
```

---

## 🆘 Supporto

- **Documentazione Firebase:** https://firebase.google.com/docs
- **FCM Documentation:** https://firebase.google.com/docs/cloud-messaging
- **Logs:** `firebase functions:log`
- **Status Firebase:** https://status.firebase.google.com

---

**Autore:** FantaF1 Team
**Versione:** 2.0.0
**Ultimo aggiornamento:** Novembre 2025
