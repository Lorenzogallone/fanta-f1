// src/AdminPanel.jsx
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
import CalculatePoints from "./CalculatePoints";

const ADMIN_PASSWORD = "SUCASOLERA";

/* ==================== COMPONENTE LOGIN ==================== */
function AdminLogin({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem("adminAuth", "true");
      onSuccess();
    } else {
      setError(true);
      setPassword("");
    }
  };

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col xs={12} md={6} lg={4}>
          <Card className="shadow border-danger">
            <Card.Header className="bg-danger text-white text-center">
              <h5 className="mb-0">🔒 Accesso Admin</h5>
            </Card.Header>
            <Card.Body>
              {error && (
                <Alert variant="danger" onClose={() => setError(false)} dismissible>
                  Password errata!
                </Alert>
              )}
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Inserisci password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                </Form.Group>
                <Button variant="danger" type="submit" className="w-100">
                  Accedi
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

/* ==================== COMPONENTE PRINCIPALE ==================== */
export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState("participants");

  useEffect(() => {
    // Controlla se già autenticato
    const auth = localStorage.getItem("adminAuth");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("adminAuth");
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <AdminLogin onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <Container className="py-4">
      <Card className="shadow border-danger mb-4">
        <Card.Header className="bg-danger text-white d-flex justify-content-between align-items-center">
          <h4 className="mb-0">⚙️ Pannello Amministrazione</h4>
          <Button size="sm" variant="light" onClick={handleLogout}>
            🔓 Esci
          </Button>
        </Card.Header>
      </Card>

      <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
        <Nav variant="tabs" className="mb-4">
          <Nav.Item>
            <Nav.Link eventKey="participants">👥 Partecipanti</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="formations">📝 Formazioni</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="calendar">📅 Calendario Gare</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="calculate">🧮 Calcola Punteggi</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="import-ics">📅 Import ICS</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="reset">🗑️ Reset Database</Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          <Tab.Pane eventKey="participants">
            <ParticipantsManager />
          </Tab.Pane>

          <Tab.Pane eventKey="formations">
            <FormationsManager />
          </Tab.Pane>

          <Tab.Pane eventKey="calendar">
            <CalendarManager />
          </Tab.Pane>

          <Tab.Pane eventKey="calculate">
            <CalculatePoints />
          </Tab.Pane>

          <Tab.Pane eventKey="import-ics">
            <ICSImporter />
          </Tab.Pane>

          <Tab.Pane eventKey="reset">
            <DatabaseReset />
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </Container>
  );
}

