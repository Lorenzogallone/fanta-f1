# Implementazione Late Submission - Checklist e Codice

## ✅ Completate

### 1. pointsCalculator.js
- ✅ Aggiunta applicazione penalità -3 punti per `isLate` submissions

---

## 🔄 DA COMPLETARE

### 2. FormationApp.jsx - MODIFICHE PRINCIPALI

#### A. Aggiungere import Modal
```javascript
import {
  // ... existing imports
  Modal,
} from "react-bootstrap";
```

#### B. Aggiungere stati (dopo riga 66 circa)
```javascript
const [showLateModal, setShowLateModal] = useState(false);
const [userUsedLateSubmission, setUserUsedLateSubmission] = useState(false);
const [currentLateMode, setCurrentLateMode] = useState(null);
```

#### C. Caricare usedLateSubmission (dopo useEffect ranking, circa riga 97)
```javascript
// Carica se utente ha già usato late submission
useEffect(() => {
  if (form.userId) {
    const user = ranking.find(u => u.id === form.userId);
    setUserUsedLateSubmission(user?.usedLateSubmission ?? false);
  }
}, [form.userId, ranking]);
```

#### D. Modificare la logica validazione (circa riga 231-249)
```javascript
const validate = (mode) => {
  const err = [];
  if (!form.userId) err.push("Scegli l'utente.");
  if (!form.raceId) err.push("Scegli la gara.");

  const now = Date.now();
  const deadline = mode === "main"
    ? race.qualiUTC?.toMillis()
    : race.qualiSprintUTC?.toMillis();
  const tenMinutesAfterDeadline = deadline + (10 * 60 * 1000);
  const isInLateWindow = now > deadline && now <= tenMinutesAfterDeadline;

  if (mode === "main") {
    // Permetti se:
    // 1. Deadline aperta (mainOpen) OPPURE
    // 2. In finestra late E non ha ancora usato late submission
    if (!mainOpen && !isInLateWindow) {
      err.push("Deadline gara chiusa.");
    } else if (isInLateWindow && userUsedLateSubmission) {
      err.push("❌ Hai già usato la possibilità di inserimento in ritardo.");
    }

    if (!fullMain) err.push("Completa tutti i campi obbligatori della gara principale.");
    if (hasMainDuplicates)
      err.push(`Non puoi selezionare lo stesso pilota più volte nella gara: ${mainDuplicates.join(", ")}`);
  } else {
    // SPRINT
    if (!isSprintRace) err.push("Questa gara non prevede Sprint.");

    const sprintDeadline = race.qualiSprintUTC?.toMillis();
    const tenMinAfterSprint = sprintDeadline + (10 * 60 * 1000);
    const isInLateSprint = now > sprintDeadline && now <= tenMinAfterSprint;

    if (!sprOpen && !isInLateSprint) {
      err.push("Deadline sprint chiusa.");
    } else if (isInLateSprint && userUsedLateSubmission) {
      err.push("❌ Hai già usato la possibilità di inserimento in ritardo.");
    }

    if (!fullSpr) err.push("Completa tutti i campi obbligatori della sprint.");
    if (hasSprintDuplicates)
      err.push(`Non puoi selezionare lo stesso pilota più volte nella sprint: ${sprintDuplicates.join(", ")}`);
  }
  return err;
};
```

