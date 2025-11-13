# Specifica Feature: Late Submission con Penalità

## 📋 Requisiti

### Regole Business
- **Finestra late submission**: 10 minuti dopo la deadline
- **Penalità**: -3 punti
- **Frequenza**: Solo UNA volta per tutto il campionato per utente
- **Scope**: Vale sia per gara principale che sprint

### User Experience
1. **Utente normale** (deadline scaduta da < 10 min):
   - Vede messaggio: "⚠️ La deadline è scaduta! Puoi ancora inserire la formazione con 10 minuti di ritardo"
   - Se non ha mai usato late submission → Modal di conferma con warning -3 punti
   - Se ha già usato → Messaggio: "❌ Hai già usato la possibilità di inserimento in ritardo"

2. **Admin** (AdminPanel):
   - Checkbox: "☑️ Inserimento in ritardo (-3 punti)"
   - Quando marcato, salva con flag `isLate: true`

### Struttura Dati

#### Collection: `ranking/{userId}`
```javascript
{
  name: "Mario Rossi",
  puntiTotali: 45,
  jolly: 2,
  usedLateSubmission: false,  // ← NUOVO CAMPO
  pointsByRace: {...}
}
```

#### Collection: `races/{raceId}/submissions/{userId}`
```javascript
{
  userId: "mario",
  user: "Mario Rossi",
  mainP1: "Max Verstappen",
  mainP2: "Charles Leclerc",
  mainP3: "Lando Norris",
  mainJolly: "Carlos Sainz",
  isLate: true,               // ← NUOVO CAMPO
  latePenalty: -3,            // ← NUOVO CAMPO
  submittedAt: Timestamp
}
```

## 🔧 Implementazione

### File da Modificare

#### 1. `FormationApp.jsx`
**Modifiche:**
```javascript
// 1. Aggiungere stato per late submission
const [isLateSubmission, setIsLateSubmission] = useState(false);
const [showLateModal, setShowLateModal] = useState(false);
const [userUsedLateSubmission, setUserUsedLateSubmission] = useState(false);

// 2. Controllare se utente è in finestra late (deadline < now < deadline + 10min)
const now = Date.now();
const deadline = mode === 'main' ? race.qualiUTC.toMillis() : race.qualiSprintUTC.toMillis();
const tenMinutesAfterDeadline = deadline + (10 * 60 * 1000);
const isInLateWindow = now > deadline && now < tenMinutesAfterDeadline;

// 3. Caricare usedLateSubmission dal ranking quando si seleziona utente
useEffect(() => {
  if (form.userId) {
    const user = ranking.find(u => u.id === form.userId);
    setUserUsedLateSubmission(user?.usedLateSubmission ?? false);
  }
}, [form.userId, ranking]);

// 4. Modificare validazione per permettere late submission
if (!mainOpen && !isInLateWindow) {
  err.push("Deadline gara chiusa.");
} else if (isInLateWindow && userUsedLateSubmission) {
  err.push("Hai già usato la possibilità di inserimento in ritardo.");
}

// 5. Mostrare modal di conferma se in late window
const handleSubmitClick = (mode) => {
  if (isInLateWindow && !userUsedLateSubmission) {
    setShowLateModal(true);
    setSavingMode(mode);
  } else {
    setSavingMode(mode);
    // submit normale
  }
};

// 6. Salvare con flag isLate
if (isInLateWindow) {
  payload.isLate = true;
  payload.latePenalty = -3;

  // Marcare utente come "ha usato late submission"
  await updateDoc(doc(db, "ranking", form.userId), {
    usedLateSubmission: true
  });
}
```

#### 2. `AdminPanel.jsx` - FormationsManager
**Modifiche:**
```javascript
// 1. Aggiungere checkbox per marcare submission come late
const [isLateSubmission, setIsLateSubmission] = useState(false);

// 2. Nel form
<Form.Group className="mb-3">
  <Form.Check
    type="checkbox"
    label="☑️ Inserimento in ritardo (-3 punti)"
    checked={isLateSubmission}
    onChange={(e) => setIsLateSubmission(e.target.checked)}
  />
  <Form.Text className="text-muted">
    Applica penalità di -3 punti per inserimento tardivo
  </Form.Text>
</Form.Group>

// 3. Nel payload di salvataggio
if (isLateSubmission) {
  payload.isLate = true;
  payload.latePenalty = -3;
}
```

