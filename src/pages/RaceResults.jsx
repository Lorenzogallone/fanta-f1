/**
 * @file RaceResults.jsx
 * @description Page displaying F1 session results (Qualifying, Sprint, Race)
 * Smart loading: shows only last race by default, expandable sessions
 */

import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { Row, Col, Form, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import { fetchLastRaceSessions } from "../services/f1SessionsFetcher";
import { peek, loadRaces, loadSessions, loadStandings, sessionsKey } from "../services/warmup";
import { useF1Data } from "../hooks/useF1Data";
import { useLanguage } from "../hooks/useLanguage";
import { useTimezone } from "../hooks/useTimezone";
import { getTimezoneDisplay } from "../utils/timezoneUtils";
import { log, error as logError } from "../utils/logger";
import { useRacePhoto } from "../hooks/useRacePhoto";
import "../styles/cards.css";
import "../styles/results.css";
import "../styles/racephoto.css";
import LogoLoader from "../components/LogoLoader";

/**
 * Component to display driver with team logo
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
          alt={`${team} team logo`}
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
 * Component to display team with logo
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
          alt={`${name} team logo`}
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

/** The race closest to today: the one the page opens on */
const closestRace = (list) => {
  const now = Date.now();
  return list.reduce((best, r) =>
    !best || Math.abs(r.raceUTC.toMillis() - now) < Math.abs(best.raceUTC.toMillis() - now) ? r : best, null);
};

/** Default open panel: the latest session that has data */
const defaultKeys = (sessionData) => {
  if (sessionData.hasRace) return ["race"];
  if (sessionData.hasSprint) return ["sprint"];
  if (sessionData.hasSprintQualifying) return ["sprintQualifying"];
  if (sessionData.hasQualifying) return ["qualifying"];
  return [];
};

/**
 * RaceResults page component
 */
export default function RaceResults() {
  const { t, currentLanguage } = useLanguage();
  const { timezone } = useTimezone();
  const navigate = useNavigate();

  // Calendar, the race closest to today and its sessions come from the warm-up
  // cache when present: the page opens with its content at first render
  const [initial] = useState(() => {
    const list = [...(peek("races") || [])].reverse();
    const race = closestRace(list);
    const sessionData = race ? peek(sessionsKey(race)) : undefined;
    return { list, race, sessionData };
  });
  const [races, setRaces] = useState(initial.list);
  const [selectedRaceId, setSelectedRaceId] = useState(initial.race?.id ?? null);
  const [selectedRace, setSelectedRace] = useState(initial.race);
  const [sessions, setSessions] = useState(() => {
    const { race, sessionData } = initial;
    if (!race || !sessionData) return null;
    const season = race.raceUTC.toDate().getFullYear();
    return {
      raceName: race.name,
      date: race.raceUTC.toDate().toLocaleDateString(
        currentLanguage === "it" ? "it-IT" : "en-US", { timeZone: timezone }),
      season,
      round: race.round,
      noData: !(sessionData.hasQualifying || sessionData.hasSprint || sessionData.hasRace),
      ...sessionData,
    };
  });
  const [loadingRaces, setLoadingRaces] = useState(!initial.list.length);
  const [loadingSessions, setLoadingSessions] = useState(Boolean(initial.race) && !initial.sessionData);
  const [error, setError] = useState(null);
  const [activeKeys, setActiveKeys] = useState(() => (initial.sessionData ? defaultKeys(initial.sessionData) : []));
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
  const [showPastRaces, setShowPastRaces] = useState(false);


  const locale = currentLanguage === "it" ? "it-IT" : "en-US";

  /**
   * Format a Firestore timestamp to date/time components in user's timezone
   */
  const formatToUserTz = (timestamp) => {
    if (!timestamp) return null;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return {
      dayOfWeek: date.toLocaleDateString(locale, { weekday: "short", timeZone: timezone }),
      dateStr: date.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: timezone }),
      time: date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: timezone }),
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
      mainOpen: !race.cancelledMain && qualiMs > now,
      sprintOpen: !race.cancelledSprint && sprintMs > now,
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

  const nextRacePhoto = useRacePhoto(scheduleData.nextRace);

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
          <LogoLoader label={t("common.loading")} />
        </div>
      );
    }

    // Render the results list
    return (
      <div className="res-rows">
        {data.map((result, idx) => (
          <div key={idx} className="res-row">
            <span className={`res-pos${idx < 3 ? " is-top" : ""}`}>{result.position}</span>
            <span className="res-name">
              <DriverWithLogo name={result.driver} />
              {result.fastestLap && <span className="res-fl">{result.fastestLap}</span>}
            </span>
            <span className="res-gap">{result.gap}</span>
          </div>
        ))}
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
          <LogoLoader label={t("common.loading")} />
        </div>
      );
    }

    // Render qualifying list with the Q session reached
    return (
      <div className="res-rows">
        {data.map((result, idx) => {
          const pos = parseInt(result.position);
          const qSession = pos <= 10 ? "Q3" : pos <= 15 ? "Q2" : "Q1";
          return (
            <div key={idx} className="res-row">
              <span className={`res-pos${idx < 3 ? " is-top" : ""}`}>{result.position}</span>
              <span className="res-name"><DriverWithLogo name={result.driver} /></span>
              <span className="res-gap">{result.gap}</span>
              <span className={`res-q is-${qSession.toLowerCase()}`}>{qSession}</span>
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * Load all races from Firestore and last race sessions progressively
   */
  useEffect(() => {
    // Load races list first (fast)
    const loadCalendar = async () => {
      try {
        // Calendar from the warm-up cache (by date descending), refreshed in the background
        const raceList = [...(await loadRaces(true))].reverse();
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
          // Sessions prefetched by the warm-up open at once; otherwise show the loader
          if (!peek(sessionsKey(selectedRaceToLoad))) setLoadingSessions(true);

          const season = selectedRaceToLoad.raceUTC.toDate().getFullYear();
          const round = selectedRaceToLoad.round;

          try {
            const sessionData = await loadSessions(selectedRaceToLoad);
            const hasAnySession = sessionData.hasQualifying || sessionData.hasSprint || sessionData.hasRace;

            setSessions({
              raceName: selectedRaceToLoad.name,
              date: selectedRaceToLoad.raceUTC.toDate().toLocaleDateString(locale, { timeZone: timezone }),
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

            setActiveKeys(defaultKeys(sessionData));

            // Check if user can still submit formation for the initial race
            setSubmissionStatus(computeSubmissionStatus(selectedRaceToLoad));

            setLoadingSessions(false); // Sessions loaded
          } catch (err) {
            logError("Error loading race sessions:", err);
            setLoadingSessions(false); // Stop loading even on error
          }
        }
      } catch (e) {
        logError("Error loading races:", e);
        setError(t("errors.generic"));
        setLoadingRaces(false);
        setLoadingSessions(false);
      }
    };

    loadCalendar();
  }, [t]);

  /**
   * Load standings when standings tab becomes active
   */
  useEffect(() => {
    if (activeTab === "standings" && !driverStandings && !constructorStandings) {
      (async () => {
        setLoadingStandings(true);
        try {
          const { drivers, constructors } = await loadStandings();
          setDriverStandings(drivers);
          setConstructorStandings(constructors);
        } catch (err) {
          logError("Error loading standings:", err);
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
          date: race.raceUTC.toDate().toLocaleDateString(locale, { timeZone: timezone }),
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

      const sessionData = await loadSessions(race);

      const hasAnySession = sessionData.hasQualifying || sessionData.hasSprint || sessionData.hasRace;

      // Cache the sessions
      setSessionsCache(prev => ({
        ...prev,
        [cacheKey]: sessionData
      }));

      setSessions({
        raceName: race.name,
        date: race.raceUTC.toDate().toLocaleDateString(locale, { timeZone: timezone }),
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
      logError("Error loading sessions:", e);
      setError(t("errors.generic"));
    } finally {
      setLoadingSessions(false);
    }
  };

  // Show loading only while loading races list
  if (loadingRaces) {
    return (
      <div className="py-5 text-center">
        <LogoLoader label={t("common.loading")} />
      </div>
    );
  }

  const tabs = [
    { key: "results", label: t("raceResults.sessionsTab") },
    { key: "standings", label: t("raceResults.championshipTab") },
    { key: "schedule", label: t("raceResults.scheduleTab") },
  ];

  // Collapsible session (replaces the accordion, same activeKeys state)
  const toggleSession = (key) =>
    setActiveKeys((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));

  const SessionBlock = ({ sessionKey, title, children }) => {
    const open = activeKeys.includes(sessionKey);
    return (
      <div className={`res-session${open ? " is-open" : ""}`}>
        <button type="button" className="res-session-head" aria-expanded={open} onClick={() => toggleSession(sessionKey)}>
          <span>{title}</span>
          <span className="res-chevron" aria-hidden="true">›</span>
        </button>
        {open && <div className="res-session-body">{children}</div>}
      </div>
    );
  };

  const StandingsList = ({ title, rows, kind }) => (
    <div className="fx-card res-card">
      <h2 className="fx-card-title res-card-title">{title}</h2>
      {rows && rows.length > 0 ? (
        <div className="res-rows">
          <div className="res-row res-row-head">
            <span className="res-pos">#</span>
            <span className="res-name">{kind === "driver" ? t("formations.driver") : "Team"}</span>
            <span className="res-wins d-none d-md-inline">Win</span>
            <span className="res-pts">Pt</span>
          </div>
          {rows
            .slice(0, standingsFilter === "5" ? 5 : standingsFilter === "10" ? 10 : rows.length)
            .map((s, idx) => (
              <div key={idx} className="res-row">
                <span className={`res-pos${idx < 3 ? " is-top" : ""}`}>{s.position}</span>
                <span className="res-name">
                  {kind === "driver" ? <DriverWithLogo name={s.driver} /> : <TeamWithLogo name={s.constructor} />}
                </span>
                <span className="res-wins d-none d-md-inline">{s.wins}</span>
                <span className="res-pts">{s.points}</span>
              </div>
            ))}
        </div>
      ) : (
        <div className="res-empty">
          {kind === "driver" ? t("raceResults.driverStandingsUnavailable") : t("raceResults.constructorStandingsUnavailable")}
        </div>
      )}
    </div>
  );

  // Sessions of a weekend, in order, for the calendar
  const weekendSessions = (race) => {
    const rows = [];
    if (race.qualiSprintUTC) {
      const sq = formatToUserTz(race.qualiSprintUTC);
      if (sq) rows.push({ label: t("raceResults.sprintQualifying"), ...sq });
      const sp = formatToUserTz(race.sprintUTC);
      if (sp) rows.push({ label: t("raceResults.sprint"), ...sp });
    }
    const q = formatToUserTz(race.qualiUTC);
    if (q) rows.push({ label: t("raceResults.qualifying"), ...q });
    const r = formatToUserTz(race.raceUTC);
    if (r) rows.push({ label: t("raceResults.race"), ...r, isRace: true });
    return rows;
  };

  return (
    <div className="fx results-page">
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

      {/* ============ SESSIONS ============ */}
      {activeTab === "results" && (
        <div className="res-narrow">
          <div className="res-picker">
            <label className="fx-eyebrow" htmlFor="res-race-select">{t("raceResults.selectRace")}</label>
            <Form.Select
              id="res-race-select"
              className="res-select"
              value={selectedRaceId || ""}
              onChange={(e) => handleRaceChange(e.target.value)}
              aria-label="Select race to view session results"
            >
              <option value="">{t("raceResults.chooseRace")}</option>
              {races.map((race) => (
                <option key={race.id} value={race.id}>
                  {race.round}. {race.name}
                  {race.cancelledMain ? ` ⛔` : ""}
                </option>
              ))}
            </Form.Select>
          </div>

          {/* Cancelled race alert */}
          {selectedRace?.cancelledMain && (
            <div className="res-note is-danger">
              <strong>{t("history.raceCancelled")}</strong> — {t("history.raceCancelledDescription")}
            </div>
          )}

          {/* Lineups still open for this race */}
          {selectedRace && (submissionStatus.mainOpen || submissionStatus.sprintOpen) && (
            <div className="fx-card res-cta">
              <div className="min-w-0">
                <div className="res-cta-title">{t("raceResults.canStillSubmit")}</div>
                {submissionStatus.sprintOpen && selectedRace.qualiSprintUTC && (
                  <div className="res-cta-text">
                    Sprint · {t("raceResults.deadlineAt")} {formatToUserTz(selectedRace.qualiSprintUTC)?.time} ({formatToUserTz(selectedRace.qualiSprintUTC)?.dateStr})
                  </div>
                )}
                {submissionStatus.mainOpen && selectedRace.qualiUTC && (
                  <div className="res-cta-text">
                    {t("raceResults.race")} · {t("raceResults.deadlineAt")} {formatToUserTz(selectedRace.qualiUTC)?.time} ({formatToUserTz(selectedRace.qualiUTC)?.dateStr})
                  </div>
                )}
              </div>
              <Button
                variant="danger"
                size="sm"
                className="res-cta-btn"
                onClick={() => navigate("/lineup")}
                aria-label="Go to formation page to submit lineup"
              >
                {t("raceResults.goToFormation")}
              </Button>
            </div>
          )}

          {/* Loading state - only when no sessions data at all */}
          {loadingSessions && !sessions && (
            <div className="text-center py-4">
              <LogoLoader label={t("common.loading")} />
            </div>
          )}

          {/* Error state */}
          {error && !sessions && <div className="res-note is-warning">{error}</div>}

          {/* Sessions */}
          {sessions && (
            <div className="fx-card res-card">
              <div className="res-card-head">
                <div className="fx-eyebrow">R{sessions.round} · {sessions.date}</div>
                <h2 className="res-race-name">{sessions.raceName}</h2>
              </div>

              {sessions.noData ? (
                <div className="res-empty">
                  <div className="fw-semibold">{t("raceResults.noResultsYet")}</div>
                  <div className="small">{t("raceResults.noResultsYetDescription")}</div>
                </div>
              ) : (
                <div className="res-sessions">
                  {sessions.hasQualifying && (
                    <SessionBlock sessionKey="qualifying" title={t("raceResults.qualifying")}>
                      {renderQualifyingBody(sessions.qualifying)}
                    </SessionBlock>
                  )}
                  {sessions.hasSprintQualifying && (
                    <SessionBlock sessionKey="sprintQualifying" title={t("raceResults.sprintQualifying")}>
                      {renderSessionBody(sessions.sprintQualifying, "sprintQualifying")}
                    </SessionBlock>
                  )}
                  {sessions.hasSprint && (
                    <SessionBlock sessionKey="sprint" title={t("raceResults.sprint")}>
                      {renderSessionBody(sessions.sprint, "sprint")}
                    </SessionBlock>
                  )}
                  {sessions.hasRace && (
                    <SessionBlock sessionKey="race" title={t("raceResults.race")}>
                      {renderSessionBody(sessions.race, "race")}
                    </SessionBlock>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ STANDINGS ============ */}
      {activeTab === "standings" && (
        loadingStandings ? (
          <div className="text-center py-5">
            <LogoLoader label={t("common.loading")} />
          </div>
        ) : (
          <>
            <div className="fx-segmented is-small mb-3" role="group" aria-label="Standings filter">
              {[
                { key: "5", label: "Top 5" },
                { key: "10", label: "Top 10" },
                { key: "all", label: t("raceResults.allFilter") },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={standingsFilter === f.key}
                  className={`fx-segment${standingsFilter === f.key ? " is-active" : ""}`}
                  onClick={() => setStandingsFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Row className="g-3 g-lg-4">
              <Col xs={12} lg={6}>
                <StandingsList title={t("raceResults.driverStandings")} rows={driverStandings} kind="driver" />
              </Col>
              <Col xs={12} lg={6}>
                <StandingsList title={t("raceResults.constructorStandings")} rows={constructorStandings} kind="team" />
              </Col>
            </Row>
          </>
        )
      )}

      {/* ============ SCHEDULE ============ */}
      {activeTab === "schedule" && (
        <div className="res-narrow">
          <p className="res-tz">{t("raceResults.allTimesIn")} {getTimezoneDisplay(timezone)}</p>

          {races.length === 0 ? (
            <div className="fx-card res-empty">{t("raceResults.noRacesScheduled")}</div>
          ) : (
            <>
              {/* Next race */}
              {scheduleData.nextRace && (() => {
                const race = scheduleData.nextRace;
                const raceDate = race.raceUTC?.toDate ? race.raceUTC.toDate() : new Date(race.raceUTC?.seconds * 1000);
                const daysUntil = Math.ceil((raceDate - new Date()) / (1000 * 60 * 60 * 24));
                const countdownText = daysUntil <= 0
                  ? t("raceResults.today")
                  : daysUntil === 1
                    ? t("raceResults.tomorrow")
                    : t("raceResults.daysUntil", { count: daysUntil });

                const photo = nextRacePhoto;

                return (
                  <div className="fx-card res-card res-next">
                    <div
                      className={`res-card-head${photo ? " has-photo" : ""}`}
                      style={photo ? { "--hero-img": `url("${photo.src}")`, "--hero-pos": photo.pos } : undefined}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <span className="fx-eyebrow">{t("raceResults.nextRace")} · R{race.round} · {countdownText}</span>
                        {race.qualiSprintUTC && <span className="res-pill">Sprint</span>}
                      </div>
                      <h2 className="res-race-name">{race.name}</h2>
                    </div>
                    <div className="res-rows">
                      {weekendSessions(race).map((s, idx) => (
                        <div key={idx} className={`res-row${s.isRace ? " is-strong" : ""}`}>
                          <span className="res-name">{s.label}</span>
                          <span className="res-when">{s.dayOfWeek} {s.dateStr}</span>
                          <span className="res-time">{s.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Other upcoming races */}
              {scheduleData.upcoming.length > 1 && (
                <>
                  <h3 className="res-section-title">
                    {t("raceResults.upcomingRaces")} <span>{scheduleData.upcoming.length - 1}</span>
                  </h3>
                  <div className="fx-card res-list">
                    {scheduleData.upcoming.slice(1).map((race) => {
                      const q = formatToUserTz(race.qualiUTC);
                      const r = formatToUserTz(race.raceUTC);
                      return (
                        <div key={race.id} className="res-list-row">
                          <span className="res-round">R{race.round}</span>
                          <span className="res-list-main">
                            <span className="res-list-name">
                              {race.name}
                              {race.qualiSprintUTC && <span className="res-pill ms-2">Sprint</span>}
                              {race.cancelledMain && <span className="res-pill is-danger ms-2">{t("history.cancelled")}</span>}
                            </span>
                            <span className="res-list-sub">
                              {q && <>{t("raceResults.qualifying")} {q.dayOfWeek} {q.dateStr} · {q.time}</>}
                            </span>
                          </span>
                          {r && (
                            <span className="res-list-date">
                              <span>{r.dayOfWeek} {r.dateStr}</span>
                              <span className="res-time">{r.time}</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Past races, collapsed */}
              {scheduleData.past.length > 0 && (
                <>
                  <button
                    type="button"
                    className="res-section-title res-section-toggle"
                    aria-expanded={showPastRaces}
                    onClick={() => setShowPastRaces((v) => !v)}
                  >
                    {t("raceResults.pastRaces")} <span>{scheduleData.past.length}</span>
                    <span className={`res-chevron${showPastRaces ? " is-open" : ""}`} aria-hidden="true">›</span>
                  </button>
                  {showPastRaces && (
                    <div className="fx-card res-list is-past">
                      {[...scheduleData.past].reverse().map((race) => {
                        const r = formatToUserTz(race.raceUTC);
                        return (
                          <div key={race.id} className="res-list-row">
                            <span className="res-round">R{race.round}</span>
                            <span className="res-list-main">
                              <span className="res-list-name">
                                {race.name}
                                {race.cancelledMain && <span className="res-pill is-danger ms-2">{t("history.cancelled")}</span>}
                              </span>
                            </span>
                            {r && <span className="res-list-date"><span>{r.dayOfWeek} {r.dateStr}</span></span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