#### E. Modificare il salvataggio (circa riga 270-333)
```javascript
const save = async (e) => {
  e.preventDefault();
  setFlash(null);
  setTouched(true);
  const mode = savingMode;
  if (!mode || !race) return;

  const errs = validate(mode);
  if (errs.length) {
    setFlash({ type: "danger", msg: errs.join(" ") });
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const now = Date.now();
  const deadline = mode === "main"
    ? race.qualiUTC?.toMillis()
    : race.qualiSprintUTC?.toMillis();
  const tenMinutesAfterDeadline = deadline + (10 * 60 * 1000);
  const isInLateWindow = now > deadline && now <= tenMinutesAfterDeadline;

  // Se in late window e non ha ancora usato → mostra modal
  if (isInLateWindow && !userUsedLateSubmission && !isEditMode) {
    setCurrentLateMode(mode);
    setShowLateModal(true);
    return; // Interrompi qui, continua dopo conferma modal
  }

  // Procedi con salvataggio normale o dopo conferma modal
  await performSave(mode, isInLateWindow);
};

// Nuova funzione separata per il salvataggio effettivo
const performSave = async (mode, isLate = false) => {
  const me = ranking.find((u) => u.id === form.userId);
  const payload = {
    userId: form.userId,
    user: me?.name ?? "",
  };

  if (mode === "main") {
    Object.assign(payload, {
      mainP1: form.P1.value,
      mainP2: form.P2.value,
      mainP3: form.P3.value,
      mainJolly: form.jolly.value,
      ...(form.jolly2 ? { mainJolly2: form.jolly2.value } : {}),
    });
  } else {
    Object.assign(payload, {
      sprintP1: form.sprintP1.value,
      sprintP2: form.sprintP2.value,
      sprintP3: form.sprintP3.value,
      sprintJolly: form.sprintJolly.value,
    });
  }

  // Aggiungi flag late submission se necessario
  if (isLate) {
    payload.isLate = true;
    payload.latePenalty = -3;
  }

  try {
    await setDoc(doc(db, "races", form.raceId, "submissions", form.userId), payload, { merge: true });

    // Se late submission, marca utente come "ha usato"
    if (isLate) {
      await updateDoc(doc(db, "ranking", form.userId), {
        usedLateSubmission: true
      });
      setUserUsedLateSubmission(true);
    }

    // Gestione jolly2
    if (mode === "main" && form.jolly2) {
      await updateDoc(doc(db, "ranking", form.userId), { jolly: increment(-1) });
      setUserJolly((p) => p - 1);
    }

    setFlash({
      type: "success",
      msg: isLate
        ? "✓ Formazione salvata IN RITARDO! Penalità: -3 punti"
        : mode === "main"
        ? isEditMode
          ? "✓ Gara aggiornata con successo!"
          : "✓ Formazione gara salvata con successo!"
        : isEditMode
        ? "✓ Sprint aggiornata con successo!"
        : "✓ Formazione sprint salvata con successo!",
    });
    setRefreshKey(Date.now());
    setSavingMode(null);
    setShowLateModal(false);
    setCurrentLateMode(null);
    setTouched(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error(err);
    setFlash({ type: "danger", msg: "❌ Errore nel salvataggio: " + err.message });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

// Handler conferma modal late
const handleConfirmLateSubmission = () => {
  performSave(currentLateMode, true);
};
```

#### F. Aggiungere Modal nel JSX (prima della chiusura Container, circa fine file)
```javascript
{/* Modal conferma late submission */}
<Modal show={showLateModal} onHide={() => {
  setShowLateModal(false);
  setSavingMode(null);
  setCurrentLateMode(null);
}}>
  <Modal.Header closeButton>
    <Modal.Title>⚠️ Inserimento in Ritardo</Modal.Title>
  </Modal.Header>
  <Modal.Body>
    <Alert variant="warning">
      <strong>Attenzione!</strong>
      <br />
      Stai per inserire la formazione <strong>dopo la deadline</strong>.
      <br /><br />
      <strong>Conseguenze:</strong>
      <ul className="mb-0 mt-2">
        <li>Riceverai una penalità di <strong>-3 punti</strong></li>
        <li>Questa è la tua <strong>unica possibilità</strong> per tutto il campionato</li>
        <li>Non potrai più farlo in futuro per nessuna gara</li>
      </ul>
    </Alert>
    <p className="mb-0">Vuoi procedere comunque?</p>
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => {
      setShowLateModal(false);
      setSavingMode(null);
      setCurrentLateMode(null);
    }}>
      Annulla
    </Button>
    <Button variant="warning" onClick={handleConfirmLateSubmission}>
      Sì, Accetto la Penalità (-3)
    </Button>
  </Modal.Footer>
</Modal>
```

