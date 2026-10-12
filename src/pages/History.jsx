/**
 * @file History.jsx
 * @description Historical race results and championship results page
 * Displays all completed races with results, formations, and points
 * Uses the unified RaceHistoryCard component
 * Shows championship results when available
 */

import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useLocation } from "react-router-dom";
import { Row, Col, Alert, Badge, Form } from "react-bootstrap";
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
import { POINTS } from "../constants/racing";
import { useF1Data } from "../hooks/useF1Data";
import { useLanguage } from "../hooks/useLanguage";
import { useAuth } from "../hooks/useAuth";
import { getChampionshipDeadlineMs } from "../utils/championshipDeadline";
import { error } from "../utils/logger";
import "../styles/cards.css";
import "../styles/results.css";
import LogoLoader from "../components/LogoLoader";

/**
 * Component to display driver name with team logo
 * @param {Object} props - Component props
 * @param {string} props.name - Driver name
 * @returns {JSX.Element} Driver name with team logo
 */
function DriverWithLogo({ name }) {
  const { getDriverTeam, getTeamLogo } = useF1Data();
  if (!name) return <>—</>;
  const team = getDriverTeam(name);
  const logoSrc = team ? getTeamLogo(team) : null;
  return (
    <span className="d-flex align-items-center">
      {logoSrc && (
        <img
          src={logoSrc}
          alt={team}
          loading="lazy"
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
  const { getTeamLogo } = useF1Data();
  if (!name) return <>—</>;
  const logoSrc = getTeamLogo(name);
  return (
    <span className="d-flex align-items-center">
      {logoSrc && (
        <img
          src={logoSrc}
          alt={name}
          loading="lazy"
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
  // Force white text color for visibility in both light and dark mode
  const bg = pts > 0 ? "success" : "secondary";
  return (
    <Badge bg={bg} pill={pill} className={className} style={{ color: "#ffffff", ...style }}>
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
  const location = useLocation();
  const [pastRaces, setPastRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null);
  const [championshipResults, setChampionshipResults] = useState(null);
  const [championshipSubmissions, setChampionshipSubmissions] = useState([]);
  const [loadingChampionship, setLoadingChampionship] = useState(true);
  const [isLoadingRaceData, setIsLoadingRaceData] = useState(false);
  const [activeTab, setActiveTab] = useState("races"); // "races" or "championship"
  const [openChampId, setOpenChampId] = useState(null);
  const [championshipDeadlineMs, setChampionshipDeadlineMs] = useState(null);
  const { t } = useLanguage();
  const { user } = useAuth();

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

        // If navigated with a specific raceId, select that race; otherwise select most recent
        if (races.length > 0) {
          const targetRaceId = location.state?.raceId;
          const matchedRace = targetRaceId && races.find(r => r.id === targetRaceId);
          setSelectedRaceId(matchedRace ? matchedRace.id : races[0].id);
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
        // Load championship deadline
        const deadlineMs = await getChampionshipDeadlineMs();
        setChampionshipDeadlineMs(deadlineMs);

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


  // Get selected race
  const selectedRace = pastRaces.find((r) => r.id === selectedRaceId);

  const isLastRaceSelected =
    pastRaces.length > 0 && selectedRaceId === pastRaces[0].id;

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
      <div className="py-5 text-center">
        <LogoLoader />
      </div>
    );
  if (errorState)
    return (
      <Alert variant="danger">{errorState}</Alert>
    );
  if (!pastRaces.length && !championshipResults)
    return (
      <Alert variant="info">{t("history.noRaces")}</Alert>
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
  const champDeadlinePassed = !championshipDeadlineMs || Date.now() >= championshipDeadlineMs;
  const visibleChampSubs = user?.uid && !champDeadlinePassed
    ? championshipSubmissions.filter((s) => s.userId === user.uid)
    : championshipSubmissions;

  const tabs = [
    { key: "races", label: t("history.racesTab") },
    ...(hasChampionship ? [{ key: "championship", label: t("history.championshipTab") }] : []),
  ];

  const OfficialTop3 = ({ title, entries, renderName }) => (
    <div className="fx-card res-card h-100 mb-0">
      <h2 className="fx-card-title res-card-title">{title}</h2>
      <div className="res-rows">
        {entries.map((name, idx) => (
          <div key={idx} className="res-row">
            <span className="res-pos is-top">{idx + 1}</span>
            <span className="res-name">{renderName(name)}</span>
            <span className="res-pts is-pos">{POINTS.MAIN[idx + 1]}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const PickRow = ({ pos, children, pts }) => (
    <div className="res-row">
      <span className="res-pos">{pos}°</span>
      <span className="res-name">{children}</span>
      <PointsBadge pts={pts} pill />
    </div>
  );

  return (
    <div className="fx results-page">
      {tabs.length > 1 && (
        <div className="fx-segmented mb-3" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`fx-segment${activeTab === tab.key ? " is-active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ============ RACES ============ */}
      {activeTab === "races" && (
        <div className="res-wide">
          {pastRaces.length > 0 ? (
            <>
              <div className="res-picker res-narrow">
                <label className="fx-eyebrow" htmlFor="hist-race-select">{t("raceResults.selectRace")}</label>
                <Form.Select
                  id="hist-race-select"
                  className="res-select"
                  value={selectedRaceId || ""}
                  onChange={(e) => handleRaceChange(e.target.value)}
                >
                  <option value="">{t("raceResults.chooseRace")}</option>
                  {pastRaces.map((race) => (
                    <option key={race.id} value={race.id}>
                      {race.round}. {race.name}
                      {race.cancelledMain ? ` ⛔` : race.officialResults ? ` ✓` : ""}
                    </option>
                  ))}
                </Form.Select>
              </div>

              {/* Loading state when changing races */}
              {isLoadingRaceData && selectedRace && (
                <div className="text-center py-5">
                  <LogoLoader label={t("common.loading")} />
                </div>
              )}

              {selectedRace && !isLoadingRaceData && (
                <RaceHistoryCard race={selectedRace} key={selectedRaceId} isLastRace={isLastRaceSelected} currentUserId={user?.uid} collapsible />
              )}

              {!selectedRace && <div className="fx-card res-empty">{t("raceResults.chooseRace")}</div>}
            </>
          ) : (
            <div className="fx-card res-empty">{t("history.noRaces")}</div>
          )}
        </div>
      )}

      {/* ============ CHAMPIONSHIP ============ */}
      {activeTab === "championship" && hasChampionship && (
        <div className="res-narrow">
          <Row className="g-3 mb-3">
            <Col xs={12} md={6}>
              <OfficialTop3
                title={t("history.topDrivers")}
                entries={[championshipResults.P1, championshipResults.P2, championshipResults.P3]}
                renderName={(name) => <DriverWithLogo name={name} />}
              />
            </Col>
            <Col xs={12} md={6}>
              <OfficialTop3
                title={t("history.topConstructors")}
                entries={[championshipResults.C1, championshipResults.C2, championshipResults.C3]}
                renderName={(name) => <TeamWithLogo name={name} />}
              />
            </Col>
          </Row>

          {championshipSubmissions.length === 0 ? (
            <div className="fx-card res-empty">{t("history.noChampionship")}</div>
          ) : (
            <>
              <h3 className="res-section-title">{t("history.formationsAndPoints")}</h3>

              {user?.uid && !champDeadlinePassed && (
                <div className="res-note is-warning">🔒 {t("championshipForm.othersHidden")}</div>
              )}

              {visibleChampSubs.length === 0 ? (
                <div className="fx-card res-empty">{t("history.noChampionship")}</div>
              ) : (
                <div className="fx-card res-list">
                  {visibleChampSubs.map((sub) => {
                    const pts = calculateChampionshipPoints(sub, championshipResults);
                    const open = openChampId === sub.userId;
                    return (
                      <div key={sub.userId} className={`res-session${open ? " is-open" : ""}`}>
                        <button
                          type="button"
                          className="res-session-head res-player-head"
                          aria-expanded={open}
                          onClick={() => setOpenChampId(open ? null : sub.userId)}
                        >
                          <span className="res-list-main">
                            <span className="res-list-name">{sub.name}</span>
                            <span className="res-list-sub">
                              {t("history.drivers")} {pts.pilotiPts} · {t("history.constructors")} {pts.costruttoriPts}
                            </span>
                          </span>
                          <span className={`res-pts${pts.total > 0 ? " is-pos" : ""}`}>{pts.total}</span>
                          <span className="res-chevron" aria-hidden="true">›</span>
                        </button>
                        {open && (
                          <div className="res-session-body">
                            <div className="res-sub-title">{t("history.drivers")}</div>
                            {sub.piloti.map((pilot, idx) => (
                              <PickRow
                                key={`p${idx}`}
                                pos={idx + 1}
                                pts={pilot === championshipResults[`P${idx + 1}`] ? POINTS.MAIN[idx + 1] : 0}
                              >
                                <DriverWithLogo name={pilot} />
                              </PickRow>
                            ))}
                            <div className="res-sub-title">{t("history.constructors")}</div>
                            {sub.costruttori.map((team, idx) => (
                              <PickRow
                                key={`c${idx}`}
                                pos={idx + 1}
                                pts={team === championshipResults[`C${idx + 1}`] ? POINTS.MAIN[idx + 1] : 0}
                              >
                                <TeamWithLogo name={team} />
                              </PickRow>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
