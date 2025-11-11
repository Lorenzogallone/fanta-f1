// src/ChampionshipForm.jsx
import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Badge,
  Alert,
  Spinner,
} from "react-bootstrap";
import Select from "react-select";
import { collection, getDocs, doc, getDoc, updateDoc, query, orderBy } from "firebase/firestore";
import { db } from "../services/firebase";
import ChampionshipSubmissions from "../components/ChampionshipSubmissions";
import { DRIVERS, CONSTRUCTORS, DRIVER_TEAM, TEAM_LOGOS } from "../constants/racing";
import { useTheme } from "../contexts/ThemeContext";
import "../styles/customSelect.css";

/* ---------- costanti importate da file centralizzato --------- */
const drivers = DRIVERS;
const constructors = CONSTRUCTORS;
const driverTeam = DRIVER_TEAM;
const teamLogos = TEAM_LOGOS;

/* helper per opzioni driver con logo ---------------------------------- */
const asDriverOptions = (driversList) =>
  driversList.map((name) => {
    const team = driverTeam[name];
    const logo = teamLogos[team];
    return {
      value: name,
      label: (
        <div className="select-option">
          {logo && <img className="option-logo" src={logo} alt={team} />}
          <span className="option-text">{name}</span>
        </div>
      ),
    };
  });

/* helper per opzioni costruttori con logo ------------------------------ */
const asConstructorOptions = (constructorsList) =>
  constructorsList.map((name) => {
    const logo = teamLogos[name];
    return {
      value: name,
      label: (
        <div className="select-option">
          {logo && <img className="option-logo" src={logo} alt={name} />}
          <span className="option-text">{name}</span>
        </div>
      ),
    };
  });