/* ==================== GESTIONE PARTECIPANTI ==================== */
function ParticipantsManager() {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ id: "", name: "", puntiTotali: 0, jolly: 0 });

  // Carica partecipanti
  useEffect(() => {
    loadParticipants();
  }, []);

  const loadParticipants = async () => {
    try {
      const snap = await getDocs(collection(db, "ranking"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setParticipants(list.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: "Errore caricamento partecipanti" });
    } finally {
      setLoading(false);
    }
  };

  // Aggiungi nuovo partecipante
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!formData.id || !formData.name) {
      setMessage({ type: "warning", text: "ID e Nome sono obbligatori" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await setDoc(doc(db, "ranking", formData.id), {
        name: formData.name,
        puntiTotali: parseInt(formData.puntiTotali) || 0,
        jolly: parseInt(formData.jolly) || 0,
        pointsByRace: {},
        championshipPiloti: [],
        championshipCostruttori: [],
        championshipPts: 0,
      });

      setMessage({ type: "success", text: "Partecipante aggiunto!" });
      setFormData({ id: "", name: "", puntiTotali: 0, jolly: 0 });
      loadParticipants();
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: "Errore durante l'aggiunta" });
    } finally {
      setSaving(false);
    }
  };

  // Modifica partecipante
  const handleEdit = (participant) => {
    setEditingId(participant.id);
    setFormData({
      id: participant.id,
      name: participant.name,
      puntiTotali: participant.puntiTotali || 0,
      jolly: participant.jolly || 0,
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await updateDoc(doc(db, "ranking", editingId), {
        name: formData.name,
        puntiTotali: parseInt(formData.puntiTotali) || 0,
        jolly: parseInt(formData.jolly) || 0,
      });

      setMessage({ type: "success", text: "Partecipante aggiornato!" });
      setEditingId(null);
      setFormData({ id: "", name: "", puntiTotali: 0, jolly: 0 });
      loadParticipants();
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: "Errore durante l'aggiornamento" });
    } finally {
      setSaving(false);
    }
  };

  // Elimina partecipante
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Sei sicuro di voler eliminare ${name}?`)) return;

    setSaving(true);
    try {
      await deleteDoc(doc(db, "ranking", id));
      setMessage({ type: "success", text: "Partecipante eliminato!" });
      loadParticipants();
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: "Errore durante l'eliminazione" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <Row className="g-4">
      <Col xs={12} lg={6}>
        <Card className="shadow">
          <Card.Header className="bg-white">
            <h5 className="mb-0">
              {editingId ? "✏️ Modifica Partecipante" : "➕ Aggiungi Partecipante"}
            </h5>
          </Card.Header>
          <Card.Body>
            {message && (
              <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}

            <Form onSubmit={editingId ? handleUpdate : handleAdd}>
              <Form.Group className="mb-3">
                <Form.Label>ID Utente *</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="es: mario"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  disabled={editingId !== null}
                  required
                />
                <Form.Text>Usato come identificativo unico (non modificabile)</Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Nome Completo *</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="es: Mario Rossi"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Punti Totali</Form.Label>
                <Form.Control
                  type="number"
                  value={formData.puntiTotali}
                  onChange={(e) => setFormData({ ...formData, puntiTotali: e.target.value })}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Jolly Disponibili</Form.Label>
                <Form.Control
                  type="number"
                  value={formData.jolly}
                  onChange={(e) => setFormData({ ...formData, jolly: e.target.value })}
                />
              </Form.Group>

              <div className="d-flex gap-2">
                <Button variant="danger" type="submit" disabled={saving} className="flex-grow-1">
                  {saving ? "Salvataggio..." : editingId ? "Aggiorna" : "Aggiungi"}
                </Button>
                {editingId && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingId(null);
                      setFormData({ id: "", name: "", puntiTotali: 0, jolly: 0 });
                    }}
                  >
                    Annulla
                  </Button>
                )}
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Col>

      <Col xs={12} lg={6}>
        <Card className="shadow">
          <Card.Header className="bg-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Lista Partecipanti ({participants.length})</h5>
            <Button size="sm" variant="outline-primary" onClick={loadParticipants}>
              🔄 Ricarica
            </Button>
          </Card.Header>
          <Card.Body className="p-0">
            {participants.length === 0 ? (
              <Alert variant="info" className="m-3">
                Nessun partecipante trovato
              </Alert>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Nome</th>
                      <th className="text-center">Punti</th>
                      <th className="text-center">Jolly</th>
                      <th className="text-center">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                          <br />
                          <small className="text-muted">ID: {p.id}</small>
                        </td>
                        <td className="text-center">
                          <Badge bg="primary">{p.puntiTotali || 0}</Badge>
                        </td>
                        <td className="text-center">
                          <Badge bg="success">{p.jolly || 0}</Badge>
                        </td>
                        <td className="text-center">
                          <Button
                            size="sm"
                            variant="outline-warning"
                            className="me-1"
                            onClick={() => handleEdit(p)}
                          >
                            ✏️
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => handleDelete(p.id, p.name)}
                          >
                            🗑️
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
  );
}

/* ==================== GESTIONE FORMAZIONI ==================== */
function FormationsManager() {
  const [participants, setParticipants] = useState([]);
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [touched, setTouched] = useState(false); // Per mostrare errori solo dopo il primo tentativo

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

  // Carica partecipanti e gare
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [partSnap, racesSnap] = await Promise.all([
        getDocs(collection(db, "ranking")),
        getDocs(collection(db, "races")),
      ]);

      const partList = partSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setParticipants(partList.sort((a, b) => a.name.localeCompare(b.name)));

      const racesList = racesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      racesList.sort((a, b) => a.round - b.round);
      setRaces(racesList);
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: "Errore caricamento dati" });
    } finally {
      setLoading(false);
    }
  };

  // Carica lo stato delle formazioni e seleziona automaticamente la prima gara senza formazione
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

  // Carica formazione esistente quando seleziono utente + gara
  useEffect(() => {
    if (!selectedUser || !selectedRace) {
      setExistingFormation(null);
      resetForm();
      return;
    }

    loadFormation();
  }, [selectedUser, selectedRace]);

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
    if (!selectedUser) errors.push("Seleziona un utente");
    if (!selectedRace) errors.push("Seleziona una gara");

    // Campi obbligatori gara principale
    if (!formData.mainP1) errors.push("P1 è obbligatorio");
    if (!formData.mainP2) errors.push("P2 è obbligatorio");
    if (!formData.mainP3) errors.push("P3 è obbligatorio");
    if (!formData.mainJolly) errors.push("Jolly è obbligatorio");

    // Verifica duplicati nella gara principale
    const mainDrivers = [
      formData.mainP1?.value,
      formData.mainP2?.value,
      formData.mainP3?.value,
      formData.mainJolly?.value,
      formData.mainJolly2?.value
    ].filter(Boolean);

    if (new Set(mainDrivers).size !== mainDrivers.length) {
      errors.push("Non puoi selezionare lo stesso pilota più volte nella gara principale");
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
        errors.push("Non puoi selezionare lo stesso pilota più volte nella sprint");
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

      await setDoc(doc(db, "races", selectedRace.id, "submissions", selectedUser), payload, {
        merge: true,
      });

      setMessage({
        type: "success",
        text: `✓ ${existingFormation ? "Formazione aggiornata" : "Formazione aggiunta"} con successo!`,
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
      setMessage({ type: "danger", text: "❌ Errore durante il salvataggio: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const driverOptions = DRIVERS.map((d) => ({ value: d, label: d }));

  const hasSprint = Boolean(selectedRace?.qualiSprintUTC);

  if (loading) {
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

      <Col xs={12} lg={6}>
        <Card className="shadow">
          <Card.Header className="bg-white">
            <h5 className="mb-0">
              {existingFormation ? "✏️ Modifica Formazione" : "➕ Aggiungi Formazione"}
            </h5>
          </Card.Header>
          <Card.Body>
            <Form onSubmit={handleSave}>
              {/* Selezione Utente */}
              <Form.Group className="mb-3">
                <Form.Label>Utente *</Form.Label>
                <Form.Select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  required
                >
                  <option value="">Seleziona utente</option>
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              {/* Selezione Gara */}
              <Form.Group className="mb-3">
                <Form.Label>Gara *</Form.Label>
                <Form.Select
                  value={selectedRace?.id || ""}
                  onChange={(e) => {
                    const race = races.find((r) => r.id === e.target.value);
                    setSelectedRace(race || null);
                  }}
                  required
                >
                  <option value="">Seleziona gara</option>
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
                  🏃 = Sprint | ✓ = Formazione inserita | 📊 = Punti calcolati
                </Form.Text>
              </Form.Group>

              {selectedUser && selectedRace && (
                <>
                  <hr />
                  <h6 className="fw-bold">Gara Principale</h6>

                  <Form.Group className="mb-2">
                    <Form.Label>P1 * {isFieldInvalid('mainP1') && <span className="text-danger">(obbligatorio)</span>}</Form.Label>
                    <Select
                      options={getAvailableMainOptions('mainP1')}
                      value={formData.mainP1}
                      onChange={(sel) => setFormData({ ...formData, mainP1: sel })}
                      placeholder="Seleziona pilota"
                      styles={isFieldInvalid('mainP1') ? {
                        control: (base) => ({ ...base, borderColor: '#dc3545', boxShadow: '0 0 0 0.2rem rgba(220,53,69,.25)' })
                      } : {}}
                      noOptionsMessage={() => "Tutti i piloti sono stati selezionati"}
                    />
                  </Form.Group>

                  <Form.Group className="mb-2">
                    <Form.Label>P2 * {isFieldInvalid('mainP2') && <span className="text-danger">(obbligatorio)</span>}</Form.Label>
                    <Select
                      options={getAvailableMainOptions('mainP2')}
                      value={formData.mainP2}
                      onChange={(sel) => setFormData({ ...formData, mainP2: sel })}
                      placeholder="Seleziona pilota"
                      styles={isFieldInvalid('mainP2') ? {
                        control: (base) => ({ ...base, borderColor: '#dc3545', boxShadow: '0 0 0 0.2rem rgba(220,53,69,.25)' })
                      } : {}}
                      noOptionsMessage={() => "Tutti i piloti sono stati selezionati"}
                    />
                  </Form.Group>

                  <Form.Group className="mb-2">
                    <Form.Label>P3 * {isFieldInvalid('mainP3') && <span className="text-danger">(obbligatorio)</span>}</Form.Label>
                    <Select
                      options={getAvailableMainOptions('mainP3')}
                      value={formData.mainP3}
                      onChange={(sel) => setFormData({ ...formData, mainP3: sel })}
                      placeholder="Seleziona pilota"
                      styles={isFieldInvalid('mainP3') ? {
                        control: (base) => ({ ...base, borderColor: '#dc3545', boxShadow: '0 0 0 0.2rem rgba(220,53,69,.25)' })
                      } : {}}
                      noOptionsMessage={() => "Tutti i piloti sono stati selezionati"}
                    />
                  </Form.Group>

                  <Form.Group className="mb-2">
                    <Form.Label>Jolly * {isFieldInvalid('mainJolly') && <span className="text-danger">(obbligatorio)</span>}</Form.Label>
                    <Select
                      options={getAvailableMainOptions('mainJolly')}
                      value={formData.mainJolly}
                      onChange={(sel) => setFormData({ ...formData, mainJolly: sel })}
                      placeholder="Seleziona pilota"
                      styles={isFieldInvalid('mainJolly') ? {
                        control: (base) => ({ ...base, borderColor: '#dc3545', boxShadow: '0 0 0 0.2rem rgba(220,53,69,.25)' })
                      } : {}}
                      noOptionsMessage={() => "Tutti i piloti sono stati selezionati"}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Jolly 2 (opzionale)</Form.Label>
                    <Select
                      options={getAvailableMainOptions('mainJolly2')}
                      value={formData.mainJolly2}
                      onChange={(sel) => setFormData({ ...formData, mainJolly2: sel })}
                      placeholder="Seleziona pilota"
                      isClearable
                      noOptionsMessage={() => "Tutti i piloti sono stati selezionati"}
                    />
                  </Form.Group>

                  {hasSprint && (
                    <>
                      <hr />
                      <h6 className="fw-bold">Sprint (opzionale)</h6>
                      <Alert variant="info" className="py-2 small">
                        <strong>ℹ️ Nota:</strong> Puoi usare gli stessi piloti della gara principale
                      </Alert>

                      <Form.Group className="mb-2">
                        <Form.Label>SP1</Form.Label>
                        <Select
                          options={getAvailableSprintOptions('sprintP1')}
                          value={formData.sprintP1}
                          onChange={(sel) => setFormData({ ...formData, sprintP1: sel })}
                          placeholder="Seleziona pilota"
                          isClearable
                          noOptionsMessage={() => "Tutti i piloti sono stati selezionati nella sprint"}
                        />
                      </Form.Group>

                      <Form.Group className="mb-2">
                        <Form.Label>SP2</Form.Label>
                        <Select
                          options={getAvailableSprintOptions('sprintP2')}
                          value={formData.sprintP2}
                          onChange={(sel) => setFormData({ ...formData, sprintP2: sel })}
                          placeholder="Seleziona pilota"
                          isClearable
                          noOptionsMessage={() => "Tutti i piloti sono stati selezionati nella sprint"}
                        />
                      </Form.Group>

                      <Form.Group className="mb-2">
                        <Form.Label>SP3</Form.Label>
                        <Select
                          options={getAvailableSprintOptions('sprintP3')}
                          value={formData.sprintP3}
                          onChange={(sel) => setFormData({ ...formData, sprintP3: sel })}
                          placeholder="Seleziona pilota"
                          isClearable
                          noOptionsMessage={() => "Tutti i piloti sono stati selezionati nella sprint"}
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Jolly Sprint</Form.Label>
                        <Select
                          options={getAvailableSprintOptions('sprintJolly')}
                          value={formData.sprintJolly}
                          onChange={(sel) => setFormData({ ...formData, sprintJolly: sel })}
                          placeholder="Seleziona pilota"
                          isClearable
                          noOptionsMessage={() => "Tutti i piloti sono stati selezionati nella sprint"}
                        />
                      </Form.Group>
                    </>
                  )}

                  <Button variant="danger" type="submit" disabled={saving} className="w-100">
                    {saving ? "Salvataggio..." : existingFormation ? "Aggiorna" : "Salva"}
                  </Button>
                </>
              )}
            </Form>
          </Card.Body>
        </Card>
      </Col>

      <Col xs={12} lg={6}>
        <Card className="shadow">
          <Card.Header className="bg-white">
            <h5 className="mb-0">ℹ️ Info</h5>
          </Card.Header>
          <Card.Body>
            <Alert variant="info">
              <strong>Come usare:</strong>
              <ol className="mb-0 mt-2">
                <li>Seleziona un utente</li>
                <li>Seleziona una gara</li>
                <li>Compila la formazione (o modifica quella esistente)</li>
                <li>Salva</li>
              </ol>
            </Alert>

            {existingFormation && (
              <Alert variant="success">
                <strong>✓ Formazione esistente trovata</strong>
                <br />
                <small>
                  Inviata il:{" "}
                  {existingFormation.submittedAt
                    ? new Date(existingFormation.submittedAt.seconds * 1000).toLocaleString(
                        "it-IT"
                      )
                    : "—"}
                </small>
              </Alert>
            )}

            {selectedUser && selectedRace && !existingFormation && (
              <Alert variant="warning">
                <strong>⚠️ Nessuna formazione esistente</strong>
                <br />
                <small>Stai creando una nuova formazione per questo utente</small>
              </Alert>
            )}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

/* ==================== GESTIONE CALENDARIO ==================== */
function CalendarManager() {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingRace, setEditingRace] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    qualiDate: "",
    qualiTime: "",
    sprintDate: "",
    sprintTime: "",
    cancelledMain: false,
    cancelledSprint: false,
  });











  useEffect(() => {
    loadRaces();
  }, []);

  const loadRaces = async () => {
    try {
      const snap = await getDocs(collection(db, "races"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => a.round - b.round);
      setRaces(list);
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: "Errore caricamento gare" });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    try {
      const text = await file.text();

      setMessage({
        type: "info",
        text: `File caricato: ${file.name}. Implementa parsing ICS nel backend (scripts_calendar/seedRacesFromICS.js)`,
      });

      // Nota: il parsing ICS complesso dovrebbe essere fatto backend-side
      // usando lo script esistente scripts_calendar/seedRacesFromICS.js
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: "Errore lettura file" });
    } finally {
      setUploading(false);
    }
  };

  const handleEditRace = (race) => {
    setEditingRace(race);

    // Converti timestamp Firestore in datetime-local format
    const formatDateTime = (firestoreTimestamp) => {
      if (!firestoreTimestamp) return { date: "", time: "" };
      const date = new Date(firestoreTimestamp.seconds * 1000);
      return {
        date: date.toISOString().split('T')[0],
        time: date.toTimeString().slice(0, 5), // HH:MM
      };
    };

    const qualiDateTime = formatDateTime(race.qualiUTC);
    const sprintDateTime = race.qualiSprintUTC ? formatDateTime(race.qualiSprintUTC) : { date: "", time: "" };

    setEditFormData({
      qualiDate: qualiDateTime.date,
      qualiTime: qualiDateTime.time,
      sprintDate: sprintDateTime.date,
      sprintTime: sprintDateTime.time,
      cancelledMain: race.cancelledMain || false,
      cancelledSprint: race.cancelledSprint || false,
    });

    setShowEditModal(true);
  };

  const handleSaveRaceDates = async () => {
    if (!editingRace) return;

    setUploading(true);
    setMessage(null);

    try {
      // Converti date+time in Timestamp Firestore
      const createTimestamp = (dateStr, timeStr) => {
        if (!dateStr || !timeStr) return null;
        const dateTime = new Date(`${dateStr}T${timeStr}:00`);
        return Timestamp.fromDate(dateTime);
      };

      const updates = {
        qualiUTC: createTimestamp(editFormData.qualiDate, editFormData.qualiTime),
        cancelledMain: editFormData.cancelledMain,
        cancelledSprint: editFormData.cancelledSprint,
      };

      // Sprint deadline è opzionale
      if (editFormData.sprintDate && editFormData.sprintTime) {
        updates.qualiSprintUTC = createTimestamp(editFormData.sprintDate, editFormData.sprintTime);
      } else {
        // Se svuotato, rimuovi
        updates.qualiSprintUTC = null;
      }

      await updateDoc(doc(db, "races", editingRace.id), updates);

      setMessage({
        type: "success",
        text: `✓ Deadline e stati aggiornati per ${editingRace.name}!`,
      });

      setShowEditModal(false);
      setEditingRace(null);
      await loadRaces();
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: "❌ Errore durante l'aggiornamento: " + err.message });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <Row className="g-4">
      <Col xs={12}>
        <Card className="shadow">
          <Card.Header className="bg-white">
            <h5 className="mb-0">📅 Carica Nuovo Calendario (.ics)</h5>
          </Card.Header>
          <Card.Body>
            <Alert variant="warning">
              <strong>⚠️ Nota:</strong> Per aggiornare il calendario, usa lo script backend:
              <br />
              <code>node scripts_calendar/seedRacesFromICS.js</code>
              <br />
              <br />
              Il file .ics deve essere inserito in <code>scripts_calendar/f1_2025.ics</code>
            </Alert>

            {message && (
              <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}

            <Form.Group>
              <Form.Label>Carica file .ics (anteprima)</Form.Label>
              <Form.Control type="file" accept=".ics" onChange={handleFileUpload} disabled={uploading} />
              <Form.Text>
                Seleziona un file calendario ICS (Google Calendar, Apple Calendar, ecc.)
              </Form.Text>
            </Form.Group>
          </Card.Body>
        </Card>
      </Col>

      <Col xs={12}>
        <Card className="shadow">
          <Card.Header className="bg-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Gare Attuali ({races.length})</h5>
            <Button size="sm" variant="outline-primary" onClick={loadRaces}>
              🔄 Ricarica
            </Button>
          </Card.Header>
          <Card.Body className="p-0">
            {races.length === 0 ? (
              <Alert variant="info" className="m-3">
                Nessuna gara trovata
              </Alert>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0" size="sm">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "50px" }}>#</th>
                      <th>Nome Gara</th>
                      <th>Data Gara</th>
                      <th>Data Qualifiche</th>
                      <th className="text-center">Sprint</th>
                      <th className="text-center">Risultati</th>
                      <th style={{ width: "80px" }} className="text-center">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {races.map((r) => (
                      <tr key={r.id}>
                        <td>{r.round}</td>
                        <td>
                          {r.name}
                          {r.cancelledMain && (
                            <Badge bg="danger" className="ms-2">CANCELLATA</Badge>
                          )}
                          {r.cancelledSprint && r.qualiSprintUTC && (
                            <Badge bg="warning" text="dark" className="ms-2">SPRINT CANCELLATA</Badge>
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
                            <Badge bg="success">Salvati</Badge>
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
          <Modal.Title>✏️ Gestisci Gara - {editingRace?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="small">
            <strong>ℹ️ Nota:</strong> Le deadline controllano quando gli utenti possono inserire le formazioni.
            Le gare cancellate non vengono conteggiate nei punteggi.
          </Alert>

          <Form>
            {/* Cancellazione Gara Principale */}
            <Card className="mb-3 border-danger">
              <Card.Body>
                <Form.Check
                  type="checkbox"
                  id="cancelledMain"
                  label="⛔ Segna gara come CANCELLATA"
                  checked={editFormData.cancelledMain}
                  onChange={(e) => setEditFormData({ ...editFormData, cancelledMain: e.target.checked })}
                />
                <Form.Text className="text-muted d-block mt-2">
                  Le gare cancellate non verranno calcolate nei punteggi e appariranno come "CANCELLATA" nello storico
                </Form.Text>
              </Card.Body>
            </Card>

            <h6>Deadline Formazione Gara Principale</h6>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Data Deadline *</Form.Label>
                  <Form.Control
                    type="date"
                    value={editFormData.qualiDate}
                    onChange={(e) => setEditFormData({ ...editFormData, qualiDate: e.target.value })}
                    required
                    disabled={editFormData.cancelledMain}
                  />
                  <Form.Text className="text-muted">
                    Gli utenti non potranno inserire formazioni dopo questa data
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Ora Deadline *</Form.Label>
                  <Form.Control
                    type="time"
                    value={editFormData.qualiTime}
                    onChange={(e) => setEditFormData({ ...editFormData, qualiTime: e.target.value })}
                    required
                    disabled={editFormData.cancelledMain}
                  />
                </Form.Group>
              </Col>
            </Row>

            <hr />

            {/* Cancellazione Sprint */}
            <Card className="mb-3 border-warning">
              <Card.Body>
                <Form.Check
                  type="checkbox"
                  id="cancelledSprint"
                  label="⛔ Segna sprint come CANCELLATA"
                  checked={editFormData.cancelledSprint}
                  onChange={(e) => setEditFormData({ ...editFormData, cancelledSprint: e.target.checked })}
                  disabled={!editingRace?.qualiSprintUTC && !editFormData.sprintDate}
                />
                <Form.Text className="text-muted d-block mt-2">
                  Le sprint cancellate non verranno calcolate nei punteggi
                </Form.Text>
              </Card.Body>
            </Card>

            <h6>Deadline Formazione Sprint (opzionale)</h6>
            <Alert variant="warning" className="small py-2">
              Lascia vuoto per rimuovere la sprint da questa gara
            </Alert>

            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Data Deadline Sprint</Form.Label>
                  <Form.Control
                    type="date"
                    value={editFormData.sprintDate}
                    onChange={(e) => setEditFormData({ ...editFormData, sprintDate: e.target.value })}
                    disabled={editFormData.cancelledSprint}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Ora Deadline Sprint</Form.Label>
                  <Form.Control
                    type="time"
                    value={editFormData.sprintTime}
                    onChange={(e) => setEditFormData({ ...editFormData, sprintTime: e.target.value })}
                    disabled={editFormData.cancelledSprint}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Annulla
          </Button>
          <Button variant="danger" onClick={handleSaveRaceDates} disabled={uploading}>
            {uploading ? <Spinner animation="border" size="sm" /> : "💾 Salva Modifiche"}
          </Button>
        </Modal.Footer>
      </Modal>
    </Row>
  );
}

/* ==================== RESET DATABASE ==================== */
function DatabaseReset() {
  const [showModal, setShowModal] = useState(false);
  const [resetType, setResetType] = useState("");
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [backingUp, setBackingUp] = useState(false);

  const handleBackup = async () => {
    setBackingUp(true);
    setMessage(null);

    try {
      const backup = {
        timestamp: new Date().toISOString(),
        version: "1.0",
        data: {}
      };

      // Backup ranking
      const rankingSnap = await getDocs(collection(db, "ranking"));
      backup.data.ranking = {};
      rankingSnap.docs.forEach(doc => {
        backup.data.ranking[doc.id] = doc.data();
      });

      // Backup races con submissions
      const racesSnap = await getDocs(collection(db, "races"));
      backup.data.races = {};

      for (const raceDoc of racesSnap.docs) {
        const raceData = raceDoc.data();
        backup.data.races[raceDoc.id] = {
          ...raceData,
          submissions: {}
        };

        // Backup submissions per questa gara
        const subsSnap = await getDocs(collection(db, "races", raceDoc.id, "submissions"));
        subsSnap.docs.forEach(subDoc => {
          backup.data.races[raceDoc.id].submissions[subDoc.id] = subDoc.data();
        });
      }

      // Backup championship
      try {
        const champDoc = await getDoc(doc(db, "championship", "results"));
        if (champDoc.exists()) {
          backup.data.championship = champDoc.data();
        }
      } catch (e) {
        // Championship potrebbe non esistere ancora
        backup.data.championship = null;
      }

      // Crea il file JSON e scaricalo
      const jsonString = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fanta-f1-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({
        type: "success",
        text: `✔️ Backup completato! File scaricato con ${Object.keys(backup.data.ranking).length} partecipanti e ${Object.keys(backup.data.races).length} gare.`
      });
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: "❌ Errore durante la creazione del backup: " + err.message });
    } finally {
      setBackingUp(false);
    }
  };

  const handleReset = async () => {
    if (confirmText !== "RESET") {
      setMessage({ type: "warning", text: 'Devi scrivere "RESET" per confermare' });
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
        setMessage({ type: "success", text: "✔️ Tutte le formazioni eliminate!" });
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
        setMessage({ type: "success", text: "✔️ Punteggi azzerati per tutti i partecipanti!" });
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
        setMessage({ type: "success", text: "✔️ Database completamente resettato!" });
      }

      setShowModal(false);
      setConfirmText("");
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: "❌ Errore durante il reset" });
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <Row className="g-4">
        <Col xs={12}>
          <Card className="shadow border-success mb-4">
            <Card.Header className="bg-success text-white">
              <h5 className="mb-0">💾 Backup Database</h5>
            </Card.Header>
            <Card.Body>
              <p>Scarica una copia completa del database in formato JSON. Include tutti i partecipanti, gare, formazioni e risultati.</p>
              <Button
                variant="success"
                onClick={handleBackup}
                disabled={backingUp}
                className="w-100"
              >
                {backingUp ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Creazione backup...
                  </>
                ) : (
                  "📥 Scarica Backup JSON"
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

        <Col xs={12}>
          <Card className="shadow border-danger">
            <Card.Body className="text-center">
              <h5>💥 Reset Completo</h5>
              <p className="text-muted">Elimina tutte le formazioni e azzera tutti i punteggi</p>
              <Button
                variant="danger"
                onClick={() => {
                  setResetType("all");
                  setShowModal(true);
                }}
              >
                Reset Completo
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Modal di conferma */}
      <Modal show={showModal} onHide={() => !resetting && setShowModal(false)} centered>
        <Modal.Header closeButton={!resetting}>
          <Modal.Title>⚠️ Conferma Operazione</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Stai per eseguire: <strong>Reset Completo</strong>
          </p>
          <p className="text-muted">Questa operazione eliminerà tutte le formazioni e azzererà tutti i punteggi.</p>

          <Form.Group>
            <Form.Label>
              Scrivi <code>RESET</code> per confermare:
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
            Annulla
          </Button>
          <Button variant="danger" onClick={handleReset} disabled={resetting || confirmText !== "RESET"}>
            {resetting ? "Esecuzione..." : "Conferma Reset"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

/* ==================== IMPORT ICS CALENDAR ==================== */
function ICSImporter() {
  const [file, setFile] = useState(null);
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState(null);

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setMessage(null);
    setLoading(true);

    try {
      const text = await selectedFile.text();
      const { parseF1Calendar } = await import("../utils/icsParser");
      const parsedRaces = parseF1Calendar(text);
      setRaces(parsedRaces);
      setMessage({
        type: "success",
        text: `✓ File parsato con successo! Trovate ${parsedRaces.length} gare.`,
      });
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: "❌ Errore nel parsing del file ICS: " + err.message });
      setRaces([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!races.length) {
      setMessage({ type: "warning", text: "Nessuna gara da importare" });
      return;
    }

    const confirmMsg = `Vuoi importare ${races.length} gare? Questa operazione sovrascriverà i dati esistenti.`;
    if (!window.confirm(confirmMsg)) return;

    setImporting(true);
    setMessage(null);

    try {
      for (const race of races) {
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
        text: `✅ Import completato! ${races.length} gare importate con successo.`,
      });
      setRaces([]);
      setFile(null);
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: "❌ Errore durante l'import: " + err.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Row className="g-4">
      <Col xs={12}>
        <Card className="shadow border-primary">
          <Card.Header className="bg-primary text-white">
            <h5 className="mb-0">📅 Importa Calendario da File ICS</h5>
          </Card.Header>
          <Card.Body>
            <p>
              Carica un file ICS (formato iCalendar) contenente il calendario F1 per importare
              automaticamente tutte le gare nel database.
            </p>

            {message && (
              <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Seleziona file .ics</Form.Label>
              <Form.Control
                type="file"
                accept=".ics"
                onChange={handleFileSelect}
                disabled={loading || importing}
              />
              <Form.Text className="text-muted">
                Formato supportato: file .ics del calendario ufficiale F1
              </Form.Text>
            </Form.Group>

            {loading && (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" className="me-2" />
                Parsing file...
              </div>
            )}

            {races.length > 0 && !loading && (
              <>
                <Alert variant="info">
                  <strong>Anteprima:</strong> {races.length} gare trovate nel file ICS
                </Alert>

                <div className="table-responsive" style={{ maxHeight: "400px", overflowY: "auto" }}>
                  <Table striped bordered hover size="sm">
                    <thead style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 1 }}>
                      <tr>
                        <th>#</th>
                        <th>Nome Gara</th>
                        <th>Qualifiche</th>
                        <th>Gara</th>
                        <th>Sprint</th>
                      </tr>
                    </thead>
                    <tbody>
                      {races.map((race) => (
                        <tr key={race.id}>
                          <td>{race.round}</td>
                          <td>{race.name}</td>
                          <td>{race.qualiUTC.toLocaleString("it-IT")}</td>
                          <td>{race.raceUTC.toLocaleString("it-IT")}</td>
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
                  onClick={handleImport}
                  disabled={importing}
                >
                  {importing ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Importazione in corso...
                    </>
                  ) : (
                    `📥 Importa ${races.length} Gare su Firestore`
                  )}
                </Button>
              </>
            )}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
