/**
 * @file PlayerStatsView.jsx
 * @description Unified player statistics view - complete player profile
 * Used in both ParticipantDetail and Statistics pages for consistent UX
 */

import React from "react";
import {
  Row,
  Col,
  Card,
  Badge,
  Table,
  Button,
} from "react-bootstrap";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { DRIVER_TEAM, TEAM_LOGOS, POINTS } from "../constants/racing";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../hooks/useLanguage";
import "../styles/statistics.css";

/**
 * Displays driver name with team logo
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
 * Displays team name with logo
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
    if (submission.mainP1 === official.P1) mainPoints += POINTS.MAIN[1];
    if (submission.mainP2 === official.P2) mainPoints += POINTS.MAIN[2];
    if (submission.mainP3 === official.P3) mainPoints += POINTS.MAIN[3];

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
  }

  const total = mainPoints + (sprintPoints || 0);
  return { mainPoints, sprintPoints, total };
};

/**
 * Unified player statistics view component
 * @param {Object} props
 * @param {Object} props.playerData - Player data with all info
 * @param {Array} props.raceHistory - Array of race history with submissions
 * @param {number} props.totalCompletedRaces - Total number of completed races
 * @param {boolean} props.showCharts - Whether to show progression charts
 * @param {boolean} props.showBackButton - Whether to show back button
 * @returns {JSX.Element}
 */