---

### 3. AdminPanel.jsx - FormationsManager

#### Aggiungere stato late submission (circa riga 380)
```javascript
const [isLateSubmission, setIsLateSubmission] = useState(false);
```

#### Resettare stato quando cambia gara/utente (circa riga 460)
```javascript
const resetForm = () => {
  setFormData({
    mainP1: null,
    mainP2: null,
    mainP3: null,
    mainJolly: null,
    mainJolly2: null,
    sprintP1: null,
    sprintP2: null,
    sprintP3: null,
    sprintJolly: null,
  });
  setIsLateSubmission(false); // ← AGGIUNGERE
};
```

#### Pre-compilare se submission esistente è late (circa riga 476)
```javascript
if (off) {
  setFormData({
    mainP1: findDriverOption(data.mainP1),
    mainP2: findDriverOption(data.mainP2),
    mainP3: findDriverOption(data.mainP3),
    mainJolly: findDriverOption(data.mainJolly),
    mainJolly2: findDriverOption(data.mainJolly2),
    sprintP1: findDriverOption(data.sprintP1),
    sprintP2: findDriverOption(data.sprintP2),
    sprintP3: findDriverOption(data.sprintP3),
    sprintJolly: findDriverOption(data.sprintJolly),
  });
  setIsLateSubmission(data.isLate ?? false); // ← AGGIUNGERE
} else {
  resetForm();
}
```

#### Aggiungere checkbox nel form (circa dopo riga 828, prima di "Sprint")
```javascript
<Form.Group className="mb-3">
  <Form.Check
    type="checkbox"
    label="⏰ Inserimento in ritardo (-3 punti)"
    checked={isLateSubmission}
    onChange={(e) => setIsLateSubmission(e.target.checked)}
  />
  <Form.Text className="text-muted">
    Applica penalità di -3 punti per inserimento tardivo (vale una sola volta per utente)
  </Form.Text>
</Form.Group>
```

#### Includere nel payload di salvataggio (circa riga 632)
```javascript
const payload = {
  user: user?.name || selectedUser,
  userId: selectedUser,
  mainP1: formData.mainP1.value,
  mainP2: formData.mainP2.value,
  mainP3: formData.mainP3.value,
  mainJolly: formData.mainJolly.value,
  mainJolly2: formData.mainJolly2?.value || null,
  sprintP1: formData.sprintP1?.value || null,
  sprintP2: formData.sprintP2?.value || null,
  sprintP3: formData.sprintP3?.value || null,
  sprintJolly: formData.sprintJolly?.value || null,
  submittedAt: Timestamp.now(),
};

// Aggiungi flag late se marcato
if (isLateSubmission) {
  payload.isLate = true;
  payload.latePenalty = -3;

  // Marca utente come "ha usato late submission"
  await updateDoc(doc(db, "ranking", selectedUser), {
    usedLateSubmission: true
  });
}

await setDoc(doc(db, "races", selectedRace.id, "submissions", selectedUser), payload, {
  merge: true,
});
```

---

### 4. RaceHistoryCard.jsx - Visualizzazione Penalità

#### Aggiungere badge per late submission (circa dove vengono mostrati i punti)

Nel layout mobile (circa riga 350):
```javascript
<div className="d-flex justify-content-between align-items-center mb-2">
  <h6 className="mb-0" style={{ color: accentColor }}>
    {idx + 1}. {userName}
    {s.isLate && (
      <Badge bg="warning" text="dark" className="ms-2">
        ⏰ In Ritardo (-3)
      </Badge>
    )}
  </h6>
  {showPoints && official && (
    <Badge
      bg={totalMain > 0 ? "success" : totalMain < 0 ? "danger" : "secondary"}
      style={{ fontSize: "1rem" }}
    >
      {totalMain} pts
    </Badge>
  )}
</div>
```

