# 🚀 Guida Veloce - Attivazione Notifiche Push

**Tempo richiesto: 10 minuti**
**Difficoltà: Facile** ⭐

> ⚠️ **IMPORTANTE**: L'app funziona perfettamente anche SENZA attivare le notifiche!
> Questa guida è opzionale e puoi farla quando vuoi.

---

## ✅ Prerequisiti

- [x] App già deployata su Firebase Hosting
- [x] Firebase CLI installato (`npm install -g firebase-tools`)
- [x] Accesso a Firebase Console

---

## 📝 STEP 1: Ottieni la VAPID Key (2 minuti)

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Seleziona il progetto **fantaf1-b5410**
3. Clicca sull'icona ⚙️ in alto a sinistra → **Project Settings**
4. Vai alla tab **Cloud Messaging**
5. Scorri fino a **Web Push certificates**
6. Clicca **Generate key pair**
7. **COPIA** la chiave generata (inizia con `B...`)

📸 Screenshot: La chiave apparirà come:
```
BPxY...lunga_stringa_di_caratteri...XYZ
```

---

## 🔧 STEP 2: Configura la VAPID Key nel Progetto (1 minuto)

### Opzione A: File .env (Consigliato per Development)

1. Crea un file `.env` nella root del progetto:
```bash
# Nella root di fanta-f1/
touch .env
```

2. Apri `.env` e aggiungi:
```bash
VITE_FIREBASE_VAPID_KEY=LA_TUA_VAPID_KEY_COPIATA
```

3. Verifica che `.env` sia nel `.gitignore` (già configurato ✓)

### Opzione B: Firebase Hosting Environment Variables (Consigliato per Production)

```bash
# Deploy con variabile d'ambiente
firebase deploy --only hosting --set-env VITE_FIREBASE_VAPID_KEY="LA_TUA_VAPID_KEY"
```

---

## 🌐 STEP 3: Aggiorna URL App nelle Cloud Functions (1 minuto)

1. Apri `functions/index.js`
2. Cerca questa riga (circa riga 93):
```javascript
link: 'https://your-app-url.com/lineup',
```

3. Sostituisci con l'URL reale della tua app:
```javascript
link: 'https://fantaf1-b5410.web.app/lineup',
```

**Come trovare il tuo URL:**
- Firebase Console → Hosting → Domains
- Oppure è il link che vedi dopo `firebase deploy`

---

## 📦 STEP 4: Deploy Cloud Functions (3 minuti)

```bash
# 1. Entra nella cartella functions
cd functions

# 2. Installa dipendenze (solo la prima volta)
npm install

# 3. Torna alla root
cd ..

# 4. Deploy delle Cloud Functions
firebase deploy --only functions
```

**Cosa succede:**
```
✔ functions[checkUpcomingRaces(europe-west1)] deployed
✔ functions[cleanupOldNotifications(europe-west1)] deployed
✔ functions[testNotification(europe-west1)] deployed
```

⏱️ Il deploy richiede 2-3 minuti. Aspetta che finisca!

---

## 🧪 STEP 5: Test (2 minuti)

### Test 1: Verifica Frontend

1. Apri l'app in Chrome/Firefox
2. Vai su DevTools (F12) → **Console**
3. Dovrebbe apparire:
```
Service Worker registered
```
4. Se vedi errori, ricarica la pagina (CTRL+F5)

### Test 2: Invia Notifica di Prova

```bash
# Copia l'URL dalla console dopo il deploy
curl -X POST https://europe-west1-fantaf1-b5410.cloudfunctions.net/testNotification
```

**Risposta attesa:**
```json
{
  "success": true,
  "totalTokens": 0,
  "successCount": 0,
  "failureCount": 0
}
```

> È normale che sia 0 se nessun utente ha ancora abilitato le notifiche!

### Test 3: Abilita Notifiche come Utente

1. Apri l'app
2. Dovresti vedere il componente notifiche (se integrato)
3. Clicca "Enable Notifications"
4. Browser chiederà il permesso → Clicca "Allow"
5. Ri-esegui il curl test sopra
6. Ora dovresti ricevere la notifica! 🔔

---

## 🎯 STEP 6: Integra nell'App (1 minuto)

Scegli dove mostrare le notifiche nell'app.

### Opzione A: Settings/Profile Page (Consigliato)

