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
  Nav,
  Tab,
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
  fetchDriverStandings,
  fetchConstructorStandings,
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
 * Component to display team with logo
 */
function TeamWithLogo({ name }) {
  if (!name) return <>—</>;
  const logoSrc = TEAM_LOGOS[name];
  return (
    <span className="d-flex align-items-center">
      {logoSrc && (
        <img
          src={logoSrc}
          alt={name}
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
  const [loadingRaces, setLoadingRaces] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState(null);
  const [activeKeys, setActiveKeys] = useState([]);
  const [canSubmitFormation, setCanSubmitFormation] = useState(false);

  // Lazy loading states for individual sessions
  const [loadingSessionKeys, setLoadingSessionKeys] = useState({});
  const [sessionsCache, setSessionsCache] = useState({});

  // Standings states
  const [activeTab, setActiveTab] = useState("results");
  const [driverStandings, setDriverStandings] = useState(null);
  const [constructorStandings, setConstructorStandings] = useState(null);
  const [loadingStandings, setLoadingStandings] = useState(false);

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";
  const bgHeader = isDark ? "var(--bg-tertiary)" : "#ffffff";

  /**
   * Renders session accordion body with loading state
   * @param {Array|null} data - Session data
   * @param {string} eventKey - Accordion event key for this session
   * @returns {JSX.Element} Accordion body content
   */
  const renderSessionBody = (data, eventKey) => {
    // Check if this accordion is currently open
    const isOpen = activeKeys.includes(eventKey);

    // If not open, don't render content yet (performance optimization)
    if (!isOpen) {
      return null;
    }

    // If data is not loaded yet, show spinner
    if (!data || data.length === 0) {
      return (
        <div className="text-center py-4">
          <Spinner animation="border" size="sm" />
          <p className="mt-3 mb-0 text-muted">{t("common.loading")}</p>
        </div>
      );
    }

    // Render the data table
    return (
      <div className="table-responsive" style={{ fontSize: "0.95rem" }}>
        <Table hover className="align-middle" size="sm" variant={isDark ? "dark" : undefined}>
          <thead>
            <tr>
              <th className="text-center" style={{ color: accentColor }}>{t("leaderboard.rank")}</th>
              <th style={{ color: accentColor }}>{t("formations.driver")}</th>
              <th className="text-center" style={{ color: accentColor }}>{t("leaderboard.gap")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((result, idx) => (
              <tr key={idx} className={idx < 3 ? "fw-bold" : ""}>
                <td className="text-center">
                  {result.position} {result.fastestLap || ""}
                </td>
                <td>
                  <DriverWithLogo name={result.driver} />
                </td>
                <td className="text-center text-muted font-monospace">{result.gap}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  };

  /**
   * Renders qualifying accordion body with Q session badges and loading state
   * @param {Array|null} data - Qualifying data
   * @returns {JSX.Element} Accordion body content
   */
  const renderQualifyingBody = (data) => {
    // Check if this accordion is currently open
    const isOpen = activeKeys.includes("qualifying");

    // If not open, don't render content yet (performance optimization)
    if (!isOpen) {
      return null;
    }

    // If data is not loaded yet, show spinner
    if (!data || data.length === 0) {
      return (
        <div className="text-center py-4">
          <Spinner animation="border" size="sm" />
          <p className="mt-3 mb-0 text-muted">{t("common.loading")}</p>
        </div>
      );
    }

    // Render qualifying table with Q session badges
    return (
      <div className="table-responsive" style={{ fontSize: "0.95rem" }}>
        <Table hover className="align-middle" size="sm" variant={isDark ? "dark" : undefined}>
          <thead>
            <tr>
              <th style={{ color: accentColor }}>{t("leaderboard.rank")}</th>
              <th style={{ color: accentColor }}>{t("formations.driver")}</th>
              <th style={{ color: accentColor }}>{t("leaderboard.gap")}</th>
              <th style={{ color: accentColor }} className="text-center">Q</th>
            </tr>
          </thead>
          <tbody>
            {data.map((result, idx) => {
              const pos = parseInt(result.position);
              let qSession = "Q1";
              let qVariant = "danger";
              if (pos <= 10) {
                qSession = "Q3";
                qVariant = "success";
              } else if (pos <= 15) {
                qSession = "Q2";
                qVariant = "warning";
              }
              return (
                <tr key={idx} className={idx < 3 ? "fw-bold" : ""}>
                  <td>{result.position}</td>
                  <td>
                    <DriverWithLogo name={result.driver} />
                  </td>
                  <td className="text-muted font-monospace">{result.gap}</td>
                  <td className="text-center">
                    <Badge bg={qVariant} text={qVariant === "warning" ? "dark" : "light"}>
                      {qSession}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    );
  };

  /**
   * Load all races from Firestore and last race sessions progressively
   */
  useEffect(() => {
    // Load races list first (fast)
    const loadRaces = async () => {
      try {
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
        setLoadingRaces(false); // Show race selector immediately

        // Select either current race weekend or last completed race
        if (raceList.length > 0) {
          const now = new Date();

          // Find the right race: either current weekend or last completed
          let selectedRaceToLoad = null;

          for (const race of raceList) {
            const raceDate = race.raceUTC.toDate();
            const fridayBeforeRace = new Date(raceDate);
            fridayBeforeRace.setDate(raceDate.getDate() - 2); // 2 days before (Friday if race is Sunday)

            // If we're in the race weekend (Friday to race day) or race is in the past
            if (now >= fridayBeforeRace || now >= raceDate) {
              selectedRaceToLoad = race;
              break; // Found the right race
            }
          }

          // Fallback to most recent race if no match found
          if (!selectedRaceToLoad) {
            selectedRaceToLoad = raceList[0];
          }

          setSelectedRaceId(selectedRaceToLoad.id);
          setSelectedRace(selectedRaceToLoad);
          setLoadingSessions(true); // Start loading sessions

          // Load sessions for this race
          const season = selectedRaceToLoad.raceUTC.toDate().getFullYear();
          const round = selectedRaceToLoad.round;

          try {
            const sessionData = await fetchAllSessions(season, round);

            setSessions({
              raceName: selectedRaceToLoad.name,
              date: selectedRaceToLoad.raceUTC.toDate().toLocaleDateString(),
              season,
              round,
              ...sessionData,
            });

            // Cache the sessions
            const cacheKey = `${season}-${round}`;
            setSessionsCache(prev => ({
              ...prev,
              [cacheKey]: sessionData
            }));

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
            setLoadingSessions(false); // Sessions loaded
          } catch (err) {
            console.error("Error loading race sessions:", err);
            setLoadingSessions(false); // Stop loading even on error
          }
        }
      } catch (e) {
        console.error("Error loading races:", e);
        setError(t("errors.generic"));
        setLoadingRaces(false);
        setLoadingSessions(false);
      }
    };

    loadRaces();
  }, [t]);

  /**
   * Load standings when standings tab becomes active
   */
  useEffect(() => {
    if (activeTab === "standings" && !driverStandings && !constructorStandings) {
      (async () => {
        setLoadingStandings(true);
        try {
          const [drivers, constructors] = await Promise.all([
            fetchDriverStandings(),
            fetchConstructorStandings(),
          ]);
          setDriverStandings(drivers);
          setConstructorStandings(constructors);
        } catch (error) {
          console.error("Error loading standings:", error);
        } finally {
          setLoadingStandings(false);
        }
      })();
    }
  }, [activeTab, driverStandings, constructorStandings]);

  /**
   * Load sessions when race changes (with caching)
   */
  const handleRaceChange = async (raceId) => {
    if (!raceId) return;

    setSelectedRaceId(raceId);
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
      const cacheKey = `${season}-${round}`;

      // Check cache first
      if (sessionsCache[cacheKey]) {
        console.log(`Using cached sessions for ${season} R${round}`);
        const sessionData = sessionsCache[cacheKey];

        setSessions({
          raceName: race.name,
          date: race.raceUTC.toDate().toLocaleDateString(),
          season,
          round,
          ...sessionData,
        });

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

        // Check if user can still submit formation
        const now = Timestamp.now();
        const deadlineHasPassed = race.raceUTC.toDate() < now.toDate();
        const canSubmit = !deadlineHasPassed && (!sessionData.hasQualifying || !sessionData.hasSprintQualifying);
        setCanSubmitFormation(canSubmit);

        return;
      }

      // Not in cache - load from API
      setLoadingSessions(true);
      setSessions(null);

      const sessionData = await fetchAllSessions(season, round);

      if (!sessionData.hasFP1 && !sessionData.hasFP2 && !sessionData.hasFP3 &&
          !sessionData.hasSprintQualifying && !sessionData.hasQualifying &&
          !sessionData.hasSprint && !sessionData.hasRace) {
        setError(t("raceResults.noDataAvailable"));
        setSessions(null);
        return;
      }

      // Cache the sessions
      setSessionsCache(prev => ({
        ...prev,
        [cacheKey]: sessionData
      }));

      setSessions({
        raceName: race.name,
        date: race.raceUTC.toDate().toLocaleDateString(),
        season,
        round,
        ...sessionData,
      });

      // Check if user can still submit formation
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

  // Show loading only while loading races list
  if (loadingRaces) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p className="mt-3">{t("common.loading")}</p>
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
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center">
                <h3 className="mb-3 mb-md-0" style={{ color: accentColor }}>
                  🏁 {t("raceResults.title")}
                </h3>
                <Nav variant="pills" activeKey={activeTab} onSelect={setActiveTab}>
                  <Nav.Item>
                    <Nav.Link
                      eventKey="results"
                      style={{
                        backgroundColor: activeTab === "results" ? accentColor : "transparent",
                        color: activeTab === "results" ? "#fff" : (isDark ? "#fff" : "#000"),
                        borderColor: accentColor,
                      }}
                    >
                      📊 Risultati
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link
                      eventKey="standings"
                      style={{
                        backgroundColor: activeTab === "standings" ? accentColor : "transparent",
                        color: activeTab === "standings" ? "#fff" : (isDark ? "#fff" : "#000"),
                        borderColor: accentColor,
                      }}
                    >
                      🏆 Classifiche
                    </Nav.Link>
                  </Nav.Item>
                </Nav>
              </div>
            </Card.Header>
            <Card.Body>
              {activeTab === "results" && (
                <>
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
                      onClick={() => navigate("/lineup")}
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

        {/* Loading state - only when no sessions data at all */}
        {loadingSessions && !sessions && (
          <Col xs={12} className="text-center">
            <Spinner animation="border" />
            <p className="mt-3 text-muted">{t("common.loading")}</p>
          </Col>
        )}

        {/* Error state */}
        {error && !sessions && (
          <Col xs={12}>
            <Alert variant="warning">{error}</Alert>
          </Col>
        )}

        {/* Sessions Display - show as soon as we have session metadata */}
        {sessions && (
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
                {/* Warning for ongoing/recent races */}
                {(() => {
                  const raceDate = selectedRace?.raceUTC?.toDate();
                  const now = new Date();
                  const daysSinceRace = raceDate ? (now - raceDate) / (1000 * 60 * 60 * 24) : 999;
                  const daysUntilRace = raceDate ? (raceDate - now) / (1000 * 60 * 60 * 24) : 999;

                  // Show warning if race is recent (within 2 days after) or upcoming (within 3 days before)
                  // AND if the race session is not available yet
                  const isRecentOrUpcoming = daysSinceRace < 2 || (daysUntilRace >= 0 && daysUntilRace < 3);
                  const raceNotAvailable = !sessions.hasRace;

                  if (isRecentOrUpcoming && raceNotAvailable) {
                    return (
                      <Alert variant="warning" className="mb-3">
                        <strong>⚠️ {t("common.warning")}:</strong> {t("raceResults.sessionNotFinished")}
                      </Alert>
                    );
                  }
                  return null;
                })()}
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
                      <Accordion.Body className="p-2 p-md-3">
                        {renderSessionBody(sessions.fp1, "fp1")}
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
                      <Accordion.Body className="p-2 p-md-3">
                        {renderSessionBody(sessions.fp2, "fp2")}
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
                      <Accordion.Body className="p-2 p-md-3">
                        {renderSessionBody(sessions.fp3, "fp3")}
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
                      <Accordion.Body className="p-2 p-md-3">
                        {renderSessionBody(sessions.sprintQualifying, "sprintQualifying")}
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
                      <Accordion.Body className="p-2 p-md-3">
                        {renderQualifyingBody(sessions.qualifying)}
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
                      <Accordion.Body className="p-2 p-md-3">
                        {renderSessionBody(sessions.sprint, "sprint")}
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
                      <Accordion.Body className="p-2 p-md-3">
                        {renderSessionBody(sessions.race, "race")}
                      </Accordion.Body>
                    </Accordion.Item>
                  )}
                </Accordion>
              </Card.Body>
            </Card>
          </Col>
        )}
              </>
            )}

              {/* Standings Tab */}
              {activeTab === "standings" && (
                <>
                  {loadingStandings ? (
                    <div className="text-center py-5">
                      <Spinner animation="border" variant={isDark ? "light" : "primary"} style={{ width: '3rem', height: '3rem' }} />
                      <p className="mt-3 text-muted">{t("common.loading")}</p>
                    </div>
                  ) : (
                    <Row className="g-4">
                      {/* Driver Standings */}
                      <Col xs={12} lg={6}>
                        <h5 className="mb-3" style={{ color: accentColor }}>
                          🏎️ Classifica Piloti
                        </h5>
                        {driverStandings && driverStandings.length > 0 ? (
                          <>
                            {/* Podium */}
                            <div className="d-flex justify-content-center align-items-end gap-3 mb-4">
                              {/* 2nd Place */}
                              {driverStandings[1] && (
                                <div className="text-center" style={{ width: '30%' }}>
                                  <div
                                    style={{
                                      backgroundColor: '#C0C0C0',
                                      height: '80px',
                                      borderRadius: '8px 8px 0 0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 'bold',
                                      fontSize: '2rem',
                                      color: '#fff',
                                      textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                                    }}
                                  >
                                    2
                                  </div>
                                  <div className="p-2">
                                    <DriverWithLogo name={driverStandings[1].driver} />
                                    <div className="fw-bold mt-1" style={{ color: accentColor }}>
                                      {driverStandings[1].points} pts
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 1st Place */}
                              {driverStandings[0] && (
                                <div className="text-center" style={{ width: '30%' }}>
                                  <div
                                    style={{
                                      backgroundColor: '#FFD700',
                                      height: '120px',
                                      borderRadius: '8px 8px 0 0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 'bold',
                                      fontSize: '2.5rem',
                                      color: '#fff',
                                      textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                                    }}
                                  >
                                    1
                                  </div>
                                  <div className="p-2">
                                    <DriverWithLogo name={driverStandings[0].driver} />
                                    <div className="fw-bold mt-1" style={{ color: accentColor }}>
                                      {driverStandings[0].points} pts
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 3rd Place */}
                              {driverStandings[2] && (
                                <div className="text-center" style={{ width: '30%' }}>
                                  <div
                                    style={{
                                      backgroundColor: '#CD7F32',
                                      height: '60px',
                                      borderRadius: '8px 8px 0 0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 'bold',
                                      fontSize: '1.8rem',
                                      color: '#fff',
                                      textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                                    }}
                                  >
                                    3
                                  </div>
                                  <div className="p-2">
                                    <DriverWithLogo name={driverStandings[2].driver} />
                                    <div className="fw-bold mt-1" style={{ color: accentColor }}>
                                      {driverStandings[2].points} pts
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Full Standings Table */}
                            <div className="table-responsive">
                              <Table hover size="sm" variant={isDark ? "dark" : undefined}>
                                <thead>
                                  <tr>
                                    <th style={{ color: accentColor }}>Pos</th>
                                    <th style={{ color: accentColor }}>Pilota</th>
                                    <th className="text-end" style={{ color: accentColor }}>Punti</th>
                                    <th className="text-end" style={{ color: accentColor }}>Vitt.</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {driverStandings.map((standing, idx) => (
                                    <tr key={idx} className={idx < 3 ? "fw-bold" : ""}>
                                      <td>{standing.position}</td>
                                      <td><DriverWithLogo name={standing.driver} /></td>
                                      <td className="text-end">{standing.points}</td>
                                      <td className="text-end">{standing.wins}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </div>
                          </>
                        ) : (
                          <Alert variant="info">Classifica piloti non disponibile</Alert>
                        )}
                      </Col>

                      {/* Constructor Standings */}
                      <Col xs={12} lg={6}>
                        <h5 className="mb-3" style={{ color: accentColor }}>
                          🏁 Classifica Costruttori
                        </h5>
                        {constructorStandings && constructorStandings.length > 0 ? (
                          <>
                            {/* Podium */}
                            <div className="d-flex justify-content-center align-items-end gap-3 mb-4">
                              {/* 2nd Place */}
                              {constructorStandings[1] && (
                                <div className="text-center" style={{ width: '30%' }}>
                                  <div
                                    style={{
                                      backgroundColor: '#C0C0C0',
                                      height: '80px',
                                      borderRadius: '8px 8px 0 0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 'bold',
                                      fontSize: '2rem',
                                      color: '#fff',
                                      textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                                    }}
                                  >
                                    2
                                  </div>
                                  <div className="p-2">
                                    <TeamWithLogo name={constructorStandings[1].constructor} />
                                    <div className="fw-bold mt-1" style={{ color: accentColor }}>
                                      {constructorStandings[1].points} pts
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 1st Place */}
                              {constructorStandings[0] && (
                                <div className="text-center" style={{ width: '30%' }}>
                                  <div
                                    style={{
                                      backgroundColor: '#FFD700',
                                      height: '120px',
                                      borderRadius: '8px 8px 0 0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 'bold',
                                      fontSize: '2.5rem',
                                      color: '#fff',
                                      textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                                    }}
                                  >
                                    1
                                  </div>
                                  <div className="p-2">
                                    <TeamWithLogo name={constructorStandings[0].constructor} />
                                    <div className="fw-bold mt-1" style={{ color: accentColor }}>
                                      {constructorStandings[0].points} pts
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 3rd Place */}
                              {constructorStandings[2] && (
                                <div className="text-center" style={{ width: '30%' }}>
                                  <div
                                    style={{
                                      backgroundColor: '#CD7F32',
                                      height: '60px',
                                      borderRadius: '8px 8px 0 0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 'bold',
                                      fontSize: '1.8rem',
                                      color: '#fff',
                                      textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                                    }}
                                  >
                                    3
                                  </div>
                                  <div className="p-2">
                                    <TeamWithLogo name={constructorStandings[2].constructor} />
                                    <div className="fw-bold mt-1" style={{ color: accentColor }}>
                                      {constructorStandings[2].points} pts
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Full Standings Table */}
                            <div className="table-responsive">
                              <Table hover size="sm" variant={isDark ? "dark" : undefined}>
                                <thead>
                                  <tr>
                                    <th style={{ color: accentColor }}>Pos</th>
                                    <th style={{ color: accentColor }}>Team</th>
                                    <th className="text-end" style={{ color: accentColor }}>Punti</th>
                                    <th className="text-end" style={{ color: accentColor }}>Vitt.</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {constructorStandings.map((standing, idx) => (
                                    <tr key={idx} className={idx < 3 ? "fw-bold" : ""}>
                                      <td>{standing.position}</td>
                                      <td><TeamWithLogo name={standing.constructor} /></td>
                                      <td className="text-end">{standing.points}</td>
                                      <td className="text-end">{standing.wins}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </div>
                          </>
                        ) : (
                          <Alert variant="info">Classifica costruttori non disponibile</Alert>
                        )}
                      </Col>
                    </Row>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        </Col>

      </Row>
    </Container>
  );
}
