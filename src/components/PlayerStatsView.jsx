/**
 * @file PlayerStatsView.jsx
 * @description Unified player statistics view - complete player profile
 * Used in both ParticipantDetail and Statistics pages for consistent UX
 */

import React, { useState } from "react";
import PropTypes from "prop-types";
import { Row, Col, Badge } from "react-bootstrap";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { POINTS } from "../constants/racing";
import { useF1Data } from "../hooks/useF1Data";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../hooks/useLanguage";
import { computeScores, scoreTone } from "../utils/raceScores";
import UserAvatar from "./UserAvatar";
import "../styles/cards.css";
import "../styles/player.css";
import "../styles/statistics.css";
import LogoLoader from "./LogoLoader";

/**
 * Displays driver name with team logo
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
 * Displays team name with logo
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

/**
 * Custom tooltip for charts
 */
function CustomTooltip({ active, payload, label, isDark, accentColor }) {
  if (active && payload && payload.length) {
    const fullName = payload[0]?.payload?.fullName || label;
    return (
      <div
        style={{
          backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
          border: `1px solid ${accentColor}`,
          borderRadius: "4px",
          padding: "10px",
        }}
      >
        <p style={{ fontWeight: "bold", margin: 0, marginBottom: 5 }}>
          {fullName}
        </p>
        {payload.map((entry, index) => (
          <p
            key={index}
            style={{
              color: entry.color,
              margin: 0,
              fontSize: "0.9rem",
            }}
          >
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.object),
  label: PropTypes.string,
  isDark: PropTypes.bool.isRequired,
  accentColor: PropTypes.string.isRequired,
};

/**
 * Calculate points for a race submission
 */
const calculateRacePoints = (submission, official, cancelledSprint = false) => {
  if (!official) {
    return { mainPoints: null, sprintPoints: null, total: 0 };
  }

  // If no submission at all, mark as not submitted
  if (!submission) {
    const mainPoints = -3;
    const sprintPoints = official.SP1 && !cancelledSprint ? -3 : null;
    return {
      mainPoints,
      sprintPoints,
      total: mainPoints + (sprintPoints || 0)
    };
  }

  // Calculate main race points
  let mainPoints = 0;
  if (!submission.mainP1 && !submission.mainP2 && !submission.mainP3) {
    mainPoints = -3; // Not submitted
  } else {
    // Base position points
    let basePoints = 0;
    if (submission.mainP1 === official.P1) basePoints += POINTS.MAIN[1];
    if (submission.mainP2 === official.P2) basePoints += POINTS.MAIN[2];
    if (submission.mainP3 === official.P3) basePoints += POINTS.MAIN[3];

    // Perfect podium bonus: 29 → 30
    if (basePoints === 29) basePoints = 30;

    mainPoints = basePoints;

    // Joker 1 bonus
    if (submission.mainJolly && [official.P1, official.P2, official.P3].includes(submission.mainJolly)) {
      mainPoints += POINTS.BONUS_JOLLY_MAIN;
    }

    // Joker 2 bonus
    if (submission.mainJolly2 && [official.P1, official.P2, official.P3].includes(submission.mainJolly2)) {
      mainPoints += POINTS.BONUS_JOLLY_MAIN;
    }

    // Late submission penalty
    if (submission.isLate) {
      mainPoints += (submission.latePenalty || -3);
    }
  }

  // Calculate sprint points if present and not cancelled
  let sprintPoints = null;
  if (official.SP1 && !cancelledSprint) {
    if (!submission.sprintP1 && !submission.sprintP2 && !submission.sprintP3) {
      sprintPoints = -3; // Not submitted
    } else {
      sprintPoints = 0;
      if (submission.sprintP1 === official.SP1) sprintPoints += POINTS.SPRINT[1];
      if (submission.sprintP2 === official.SP2) sprintPoints += POINTS.SPRINT[2];
      if (submission.sprintP3 === official.SP3) sprintPoints += POINTS.SPRINT[3];

      // Sprint joker bonus
      if (submission.sprintJolly && [official.SP1, official.SP2, official.SP3].includes(submission.sprintJolly)) {
        sprintPoints += POINTS.BONUS_JOLLY_SPRINT;
      }
    }

    // Late submission penalty for the sprint lineup
    if (submission.isLateSprint) {
      sprintPoints += (submission.latePenaltySprint || -3);
    }
  }

  // Double points (e.g. final race)
  if (official.doublePoints) {
    mainPoints *= 2;
    if (sprintPoints !== null) sprintPoints *= 2;
  }

  const total = mainPoints + (sprintPoints || 0);
  return { mainPoints, sprintPoints, total };
};

/**
 * Points for a race: prefers the values stored by the points calculator
 * (ranking.pointsByRace, the source of the leaderboard total) and falls back
 * to computing them from the submission.
 */
const getRacePoints = (race, pointsByRace) => {
  const stored = pointsByRace?.[race.raceId];
  if (stored) {
    const hasSprint = !!race.officialResults?.SP1 && !race.cancelledSprint;
    const mainPoints = stored.mainPts || 0;
    const sprintPoints = hasSprint ? stored.sprintPts || 0 : null;
    return { mainPoints, sprintPoints, total: mainPoints + (stored.sprintPts || 0) };
  }
  return calculateRacePoints(race.submission, race.officialResults, race.cancelledSprint);
};

/**
 * Signed points text: +12, -3, 0, or "—" when missing.
 */
const signed = (v) => (v === null || v === undefined ? "—" : v > 0 ? `+${v}` : `${v}`);
const toneClass = (v) => (v > 0 ? "is-pos" : v < 0 ? "is-neg" : "");

/**
 * One pick inside an expanded race: label, driver and points.
 */
function PickRow({ label, pick, pts, show }) {
  return (
    <div className="player-pick">
      <span className="player-pick-label">{label}</span>
      <span className="player-pick-driver">
        <DriverWithLogo name={pick} />
      </span>
      {show && pick && (
        <Badge bg={scoreTone(pts)} pill className="player-pick-pts">{pts}</Badge>
      )}
    </div>
  );
}

PickRow.propTypes = {
  label: PropTypes.string.isRequired,
  pick: PropTypes.string,
  pts: PropTypes.number,
  show: PropTypes.bool,
};

/**
 * Expanded race: the player's picks with the points each one earned.
 */
function RaceDetail({ race, points }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const s = race.submission;
  const official = race.officialResults;
  const multiplier = official?.doublePoints ? 2 : 1;
  const sprintScored = Boolean(official?.SP1) && !race.cancelledSprint;
  const score = s && official ? computeScores(s, official, multiplier, sprintScored) : null;
  const hasSprintPicks = Boolean(s?.sprintP1 || s?.sprintP2 || s?.sprintP3 || s?.sprintJolly);

  return (
    <div className="player-race-detail">
      {!s ? (
        <div className="player-race-empty">{t("participantDetail.noLineup")}</div>
      ) : (
        <div className="player-race-sections">
          <div>
            <div className="player-section-title">
              <span>{t("calculate.mainRace")}</span>
              <span className={`player-section-pts ${toneClass(points.mainPoints)}`}>{signed(points.mainPoints)}</span>
            </div>
            <PickRow label="P1" pick={s.mainP1} pts={score?.main.P1} show={Boolean(score)} />
            <PickRow label="P2" pick={s.mainP2} pts={score?.main.P2} show={Boolean(score)} />
            <PickRow label="P3" pick={s.mainP3} pts={score?.main.P3} show={Boolean(score)} />
            <PickRow label="J1" pick={s.mainJolly} pts={score?.main.J1} show={Boolean(score)} />
            {s.mainJolly2 && <PickRow label="J2" pick={s.mainJolly2} pts={score?.main.J2} show={Boolean(score)} />}
          </div>
          {(points.sprintPoints !== null || hasSprintPicks) && (
            <div>
              <div className="player-section-title">
                <span>Sprint</span>
                <span className={`player-section-pts ${toneClass(points.sprintPoints)}`}>{signed(points.sprintPoints)}</span>
              </div>
              <PickRow label="SP1" pick={s.sprintP1} pts={score?.sprint.SP1} show={sprintScored} />
              <PickRow label="SP2" pick={s.sprintP2} pts={score?.sprint.SP2} show={sprintScored} />
              <PickRow label="SP3" pick={s.sprintP3} pts={score?.sprint.SP3} show={sprintScored} />
              <PickRow label="J SP" pick={s.sprintJolly} pts={score?.sprint.J} show={sprintScored} />
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        className="player-race-link"
        onClick={() => navigate("/history", { state: { raceId: race.raceId } })}
      >
        {t("participantDetail.allLineups")} ›
      </button>
    </div>
  );
}

RaceDetail.propTypes = {
  race: PropTypes.object.isRequired,
  points: PropTypes.object.isRequired,
};

/**
 * Races tab: one row per GP (main · sprint · total), tap to expand the picks.
 */
function RacesList({ raceHistory, pointsByRace }) {
  const { t } = useLanguage();
  const [openId, setOpenId] = useState(null);

  if (!raceHistory.length) {
    return <div className="fx-card player-empty">{t("participantDetail.noRaces")}</div>;
  }

  return (
    <div className="fx-card player-races">
      {[...raceHistory]
        .sort((a, b) => b.round - a.round)
        .map((race) => {
          const points = getRacePoints(race, pointsByRace);
          const open = openId === race.raceId;
          return (
            <div key={race.raceId} className={`player-race${open ? " is-open" : ""}`}>
              <button
                type="button"
                className="player-race-row"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : race.raceId)}
              >
                <span className="player-race-round">R{race.round}</span>
                <span className="player-race-name">
                  {race.raceName}
                  <span className="player-race-split">
                    {!race.submission
                      ? t("participantDetail.noLineup")
                      : points.sprintPoints !== null
                        ? `${t("history.scoreMain")} ${signed(points.mainPoints)} · Sprint ${signed(points.sprintPoints)}`
                        : `${t("history.scoreMain")} ${signed(points.mainPoints)}`}
                  </span>
                </span>
                <span className={`player-race-total ${toneClass(points.total)}`}>{signed(points.total)}</span>
                <span className="player-race-chevron" aria-hidden="true">›</span>
              </button>
              {open && <RaceDetail race={race} points={points} />}
            </div>
          );
        })}
    </div>
  );
}

RacesList.propTypes = {
  raceHistory: PropTypes.array.isRequired,
  pointsByRace: PropTypes.object,
};

/**
 * Championship tab: top 3 drivers and constructors picked by the player.
 */
function ChampionshipPicks({ playerData }) {
  const { t } = useLanguage();
  if (playerData.championshipPiloti?.length !== 3) {
    return <div className="fx-card player-empty">{t("participantDetail.noChampionship")}</div>;
  }
  return (
    <div className="fx-card player-champ">
      <div className="player-section-title">
        <span>{t("history.drivers")}</span>
        {playerData.championshipPts > 0 && (
          <span className="player-section-pts is-pos">+{playerData.championshipPts}</span>
        )}
      </div>
      {playerData.championshipPiloti.map((driver, idx) => (
        <div key={driver} className="player-pick">
          <span className="player-pick-label">{idx + 1}°</span>
          <span className="player-pick-driver"><DriverWithLogo name={driver} /></span>
        </div>
      ))}
      {playerData.championshipCostruttori?.length === 3 && (
        <>
          <div className="player-section-title mt-3">
            <span>{t("history.constructors")}</span>
          </div>
          {playerData.championshipCostruttori.map((team, idx) => (
            <div key={team} className="player-pick">
              <span className="player-pick-label">{idx + 1}°</span>
              <span className="player-pick-driver"><TeamWithLogo name={team} /></span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

ChampionshipPicks.propTypes = {
  playerData: PropTypes.object.isRequired,
};

/**
 * Tooltip for the points-per-race chart: total with the main / sprint split.
 */
function PointsTooltip({ active, payload }) {
  const { t } = useLanguage();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="player-chart-tooltip">
      <div className="fw-semibold">{d.fullName}</div>
      <div>{t("history.total")}: {signed(d.total)}</div>
      <div className="text-muted small">
        {t("history.scoreMain")} {signed(d.main)}{d.sprint !== null ? ` · Sprint ${signed(d.sprint)}` : ""}
      </div>
    </div>
  );
}

PointsTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
};

/**
 * Trend tab: points per race and position in the standings.
 */
function TrendCharts({ raceHistory, pointsByRace, positionData }) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const textColor = isDark ? "#adb5bd" : "#6c757d";
  const gridColor = isDark ? "#3a3a3a" : "#e9ecef";

  const pointsData = [...raceHistory]
    .sort((a, b) => a.round - b.round)
    .map((race) => {
      const p = getRacePoints(race, pointsByRace);
      return { name: `R${race.round}`, fullName: race.raceName, total: p.total, main: p.mainPoints, sprint: p.sprintPoints };
    });

  return (
    <div className="d-flex flex-column gap-3">
      {pointsData.length > 0 && (
        <div className="fx-card player-chart">
          <h3 className="fx-card-title">{t("participantDetail.pointsPerRace")}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pointsData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={gridColor} />
              <XAxis dataKey="name" stroke={textColor} tickLine={false} axisLine={false} style={{ fontSize: "0.72rem" }} />
              <YAxis stroke={textColor} tickLine={false} axisLine={false} allowDecimals={false} style={{ fontSize: "0.72rem" }} />
              <ReferenceLine y={0} stroke={textColor} strokeOpacity={0.5} />
              <Tooltip content={<PointsTooltip />} cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="total" fill={accentColor} maxBarSize={24} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {positionData.length > 0 && (
        <div className="fx-card player-chart">
          <h3 className="fx-card-title">{t("statistics.positionPerRace")}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={positionData.map((d) => ({
                name: d.label || `R${d.round}`,
                fullName: d.name,
                position: d.position,
              }))}
              margin={{ top: 12, right: 12, left: -18, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke={gridColor} />
              <XAxis dataKey="name" stroke={textColor} tickLine={false} axisLine={false} style={{ fontSize: "0.72rem" }} />
              <YAxis stroke={textColor} tickLine={false} axisLine={false} reversed allowDecimals={false} domain={[1, "dataMax"]} style={{ fontSize: "0.72rem" }} />
              <Tooltip content={(props) => <CustomTooltip {...props} isDark={isDark} accentColor={accentColor} />} />
              <Line
                type="monotone"
                dataKey="position"
                name={t("statistics.position")}
                stroke={accentColor}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, fill: isDark ? "#2d2d2d" : "#ffffff" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!pointsData.length && !positionData.length && (
        <div className="fx-card player-empty">{t("participantDetail.noRaces")}</div>
      )}
    </div>
  );
}

TrendCharts.propTypes = {
  raceHistory: PropTypes.array.isRequired,
  pointsByRace: PropTypes.object,
  positionData: PropTypes.array.isRequired,
};

/**
 * Unified player statistics view component
 * @param {Object} props
 * @param {Object} props.playerData - Player data with all info
 * @param {Array} props.raceHistory - Array of race history with submissions
 * @param {number} props.totalCompletedRaces - Total number of completed races
 * @param {boolean} props.showCharts - Whether the trend data is ready
 * @param {boolean} props.showBackButton - Whether to show back button
 * @param {boolean} props.loadingHistory - Whether the race history is still loading
 * @param {string} [props.firstName] - Player's first name
 * @param {string} [props.lastName] - Player's last name
 * @param {string} [props.photoURL] - Player's profile photo URL
 * @param {Object} [props.pointsByRace] - Stored per-race points (ranking.pointsByRace)
 * @returns {JSX.Element}
 */
function PlayerStatsView({
  playerData,
  raceHistory = [],
  totalCompletedRaces = 0,
  showCharts = true,
  showBackButton = false,
  loadingHistory = false,
  firstName,
  lastName,
  photoURL,
  positionData = [], // [{ round, name, position }] — championship position per race
  pointsByRace = null, // ranking.pointsByRace — authoritative per-race points
  accountPanel = null, // own page only: account/settings tab content
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [tab, setTab] = useState("races");

  const lineups = raceHistory.filter((race) => race.submission !== null).length;
  const averagePoints = lineups > 0 ? (playerData.totalPoints / lineups).toFixed(1) : "0.0";
  const fullName = firstName && lastName ? `${firstName} ${lastName}` : null;

  const tabs = [
    { key: "races", label: t("participantDetail.racesTab") },
    { key: "championship", label: t("participantDetail.championshipTab") },
    { key: "trend", label: t("participantDetail.trendTab") },
    ...(accountPanel ? [{ key: "account", label: t("participantDetail.accountTab") }] : []),
  ];

  // Back to the previous page, or Home when the page was opened directly
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/"));

  return (
    <div className="fx player-view">

      <Row className="g-3 g-lg-4">
        {/* Profile summary (sticky on desktop) */}
        <Col xs={12} lg={4}>
          <div className="fx-card player-profile">
            <div className="d-flex align-items-center gap-3">
              {showBackButton && (
                <button type="button" className="player-back" onClick={goBack} aria-label={t("common.back")}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
              )}
              <UserAvatar photoURL={photoURL} name={playerData.name} size={56} />
              <div className="min-w-0">
                <h1 className="player-name">{playerData.name}</h1>
                {fullName && <div className="player-fullname">{fullName}</div>}
              </div>
            </div>

            <div className="player-headline">
              {playerData.position && (
                <div>
                  <span className="player-headline-value">{playerData.position}°</span>
                  <span className="fx-eyebrow">{t("statistics.position")}</span>
                </div>
              )}
              <div>
                <span className="player-headline-value is-accent">{playerData.totalPoints}</span>
                <span className="fx-eyebrow">{t("common.points")}</span>
              </div>
            </div>

            <div className="player-chips">
              <span className="player-chip">
                <strong>{playerData.jolly ?? 0}</strong> {t("leaderboard.jokers")}
              </span>
              <span className="player-chip">
                <strong>{loadingHistory ? "…" : `${lineups}/${totalCompletedRaces}`}</strong> {t("participantDetail.lineupsShort")}
              </span>
              <span className="player-chip">
                <strong>{loadingHistory ? "…" : averagePoints}</strong> {t("participantDetail.averageShort")}
              </span>
            </div>
          </div>
        </Col>

        <Col xs={12} lg={8}>
          <div className={`player-tabs${tabs.length > 3 ? " is-compact" : ""}`} role="tablist">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                type="button"
                role="tab"
                aria-selected={tab === tb.key}
                className={`player-tab${tab === tb.key ? " is-active" : ""}`}
                onClick={() => setTab(tb.key)}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {tab === "account" ? (
            accountPanel
          ) : tab === "championship" ? (
            <ChampionshipPicks playerData={playerData} />
          ) : loadingHistory ? (
            <div className="fx-card player-empty">
              <LogoLoader size="sm" className="me-2" />
              {t("participantDetail.loadingHistory")}
            </div>
          ) : tab === "races" ? (
            <RacesList raceHistory={raceHistory} pointsByRace={pointsByRace} />
          ) : showCharts ? (
            <TrendCharts raceHistory={raceHistory} pointsByRace={pointsByRace} positionData={positionData} />
          ) : (
            <div className="fx-card player-empty">
              <LogoLoader size="sm" className="me-2" />
              {t("common.loading")}
            </div>
          )}
        </Col>
      </Row>
    </div>
  );
}

export default React.memo(PlayerStatsView);

PlayerStatsView.propTypes = {
  playerData: PropTypes.shape({
    name: PropTypes.string.isRequired,
    totalPoints: PropTypes.number.isRequired,
    position: PropTypes.number,
    jolly: PropTypes.number,
    championshipPiloti: PropTypes.arrayOf(PropTypes.string),
    championshipCostruttori: PropTypes.arrayOf(PropTypes.string),
    championshipPts: PropTypes.number,
  }).isRequired,
  raceHistory: PropTypes.arrayOf(PropTypes.shape({
    raceId: PropTypes.string.isRequired,
    raceName: PropTypes.string.isRequired,
    round: PropTypes.number.isRequired,
    submission: PropTypes.object,
    officialResults: PropTypes.object,
    cancelledSprint: PropTypes.bool,
  })),
  totalCompletedRaces: PropTypes.number,
  showCharts: PropTypes.bool,
  showBackButton: PropTypes.bool,
  accountPanel: PropTypes.node,
  loadingHistory: PropTypes.bool,
  firstName: PropTypes.string,
  lastName: PropTypes.string,
  photoURL: PropTypes.string,
  positionData: PropTypes.arrayOf(PropTypes.shape({
    round: PropTypes.number,
    label: PropTypes.string,
    name: PropTypes.string,
    position: PropTypes.number,
  })),
  pointsByRace: PropTypes.object,
};