```jsx
// In src/pages/Settings.jsx (o dove vuoi)
import NotificationSettings from '../components/NotificationSettings';

export default function Settings() {
  const userId = "current-user-id"; // Prendi dall'auth

  return (
    <Container>
      <h2>Settings</h2>

      {/* Componente notifiche */}
      <NotificationSettings userId={userId} />

      {/* Altri settings */}
    </Container>
  );
}
```

### Opzione B: Home Page Banner

```jsx
// In src/pages/Home.jsx
import { useNotifications } from '../hooks/useNotifications';
import { Alert, Button } from 'react-bootstrap';

export default function Home() {
  const userId = "current-user-id";
  const { isSupported, isEnabled, requestPermission } = useNotifications(userId);

  return (
    <Container>
      {isSupported && !isEnabled && (
        <Alert variant="info" className="mb-4">
          <strong>🔔 Never miss a race!</strong>
          <Button onClick={requestPermission}>Enable Notifications</Button>
        </Alert>
      )}

      {/* Rest of home page */}
    </Container>
  );
}
```

### Opzione C: Non Integrare Ora

Puoi anche NON integrare l'UI e farlo più tardi. Il sistema è pronto!

---

## ✅ CHECKLIST FINALE

Segna quando hai completato:

- [ ] ✅ VAPID key ottenuta da Firebase Console
- [ ] ✅ VAPID key configurata in `.env` o hosting env vars
- [ ] ✅ URL app aggiornato in `functions/index.js`
- [ ] ✅ `npm install` eseguito in `functions/`
- [ ] ✅ `firebase deploy --only functions` completato con successo
- [ ] ✅ Test con `curl` funzionante
- [ ] ✅ (Opzionale) UI integrata nell'app

---

## 🎉 FATTO!

Le notifiche sono attive! Ora:

- ✅ Gli utenti possono abilitare le notifiche
- ✅ Riceveranno alert 30 minuti prima di ogni gara
- ✅ Il sistema gira automaticamente ogni 15 minuti
- ✅ I token invalidi vengono puliti automaticamente

---

## 🆘 Problemi Comuni

### "Service worker registration failed"

**Soluzione:**
1. Verifica che `firebase-messaging-sw.js` sia in `/public/`
2. Ricarica con CTRL+F5
3. Cancella cache browser

### "No registration token available"

**Soluzione:**
1. Verifica che VAPID key sia corretta in `.env`
2. Riavvia dev server: `npm run dev`
3. Controlla console browser per errori

### "Function deployment failed"

**Soluzione:**
```bash
# Riprova con più dettagli
firebase deploy --only functions --debug
```

### "CORS error" quando testi con curl

**Soluzione:**
- È normale! Il curl funziona solo da backend
- Per testare da browser, usa Postman o Thunder Client

---

## 📊 Monitoring

### Visualizza logs Cloud Functions

```bash
# Logs in tempo reale
firebase functions:log --only checkUpcomingRaces

# Ultimi 100 logs
firebase functions:log --limit 100
```

### Controlla Firestore

1. Firebase Console → Firestore Database
2. Collections:
   - **notificationTokens**: Dispositivi registrati
   - **sentNotifications**: Storia notifiche inviate

---

## 🔧 Configurazioni Avanzate (Opzionale)

### Cambia timing (es. 1 ora prima invece di 30 min)

In `functions/index.js`, cambia:
```javascript
// Riga ~21
const in30Minutes = new Date(now.toDate().getTime() + 60 * 60 * 1000); // 1 ora
const in45Minutes = new Date(now.toDate().getTime() + 75 * 60 * 1000); // 1 ora e 15
```

### Aggiungi notifiche per Sprint

Copia la logica delle gare e aggiungi check per `qualiSprintUTC`

### Personalizza messaggio notifica

In `functions/index.js`, riga ~75:
```javascript
const payload = {
  notification: {
    title: '🏁 Il tuo messaggio!',
    body: `${race.name} personalizza qui!`,
  },
  // ...
};
```

Poi rideploy: `firebase deploy --only functions`

---

## 📚 Documentazione Completa

Per approfondimenti:
- `NOTIFICATIONS_SETUP.md` - Setup dettagliato
- `NOTIFICATIONS_INTEGRATION_EXAMPLE.md` - Esempi codice
- [Firebase FCM Docs](https://firebase.google.com/docs/cloud-messaging)

---

**Fatto! Sistema notifiche attivo! 🎊**

Hai domande? Controlla i logs o consulta la documentazione completa.
