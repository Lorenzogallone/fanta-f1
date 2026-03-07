/**
 * @file RaceResults.jsx
 * @description Page displaying F1 session results (Qualifying, Sprint, Race)
 * Smart loading: shows only last race by default, expandable sessions
 */

import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
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
import { DRIVER_TEAM, TEAM_LOGOS, getDriverTeamDynamic, getTeamLogoDynamic } from "../constants/racing";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../hooks/useLanguage";
import { log, error } from "../utils/logger";

/**
 * Component to display driver with team logo
 */
function DriverWithLogo({ name }) {
  if (!name) return <>—</>;
  const team = getDriverTeamDynamic(name);
  const logoSrc = team ? getTeamLogoDynamic(team) : null;
  return (
    <span className="d-flex align-items-center">
      {logoSrc && (
        <img
          src={logoSrc}
          alt={`${team} team logo`}
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

DriverWithLogo.propTypes = {
  name: PropTypes.string,
};

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
          alt={`${name} team logo`}
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

TeamWithLogo.propTypes = {
  name: PropTypes.string,
};

/**
 * RaceResults page component
 */
export default function RaceResults() {
  const { isDark } = useTheme();
  const { t, currentLanguage } = useLanguage();
  const navigate = useNavigate();

  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(null);
  const [selectedRace, setSelectedRace] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [loadingRaces, setLoadingRaces] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState(null);
  const [activeKeys, setActiveKeys] = useState([]);
  // { mainOpen: bool, sprintOpen: bool } — live-updated by interval
  const [submissionStatus, setSubmissionStatus] = useState({ mainOpen: false, sprintOpen: false });

  // Lazy loading states for individual sessions
  const [loadingSessionKeys, setLoadingSessionKeys] = useState({});
  const [sessionsCache, setSessionsCache] = useState({});

  // Standings states
  const [activeTab, setActiveTab] = useState("results");
  const [driverStandings, setDriverStandings] = useState(null);
  const [constructorStandings, setConstructorStandings] = useState(null);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [standingsFilter, setStandingsFilter] = useState("all"); // "5", "10", "all"

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";
  const bgHeader = isDark ? "var(--bg-tertiary)" : "#ffffff";

  const locale = currentLanguage === "it" ? "it-IT" : "en-US";

  /**
   * Format a Firestore timestamp to CET date/time components
   */
  const formatToCET = (timestamp) => {
    if (!timestamp) return null;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return {
      dayOfWeek: date.toLocaleDateString(locale, { weekday: "short", timeZone: "Europe/Rome" }),
      dateStr: date.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "Europe/Rome" }),
      time: date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }),
      raw: date,
    };
  };

  /**
   * Compute whether formations can still be submitted for a given race.
   * Uses qualiUTC for the main race deadline and qualiSprintUTC for sprint.
   */
  const computeSubmissionStatus = (race) => {
    if (!race) return { mainOpen: false, sprintOpen: false };
    const now = Date.now();
    const qualiMs = race.qualiUTC ? race.qualiUTC.toDate().getTime() : 0;
    const sprintMs = race.qualiSprintUTC ? race.qualiSprintUTC.toDate().getTime() : 0;
    return {
      mainOpen: qualiMs > now,
      sprintOpen: sprintMs > now,
    };
  };

  // Keep submission status live — re-check every 30 s so the card disappears
  // automatically when the qualifying deadline passes.
  useEffect(() => {
    if (!selectedRace) return;
    setSubmissionStatus(computeSubmissionStatus(selectedRace));
    const id = setInterval(() => {
      setSubmissionStatus(computeSubmissionStatus(selectedRace));
    }, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRace]);

  /**
   * Compute schedule data: upcoming and past races sorted chronologically
   */
  const scheduleData = useMemo(() => {
    if (!races.length) return { upcoming: [], past: [], nextRace: null };

    const now = new Date();
    const sorted = [...races].sort((a, b) => a.round - b.round);

    const upcoming = [];
    const past = [];

    for (const race of sorted) {
      const raceDate = race.raceUTC?.toDate ? race.raceUTC.toDate() : new Date(race.raceUTC?.seconds * 1000);
      if (raceDate > now) {
        upcoming.push(race);
      } else {
        past.push(race);
      }
    }

    const nextRace = upcoming.length > 0 ? upcoming[0] : null;

    return { upcoming, past, nextRace };
  }, [races]);

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

        // Select the race closest to today by date
        if (raceList.length > 0) {
          const now = new Date();

          // Find the race with the smallest absolute time distance from now
          let selectedRaceToLoad = raceList[0];
          let smallestDiff = Math.abs(raceList[0].raceUTC.toDate() - now);

          for (const race of raceList) {
            const diff = Math.abs(race.raceUTC.toDate() - now);
            if (diff < smallestDiff) {
              smallestDiff = diff;
              selectedRaceToLoad = race;
            }
          }

          setSelectedRaceId(selectedRaceToLoad.id);
          setSelectedRace(selectedRaceToLoad);
          setLoadingSessions(true); // Start loading sessions

          // Load sessions for this race
          const season = selectedRaceToLoad.raceUTC.toDate().getFullYear();
          const round = selectedRaceToLoad.round;

          try {
            const sessionData = await fetchAllSessions(season, round);
            const hasAnySession = sessionData.hasQualifying || sessionData.hasSprint || sessionData.hasRace;

            setSessions({
              raceName: selectedRaceToLoad.name,
              date: selectedRaceToLoad.raceUTC.toDate().toLocaleDateString(),
              season,
              round,
              noData: !hasAnySession,
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
            }
            setActiveKeys(defaultKeys);

            // Check if user can still submit formation for the initial race
            setSubmissionStatus(computeSubmissionStatus(selectedRaceToLoad));

            setLoadingSessions(false); // Sessions loaded
          } catch (err) {
            error("Error loading race sessions:", err);
            setLoadingSessions(false); // Stop loading even on error
          }
        }
      } catch (e) {
        error("Error loading races:", e);
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
          error("Error loading standings:", error);
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
    setSubmissionStatus({ mainOpen: false, sprintOpen: false });

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
        log(`Using cached sessions for ${season} R${round}`);
        const sessionData = sessionsCache[cacheKey];
        const hasAnySession = sessionData.hasQualifying || sessionData.hasSprint || sessionData.hasRace;

        setSessions({
          raceName: race.name,
          date: race.raceUTC.toDate().toLocaleDateString(),
          season,
          round,
          noData: !hasAnySession,
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
        }
        setActiveKeys(defaultKeys);

        // Check if user can still submit formation
        setSubmissionStatus(computeSubmissionStatus(race));

        return;
      }

      // Not in cache - load from API
      setLoadingSessions(true);
      setSessions(null);

      const sessionData = await fetchAllSessions(season, round);

      const hasAnySession = sessionData.hasQualifying || sessionData.hasSprint || sessionData.hasRace;

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
        noData: !hasAnySession,
        ...sessionData,
      });

      // Check if user can still submit formation
      setSubmissionStatus(computeSubmissionStatus(race));

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
      }
      setActiveKeys(defaultKeys);
    } catch (e) {
      error("Error loading sessions:", e);
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
                  🏁 F1 Hub
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
                      📊 {t("raceResults.sessionsTab")}
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
                      🏆 {t("raceResults.championshipTab")}
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link
                      eventKey="schedule"
                      style={{
                        backgroundColor: activeTab === "schedule" ? accentColor : "transparent",
                        color: activeTab === "schedule" ? "#fff" : (isDark ? "#fff" : "#000"),
                        borderColor: accentColor,
                      }}
                    >
                      📅 {t("raceResults.scheduleTab")}
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
                  aria-label="Select race to view session results"
                >
                  <option value="">{t("raceResults.chooseRace")}</option>
                  {races.map((race) => (
                    <option key={race.id} value={race.id}>
                      {t("history.round")} {race.round} - {race.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              {/* Submit Formation Card — shown only while deadlines are still open */}
              {selectedRace && (submissionStatus.mainOpen || submissionStatus.sprintOpen) && (
                <Alert variant="info" className="mt-3 mb-0">
                  <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                    <div>
                      <strong>{t("raceResults.canStillSubmit")}</strong>
                      {submissionStatus.mainOpen && (
                        <div className="small mt-1">
                          {t("raceResults.canStillSubmitMain")}
                          {selectedRace.qualiUTC && (
                            <> — {t("raceResults.deadlineAt")} {formatToCET(selectedRace.qualiUTC)?.time} ({formatToCET(selectedRace.qualiUTC)?.dateStr})</>
                          )}
                        </div>
                      )}
                      {submissionStatus.sprintOpen && (
                        <div className="small mt-1">
                          {t("raceResults.canStillSubmitSprint")}
                          {selectedRace.qualiSprintUTC && (
                            <> — {t("raceResults.deadlineAt")} {formatToCET(selectedRace.qualiSprintUTC)?.time} ({formatToCET(selectedRace.qualiSprintUTC)?.dateStr})</>
                          )}
                        </div>
                      )}
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
                      aria-label="Go to formation page to submit lineup"
                    >
                      {t("raceResults.goToFormation")}
                    </Button>
                  </div>
                </Alert>
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
                    <>
                      {/* Filter Buttons */}
                      <div className="d-flex justify-content-center gap-2 mb-4 flex-wrap">
                        <Button
                          size="sm"
                          variant={standingsFilter === "5" ? "danger" : "outline-secondary"}
                          onClick={() => setStandingsFilter("5")}
                          style={{
                            backgroundColor: standingsFilter === "5" ? accentColor : "transparent",
                            borderColor: standingsFilter === "5" ? accentColor : (isDark ? "#6c757d" : "#dee2e6"),
                          }}
                          aria-label="Show top 5 in standings"
                        >
                          Top 5
                        </Button>
                        <Button
                          size="sm"
                          variant={standingsFilter === "10" ? "danger" : "outline-secondary"}
                          onClick={() => setStandingsFilter("10")}
                          style={{
                            backgroundColor: standingsFilter === "10" ? accentColor : "transparent",
                            borderColor: standingsFilter === "10" ? accentColor : (isDark ? "#6c757d" : "#dee2e6"),
                          }}
                          aria-label="Show top 10 in standings"
                        >
                          Top 10
                        </Button>
                        <Button
                          size="sm"
                          variant={standingsFilter === "all" ? "danger" : "outline-secondary"}
                          onClick={() => setStandingsFilter("all")}
                          style={{
                            backgroundColor: standingsFilter === "all" ? accentColor : "transparent",
                            borderColor: standingsFilter === "all" ? accentColor : (isDark ? "#6c757d" : "#dee2e6"),
                          }}
                          aria-label="Show all positions in standings"
                        >
                          {t("raceResults.allFilter")}
                        </Button>
                      </div>

                      <Row className="g-4">
                        {/* Driver Standings */}
                        <Col xs={12} lg={6}>
                          <h5 className="mb-3" style={{ color: accentColor }}>
                            🏎️ {t("raceResults.driverStandings")}
                          </h5>
                          {driverStandings && driverStandings.length > 0 ? (
                            <>
                              {/* Podium */}
                              <div className="d-flex justify-content-center align-items-end gap-2 gap-md-3 mb-4" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                              {/* 2nd Place */}
                              {driverStandings[1] && (
                                <div className="text-center" style={{ flex: '1', maxWidth: '32%', minWidth: 0 }}>
                                  <div
                                    style={{
                                      backgroundColor: '#C0C0C0',
                                      height: '60px',
                                      borderRadius: '8px 8px 0 0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 'bold',
                                      fontSize: 'clamp(1.2rem, 4vw, 2rem)',
                                      color: '#fff',
                                      textShadow: '1px 1px 3px rgba(0,0,0,0.3)',
                                    }}
                                  >
                                    2
                                  </div>
                                  <div className="p-1 p-md-2" style={{ fontSize: 'clamp(0.7rem, 2vw, 0.9rem)', overflow: 'hidden' }}>
                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {driverStandings[1].driver.split(' ').pop()}
                                    </div>
                                    <div className="fw-bold mt-1" style={{ color: accentColor, fontSize: 'clamp(0.75rem, 2.5vw, 1rem)' }}>
                                      {driverStandings[1].points}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 1st Place */}
                              {driverStandings[0] && (
                                <div className="text-center" style={{ flex: '1', maxWidth: '32%', minWidth: 0 }}>
                                  <div
                                    style={{
                                      backgroundColor: '#FFD700',
                                      height: '90px',
                                      borderRadius: '8px 8px 0 0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 'bold',
                                      fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
                                      color: '#fff',
                                      textShadow: '1px 1px 3px rgba(0,0,0,0.3)',
                                    }}
                                  >
                                    1
                                  </div>
                                  <div className="p-1 p-md-2" style={{ fontSize: 'clamp(0.7rem, 2vw, 0.9rem)', overflow: 'hidden' }}>
                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {driverStandings[0].driver.split(' ').pop()}
                                    </div>
                                    <div className="fw-bold mt-1" style={{ color: accentColor, fontSize: 'clamp(0.75rem, 2.5vw, 1rem)' }}>
                                      {driverStandings[0].points}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 3rd Place */}
                              {driverStandings[2] && (
                                <div className="text-center" style={{ flex: '1', maxWidth: '32%', minWidth: 0 }}>
                                  <div
                                    style={{
                                      backgroundColor: '#CD7F32',
                                      height: '45px',
                                      borderRadius: '8px 8px 0 0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 'bold',
                                      fontSize: 'clamp(1rem, 3.5vw, 1.8rem)',
                                      color: '#fff',
                                      textShadow: '1px 1px 3px rgba(0,0,0,0.3)',
                                    }}
                                  >
                                    3
                                  </div>
                                  <div className="p-1 p-md-2" style={{ fontSize: 'clamp(0.7rem, 2vw, 0.9rem)', overflow: 'hidden' }}>
                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {driverStandings[2].driver.split(' ').pop()}
                                    </div>
                                    <div className="fw-bold mt-1" style={{ color: accentColor, fontSize: 'clamp(0.75rem, 2.5vw, 1rem)' }}>
                                      {driverStandings[2].points}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Full Standings Table */}
                            <div className="table-responsive">
                              <Table hover size="sm" variant={isDark ? "dark" : undefined} className="mb-0">
                                <thead>
                                  <tr>
                                    <th style={{ color: accentColor, width: '10%', padding: '0.5rem 0.25rem' }}>#</th>
                                    <th style={{ color: accentColor, padding: '0.5rem 0.25rem' }}>{t("formations.driver")}</th>
                                    <th className="text-end" style={{ color: accentColor, width: '20%', padding: '0.5rem 0.25rem' }}>Pt</th>
                                    <th className="text-end d-none d-md-table-cell" style={{ color: accentColor, width: '15%', padding: '0.5rem 0.25rem' }}>Win</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {driverStandings
                                    .slice(0, standingsFilter === "5" ? 5 : standingsFilter === "10" ? 10 : driverStandings.length)
                                    .map((standing, idx) => (
                                      <tr key={idx} className={idx < 3 ? "fw-bold" : ""}>
                                        <td style={{ padding: '0.5rem 0.25rem' }}>{standing.position}</td>
                                        <td style={{ padding: '0.5rem 0.25rem' }}>
                                          <div className="d-flex align-items-center">
                                            <DriverWithLogo name={standing.driver} />
                                          </div>
                                        </td>
                                        <td className="text-end" style={{ padding: '0.5rem 0.25rem' }}>{standing.points}</td>
                                        <td className="text-end d-none d-md-table-cell" style={{ padding: '0.5rem 0.25rem' }}>{standing.wins}</td>
                                      </tr>
                                    ))}
                                </tbody>
                              </Table>
                            </div>
                          </>
                        ) : (
                          <Alert variant="info">{t("raceResults.driverStandingsUnavailable")}</Alert>
                        )}
                      </Col>

                      {/* Constructor Standings */}
                      <Col xs={12} lg={6}>
                        <h5 className="mb-3" style={{ color: accentColor }}>
                          🏁 {t("raceResults.constructorStandings")}
                        </h5>
                        {constructorStandings && constructorStandings.length > 0 ? (
                          <>
                            {/* Podium */}
                            <div className="d-flex justify-content-center align-items-end gap-2 gap-md-3 mb-4" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                              {/* 2nd Place */}
                              {constructorStandings[1] && (
                                <div className="text-center" style={{ flex: '1', maxWidth: '32%', minWidth: 0 }}>
                                  <div
                                    style={{
                                      backgroundColor: '#C0C0C0',
                                      height: '60px',
                                      borderRadius: '8px 8px 0 0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 'bold',
                                      fontSize: 'clamp(1.2rem, 4vw, 2rem)',
                                      color: '#fff',
                                      textShadow: '1px 1px 3px rgba(0,0,0,0.3)',
                                    }}
                                  >
                                    2
                                  </div>
                                  <div className="p-1 p-md-2" style={{ fontSize: 'clamp(0.65rem, 1.8vw, 0.85rem)', overflow: 'hidden' }}>
                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {constructorStandings[1].constructor}
                                    </div>
                                    <div className="fw-bold mt-1" style={{ color: accentColor, fontSize: 'clamp(0.75rem, 2.5vw, 1rem)' }}>
                                      {constructorStandings[1].points}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 1st Place */}
                              {constructorStandings[0] && (
                                <div className="text-center" style={{ flex: '1', maxWidth: '32%', minWidth: 0 }}>
                                  <div
                                    style={{
                                      backgroundColor: '#FFD700',
                                      height: '90px',
                                      borderRadius: '8px 8px 0 0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 'bold',
                                      fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
                                      color: '#fff',
                                      textShadow: '1px 1px 3px rgba(0,0,0,0.3)',
                                    }}
                                  >
                                    1
                                  </div>
                                  <div className="p-1 p-md-2" style={{ fontSize: 'clamp(0.65rem, 1.8vw, 0.85rem)', overflow: 'hidden' }}>
                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {constructorStandings[0].constructor}
                                    </div>
                                    <div className="fw-bold mt-1" style={{ color: accentColor, fontSize: 'clamp(0.75rem, 2.5vw, 1rem)' }}>
                                      {constructorStandings[0].points}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 3rd Place */}
                              {constructorStandings[2] && (
                                <div className="text-center" style={{ flex: '1', maxWidth: '32%', minWidth: 0 }}>
                                  <div
                                    style={{
                                      backgroundColor: '#CD7F32',
                                      height: '45px',
                                      borderRadius: '8px 8px 0 0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 'bold',
                                      fontSize: 'clamp(1rem, 3.5vw, 1.8rem)',
                                      color: '#fff',
                                      textShadow: '1px 1px 3px rgba(0,0,0,0.3)',
                                    }}
                                  >
                                    3
                                  </div>
                                  <div className="p-1 p-md-2" style={{ fontSize: 'clamp(0.65rem, 1.8vw, 0.85rem)', overflow: 'hidden' }}>
                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {constructorStandings[2].constructor}
                                    </div>
                                    <div className="fw-bold mt-1" style={{ color: accentColor, fontSize: 'clamp(0.75rem, 2.5vw, 1rem)' }}>
                                      {constructorStandings[2].points}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Full Standings Table */}
                            <div className="table-responsive">
                              <Table hover size="sm" variant={isDark ? "dark" : undefined} className="mb-0">
                                <thead>
                                  <tr>
                                    <th style={{ color: accentColor, width: '10%', padding: '0.5rem 0.25rem' }}>#</th>
                                    <th style={{ color: accentColor, padding: '0.5rem 0.25rem' }}>Team</th>
                                    <th className="text-end" style={{ color: accentColor, width: '20%', padding: '0.5rem 0.25rem' }}>Pt</th>
                                    <th className="text-end d-none d-md-table-cell" style={{ color: accentColor, width: '15%', padding: '0.5rem 0.25rem' }}>Win</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {constructorStandings
                                    .slice(0, standingsFilter === "5" ? 5 : standingsFilter === "10" ? 10 : constructorStandings.length)
                                    .map((standing, idx) => (
                                      <tr key={idx} className={idx < 3 ? "fw-bold" : ""}>
                                        <td style={{ padding: '0.5rem 0.25rem' }}>{standing.position}</td>
                                        <td style={{ padding: '0.5rem 0.25rem' }}>
                                          <div className="d-flex align-items-center">
                                            <TeamWithLogo name={standing.constructor} />
                                          </div>
                                        </td>
                                        <td className="text-end" style={{ padding: '0.5rem 0.25rem' }}>{standing.points}</td>
                                        <td className="text-end d-none d-md-table-cell" style={{ padding: '0.5rem 0.25rem' }}>{standing.wins}</td>
                                      </tr>
                                    ))}
                                </tbody>
                              </Table>
                            </div>
                          </>
                        ) : (
                          <Alert variant="info">{t("raceResults.constructorStandingsUnavailable")}</Alert>
                        )}
                      </Col>
                    </Row>
                </>
              )}
            </>
          )}

              {/* Schedule Tab */}
              {activeTab === "schedule" && (
                <>
                  <p className="text-muted mb-4" style={{ fontSize: "0.9rem" }}>
                    🕐 {t("raceResults.allTimesInCET")}
                  </p>

                  {races.length === 0 ? (
                    <Alert variant="info">{t("raceResults.noRacesScheduled")}</Alert>
                  ) : (
                    <>
                      {/* Next Race - Highlighted */}
                      {scheduleData.nextRace && (() => {
                        const race = scheduleData.nextRace;
                        const raceDate = race.raceUTC?.toDate ? race.raceUTC.toDate() : new Date(race.raceUTC?.seconds * 1000);
                        const daysUntil = Math.ceil((raceDate - new Date()) / (1000 * 60 * 60 * 24));
                        const isSprint = !!race.qualiSprintUTC;

                        const sessionRows = [];
                        if (isSprint) {
                          const sqFmt = formatToCET(race.qualiSprintUTC);
                          if (sqFmt) sessionRows.push({ label: t("raceResults.sprintQualifying"), ...sqFmt, icon: "⚡" });
                          const spFmt = formatToCET(race.sprintUTC);
                          if (spFmt) sessionRows.push({ label: t("raceResults.sprint"), ...spFmt, icon: "⚡" });
                        }
                        const qFmt = formatToCET(race.qualiUTC);
                        if (qFmt) sessionRows.push({ label: t("raceResults.qualifying"), ...qFmt, icon: "🏎️" });
                        const rFmt = formatToCET(race.raceUTC);
                        if (rFmt) sessionRows.push({ label: t("raceResults.race"), ...rFmt, icon: "🏆" });

                        let countdownText;
                        if (daysUntil <= 0) countdownText = t("raceResults.today");
                        else if (daysUntil === 1) countdownText = t("raceResults.tomorrow");
                        else countdownText = t("raceResults.daysUntil", { count: daysUntil });

                        return (
                          <Card
                            className="mb-4 shadow schedule-next-race"
                            style={{
                              borderColor: accentColor,
                              borderWidth: "2px",
                              backgroundColor: bgCard,
                            }}
                          >
                            <Card.Header
                              style={{
                                backgroundColor: accentColor,
                                color: "#fff",
                                borderBottom: "none",
                              }}
                            >
                              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                <div>
                                  <span className="fw-bold" style={{ fontSize: "1.1rem" }}>
                                    R{race.round} — {race.name}
                                  </span>
                                  {isSprint && (
                                    <Badge bg="warning" text="dark" className="ms-2">
                                      🏁 {t("raceResults.sprintWeekend")}
                                    </Badge>
                                  )}
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                  <Badge bg="light" text="dark" style={{ fontSize: "0.85rem" }}>
                                    {countdownText}
                                  </Badge>
                                  <Badge bg="light" text="dark" style={{ fontSize: "0.75rem" }}>
                                    {t("raceResults.nextRace")}
                                  </Badge>
                                </div>
                              </div>
                            </Card.Header>
                            <Card.Body className="p-0">
                              <Table hover className="mb-0" size="sm" variant={isDark ? "dark" : undefined}>
                                <thead>
                                  <tr>
                                    <th style={{ color: accentColor, padding: "0.6rem 0.75rem" }}>{t("raceResults.sessionSchedule")}</th>
                                    <th style={{ color: accentColor, padding: "0.6rem 0.75rem" }}>{t("common.date")}</th>
                                    <th className="text-end" style={{ color: accentColor, padding: "0.6rem 0.75rem" }}>CET</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sessionRows.map((s, idx) => (
                                    <tr key={idx}>
                                      <td style={{ padding: "0.6rem 0.75rem" }}>
                                        <span className="me-2">{s.icon}</span>
                                        <strong>{s.label}</strong>
                                      </td>
                                      <td style={{ padding: "0.6rem 0.75rem" }}>
                                        <span className="text-capitalize">{s.dayOfWeek}</span> {s.dateStr}
                                      </td>
                                      <td className="text-end fw-bold font-monospace" style={{ padding: "0.6rem 0.75rem", color: accentColor }}>
                                        {s.time}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </Card.Body>
                          </Card>
                        );
                      })()}

                      {/* Other Upcoming Races */}
                      {scheduleData.upcoming.length > 1 && (
                        <>
                          <h6 className="mb-3 mt-2" style={{ color: accentColor }}>
                            📅 {t("raceResults.upcomingRaces")} ({scheduleData.upcoming.length - 1})
                          </h6>
                          <div className="schedule-race-list">
                            {scheduleData.upcoming.slice(1).map((race) => {
                              const isSprint = !!race.qualiSprintUTC;
                              const qFmt = formatToCET(race.qualiUTC);
                              const rFmt = formatToCET(race.raceUTC);

                              return (
                                <Card
                                  key={race.id}
                                  className="mb-2 schedule-race-card"
                                  style={{ backgroundColor: bgCard, borderColor: isDark ? "var(--border-color)" : "#dee2e6" }}
                                >
                                  <Card.Body className="p-0">
                                    {/* Race header row */}
                                    <div
                                      className="d-flex justify-content-between align-items-center px-3 py-2"
                                      style={{
                                        borderBottom: `1px solid ${isDark ? "var(--border-color)" : "#dee2e6"}`,
                                        backgroundColor: isDark ? "var(--bg-tertiary)" : "#f8f9fa",
                                      }}
                                    >
                                      <div className="d-flex align-items-center gap-2">
                                        <Badge bg="secondary" style={{ minWidth: "36px" }}>R{race.round}</Badge>
                                        <strong style={{ fontSize: "0.95rem" }}>{race.name}</strong>
                                        {isSprint && (
                                          <Badge bg="warning" text="dark" style={{ fontSize: "0.7rem" }}>🏁 {t("raceResults.sprintWeekend")}</Badge>
                                        )}
                                        {race.cancelledMain && (
                                          <Badge bg="danger" style={{ fontSize: "0.7rem" }}>{t("history.cancelled")}</Badge>
                                        )}
                                      </div>
                                    </div>
                                    {/* Session times */}
                                    <Table hover className="mb-0" size="sm" variant={isDark ? "dark" : undefined} style={{ fontSize: "0.85rem" }}>
                                      <tbody>
                                        {isSprint && (() => {
                                          const sqFmt = formatToCET(race.qualiSprintUTC);
                                          const spFmt = formatToCET(race.sprintUTC);
                                          return (
                                            <>
                                              {sqFmt && (
                                                <tr>
                                                  <td style={{ padding: "0.4rem 0.75rem" }}>⚡ {t("raceResults.sprintQualifying")}</td>
                                                  <td className="text-muted text-capitalize" style={{ padding: "0.4rem 0.5rem" }}>{sqFmt.dayOfWeek} {sqFmt.dateStr}</td>
                                                  <td className="text-end fw-bold font-monospace" style={{ padding: "0.4rem 0.75rem", color: accentColor }}>{sqFmt.time}</td>
                                                </tr>
                                              )}
                                              {spFmt && (
                                                <tr>
                                                  <td style={{ padding: "0.4rem 0.75rem" }}>⚡ {t("raceResults.sprint")}</td>
                                                  <td className="text-muted text-capitalize" style={{ padding: "0.4rem 0.5rem" }}>{spFmt.dayOfWeek} {spFmt.dateStr}</td>
                                                  <td className="text-end fw-bold font-monospace" style={{ padding: "0.4rem 0.75rem", color: accentColor }}>{spFmt.time}</td>
                                                </tr>
                                              )}
                                            </>
                                          );
                                        })()}
                                        {qFmt && (
                                          <tr>
                                            <td style={{ padding: "0.4rem 0.75rem" }}>🏎️ {t("raceResults.qualifying")}</td>
                                            <td className="text-muted text-capitalize" style={{ padding: "0.4rem 0.5rem" }}>{qFmt.dayOfWeek} {qFmt.dateStr}</td>
                                            <td className="text-end fw-bold font-monospace" style={{ padding: "0.4rem 0.75rem", color: accentColor }}>{qFmt.time}</td>
                                          </tr>
                                        )}
                                        {rFmt && (
                                          <tr>
                                            <td style={{ padding: "0.4rem 0.75rem" }}>🏆 {t("raceResults.race")}</td>
                                            <td className="text-muted text-capitalize" style={{ padding: "0.4rem 0.5rem" }}>{rFmt.dayOfWeek} {rFmt.dateStr}</td>
                                            <td className="text-end fw-bold font-monospace" style={{ padding: "0.4rem 0.75rem", color: accentColor }}>{rFmt.time}</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </Table>
                                  </Card.Body>
                                </Card>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {/* Past Races - Compact */}
                      {scheduleData.past.length > 0 && (
                        <>
                          <h6 className="mb-3 mt-4" style={{ color: isDark ? "var(--text-secondary)" : "#6c757d" }}>
                            ✅ {t("raceResults.pastRaces")} ({scheduleData.past.length})
                          </h6>
                          <Card style={{ backgroundColor: bgCard, borderColor: isDark ? "var(--border-color)" : "#dee2e6" }}>
                            <div className="table-responsive">
                              <Table hover size="sm" variant={isDark ? "dark" : undefined} className="mb-0" style={{ fontSize: "0.85rem" }}>
                                <thead>
                                  <tr>
                                    <th style={{ padding: "0.5rem 0.75rem", width: "50px" }}>#</th>
                                    <th style={{ padding: "0.5rem 0.75rem" }}>{t("history.race")}</th>
                                    <th style={{ padding: "0.5rem 0.75rem" }}>{t("raceResults.qualifying")}</th>
                                    <th style={{ padding: "0.5rem 0.75rem" }}>{t("raceResults.race")}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {scheduleData.past.map((race) => {
                                    const qFmt = formatToCET(race.qualiUTC);
                                    const rFmt = formatToCET(race.raceUTC);
                                    return (
                                      <tr key={race.id} style={{ opacity: 0.7 }}>
                                        <td style={{ padding: "0.5rem 0.75rem" }}>{race.round}</td>
                                        <td style={{ padding: "0.5rem 0.75rem" }}>
                                          {race.name}
                                          {race.cancelledMain && <Badge bg="danger" className="ms-2" style={{ fontSize: "0.65rem" }}>{t("history.cancelled")}</Badge>}
                                        </td>
                                        <td className="font-monospace" style={{ padding: "0.5rem 0.75rem" }}>
                                          {qFmt ? `${qFmt.dayOfWeek} ${qFmt.dateStr} ${qFmt.time}` : "—"}
                                        </td>
                                        <td className="font-monospace" style={{ padding: "0.5rem 0.75rem" }}>
                                          {rFmt ? `${rFmt.dayOfWeek} ${rFmt.dateStr} ${rFmt.time}` : "—"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </Table>
                            </div>
                          </Card>
                        </>
                      )}
                    </>
                  )}
                </>
              )}

            </Card.Body>
          </Card>
        </Col>

        {/* Loading state - only when no sessions data at all */}
        {activeTab === "results" && loadingSessions && !sessions && (
          <Col xs={12} className="text-center">
            <Spinner animation="border" />
            <p className="mt-3 text-muted">{t("common.loading")}</p>
          </Col>
        )}

        {/* Error state */}
        {activeTab === "results" && error && !sessions && (
          <Col xs={12}>
            <Alert variant="warning">{error}</Alert>
          </Col>
        )}

        {/* Sessions Display - show as soon as we have session metadata */}
        {activeTab === "results" && sessions && (
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
                {sessions.noData ? (
                  <Alert variant="info" className="text-center mb-0">
                    <div className="py-3">
                      <h5>{t("raceResults.noResultsYet")}</h5>
                      <p className="mb-0 text-muted">{t("raceResults.noResultsYetDescription")}</p>
                    </div>
                  </Alert>
                ) : (
                  <Accordion
                    activeKey={activeKeys}
                    onSelect={(keys) => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
                    alwaysOpen
                  >
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
                )}
              </Card.Body>
            </Card>
          </Col>
        )}

      </Row>
    </Container>
  );
}