#### 3. `pointsCalculator.js`
**Modifiche:**
```javascript
// Nel ciclo delle submissions, dopo aver calcolato mainPts

// Applica penalità late submission
if (s.isLate && s.latePenalty) {
  mainPts += s.latePenalty; // -3
}

// NOTA: La penalità si applica solo alla gara principale, non alla sprint
```

#### 4. `RaceHistoryCard.jsx` e `SubmissionsList.jsx`
**Modifiche:**
```javascript
// Mostrare badge "In Ritardo" se submission.isLate === true

{submission.isLate && (
  <Badge bg="warning" text="dark" className="ms-2">
    ⏰ In Ritardo (-3)
  </Badge>
)}
```

## 🧪 Test Cases

### Test 1: Late Submission Prima Volta
1. Deadline gara: 17:00
2. Ora attuale: 17:05
3. Utente "Mario" non ha mai usato late submission
4. **Risultato**: Modal conferma → Salva con isLate=true → usedLateSubmission=true

### Test 2: Late Submission Già Usata
1. Deadline gara: 17:00
2. Ora attuale: 17:05
3. Utente "Mario" ha già usedLateSubmission=true
4. **Risultato**: Errore "Hai già usato la possibilità"

### Test 3: Fuori Finestra Late (> 10 min)
1. Deadline gara: 17:00
2. Ora attuale: 17:15
3. **Risultato**: Errore "Deadline chiusa"

### Test 4: Admin Marca Come Late
1. Admin aggiunge formazione per "Mario"
2. Spunta checkbox "Inserimento in ritardo"
3. **Risultato**: Salva con isLate=true, latePenalty=-3

### Test 5: Calcolo Punteggi con Late
1. Gara con submission isLate=true
2. Punti normali: 20
3. **Risultato**: 20 + (-3) = 17 punti

## 🎨 UI Components

### Modal Late Submission Confirmation
```jsx
<Modal show={showLateModal} onHide={() => setShowLateModal(false)}>
  <Modal.Header closeButton>
    <Modal.Title>⚠️ Inserimento in Ritardo</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    <Alert variant="warning">
      <strong>Attenzione!</strong>
      <br />
      Stai per inserire la formazione dopo la deadline.
      <br /><br />
      <strong>Conseguenze:</strong>
      <ul className="mb-0 mt-2">
        <li>Riceverai una penalità di <strong>-3 punti</strong></li>
        <li>Questa è la tua <strong>unica possibilità</strong> per tutto il campionato</li>
        <li>Non potrai più farlo in futuro</li>
      </ul>
    </Alert>
    <p className="mb-0">Vuoi procedere?</p>
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => setShowLateModal(false)}>
      Annulla
    </Button>
    <Button variant="warning" onClick={confirmLateSubmission}>
      Sì, Accetto la Penalità
    </Button>
  </Modal.Footer>
</Modal>
```

### Badge Storico Gare
```jsx
{submission.isLate && (
  <Badge bg="warning" text="dark">
    ⏰ In Ritardo (-3)
  </Badge>
)}
```

## 📊 Migration Script

Per utenti esistenti senza il campo `usedLateSubmission`:

```javascript
// Script one-time da eseguire in AdminPanel o console Firebase
const rankingSnap = await getDocs(collection(db, "ranking"));
for (const userDoc of rankingSnap.docs) {
  const data = userDoc.data();
  if (data.usedLateSubmission === undefined) {
    await updateDoc(userDoc.ref, { usedLateSubmission: false });
  }
}
console.log("✅ Migration completata");
```

## ✅ Checklist Implementazione

- [ ] Modificare FormationApp.jsx (late window check + modal)
- [ ] Modificare AdminPanel.jsx (checkbox late submission)
- [ ] Modificare pointsCalculator.js (applica penalità -3)
- [ ] Modificare RaceHistoryCard.jsx (badge visual)
- [ ] Modificare SubmissionsList.jsx (badge visual)
- [ ] Aggiungere migration script per ranking.usedLateSubmission
- [ ] Testare tutti i casi d'uso
- [ ] Build e deploy
