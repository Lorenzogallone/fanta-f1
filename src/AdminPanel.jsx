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
import { db } from "./firebase";
import { DRIVERS } from "./constants/racing";
import Select from "react-select";

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
          <div>
            <h4 className="mb-0">⚙️ Pannello Amministrazione</h4>
            <small>⚠️ Attenzione: queste operazioni sono irreversibili!</small>
          </div>
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

  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRace, setSelectedRace] = useState(null);
  const [existingFormation, setExistingFormation] = useState(null);

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

  const handleSave = async (e) => {
    e.preventDefault();

    if (!selectedUser || !selectedRace) {
      setMessage({ type: "warning", text: "Seleziona utente e gara" });
      return;
    }

    if (!formData.mainP1 || !formData.mainP2 || !formData.mainP3 || !formData.mainJolly) {
      setMessage({ type: "warning", text: "Completa almeno la formazione principale" });
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
        text: existingFormation ? "Formazione aggiornata!" : "Formazione aggiunta!",
      });

      // Ricarica la formazione
      await loadFormation();
    } catch (err) {
      console.error(err);
      setMessage({ type: "danger", text: "Errore durante il salvataggio" });
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
                  {races.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.round}. {r.name}
                      {r.qualiSprintUTC ? " (Sprint)" : ""}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              {selectedUser && selectedRace && (
                <>
                  <hr />
                  <h6 className="fw-bold">Gara Principale</h6>

                  <Form.Group className="mb-2">
                    <Form.Label>P1 *</Form.Label>
                    <Select
                      options={driverOptions}
                      value={formData.mainP1}
                      onChange={(sel) => setFormData({ ...formData, mainP1: sel })}
                      placeholder="Seleziona pilota"
                    />
                  </Form.Group>

                  <Form.Group className="mb-2">
                    <Form.Label>P2 *</Form.Label>
                    <Select
                      options={driverOptions}
                      value={formData.mainP2}
                      onChange={(sel) => setFormData({ ...formData, mainP2: sel })}
                      placeholder="Seleziona pilota"
                    />
                  </Form.Group>

                  <Form.Group className="mb-2">
                    <Form.Label>P3 *</Form.Label>
                    <Select
                      options={driverOptions}
                      value={formData.mainP3}
                      onChange={(sel) => setFormData({ ...formData, mainP3: sel })}
                      placeholder="Seleziona pilota"
                    />
                  </Form.Group>

                  <Form.Group className="mb-2">
                    <Form.Label>Jolly *</Form.Label>
                    <Select
                      options={driverOptions}
                      value={formData.mainJolly}
                      onChange={(sel) => setFormData({ ...formData, mainJolly: sel })}
                      placeholder="Seleziona pilota"
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Jolly 2 (opzionale)</Form.Label>
                    <Select
                      options={driverOptions}
                      value={formData.mainJolly2}
                      onChange={(sel) => setFormData({ ...formData, mainJolly2: sel })}
                      placeholder="Seleziona pilota"
                      isClearable
                    />
                  </Form.Group>

                  {hasSprint && (
                    <>
                      <hr />
                      <h6 className="fw-bold">Sprint</h6>

                      <Form.Group className="mb-2">
                        <Form.Label>SP1</Form.Label>
                        <Select
                          options={driverOptions}
                          value={formData.sprintP1}
                          onChange={(sel) => setFormData({ ...formData, sprintP1: sel })}
                          placeholder="Seleziona pilota"
                          isClearable
                        />
                      </Form.Group>

                      <Form.Group className="mb-2">
                        <Form.Label>SP2</Form.Label>
                        <Select
                          options={driverOptions}
                          value={formData.sprintP2}
                          onChange={(sel) => setFormData({ ...formData, sprintP2: sel })}
                          placeholder="Seleziona pilota"
                          isClearable
                        />
                      </Form.Group>

                      <Form.Group className="mb-2">
                        <Form.Label>SP3</Form.Label>
                        <Select
                          options={driverOptions}
                          value={formData.sprintP3}
                          onChange={(sel) => setFormData({ ...formData, sprintP3: sel })}
                          placeholder="Seleziona pilota"
                          isClearable
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Jolly Sprint</Form.Label>
                        <Select
                          options={driverOptions}
                          value={formData.sprintJolly}
                          onChange={(sel) => setFormData({ ...formData, sprintJolly: sel })}
                          placeholder="Seleziona pilota"
                          isClearable
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
                      <th className="text-center">Sprint</th>
                      <th className="text-center">Risultati</th>
                    </tr>
                  </thead>
                  <tbody>
                    {races.map((r) => (
                      <tr key={r.id}>
                        <td>{r.round}</td>
                        <td>{r.name}</td>
                        <td>
                          {r.raceUTC
                            ? new Date(r.raceUTC.seconds * 1000).toLocaleDateString("it-IT")
                            : "—"}
                        </td>
                        <td className="text-center">
                          {r.qualiSprintUTC ? (
                            <Badge bg="warning" text="dark">
                              ✓
                            </Badge>
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

/* ==================== RESET DATABASE ==================== */
function DatabaseReset() {
  const [showModal, setShowModal] = useState(false);
  const [resetType, setResetType] = useState("");
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirmText, setConfirmText] = useState("");

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
          <Alert variant="danger">
            <Alert.Heading>⚠️ ATTENZIONE - OPERAZIONI IRREVERSIBILI</Alert.Heading>
            <p>Queste operazioni eliminano definitivamente i dati. Non è possibile annullare!</p>
            <hr />
            <p className="mb-0">
              <strong>Consiglio:</strong> Fai un backup prima di procedere usando{" "}
              <code>node scripts_calendar/backup.js</code>
            </p>
          </Alert>

          {message && (
            <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
              {message.text}
            </Alert>
          )}
        </Col>

        <Col xs={12} md={4}>
          <Card className="shadow border-warning h-100">
            <Card.Body className="text-center">
              <h5>🗑️ Reset Formazioni</h5>
              <p className="text-muted">Elimina tutte le formazioni inviate (mantiene partecipanti e punteggi)</p>
              <Button
                variant="warning"
                onClick={() => {
                  setResetType("submissions");
                  setShowModal(true);
                }}
              >
                Reset Formazioni
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} md={4}>
          <Card className="shadow border-warning h-100">
            <Card.Body className="text-center">
              <h5>↩️ Reset Punteggi</h5>
              <p className="text-muted">Azzera punteggi e jolly di tutti i partecipanti (mantiene anagrafica)</p>
              <Button
                variant="warning"
                onClick={() => {
                  setResetType("ranking");
                  setShowModal(true);
                }}
              >
                Reset Punteggi
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} md={4}>
          <Card className="shadow border-danger h-100">
            <Card.Body className="text-center">
              <h5>💥 Reset Completo</h5>
              <p className="text-muted">Elimina formazioni e azzera tutti i punteggi</p>
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
          <Alert variant="danger" className="mb-3">
            <strong>ATTENZIONE!</strong> Questa operazione è irreversibile.
          </Alert>

          <p>
            Stai per eseguire:{" "}
            <strong>
              {resetType === "submissions"
                ? "Reset Formazioni"
                : resetType === "ranking"
                ? "Reset Punteggi"
                : "Reset Completo"}
            </strong>
          </p>

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
