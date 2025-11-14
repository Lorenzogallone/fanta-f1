/**
 * @file RaceResults.jsx
 * @description Page displaying F1 session results (Qualifying, Sprint, Race)
 * Smart loading: shows only last race by default, expandable sessions
 */

import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Accordion,
  Table,
  Spinner,
  Alert,
  Badge,
  Form,
  Button,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  orderBy as firestoreOrderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../services/firebase";
import {
  fetchAllSessions,
  fetchLastRaceSessions,
} from "../services/f1SessionsFetcher";
import { DRIVER_TEAM, TEAM_LOGOS } from "../constants/racing";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * Component to display driver with team logo
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
 * RaceResults page component
 */
export default function RaceResults() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(null);
  const [selectedRace, setSelectedRace] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState(null);
  const [activeKeys, setActiveKeys] = useState([]);
  const [canSubmitFormation, setCanSubmitFormation] = useState(false);

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";
  const bgHeader = isDark ? "var(--bg-tertiary)" : "#ffffff";

  /**
   * Load all races from Firestore
   */
  useEffect(() => {
    (async () => {
      try {
        const now = Timestamp.now();
        const snap = await getDocs(
          query(
            collection(db, "races"),
            firestoreOrderBy("raceUTC", "desc")
          )
        );
        const raceList = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setRaces(raceList);

        // Load last race sessions automatically
        const lastRaceData = await fetchLastRaceSessions();
        if (lastRaceData) {
          setSessions(lastRaceData);
          // Find matching race in Firestore
          const matchingRace = raceList.find(
            (r) => r.round === lastRaceData.round
          );
          if (matchingRace) {
            setSelectedRaceId(matchingRace.id);
          }

          // Set default expanded keys based on session status
          const defaultKeys = [];
          if (lastRaceData.hasRace) {
            defaultKeys.push("race");
          } else if (lastRaceData.hasSprint) {
            defaultKeys.push("sprint");
          } else if (lastRaceData.hasSprintQualifying) {
            defaultKeys.push("sprintQualifying");
          } else if (lastRaceData.hasQualifying) {
            defaultKeys.push("qualifying");
          } else if (lastRaceData.hasFP3) {
            defaultKeys.push("fp3");
          } else if (lastRaceData.hasFP2) {
            defaultKeys.push("fp2");
          } else if (lastRaceData.hasFP1) {
            defaultKeys.push("fp1");
          }
          setActiveKeys(defaultKeys);
        }
      } catch (e) {
        console.error("Error loading races:", e);
        setError(t("errors.generic"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  /**
   * Load sessions when race changes
   */
  const handleRaceChange = async (raceId) => {
    if (!raceId) return;

    setSelectedRaceId(raceId);
    setLoadingSessions(true);
    setSessions(null);
    setError(null);
    setCanSubmitFormation(false);

    try {
      const race = races.find((r) => r.id === raceId);
      if (!race) {
        setError(t("raceResults.raceNotFound"));
        return;
      }

      setSelectedRace(race);

      const season = race.raceUTC.toDate().getFullYear();
      const round = race.round;

      const sessionData = await fetchAllSessions(season, round);

      if (!sessionData.hasFP1 && !sessionData.hasFP2 && !sessionData.hasFP3 &&
          !sessionData.hasSprintQualifying && !sessionData.hasQualifying &&
          !sessionData.hasSprint && !sessionData.hasRace) {
        setError(t("raceResults.noDataAvailable"));
        setSessions(null);
        return;
      }

      setSessions({
        raceName: race.name,
        date: race.raceUTC.toDate().toLocaleDateString(),
        season,
        round,
        ...sessionData,
      });

      // Check if user can still submit formation
      // If qualifying or sprint qualifying hasn't happened yet and deadline hasn't passed
      const now = Timestamp.now();
      const deadlineHasPassed = race.raceUTC.toDate() < now.toDate();
      const canSubmit = !deadlineHasPassed && (!sessionData.hasQualifying || !sessionData.hasSprintQualifying);
      setCanSubmitFormation(canSubmit);

      // Set default expanded keys
      const defaultKeys = [];
      if (sessionData.hasRace) {
        defaultKeys.push("race");
      } else if (sessionData.hasSprint) {
        defaultKeys.push("sprint");
      } else if (sessionData.hasSprintQualifying) {
        defaultKeys.push("sprintQualifying");
      } else if (sessionData.hasQualifying) {
        defaultKeys.push("qualifying");
      } else if (sessionData.hasFP3) {
        defaultKeys.push("fp3");
      } else if (sessionData.hasFP2) {
        defaultKeys.push("fp2");
      } else if (sessionData.hasFP1) {
        defaultKeys.push("fp1");
      }
      setActiveKeys(defaultKeys);
    } catch (e) {
      console.error("Error loading sessions:", e);
      setError(t("errors.generic"));
    } finally {
      setLoadingSessions(false);
    }
  };

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <Row className="g-4">
        {/* Header */}
        <Col xs={12}>
          <Card
            className="shadow"
            style={{
              borderColor: accentColor,
              backgroundColor: bgCard,
            }}
          >
            <Card.Header
              style={{
                backgroundColor: bgHeader,
                borderBottom: `2px solid ${accentColor}`,
              }}
            >
              <h3 className="mb-0" style={{ color: accentColor }}>
                🏁 {t("raceResults.title")}
              </h3>
            </Card.Header>
            <Card.Body>
              <p className="text-muted mb-3">{t("raceResults.description")}</p>

              {/* Race Selector */}
              <Form.Group>
                <Form.Label className="fw-bold">{t("raceResults.selectRace")}</Form.Label>
                <Form.Select
                  value={selectedRaceId || ""}
                  onChange={(e) => handleRaceChange(e.target.value)}
                  style={{
                    borderColor: accentColor,
                  }}
                >
                  <option value="">{t("raceResults.chooseRace")}</option>
                  {races.map((race) => (
                    <option key={race.id} value={race.id}>
                      {t("history.round")} {race.round} - {race.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              {/* Submit Formation Button */}
              {canSubmitFormation && selectedRace && (
                <Alert variant="info" className="mt-3 mb-0">
                  <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                    <div>
                      <strong>{t("raceResults.canStillSubmit")}</strong>
                      <div className="small">{t("raceResults.qualifyingNotStarted")}</div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate("/schiera")}
                      style={{
                        backgroundColor: accentColor,
                        borderColor: accentColor,
                        whiteSpace: "nowrap",
                      }}
                    >
                      🏎️ {t("raceResults.goToFormation")}
                    </Button>
                  </div>
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Loading state */}
        {loadingSessions && (
          <Col xs={12} className="text-center">
            <Spinner animation="border" />
            <p className="mt-3 text-muted">{t("common.loading")}</p>
          </Col>
        )}

        {/* Error state */}
        {error && !loadingSessions && (
          <Col xs={12}>
            <Alert variant="warning">{error}</Alert>
          </Col>
        )}

        {/* Sessions Display */}
        {sessions && !loadingSessions && !error && (
          <Col xs={12}>
            <Card
              className="shadow"
              style={{
                borderColor: accentColor,
                backgroundColor: bgCard,
              }}
            >
              <Card.Header
                style={{
                  backgroundColor: bgHeader,
                  borderBottom: `2px solid ${accentColor}`,
                }}
              >
                <h4 className="mb-0">
                  {sessions.raceName}
                  <Badge bg="secondary" className="ms-3">
                    {t("history.round")} {sessions.round}
                  </Badge>
                </h4>
                <small className="text-muted">{sessions.date}</small>
              </Card.Header>

              <Card.Body>
                <Accordion
                  activeKey={activeKeys}
                  onSelect={(keys) => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
                  alwaysOpen
                >
                  {/* FP1 */}
                  {sessions.hasFP1 && (
                    <Accordion.Item eventKey="fp1">
                      <Accordion.Header>
                        <strong style={{ color: accentColor }}>
                          🔧 {t("raceResults.fp1")}
                        </strong>
                      </Accordion.Header>
                      <Accordion.Body>
                        <div className="table-responsive">
                          <Table hover className="align-middle" size="sm">
                            <thead>
                              <tr>
                                <th style={{ color: accentColor }}>{t("leaderboard.rank")}</th>
                                <th style={{ color: accentColor }}>{t("formations.driver")}</th>
                                <th style={{ color: accentColor }}>{t("raceResults.bestTime")}</th>
                                <th style={{ color: accentColor }}>{t("leaderboard.gap")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessions.fp1.map((result, idx) => (
                                <tr key={idx} className={idx < 3 ? "fw-bold" : ""}>
                                  <td>{result.position}</td>
                                  <td>
                                    <DriverWithLogo name={result.driver} />
                                  </td>
                                  <td className="font-monospace">{result.bestTimeFormatted}</td>
                                  <td className="text-muted">{result.gap}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* FP2 */}
                  {sessions.hasFP2 && (
                    <Accordion.Item eventKey="fp2">
                      <Accordion.Header>
                        <strong style={{ color: accentColor }}>
                          🔧 {t("raceResults.fp2")}
                        </strong>
                      </Accordion.Header>
                      <Accordion.Body>
                        <div className="table-responsive">
                          <Table hover className="align-middle" size="sm">
                            <thead>
                              <tr>
                                <th style={{ color: accentColor }}>{t("leaderboard.rank")}</th>
                                <th style={{ color: accentColor }}>{t("formations.driver")}</th>
                                <th style={{ color: accentColor }}>{t("raceResults.bestTime")}</th>
                                <th style={{ color: accentColor }}>{t("leaderboard.gap")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessions.fp2.map((result, idx) => (
                                <tr key={idx} className={idx < 3 ? "fw-bold" : ""}>
                                  <td>{result.position}</td>
                                  <td>
                                    <DriverWithLogo name={result.driver} />
                                  </td>
                                  <td className="font-monospace">{result.bestTimeFormatted}</td>
                                  <td className="text-muted">{result.gap}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* FP3 */}
                  {sessions.hasFP3 && (
                    <Accordion.Item eventKey="fp3">
                      <Accordion.Header>
                        <strong style={{ color: accentColor }}>
                          🔧 {t("raceResults.fp3")}
                        </strong>
                      </Accordion.Header>
                      <Accordion.Body>
                        <div className="table-responsive">
                          <Table hover className="align-middle" size="sm">
                            <thead>
                              <tr>
                                <th style={{ color: accentColor }}>{t("leaderboard.rank")}</th>
                                <th style={{ color: accentColor }}>{t("formations.driver")}</th>
                                <th style={{ color: accentColor }}>{t("raceResults.bestTime")}</th>
                                <th style={{ color: accentColor }}>{t("leaderboard.gap")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessions.fp3.map((result, idx) => (
                                <tr key={idx} className={idx < 3 ? "fw-bold" : ""}>
                                  <td>{result.position}</td>
                                  <td>
                                    <DriverWithLogo name={result.driver} />
                                  </td>
                                  <td className="font-monospace">{result.bestTimeFormatted}</td>
                                  <td className="text-muted">{result.gap}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* Sprint Qualifying */}
                  {sessions.hasSprintQualifying && (
                    <Accordion.Item eventKey="sprintQualifying">
                      <Accordion.Header>
                        <strong style={{ color: accentColor }}>
                          ⚡ {t("raceResults.sprintQualifying")}
                        </strong>
                      </Accordion.Header>
                      <Accordion.Body>
                        <div className="table-responsive">
                          <Table hover className="align-middle" size="sm">
                            <thead>
                              <tr>
                                <th style={{ color: accentColor }}>{t("leaderboard.rank")}</th>
                                <th style={{ color: accentColor }}>{t("formations.driver")}</th>
                                <th style={{ color: accentColor }}>{t("raceResults.bestTime")}</th>
                                <th style={{ color: accentColor }}>{t("leaderboard.gap")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessions.sprintQualifying.map((result, idx) => (
                                <tr key={idx} className={idx < 3 ? "fw-bold" : ""}>
                                  <td>{result.position}</td>
                                  <td>
                                    <DriverWithLogo name={result.driver} />
                                  </td>
                                  <td className="font-monospace">{result.bestTimeFormatted}</td>
                                  <td className="text-muted">{result.gap}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* Qualifying */}
                  {sessions.hasQualifying && (
                    <Accordion.Item eventKey="qualifying">
                      <Accordion.Header>
                        <strong style={{ color: accentColor }}>
                          🏎️ {t("raceResults.qualifying")}
                        </strong>
                      </Accordion.Header>
                      <Accordion.Body>
                        <div className="table-responsive">
                          <Table hover className="align-middle" size="sm">
                            <thead>
                              <tr>
                                <th style={{ color: accentColor }}>{t("leaderboard.rank")}</th>
                                <th style={{ color: accentColor }}>{t("formations.driver")}</th>
                                <th style={{ color: accentColor }} className="d-none d-md-table-cell">Q1</th>
                                <th style={{ color: accentColor }} className="d-none d-md-table-cell">Q2</th>
                                <th style={{ color: accentColor }} className="d-none d-md-table-cell">Q3</th>
                                <th style={{ color: accentColor }}>{t("raceResults.bestTime")}</th>
                                <th style={{ color: accentColor }}>{t("leaderboard.gap")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessions.qualifying.map((result, idx) => (
                                <tr key={idx} className={idx < 3 ? "fw-bold" : ""}>
                                  <td>{result.position}</td>
                                  <td>
                                    <DriverWithLogo name={result.driver} />
                                  </td>
                                  <td className="d-none d-md-table-cell">{result.q1}</td>
                                  <td className="d-none d-md-table-cell">{result.q2}</td>
                                  <td className="d-none d-md-table-cell">{result.q3}</td>
                                  <td className="font-monospace">{result.bestTime}</td>
                                  <td className="text-muted">{result.gap}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* Sprint */}
                  {sessions.hasSprint && (
                    <Accordion.Item eventKey="sprint">
                      <Accordion.Header>
                        <strong style={{ color: accentColor }}>
                          ⚡ {t("raceResults.sprint")}
                        </strong>
                      </Accordion.Header>
                      <Accordion.Body>
                        <div className="table-responsive">
                          <Table hover className="align-middle" size="sm">
                            <thead>
                              <tr>
                                <th style={{ color: accentColor }}>{t("leaderboard.rank")}</th>
                                <th style={{ color: accentColor }}>{t("formations.driver")}</th>
                                <th style={{ color: accentColor }}>{t("raceResults.time")}</th>
                                <th style={{ color: accentColor }}>{t("leaderboard.gap")}</th>
                                <th style={{ color: accentColor }} className="text-center">
                                  {t("common.points")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessions.sprint.map((result, idx) => (
                                <tr key={idx} className={idx < 3 ? "fw-bold" : ""}>
                                  <td>{result.position}</td>
                                  <td>
                                    <DriverWithLogo name={result.driver} />
                                  </td>
                                  <td className="font-monospace">{result.time}</td>
                                  <td className="text-muted">{result.gap}</td>
                                  <td className="text-center">
                                    {result.points > 0 && (
                                      <Badge bg="success">{result.points}</Badge>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                  )}

                  {/* Race */}
                  {sessions.hasRace && (
                    <Accordion.Item eventKey="race">
                      <Accordion.Header>
                        <strong style={{ color: accentColor }}>
                          🏆 {t("raceResults.race")}
                        </strong>
                      </Accordion.Header>
                      <Accordion.Body>
                        <div className="table-responsive">
                          <Table hover className="align-middle" size="sm">
                            <thead>
                              <tr>
                                <th style={{ color: accentColor }}>{t("leaderboard.rank")}</th>
                                <th style={{ color: accentColor }}>{t("formations.driver")}</th>
                                <th style={{ color: accentColor }}>{t("raceResults.time")}</th>
                                <th style={{ color: accentColor }}>{t("leaderboard.gap")}</th>
                                <th style={{ color: accentColor }} className="text-center">
                                  {t("common.points")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessions.race.map((result, idx) => (
                                <tr key={idx} className={idx < 3 ? "fw-bold" : ""}>
                                  <td>
                                    {result.position} {result.fastestLap}
                                  </td>
                                  <td>
                                    <DriverWithLogo name={result.driver} />
                                  </td>
                                  <td className="font-monospace">{result.time}</td>
                                  <td className="text-muted">{result.gap}</td>
                                  <td className="text-center">
                                    {result.points > 0 && (
                                      <Badge bg="primary">{result.points}</Badge>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                  )}
                </Accordion>
              </Card.Body>
            </Card>
          </Col>
        )}

      </Row>
    </Container>
  );
}
