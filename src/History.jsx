/* -----------------------------------------------------------------------
   src/History.jsx
   -----------------------------------------------------------------------
   • Mostra tutte le gare concluse con risultati, formazioni e punteggi
   • Tema bianco e rosso
   • Badge “punti singoli” in verde (se > 0) o rosso (se = 0)
   • Totali (Main/Sprint) in semplice testo colorato, senza sfondo nero
   • Aggiunti loghi delle scuderie nella classifica ufficiale
---------------------------------------------------------------------------*/
import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Spinner,
  Badge,
  Alert,
} from "react-bootstrap";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

/* — mapping pilota → scuderia — */
const driverTeam = {
  "Lando Norris":             "McLaren",
  "Oscar Piastri":            "McLaren",
  "Charles Leclerc":          "Ferrari",
  "Lewis Hamilton":           "Ferrari",
  "Max Verstappen":           "Red Bull",
  "George Russell":           "Mercedes",
  "Andrea Kimi Antonelli":    "Mercedes",
  "Fernando Alonso":          "Aston Martin",
  "Lance Stroll":             "Aston Martin",
  "Pierre Gasly":             "Alpine",
  "Franco Colapinto":         "Alpine",
  "Oliver Bearman":           "Haas",
  "Esteban Ocon":             "Haas",
  "Nico Hülkenberg":          "Sauber",
  "Gabriel Bortoleto":        "Sauber",
  "Liam Lawson":              "Vcarb",
  "Isack Hadjar":             "Vcarb",
  "Alexander Albon":          "Williams",
  "Carlos Sainz Jr.":         "Williams",
};

/* — mapping scuderia → percorso logo in /public — */
const teamLogos = {
  Ferrari:        "/ferrari.png",
  Mercedes:       "/mercedes.png",
  "Red Bull":     "/redbull.png",
  McLaren:        "/mclaren.png",
  "Aston Martin": "/aston.png",
  Alpine:         "/alpine.png",
  Haas:           "/haas.png",
  Williams:       "/williams.png",
  Sauber:         "/sauber.png",
  Vcarb:          "/vcarb.png",
};

/**
 * Visualizza nome del pilota con logo della scuderia, se disponibile.
 */
function DriverWithLogo({ name }) {
  if (!name) return <>—</>;
  const team = driverTeam[name];
  const logoSrc = team ? teamLogos[team] : null;
  return (
    <span className="d-flex align-items-center">
      {logoSrc && (
        <img
          src={logoSrc}
          alt={team}
          style={{
            height: 20,
            width: 20,
            objectFit: "contain",
            marginRight: 6,
          }}
        />
      )}
      {name}
    </span>
  );
}

