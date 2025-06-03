// src/FormationApp.jsx – look & feel “light paddock” with logos in dropdown
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
  serverTimestamp,
  increment,
  Timestamp,
} from "firebase/firestore";
import Select from "react-select";
import { db } from "./firebase";
import SubmissionsList from "./SubmissionsList";
import "./customSelect.css";

/* --- piloti --------------------------------------------------------- */
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

/* --- mapping driver → scuderia ------------------------------------- */
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

/* --- mapping scuderia → percorso logo in /public ------------------- */
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

/* =================================================================== */
export default function FormationApp() {
  /* ----- stato ----------------------------------------------------- */
  const [ranking, setRanking] = useState([]); // [{id,name,jolly}]
  const [races, setRaces] = useState([]); // [{id,name,...}]
  const [race, setRace] = useState(null);

  const [busy, setBusy] = useState(true);
  const [permErr, setPermErr] = useState(false);
  const [flash, setFlash] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  /* ---- preparazione opzioni per react-select (driver + logo) ------ */
  const selectOptions = drivers.map((d) => {
    const team = driverTeam[d];
    const logo = teamLogos[team];
    return {
      value: d,
      label: (
        <div className="select-option">
          <img className="option-logo" src={logo} alt={team} />
          <span className="option-text">{d}</span>
        </div>
      ),
    };
  });

  /* ---- fetch ranking + gare -------------------------------------- */
  useEffect(() => {
    (async () => {
      try {
        // ranking live
        const unsub = onSnapshot(
          query(collection(db, "ranking"), orderBy("puntiTotali", "desc")),
          (snap) => {
            const list = snap.docs.map((d) => ({
              id: d.id,
              name: d.data().name,
              jolly: d.data().jolly ?? 0,
            }));
            setRanking(list);
            if (form.userId) {
              const me = list.find((u) => u.id === form.userId);
              setUserJolly(me?.jolly ?? 0);
            }
          }
        );

        // future races
        const now = Timestamp.now();
        const rsnap = await getDocs(
          query(
            collection(db, "races"),
            where("raceUTC", ">", now),
            orderBy("raceUTC", "asc")
          )
        );
        const list = rsnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRaces(list);
        if (list.length) {
          setRace(list[0]);
          setForm((f) => ({ ...f, raceId: list[0].id }));
        }
        return () => unsub();
      } catch (e) {
        console.error(e);
        if (e.code === "permission-denied") setPermErr(true);
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- onChange per campi testuali (utente, gara) ----------------- */
  const onChangeSimple = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));

    if (name === "userId") {
      const me = ranking.find((u) => u.id === value);
      setUserJolly(me?.jolly ?? 0);
      // reset edit mode when user changes
      setIsEditMode(false);
    }
    if (name === "raceId") {
      const r = races.find((r) => r.id === value);
      setRace(r ?? null);
      // reset all picks when race changes
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
    }
  };

  /* ---- onChange per react-select (driver) ------------------------ */
  const onSelectChange = (selected, field) => {
    setForm((f) => ({ ...f, [field]: selected }));
  };

  /* ---- validazione ------------------------------------------------ */
  const now = Date.now();
  const qualiMs = race?.qualiUTC.seconds * 1000;
  const sprMs = race?.qualiSprintUTC?.seconds * 1000;
  const mainOpen = race && now < qualiMs;
  const sprOpen = race?.qualiSprintUTC && now < sprMs;

  const fullMain =
    form.P1 && form.P2 && form.P3 && form.jolly;
  const fullSpr =
    form.sprintP1 && form.sprintP2 && form.sprintP3 && form.sprintJolly;

  const canSave = (mainOpen && fullMain) || (sprOpen && fullSpr);
  const disabled = !form.userId || !form.raceId || !canSave;

  /* ---- recupero submission esistente per prefill e modalità modifica */
  useEffect(() => {
    const { userId, raceId } = form;
    if (!userId || !raceId) {
      setIsEditMode(false);
      return;
    }

    (async () => {
      try {
        const subRef = doc(db, "races", raceId, "submissions", userId);
        const subSnap = await getDoc(subRef);
        if (subSnap.exists()) {
          const data = subSnap.data();
          // carica valori esistenti nelle select
          const mapOption = (val) =>
            selectOptions.find((opt) => opt.value === val) || null;

          setForm((f) => ({
            ...f,
            P1: mapOption(data.mainP1),
            P2: mapOption(data.mainP2),
            P3: mapOption(data.mainP3),
            jolly: mapOption(data.mainJolly),
            jolly2: mapOption(data.mainJolly2),
            sprintP1: data.sprintP1 ? mapOption(data.sprintP1) : null,
            sprintP2: data.sprintP2 ? mapOption(data.sprintP2) : null,
            sprintP3: data.sprintP3 ? mapOption(data.sprintP3) : null,
            sprintJolly: data.sprintJolly
              ? mapOption(data.sprintJolly)
              : null,
          }));
          setIsEditMode(true);
        } else {
          setIsEditMode(false);
        }
      } catch (err) {
        console.error("Errore recupero submission esistente:", err);
      }
    })();
  }, [form.userId, form.raceId]); 

  /* ---- submit ----------------------------------------------------- */
  const save = async (e) => {
    e.preventDefault();
    setFlash(null);
    if (!race) return;

    const errs = [];
    if (!form.userId) errs.push("Scegli l’utente.");
    if (!form.raceId) errs.push("Scegli la gara.");
    if (!mainOpen && !sprOpen) errs.push("Scadute entrambe le deadline.");
    if (mainOpen && !fullMain) errs.push("Completa la formazione principale.");
    if (sprOpen && !fullSpr && race.qualiSprintUTC)
      errs.push("Completa la Sprint.");
    if (errs.length) {
      setFlash({ type: "danger", msg: errs.join(" ") });
      return;
    }

    const me = ranking.find((u) => u.id === form.userId);
    const payload = {
      userId: form.userId,
      user: me?.name || "",
      submittedAt: serverTimestamp(),
      status: "ok",
      mainP1: form.P1.value,
      mainP2: form.P2.value,
      mainP3: form.P3.value,
      mainJolly: form.jolly.value,
    };
    if (form.jolly2) payload.mainJolly2 = form.jolly2.value;
    if (sprOpen) {
      payload.sprintP1 = form.sprintP1.value;
      payload.sprintP2 = form.sprintP2.value;
      payload.sprintP3 = form.sprintP3.value;
      payload.sprintJolly = form.sprintJolly.value;
    }

    try {
      await setDoc(
        doc(db, "races", form.raceId, "submissions", form.userId),
        payload,
        { merge: true }
      );
      if (form.jolly2) {
        await updateDoc(doc(db, "ranking", form.userId), {
          jolly: increment(-1),
        });
        setUserJolly((p) => p - 1);
      }
      setFlash({ type: "success", msg: isEditMode ? "Formazione modificata!" : "Formazione inviata!" });
      setRefreshKey(Date.now());
    } catch (err) {
      console.error(err);
      setFlash({ type: "danger", msg: "Errore nel salvataggio" });
    }
  };

  /* ---- UI states -------------------------------------------------- */
  if (busy)
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  if (permErr)
    return (
      <Container className="py-5">
        <Alert variant="danger">Permessi insufficienti.</Alert>
      </Container>
    );

  /* ---- helpers ---------------------------------------------------- */
  const DeadlineBadgeLocal = ({ open }) => (
    <Badge bg={open ? "success" : "danger"}>{open ? "APERTO" : "CHIUSO"}</Badge>
  );

  /* ---- render ----------------------------------------------------- */
  return (
    <Container className="py-5">
      <Row className="justify-content-center g-4 align-items-start">
        {/* FORM */}
        <Col xs={12} lg={6}>
          <Card className="shadow h-100 border-danger">
            <Card.Body>
              <Card.Title className="text-center mb-3">
                🏎️ Schiera la Formazione
              </Card.Title>

              {flash && (
                <Alert variant={flash.type} dismissible onClose={() => setFlash(null)}>
                  {flash.msg}
                </Alert>
              )}

              <Form onSubmit={save}>
                {/* utente */}
                <Form.Group className="mb-3">
                  <Form.Label>Utente</Form.Label>
                  <Form.Select
                    name="userId"
                    value={form.userId}
                    onChange={onChangeSimple}
                    required
                  >
                    <option value="">Seleziona utente</option>
                    {ranking.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Form.Select>
                  {form.userId && <Form.Text>Jolly disponibili: {userJolly}</Form.Text>}
                </Form.Group>

                {/* gara */}
                <Form.Group className="mb-3">
                  <Form.Label>Gara</Form.Label>
                  <Form.Select
                    name="raceId"
                    value={form.raceId}
                    onChange={onChangeSimple}
                    required
                  >
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
                    <h5 className="mt-3">
                      Gara Principale&nbsp;
                      <DeadlineBadgeLocal open={mainOpen} />
                      <br />
                      <small>
                        Da schierare entro:{" "}
                        {new Date(qualiMs).toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "long",
                        })}{" "}
                        –{" "}
                        {new Date(qualiMs).toLocaleTimeString("it-IT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </h5>

                    {["P1", "P2", "P3"].map((l) => (
                      <Form.Group key={l} className="mb-2">
                        <Form.Label>{l}</Form.Label>
                        <Select
                          isDisabled={!mainOpen}
                          options={selectOptions}
                          value={form[l]}
                          onChange={(sel) => onSelectChange(sel, l)}
                          placeholder={`Seleziona ${l}`}
                          classNamePrefix="react-select"
                          required
                        />
                      </Form.Group>
                    ))}

                    <Form.Group className="mb-2">
                      <Form.Label>Jolly</Form.Label>
                      <Select
                        isDisabled={!mainOpen}
                        options={selectOptions}
                        value={form.jolly}
                        onChange={(sel) => onSelectChange(sel, "jolly")}
                        placeholder="Seleziona Jolly"
                        classNamePrefix="react-select"
                        required
                      />
                    </Form.Group>

                    {userJolly > 0 && (
                      <Form.Group className="mb-2">
                        <Form.Label>
                          Jolly 2 <small>(opz.)</small>
                        </Form.Label>
                        <Select
                          isDisabled={!mainOpen}
                          options={selectOptions}
                          value={form.jolly2}
                          onChange={(sel) => onSelectChange(sel, "jolly2")}
                          placeholder="Seleziona Jolly 2 (opz.)"
                          classNamePrefix="react-select"
                        />
                      </Form.Group>
                    )}
                  </>
                )}

                {/* SPRINT */}
                {race?.qualiSprintUTC && (
                  <>
                    <h5 className="mt-4">
                      Sprint&nbsp;
                      <DeadlineBadgeLocal open={sprOpen} />
                      <br />
                      <small>
                        Da schierare entro:{" "}
                        {new Date(sprMs).toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "long",
                        })}{" "}
                        –{" "}
                        {new Date(sprMs).toLocaleTimeString("it-IT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </h5>
                    {["sprintP1", "sprintP2", "sprintP3", "sprintJolly"].map((l) => (
                      <Form.Group key={l} className="mb-2">
                        <Form.Label>{l.replace("sprint", "SP")}</Form.Label>
                        <Select
                          isDisabled={!sprOpen}
                          options={selectOptions}
                          value={form[l]}
                          onChange={(sel) => onSelectChange(sel, l)}
                          placeholder={`Seleziona ${l.replace("sprint", "SP")}`}
                          classNamePrefix="react-select"
                          required
                        />
                      </Form.Group>
                    ))}
                  </>
                )}

                <Button
                  variant="danger"
                  type="submit"
                  className="w-100 mt-3"
                  disabled={disabled}
                >
                  {isEditMode ? "Modifica Formazione" : "Invia Formazione"}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* LISTA */}
        <Col xs={12} lg={6}>
          <SubmissionsList
            raceId={race?.id}
            hasSprint={!!race?.qualiSprintUTC}
            refresh={refreshKey}
          />
        </Col>
      </Row>
    </Container>
  );
}