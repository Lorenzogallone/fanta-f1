/**
 * @file PlayerStatsView.jsx
 * @description Unified player statistics view with charts and race history
 * Used in both ParticipantDetail and Statistics pages for consistent UX
 */

import React from "react";
import {
  Row,
  Col,
  Card,
  Badge,
  Table,
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
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import "../styles/statistics.css";

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
 * Player statistics view component
 * @param {Object} props
 * @param {Object} props.playerData - Player data with name, position, totalPoints
 * @param {Array} props.races - Array of race data
 * @param {Array} props.history - Array of player history by race
 * @param {number} props.totalCompletedRaces - Total number of completed races
 * @param {boolean} props.showCharts - Whether to show progression charts
 * @returns {JSX.Element}
 */
export default function PlayerStatsView({
  playerData,
  races,
  history,
  totalCompletedRaces = 0,
  showCharts = true,
}) {
  const { isDark } = useTheme();
  const { t } = useLanguage();

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";
  const bgHeader = isDark ? "var(--bg-tertiary)" : "#ffffff";
  const textColor = isDark ? "#e9ecef" : "#212529";
  const gridColor = isDark ? "#495057" : "#dee2e6";

  // Calculate statistics
  const totalSubmittedRaces = history.filter(h => h.racePoints !== undefined && h.racePoints !== null).length;
  const averagePoints = totalSubmittedRaces > 0
    ? (playerData.totalPoints / totalSubmittedRaces).toFixed(1)
    : "0.0";

  return (
    <>
      {/* Player Info Header */}
      <Row className="g-4">
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
                <Col xs={6} md={3}>
                  <div className="text-center">
                    <div className="text-muted small">{t("participantDetail.position")}</div>
                    <div className="fs-2 fw-bold" style={{ color: accentColor }}>
                      {playerData.position}°
                    </div>
                  </div>
                </Col>
                <Col xs={6} md={3}>
                  <div className="text-center">
                    <div className="text-muted small">{t("leaderboard.totalPoints")}</div>
                    <div className="fs-2 fw-bold" style={{ color: accentColor }}>
                      {playerData.totalPoints}
                    </div>
                  </div>
                </Col>
                <Col xs={6} md={3}>
                  <div className="text-center">
                    <div className="text-muted small">{t("participantDetail.lineupsSubmitted")}</div>
                    <div className="fs-2 fw-bold" style={{ color: accentColor }}>
                      {totalSubmittedRaces}/{totalCompletedRaces}
                    </div>
                  </div>
                </Col>
                <Col xs={6} md={3}>
                  <div className="text-center">
                    <div className="text-muted small">{t("participantDetail.averagePoints")}</div>
                    <div className="fs-2 fw-bold" style={{ color: accentColor }}>
                      {averagePoints}
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>

        {/* Charts Section */}
        {showCharts && races && history && races.length > 0 && (
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
                      data={races.map((race, idx) => ({
                        name: `R${race.round}`,
                        fullName: race.name,
                        points: history[idx]?.cumulativePoints || 0,
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

            {/* Position progression chart */}
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
                  📊 {t("statistics.positionProgression")}
                </Card.Header>
                <Card.Body className="chart-container-optimized">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                      data={races.map((race, idx) => ({
                        name: `R${race.round}`,
                        fullName: race.name,
                        position: history[idx]?.position || null,
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
                        reversed
                        label={{
                          value: t("statistics.position"),
                          angle: -90,
                          position: "insideLeft",
                          style: { fill: textColor, fontSize: "0.7rem" },
                        }}
                      />
                      <Tooltip content={(props) => <CustomTooltip {...props} isDark={isDark} accentColor={accentColor} />} />
                      <Line
                        type="monotone"
                        dataKey="position"
                        name={t("statistics.position")}
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

        {/* Race-by-race breakdown table */}
        {races && history && races.length > 0 && (
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
                🏁 {t("participantDetail.raceHistory")}
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table
                    hover
                    striped
                    className="mb-0 align-middle"
                    style={{ borderTop: `1px solid ${accentColor}` }}
                  >
                    <thead>
                      <tr>
                        <th className="text-center">{t("raceResults.round")}</th>
                        <th>{t("raceResults.race")}</th>
                        <th className="text-center">{t("statistics.position")}</th>
                        <th className="text-center">{t("participantDetail.racePoints")}</th>
                        <th className="text-center">{t("leaderboard.totalPoints")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {races.map((race, idx) => {
                        const raceData = history[idx];
                        if (!raceData) return null;

                        return (
                          <tr key={race.id}>
                            <td className="text-center">
                              <Badge bg="secondary">{race.round}</Badge>
                            </td>
                            <td>{race.name}</td>
                            <td className="text-center">
                              <Badge
                                bg={
                                  raceData.position === 1
                                    ? "warning"
                                    : raceData.position === 2
                                    ? "info"
                                    : raceData.position === 3
                                    ? "success"
                                    : "secondary"
                                }
                              >
                                {raceData.position}°
                              </Badge>
                            </td>
                            <td className="text-center">
                              {raceData.racePoints > 0 ? (
                                <span className="text-success fw-bold">
                                  +{raceData.racePoints}
                                </span>
                              ) : raceData.racePoints < 0 ? (
                                <span className="text-danger fw-bold">
                                  {raceData.racePoints}
                                </span>
                              ) : (
                                <span className="text-muted">0</span>
                              )}
                            </td>
                            <td className="text-center">
                              <Badge bg="primary">{raceData.cumulativePoints}</Badge>
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
