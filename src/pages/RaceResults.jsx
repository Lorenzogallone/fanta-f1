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
  const [loadingRaces, setLoadingRaces] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState(null);
  const [activeKeys, setActiveKeys] = useState([]);
  const [canSubmitFormation, setCanSubmitFormation] = useState(false);

  // Lazy loading states for individual sessions
  const [loadingSessionKeys, setLoadingSessionKeys] = useState({});
  const [sessionsCache, setSessionsCache] = useState({});

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

        // After races load, get last race info and start loading sessions
        const lastRaceData = await fetchLastRaceSessions();
        let selectedRace = null;

        if (lastRaceData) {
          // Find matching race in Firestore
          const matchingRace = raceList.find(
            (r) => r.round === lastRaceData.round
          );
          if (matchingRace) {
            selectedRace = matchingRace;
            setSelectedRaceId(matchingRace.id);
            setSelectedRace(matchingRace);

            // Show sessions structure immediately
            setSessions({
              raceName: lastRaceData.raceName,
              date: lastRaceData.date,
              season: lastRaceData.season,
              round: lastRaceData.round,
              // Flags to show which accordions to render
              hasFP1: lastRaceData.hasFP1,
              hasFP2: lastRaceData.hasFP2,
              hasFP3: lastRaceData.hasFP3,
              hasSprintQualifying: lastRaceData.hasSprintQualifying,
              hasQualifying: lastRaceData.hasQualifying,
              hasSprint: lastRaceData.hasSprint,
              hasRace: lastRaceData.hasRace,
              // Data will be loaded lazily
              fp1: lastRaceData.fp1,
              fp2: lastRaceData.fp2,
              fp3: lastRaceData.fp3,
              sprintQualifying: lastRaceData.sprintQualifying,
              qualifying: lastRaceData.qualifying,
              sprint: lastRaceData.sprint,
              race: lastRaceData.race,
            });

            // Cache the loaded sessions
            const cacheKey = `${lastRaceData.season}-${lastRaceData.round}`;
            setSessionsCache(prev => ({
              ...prev,
              [cacheKey]: lastRaceData
            }));

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
        }

        // Fallback: if no race was selected from API, select the most recent race from database
        if (!selectedRace && raceList.length > 0) {
          console.log("No matching race from API, selecting most recent race from database");
          const mostRecentRace = raceList[0]; // Already sorted by raceUTC desc
          setSelectedRaceId(mostRecentRace.id);
          setSelectedRace(mostRecentRace);

          // Load sessions for this race
          const season = mostRecentRace.raceUTC.toDate().getFullYear();
          const round = mostRecentRace.round;

          try {
            const sessionData = await fetchAllSessions(season, round);

            setSessions({
              raceName: mostRecentRace.name,
              date: mostRecentRace.raceUTC.toDate().toLocaleDateString(),
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
          } catch (err) {
            console.error("Error loading fallback race sessions:", err);
          }
        }
      } catch (e) {
        console.error("Error loading races:", e);
        setError(t("errors.generic"));
        setLoadingRaces(false);
      }
    };

    loadRaces();
  }, [t]);

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

      </Row>
    </Container>
  );
}