export default function ChampionshipForm() {
  const { isDark } = useTheme();
  const [rankingOptions, setRankingOptions] = useState([]);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [form, setForm] = useState({
    userId: "",
    D1: null,
    D2: null,
    D3: null,
    C1: null,
    C2: null,
    C3: null,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  /* usato per far "ricaricare" ChampionshipSubmissions */
  const [refreshKey, setRefreshKey] = useState(0);

  /* per rilevare se esiste già una formazione */
  const [isEdit, setIsEdit] = useState(false);

  /* deadline calcolata dinamicamente */
  const [deadlineMs, setDeadlineMs] = useState(null);
  const [deadlineText, setDeadlineText] = useState("");
  const [loadingDeadline, setLoadingDeadline] = useState(true);
  const pastDeadline = deadlineMs ? Date.now() > deadlineMs : false;

  /* ------------- carica lista utenti da "ranking" ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "ranking"));
        const options = snap.docs.map((docSnap) => ({
          value: docSnap.id,
          label: docSnap.data().name || docSnap.id,
        }));
        setRankingOptions(options);
      } catch (e) {
        console.error("Errore caricamento utenti:", e);
        setMessage({
          variant: "danger",
          text: "Non è stato possibile caricare gli utenti.",
        });
      } finally {
        setLoadingRanking(false);
      }
    })();
  }, []);

  /* ------------- calcola deadline dinamica dalla gara di metà campionato ---- */
  useEffect(() => {
    (async () => {
      try {
        const racesQuery = query(collection(db, "races"), orderBy("round", "asc"));
        const racesSnap = await getDocs(racesQuery);
        const races = racesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        if (races.length === 0) {
          // Nessuna gara trovata, usa fallback
          setDeadlineMs(new Date("2025-09-07T23:59:00").getTime());
          setDeadlineText("07/09 ore 23:59");
          setLoadingDeadline(false);
          return;
        }

        // Trova la gara di metà campionato
        const midRound = Math.ceil(races.length / 2);
        const midRace = races.find(r => r.round === midRound);

        if (midRace && midRace.raceUTC) {
          // Deadline = subito dopo la gara di metà campionato
          const raceDate = midRace.raceUTC.toDate();
          setDeadlineMs(raceDate.getTime());

          // Formatta la data per il badge
          const formatted = raceDate.toLocaleDateString("it-IT", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          setDeadlineText(formatted);
        } else {
          // Fallback se non si trova la gara di metà
          setDeadlineMs(new Date("2025-09-07T23:59:00").getTime());
          setDeadlineText("07/09 ore 23:59");
        }
      } catch (e) {
        console.error("Errore calcolo deadline:", e);
        // Fallback in caso di errore
        setDeadlineMs(new Date("2025-09-07T23:59:00").getTime());
        setDeadlineText("07/09 ore 23:59");
      } finally {
        setLoadingDeadline(false);
      }
    })();
  }, []);

  /* ------------- se cambia userId, precompila con valori esistenti -- */
  useEffect(() => {
    const { userId } = form;
    if (!userId) {
      setIsEdit(false);
      return;
    }

    (async () => {
      try {
        const userDoc = await getDoc(doc(db, "ranking", userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const { championshipPiloti, championshipCostruttori } = data;

          // Trova oggetti select corrispondenti
          const driverOpts = asDriverOptions(drivers);
          const constructorOpts = asConstructorOptions(constructors);

          if (
            Array.isArray(championshipPiloti) &&
            championshipPiloti.length === 3 &&
            Array.isArray(championshipCostruttori) &&
            championshipCostruttori.length === 3
          ) {
            setForm((f) => ({
              ...f,
              D1: driverOpts.find((o) => o.value === championshipPiloti[0]) || null,
              D2: driverOpts.find((o) => o.value === championshipPiloti[1]) || null,
              D3: driverOpts.find((o) => o.value === championshipPiloti[2]) || null,
              C1:
                constructorOpts.find((o) => o.value === championshipCostruttori[0]) ||
                null,
              C2:
                constructorOpts.find((o) => o.value === championshipCostruttori[1]) ||
                null,
              C3:
                constructorOpts.find((o) => o.value === championshipCostruttori[2]) ||
                null,
            }));
            setIsEdit(true);
          } else {
            // Nessuna formazione trovata per l'utente
            setForm((f) => ({
              ...f,
              D1: null,
              D2: null,
              D3: null,
              C1: null,
              C2: null,
              C3: null,
            }));
            setIsEdit(false);
          }
        }
      } catch (err) {
        console.error("Errore recupero formazione esistente:", err);
        setIsEdit(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.userId]);

  const onSel = (selected, field) =>
    setForm((f) => ({ ...f, [field]: selected }));

  const onChangeUser = (e) =>
    setForm((f) => ({ ...f, userId: e.target.value }));

  const allPicked =
    form.userId &&
    form.D1 &&
    form.D2 &&
    form.D3 &&
    form.C1 &&
    form.C2 &&
    form.C3;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allPicked || pastDeadline) return;

    setSaving(true);
    setMessage(null);

    const userId = form.userId;
    const driversPicked = [form.D1.value, form.D2.value, form.D3.value];
    const constructorsPicked = [form.C1.value, form.C2.value, form.C3.value];

    try {
      await updateDoc(doc(db, "ranking", userId), {
        championshipPiloti: driversPicked,
        championshipCostruttori: constructorsPicked,
      });
      setMessage({
        variant: "success",
        text: isEdit
          ? "Formazione campionato aggiornata!"
          : "Formazione campionato salvata!",
      });
      // forza il refresh della card di destra
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error("Errore salvataggio:", err);
      setMessage({
        variant: "danger",
        text: "Errore durante il salvataggio.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loadingRanking || loadingDeadline)
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="danger" />
        <p className="mt-3">Caricamento...</p>
      </Container>
    );

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";

  return (
    <Container className="py-5">
      <Row className="justify-content-center g-4 align-items-start">
        {/* FORM ------------------------------------------------------- */}
        <Col xs={12} lg={6}>
          <Card className="shadow" style={{ borderLeft: `4px solid ${accentColor}` }}>
            <Card.Body>
              <h4 className="text-center mb-3">
                📋 Formazione Campionato
              </h4>

              <div className="text-center mb-4">
                <Badge
                  bg={pastDeadline ? "danger" : "warning"}
                  text={pastDeadline ? "light" : "dark"}
                  className="fs-6 px-3 py-2"
                >
                  {pastDeadline ? "🔒 CHIUSO" : "⏰ Deadline: " + deadlineText}
                </Badge>
              </div>

              {pastDeadline && (
                <Alert variant="danger" className="text-center">
                  <strong>⚠️ Attenzione!</strong><br />
                  La deadline è scaduta. Non è più possibile inserire o modificare la formazione campionato.
                </Alert>
              )}

              {message && (
                <Alert
                  variant={message.variant}
                  onClose={() => setMessage(null)}
                  dismissible
                >
                  {message.text}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                {/* selezione utente */}
                <Form.Group className="mb-4">
                  <Form.Label>Utente</Form.Label>
                  <Form.Select
                    name="userId"
                    value={form.userId}
                    onChange={onChangeUser}
                    required
                    disabled={pastDeadline}
                  >
                    <option value="">Seleziona utente</option>
                    {rankingOptions.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <h6 className="fw-bold">Piloti</h6>
                {["D1", "D2", "D3"].map((f) => (
                  <Form.Group key={f} className="mb-3">
                    <Form.Label>{f}</Form.Label>
                    <Select
                      options={asDriverOptions(drivers)}
                      value={form[f]}
                      onChange={(sel) => onSel(sel, f)}
                      placeholder={`Seleziona ${f}`}
                      classNamePrefix="react-select"
                      isSearchable
                      isDisabled={pastDeadline}
                      required
                    />
                  </Form.Group>
                ))}

                <h6 className="fw-bold mt-4">Costruttori (Top 3)</h6>
                {["C1", "C2", "C3"].map((f) => (
                  <Form.Group key={f} className="mb-3">
                    <Form.Label>{f}</Form.Label>
                    <Select
                      options={asConstructorOptions(constructors)}
                      value={form[f]}
                      onChange={(sel) => onSel(sel, f)}
                      placeholder={`Seleziona ${f}`}
                      classNamePrefix="react-select"
                      isDisabled={pastDeadline}
                      required
                    />
                  </Form.Group>
                ))}

                <Button
                  variant="danger"
                  type="submit"
                  className="w-100 mt-3"
                  disabled={!allPicked || saving || pastDeadline}
                >
                  {saving
                    ? "Salvataggio…"
                    : isEdit
                    ? "Modifica Formazione Campionato"
                    : "Salva Formazione Campionato"}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* LISTA ------------------------------------------------------ */}
        <Col xs={12} lg={6}>
          <ChampionshipSubmissions refresh={refreshKey} />
        </Col>
      </Row>
    </Container>
  );
}