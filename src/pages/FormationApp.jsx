// src/FormationApp.jsx – Migliorato con UX avanzata e supporto tema
import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  Badge,
  Table,
  Modal,
} from "react-bootstrap";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  getDoc,
  increment,
  Timestamp,
} from "firebase/firestore";
import Select from "react-select";
import { db } from "../services/firebase";
import RaceHistoryCard from "../components/RaceHistoryCard";
import { DRIVERS, DRIVER_TEAM, TEAM_LOGOS } from "../constants/racing";
import { useTheme } from "../contexts/ThemeContext";
import "../styles/customSelect.css";

/* --- costanti importate da file centralizzato ---------------------- */
const drivers = DRIVERS;
const driverTeam = DRIVER_TEAM;
const teamLogos = TEAM_LOGOS;

const driverOpts = drivers.map((d) => ({
  value: d,
  label: (
    <div className="select-option">
      <img src={teamLogos[driverTeam[d]]} className="option-logo" alt={driverTeam[d]} />
      <span className="option-text">{d}</span>
    </div>
  ),
}));

/* ─────────────────────────────────── COMPONENTE ──────────────────────────────────── */
export default function FormationApp() {
  const { isDark } = useTheme();

  /* ----- stato principale ----- */
  const [ranking, setRanking] = useState([]);
  const [races, setRaces] = useState([]);
  const [race, setRace] = useState(null);

  const [busy, setBusy] = useState(true);
  const [permError, setPermError] = useState(false);
  const [flash, setFlash] = useState(null);
  const [touched, setTouched] = useState(false); // Per feedback visivo

  const [savingMode, setSavingMode] = useState/** @type{"main"|"sprint"|null} */(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [showLateModal, setShowLateModal] = useState(false);
  const [userUsedLateSubmission, setUserUsedLateSubmission] = useState(false);
  const [currentLateMode, setCurrentLateMode] = useState(null);

  const [userJolly, setUserJolly] = useState(0);
  const [form, setForm] = useState({
    userId: "",
    raceId: "",
    P1: null,
    P2: null,
    P3: null,
    jolly: null,
    jolly2: null,
    sprintP1: null,
    sprintP2: null,
    sprintP3: null,
    sprintJolly: null,
  });
  const [isEditMode, setIsEditMode] = useState(false);

  /* ─────────────── live ranking + prossime gare ─────────────── */
  useEffect(() => {
    (async () => {
      try {
        const unSub = onSnapshot(
          query(collection(db, "ranking"), orderBy("puntiTotali", "desc")),
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data(), jolly: d.data().jolly ?? 0 }));
            setRanking(list);
            if (form.userId) {
              const me = list.find((u) => u.id === form.userId);
              setUserJolly(me?.jolly ?? 0);
            }
          }
        );

        const rsnap = await getDocs(
          query(collection(db, "races"), where("raceUTC", ">", Timestamp.now()), orderBy("raceUTC", "asc"))
        );
        const future = rsnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRaces(future);
        if (future.length) {
          setRace(future[0]);
          setForm((f) => ({ ...f, raceId: future[0].id }));
        }
        return () => unSub();
      } catch (e) {
        console.error(e);
        if (e.code === "permission-denied") setPermError(true);
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─────────────── carica usedLateSubmission ─────────────── */
  useEffect(() => {
    if (form.userId) {
      const user = ranking.find(u => u.id === form.userId);
      setUserUsedLateSubmission(user?.usedLateSubmission ?? false);
    }
  }, [form.userId, ranking]);

  /* ─────────────── helpers di stato gara / sprint ─────────────── */
  const now = Date.now();
  const qualiMs = race?.qualiUTC.seconds * 1000;
  const sprMs = race?.qualiSprintUTC?.seconds * 1000;
  const mainOpen = race && now < qualiMs;
  const sprOpen = race?.qualiSprintUTC && now < sprMs;
  const isSprintRace = Boolean(race?.qualiSprintUTC);

  const fullMain = form.P1 && form.P2 && form.P3 && form.jolly;
  const fullSpr = form.sprintP1 && form.sprintP2 && form.sprintP3 && form.sprintJolly;

  const disabledMain = !(form.userId && form.raceId && mainOpen && fullMain);
  const disabledSprint = !(form.userId && form.raceId && sprOpen && fullSpr && isSprintRace);

  /* ─────────────── validazione duplicati ─────────────── */
  const getMainDuplicates = () => {
    const selected = [form.P1?.value, form.P2?.value, form.P3?.value, form.jolly?.value, form.jolly2?.value].filter(
      Boolean
    );
    const duplicates = selected.filter((item, index) => selected.indexOf(item) !== index);
    return [...new Set(duplicates)];
  };

  const getSprintDuplicates = () => {
    const selected = [
      form.sprintP1?.value,
      form.sprintP2?.value,
      form.sprintP3?.value,
      form.sprintJolly?.value,
    ].filter(Boolean);
    const duplicates = selected.filter((item, index) => selected.indexOf(item) !== index);
    return [...new Set(duplicates)];
  };

  const mainDuplicates = getMainDuplicates();
  const sprintDuplicates = getSprintDuplicates();
  const hasMainDuplicates = mainDuplicates.length > 0;
  const hasSprintDuplicates = sprintDuplicates.length > 0;

  /* ─────────────── cambio semplici (user / race) ─────────────── */
  const onChangeSimple = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));

    if (name === "userId") {
      const me = ranking.find((u) => u.id === value);
      setUserJolly(me?.jolly ?? 0);
      setIsEditMode(false);
      setTouched(false);
    }
    if (name === "raceId") {
      const r = races.find((r) => r.id === value);
      setRace(r ?? null);
      // reset selezioni
      setForm((f) => ({
        ...f,
        raceId: value,
        P1: null,
        P2: null,
        P3: null,
        jolly: null,
        jolly2: null,
        sprintP1: null,
        sprintP2: null,
        sprintP3: null,
        sprintJolly: null,
      }));
      setIsEditMode(false);
      setTouched(false);
    }
  };

  const onSelectChange = (sel, field) => {
    setForm((f) => ({ ...f, [field]: sel }));
    if (touched && !sel) setTouched(true); // Mantieni feedback se era già touched
  };

  /* ─────────────── prefill se esiste submission ─────────────── */
  useEffect(() => {
    const { userId, raceId } = form;
    if (!userId || !raceId) {
      setIsEditMode(false);
      return;
    }

    (async () => {
      const snap = await getDoc(doc(db, "races", raceId, "submissions", userId));
      if (!snap.exists()) {
        setIsEditMode(false);
        return;
      }
      const d = snap.data();
      const opt = (v) => driverOpts.find((o) => o.value === v) ?? null;
      setForm((f) => ({
        ...f,
        P1: opt(d.mainP1),
        P2: opt(d.mainP2),
        P3: opt(d.mainP3),
        jolly: opt(d.mainJolly),
        jolly2: opt(d.mainJolly2),
        sprintP1: opt(d.sprintP1),
        sprintP2: opt(d.sprintP2),
        sprintP3: opt(d.sprintP3),
        sprintJolly: opt(d.sprintJolly),
      }));
      setIsEditMode(true);
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.userId, form.raceId]);

  /* ─────────────── validazione contestuale ─────────────── */
  const validate = (mode) => {
    const err = [];
    if (!form.userId) err.push("Scegli l'utente.");
    if (!form.raceId) err.push("Scegli la gara.");

    const now = Date.now();
    const deadline = mode === "main"
      ? race.qualiUTC?.seconds * 1000
      : race.qualiSprintUTC?.seconds * 1000;
    const tenMinutesAfterDeadline = deadline + (10 * 60 * 1000);
    const isInLateWindow = now > deadline && now <= tenMinutesAfterDeadline;

    if (mode === "main") {
      // Controllo gara cancellata
      if (race.cancelledMain) {
        err.push("⛔ Gara cancellata: non è possibile inserire formazioni.");
        return err; // Ritorna subito, non serve controllare altro
      }

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

      // Controllo sprint cancellata
      if (race.cancelledSprint) {
        err.push("⛔ Sprint cancellata: non è possibile inserire formazioni.");
        return err; // Ritorna subito
      }

      const sprintDeadline = race.qualiSprintUTC?.seconds * 1000;
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

  /* ─────────────── reset form ─────────────── */
  const handleResetForm = () => {
    setForm((f) => ({
      ...f,
      P1: null,
      P2: null,
      P3: null,
      jolly: null,
      jolly2: null,
      sprintP1: null,
      sprintP2: null,
      sprintP3: null,
      sprintJolly: null,
    }));
    setTouched(false);
    setFlash(null);
  };

  /* ─────────────── salvataggio ─────────────── */
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
      ? race.qualiUTC?.seconds * 1000
      : race.qualiSprintUTC?.seconds * 1000;
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

  /* ─────────────── UI stato busy / errori permessi ─────────────── */
  if (busy) return <SpinnerScreen />;
  if (permError) return <PermError />;

  /* ─────────────── helpers UI ─────────────── */
  const DeadlineBadgeLocal = ({ open }) => (
    <Badge
      bg={open ? "success" : "danger"}
      style={{ color: (open && isDark) ? "#ffffff" : undefined }}
    >
      {open ? "APERTO" : "CHIUSO"}
    </Badge>
  );

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";

  /* ─────────────────────────────── JSX ───────────────────────────── */
  return (
    <Container className="py-5">
      <Row className="justify-content-center g-4 align-items-start">
        {/* ---------- FORM ---------- */}
        <Col xs={12} lg={6}>
          <Card
            className="shadow h-100"
            style={{
              borderLeft: `4px solid ${accentColor}`,
            }}
          >
            <Card.Body>
              <Card.Title className="text-center mb-3" style={{ color: accentColor }}>
                🏎️ Schiera la Formazione
              </Card.Title>

              {flash && (
                <Alert variant={flash.type} dismissible onClose={() => setFlash(null)}>
                  {flash.msg}
                </Alert>
              )}

              {/* Submit unico, ma savingMode viene impostato dal bottone */}
              <Form onSubmit={save}>
                {/* Utente */}
                <Form.Group className="mb-3">
                  <Form.Label>Utente *</Form.Label>
                  <Form.Select name="userId" value={form.userId} onChange={onChangeSimple} required>
                    <option value="">Seleziona utente</option>
                    {ranking.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Form.Select>
                  {form.userId && (
                    <Form.Text>
                      Jolly disponibili: <Badge bg="warning" text="dark">{userJolly}</Badge>
                    </Form.Text>
                  )}
                </Form.Group>

                {/* Gara */}
                <Form.Group className="mb-3">
                  <Form.Label>Gara *</Form.Label>
                  <Form.Select name="raceId" value={form.raceId} onChange={onChangeSimple} required>
                    <option value="">Seleziona gara</option>
                    {races.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.round}. {r.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                {/* MAIN */}
                {race && (
                  <>
                    <SectionHeader title="Gara Principale" open={mainOpen} deadlineMs={qualiMs} accentColor={accentColor} />

                    {hasMainDuplicates && touched && (
                      <Alert variant="warning" className="py-2 small">
                        ⚠️ Hai selezionato lo stesso pilota più volte: <strong>{mainDuplicates.join(", ")}</strong>
                      </Alert>
                    )}

                    {["P1", "P2", "P3"].map((l) => (
                      <DriverSelect
                        key={l}
                        label={l}
                        field={l}
                        required
                        disabled={!mainOpen}
                        form={form}
                        onSelectChange={onSelectChange}
                        touched={touched}
                        driverOpts={driverOpts}
                      />
                    ))}
                    <DriverSelect
                      label="Jolly"
                      field="jolly"
                      required
                      disabled={!mainOpen}
                      form={form}
                      onSelectChange={onSelectChange}
                      touched={touched}
                      driverOpts={driverOpts}
                    />
                    {userJolly > 0 && (
                      <DriverSelect
                        label="Jolly 2 (opzionale)"
                        field="jolly2"
                        clearable
                        disabled={!mainOpen}
                        form={form}
                        onSelectChange={onSelectChange}
                        touched={touched}
                        driverOpts={driverOpts}
                        helpText="Usa un jolly extra per raddoppiare le possibilità"
                      />
                    )}
                  </>
                )}

                {/* SPRINT */}
                {isSprintRace && (
                  <>
                    <SectionHeader title="Sprint (opzionale)" open={sprOpen} deadlineMs={sprMs} accentColor={accentColor} />

                    {hasSprintDuplicates && touched && (
                      <Alert variant="warning" className="py-2 small">
                        ⚠️ Hai selezionato lo stesso pilota più volte nella sprint: <strong>{sprintDuplicates.join(", ")}</strong>
                      </Alert>
                    )}

                    {["sprintP1", "sprintP2", "sprintP3", "sprintJolly"].map((f) => (
                      <DriverSelect
                        key={f}
                        label={f.replace("sprint", "SP").replace("sprintJolly", "Jolly SP")}
                        field={f}
                        clearable
                        disabled={!sprOpen}
                        form={form}
                        onSelectChange={onSelectChange}
                        touched={touched}
                        driverOpts={driverOpts}
                      />
                    ))}
                  </>
                )}

                {/* RIEPILOGO */}
                {race && form.userId && (fullMain || fullSpr) && (
                  <FormationSummary
                    form={form}
                    hasMain={fullMain}
                    hasSprint={fullSpr && isSprintRace}
                    accentColor={accentColor}
                  />
                )}

                {/* BOTTONI */}
                <Row className="g-2 mt-3">
                  {race && (
                    <Col xs={12}>
                      <Button variant="outline-secondary" size="sm" className="w-100" onClick={handleResetForm}>
                        🔄 Reset Formazione
                      </Button>
                    </Col>
                  )}
                  <Col xs={isSprintRace ? 6 : 12}>
                    <Button
                      variant="danger"
                      className="w-100"
                      type="submit"
                      formNoValidate
                      disabled={disabledMain || hasMainDuplicates}
                      onClick={() => setSavingMode("main")}
                    >
                      {isEditMode ? "✏️ Modifica Gara" : "💾 Salva Gara"}
                    </Button>
                  </Col>
                  {isSprintRace && (
                    <Col xs={6}>
                      <Button
                        variant="warning"
                        className="w-100"
                        type="submit"
                        formNoValidate
                        disabled={disabledSprint || hasSprintDuplicates}
                        onClick={() => setSavingMode("sprint")}
                      >
                        {isEditMode ? "✏️ Modifica Sprint" : "💾 Salva Sprint"}
                      </Button>
                    </Col>
                  )}
                </Row>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* ---------- LISTA FORMAZIONI ---------- */}
        <Col xs={12} lg={6}>
          {race && <RaceHistoryCard race={race} showOfficialResults={false} showPoints={false} compact={true} />}
        </Col>
      </Row>

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
    </Container>
  );

  /* ─────────────── componenti ausiliari inline ─────────────── */
  function SpinnerScreen() {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  }
  function PermError() {
    return (
      <Container className="py-5">
        <Alert variant="danger">Permessi insufficienti.</Alert>
      </Container>
    );
  }

  function SectionHeader({ title, open, deadlineMs, accentColor }) {
    return (
      <>
        <hr style={{ borderColor: accentColor }} />
        <h5 className="mt-3" style={{ color: accentColor }}>
          {title}&nbsp;
          <DeadlineBadgeLocal open={open} />
        </h5>
        <p className="small text-muted mb-3">
          Da schierare entro:{" "}
          {new Date(deadlineMs).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
          {" – "}
          {new Date(deadlineMs).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </>
    );
  }

  function DriverSelect({ label, field, required, clearable, disabled, form, onSelectChange, touched, driverOpts, helpText }) {
    const value = form[field];
    const isEmpty = required && !value && touched;

    return (
      <Form.Group className="mb-2">
        <Form.Label>
          {label} {required && "*"}
          {isEmpty && <span className="text-danger ms-1">(obbligatorio)</span>}
        </Form.Label>
        <div className="d-flex gap-2">
          <div className="flex-grow-1">
            <Select
              isDisabled={disabled}
              options={driverOpts}
              value={value}
              onChange={(sel) => onSelectChange(sel, field)}
              placeholder={`Seleziona ${label}`}
              classNamePrefix="react-select"
              isClearable={clearable}
              styles={
                isEmpty
                  ? {
                      control: (base) => ({
                        ...base,
                        borderColor: "#dc3545",
                        boxShadow: "0 0 0 0.2rem rgba(220,53,69,.25)",
                      }),
                    }
                  : {}
              }
            />
          </div>
          {clearable && value && !disabled && (
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => onSelectChange(null, field)}
              title="Cancella selezione"
            >
              ✕
            </Button>
          )}
        </div>
        {helpText && <Form.Text className="text-muted">{helpText}</Form.Text>}
      </Form.Group>
    );
  }

  function FormationSummary({ form, hasMain, hasSprint, accentColor }) {
    return (
      <Card className="mt-3" style={{ borderLeft: `3px solid ${accentColor}` }}>
        <Card.Body className="py-2">
          <h6 className="mb-2" style={{ color: accentColor }}>
            📋 Riepilogo Formazione
          </h6>
          <Table size="sm" className="mb-0">
            <tbody>
              {hasMain && (
                <>
                  <tr>
                    <td className="fw-bold" colSpan={2}>
                      Gara Principale
                    </td>
                  </tr>
                  <tr>
                    <td>P1</td>
                    <td>{form.P1?.value || "—"}</td>
                  </tr>
                  <tr>
                    <td>P2</td>
                    <td>{form.P2?.value || "—"}</td>
                  </tr>
                  <tr>
                    <td>P3</td>
                    <td>{form.P3?.value || "—"}</td>
                  </tr>
                  <tr>
                    <td>Jolly</td>
                    <td>{form.jolly?.value || "—"}</td>
                  </tr>
                  {form.jolly2 && (
                    <tr>
                      <td>Jolly 2</td>
                      <td>{form.jolly2.value}</td>
                    </tr>
                  )}
                </>
              )}
              {hasSprint && (
                <>
                  <tr>
                    <td className="fw-bold" colSpan={2}>
                      Sprint
                    </td>
                  </tr>
                  <tr>
                    <td>SP1</td>
                    <td>{form.sprintP1?.value || "—"}</td>
                  </tr>
                  <tr>
                    <td>SP2</td>
                    <td>{form.sprintP2?.value || "—"}</td>
                  </tr>
                  <tr>
                    <td>SP3</td>
                    <td>{form.sprintP3?.value || "—"}</td>
                  </tr>
                  <tr>
                    <td>Jolly SP</td>
                    <td>{form.sprintJolly?.value || "—"}</td>
                  </tr>
                </>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    );
  }
}
