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
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import ChampionshipSubmissions from "./ChampionshipSubmissions";
import "./customSelect.css";

/* ---------- dati base -------------------------------------------- */
const drivers = [
  "Lando Norris",
  "Oscar Piastri",
  "Max Verstappen",
  "Charles Leclerc",
  "Lewis Hamilton",
  "George Russell",
  "Andrea Kimi Antonelli",
  "Yuki Tsunoda",
  "Fernando Alonso",
  "Lance Stroll",
  "Pierre Gasly",
  "Franco Colapinto",
  "Oliver Bearman",
  "Esteban Ocon",
  "Nico Hülkenberg",
  "Gabriel Bortoleto",
  "Liam Lawson",
  "Isack Hadjar",
  "Alexander Albon",
  "Carlos Sainz Jr.",
];

const constructors = [
  "Red Bull",
  "Ferrari",
  "Mercedes",
  "McLaren",
  "Aston Martin",
  "Alpine",
  "Haas",
  "Sauber",
  "Vcarb",
  "Williams",
];

/* mapping driver → scuderia ------------------------------------- */
const driverTeam = {
  "Max Verstappen":        "Red Bull",
  "Yuki Tsunoda":          "Red Bull",
  "Charles Leclerc":       "Ferrari",
  "Lewis Hamilton":        "Ferrari",
  "George Russell":        "Mercedes",
  "Andrea Kimi Antonelli": "Mercedes",
  "Lando Norris":          "McLaren",
  "Oscar Piastri":         "McLaren",
  "Fernando Alonso":       "Aston Martin",
  "Lance Stroll":          "Aston Martin",
  "Pierre Gasly":          "Alpine",
  "Franco Colapinto":      "Alpine",
  "Oliver Bearman":        "Haas",
  "Esteban Ocon":          "Haas",
  "Nico Hülkenberg":       "Sauber",
  "Gabriel Bortoleto":     "Sauber",
  "Liam Lawson":           "Vcarb",
  "Isack Hadjar":          "Vcarb",
  "Alexander Albon":       "Williams",
  "Carlos Sainz Jr.":      "Williams",
};

/* mapping scuderia → logo path in /public ------------------- */
const teamLogos = {
  Ferrari:        "/ferrari.png",
  Mercedes:       "/mercedes.png",
  "Red Bull":     "/redbull.png",
  McLaren:        "/mclaren.png",
  "Aston Martin": "/aston.png",
  Alpine:         "/alpine.png",
  Haas:           "/haas.png",
  Sauber:         "/sauber.png",
  Vcarb:          "/vcarb.png",
  Williams:       "/williams.png",
};

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

  /* usato per far “ricaricare” ChampionshipSubmissions */
  const [refreshKey, setRefreshKey] = useState(0);

  /* deadline: 7 settembre 2025, 23:59 */
  const deadlineMs = new Date("2025-09-07T23:59:00").getTime();
  const pastDeadline = Date.now() > deadlineMs;

  /* ------------- carica lista utenti da “ranking” ---------------- */
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

  /* ------------- se cambia userId, precompila con valori esistenti -- */
  useEffect(() => {
    const { userId } = form;
    if (!userId) return;

    (async () => {
      try {
        const userDoc = await getDoc(doc(db, "ranking", userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const { championshipPiloti, championshipCostruttori } = data;

          // Trova oggetti select corrispondenti
          const driverOpts = asDriverOptions(drivers);
          const constructorOpts = asConstructorOptions(constructors);

          setForm((f) => ({
            ...f,
            D1: championshipPiloti?.[0]
              ? driverOpts.find((o) => o.value === championshipPiloti[0])
              : null,
            D2: championshipPiloti?.[1]
              ? driverOpts.find((o) => o.value === championshipPiloti[1])
              : null,
            D3: championshipPiloti?.[2]
              ? driverOpts.find((o) => o.value === championshipPiloti[2])
              : null,
            C1: championshipCostruttori?.[0]
              ? constructorOpts.find((o) => o.value === championshipCostruttori[0])
              : null,
            C2: championshipCostruttori?.[1]
              ? constructorOpts.find((o) => o.value === championshipCostruttori[1])
              : null,
            C3: championshipCostruttori?.[2]
              ? constructorOpts.find((o) => o.value === championshipCostruttori[2])
              : null,
          }));
        }
      } catch (err) {
        console.error("Errore recupero formazione esistente:", err);
      }
    })();
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
        text: "Formazioni campionato salvate!",
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

  if (loadingRanking)
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );

  return (
    <Container className="py-5">
      <Row className="justify-content-center g-4 align-items-start">
        {/* FORMULÁRIO */}
        <Col xs={12} lg={6}>
          <Card className="shadow border-danger">
            <Card.Body>
              <h4 className="text-center mb-4">
                📋 Formazione Campionato&nbsp;
                <Badge bg="warning" text="dark">
                  Deadline 07/09 ore 23:59
                </Badge>
              </h4>

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
                  {saving ? "Salvataggio…" : "Salva Formazione Campionato"}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* LISTA */}
        <Col xs={12} lg={6}>
          <ChampionshipSubmissions refresh={refreshKey} />
        </Col>
      </Row>
    </Container>
  );
}