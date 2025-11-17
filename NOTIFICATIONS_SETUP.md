# 🔔 Setup Notifiche FantaF1 - Guida Pratica

## Cosa fa il sistema
Invia notifiche push 30 minuti prima di:
- Qualifiche
- Sprint (se presente)
- Gara

## ✅ Prerequisiti completati
Hai già fatto:
- ✅ Upgrade a piano Blaze
- ✅ Generato VAPID key

---

## 🚀 Configurazione (3 Step)

### Step 1: Aggiungi VAPID Key al progetto

Crea/modifica il file `.env` nella root del progetto:

```bash
# Copia dalla chiave pubblica che hai generato su Firebase Console
VITE_FIREBASE_VAPID_KEY=BNj8F_xyz123...abc789
```

**⚠️ Importante:** Il file `.env` è già nel `.gitignore`, non verrà committato.

---

### Step 2: Deploy Cloud Functions

Le Cloud Functions controllano gli eventi e inviano le notifiche automaticamente.

```bash
# Entra nella cartella functions
cd functions

# Installa dipendenze (solo la prima volta)
npm install

# Torna alla root
cd ..

# Deploy delle functions
firebase deploy --only functions
```

**⏱️ Tempo:** ~3-5 minuti

**Output atteso:**
```
✔ functions[checkUpcomingEvents] Successful
✔ functions[cleanupOldNotifications] Successful
✔ functions[testNotification] Successful
✔ functions[getNotificationStats] Successful
```

---

### Step 3: Deploy Frontend con Firebase Hosting

```bash
# Build del progetto con la VAPID key
npm run build

# Deploy su Firebase Hosting
firebase deploy --only hosting
```

**✅ Setup completato!**

---

## 🧪 Come Testare

### Test 1: Verifica che le functions siano attive

```bash
curl https://europe-west1-fantaf1-b5410.cloudfunctions.net/getNotificationStats
```

Dovresti vedere:
```json
{
  "totalTokens": 0,
  "totalNotificationsSent": 0,
  ...
}
```

---

### Test 2: Abilita notifiche nell'app

1. Apri la tua app Firebase: `https://fantaf1-b5410.web.app` (o il tuo URL Firebase Hosting)
2. Vai su **Impostazioni** (o dove hai il componente `<NotificationSettings>`)
3. Clicca **Abilita Notifiche**
4. Accetta il permesso del browser
5. Dovresti vedere "Notifiche attivate!"

---

### Test 3: Invia una notifica di prova

```bash
curl -X POST https://europe-west1-fantaf1-b5410.cloudfunctions.net/testNotification
```

**Risultato atteso:**
```json
{
  "success": true,
  "message": "Test notification sent",
  "successCount": 1
}
```

**📱 Dovresti ricevere la notifica "🧪 Test Notification" sul tuo dispositivo!**

---

## 📊 Come Funziona

```
1. Cloud Function "checkUpcomingEvents" gira ogni 15 minuti
2. Controlla se ci sono eventi F1 nelle prossime 30-45 minuti
3. Se sì, legge i token FCM da Firestore (collection: notificationTokens)
4. Invia notifiche push ai dispositivi registrati
5. Salva log in Firestore (collection: sentNotifications)
```

---

## 🔍 Monitoraggio

### Vedere i logs delle functions

```bash
# Logs in tempo reale
firebase functions:log

# Logs specifici
firebase functions:log --only checkUpcomingEvents
```

### Verificare i token registrati

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Seleziona progetto **fantaf1-b5410**
3. Firestore Database
4. Collection `notificationTokens` → vedi i dispositivi registrati
5. Collection `sentNotifications` → vedi le notifiche inviate

---

## ⚠️ Troubleshooting

### Problema: "VAPID key not configured"
**Soluzione:**
```bash
# Verifica che il file .env esista e contenga la chiave
cat .env

# Rebuild e redeploy
npm run build
firebase deploy --only hosting
```

---

### Problema: Notifiche non arrivano
**Checklist:**
1. ✅ File `.env` con VAPID key presente?
2. ✅ Cloud Functions deployate? (`firebase deploy --only functions`)
3. ✅ Token salvato in Firestore? (controlla collection `notificationTokens`)
4. ✅ Hai fatto il test manuale? (`curl -X POST ...testNotification`)

**Debug:**
```bash
# Guarda i logs
firebase functions:log --only checkUpcomingEvents

# Verifica statistiche
curl https://europe-west1-fantaf1-b5410.cloudfunctions.net/getNotificationStats
```

---

### Problema: Cloud Functions non si deployan
**Errore:** "Billing account not configured"

**Soluzione:**
1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Seleziona progetto **fantaf1-b5410**
3. Menu → **Fatturazione**
4. Collega account fatturazione al progetto
5. Riprova deploy

---

## 💰 Costi e Sicurezza

**Non ti preoccupare dei costi!** Il sistema ha protezioni integrate:

- ✅ Rate limiting: max 3 test al minuto
- ✅ Max 1000 destinatari per notifica
- ✅ Max 10 notifiche per esecuzione
- ✅ Tutto rimane nel FREE TIER di Firebase

**Utilizzo stimato annuale:**
```
Eventi F1: ~78 (24 GP + Sprint)
Notifiche inviate: ~780 all'anno (con 10 utenti)
Costo: €0,00 (tutto gratis!)
```

**Budget Alert consigliato:**
1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Fatturazione → Budget e avvisi
3. Crea budget: €5,00 con alert al 50%, 80%, 100%
4. Aggiungi la tua email per ricevere alert

---

## ✅ Checklist Finale

- [ ] File `.env` con VAPID key creato
- [ ] Cloud Functions deployate (`firebase deploy --only functions`)
- [ ] Frontend deployato (`firebase deploy --only hosting`)
- [ ] Test notifica ricevuta con successo
- [ ] Token visibile in Firestore collection `notificationTokens`
- [ ] Budget alert configurato su Google Cloud

---

## 🎉 Fine!

Se hai completato tutti gli step, il sistema è pronto e invierà automaticamente le notifiche prima degli eventi F1!

**Prossimi passi:**
- Aspetta il prossimo evento F1
- Riceverai la notifica 30 minuti prima
- Controlla i logs per vedere l'esecuzione automatica

---

**Supporto:**
- Logs: `firebase functions:log`
- Docs Firebase: https://firebase.google.com/docs/cloud-messaging
- Status: https://status.firebase.google.com
