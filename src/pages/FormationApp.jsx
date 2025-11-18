/**
 * @file FormationApp.jsx
 * @description Race formation submission form with advanced UX and theme support
 * Main formation management for races and sprints with late submission handling
 */

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
import { DRIVERS, DRIVER_TEAM, TEAM_LOGOS, TIME_CONSTANTS } from "../constants/racing";
import { useThemeColors } from "../hooks/useThemeColors";
import { useLanguage } from "../hooks/useLanguage";
import { error } from "../utils/logger";
import { getLateWindowInfo } from "../utils/lateSubmissionHelper";
import "../styles/customSelect.css";

// Constants imported from centralized file
const drivers = DRIVERS;
const driverTeam = DRIVER_TEAM;
const teamLogos = TEAM_LOGOS;

// Pre-build driver options with team logos
const driverOpts = drivers.map((d) => ({
  value: d,
  label: (
    <div className="select-option">
      <img src={teamLogos[driverTeam[d]]} className="option-logo" alt={`${driverTeam[d]} team logo`} />
      <span className="option-text">{d}</span>
    </div>
  ),
}));

/**
 * Formation management component for race and sprint submissions
 * @returns {JSX.Element} Formation form with deadline tracking and late submission handling
 */
export default function FormationApp() {
  const colors = useThemeColors();
  const { t } = useLanguage();

  // Main state
  const [ranking, setRanking] = useState([]);
  const [races, setRaces] = useState([]);
  const [race, setRace] = useState(null);

  const [busy, setBusy] = useState(true);
  const [permError, setPermError] = useState(false);
  const [flash, setFlash] = useState(null);
  const [touched, setTouched] = useState(false); // For visual feedback

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

  /**
   * Load live ranking and upcoming races from Firestore
   */
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
        error(e);
        if (e.code === "permission-denied") setPermError(true);
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Load user's late submission status
   */
  useEffect(() => {
    if (form.userId) {
      const user = ranking.find(u => u.id === form.userId);
      setUserUsedLateSubmission(user?.usedLateSubmission ?? false);
    }
  }, [form.userId, ranking]);

  // Race and sprint deadline status helpers
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

  /**
   * Get duplicate drivers in main race selection
   * @returns {string[]} Array of duplicate driver names
   */
  const getMainDuplicates = () => {
    const selected = [form.P1?.value, form.P2?.value, form.P3?.value, form.jolly?.value, form.jolly2?.value].filter(
      Boolean
    );
    const duplicates = selected.filter((item, index) => selected.indexOf(item) !== index);
    return [...new Set(duplicates)];
  };

  /**
   * Get duplicate drivers in sprint selection
   * @returns {string[]} Array of duplicate driver names
   */
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

  /**
   * Handle simple input changes (user / race selection)
   * @param {Event} e - Change event
   */
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

  /**
   * Handle driver selection changes
   * @param {Object} sel - Selected option
   * @param {string} field - Form field name
   */
  const onSelectChange = (sel, field) => {
    setForm((f) => ({ ...f, [field]: sel }));
    if (touched && !sel) setTouched(true); // Maintain feedback if already touched
  };

  /**
   * Pre-fill form if existing submission found
   */
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
    })().catch(error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.userId, form.raceId]);

  /**
   * Validate formation before submission
   * @param {string} mode - Submission mode ("main" or "sprint")
   * @param {number} timestamp - Current timestamp
   * @returns {string[]} Array of validation error messages
   */
  const validate = (mode, timestamp) => {
    const err = [];
    if (!form.userId) err.push(t("errors.incompleteForm"));
    if (!form.raceId) err.push(t("errors.incompleteForm"));

    // Use helper to get late window info with shared timestamp
    const lateInfo = getLateWindowInfo(mode, race, timestamp);

    if (mode === "main") {
      // Check if race is cancelled
      if (race.cancelledMain) {
        err.push(`⛔ ${t("errors.raceCancelled")}`);
        return err;
      }

      // Allow if: deadline open OR in late window AND hasn't used it yet
      if (!lateInfo.isOpen && !lateInfo.isInLateWindow) {
        err.push(t("errors.deadlineClosed"));
      } else if (lateInfo.isInLateWindow && userUsedLateSubmission) {
        err.push(`❌ ${t("errors.lateSubmissionUsed")}`);
      }

      if (!fullMain) err.push(t("errors.incompleteForm"));
      if (hasMainDuplicates)
        err.push(`${t("formations.duplicateWarning")}: ${mainDuplicates.join(", ")}`);
    } else {
      // SPRINT
      if (!isSprintRace) err.push(t("errors.incompleteForm"));

      // Check if sprint is cancelled
      if (race.cancelledSprint) {
        err.push(`⛔ ${t("errors.raceCancelled")}`);
        return err;
      }

      if (!lateInfo.isOpen && !lateInfo.isInLateWindow) {
        err.push(t("errors.deadlineClosed"));
      } else if (lateInfo.isInLateWindow && userUsedLateSubmission) {
        err.push(`❌ ${t("errors.lateSubmissionUsed")}`);
      }

      if (!fullSpr) err.push(t("errors.incompleteForm"));
      if (hasSprintDuplicates)
        err.push(`${t("formations.duplicateWarning")}: ${sprintDuplicates.join(", ")}`);
    }
    return err;
  };

  /**
   * Handle form submission
   * @param {Event} e - Form submit event
   */
  const save = async (e) => {
    e.preventDefault();
    setFlash(null);
    setTouched(true);
    const mode = savingMode;
    if (!mode || !race) return;

    // Capture timestamp ONCE to avoid race conditions
    const timestamp = Date.now();

    // Validate with the same timestamp
    const errs = validate(mode, timestamp);
    if (errs.length) {
      setFlash({ type: "danger", msg: errs.join(" ") });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Get late window info with the same timestamp
    const lateInfo = getLateWindowInfo(mode, race, timestamp);

    // If in late window and hasn't used it yet → show modal
    if (lateInfo.isInLateWindow && !userUsedLateSubmission && !isEditMode) {
      setCurrentLateMode(mode);
      setShowLateModal(true);
      return;
    }

    // Proceed with save
    await performSave(mode, lateInfo.isInLateWindow);
  };

  /**
   * Perform the actual save operation
   * @param {string} mode - Submission mode ("main" or "sprint")
   * @param {boolean} isLate - Whether this is a late submission
   */
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
      payload.latePenalty = TIME_CONSTANTS.LATE_SUBMISSION_PENALTY;
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
          ? `✓ ${t("success.formationSaved")} ${t("formations.latePenalty")}`
          : mode === "main"
          ? isEditMode
            ? `✓ ${t("success.formationUpdated")}`
            : `✓ ${t("success.formationSaved")}`
          : isEditMode
          ? `✓ ${t("success.formationUpdated")}`
          : `✓ ${t("success.formationSaved")}`,
      });
      setRefreshKey(Date.now());
      setSavingMode(null);
      setShowLateModal(false);
      setCurrentLateMode(null);
      setTouched(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      error(err);
      setFlash({ type: "danger", msg: `❌ ${t("common.error")}: ${err.message}` });
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
      style={{ color: (open && colors.isDark) ? "#ffffff" : undefined }}
    >
      {open ? t("formations.open") : t("formations.closed")}
    </Badge>
  );

  /* ─────────────────────────────── JSX ───────────────────────────── */
  return (
    <Container className="py-5">
      <Row className="justify-content-center g-4 align-items-start">
        {/* ---------- FORM ---------- */}
        <Col xs={12} lg={6}>
          <Card
            className="shadow h-100"
            style={{
              borderLeft: `4px solid ${colors.accent}`,
            }}
          >
            <Card.Body>
              <Card.Title className="text-center mb-3" style={{ color: colors.accent }}>
                🏎️ {t("formations.title")}
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
                  <Form.Label>{t("formations.selectUser")} *</Form.Label>
                  <Form.Select name="userId" value={form.userId} onChange={onChangeSimple} required aria-label="Select user to submit formation for">
                    <option value="">{t("formations.selectUser")}</option>
                    {ranking.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Form.Select>
                  {form.userId && (
                    <Form.Text>
                      {t("formations.jokersAvailable")}: <Badge bg="warning" text="dark">{userJolly}</Badge>
                    </Form.Text>
                  )}
                </Form.Group>

                {/* Gara */}
                <Form.Group className="mb-3">
                  <Form.Label>{t("formations.selectRace")} *</Form.Label>
                  <Form.Select name="raceId" value={form.raceId} onChange={onChangeSimple} required aria-label="Select race to submit formation for">
                    <option value="">{t("formations.selectRace")}</option>
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
                    <SectionHeader title={t("formations.mainRace")} open={mainOpen} deadlineMs={qualiMs} accentColor={colors.accent} />

                    {hasMainDuplicates && touched && (
                      <Alert variant="warning" className="py-2 small">
                        ⚠️ {t("formations.duplicateWarning")}: <strong>{mainDuplicates.join(", ")}</strong>
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
                    <SectionHeader title={t("formations.sprintOptional")} open={sprOpen} deadlineMs={sprMs} accentColor={colors.accent} />

                    {hasSprintDuplicates && touched && (
                      <Alert variant="warning" className="py-2 small">
                        ⚠️ {t("formations.duplicateWarning")}: <strong>{sprintDuplicates.join(", ")}</strong>
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

                {/* BOTTONI */}
                <Row className="g-2 mt-3">
                  <Col xs={isSprintRace ? 6 : 12}>
                    <Button
                      variant="danger"
                      className="w-100"
                      type="submit"
                      formNoValidate
                      disabled={disabledMain || hasMainDuplicates}
                      onClick={() => setSavingMode("main")}
                      aria-label={isEditMode ? "Edit main race formation" : "Save main race formation"}
                    >
                      {isEditMode ? `✏️ ${t("formations.editFormation")}` : `💾 ${t("formations.save")}`}
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
                        aria-label={isEditMode ? "Edit sprint formation" : "Save sprint formation"}
                      >
                        {isEditMode ? `✏️ ${t("formations.editFormation")}` : `💾 ${t("formations.save")}`}
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
          {race && <RaceHistoryCard key={refreshKey} race={race} showOfficialResults={false} showPoints={false} compact={true} />}
        </Col>
      </Row>

      {/* Modal conferma late submission */}
      <Modal show={showLateModal} onHide={() => {
        setShowLateModal(false);
        setSavingMode(null);
        setCurrentLateMode(null);
      }}>
        <Modal.Header closeButton>
          <Modal.Title>⚠️ {t("formations.lateSubmission")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            <strong>{t("common.warning")}!</strong>
            <br />
            {t("formations.lateWarning")}.
            <br /><br />
            <strong>{t("formations.latePenalty")}</strong>
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowLateModal(false);
            setSavingMode(null);
            setCurrentLateMode(null);
          }} aria-label="Cancel late submission">
            {t("common.cancel")}
          </Button>
          <Button variant="warning" onClick={handleConfirmLateSubmission} aria-label="Confirm late submission with penalty">
            {t("formations.lateConfirm")}
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
        <p className="mt-3">{t("common.loading")}</p>
      </Container>
    );
  }
  function PermError() {
    return (
      <Container className="py-5">
        <Alert variant="danger">{t("errors.permissionDenied")}</Alert>
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
          {t("formations.submitBy")}:{" "}
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
          {isEmpty && <span className="text-danger ms-1">({t("formations.required")})</span>}
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
              aria-label={`Select driver for ${label}`}
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
              aria-label={`Clear ${label} selection`}
            >
              ✕
            </Button>
          )}
        </div>
        {helpText && <Form.Text className="text-muted">{helpText}</Form.Text>}
      </Form.Group>
    );
  }

}
