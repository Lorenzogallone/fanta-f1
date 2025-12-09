/**
 * @file History.jsx
 * @description Historical race results and championship results page
 * Displays all completed races with results, formations, and points
 * Uses the unified RaceHistoryCard component
 * Shows championship results when available
 */

import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Container,
  Row,
  Col,
  Spinner,
  Alert,
  Card,
  Table,
  Badge,
  Form,
  Nav,
} from "react-bootstrap";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import RaceHistoryCard from "../components/RaceHistoryCard";
import { TEAM_LOGOS, POINTS, getDriverTeamDynamic, getTeamLogoDynamic } from "../constants/racing";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../hooks/useLanguage";
import { error } from "../utils/logger";

/**
 * Component to display driver name with team logo
 * @param {Object} props - Component props
 * @param {string} props.name - Driver name
 * @returns {JSX.Element} Driver name with team logo
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

DriverWithLogo.propTypes = {
  name: PropTypes.string,
};

/**
 * Component to display team name with logo
 * @param {Object} props - Component props
 * @param {string} props.name - Team name
 * @returns {JSX.Element} Team name with logo
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

TeamWithLogo.propTypes = {
  name: PropTypes.string,
};

/**
 * Helper component for points badge - consistent styling
 * @param {Object} props - Component props
 * @param {number} props.pts - Points value
 * @param {boolean} props.pill - Use pill style
 * @param {string} props.className - Additional classes
 * @param {Object} props.style - Additional inline styles
 * @returns {JSX.Element} Points badge
 */
function PointsBadge({ pts, pill = false, className = "", style = {} }) {
  // Same pattern as RaceHistoryCard: green if > 0, secondary (grey) if = 0
  // Use text="light" for secondary to ensure white text visibility
  const bg = pts > 0 ? "success" : "secondary";
  return (
    <Badge bg={bg} text="light" pill={pill} className={className} style={style}>
      {pts}
    </Badge>
  );
}

PointsBadge.propTypes = {
  pts: PropTypes.number.isRequired,
  pill: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object,
};

/**
 * History page displaying past races and championship results
 * @returns {JSX.Element} History page with race results and championship standings
 */
