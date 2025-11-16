# 🔔 Sistema di Notifiche Push - Guida Completa

Sistema di notifiche per avvisare gli utenti 30 minuti prima di ogni gara usando **solo servizi gratuiti di Firebase**.

---

## 📋 Architettura

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                     │
│  - Richiesta permessi notifiche                        │
│  - Registrazione FCM token                             │
│  - UI per enable/disable notifiche                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│               FIRESTORE DATABASE                        │
│  Collection: notificationTokens                         │
│    - userId                                             │
│    - token (FCM)                                        │
│    - createdAt                                          │
│                                                         │
│  Collection: sentNotifications (history)                │
│    - raceId                                             │
│    - sentAt                                             │
│    - recipientCount                                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│           CLOUD FUNCTIONS (Scheduled)                   │
│  - checkUpcomingRaces (ogni 15 minuti)                 │
│  - cleanupOldNotifications (ogni 24 ore)               │
│  - testNotification (HTTP per testing)                 │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│        FIREBASE CLOUD MESSAGING (FCM)                   │
│  - Invio notifiche push                                │
│  - Gestione background/foreground                      │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 SETUP PASSO PER PASSO

### **STEP 1: Abilita Firebase Cloud Messaging**

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Seleziona il progetto `fantaf1-b5410`
3. Vai su **Project Settings** (⚙️ icona in alto a sinistra)
4. Tab **Cloud Messaging**
5. In **Web Push certificates** → Clicca **Generate key pair**
6. Copia la **VAPID key** generata

### **STEP 2: Configura VAPID Key nel Frontend**

Apri `/src/hooks/useNotifications.js` e sostituisci:

```javascript
const VAPID_KEY = 'YOUR_VAPID_KEY_HERE';
```

con la tua VAPID key copiata.

### **STEP 3: Aggiorna URL nel Service Worker**

Apri `/functions/index.js` e cerca:

```javascript
link: 'https://your-app-url.com/lineup',
```

Sostituisci con l'URL reale della tua app (es. `https://fantaf1.web.app/lineup`).

### **STEP 4: Installa Firebase CLI (se non l'hai già)**

```bash
npm install -g firebase-tools
firebase login
```

### **STEP 5: Inizializza Cloud Functions**

```bash
cd functions
npm install
```

### **STEP 6: Deploy Cloud Functions**

```bash
# Deploy tutte le functions
firebase deploy --only functions

# Oppure deploy singola function
firebase deploy --only functions:checkUpcomingRaces
```

### **STEP 7: Verifica il Deployment**

Dopo il deploy, vedrai output simile a:

```
✔  functions[checkUpcomingRaces(europe-west1)] Successful create operation.
✔  functions[cleanupOldNotifications(europe-west1)] Successful create operation.
✔  functions[testNotification(europe-west1)] Successful create operation.
```

---

## 🧪 TESTING

### **Test 1: Verifica Service Worker**

1. Apri l'app in Chrome
2. Vai su **DevTools** → **Application** → **Service Workers**
3. Dovresti vedere `firebase-messaging-sw.js` registrato

### **Test 2: Richiedi Permessi Notifiche**

Aggiungi il componente alla Home page:

```jsx
// In src/pages/Home.jsx
import NotificationSettings from '../components/NotificationSettings';

// Dentro il componente, assuming you have userId
<NotificationSettings userId={currentUserId} />
```

### **Test 3: Invia Notifica di Test**

Usa la function HTTP per testare:

```bash
curl -X POST https://europe-west1-fantaf1-b5410.cloudfunctions.net/testNotification
```

Oppure da Postman/Insomnia.

### **Test 4: Simula Gara Imminente**

1. Vai su Firestore Console
2. Modifica una gara esistente
3. Imposta `raceUTC` a ~35 minuti nel futuro
4. Aspetta che la Cloud Function venga eseguita (max 15 minuti)
5. Dovresti ricevere la notifica

---

## 💰 COSTI (Tier Gratuito)

### Firebase Free Tier Include:

| Servizio | Quota Gratuita | Uso Stimato |
|----------|----------------|-------------|
| **Cloud Functions** | 2M invocazioni/mese | ~3K/mese ✅ |
| **Cloud Messaging** | Illimitato | ∞ ✅ |
| **Cloud Scheduler** | 3 jobs gratis | 2 jobs ✅ |
| **Firestore** | 50K reads/day | ~1K/day ✅ |

**Totale costo mensile: €0** 🎉

### Calcolo Dettagliato:

- **checkUpcomingRaces**: Ogni 15 min = 96/giorno = 2,880/mese
- **cleanupOldNotifications**: 1/giorno = 30/mese
- **Firestore reads**: ~100 tokens × 96 check = ~10K/mese
- **FCM messages**: ~100 utenti × 20 gare = 2,000 notifiche/anno

---

## 📱 INTEGRAZIONE FRONTEND

### Opzione 1: Aggiungi alle Impostazioni Utente

```jsx
// In qualsiasi pagina dove hai userId
import NotificationSettings from '../components/NotificationSettings';

<NotificationSettings userId={userId} />
```

### Opzione 2: Mostra Banner se Non Abilitato

