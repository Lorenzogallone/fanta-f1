/**
 * @file AdminPanel.jsx
 * @description Admin panel for managing participants, formations, race calendar, and database operations
 * Provides comprehensive administrative tools with authentication protection
 */

import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Alert,
  Spinner,
  Tab,
  Nav,
  Table,
  Badge,
  Modal,
} from "react-bootstrap";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  writeBatch,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { DRIVERS } from "../constants/racing";
import Select from "react-select";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import AdminLogin from "../components/AdminLogin";
import {
  createAndSaveBackup,
  getAllBackups,
  deleteBackup,
  restoreFromBackup,
  downloadBackupAsJSON,
} from "../services/backupService";

/**
 * Main admin panel component with tabbed interface
 * @returns {JSX.Element} Admin panel with authentication and management tabs
 */
export default function AdminPanel() {
  const { t } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState("participants");

  // Shared data to avoid multiple fetches
  const [sharedParticipants, setSharedParticipants] = useState([]);
  const [sharedRaces, setSharedRaces] = useState([]);
  const [loadingShared, setLoadingShared] = useState(false);

  useEffect(() => {
    // Check if already authenticated
    const auth = localStorage.getItem("adminAuth");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  /**
   * Load shared data when authenticated
   */
  useEffect(() => {
    if (isAuthenticated) {
      loadSharedData();
    }
  }, [isAuthenticated]);

  /**
   * Load participants and races data
   */
  const loadSharedData = async () => {
    setLoadingShared(true);
    try {
      const [partSnap, racesSnap] = await Promise.all([
        getDocs(collection(db, "ranking")),
        getDocs(collection(db, "races")),
      ]);

      const partList = partSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSharedParticipants(partList.sort((a, b) => a.name.localeCompare(b.name)));

      const racesList = racesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSharedRaces(racesList.sort((a, b) => a.round - b.round));
    } catch (err) {
      console.error("Errore caricamento dati condivisi:", err);
    } finally {
      setLoadingShared(false);
    }
  };

  if (!isAuthenticated) {
    return <AdminLogin onSuccess={() => setIsAuthenticated(true)} useLocalStorage={true} />;
  }

  return (
    <Container className="py-4">
      <Card className="shadow border-danger mb-4">
        <Card.Header className="bg-danger text-white">
          <h4 className="mb-0">⚙️ {t("admin.title")}</h4>
        </Card.Header>
      </Card>

      <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
        <Nav variant="tabs" className="mb-4">
          <Nav.Item>
            <Nav.Link eventKey="participants">👥 {t("admin.participants")}</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="formations">📝 {t("admin.formations")}</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="calendar">📅 {t("admin.raceCalendar")}</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="reset">🗑️ {t("admin.database")}</Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          <Tab.Pane eventKey="participants">
            <ParticipantsManager
              participants={sharedParticipants}
              loading={loadingShared}
              onDataChange={loadSharedData}
            />
          </Tab.Pane>

          <Tab.Pane eventKey="formations">
            <FormationsManager
              participants={sharedParticipants}
              races={sharedRaces}
              loading={loadingShared}
              onDataChange={loadSharedData}
            />
          </Tab.Pane>

          <Tab.Pane eventKey="calendar">
            <CalendarManager
              races={sharedRaces}
              loading={loadingShared}
              onDataChange={loadSharedData}
            />
          </Tab.Pane>

          <Tab.Pane eventKey="reset">
            <DatabaseReset
              participants={sharedParticipants}
              races={sharedRaces}
              onDataChange={loadSharedData}
            />
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </Container>
  );
}

/**
 * Participants management component
 * @param {Object} props - Component props
 * @param {Array} props.participants - List of participants
 * @param {boolean} props.loading - Loading state
 * @param {Function} props.onDataChange - Callback to refresh data
 * @returns {JSX.Element} Participants management interface
 */
function ParticipantsManager({ participants: propParticipants, loading: propLoading, onDataChange }) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentParticipant, setCurrentParticipant] = useState(null);
  const [formData, setFormData] = useState({ id: "", name: "", puntiTotali: 0, jolly: 0, usedLateSubmission: false });
  const { isDark } = useTheme();

  // Use participants passed as props
  const participants = propParticipants;

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";

  /**
   * Open add participant dialog
   */
  const openAddDialog = () => {
    setFormData({ id: "", name: "", puntiTotali: 0, jolly: 0, usedLateSubmission: false });
    setMessage(null);
    setShowAddDialog(true);
  };

  /**
   * Open edit participant dialog
   * @param {Object} participant - Participant to edit
   */
  const openEditDialog = (participant) => {
    setCurrentParticipant(participant);
    setFormData({
      id: participant.id,
      name: participant.name,
      puntiTotali: participant.puntiTotali || 0,
      jolly: participant.jolly || 0,
      usedLateSubmission: participant.usedLateSubmission || false,
    });
    setMessage(null);
    setShowEditDialog(true);
  };

  /**
   * Handle adding new participant
   * @param {Event} e - Form submit event
   */
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!formData.id || !formData.name) {
      setMessage({ type: "warning", text: t("errors.incompleteForm") });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await setDoc(doc(db, "ranking", formData.id), {
        name: formData.name,
        puntiTotali: parseInt(formData.puntiTotali) || 0,
        jolly: parseInt(formData.jolly) || 0,
        usedLateSubmission: false,
        pointsByRace: {},
        championshipPiloti: [],
        championshipCostruttori: [],
        championshipPts: 0,
      });

      setMessage({ type: "success", text: t("admin.participantAdded") });
      setFormData({ id: "", name: "", puntiTotali: 0, jolly: 0, usedLateSubmission: false });
      onDataChange();
      setTimeout(() => setShowAddDialog(false), 1500);
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: t("common.error") });
    } finally {
      setSaving(false);
    }
  };

  // Modifica partecipante
  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await updateDoc(doc(db, "ranking", currentParticipant.id), {
        name: formData.name,
        puntiTotali: parseInt(formData.puntiTotali) || 0,
        jolly: parseInt(formData.jolly) || 0,
        usedLateSubmission: formData.usedLateSubmission,
      });

      setMessage({ type: "success", text: t("admin.participantUpdated") });
      onDataChange();
      setTimeout(() => setShowEditDialog(false), 1500);
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: t("common.error") });
    } finally {
      setSaving(false);
    }
  };

  // Elimina partecipante
  const handleDelete = async () => {
    if (!window.confirm(`${t("admin.deleteParticipant")} ${currentParticipant.name}?\n\n${t("admin.deleteWarning")}`)) return;

    setSaving(true);
    setMessage(null);

    try {
      await deleteDoc(doc(db, "ranking", currentParticipant.id));
      setMessage({ type: "success", text: t("admin.participantDeleted") });
      onDataChange();
      setTimeout(() => setShowEditDialog(false), 1500);
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: t("common.error") });
    } finally {
      setSaving(false);
    }
  };

  if (propLoading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <>
      <Row className="mb-3">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">{t("admin.participants")} ({participants.length})</h5>
            <Button variant="danger" onClick={openAddDialog}>
              ➕ {t("admin.addParticipant")}
            </Button>
          </div>
        </Col>
      </Row>

      <Row>
        <Col>
          <Card className="shadow">
            <Card.Body className="p-0">
              {participants.length === 0 ? (
                <Alert variant="info" className="m-3">
                  {t("leaderboard.noData")}
                </Alert>
              ) : (
                <div className="table-responsive">
                  <Table hover className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>{t("common.name")}</th>
                        <th className="text-center">{t("common.points")}</th>
                        <th className="text-center">{t("leaderboard.jokers")}</th>
                        <th className="text-center">{t("admin.lateSubmissionUsed")}</th>
                        <th className="text-center" style={{ width: 100 }}>{t("common.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div>
                              <strong>{p.name}</strong>
                              <br />
                              <small className="text-muted">ID: {p.id}</small>
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="fw-semibold">{p.puntiTotali || 0}</span>
                          </td>
                          <td className="text-center">
                            <span className="fw-semibold">{p.jolly || 0}</span>
                          </td>
                          <td className="text-center">
                            <Badge bg={p.usedLateSubmission ? "warning" : "secondary"}>
                              {p.usedLateSubmission ? "Yes" : "No"}
                            </Badge>
                          </td>
                          <td className="text-center">
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => openEditDialog(p)}
                            >
                              ✏️ {t("common.edit")}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Dialog Aggiunta Partecipante */}
      <Modal show={showAddDialog} onHide={() => setShowAddDialog(false)} centered>
        <Modal.Header closeButton style={{ borderBottomColor: accentColor }}>
          <Modal.Title>➕ {t("admin.addParticipant")}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAdd}>
          <Modal.Body>
            {message && (
              <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}

            <Form.Group className="mb-3">
              <Form.Label>ID *</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. mario"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                required
                autoFocus
              />
              <Form.Text>{t("formations.required")}</Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t("admin.participantName")} *</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. Mario Rossi"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t("admin.totalPoints")}</Form.Label>
              <Form.Control
                type="number"
                value={formData.puntiTotali}
                onChange={(e) => setFormData({ ...formData, puntiTotali: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t("admin.availableJokers")}</Form.Label>
              <Form.Control
                type="number"
                value={formData.jolly}
                onChange={(e) => setFormData({ ...formData, jolly: e.target.value })}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAddDialog(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" type="submit" disabled={saving}>
              {saving ? t("common.loading") : t("admin.addParticipant")}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Dialog Modifica Partecipante */}
      <Modal show={showEditDialog} onHide={() => setShowEditDialog(false)} centered>
        <Modal.Header closeButton style={{ borderBottomColor: accentColor }}>
          <Modal.Title>✏️ {t("admin.editParticipant")}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUpdate}>
          <Modal.Body>
            {message && (
              <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}

            {currentParticipant && (
              <>
                <Alert variant="light" className="mb-3">
                  <strong>ID:</strong> {currentParticipant.id}
                </Alert>

                <Form.Group className="mb-3">
                  <Form.Label>{t("admin.participantName")} *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    autoFocus
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>{t("admin.totalPoints")}</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.puntiTotali}
                    onChange={(e) => setFormData({ ...formData, puntiTotali: e.target.value })}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>{t("admin.availableJokers")}</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.jolly}
                    onChange={(e) => setFormData({ ...formData, jolly: e.target.value })}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label={`⏰ ${t("admin.lateSubmissionUsed")}`}
                    checked={formData.usedLateSubmission}
                    onChange={(e) => setFormData({ ...formData, usedLateSubmission: e.target.checked })}
                  />
                </Form.Group>

                <hr />

                <div className="d-grid">
                  <Button variant="outline-danger" onClick={handleDelete} disabled={saving}>
                    🗑️ {t("admin.deleteParticipant")}
                  </Button>
                  <Form.Text className="text-muted text-center mt-2">
                    {t("admin.deleteWarning")}
                  </Form.Text>
                </div>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditDialog(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" type="submit" disabled={saving}>
              {saving ? t("common.loading") : t("common.update")}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}

/**
 * Formations management component for admin editing
 * @param {Object} props - Component props
 * @param {Array} props.participants - List of participants
 * @param {Array} props.races - List of races
 * @param {boolean} props.loading - Loading state
 * @param {Function} props.onDataChange - Callback to refresh data
 * @returns {JSX.Element} Formations management interface
 */
function FormationsManager({ participants: propParticipants, races: propRaces, loading: propLoading, onDataChange }) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  // Use data passed as props
  const participants = propParticipants;
  const races = propRaces;

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [touched, setTouched] = useState(false); // Show errors only after first attempt

  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRace, setSelectedRace] = useState(null);
  const [existingFormation, setExistingFormation] = useState(null);
  const [racesWithFormations, setRacesWithFormations] = useState(new Set());

  const [formData, setFormData] = useState({
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

  const [isLateSubmission, setIsLateSubmission] = useState(false);

  /**
   * Load formation status and auto-select first race without formation
   */
  useEffect(() => {
    if (!selectedUser || races.length === 0) return;

    (async () => {
      const racesWithForms = new Set();
      let firstRaceWithoutForm = null;

      // Controlla tutte le gare per vedere quali hanno formazioni
      for (const race of races) {
        const formDoc = await getDoc(
          doc(db, "races", race.id, "submissions", selectedUser)
        );
        if (formDoc.exists()) {
          racesWithForms.add(race.id);
        } else if (!firstRaceWithoutForm) {
          firstRaceWithoutForm = race;
        }
      }

      setRacesWithFormations(racesWithForms);

      // Seleziona automaticamente la prima gara senza formazione, o la prima se tutte hanno formazioni
      if (firstRaceWithoutForm) {
        setSelectedRace(firstRaceWithoutForm);
      } else if (races.length > 0 && !selectedRace) {
        setSelectedRace(races[0]);
      }
    })();
  }, [selectedUser, races]);

  /**
   * Load existing formation when user and race are selected
   */
  useEffect(() => {
    if (!selectedUser || !selectedRace) {
      setExistingFormation(null);
      resetForm();
      return;
    }

    loadFormation();
  }, [selectedUser, selectedRace]);

  /**
   * Load formation data from Firestore
   */
  const loadFormation = async () => {
    try {
      const formDoc = await getDoc(
        doc(db, "races", selectedRace.id, "submissions", selectedUser)
      );

      if (formDoc.exists()) {
        const data = formDoc.data();
        setExistingFormation(data);

        // Pre-compila il form
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
        setIsLateSubmission(data.isLate ?? false);
      } else {
        setExistingFormation(null);
        resetForm();
      }
    } catch (err) {
      console.error(err);
    }
  };

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
    setIsLateSubmission(false);
  };

  const findDriverOption = (name) => {
    if (!name) return null;
    return driverOptions.find((opt) => opt.value === name) || null;
  };

  // Ottiene i piloti già selezionati nella gara principale
  const getSelectedMainDrivers = () => {
    const selected = [];
    if (formData.mainP1) selected.push(formData.mainP1.value);
    if (formData.mainP2) selected.push(formData.mainP2.value);
    if (formData.mainP3) selected.push(formData.mainP3.value);
    if (formData.mainJolly) selected.push(formData.mainJolly.value);
    if (formData.mainJolly2) selected.push(formData.mainJolly2.value);
    return selected;
  };

  // Ottiene i piloti già selezionati nella sprint
  const getSelectedSprintDrivers = () => {
    const selected = [];
    if (formData.sprintP1) selected.push(formData.sprintP1.value);
    if (formData.sprintP2) selected.push(formData.sprintP2.value);
    if (formData.sprintP3) selected.push(formData.sprintP3.value);
    if (formData.sprintJolly) selected.push(formData.sprintJolly.value);
    return selected;
  };

  // Filtra le opzioni disponibili per un campo main (esclude piloti già selezionati)
  const getAvailableMainOptions = (currentField) => {
    const selectedDrivers = getSelectedMainDrivers();
    const currentValue = formData[currentField]?.value;

    return driverOptions.filter(opt =>
      !selectedDrivers.includes(opt.value) || opt.value === currentValue
    );
  };

  // Filtra le opzioni disponibili per un campo sprint (esclude piloti già selezionati)
  const getAvailableSprintOptions = (currentField) => {
    const selectedDrivers = getSelectedSprintDrivers();
    const currentValue = formData[currentField]?.value;

    return driverOptions.filter(opt =>
      !selectedDrivers.includes(opt.value) || opt.value === currentValue
    );
  };

  // Validazione completa del form
  const validateForm = () => {
    const errors = [];

    // Controlli di base
    if (!selectedUser) errors.push(t("admin.selectUser"));
    if (!selectedRace) errors.push(t("admin.selectRace"));

    // Campi obbligatori gara principale
    if (!formData.mainP1) errors.push(`P1 ${t("formations.required")}`);
    if (!formData.mainP2) errors.push(`P2 ${t("formations.required")}`);
    if (!formData.mainP3) errors.push(`P3 ${t("formations.required")}`);
    if (!formData.mainJolly) errors.push(`${t("formations.joker")} ${t("formations.required")}`);

    // Verifica duplicati nella gara principale
    const mainDrivers = [
      formData.mainP1?.value,
      formData.mainP2?.value,
      formData.mainP3?.value,
      formData.mainJolly?.value,
      formData.mainJolly2?.value
    ].filter(Boolean);

    if (new Set(mainDrivers).size !== mainDrivers.length) {
      errors.push(t("errors.duplicateDriver"));
    }

    // Verifica duplicati nella sprint (se presenti selezioni)
    if (hasSprint) {
      const sprintDrivers = [
        formData.sprintP1?.value,
        formData.sprintP2?.value,
        formData.sprintP3?.value,
        formData.sprintJolly?.value
      ].filter(Boolean);

      if (sprintDrivers.length > 0 && new Set(sprintDrivers).size !== sprintDrivers.length) {
        errors.push(t("errors.duplicateDriver"));
      }
    }

    return errors;
  };

  // Controlla se un campo obbligatorio è vuoto (per feedback visivo)
  const isFieldInvalid = (fieldName) => {
    if (!touched || !selectedUser || !selectedRace) return false;

    const requiredFields = ['mainP1', 'mainP2', 'mainP3', 'mainJolly'];
    if (requiredFields.includes(fieldName)) {
      return !formData[fieldName];
    }
    return false;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setTouched(true);

    const errors = validateForm();
    if (errors.length > 0) {
      setMessage({ type: "danger", text: errors.join(". ") + "." });
      // Scroll verso l'alto per vedere il messaggio
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const user = participants.find((p) => p.id === selectedUser);

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

      setMessage({
        type: "success",
        text: existingFormation ? t("admin.formationUpdated") : t("admin.formationAdded"),
      });
      setTouched(false);

      // Aggiorna il set delle gare con formazioni
      setRacesWithFormations(prev => new Set([...prev, selectedRace.id]));

      // Ricarica la formazione
      await loadFormation();

      // Scroll verso l'alto per vedere il messaggio di successo
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const driverOptions = DRIVERS.map((d) => ({ value: d, label: d }));

  const hasSprint = Boolean(selectedRace?.qualiSprintUTC);

  // Custom styles for react-select with dark mode support
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: isDark ? '#2d3748' : '#fff',
      borderColor: state.isFocused
        ? '#dc3545'
        : isDark
        ? '#4a5568'
        : '#ced4da',
      boxShadow: state.isFocused ? '0 0 0 0.2rem rgba(220,53,69,.25)' : 'none',
      '&:hover': {
        borderColor: '#dc3545',
      },
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: isDark ? '#2d3748' : '#fff',
      border: isDark ? '1px solid #4a5568' : '1px solid #ced4da',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused
        ? isDark
          ? '#4a5568'
          : '#f8f9fa'
        : isDark
        ? '#2d3748'
        : '#fff',
      color: isDark ? '#e2e8f0' : '#212529',
      '&:active': {
        backgroundColor: isDark ? '#4a5568' : '#e2e6ea',
      },
    }),
    singleValue: (base) => ({
      ...base,
      color: isDark ? '#e2e8f0' : '#212529',
    }),
    input: (base) => ({
      ...base,
      color: isDark ? '#e2e8f0' : '#212529',
    }),
    placeholder: (base) => ({
      ...base,
      color: isDark ? '#a0aec0' : '#6c757d',
    }),
  };

  const invalidSelectStyles = {
    ...selectStyles,
    control: (base, state) => ({
      ...selectStyles.control(base, state),
      borderColor: '#dc3545',
      boxShadow: '0 0 0 0.2rem rgba(220,53,69,.25)',
    }),
  };

  const bgCard = isDark ? 'var(--bg-secondary)' : '#ffffff';
  const bgHeader = isDark ? 'var(--bg-tertiary)' : '#ffffff';

  if (propLoading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <Row className="g-4">
      <Col xs={12}>
        {message && (
          <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}
      </Col>

      <Col xs={12}>
        <Card className="shadow" style={{ backgroundColor: bgCard }}>
          <Card.Header style={{ backgroundColor: bgHeader }}>
            <h5 className="mb-0">
              {existingFormation ? `✏️ ${t("admin.editFormationTitle")}` : `➕ ${t("admin.addFormation")}`}
            </h5>
          </Card.Header>
          <Card.Body>
            <Form onSubmit={handleSave}>
              {/* Selezione Utente */}
              <Form.Group className="mb-3">
                <Form.Label>{t("formations.selectUser")} *</Form.Label>
                <Form.Select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  required
                >
                  <option value="">{t("formations.selectUser")}</option>
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              {/* Selezione Gara */}
              <Form.Group className="mb-3">
                <Form.Label>{t("formations.selectRace")} *</Form.Label>
                <Form.Select
                  value={selectedRace?.id || ""}
                  onChange={(e) => {
                    const race = races.find((r) => r.id === e.target.value);
                    setSelectedRace(race || null);
                  }}
                  required
                >
                  <option value="">{t("formations.selectRace")}</option>
                  {races.map((r) => {
                    const hasFormation = racesWithFormations.has(r.id);
                    const isCalculated = r.pointsCalculated;
                    const isSprint = r.qualiSprintUTC;

                    let indicators = [];
                    if (isSprint) indicators.push("🏃");
                    if (hasFormation) indicators.push("✓");
                    if (isCalculated) indicators.push("📊");

                    const label = `${r.round}. ${r.name}${indicators.length > 0 ? ` ${indicators.join(" ")}` : ""}`;

                    return (
                      <option key={r.id} value={r.id}>
                        {label}
                      </option>
                    );
                  })}
                </Form.Select>
                <Form.Text className="text-muted">
                  🏃 = {t("formations.sprint")} | ✓ = {t("formations.editFormation")} | 📊 = {t("common.points")}
                </Form.Text>
              </Form.Group>

              {selectedUser && selectedRace && (
                <>
                  <hr />
                  <h6 className="fw-bold">{t("formations.mainRace")}</h6>

                  <Form.Group className="mb-2">
                    <Form.Label>P1 * {isFieldInvalid('mainP1') && <span className="text-danger">({t("formations.required")})</span>}</Form.Label>
                    <Select
                      options={getAvailableMainOptions('mainP1')}
                      value={formData.mainP1}
                      onChange={(sel) => setFormData({ ...formData, mainP1: sel })}
                      placeholder={t("formations.selectUser")}
                      styles={isFieldInvalid('mainP1') ? invalidSelectStyles : selectStyles}
                      noOptionsMessage={() => t("errors.duplicateDriver")}
                    />
                  </Form.Group>

                  <Form.Group className="mb-2">
                    <Form.Label>P2 * {isFieldInvalid('mainP2') && <span className="text-danger">({t("formations.required")})</span>}</Form.Label>
                    <Select
                      options={getAvailableMainOptions('mainP2')}
                      value={formData.mainP2}
                      onChange={(sel) => setFormData({ ...formData, mainP2: sel })}
                      placeholder={t("formations.selectUser")}
                      styles={isFieldInvalid('mainP2') ? invalidSelectStyles : selectStyles}
                      noOptionsMessage={() => t("errors.duplicateDriver")}
                    />
                  </Form.Group>

                  <Form.Group className="mb-2">
                    <Form.Label>P3 * {isFieldInvalid('mainP3') && <span className="text-danger">({t("formations.required")})</span>}</Form.Label>
                    <Select
                      options={getAvailableMainOptions('mainP3')}
                      value={formData.mainP3}
                      onChange={(sel) => setFormData({ ...formData, mainP3: sel })}
                      placeholder={t("formations.selectUser")}
                      styles={isFieldInvalid('mainP3') ? invalidSelectStyles : selectStyles}
                      noOptionsMessage={() => t("errors.duplicateDriver")}
                    />
                  </Form.Group>

                  <Form.Group className="mb-2">
                    <Form.Label>{t("formations.joker")} * {isFieldInvalid('mainJolly') && <span className="text-danger">({t("formations.required")})</span>}</Form.Label>
                    <Select
                      options={getAvailableMainOptions('mainJolly')}
                      value={formData.mainJolly}
                      onChange={(sel) => setFormData({ ...formData, mainJolly: sel })}
                      placeholder={t("formations.selectUser")}
                      styles={isFieldInvalid('mainJolly') ? invalidSelectStyles : selectStyles}
                      noOptionsMessage={() => t("errors.duplicateDriver")}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>{t("formations.joker2")}</Form.Label>
                    <Select
                      options={getAvailableMainOptions('mainJolly2')}
                      value={formData.mainJolly2}
                      onChange={(sel) => setFormData({ ...formData, mainJolly2: sel })}
                      placeholder={t("formations.selectUser")}
                      styles={selectStyles}
                      isClearable
                      noOptionsMessage={() => t("errors.duplicateDriver")}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Check
                      type="checkbox"
                      label={`⏰ ${t("formations.lateSubmission")} (${t("formations.latePenalty")})`}
                      checked={isLateSubmission}
                      onChange={(e) => setIsLateSubmission(e.target.checked)}
                    />
                  </Form.Group>

                  {hasSprint && (
                    <>
                      <hr />
                      <h6 className="fw-bold">{t("formations.sprintOptional")}</h6>
                      <Alert variant="info" className="py-2 small">
                        <strong>ℹ️</strong> {t("formations.optional")}
                      </Alert>

                      <Form.Group className="mb-2">
                        <Form.Label>SP1</Form.Label>
                        <Select
                          options={getAvailableSprintOptions('sprintP1')}
                          value={formData.sprintP1}
                          onChange={(sel) => setFormData({ ...formData, sprintP1: sel })}
                          placeholder={t("formations.selectUser")}
                          styles={selectStyles}
                          isClearable
                          noOptionsMessage={() => t("errors.duplicateDriver")}
                        />
                      </Form.Group>

                      <Form.Group className="mb-2">
                        <Form.Label>SP2</Form.Label>
                        <Select
                          options={getAvailableSprintOptions('sprintP2')}
                          value={formData.sprintP2}
                          onChange={(sel) => setFormData({ ...formData, sprintP2: sel })}
                          placeholder={t("formations.selectUser")}
                          styles={selectStyles}
                          isClearable
                          noOptionsMessage={() => t("errors.duplicateDriver")}
                        />
                      </Form.Group>

                      <Form.Group className="mb-2">
                        <Form.Label>SP3</Form.Label>
                        <Select
                          options={getAvailableSprintOptions('sprintP3')}
                          value={formData.sprintP3}
                          onChange={(sel) => setFormData({ ...formData, sprintP3: sel })}
                          placeholder={t("formations.selectUser")}
                          styles={selectStyles}
                          isClearable
                          noOptionsMessage={() => t("errors.duplicateDriver")}
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>{t("formations.joker")} {t("formations.sprint")}</Form.Label>
                        <Select
                          options={getAvailableSprintOptions('sprintJolly')}
                          value={formData.sprintJolly}
                          onChange={(sel) => setFormData({ ...formData, sprintJolly: sel })}
                          placeholder={t("formations.selectUser")}
                          styles={selectStyles}
                          isClearable
                          noOptionsMessage={() => t("errors.duplicateDriver")}
                        />
                      </Form.Group>
                    </>
                  )}

                  <Button variant="danger" type="submit" disabled={saving} className="w-100">
                    {saving ? t("common.loading") : existingFormation ? t("common.update") : t("common.save")}
                  </Button>
                </>
              )}
            </Form>
          </Card.Body>
        </Card>
      </Col>

    </Row>
  );
}

/**
 * Calendar management component with ICS import support
 * @param {Object} props - Component props
 * @param {Array} props.races - List of races
 * @param {boolean} props.loading - Loading state
 * @param {Function} props.onDataChange - Callback to refresh data
 * @returns {JSX.Element} Calendar management interface
 */
function CalendarManager({ races: propRaces, loading: propLoading, onDataChange }) {
  const { t } = useLanguage();
  // Use races passed as props
  const races = propRaces;
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingRace, setEditingRace] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelType, setCancelType] = useState(""); // "main" or "sprint"
  const [editFormData, setEditFormData] = useState({
    qualiTime: "",
    sprintTime: "",
  });

  // ICS Import state
  const [icsFile, setIcsFile] = useState(null);
  const [parsedRaces, setParsedRaces] = useState([]);
  const [loadingIcs, setLoadingIcs] = useState(false);
  const [importing, setImporting] = useState(false);












  /**
   * Handle ICS file selection and parsing
   * @param {Event} e - File input change event
   */
  const handleIcsFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setIcsFile(selectedFile);
    setMessage(null);
    setLoadingIcs(true);

    try {
      const text = await selectedFile.text();
      const { parseF1Calendar } = await import("../utils/icsParser");
      const parsed = parseF1Calendar(text);
      setParsedRaces(parsed);
      setMessage({
        type: "success",
        text: `${t("common.success")}: ${parsed.length} ${t("history.pastRaces")}`,
      });
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
      setParsedRaces([]);
    } finally {
      setLoadingIcs(false);
    }
  };

  /**
   * Import parsed races into Firestore
   */
  const handleIcsImport = async () => {
    if (!parsedRaces.length) {
      setMessage({ type: "warning", text: t("leaderboard.noData") });
      return;
    }

    const confirmMsg = `${t("admin.confirmReset")}`;
    if (!window.confirm(confirmMsg)) return;

    setImporting(true);
    setMessage(null);

    try {
      for (const race of parsedRaces) {
        await setDoc(
          doc(db, "races", race.id),
          {
            name: race.name,
            round: race.round,
            qualiUTC: Timestamp.fromDate(race.qualiUTC),
            raceUTC: Timestamp.fromDate(race.raceUTC),
            qualiSprintUTC: race.qualiSprintUTC ? Timestamp.fromDate(race.qualiSprintUTC) : null,
            sprintUTC: race.sprintUTC ? Timestamp.fromDate(race.sprintUTC) : null,
          },
          { merge: true }
        );
      }

      setMessage({
        type: "success",
        text: `${t("common.success")}: ${parsedRaces.length} ${t("history.pastRaces")}`,
      });
      setParsedRaces([]);
      setIcsFile(null);
      await onDataChange();
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setImporting(false);
    }
  };

  const handleEditRace = (race) => {
    setEditingRace(race);

    // Estrai solo l'ora dal timestamp
    const formatTime = (firestoreTimestamp) => {
      if (!firestoreTimestamp) return "";
      const date = new Date(firestoreTimestamp.seconds * 1000);
      return date.toTimeString().slice(0, 5); // HH:MM
    };

    setEditFormData({
      qualiTime: formatTime(race.qualiUTC),
      sprintTime: race.qualiSprintUTC ? formatTime(race.qualiSprintUTC) : "",
    });

    setShowEditModal(true);
  };

  const handleCancelRace = (type) => {
    setCancelType(type);
    setShowCancelModal(true);
  };

  const confirmCancelRace = async () => {
    if (!editingRace || !cancelType) return;

    setUploading(true);
    setMessage(null);

    try {
      const updates = {};
      if (cancelType === "main") {
        updates.cancelledMain = true;
      } else if (cancelType === "sprint") {
        updates.cancelledSprint = true;
      }

      await updateDoc(doc(db, "races", editingRace.id), updates);

      setMessage({
        type: "success",
        text: t("admin.raceUpdated"),
      });

      setShowCancelModal(false);
      setCancelType("");
      await onDataChange();

      // Aggiorna anche i dati nel modal di edit
      setEditingRace(prev => ({
        ...prev,
        ...(cancelType === "main" ? { cancelledMain: true } : { cancelledSprint: true })
      }));
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveRaceDates = async () => {
    if (!editingRace) return;

    setUploading(true);
    setMessage(null);

    try {
      // Aggiorna solo l'ora mantenendo la data originale
      const updateTime = (originalTimestamp, newTime) => {
        if (!originalTimestamp || !newTime) return null;
        const originalDate = new Date(originalTimestamp.seconds * 1000);
        const [hours, minutes] = newTime.split(':');
        originalDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return Timestamp.fromDate(originalDate);
      };

      const updates = {
        qualiUTC: updateTime(editingRace.qualiUTC, editFormData.qualiTime),
      };

      // Aggiorna sprint solo se la gara ha sprint
      if (editingRace.qualiSprintUTC && editFormData.sprintTime) {
        updates.qualiSprintUTC = updateTime(editingRace.qualiSprintUTC, editFormData.sprintTime);
      }

      await updateDoc(doc(db, "races", editingRace.id), updates);

      setMessage({
        type: "success",
        text: t("admin.raceUpdated"),
      });

      setShowEditModal(false);
      setEditingRace(null);
      await onDataChange();
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setUploading(false);
    }
  };

  if (propLoading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <Row className="g-4">
      {/* ICS Import Section */}
      <Col xs={12}>
        <Card className="shadow border-primary">
          <Card.Header className="bg-primary text-white">
            <h5 className="mb-0">📅 {t("admin.importICS")}</h5>
          </Card.Header>
          <Card.Body>
            <p>
              {t("admin.raceCalendar")}
            </p>

            {message && (
              <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}

            <Form.Group className="mb-3">
              <Form.Label>{t("admin.importICS")}</Form.Label>
              <Form.Control
                type="file"
                accept=".ics"
                onChange={handleIcsFileSelect}
                disabled={loadingIcs || importing}
              />
            </Form.Group>

            {loadingIcs && (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" className="me-2" />
                {t("common.loading")}
              </div>
            )}

            {parsedRaces.length > 0 && !loadingIcs && (
              <>
                <Alert variant="info">
                  {parsedRaces.length} {t("history.pastRaces")}
                </Alert>

                <div className="table-responsive" style={{ maxHeight: "300px", overflowY: "auto" }}>
                  <Table striped bordered hover size="sm">
                    <thead style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 1 }}>
                      <tr>
                        <th>#</th>
                        <th>{t("admin.raceName")}</th>
                        <th>{t("admin.qualifyingDate")}</th>
                        <th>{t("admin.raceDate")}</th>
                        <th>{t("formations.sprint")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRaces.map((race) => (
                        <tr key={race.id}>
                          <td>{race.round}</td>
                          <td>{race.name}</td>
                          <td>{race.qualiUTC.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</td>
                          <td>{race.raceUTC.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</td>
                          <td>
                            {race.sprintUTC ? (
                              <span className="text-success">✓</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  className="w-100 mt-3"
                  onClick={handleIcsImport}
                  disabled={importing}
                >
                  {importing ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      {t("common.loading")}
                    </>
                  ) : (
                    `📥 ${t("admin.importICS")} (${parsedRaces.length})`
                  )}
                </Button>
              </>
            )}
          </Card.Body>
        </Card>
      </Col>

      <Col xs={12}>
        <Card className="shadow">
          <Card.Header className="bg-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">{t("admin.raceCalendar")} ({races.length})</h5>
            <Button size="sm" variant="outline-primary" onClick={onDataChange}>
              🔄
            </Button>
          </Card.Header>
          <Card.Body className="p-0">
            {races.length === 0 ? (
              <Alert variant="info" className="m-3">
                {t("leaderboard.noData")}
              </Alert>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0" size="sm">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "50px" }}>#</th>
                      <th>{t("admin.raceName")}</th>
                      <th>{t("admin.raceDate")}</th>
                      <th>{t("admin.qualifyingDate")}</th>
                      <th className="text-center">{t("formations.sprint")}</th>
                      <th className="text-center">{t("admin.hasResults")}</th>
                      <th style={{ width: "80px" }} className="text-center">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {races.map((r) => (
                      <tr key={r.id}>
                        <td>{r.round}</td>
                        <td>
                          {r.name}
                          {r.cancelledMain && (
                            <Badge bg="danger" className="ms-2">{t("errors.raceCancelled")}</Badge>
                          )}
                          {r.cancelledSprint && r.qualiSprintUTC && (
                            <Badge bg="warning" text="dark" className="ms-2">{t("formations.sprint")} {t("errors.raceCancelled")}</Badge>
                          )}
                        </td>
                        <td>
                          {r.raceUTC
                            ? new Date(r.raceUTC.seconds * 1000).toLocaleString("it-IT", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—"}
                        </td>
                        <td>
                          {r.qualiUTC
                            ? new Date(r.qualiUTC.seconds * 1000).toLocaleString("it-IT", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—"}
                        </td>
                        <td className="text-center">
                          {r.qualiSprintUTC ? (
                            r.cancelledSprint ? (
                              <Badge bg="secondary">✗</Badge>
                            ) : (
                              <Badge bg="warning" text="dark">✓</Badge>
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-center">
                          {r.officialResults ? (
                            <Badge bg="success">{t("admin.hasResults")}</Badge>
                          ) : (
                            <Badge bg="secondary">Pending</Badge>
                          )}
                        </td>
                        <td className="text-center">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => handleEditRace(r)}
                          >
                            ✏️
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      </Col>

      {/* Modal per modificare date gara */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>✏️ {t("admin.editRace")} - {editingRace?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {/* Data Gara (solo visualizzazione) */}
            <Alert variant="light" className="mb-4">
              <strong>{t("admin.raceDate")}:</strong>{" "}
              {editingRace?.raceUTC && new Date(editingRace.raceUTC.seconds * 1000).toLocaleDateString("it-IT", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
              })}
            </Alert>

            {/* Orario Deadline Gara Principale */}
            <h6>⏰ {t("formations.deadline")} {t("formations.mainRace")}</h6>
            <Form.Group className="mb-3">
              <Form.Label>{t("formations.deadline")}</Form.Label>
              <Form.Control
                type="time"
                value={editFormData.qualiTime}
                onChange={(e) => setEditFormData({ ...editFormData, qualiTime: e.target.value })}
                required
                disabled={editingRace?.cancelledMain}
              />
            </Form.Group>

            {/* Bottone Cancella Gara */}
            {!editingRace?.cancelledMain ? (
              <Button
                variant="danger"
                size="sm"
                className="mb-4"
                onClick={() => handleCancelRace("main")}
              >
                ⛔ {t("errors.raceCancelled")}
              </Button>
            ) : (
              <Alert variant="danger" className="mb-4">
                <strong>⚠️ {t("errors.raceCancelled")}</strong>
              </Alert>
            )}

            {/* Sezione Sprint - mostrata solo se la gara ha sprint */}
            {editingRace?.qualiSprintUTC && (
              <>
                <hr />
                <h6>🏁 {t("formations.sprint")}</h6>

                <Form.Group className="mb-3">
                  <Form.Label>{t("formations.deadline")} {t("formations.sprint")}</Form.Label>
                  <Form.Control
                    type="time"
                    value={editFormData.sprintTime}
                    onChange={(e) => setEditFormData({ ...editFormData, sprintTime: e.target.value })}
                    disabled={editingRace?.cancelledSprint}
                  />
                </Form.Group>

                {/* Bottone Cancella Sprint */}
                {!editingRace?.cancelledSprint ? (
                  <Button
                    variant="warning"
                    size="sm"
                    onClick={() => handleCancelRace("sprint")}
                  >
                    ⛔ {t("formations.sprint")} {t("errors.raceCancelled")}
                  </Button>
                ) : (
                  <Alert variant="warning">
                    <strong>⚠️ {t("formations.sprint")} {t("errors.raceCancelled")}</strong>
                  </Alert>
                )}
              </>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={handleSaveRaceDates} disabled={uploading}>
            {uploading ? <Spinner animation="border" size="sm" /> : `💾 ${t("common.save")}`}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal conferma cancellazione */}
      <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>⚠️ {t("common.confirm")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant={cancelType === "main" ? "danger" : "warning"}>
            <strong>{t("common.warning")}!</strong>
            <br />
            {t("admin.deleteWarning")}
          </Alert>
          <p className="mb-0">{t("admin.confirmReset")}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={cancelType === "main" ? "danger" : "warning"}
            onClick={confirmCancelRace}
            disabled={uploading}
          >
            {uploading ? <Spinner animation="border" size="sm" /> : t("common.confirm")}
          </Button>
        </Modal.Footer>
      </Modal>
    </Row>
  );
}

/**
 * Database reset and backup component
 * @param {Object} props - Component props
 * @param {Array} props.participants - List of participants
 * @param {Array} props.races - List of races
 * @param {Function} props.onDataChange - Callback to refresh data
 * @returns {JSX.Element} Database reset interface with backup functionality
 */
function DatabaseReset({ participants, races, onDataChange }) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [resetType, setResetType] = useState("");
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [backingUp, setBackingUp] = useState(false);

  // Backup management states
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [restoring, setRestoring] = useState(false);

  /**
   * Load all backups from database
   */
  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const allBackups = await getAllBackups();
      setBackups(allBackups);
    } catch (err) {
      console.error("Error loading backups:", err);
      setMessage({ type: "danger", text: `Errore caricamento backup: ${err.message}` });
    } finally {
      setLoadingBackups(false);
    }
  };

  // Load backups on mount
  useEffect(() => {
    loadBackups();
  }, []);

  /**
   * Create manual backup - both download and save to database
   */
  const handleCreateBackup = async () => {
    setBackingUp(true);
    setMessage(null);

    try {
      // Create and save backup to database
      const backupId = await createAndSaveBackup("manual", {
        createdBy: "admin",
        description: "Backup manuale creato dall'admin panel",
      });

      // Also download it as JSON
      const backupsSnap = await getDocs(collection(db, "backups"));
      const savedBackup = backupsSnap.docs.find(d => d.id === backupId);
      if (savedBackup) {
        downloadBackupAsJSON(savedBackup.data(), `backup-manual-${Date.now()}`);
      }

      setMessage({
        type: "success",
        text: "✅ Backup creato e salvato con successo!"
      });

      // Reload backups list
      await loadBackups();
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: `Errore: ${err.message}` });
    } finally {
      setBackingUp(false);
    }
  };

  /**
   * Delete a backup from database
   */
  const handleDeleteBackup = async (backupId) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo backup?")) {
      return;
    }

    try {
      await deleteBackup(backupId);
      setMessage({ type: "success", text: "Backup eliminato" });
      await loadBackups();
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: `Errore: ${err.message}` });
    }
  };

  /**
   * Show restore preview modal
   */
  const handleShowRestorePreview = (backup) => {
    setSelectedBackup(backup);
    setShowRestoreModal(true);
  };

  /**
   * Restore database from backup
   */
  const handleRestore = async () => {
    if (confirmText !== "RESTORE") {
      setMessage({ type: "warning", text: "Devi digitare RESTORE per confermare" });
      return;
    }

    setRestoring(true);
    setMessage(null);

    try {
      await restoreFromBackup(selectedBackup);
      setMessage({
        type: "success",
        text: "✅ Database ripristinato con successo!"
      });
      setShowRestoreModal(false);
      setConfirmText("");
      setSelectedBackup(null);

      // Refresh data
      if (onDataChange) {
        onDataChange();
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: `Errore ripristino: ${err.message}` });
    } finally {
      setRestoring(false);
    }
  };

  const handleReset = async () => {
    if (confirmText !== "RESET") {
      setMessage({ type: "warning", text: t("admin.confirmReset") });
      return;
    }

    setResetting(true);
    setMessage(null);

    try {
      const batch = writeBatch(db);

      if (resetType === "submissions") {
        // Elimina tutte le submissions di tutte le gare
        const racesSnap = await getDocs(collection(db, "races"));
        for (const raceDoc of racesSnap.docs) {
          const subsSnap = await getDocs(collection(db, "races", raceDoc.id, "submissions"));
          subsSnap.docs.forEach((subDoc) => {
            batch.delete(subDoc.ref);
          });
        }
        await batch.commit();
        setMessage({ type: "success", text: t("success.deleted") });
      } else if (resetType === "ranking") {
        // Reset punteggi di tutti i partecipanti
        const rankSnap = await getDocs(collection(db, "ranking"));
        rankSnap.docs.forEach((userDoc) => {
          batch.update(userDoc.ref, {
            puntiTotali: 0,
            jolly: 0,
            pointsByRace: {},
            championshipPts: 0,
            championshipPiloti: [],
            championshipCostruttori: [],
          });
        });
        await batch.commit();
        setMessage({ type: "success", text: t("success.updated") });
      } else if (resetType === "all") {
        // Reset completo (solo punteggi, mantiene partecipanti e gare)
        const rankSnap = await getDocs(collection(db, "ranking"));
        rankSnap.docs.forEach((userDoc) => {
          batch.update(userDoc.ref, {
            puntiTotali: 0,
            jolly: 0,
            pointsByRace: {},
            championshipPts: 0,
            championshipPiloti: [],
            championshipCostruttori: [],
          });
        });

        const racesSnap = await getDocs(collection(db, "races"));
        for (const raceDoc of racesSnap.docs) {
          const subsSnap = await getDocs(collection(db, "races", raceDoc.id, "submissions"));
          subsSnap.docs.forEach((subDoc) => {
            batch.delete(subDoc.ref);
          });
        }

        await batch.commit();
        setMessage({ type: "success", text: t("success.deleted") });
      }

      setShowModal(false);
      setConfirmText("");
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: t("common.error") });
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <Row className="g-4">
        {/* Create Backup Section */}
        <Col xs={12}>
          <Card className="shadow border-success mb-4">
            <Card.Header className="bg-success text-white">
              <h5 className="mb-0">💾 Backup Database</h5>
            </Card.Header>
            <Card.Body>
              <p className="mb-3">Crea un backup completo del database (gare, classifiche, submissions). Il backup verrà salvato nel database e scaricato come file JSON.</p>
              <Button
                variant="success"
                onClick={handleCreateBackup}
                disabled={backingUp}
                className="w-100"
              >
                {backingUp ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Creazione backup...
                  </>
                ) : (
                  "📥 Crea Backup Manuale"
                )}
              </Button>
            </Card.Body>
          </Card>

          {message && (
            <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
              {message.text}
            </Alert>
          )}
        </Col>

        {/* Backups List Section */}
        <Col xs={12}>
          <Card className="shadow border-info mb-4">
            <Card.Header className="bg-info text-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">📋 Backup Salvati</h5>
              <Button
                size="sm"
                variant="light"
                onClick={loadBackups}
                disabled={loadingBackups}
              >
                {loadingBackups ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  "🔄 Aggiorna"
                )}
              </Button>
            </Card.Header>
            <Card.Body>
              {loadingBackups ? (
                <div className="text-center py-3">
                  <Spinner animation="border" />
                </div>
              ) : backups.length === 0 ? (
                <Alert variant="info" className="mb-0">
                  Nessun backup disponibile. Crea il tuo primo backup!
                </Alert>
              ) : (
                <div className="table-responsive">
                  <Table hover variant={isDark ? "dark" : undefined}>
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Data</th>
                        <th>Gare</th>
                        <th>Partecipanti</th>
                        <th className="text-end">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((backup) => {
                        const timestamp = backup.metadata?.timestamp?.toDate?.() || new Date();
                        return (
                          <tr key={backup.id}>
                            <td>
                              <Badge bg={backup.metadata?.type === "manual" ? "success" : "primary"}>
                                {backup.metadata?.type || "manual"}
                              </Badge>
                            </td>
                            <td>{timestamp.toLocaleString("it-IT")}</td>
                            <td>{backup.metadata?.totalRaces || backup.races?.length || 0}</td>
                            <td>{backup.metadata?.totalParticipants || backup.ranking?.length || 0}</td>
                            <td className="text-end">
                              <Button
                                size="sm"
                                variant="outline-primary"
                                className="me-2"
                                onClick={() => downloadBackupAsJSON(backup, backup.id)}
                              >
                                📥
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-warning"
                                className="me-2"
                                onClick={() => handleShowRestorePreview(backup)}
                              >
                                ⚡ Ripristina
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => handleDeleteBackup(backup.id)}
                              >
                                🗑️
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12}>
          <Card className="shadow border-danger">
            <Card.Body className="text-center">
              <h5>💥 {t("admin.resetAll")}</h5>
              <p className="text-muted">{t("admin.confirmReset")}</p>
              <Button
                variant="danger"
                onClick={() => {
                  setResetType("all");
                  setShowModal(true);
                }}
              >
                {t("admin.resetAll")}
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Modal di conferma Reset */}
      <Modal show={showModal} onHide={() => !resetting && setShowModal(false)} centered>
        <Modal.Header closeButton={!resetting}>
          <Modal.Title>⚠️ {t("common.confirm")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            {t("admin.resetAll")}
          </p>
          <p className="text-muted">{t("admin.confirmReset")}</p>

          <Form.Group>
            <Form.Label>
              {t("admin.confirmReset")}
            </Form.Label>
            <Form.Control
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET"
              disabled={resetting}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)} disabled={resetting}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={handleReset} disabled={resetting || confirmText !== "RESET"}>
            {resetting ? t("common.loading") : t("common.confirm")}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Ripristino Backup */}
      <Modal
        show={showRestoreModal}
        onHide={() => !restoring && setShowRestoreModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton={!restoring}>
          <Modal.Title>⚡ Ripristino Database</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="danger">
            <strong>⚠️ ATTENZIONE: OPERAZIONE IRREVERSIBILE</strong>
            <p className="mb-0 mt-2">
              Il ripristino cancellerà TUTTI i dati attuali (gare, classifiche, submissions)
              e li sostituirà con i dati del backup selezionato.
              <strong> Questa operazione NON può essere annullata!</strong>
            </p>
          </Alert>

          {selectedBackup && (
            <>
              <h6 className="mb-3">📋 Anteprima Backup</h6>
              <Table bordered size="sm" variant={isDark ? "dark" : undefined}>
                <tbody>
                  <tr>
                    <th style={{ width: "40%" }}>Tipo Backup:</th>
                    <td>
                      <Badge bg={selectedBackup.metadata?.type === "manual" ? "success" : "primary"}>
                        {selectedBackup.metadata?.type || "manual"}
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <th>Data Creazione:</th>
                    <td>
                      {(selectedBackup.metadata?.timestamp?.toDate?.() || new Date()).toLocaleString("it-IT")}
                    </td>
                  </tr>
                  <tr>
                    <th>Numero Gare:</th>
                    <td>
                      <Badge bg="info">
                        {selectedBackup.metadata?.totalRaces || selectedBackup.races?.length || 0} gare
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <th>Numero Partecipanti:</th>
                    <td>
                      <Badge bg="info">
                        {selectedBackup.metadata?.totalParticipants || selectedBackup.ranking?.length || 0} partecipanti
                      </Badge>
                    </td>
                  </tr>
                  {selectedBackup.metadata?.description && (
                    <tr>
                      <th>Descrizione:</th>
                      <td>{selectedBackup.metadata.description}</td>
                    </tr>
                  )}
                </tbody>
              </Table>

              <Form.Group className="mt-4">
                <Form.Label>
                  <strong>Digita "RESTORE" per confermare il ripristino:</strong>
                </Form.Label>
                <Form.Control
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RESTORE"
                  disabled={restoring}
                  autoComplete="off"
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowRestoreModal(false);
              setConfirmText("");
            }}
            disabled={restoring}
          >
            Annulla
          </Button>
          <Button
            variant="warning"
            onClick={handleRestore}
            disabled={restoring || confirmText !== "RESTORE"}
          >
            {restoring ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Ripristino in corso...
              </>
            ) : (
              "⚡ Ripristina Backup"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