/* ============================== HISTORY ============================== */
export default function History() {
  const [pastRaces, setPastRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const now = Timestamp.now();
        const snap = await getDocs(
          query(
            collection(db, "races"),
            where("raceUTC", "<", now),
            orderBy("raceUTC", "desc")
          )
        );
        setPastRaces(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
        setError("Impossibile caricare le gare passate.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  if (error)
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  if (!pastRaces.length)
    return (
      <Container className="py-5">
        <Alert variant="info">Nessuna gara passata trovata.</Alert>
      </Container>
    );

  return (
    <Container className="py-5">
      <Row className="g-4">
        {pastRaces.map((r) => (
          <Col key={r.id} xs={12}>
            <RaceCard race={r} />
          </Col>
        ))}
      </Row>
    </Container>
  );
}

/* ============================ RACE CARD ============================= */
function RaceCard({ race }) {
  const [subs, setSubs] = useState([]);
  const [loadingSub, setLoadingSub] = useState(true);
  const [errorSub, setErrorSub] = useState(null);
  const [rankingMap, setRankingMap] = useState({}); // userId → nome

  // 1) Carica mappa userId → nome da “ranking”
  useEffect(() => {
    (async () => {
      try {
        const snapRank = await getDocs(collection(db, "ranking"));
        const map = {};
        snapRank.docs.forEach((d) => {
          map[d.id] = d.data().name;
        });
        setRankingMap(map);
      } catch (e) {
        console.error("Errore caricamento ranking:", e);
      }
    })();
  }, []);

  // 2) Carica le submissions per questa gara
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          collection(db, "races", race.id, "submissions")
        );
        let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Ordiniamo alfabeticamente per “nome utente”
        list.sort((a, b) => {
          const aName = a.user || rankingMap[a.id] || a.id;
          const bName = b.user || rankingMap[b.id] || b.id;
          return aName.localeCompare(bName, "it");
        });
        setSubs(list);
      } catch (e) {
        console.error(e);
        setErrorSub("Impossibile caricare le formazioni.");
      } finally {
        setLoadingSub(false);
      }
    })();
  }, [race.id, rankingMap]);

  const official = race.officialResults ?? null;
  const hasSprint = Boolean(official?.SP1);
  const doublePts = Boolean(official?.doublePoints);

  const DoubleBadge = () =>
    doublePts ? (
      <Badge bg="danger" text="white" className="ms-2">
        🌟 Punti Doppi
      </Badge>
    ) : null;

  return (
    <Card className="shadow border-0">
      <Card.Header className="bg-white border-bottom border-danger">
        <h5 className="mb-0 text-danger">
          {race.round}. {race.name} —{" "}
          {new Date(race.raceUTC.seconds * 1000).toLocaleDateString(
            "it-IT"
          )}
          {doublePts && <DoubleBadge />}
        </h5>
      </Card.Header>

      <Card.Body>
        {/* ======= RISULTATI UFFICIALI ======= */}
        {official ? (
          <>
            <h6 className="fw-bold text-danger border-bottom pb-1">
              Gara principale
            </h6>
            <Table size="sm" className="mb-3">
              <thead className="table-white border-top border-danger">
                <tr>
                  <th style={{ width: "20%" }} className="text-danger">
                    Pos.
                  </th>
                  <th className="text-danger">Pilota</th>
                  <th
                    style={{ width: "20%" }}
                    className="text-end text-danger"
                  >
                    Pts
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>1°</strong>
                  </td>
                  <td>
                    <DriverWithLogo name={official.P1} />
                  </td>
                  <td className="text-end text-success">12</td>
                </tr>
                <tr>
                  <td>2°</td>
                  <td>
                    <DriverWithLogo name={official.P2} />
                  </td>
                  <td className="text-end text-success">10</td>
                </tr>
                <tr>
                  <td>3°</td>
                  <td>
                    <DriverWithLogo name={official.P3} />
                  </td>
                  <td className="text-end text-success">8</td>
                </tr>
              </tbody>
            </Table>

            {hasSprint && (
              <>
                <h6 className="fw-bold text-danger border-bottom pb-1 mt-4">
                  Sprint
                </h6>
                <Table size="sm" className="mb-4">
                  <thead className="table-white border-top border-danger">
                    <tr>
                      <th style={{ width: "20%" }} className="text-danger">
                        Pos.
                      </th>
                      <th className="text-danger">Pilota</th>
                      <th
                        style={{ width: "20%" }}
                        className="text-end text-danger"
                      >
                        Pts
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>SP1°</strong>
                      </td>
                      <td>
                        <DriverWithLogo name={official.SP1} />
                      </td>
                      <td className="text-end text-success">8</td>
                    </tr>
                    <tr>
                      <td>SP2°</td>
                      <td>
                        <DriverWithLogo name={official.SP2} />
                      </td>
                      <td className="text-end text-success">6</td>
                    </tr>
                    <tr>
                      <td>SP3°</td>
                      <td>
                        <DriverWithLogo name={official.SP3} />
                      </td>
                      <td className="text-end text-success">4</td>
                    </tr>
                  </tbody>
                </Table>
              </>
            )}
          </>
        ) : (
          <Alert variant="warning">
            Risultati ufficiali non ancora disponibili.
          </Alert>
        )}

        {/* ======= FORMAZIONI & PUNTEGGI ======= */}
        {loadingSub ? (
          <div className="text-center py-3">
            <Spinner animation="border" />
          </div>
        ) : errorSub ? (
          <Alert variant="danger">{errorSub}</Alert>
        ) : subs.length === 0 ? (
          <Alert variant="info">Nessuna formazione inviata.</Alert>
        ) : (
          <>
            <h6 className="fw-bold mb-2 text-danger">
              Formazioni e Punteggi
            </h6>
            <div className="table-responsive">
              <Table
                striped
                bordered
                hover
                size="sm"
                className="align-middle"
              >
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 40 }} className="text-danger">
                      #
                    </th>
                    <th className="text-danger">Utente</th>
                    <th className="text-center text-danger">
                      P1 
                      <small className="text-muted"> (Pts)</small>
                    </th>
                    <th className="text-center text-danger">
                      P2
                      <small className="text-muted"> (Pts)</small>
                    </th>
                    <th className="text-center text-danger">
                      P3
                      <small className="text-muted"> (Pts)</small>
                    </th>
                    <th className="text-center text-danger">
                      Jolly
                      <small className="text-muted"> (Pts)</small>
                    </th>
                    {hasSprint && (
                      <>
                        <th className="text-center text-danger">
                          SP1
                          <br />
                          <small className="text-muted">(Pts)</small>
                        </th>
                        <th className="text-center text-danger">
                          SP2
                          <br />
                          <small className="text-muted">(Pts)</small>
                        </th>
                        <th className="text-center text-danger">
                          SP3
                          <br />
                          <small className="text-muted">(Pts)</small>
                        </th>
                        <th className="text-center text-danger">
                          Jolly SP
                          <br />
                          <small className="text-muted">(Pts)</small>
                        </th>
                      </>
                    )}
                    <th className="text-center text-danger">Tot Main</th>
                    {hasSprint && (
                      <th className="text-center text-danger">Tot Sprint</th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {subs.map((s, idx) => {
                    // PUNTI “SINGOLI” GARA PRINCIPALE
                    const p1Pts = s.mainP1 === official?.P1 ? 12 : 0;
                    const p2Pts = s.mainP2 === official?.P2 ? 10 : 0;
                    const p3Pts = s.mainP3 === official?.P3 ? 8 : 0;
                    // Jolly principale vale 5 se è in TOP 3 (P1, P2 o P3)
                    const jmp =
                      s.mainJolly &&
                      [official?.P1, official?.P2, official?.P3].includes(
                        s.mainJolly
                      )
                        ? 5
                        : 0;
                    // Totale main: usa pointsEarned se salvato, altrimenti somma singoli
                    const totalMainPts =
                      s.pointsEarned !== undefined
                        ? s.pointsEarned
                        : official
                        ? p1Pts + p2Pts + p3Pts + jmp
                        : "-";

                    // PUNTI “SINGOLI” SPRINT
                    let sp1Pts = 0,
                      sp2Pts = 0,
                      sp3Pts = 0,
                      jsp = 0,
                      totalSprintPts = null;
                    if (hasSprint) {
                      sp1Pts = s.sprintP1 === official?.SP1 ? 8 : 0;
                      sp2Pts = s.sprintP2 === official?.SP2 ? 6 : 0;
                      sp3Pts = s.sprintP3 === official?.SP3 ? 4 : 0;
                      // Jolly sprint vale 2 se è in TOP 3 Sprint
                      jsp =
                        s.sprintJolly &&
                        [official?.SP1, official?.SP2, official?.SP3].includes(
                          s.sprintJolly
                        )
                          ? 2
                          : 0;
                      totalSprintPts =
                        s.pointsEarnedSprint !== undefined
                          ? s.pointsEarnedSprint
                          : official
                          ? sp1Pts + sp2Pts + sp3Pts + jsp
                          : "-";
                    }

                    // Nome utente
                    const userName = s.user || rankingMap[s.id] || s.id;

                    return (
                      <tr key={s.id}>
                        <td className="text-center">{idx + 1}</td>
                        <td>{userName}</td>

                        {/* MAIN PICKS */}
                        <td className="text-center">
                          {s.mainP1 ? (
                            <>
                              {s.mainP1}{" "}
                              <Badge
                                bg={p1Pts > 0 ? "success" : "danger"}
                                pill
                              >
                                {p1Pts}
                              </Badge>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-center">
                          {s.mainP2 ? (
                            <>
                              {s.mainP2}{" "}
                              <Badge
                                bg={p2Pts > 0 ? "success" : "danger"}
                                pill
                              >
                                {p2Pts}
                              </Badge>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-center">
                          {s.mainP3 ? (
                            <>
                              {s.mainP3}{" "}
                              <Badge
                                bg={p3Pts > 0 ? "success" : "danger"}
                                pill
                              >
                                {p3Pts}
                              </Badge>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-center">
                          {s.mainJolly ? (
                            <>
                              {s.mainJolly}{" "}
                              <Badge
                                bg={jmp > 0 ? "success" : "danger"}
                                pill
                              >
                                {jmp}
                              </Badge>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>

                        {/* SPRINT PICKS */}
                        {hasSprint && (
                          <>
                            <td className="text-center">
                              {s.sprintP1 ? (
                                <>
                                  {s.sprintP1}{" "}
                                  <Badge
                                    bg={sp1Pts > 0 ? "success" : "danger"}
                                    pill
                                  >
                                    {sp1Pts}
                                  </Badge>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="text-center">
                              {s.sprintP2 ? (
                                <>
                                  {s.sprintP2}{" "}
                                  <Badge
                                    bg={sp2Pts > 0 ? "success" : "danger"}
                                    pill
                                  >
                                    {sp2Pts}
                                  </Badge>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="text-center">
                              {s.sprintP3 ? (
                                <>
                                  {s.sprintP3}{" "}
                                  <Badge
                                    bg={sp3Pts > 0 ? "success" : "danger"}
                                    pill
                                  >
                                    {sp3Pts}
                                  </Badge>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="text-center">
                              {s.sprintJolly ? (
                                <>
                                  {s.sprintJolly}{" "}
                                  <Badge
                                    bg={jsp > 0 ? "success" : "danger"}
                                    pill
                                  >
                                    {jsp}
                                  </Badge>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                          </>
                        )}

                        {/* TOTALI MAIN / SPRINT */}
                        <td className="text-center">
                          {typeof totalMainPts === "number" ? (
                            <span
                              style={{
                                color: totalMainPts > 0 ? "green" : "red",
                                fontWeight: "bold",
                              }}
                            >
                              {totalMainPts}
                            </span>
                          ) : (
                            totalMainPts
                          )}
                        </td>
                        {hasSprint && (
                          <td className="text-center">
                            {typeof totalSprintPts === "number" ? (
                              <span
                                style={{
                                  color: totalSprintPts > 0 ? "green" : "red",
                                  fontWeight: "bold",
                                }}
                              >
                                {totalSprintPts}
                              </span>
                            ) : (
                              totalSprintPts
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
}