```jsx
import { useNotifications } from '../hooks/useNotifications';

function MyComponent({ userId }) {
  const { isEnabled, requestPermission } = useNotifications(userId);

  if (!isEnabled) {
    return (
      <Alert variant="info">
        <strong>🔔 Never miss a race!</strong>
        <Button onClick={requestPermission}>Enable Notifications</Button>
      </Alert>
    );
  }

  return <div>Your content</div>;
}
```

### Opzione 3: Auto-richiesta al Primo Accesso

```jsx
// In App.jsx o Home.jsx
useEffect(() => {
  const hasAskedBefore = localStorage.getItem('notification-asked');

  if (!hasAskedBefore && userId) {
    // Aspetta 5 secondi prima di chiedere (UX migliore)
    setTimeout(() => {
      requestPermission();
      localStorage.setItem('notification-asked', 'true');
    }, 5000);
  }
}, [userId]);
```

---

## 🔍 MONITORING & DEBUG

### Visualizza Logs delle Cloud Functions

```bash
# Logs in tempo reale
firebase functions:log --only checkUpcomingRaces

# Logs recenti
firebase functions:log --limit 100
```

### Controlla Firestore Collections

1. **notificationTokens**: Lista di tutti i dispositivi registrati
2. **sentNotifications**: Storia delle notifiche inviate
3. Verifica che i tokens siano salvati correttamente

### Debug Problemi Comuni

**❌ "Notification permission denied"**
- L'utente ha bloccato le notifiche
- Devi guidarlo a sbloccarle manualmente nelle impostazioni browser

**❌ "Service worker registration failed"**
- Verifica che `firebase-messaging-sw.js` sia in `/public/`
- Controlla la console del browser per errori

**❌ "No registration token available"**
- VAPID key non configurata correttamente
- Verifica che sia la chiave corretta dal Firebase Console

**❌ "Function execution timeout"**
- Aumenta il timeout nelle Cloud Functions (default 60s, max 540s gratuito)
- Ottimizza le query Firestore

---

## 📊 STRUTTURA FIRESTORE

### Collection: `notificationTokens`

```javascript
{
  "userId_123": {
    "token": "fcm_token_string...",
    "userId": "userId_123",
    "createdAt": Timestamp,
    "platform": "web",
    "userAgent": "Mozilla/5.0..."
  }
}
```

### Collection: `sentNotifications`

```javascript
{
  "raceId_30min": {
    "raceId": "bahrain-2025",
    "raceName": "Bahrain Grand Prix",
    "raceTime": Timestamp,
    "sentAt": Timestamp,
    "recipientCount": 47,
    "successCount": 45,
    "failureCount": 2
  }
}
```

---

## 🔒 SICUREZZA

### Firestore Security Rules

Aggiungi queste regole in `firestore.rules`:

```javascript
// Notification tokens - users can only write their own
match /notificationTokens/{userId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.uid == userId;
}

// Sent notifications - read only for admins
match /sentNotifications/{notificationId} {
  allow read: if isAdmin();
  allow write: if false; // Solo Cloud Functions possono scrivere
}
```

### Validazione Token

Le Cloud Functions puliscono automaticamente i token non validi quando FCM ritorna errori.

---

## 🎯 CUSTOMIZZAZIONI AVANZATE

### Personalizza il Timing

Modifica in `/functions/index.js`:

```javascript
// Cambia da 30 minuti a 1 ora
const in30Minutes = new Date(now.toDate().getTime() + 60 * 60 * 1000);
const in45Minutes = new Date(now.toDate().getTime() + 75 * 60 * 1000);
```

### Aggiungi Notifica per Sprint

```javascript
// Controlla anche qualiSprintUTC nelle gare
const sprintRaces = await admin
  .firestore()
  .collection('races')
  .where('qualiSprintUTC', '>=', admin.firestore.Timestamp.fromDate(in30Minutes))
  .where('qualiSprintUTC', '<=', admin.firestore.Timestamp.fromDate(in45Minutes))
  .get();
```

### Notifiche Personalizzate per Utente

Salva preferenze utente in Firestore:

```javascript
// Collection: userPreferences
{
  "userId_123": {
    "notifyRace": true,
    "notifySprint": true,
    "notifyQualifying": false,
    "minutesBefore": 30
  }
}
```

---

## 📚 RISORSE UTILI

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Cloud Functions Docs](https://firebase.google.com/docs/functions)
- [Web Push Notifications Guide](https://web.dev/push-notifications-overview/)
- [Firebase Pricing](https://firebase.google.com/pricing)

---

## ✅ CHECKLIST PRE-PRODUZIONE

- [ ] VAPID key configurata
- [ ] Service Worker funzionante
- [ ] Cloud Functions deployed
- [ ] URL app aggiornato nelle functions
- [ ] Test notifiche inviato con successo
- [ ] Firestore security rules aggiornate
- [ ] Monitoring attivato
- [ ] UI component aggiunto all'app
- [ ] Testato su diversi browser (Chrome, Firefox, Edge)
- [ ] Testato su mobile (PWA)

---

## 🆘 SUPPORTO

Per problemi o domande:
1. Controlla i logs: `firebase functions:log`
2. Verifica Firestore Console per tokens e notifications
3. Testa con la function `testNotification`
4. Controlla la console del browser per errori

---

**Sistema pronto per produzione! 🚀**
