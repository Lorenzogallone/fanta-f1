# 🔔 Sistema Notifiche Push - FantaF1

Sistema completo di notifiche push per avvisare gli utenti 30 minuti prima di ogni gara.

---

## 📌 Status

- ✅ **Frontend**: Pronto e funzionante (anche senza backend configurato)
- ⏳ **Backend**: Da configurare quando necessario
- 💰 **Costo**: 100% Gratuito con Firebase Free Tier

---

## 🚀 QUICK START

### Opzione 1: Setup Automatico (Consigliato)

```bash
./setup-notifications.sh
```

Lo script ti guiderà passo-passo nel setup.

### Opzione 2: Setup Manuale

Segui la guida: **[QUICK_START_NOTIFICATIONS.md](./QUICK_START_NOTIFICATIONS.md)**

⏱️ Tempo richiesto: **10 minuti**

---

## 📚 Documentazione

| Documento | Descrizione | Per chi? |
|-----------|-------------|----------|
| **[QUICK_START_NOTIFICATIONS.md](./QUICK_START_NOTIFICATIONS.md)** | Guida rapida step-by-step | ⭐ Inizio qui! |
| **[NOTIFICATIONS_SETUP.md](./NOTIFICATIONS_SETUP.md)** | Documentazione completa e dettagliata | Approfondimenti |
| **[NOTIFICATIONS_INTEGRATION_EXAMPLE.md](./NOTIFICATIONS_INTEGRATION_EXAMPLE.md)** | Esempi di codice per integrare nell'app | Developer |

---

## ⚙️ Stato Attuale

### ✅ Già Fatto

- [x] Frontend components creati
- [x] Hook useNotifications implementato
- [x] Service Worker configurato
- [x] Cloud Functions scritte
- [x] Graceful degradation (app funziona senza notifiche)
- [x] Documentazione completa
- [x] Script di setup automatico

### ⏳ Da Fare (Quando Vuoi)

- [ ] Ottenere VAPID key da Firebase Console
- [ ] Configurare VAPID key in `.env`
- [ ] Aggiornare URL app in `functions/index.js`
- [ ] Deploy Cloud Functions (`firebase deploy --only functions`)
- [ ] Integrare UI nell'app (opzionale)

---

## 🎯 Come Funziona

```
Utente abilita notifiche
        ↓
Token FCM salvato in Firestore
        ↓
Cloud Function gira ogni 15 min
        ↓
Controlla gare che iniziano tra 30-45 min
        ↓
Invia notifica push a tutti gli utenti
        ↓
Utente riceve notifica 30 min prima della gara
```

---

## 💡 Componenti Principali

### Frontend

```
src/
├── hooks/
│   └── useNotifications.js          # Hook per gestire notifiche
├── components/
│   └── NotificationSettings.jsx     # UI per enable/disable
public/
└── firebase-messaging-sw.js         # Service Worker
```

### Backend

```
functions/
├── index.js                         # Cloud Functions
└── package.json                     # Dipendenze
```

---

## 🔧 Configurazione Minima

### File `.env` (root del progetto)

```bash
# Opzionale - App funziona senza!
VITE_FIREBASE_VAPID_KEY=la_tua_vapid_key_qui
```

### `functions/index.js`

```javascript
// Riga ~93 - Aggiorna con il tuo URL
link: 'https://fantaf1-b5410.web.app/lineup',
```

---

## 📱 Integrazione UI

### Esempio Base

```jsx
import NotificationSettings from './components/NotificationSettings';

// In qualsiasi pagina
<NotificationSettings userId={currentUserId} />
```

Vedi **[NOTIFICATIONS_INTEGRATION_EXAMPLE.md](./NOTIFICATIONS_INTEGRATION_EXAMPLE.md)** per più esempi.

---

## 🧪 Testing

### Test Frontend (Browser)

```javascript
// Console del browser
new Notification('Test', { body: 'Funziona!' });
```

### Test Backend (Cloud Function)

```bash
curl -X POST https://europe-west1-fantaf1-b5410.cloudfunctions.net/testNotification
```

---

## 💰 Costi

**100% GRATUITO** con Firebase Free Tier:

- ✅ Cloud Functions: 2M invocazioni/mese
- ✅ Cloud Messaging: Illimitato
- ✅ Cloud Scheduler: 3 jobs gratis
- ✅ Firestore: 50K reads/day

Uso stimato: **~3K invocazioni/mese** (ben dentro il tier gratuito)

---

## 🆘 Supporto

### Problemi Comuni

| Problema | Soluzione |
|----------|-----------|
| "Notification not supported" | Usa Chrome/Firefox/Edge |
| "Service worker failed" | Verifica che `firebase-messaging-sw.js` sia in `/public/` |
| "No registration token" | VAPID key non configurata (app funziona lo stesso!) |

### Logs

```bash
# Visualizza logs Cloud Functions
firebase functions:log --only checkUpcomingRaces
```

### Firestore Collections

- `notificationTokens`: Dispositivi registrati
- `sentNotifications`: Storia notifiche inviate

---

## 🔒 Sicurezza

- ✅ Tokens protetti da Firestore rules
- ✅ Auto-cleanup token invalidi
- ✅ Permessi richiesti esplicitamente
- ✅ HTTPS only

---

## 📊 Monitoring

### Dashboard Firebase

1. Firebase Console → Functions → Dashboard
2. Vedi esecuzioni, errori, performance

### Analytics

```javascript
// In Firestore
sentNotifications/
  └── {notificationId}
      ├── recipientCount: 47
      ├── successCount: 45
      └── failureCount: 2
```

---

## 🎨 Customizzazioni

### Cambia Timing

```javascript
// functions/index.js
const in30Minutes = new Date(now.toDate().getTime() + 60 * 60 * 1000); // 1 ora
```

### Personalizza Messaggio

```javascript
// functions/index.js
notification: {
  title: 'Il tuo messaggio!',
  body: `Personalizza qui!`,
}
```

---

## ✅ Checklist Deployment

Quando vuoi attivare le notifiche:

- [ ] VAPID key ottenuta
- [ ] `.env` configurato
- [ ] URL aggiornato in `functions/index.js`
- [ ] `npm install` in `functions/`
- [ ] `firebase deploy --only functions`
- [ ] Test notifica inviato
- [ ] UI integrata (opzionale)

---

## 🎓 Best Practices

### ✅ DO

- Chiedi permesso al momento giusto
- Mostra il valore delle notifiche
- Fornisci facile opt-out
- Testa su dispositivi reali

### ❌ DON'T

- Non chiedere al primo caricamento
- Non mostrare popup invasivi
- Non inviare troppe notifiche
- Non ignorare gli errori

---

## 📞 Risorse Utili

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Notifications Guide](https://web.dev/push-notifications-overview/)
- [Firebase Pricing](https://firebase.google.com/pricing)

---

## 🎉 Conclusione

Il sistema è **pronto e funzionante**!

- ✅ L'app funziona perfettamente anche senza configurare le notifiche
- ✅ Quando vorrai attivarle, bastano 10 minuti
- ✅ Tutto è 100% gratuito con Firebase
- ✅ Documentazione completa disponibile

**Inizia da**: [QUICK_START_NOTIFICATIONS.md](./QUICK_START_NOTIFICATIONS.md)

---

Fatto con ❤️ per FantaF1
