// src/components/RaceHistoryCard.jsx
/*
 * Componente unificato per mostrare storico gare, formazioni e punteggi
 * - Supporta main + sprint
 * - Supporta jolly2
 * - Supporta punti doppi
 * - Adattivo al tema dark/light
 * - Stile minimal bianco/nero + rosso
 */
import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Spinner,
  Badge,
  Alert,
} from "react-bootstrap";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";
import { DRIVER_TEAM, TEAM_LOGOS, POINTS } from "../constants/racing";
import { useTheme } from "../contexts/ThemeContext";

/**
 * Visualizza nome del pilota con logo della scuderia
 */
function DriverWithLogo({ name }) {
  if (!name) return <>—</>;
  const team = DRIVER_TEAM[name];
  const logoSrc = team ? TEAM_LOGOS[team] : null;
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

/**
 * Props:
 * - race: oggetto gara con id, name, round, raceUTC, officialResults, etc.
 * - showOfficialResults: (default true) mostra i risultati ufficiali
 * - showPoints: (default true) mostra i punteggi individuali
 * - compact: (default false) versione compatta senza header esteso
 */
export default function RaceHistoryCard({
  race,
  showOfficialResults = true,
  showPoints = true,
  compact = false,
}) {
  const { isDark } = useTheme();
  const [subs, setSubs] = useState([]);
  const [loadingSub, setLoadingSub] = useState(true);
  const [errorSub, setErrorSub] = useState(null);
  const [rankingMap, setRankingMap] = useState({});

  // Carica mappa userId → nome da "ranking"
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

  // Carica le submissions per questa gara
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          collection(db, "races", race.id, "submissions")
        );
        let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Ordina alfabeticamente
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

  const hasJolly2 = subs.some((s) => s.mainJolly2);
  const official = race.officialResults ?? null;
  const hasSprint = Boolean(official?.SP1);
  const doublePts = Boolean(official?.doublePoints);
  const BONUS_MAIN = POINTS.BONUS_JOLLY_MAIN;
  const cancelledMain = race.cancelledMain || false;
  const cancelledSprint = race.cancelledSprint || false;

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";
  const borderColor = cancelledMain ? "#6c757d" : accentColor;

  const DoubleBadge = () =>
    doublePts ? (
      <Badge bg="danger" text="white" className="ms-2">
        🌟 Punti Doppi
      </Badge>
    ) : null;

  return (
    <Card
      className="shadow border-0"
      style={{
        backgroundColor: bgCard,
        borderLeft: `4px solid ${borderColor}`,
      }}
    >
      {!compact && (
        <Card.Header
          className="border-bottom"
          style={{
            backgroundColor: isDark ? "var(--bg-tertiary)" : "#ffffff",
            borderBottomColor: accentColor,
          }}
        >
          <h5 className="mb-0" style={{ color: cancelledMain ? "#6c757d" : accentColor }}>
            {race.round}. {race.name} —{" "}
            {new Date(race.raceUTC.seconds * 1000).toLocaleDateString("it-IT")}
            {cancelledMain && (
              <Badge bg="danger" className="ms-2">
                ⛔ CANCELLATA
              </Badge>
            )}
            {cancelledSprint && hasSprint && (
              <Badge bg="warning" text="dark" className="ms-2">
                SPRINT CANCELLATA
              </Badge>
            )}
            {doublePts && <DoubleBadge />}
          </h5>
        </Card.Header>
      )}

      <Card.Body>
        {/* Alert for cancelled races */}
        {cancelledMain && (
          <Alert variant="danger" className="mb-3">
            <strong>⛔ Gara Cancellata</strong><br />
            Questa gara è stata cancellata e non viene conteggiata nei punteggi.
          </Alert>
        )}
        {cancelledSprint && hasSprint && !cancelledMain && (
          <Alert variant="warning" className="mb-3">
            <strong>⛔ Sprint Cancellata</strong><br />
            La sprint di questa gara è stata cancellata e non viene conteggiata nei punteggi.
          </Alert>
        )}

        {/* ======= RISULTATI UFFICIALI ======= */}
        {showOfficialResults && official && !cancelledMain ? (
          <>
            <h6 className="fw-bold border-bottom pb-1" style={{ color: accentColor }}>
              Gara principale
            </h6>
            <Table size="sm" className="mb-3">
              <thead>
                <tr>
                  <th style={{ width: "20%", color: accentColor }}>Pos.</th>
                  <th style={{ color: accentColor }}>Pilota</th>
                  <th style={{ width: "20%", color: accentColor }} className="text-end">
                    Pts
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>1°</strong></td>
                  <td><DriverWithLogo name={official.P1} /></td>
                  <td className="text-end text-success">{POINTS.MAIN[1]}</td>
                </tr>
                <tr>
                  <td>2°</td>
                  <td><DriverWithLogo name={official.P2} /></td>
                  <td className="text-end text-success">{POINTS.MAIN[2]}</td>
                </tr>
                <tr>
                  <td>3°</td>
                  <td><DriverWithLogo name={official.P3} /></td>
                  <td className="text-end text-success">{POINTS.MAIN[3]}</td>
                </tr>
              </tbody>
            </Table>

            {hasSprint && !cancelledSprint && (
              <>
                <h6 className="fw-bold border-bottom pb-1 mt-4" style={{ color: accentColor }}>
                  Sprint
                </h6>
                <Table size="sm" className="mb-4">
                  <thead>
                    <tr>
                      <th style={{ width: "20%", color: accentColor }}>Pos.</th>
                      <th style={{ color: accentColor }}>Pilota</th>
                      <th style={{ width: "20%", color: accentColor }} className="text-end">
                        Pts
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>SP1°</strong></td>
                      <td><DriverWithLogo name={official.SP1} /></td>
                      <td className="text-end text-success">{POINTS.SPRINT[1]}</td>
                    </tr>
                    <tr>
                      <td>SP2°</td>
                      <td><DriverWithLogo name={official.SP2} /></td>
                      <td className="text-end text-success">{POINTS.SPRINT[2]}</td>
                    </tr>
                    <tr>
                      <td>SP3°</td>
                      <td><DriverWithLogo name={official.SP3} /></td>
                      <td className="text-end text-success">{POINTS.SPRINT[3]}</td>
                    </tr>
                  </tbody>
                </Table>
              </>
            )}
          </>
        ) : showOfficialResults && !official ? (
          <Alert variant="warning">
            Risultati ufficiali non ancora disponibili.
          </Alert>
        ) : null}

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
            <h6 className="fw-bold mb-3" style={{ color: accentColor }}>
              {showPoints && official ? "Formazioni e Punteggi" : "Formazioni"}
            </h6>

            {/* Layout MOBILE - Cards */}
            <div className="d-lg-none">
              {subs.map((s, idx) => {
                /* -------- Calcolo punteggi -------- */
                const p1Pts = showPoints && official && s.mainP1 === official.P1 ? POINTS.MAIN[1] : 0;
                const p2Pts = showPoints && official && s.mainP2 === official.P2 ? POINTS.MAIN[2] : 0;
                const p3Pts = showPoints && official && s.mainP3 === official.P3 ? POINTS.MAIN[3] : 0;

                const j1Pts =
                  showPoints && official && s.mainJolly &&
                  [official.P1, official.P2, official.P3].includes(s.mainJolly)
                    ? BONUS_MAIN
                    : 0;

                const j2Pts =
                  showPoints && official && s.mainJolly2 &&
                  [official.P1, official.P2, official.P3].includes(s.mainJolly2)
                    ? BONUS_MAIN
                    : 0;

                const totalMain =
                  showPoints && official
                    ? s.pointsEarned !== undefined
                      ? s.pointsEarned
                      : p1Pts + p2Pts + p3Pts + j1Pts + j2Pts
                    : null;

                /* -------- Sprint -------- */
                let sp1Pts = 0,
                  sp2Pts = 0,
                  sp3Pts = 0,
                  jspPts = 0,
                  totalSprint = null;

                if (hasSprint) {
                  if (showPoints && official) {
                    sp1Pts = s.sprintP1 === official.SP1 ? POINTS.SPRINT[1] : 0;
                    sp2Pts = s.sprintP2 === official.SP2 ? POINTS.SPRINT[2] : 0;
                    sp3Pts = s.sprintP3 === official.SP3 ? POINTS.SPRINT[3] : 0;
                    jspPts =
                      s.sprintJolly &&
                      [official.SP1, official.SP2, official.SP3].includes(s.sprintJolly)
                        ? POINTS.BONUS_JOLLY_SPRINT
                        : 0;
                    totalSprint =
                      s.pointsEarnedSprint !== undefined
                        ? s.pointsEarnedSprint
                        : sp1Pts + sp2Pts + sp3Pts + jspPts;
                  }
                }

                const userName = s.user || rankingMap[s.id] || s.id;

                const PickLine = ({ label, pick, pts }) => (
                  <div className="d-flex justify-content-between align-items-center py-1 border-bottom" style={{ fontSize: "0.9rem" }}>
                    <span className="text-muted">{label}</span>
                    <div className="d-flex align-items-center gap-2">
                      {pick ? (
                        <>
                          <DriverWithLogo name={pick} />
                          {showPoints && official && (
                            <Badge
                              bg={pts > 0 ? "success" : pts < 0 ? "danger" : "secondary"}
                              pill
                              style={{ minWidth: 35 }}
                            >
                              {pts}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </div>
                  </div>
                );

                return (
                  <Card key={s.id} className="mb-3" style={{ borderLeft: `3px solid ${accentColor}` }}>
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0" style={{ color: accentColor }}>
                          {idx + 1}. {userName}
                          {s.isLate && (
                            <Badge bg="warning" text="dark" className="ms-2">
                              ⏰ In Ritardo (-3)
                            </Badge>
                          )}
                        </h6>
                        {showPoints && official && (
                          <Badge
                            bg={totalMain > 0 ? "success" : totalMain < 0 ? "danger" : "secondary"}
                            style={{ fontSize: "1rem" }}
                          >
                            {totalMain} pts
                          </Badge>
                        )}
                      </div>

                      <div className="mb-2">
                        <strong className="text-muted" style={{ fontSize: "0.85rem" }}>GARA PRINCIPALE</strong>
                        <PickLine label="P1" pick={s.mainP1} pts={p1Pts} />
                        <PickLine label="P2" pick={s.mainP2} pts={p2Pts} />
                        <PickLine label="P3" pick={s.mainP3} pts={p3Pts} />
                        <PickLine label="Jolly 1" pick={s.mainJolly} pts={j1Pts} />
                        {s.mainJolly2 && <PickLine label="Jolly 2" pick={s.mainJolly2} pts={j2Pts} />}
                      </div>

                      {hasSprint && (
                        <div>
                          <div className="d-flex justify-content-between align-items-center">
                            <strong className="text-muted" style={{ fontSize: "0.85rem" }}>SPRINT</strong>
                            {showPoints && official && (
                              <Badge
                                bg={totalSprint > 0 ? "success" : totalSprint < 0 ? "danger" : "secondary"}
                                style={{ fontSize: "0.9rem" }}
                              >
                                {totalSprint} pts
                              </Badge>
                            )}
                          </div>
                          <PickLine label="SP1" pick={s.sprintP1} pts={sp1Pts} />
                          <PickLine label="SP2" pick={s.sprintP2} pts={sp2Pts} />
                          <PickLine label="SP3" pick={s.sprintP3} pts={sp3Pts} />
                          <PickLine label="Jolly SP" pick={s.sprintJolly} pts={jspPts} />
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                );
              })}
            </div>

            {/* Layout DESKTOP - Table */}
            <div className="d-none d-lg-block table-responsive">
              <Table striped bordered hover size="sm" className="align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 40, color: accentColor }} className="text-center">#</th>
                    <th style={{ color: accentColor }} className="text-center">Utente</th>
                    <th style={{ color: accentColor }} className="text-center">
                      P1 {showPoints && official && <small>(Pts)</small>}
                    </th>
                    <th style={{ color: accentColor }} className="text-center">
                      P2 {showPoints && official && <small>(Pts)</small>}
                    </th>
                    <th style={{ color: accentColor }} className="text-center">
                      P3 {showPoints && official && <small>(Pts)</small>}
                    </th>
                    <th style={{ color: accentColor }} className="text-center">
                      Jolly 1 {showPoints && official && <small>(Pts)</small>}
                    </th>
                    {hasJolly2 && (
                      <th style={{ color: accentColor }} className="text-center">
                        Jolly 2 {showPoints && official && <small>(Pts)</small>}
                      </th>
                    )}
                    {hasSprint && (
                      <>
                        <th style={{ color: accentColor }} className="text-center">
                          SP1 {showPoints && official && <small>(Pts)</small>}
                        </th>
                        <th style={{ color: accentColor }} className="text-center">
                          SP2 {showPoints && official && <small>(Pts)</small>}
                        </th>
                        <th style={{ color: accentColor }} className="text-center">
                          SP3 {showPoints && official && <small>(Pts)</small>}
                        </th>
                        <th style={{ color: accentColor }} className="text-center">
                          Jolly SP {showPoints && official && <small>(Pts)</small>}
                        </th>
                      </>
                    )}
                    {showPoints && official && (
                      <>
                        <th style={{ color: accentColor }} className="text-center">Tot Main</th>
                        {hasSprint && <th style={{ color: accentColor }} className="text-center">Tot Sprint</th>}
                      </>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {subs.map((s, idx) => {
                    /* -------- Calcolo punteggi -------- */
                    const p1Pts = showPoints && official && s.mainP1 === official.P1 ? POINTS.MAIN[1] : 0;
                    const p2Pts = showPoints && official && s.mainP2 === official.P2 ? POINTS.MAIN[2] : 0;
                    const p3Pts = showPoints && official && s.mainP3 === official.P3 ? POINTS.MAIN[3] : 0;

                    const j1Pts =
                      showPoints && official && s.mainJolly &&
                      [official.P1, official.P2, official.P3].includes(s.mainJolly)
                        ? BONUS_MAIN
                        : 0;

                    const j2Pts =
                      showPoints && official && s.mainJolly2 &&
                      [official.P1, official.P2, official.P3].includes(s.mainJolly2)
                        ? BONUS_MAIN
                        : 0;

                    const totalMain =
                      showPoints && official
                        ? s.pointsEarned !== undefined
                          ? s.pointsEarned
                          : p1Pts + p2Pts + p3Pts + j1Pts + j2Pts
                        : null;

                    /* -------- Sprint -------- */
                    let sp1Pts = 0,
                      sp2Pts = 0,
                      sp3Pts = 0,
                      jspPts = 0,
                      totalSprint = null;

                    if (hasSprint) {
                      if (showPoints && official) {
                        sp1Pts = s.sprintP1 === official.SP1 ? POINTS.SPRINT[1] : 0;
                        sp2Pts = s.sprintP2 === official.SP2 ? POINTS.SPRINT[2] : 0;
                        sp3Pts = s.sprintP3 === official.SP3 ? POINTS.SPRINT[3] : 0;
                        jspPts =
                          s.sprintJolly &&
                          [official.SP1, official.SP2, official.SP3].includes(s.sprintJolly)
                            ? POINTS.BONUS_JOLLY_SPRINT
                            : 0;
                        totalSprint =
                          s.pointsEarnedSprint !== undefined
                            ? s.pointsEarnedSprint
                            : sp1Pts + sp2Pts + sp3Pts + jspPts;
                      }
                    }

                    const userName = s.user || rankingMap[s.id] || s.id;

                    /* Cella helper con badge per i punti */
                    const Cell = ({ pick, pts }) => (
                      <td className="text-center">
                        {pick ? (
                          <>
                            <DriverWithLogo name={pick} />
                            {showPoints && official && (
                              <>
                                {" "}
                                <Badge bg={pts > 0 ? "success" : pts < 0 ? "danger" : "secondary"} pill>
                                  {pts}
                                </Badge>
                              </>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    );

                    return (
                      <tr key={s.id}>
                        <td className="text-center">{idx + 1}</td>
                        <td className="text-center">
                          {userName}
                          {s.isLate && (
                            <Badge bg="warning" text="dark" className="ms-1">
                              ⏰ -3
                            </Badge>
                          )}
                        </td>

                        {/* Main picks */}
                        <Cell pick={s.mainP1} pts={p1Pts} />
                        <Cell pick={s.mainP2} pts={p2Pts} />
                        <Cell pick={s.mainP3} pts={p3Pts} />
                        <Cell pick={s.mainJolly} pts={j1Pts} />
                        {hasJolly2 && <Cell pick={s.mainJolly2} pts={j2Pts} />}

                        {/* Sprint picks */}
                        {hasSprint && (
                          <>
                            <Cell pick={s.sprintP1} pts={sp1Pts} />
                            <Cell pick={s.sprintP2} pts={sp2Pts} />
                            <Cell pick={s.sprintP3} pts={sp3Pts} />
                            <Cell pick={s.sprintJolly} pts={jspPts} />
                          </>
                        )}

                        {/* Totali */}
                        {showPoints && official && (
                          <>
                            <td
                              className="text-center fw-bold"
                              style={{ color: totalMain > 0 ? "green" : totalMain < 0 ? "red" : "#6c757d" }}
                            >
                              {totalMain}
                            </td>
                            {hasSprint && (
                              <td
                                className="text-center fw-bold"
                                style={{ color: totalSprint > 0 ? "green" : totalSprint < 0 ? "red" : "#6c757d" }}
                              >
                                {totalSprint}
                              </td>
                            )}
                          </>
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
