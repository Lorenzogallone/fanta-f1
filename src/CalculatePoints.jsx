// src/CalculatePoints.jsx
import React, { useEffect, useState } from "react";
import {
  Card,
  Form,
  Button,
  Alert,
  Spinner,
  Container,
  Row,
  Col,
  Badge,
  Tab,
  Nav,
} from "react-bootstrap";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { isLastRace, calculatePointsForRace } from "./pointsCalculator";
import { calculateChampionshipPoints } from "./championshipPointsCalculator";
import Select from "react-select";
import "./customSelect.css";

/* — liste piloti e costruttori — */
const drivers = [
  "Max Verstappen",
  "Yuki Tsunoda",
  "Charles Leclerc",
  "Lewis Hamilton",
  "George Russell",
  "Andrea Kimi Antonelli",
  "Lando Norris",
  "Oscar Piastri",
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

const driverTeam = {
  "Max Verstappen": "Red Bull",
  "Yuki Tsunoda": "Red Bull",
  "Charles Leclerc": "Ferrari",
  "Lewis Hamilton": "Ferrari",
  "George Russell": "Mercedes",
  "Andrea Kimi Antonelli": "Mercedes",
  "Lando Norris": "McLaren",
  "Oscar Piastri": "McLaren",
  "Fernando Alonso": "Aston Martin",
  "Lance Stroll": "Aston Martin",
  "Pierre Gasly": "Alpine",
  "Franco Colapinto": "Alpine",
  "Oliver Bearman": "Haas",
  "Esteban Ocon": "Haas",
  "Nico Hülkenberg": "Sauber",
  "Gabriel Bortoleto": "Sauber",
  "Liam Lawson": "Vcarb",
  "Isack Hadjar": "Vcarb",
  "Alexander Albon": "Williams",
  "Carlos Sainz Jr.": "Williams",
};

const teamLogos = {
  Ferrari: "/ferrari.png",
  Mercedes: "/mercedes.png",
  "Red Bull": "/redbull.png",
  McLaren: "/mclaren.png",
  "Aston Martin": "/aston.png",
  Alpine: "/alpine.png",
  Haas: "/haas.png",
  Williams: "/williams.png",
  Sauber: "/sauber.png",
  Vcarb: "/vcarb.png",
};

const DeadlineBadge = ({ open }) => (
  <Badge bg={open ? "success" : "danger"}>
    {open ? " PRONTA " : " BLOCCATA "}
  </Badge>
);

const DoubleBadge = () => (
  <Badge bg="warning" text="dark">
    🌟 Punti doppi! 🌟
  </Badge>
);

/* helper per opzioni con logo */
const asDriverOpt = (d) => ({
  value: d,
  label: (
    <div className="select-option">
      <img
        className="option-logo"
        src={teamLogos[driverTeam[d]]}
        alt={driverTeam[d]}
      />
      <span className="option-text">{d}</span>
    </div>
  ),
});
const asConstructorOpt = (c) => ({
  value: c,
  label: (
    <div className="select-option">
      <img className="option-logo" src={teamLogos[c]} alt={c} />
      <span className="option-text">{c}</span>
    </div>
  ),
});

const driverOptions = drivers.map(asDriverOpt);
const constructorOptions = constructors.map(asConstructorOpt);

export default function CalculatePoints() {
  const [activeTab, setActiveTab] = useState("race");

  /* ========== TAB GARA ========== */
  const [races, setRaces] = useState([]);
  const [race, setRace] = useState(null);
  const [loadingRace, setLoadingRace] = useState(true);
  const [savingRace, setSavingRace] = useState(false);
  const [msgRace, setMsgRace] = useState(null);

  const [formRace, setFormRace] = useState({
    P1: null,
    P2: null,
    P3: null,
    SP1: null,
    SP2: null,
    SP3: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "races"), orderBy("raceUTC", "asc"))
        );
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRaces(list);
        if (list.length) setRace(list[0]);
      } catch (e) {
        setMsgRace({ variant: "danger", msg: "Errore caricamento gare. ", e });
      } finally {
        setLoadingRace(false);
      }
    })();
  }, []);

  const nowMS = Date.now();
  const allowedRace =
    race && nowMS > race.raceUTC.seconds * 1000 + 90 * 60 * 1000;
  const mainFilled =
    formRace.P1 && formRace.P2 && formRace.P3;
  const sprintNeeded = Boolean(race?.qualiSprintUTC);
  const sprintFilled =
    !sprintNeeded ||
    (formRace.SP1 && formRace.SP2 && formRace.SP3);
  const isLast = isLastRace(races, race?.id);
  const canSubmitRace =
    allowedRace && mainFilled && sprintFilled && !savingRace;

  const onSelRace = (sel, f) =>
    setFormRace((s) => ({ ...s, [f]: sel }));

  const saveRace = async (e) => {
    e.preventDefault();
    if (!canSubmitRace) return;
    setSavingRace(true);
    setMsgRace(null);

    try {
      await setDoc(
        doc(db, "races", race.id),
        {
          officialResults: {
            P1: formRace.P1.value,
            P2: formRace.P2.value,
            P3: formRace.P3.value,
            SP1: formRace.SP1?.value || null,
            SP2: formRace.SP2?.value || null,
            SP3: formRace.SP3?.value || null,
            doublePoints: isLast,
            savedAt: Timestamp.now(),
          },
        },
        { merge: true }
      );

      setMsgRace({
        variant: "info",
        msg: "Risultati salvati. Calcolo in corso…",
      });
      const res = await calculatePointsForRace(race.id);
      setMsgRace({ variant: "success", msg: res });
      setFormRace({
        P1: null,
        P2: null,
        P3: null,
        SP1: null,
        SP2: null,
        SP3: null,
      });
    } catch (err) {
      console.error(err);
      setMsgRace({
        variant: "danger",
        msg: "Errore nel salvataggio o calcolo.",
      });
    } finally {
      setSavingRace(false);
    }
  };

  /* ========== TAB CAMPIONATO ========== */
  const [formChamp, setFormChamp] = useState({
    CP1: null,
    CP2: null,
    CP3: null,
    CC1: null,
    CC2: null,
    CC3: null,
  });
  const [savingChamp, setSavingChamp] = useState(false);
  const [msgChamp, setMsgChamp] = useState(null);

  const onSelChamp = (sel, f) =>
    setFormChamp((s) => ({ ...s, [f]: sel }));

  // Determina il timestamp dell’ultima gara
  const lastRaceUTCms = races.length
    ? Math.max(...races.map((r) => r.raceUTC.seconds * 1000))
    : 0;
  const championshipOpen = nowMS > lastRaceUTCms;

  const champReady =
    formChamp.CP1 &&
    formChamp.CP2 &&
    formChamp.CP3 &&
    formChamp.CC1 &&
    formChamp.CC2 &&
    formChamp.CC3 &&
    !savingChamp &&
    championshipOpen;

  const saveChamp = async (e) => {
    e.preventDefault();
    if (!champReady) return;
    setSavingChamp(true);
    setMsgChamp(null);

    try {
      await setDoc(
        doc(db, "championship", "results"),
        {
          P1: formChamp.CP1.value,
          P2: formChamp.CP2.value,
          P3: formChamp.CP3.value,
          C1: formChamp.CC1.value,
          C2: formChamp.CC2.value,
          C3: formChamp.CC3.value,
          savedAt: Timestamp.now(),
        },
        { merge: true }
      );

      setMsgChamp({
        variant: "info",
        msg: "Risultati campionato salvati. Calcolo in corso…",
      });
      const res = await calculateChampionshipPoints(
        [formChamp.CP1.value, formChamp.CP2.value, formChamp.CP3.value],
        [formChamp.CC1.value, formChamp.CC2.value, formChamp.CC3.value]
      );
      setMsgChamp({ variant: "success", msg: res });
    } catch (err) {
      console.error(err);
      setMsgChamp({
        variant: "danger",
        msg: "Errore nel salvataggio o calcolo.",
      });
    } finally {
      setSavingChamp(false);
    }
  };

  if (loadingRace) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <Tab.Container
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
      >
        <Nav variant="tabs" className="justify-content-center mb-4">
          <Nav.Item>
            <Nav.Link eventKey="race">Calcolo Gara</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="champ">Calcolo Campionato</Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          {/* ======== TAB GARA ======== */}
          <Tab.Pane eventKey="race">
            <Row className="justify-content-center">
              <Col xs={12} lg={8}>
                <Card className="shadow">
                  <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">
                      Calcola Punti Gara&nbsp;
                      <DeadlineBadge open={allowedRace} />
                    </h5>
                    {isLast && <DoubleBadge />}
                  </Card.Header>
                  <Card.Body>
                    {msgRace && (
                      <Alert
                        variant={msgRace.variant}
                        onClose={() => setMsgRace(null)}
                        dismissible
                      >
                        {msgRace.msg}
                      </Alert>
                    )}

                    <Form.Group className="mb-4">
                      <Form.Label>Seleziona gara</Form.Label>
                      <Form.Select
                        value={race?.id || ""}
                        onChange={(e) => {
                          const r = races.find(
                            (x) => x.id === e.target.value
                          );
                          setRace(r);
                          setFormRace({
                            P1: null,
                            P2: null,
                            P3: null,
                            SP1: null,
                            SP2: null,
                            SP3: null,
                          });
                        }}
                      >
                        {races.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.round}. {r.name} –{" "}
                            {new Date(
                              r.raceUTC.seconds * 1000
                            ).toLocaleDateString()}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Text muted>
                        Il calcolo è disponibile 90 min dopo lo start ufficiale.
                      </Form.Text>
                    </Form.Group>

                    <h6 className="fw-bold mb-3">
                      Risultato Gara Principale
                    </h6>
                    {["P1", "P2", "P3"].map((slot) => (
                      <Form.Group key={slot} className="mb-3">
                        <Form.Label>{slot}</Form.Label>
                        <Select
                          isDisabled={!allowedRace}
                          options={driverOptions}
                          value={formRace[slot]}
                          onChange={(sel) =>
                            onSelRace(sel, slot)
                          }
                          placeholder={`Seleziona ${slot}`}
                          classNamePrefix="react-select"
                        />
                      </Form.Group>
                    ))}

                    {race?.qualiSprintUTC && (
                      <>
                        <h6 className="fw-bold mt-4 mb-3">
                          Risultato Sprint
                        </h6>
                        {["SP1", "SP2", "SP3"].map((slot) => (
                          <Form.Group key={slot} className="mb-3">
                            <Form.Label>{slot}</Form.Label>
                            <Select
                              isDisabled={!allowedRace}
                              options={driverOptions}
                              value={formRace[slot]}
                              onChange={(sel) =>
                                onSelRace(sel, slot)
                              }
                              placeholder={`Seleziona ${slot}`}
                              classNamePrefix="react-select"
                            />
                          </Form.Group>
                        ))}
                      </>
                    )}

                    <Button
                      variant="danger"
                      className="w-100 mt-3"
                      onClick={saveRace}
                      disabled={!canSubmitRace}
                    >
                      {savingRace
                        ? "Salvataggio…"
                        : "Calcola Punteggi"}
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Tab.Pane>

          {/* ======== TAB CAMPIONATO ======== */}
          <Tab.Pane eventKey="champ">
            <Row className="justify-content-center">
              <Col xs={12} lg={8}>
                <Card className="shadow border-danger">
                  <Card.Header className="bg-white">
                    <h5 className="mb-0 text-center">
                      Calcola Punti Campionato
                    </h5>
                  </Card.Header>
                  <Card.Body>
                    {!championshipOpen && (
                      <Alert variant="warning" className="text-center">
                        ⚠️ Il calcolo campionato sarà disponibile solo al termine di tutte le gare.
                      </Alert>
                    )}
                    {msgChamp && (
                      <Alert
                        variant={msgChamp.variant}
                        onClose={() => setMsgChamp(null)}
                        dismissible
                      >
                        {msgChamp.msg}
                      </Alert>
                    )}

                    <Form onSubmit={saveChamp}>
                      <h6 className="fw-bold">Classifica Piloti Finale</h6>
                      {["CP1", "CP2", "CP3"].map((f) => (
                        <Form.Group key={f} className="mb-3">
                          <Form.Label>{f.replace("CP", "P")}</Form.Label>
                          <Select
                            options={driverOptions}
                            value={formChamp[f]}
                            onChange={(sel) =>
                              onSelChamp(sel, f)
                            }
                            placeholder={`Seleziona ${f.replace(
                              "CP",
                              "P"
                            )}`}
                            classNamePrefix="react-select"
                            isSearchable
                            isDisabled={!championshipOpen}
                          />
                        </Form.Group>
                      ))}

                      <h6 className="fw-bold mt-4">
                        Classifica Costruttori Finale
                      </h6>
                      {["CC1", "CC2", "CC3"].map((f) => (
                        <Form.Group key={f} className="mb-3">
                          <Form.Label>{f.replace("CC", "C")}</Form.Label>
                          <Select
                            options={constructorOptions}
                            value={formChamp[f]}
                            onChange={(sel) =>
                              onSelChamp(sel, f)
                            }
                            placeholder={`Seleziona ${f.replace(
                              "CC",
                              "C"
                            )}`}
                            classNamePrefix="react-select"
                            isSearchable
                            isDisabled={!championshipOpen}
                          />
                        </Form.Group>
                      ))}

                      <Button
                        variant="danger"
                        type="submit"
                        className="w-100 mt-3"
                        disabled={!champReady}
                      >
                        {savingChamp
                          ? "Salvataggio…"
                          : "Calcola Punti Campionato"}
                      </Button>
                    </Form>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </Container>
  );
}