export default function History() {
  const [pastRaces, setPastRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null);
  const [championshipResults, setChampionshipResults] = useState(null);
  const [championshipSubmissions, setChampionshipSubmissions] = useState([]);
  const [loadingChampionship, setLoadingChampionship] = useState(true);
  const [isLoadingRaceData, setIsLoadingRaceData] = useState(false);
  const [activeTab, setActiveTab] = useState("races"); // "races" or "championship"
  const { isDark } = useTheme();
  const { t } = useLanguage();

  /**
   * Load past races from Firestore
   */
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
        const races = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPastRaces(races);

        // Set first race (most recent) as selected by default
        if (races.length > 0) {
          setSelectedRaceId(races[0].id);
        }
      } catch (e) {
        error(e);
        setErrorState(t("errors.generic"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  /**
   * Load championship results and submissions
   */
  useEffect(() => {
    (async () => {
      try {
        // Load official championship results
        const champDoc = await getDoc(doc(db, "championship", "results"));
        if (champDoc.exists()) {
          setChampionshipResults(champDoc.data());

          // Load all submissions from ranking
          const rankingSnap = await getDocs(collection(db, "ranking"));
          const submissions = [];

          rankingSnap.docs.forEach((userDoc) => {
            const data = userDoc.data();
            if (
              data.championshipPiloti &&
              Array.isArray(data.championshipPiloti) &&
              data.championshipPiloti.length === 3
            ) {
              submissions.push({
                userId: userDoc.id,
                name: data.name,
                piloti: data.championshipPiloti,
                costruttori: data.championshipCostruttori || [],
                points: data.championshipPts || 0,
              });
            }
          });

          // Sort by name
          submissions.sort((a, b) => a.name.localeCompare(b.name, "it"));
          setChampionshipSubmissions(submissions);
        }
      } catch (e) {
        error("Errore caricamento campionato:", e);
      } finally {
        setLoadingChampionship(false);
      }
    })();
  }, []);

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";
  const bgHeader = isDark ? "var(--bg-tertiary)" : "#ffffff";

  // Get selected race
  const selectedRace = pastRaces.find((r) => r.id === selectedRaceId);

  /**
   * Handle race selection change with loading state
   * Provides immediate visual feedback when changing races
   */
  const handleRaceChange = (raceId) => {
    if (raceId === selectedRaceId) return; // No change

    setIsLoadingRaceData(true);
    setSelectedRaceId(raceId);

    // Simulate minimum loading time for smooth UX
    // This ensures the spinner is visible even if data loads instantly from cache
    setTimeout(() => {
      setIsLoadingRaceData(false);
    }, 400);
  };

  if (loading)
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  if (errorState)
    return (
      <Container className="py-5">
        <Alert variant="danger">{errorState}</Alert>
      </Container>
    );
  if (!pastRaces.length && !championshipResults)
    return (
      <Container className="py-5">
        <Alert variant="info">{t("history.noRaces")}</Alert>
      </Container>
    );

  /**
   * Calculate championship points for a submission
   * @param {Object} submission - User's championship submission
   * @param {Object} official - Official championship results
   * @returns {Object} Points breakdown with pilotiPts, costruttoriPts, and total
   */
  const calculateChampionshipPoints = (submission, official) => {
    if (!official) return { pilotiPts: 0, costruttoriPts: 0, total: 0 };

    let pilotiPts = 0;
    if (submission.piloti[0] === official.P1) pilotiPts += POINTS.MAIN[1];
    if (submission.piloti[1] === official.P2) pilotiPts += POINTS.MAIN[2];
    if (submission.piloti[2] === official.P3) pilotiPts += POINTS.MAIN[3];

    let costruttoriPts = 0;
    if (submission.costruttori[0] === official.C1) costruttoriPts += POINTS.MAIN[1];
    if (submission.costruttori[1] === official.C2) costruttoriPts += POINTS.MAIN[2];
    if (submission.costruttori[2] === official.C3) costruttoriPts += POINTS.MAIN[3];

    // Special rule: 29 points rounds up to 30
    if (pilotiPts === 29) pilotiPts = 30;
    if (costruttoriPts === 29) costruttoriPts = 30;

    return {
      pilotiPts,
      costruttoriPts,
      total: pilotiPts + costruttoriPts,
    };
  };

  const hasChampionship = !loadingChampionship && championshipResults;

  return (
    <Container className="py-5">
      <Card
        className="shadow border-0"
        style={{
          backgroundColor: bgCard,
          borderLeft: `4px solid ${accentColor}`,
        }}
      >
        <Card.Header
          className="border-bottom"
          style={{
            backgroundColor: bgHeader,
            borderBottomColor: accentColor,
          }}
        >
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
            <h3 className="mb-0" style={{ color: accentColor }}>
              📊 {t("nav.history")}
            </h3>
            <Nav variant="pills" activeKey={activeTab} onSelect={setActiveTab}>
              <Nav.Item>
                <Nav.Link
                  eventKey="races"
                  style={{
                    backgroundColor: activeTab === "races" ? accentColor : "transparent",
                    color: activeTab === "races" ? "#fff" : (isDark ? "#fff" : "#000"),
                    borderColor: accentColor,
                  }}
                >
                  🏁 {t("history.racesTab")}
                </Nav.Link>
              </Nav.Item>
              {hasChampionship && (
                <Nav.Item>
                  <Nav.Link
                    eventKey="championship"
                    style={{
                      backgroundColor: activeTab === "championship" ? accentColor : "transparent",
                      color: activeTab === "championship" ? "#fff" : (isDark ? "#fff" : "#000"),
                      borderColor: accentColor,
                    }}
                  >
                    🏆 {t("history.championshipTab")}
                  </Nav.Link>
                </Nav.Item>
              )}
            </Nav>
          </div>
        </Card.Header>

        <Card.Body>
          {/* ============ TAB GARE ============ */}
          {activeTab === "races" && (
            <>
              {pastRaces.length > 0 ? (
                <>
                  <p className="text-muted mb-3">
                    {t("history.raceCount", { count: pastRaces.length })}
                  </p>

                  {/* Race Selector */}
                  <Form.Group className="mb-4">
                    <Form.Label className="fw-bold">{t("raceResults.selectRace")}</Form.Label>
                    <Form.Select
                      value={selectedRaceId || ""}
                      onChange={(e) => handleRaceChange(e.target.value)}
                      style={{
                        borderColor: accentColor,
                      }}
                    >
                      <option value="">{t("raceResults.chooseRace")}</option>
                      {pastRaces.map((race) => (
                        <option key={race.id} value={race.id}>
                          {t("history.round")} {race.round} - {race.name}
                          {race.officialResults ? ` ✓` : ""}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>

                  {/* Loading state when changing races */}
                  {isLoadingRaceData && selectedRace && (
                    <div className="text-center py-5 mb-4">
                      <div className="mb-3">
                        <h5 style={{ color: accentColor }}>
                          {t("history.round")} {selectedRace.round} - {selectedRace.name}
                        </h5>
                        <small className="text-muted">
                          {selectedRace.raceUTC && new Date(selectedRace.raceUTC.seconds * 1000).toLocaleDateString()}
                        </small>
                      </div>
                      <Spinner animation="border" variant={isDark ? "light" : "primary"} style={{ width: '3rem', height: '3rem' }} />
                      <p className="mt-3 text-muted">{t("common.loading")}</p>
                    </div>
                  )}

                  {/* Selected Race Details - shown when not loading */}
                  {selectedRace && !isLoadingRaceData && (
                    <RaceHistoryCard race={selectedRace} key={selectedRaceId} />
                  )}

                  {/* Placeholder when no race selected */}
                  {!selectedRace && (
                    <Alert variant="info">
                      {t("raceResults.chooseRace")}
                    </Alert>
                  )}
                </>
              ) : (
                <Alert variant="info">{t("history.noRaces")}</Alert>
              )}
            </>
          )}

          {/* ============ TAB CAMPIONATO ============ */}
          {activeTab === "championship" && hasChampionship && (
            <>
              {/* Risultati Ufficiali */}
              <Row className="mb-4">
                <Col xs={12} md={6}>
                  <h6 className="fw-bold border-bottom pb-2" style={{ color: accentColor }}>
                    {t("history.topDrivers")}
                  </h6>
                  <Table size="sm" className="mb-0">
                    <thead>
                      <tr>
                        <th style={{ color: accentColor }}>{t("leaderboard.rank")}</th>
                        <th style={{ color: accentColor }}>{t("formations.driver")}</th>
                        <th className="text-end" style={{ color: accentColor }}>{t("common.points")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>1°</strong></td>
                        <td><DriverWithLogo name={championshipResults.P1} /></td>
                        <td className="text-end text-success fw-bold">{POINTS.MAIN[1]}</td>
                      </tr>
                      <tr>
                        <td>2°</td>
                        <td><DriverWithLogo name={championshipResults.P2} /></td>
                        <td className="text-end text-success fw-bold">{POINTS.MAIN[2]}</td>
                      </tr>
                      <tr>
                        <td>3°</td>
                        <td><DriverWithLogo name={championshipResults.P3} /></td>
                        <td className="text-end text-success fw-bold">{POINTS.MAIN[3]}</td>
                      </tr>
                    </tbody>
                  </Table>
                </Col>

                <Col xs={12} md={6}>
                  <h6 className="fw-bold border-bottom pb-2 mt-3 mt-md-0" style={{ color: accentColor }}>
                    {t("history.topConstructors")}
                  </h6>
                  <Table size="sm" className="mb-0">
                    <thead>
                      <tr>
                        <th style={{ color: accentColor }}>{t("leaderboard.rank")}</th>
                        <th style={{ color: accentColor }}>{t("history.team")}</th>
                        <th className="text-end" style={{ color: accentColor }}>{t("common.points")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>1°</strong></td>
                        <td><TeamWithLogo name={championshipResults.C1} /></td>
                        <td className="text-end text-success fw-bold">{POINTS.MAIN[1]}</td>
                      </tr>
                      <tr>
                        <td>2°</td>
                        <td><TeamWithLogo name={championshipResults.C2} /></td>
                        <td className="text-end text-success fw-bold">{POINTS.MAIN[2]}</td>
                      </tr>
                      <tr>
                        <td>3°</td>
                        <td><TeamWithLogo name={championshipResults.C3} /></td>
                        <td className="text-end text-success fw-bold">{POINTS.MAIN[3]}</td>
                      </tr>
                    </tbody>
                  </Table>
                </Col>
              </Row>

              {/* Formazioni e Punteggi Giocatori */}
              {championshipSubmissions.length > 0 && (
                <>
                  <h6 className="fw-bold mb-3 mt-4" style={{ color: accentColor }}>
                    {t("history.formationsAndPoints")}
                  </h6>

                  {/* Desktop View */}
                  <div className="d-none d-lg-block table-responsive">
                    <Table striped bordered hover size="sm" className="align-middle">
                      <thead>
                        <tr>
                          <th style={{ color: accentColor }}>{t("history.player")}</th>
                          <th style={{ color: accentColor }}>P1</th>
                          <th style={{ color: accentColor }}>P2</th>
                          <th style={{ color: accentColor }}>P3</th>
                          <th className="text-center" style={{ color: accentColor }}>{t("history.totalDrivers")}</th>
                          <th style={{ color: accentColor }}>C1</th>
                          <th style={{ color: accentColor }}>C2</th>
                          <th style={{ color: accentColor }}>C3</th>
                          <th className="text-center" style={{ color: accentColor }}>{t("history.totalConstructors")}</th>
                          <th className="text-center" style={{ color: accentColor }}>{t("history.total")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {championshipSubmissions.map((sub) => {
                          const pts = calculateChampionshipPoints(sub, championshipResults);
                          return (
                            <tr key={sub.userId}>
                              <td className="fw-bold">{sub.name}</td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <DriverWithLogo name={sub.piloti[0]} />
                                  <PointsBadge
                                    pts={sub.piloti[0] === championshipResults.P1 ? POINTS.MAIN[1] : 0}
                                    pill
                                  />
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <DriverWithLogo name={sub.piloti[1]} />
                                  <PointsBadge
                                    pts={sub.piloti[1] === championshipResults.P2 ? POINTS.MAIN[2] : 0}
                                    pill
                                  />
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <DriverWithLogo name={sub.piloti[2]} />
                                  <PointsBadge
                                    pts={sub.piloti[2] === championshipResults.P3 ? POINTS.MAIN[3] : 0}
                                    pill
                                  />
                                </div>
                              </td>
                              <td className="text-center">
                                <PointsBadge pts={pts.pilotiPts} pill />
                              </td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <TeamWithLogo name={sub.costruttori[0]} />
                                  <PointsBadge
                                    pts={sub.costruttori[0] === championshipResults.C1 ? POINTS.MAIN[1] : 0}
                                    pill
                                  />
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <TeamWithLogo name={sub.costruttori[1]} />
                                  <PointsBadge
                                    pts={sub.costruttori[1] === championshipResults.C2 ? POINTS.MAIN[2] : 0}
                                    pill
                                  />
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <TeamWithLogo name={sub.costruttori[2]} />
                                  <PointsBadge
                                    pts={sub.costruttori[2] === championshipResults.C3 ? POINTS.MAIN[3] : 0}
                                    pill
                                  />
                                </div>
                              </td>
                              <td className="text-center">
                                <PointsBadge pts={pts.costruttoriPts} pill />
                              </td>
                              <td className="text-center">
                                <PointsBadge pts={pts.total} pill style={{ fontSize: "1rem" }} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>

                  {/* Mobile View - Cards */}
                  <div className="d-lg-none">
                    {championshipSubmissions.map((sub) => {
                      const pts = calculateChampionshipPoints(sub, championshipResults);
                      return (
                        <Card
                          key={sub.userId}
                          className="mb-3"
                          style={{ borderLeft: `3px solid ${accentColor}` }}
                        >
                          <Card.Body>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                              <h6 className="mb-0 fw-bold" style={{ color: accentColor }}>
                                {sub.name}
                              </h6>
                              <PointsBadge
                                pts={pts.total}
                                style={{ fontSize: "1rem" }}
                              />
                            </div>

                            {/* Piloti */}
                            <div className="mb-3">
                              <strong className="text-muted" style={{ fontSize: "0.85rem" }}>
                                {t("history.drivers").toUpperCase()}
                                <PointsBadge pts={pts.pilotiPts} className="ms-2" />
                              </strong>
                              <div className="mt-2">
                                {sub.piloti.map((pilot, idx) => (
                                  <div key={idx} className="d-flex justify-content-between align-items-center py-1 border-bottom">
                                    <span className="text-muted">{idx + 1}°</span>
                                    <div className="d-flex align-items-center gap-2">
                                      <DriverWithLogo name={pilot} />
                                      <PointsBadge
                                        pts={pilot === championshipResults[`P${idx + 1}`] ? POINTS.MAIN[idx + 1] : 0}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Costruttori */}
                            <div>
                              <strong className="text-muted" style={{ fontSize: "0.85rem" }}>
                                {t("history.constructors").toUpperCase()}
                                <PointsBadge pts={pts.costruttoriPts} className="ms-2" />
                              </strong>
                              <div className="mt-2">
                                {sub.costruttori.map((team, idx) => (
                                  <div key={idx} className="d-flex justify-content-between align-items-center py-1 border-bottom">
                                    <span className="text-muted">{idx + 1}°</span>
                                    <div className="d-flex align-items-center gap-2">
                                      <TeamWithLogo name={team} />
                                      <PointsBadge
                                        pts={team === championshipResults[`C${idx + 1}`] ? POINTS.MAIN[idx + 1] : 0}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </Card.Body>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}

              {championshipSubmissions.length === 0 && (
                <Alert variant="info">{t("history.noChampionship")}</Alert>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}