Nel layout desktop table (circa riga 522):
```javascript
<tr key={s.id}>
  <td className="text-center">{idx + 1}</td>
  <td className="text-center">
    {userName}
    {s.isLate && (
      <Badge bg="warning" text="dark" className="ms-1">
        ⏰ -3
      </Badge>
    )}
  </td>
  {/* resto delle celle... */}
</tr>
```

---

### 5. SubmissionsList.jsx - Visualizzazione nel Pannello Admin

Nel layout mobile (circa riga 134):
```javascript
<h6 className="mb-0" style={{ color: accentColor }}>
  {i + 1}. {s.user}
  {s.isLate && (
    <Badge bg="warning" text="dark" className="ms-2">
      ⏰ In Ritardo (-3)
    </Badge>
  )}
</h6>
```

Nel layout desktop table (circa riga 179):
```javascript
<td>
  {i + 1}
</td>
<td>
  {s.user}
  {s.isLate && (
    <Badge bg="warning" text="dark" className="ms-1">
      ⏰ -3
    </Badge>
  )}
</td>
```

---

## 6. Migration Script - Aggiungere a Tutti gli Utenti

### Opzione A: Script manuale console Firebase
```javascript
// Esegui nella console Firebase o in un componente admin
const addUsedLateSubmissionField = async () => {
  const rankingSnap = await getDocs(collection(db, "ranking"));

  for (const userDoc of rankingSnap.docs) {
    const data = userDoc.data();
    if (data.usedLateSubmission === undefined) {
      await updateDoc(userDoc.ref, { usedLateSubmission: false });
      console.log(`✅ ${data.name}: usedLateSubmission = false`);
    }
  }

  console.log("✅ Migration completata!");
};

// Esegui
addUsedLateSubmissionField();
```

### Opzione B: Aggiungere in ParticipantsManager (AdminPanel.jsx)

Nel handleAdd (circa riga 144):
```javascript
await setDoc(doc(db, "ranking", formData.id), {
  name: formData.name,
  puntiTotali: parseInt(formData.puntiTotali) || 0,
  jolly: parseInt(formData.jolly) || 0,
  pointsByRace: {},
  championshipPiloti: [],
  championshipCostruttori: [],
  championshipPts: 0,
  usedLateSubmission: false, // ← AGGIUNGERE
});
```

---

## 🧪 Testing

### Test Manuale
1. **Deadline normale**: Inserisci formazione prima della deadline → Deve salvare normalmente
2. **Late submission prima volta**: Inserisci formazione 5 min dopo deadline → Modal conferma → Salva con -3
3. **Late già usata**: Prova a usare late di nuovo → Errore "già usato"
4. **Oltre 10 minuti**: Prova a inserire 15 min dopo → Errore "deadline chiusa"
5. **Admin late checkbox**: Spunta checkbox in AdminPanel → Salva con isLate=true
6. **Visualizzazione**: Controlla storico → Badge "In Ritardo (-3)" visibile
7. **Calcolo punti**: Calcola punteggi → Verifica -3 applicato correttamente

---

## ✅ Checklist Finale

- [ ] Modificare FormationApp.jsx (stati + validazione + modal)
- [ ] Modificare AdminPanel.jsx (checkbox + payload)
- [ ] ✅ Modificare pointsCalculator.js (penalità -3)
- [ ] Modificare RaceHistoryCard.jsx (badge late)
- [ ] Modificare SubmissionsList.jsx (badge late)
- [ ] Eseguire migration script per usedLateSubmission
- [ ] Testare tutti i casi d'uso
- [ ] Build e deploy
- [ ] Documentare feature per utenti

---

**Fine Implementazione**
