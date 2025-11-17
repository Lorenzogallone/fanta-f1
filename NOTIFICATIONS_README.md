# 🔔 Sistema Notifiche FantaF1

## Panoramica Rapida

Il sistema di notifiche FantaF1 invia **promemoria automatici** 30 minuti prima di ogni evento F1:

- ⏱️ **Qualifiche**
- 🏃 **Qualifiche Sprint**
- 🏁 **Gara**

## 🚀 Quick Start

### 1. Prerequisiti

- Piano Firebase **Blaze** (include free tier)
- Carta di credito (per verifica, costo = €0 nei limiti)

### 2. Setup (5 minuti)

```bash
# 1. Installa dipendenze
cd functions && npm install && cd ..

# 2. Ottieni VAPID key da Firebase Console
# Project Settings → Cloud Messaging → Generate key pair

# 3. Configura environment
cp .env.example .env
# Aggiungi VITE_FIREBASE_VAPID_KEY nel .env

# 4. Deploy functions
firebase deploy --only functions

# 5. Test
curl -X POST https://europe-west1-fantaf1-b5410.cloudfunctions.net/testNotification
```

### 3. Integrazione Frontend

```jsx
import NotificationSettings from './components/NotificationSettings';

function SettingsPage() {
  const { user } = useAuth();

  return (
    <NotificationSettings userId={user.uid} />
  );
}
```

## 💰 Costi

### ✅ Rimani nel FREE TIER

| Risorsa | Limite Free | Uso FantaF1 | % |
|---------|-------------|-------------|---|
| Cloud Functions | 2M invoc/mese | 3K/mese | 0,15% |
| FCM Messages | Unlimited | 780/anno | FREE |
| Firestore Reads | 50K/giorno | 1K/giorno | 2% |

**Costo mensile stimato: €0,00**

## 🛡️ Protezioni Anti-Costi

Il sistema include protezioni automatiche:

```javascript
✅ Max 1000 destinatari per notifica
✅ Max 10 eventi per esecuzione
✅ Rate limiting su endpoint HTTP (3 call/min)
✅ No retry automatici su errori
✅ Deduplicazione notifiche
✅ Cleanup automatico token invalidi
```

## 📊 Monitoraggio

### Statistiche in tempo reale

```bash
# Ottieni stats
curl https://europe-west1-fantaf1-b5410.cloudfunctions.net/getNotificationStats

# Logs live
firebase functions:log --only checkUpcomingEvents
```

### Budget Alerts (IMPORTANTE)

**Imposta subito su Google Cloud Console:**

1. Budget €5 → Alert a 50%, 80%, 100%
2. Budget €10 → Alert a 100%, 150%

Vedi guida completa: [NOTIFICATIONS_SETUP.md](./NOTIFICATIONS_SETUP.md)

## 🏗️ Architettura

```
┌─────────────────────┐
│   Frontend React    │
│  - useNotifications │
│  - NotificationUI   │
└──────────┬──────────┘
           │ Registra FCM token
           ▼
┌─────────────────────┐
│  Firestore DB       │
│  notificationTokens/│
└──────────┬──────────┘
           │ Legge ogni 15 min
           ▼
┌─────────────────────┐
│  Cloud Functions    │
│  checkUpcomingEvents│  ⏰ Ogni 15 min
│  cleanupOld...      │  🧹 Ogni 24h
│  testNotification   │  🧪 HTTP endpoint
└──────────┬──────────┘
           │ Invia FCM
           ▼
┌─────────────────────┐
│  Dispositivi User   │
│  🔔 Notifica push   │
└─────────────────────┘
```

## 🔧 Cloud Functions

### checkUpcomingEvents
- **Trigger:** Ogni 15 minuti
- **Azione:** Controlla eventi nelle prossime 30-45 min
- **Output:** Invia notifiche FCM

### cleanupOldNotifications
- **Trigger:** Ogni 24 ore
- **Azione:** Elimina notifiche > 30 giorni
- **Output:** Database pulito

### testNotification (HTTP)
- **Endpoint:** `POST /testNotification`
- **Rate Limit:** 3 chiamate/minuto
- **Output:** Notifica di test a tutti i dispositivi

### getNotificationStats (HTTP)
- **Endpoint:** `GET /getNotificationStats`
- **Output:** Statistiche sistema

## 📱 Workflow Utente

1. **Utente apre app**
2. **Va su Impostazioni**
3. **Clicca "Abilita Notifiche"**
4. **Browser chiede permesso** → Utente accetta
5. **FCM token salvato** su Firestore
6. **Cloud Function** rileva evento in arrivo
7. **Notifica inviata** 30 min prima dell'evento

## 🧪 Testing

### Test Locale (Emulator)

```bash
# Start emulators
npm run serve

# Test function locale
firebase functions:shell
> checkUpcomingEvents()
```

### Test Produzione

```bash
# Test notifica
curl -X POST https://europe-west1-fantaf1-b5410.cloudfunctions.net/testNotification

# Controlla stats
curl https://europe-west1-fantaf1-b5410.cloudfunctions.net/getNotificationStats

# Logs
firebase functions:log
```

## 📚 Documentazione Completa

Per setup dettagliato, configurazione budget alerts, troubleshooting:

👉 **[NOTIFICATIONS_SETUP.md](./NOTIFICATIONS_SETUP.md)** - Guida completa passo-passo

## 🔒 Sicurezza

### Firestore Rules

Aggiungi a `firestore.rules`:

```javascript
match /notificationTokens/{userId} {
  allow read, write: if request.auth.uid == userId;
}

match /sentNotifications/{notifId} {
  allow read: if request.auth != null;
  allow write: if false; // Solo Cloud Functions
}
```

### Service Worker

Il Service Worker è firmato e serve da:
- `/firebase-messaging-sw.js`
- Gestisce notifiche in background
- Auto-aggiornamento ad ogni deploy

## ❓ FAQ

**Q: Devo pagare qualcosa?**
A: No, rimani nei limiti gratuiti (0,15% del limite).

**Q: Cosa succede se supero i limiti?**
A: Ricevi email alert. Puoi disabilitare le functions immediatamente.

**Q: Funziona su iOS?**
A: Sì, ma richiede app installata come PWA (Add to Home Screen).

**Q: Posso personalizzare gli orari?**
A: Sì, modifica `functions/index.js` linea 267 (attualmente 30 minuti).

**Q: Come disabilito tutto?**
A: `firebase functions:delete checkUpcomingEvents cleanupOldNotifications`

## 🎯 Roadmap

Funzionalità future:
- [ ] Scelta timing personalizzato (15/30/60 min prima)
- [ ] Notifiche per deadline formazione
- [ ] Notifiche risultati gara
- [ ] Multi-lingua
- [ ] Analytics dettagliate

## 📞 Supporto

- **Setup Issues:** Vedi [NOTIFICATIONS_SETUP.md](./NOTIFICATIONS_SETUP.md) → Troubleshooting
- **Logs:** `firebase functions:log`
- **Status Firebase:** https://status.firebase.google.com

---

**Versione:** 2.0.0
**Ultimo aggiornamento:** Novembre 2025