export default function PlayerStatsView({
  playerData,
  raceHistory = [],
  totalCompletedRaces = 0,
  showCharts = true,
  showBackButton = false,
}) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";
  const bgHeader = isDark ? "var(--bg-tertiary)" : "#ffffff";
  const textColor = isDark ? "#e9ecef" : "#212529";
  const gridColor = isDark ? "#495057" : "#dee2e6";

  // Calculate statistics
  const totalRaces = raceHistory.filter(race => race.submission !== null).length;
  const averagePoints = totalRaces > 0
    ? (playerData.totalPoints / totalRaces).toFixed(1)
    : "0.0";

  // Prepare chart data if we have races and history
  let chartRaces = [];
  let chartHistory = [];

  if (showCharts && raceHistory.length > 0) {
    let cumulativePoints = 0;
    chartRaces = [];
    chartHistory = [];

    [...raceHistory].reverse().forEach((race) => {
      const points = calculateRacePoints(race.submission, race.officialResults, race.cancelledSprint);
      cumulativePoints += points.total;

      chartRaces.push({
        id: race.raceId,
        name: race.raceName,
        round: race.round,
      });

      chartHistory.push({
        cumulativePoints,
        racePoints: points.total,
      });
    });
  }

  return (
    <>
      {showBackButton && (
        <Button
          variant="link"
          className="mb-3 p-0"
          onClick={() => navigate(-1)}
          style={{ color: accentColor }}
        >
          ← {t("common.back")}
        </Button>
      )}

      <Row className="g-4">
        {/* Player Info Header */}
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
                👤 {playerData.name}
              </h3>
            </Card.Header>
            <Card.Body>
              <Row className="g-3">
                {/* Position (if available) */}
                {playerData.position && (
                  <Col xs={6} md={playerData.position ? 2 : 3}>
                    <div className="text-center">
                      <div className="text-muted small">{t("statistics.position")}</div>
                      <div className="fs-2 fw-bold" style={{ color: accentColor }}>
                        {playerData.position}°
                      </div>
                    </div>
                  </Col>
                )}
                <Col xs={6} md={playerData.position ? 2 : 3}>
                  <div className="text-center">
                    <div className="text-muted small">{t("leaderboard.totalPoints")}</div>
                    <div className="fs-2 fw-bold" style={{ color: accentColor }}>
                      {playerData.totalPoints}
                    </div>
                  </div>
                </Col>
                <Col xs={6} md={playerData.position ? 3 : 3}>
                  <div className="text-center">
                    <div className="text-muted small">{t("participantDetail.lineupsSubmitted")}</div>
                    <div className="fs-2 fw-bold" style={{ color: accentColor }}>
                      {totalRaces}/{totalCompletedRaces}
                    </div>
                  </div>
                </Col>
                <Col xs={6} md={playerData.position ? 3 : 3}>
                  <div className="text-center">
                    <div className="text-muted small">{t("participantDetail.averagePoints")}</div>
                    <div className="fs-2 fw-bold" style={{ color: accentColor }}>
                      {averagePoints}
                    </div>
                  </div>
                </Col>
                <Col xs={6} md={playerData.position ? 2 : 3}>
                  <div className="text-center">
                    <div className="text-muted small">{t("leaderboard.jokers")}</div>
                    <div className="fs-2 fw-bold">
                      <Badge bg={playerData.jolly > 0 ? "success" : "secondary"} style={{ fontSize: "1.5rem" }}>
                        {playerData.jolly ?? 0}
                      </Badge>
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>

        {/* Championship Formation */}
        {playerData.championshipPiloti?.length === 3 && (
          <Col xs={12} lg={8} xl={6} className="mx-auto">
            <Card
              className="shadow h-100"
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
                <h5 className="mb-0" style={{ color: accentColor }}>
                  🏆 {t("participantDetail.championshipFormation")}
                </h5>
              </Card.Header>
              <Card.Body className="p-3">
                <h6 className="fw-bold mb-2">{t("history.drivers")}</h6>
                <div className="mb-3">
                  {playerData.championshipPiloti.map((driver, idx) => (
                    <div key={idx} className="py-1 border-bottom d-flex align-items-center">
                      <span className="text-muted me-2" style={{ minWidth: "25px" }}>{idx + 1}°</span>
                      <DriverWithLogo name={driver} />
                    </div>
                  ))}
                </div>

                {playerData.championshipCostruttori?.length === 3 && (
                  <>
                    <h6 className="fw-bold mb-2 mt-3">{t("history.constructors")}</h6>
                    <div>
                      {playerData.championshipCostruttori.map((team, idx) => (
                        <div key={idx} className="py-1 border-bottom d-flex align-items-center">
                          <span className="text-muted me-2" style={{ minWidth: "25px" }}>{idx + 1}°</span>
                          <TeamWithLogo name={team} />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {playerData.championshipPts > 0 && (
                  <div className="mt-3 text-center">
                    <Badge bg="success" style={{ fontSize: "1rem" }}>
                      {playerData.championshipPts} {t("common.points")}
                    </Badge>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        )}

        {/* Charts Section */}
        {showCharts && chartRaces.length > 0 && (
          <>
            {/* Points progression chart */}
            <Col xs={12}>
              <Card
                className="shadow"
                style={{
                  borderColor: accentColor,
                  backgroundColor: bgCard,
                }}
              >
                <Card.Header
                  as="h6"
                  className="fw-semibold"
                  style={{
                    backgroundColor: bgHeader,
                    borderBottom: `2px solid ${accentColor}`,
                  }}
                >
                  📈 {t("statistics.pointsProgression")}
                </Card.Header>
                <Card.Body className="chart-container-optimized">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                      data={chartRaces.map((race, idx) => ({
                        name: `R${race.round}`,
                        fullName: race.name,
                        points: chartHistory[idx]?.cumulativePoints || 0,
                      }))}
                      margin={{ top: 10, right: 5, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis
                        dataKey="name"
                        stroke={textColor}
                        style={{ fontSize: "0.8rem" }}
                      />
                      <YAxis
                        stroke={textColor}
                        style={{ fontSize: "0.8rem" }}
                        width={50}
                        label={{
                          value: t("statistics.points"),
                          angle: -90,
                          position: "insideLeft",
                          style: { fill: textColor, fontSize: "0.7rem" },
                        }}
                      />
                      <Tooltip content={(props) => <CustomTooltip {...props} isDark={isDark} accentColor={accentColor} />} />
                      <Line
                        type="monotone"
                        dataKey="points"
                        name={t("statistics.points")}
                        stroke={accentColor}
                        strokeWidth={3}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
          </>
        )}

        {/* Race History Table */}
        {raceHistory.length > 0 && (
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
                <h5 className="mb-0" style={{ color: accentColor }}>
                  📊 {t("participantDetail.raceHistory")}
                </h5>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table hover className="mb-0" size="sm" style={{ fontSize: "0.9rem" }}>
                    <thead>
                      <tr>
                        <th className="text-center" style={{ width: "60px" }}>{t("raceResults.round")}</th>
                        <th>{t("raceResults.race")}</th>
                        <th className="text-center" style={{ width: "70px" }}>Main</th>
                        <th className="text-center" style={{ width: "70px" }}>Sprint</th>
                        <th className="text-center" style={{ width: "70px" }}>Tot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {raceHistory.map((race) => {
                        const points = calculateRacePoints(race.submission, race.officialResults, race.cancelledSprint);

                        return (
                          <tr key={race.raceId}>
                            <td className="text-center fw-semibold text-muted" style={{ fontSize: "0.85rem" }}>
                              {race.round}
                            </td>
                            <td>{race.raceName}</td>
                            <td className="text-center fw-semibold">
                              {points.mainPoints !== null ? (
                                <span
                                  style={{
                                    color: points.mainPoints < 0 ? "#dc3545" : points.mainPoints === 0 ? "#6c757d" : "#198754"
                                  }}
                                >
                                  {points.mainPoints > 0 ? `+${points.mainPoints}` : points.mainPoints}
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td className="text-center fw-semibold">
                              {points.sprintPoints !== null ? (
                                <span
                                  style={{
                                    color: points.sprintPoints < 0 ? "#dc3545" : points.sprintPoints === 0 ? "#6c757d" : "#198754"
                                  }}
                                >
                                  {points.sprintPoints > 0 ? `+${points.sprintPoints}` : points.sprintPoints}
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td className="text-center fw-bold">
                              <span
                                style={{
                                  color: points.total < 0 ? "#dc3545" : points.total === 0 ? "#6c757d" : "#198754"
                                }}
                              >
                                {points.total > 0 ? `+${points.total}` : points.total}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>
    </>
  );
}
