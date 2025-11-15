/**
 * @file Statistics.jsx
 * @description Championship statistics page with ranking trends and cumulative points charts
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  Table,
  Badge,
  Button,
} from "react-bootstrap";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { getChampionshipStatistics } from "../services/statisticsService";
import { db } from "../services/firebase";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";

const medals = ["🥇", "🥈", "🥉"];

// Distinct colors for top players in charts (max 5)
const CHART_COLORS = [
  "#dc3545", // red - 1st
  "#0d6efd", // blue - 2nd
  "#198754", // green - 3rd
  "#ffc107", // yellow - 4th
  "#6f42c1", // purple - 5th
];

/**
 * Statistics page displaying championship progression charts and current standings
 * @returns {JSX.Element} Statistics page with charts and ranking table
 */
export default function Statistics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [currentRanking, setCurrentRanking] = useState([]);
  const { isDark } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    (async () => {
      try {
        const data = await getChampionshipStatistics();
        setStatistics(data);

        // Get current ranking from database
        const rankingSnap = await getDocs(
          query(collection(db, "ranking"), orderBy("puntiTotali", "desc"))
        );

        const ranking = rankingSnap.docs.map((doc, index) => ({
          userId: doc.id,
          name: doc.data().name,
          points: doc.data().puntiTotali || 0,
          position: index + 1,
        }));

        setCurrentRanking(ranking);
      } catch (err) {
        console.error(err);
        setError(t("statistics.errorLoading"));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";
  const bgHeader = isDark ? "var(--bg-tertiary)" : "#ffffff";
  const textColor = isDark ? "#e9ecef" : "#212529";
  const gridColor = isDark ? "#495057" : "#dee2e6";

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p className="mt-3">{t("statistics.loading")}</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  if (!statistics || !statistics.races.length) {
    return (
      <Container className="py-5">
        <Alert variant="info">
          {t("statistics.noRaces")}
        </Alert>
      </Container>
    );
  }

  // Show only top 5 players in charts to reduce visual clutter
  const topPlayers = currentRanking.slice(0, 5);

  // Prepare data for cumulative points chart
  const pointsChartData = statistics.races.map((race, raceIndex) => {
    const dataPoint = {
      name: `R${race.round}`,
      fullName: race.name,
    };

    topPlayers.forEach(player => {
      const history = statistics.playersData[player.userId] || [];
      const raceData = history[raceIndex];
      dataPoint[player.name] = raceData ? raceData.cumulativePoints : 0;
    });

    return dataPoint;
  });

  // Prepare data for position chart (inverted: 1st at top)
  const positionChartData = statistics.races.map((race, raceIndex) => {
    const dataPoint = {
      name: `R${race.round}`,
      fullName: race.name,
    };

    topPlayers.forEach(player => {
      const history = statistics.playersData[player.userId] || [];
      const raceData = history[raceIndex];
      dataPoint[player.name] = raceData ? raceData.position : null;
    });

    return dataPoint;
  });

  /**
   * Custom tooltip to display full race name
   * @param {Object} props - Tooltip props
   * @param {boolean} props.active - Whether tooltip is active
   * @param {Array} props.payload - Data payload
   * @param {string} props.label - Label text
   * @returns {JSX.Element|null} Custom tooltip or null
   */
  const CustomTooltip = ({ active, payload, label }) => {
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
  };

  return (
    <Container className="py-4">
      <Row>
        <Col xs={12}>
          <h2 className="mb-4" style={{ color: accentColor }}>
            {t("statistics.title")}
          </h2>
        </Col>
      </Row>

      <Row className="g-4">
        {/* Classifica attuale */}
        <Col xs={12} lg={4}>
          <Card
            className="shadow h-100"
            style={{
              borderColor: accentColor,
              backgroundColor: bgCard,
            }}
          >
            <Card.Header
              as="h5"
              className="text-center fw-semibold"
              style={{
                backgroundColor: bgHeader,
                borderBottom: `2px solid ${accentColor}`,
              }}
            >
              {t("statistics.currentRanking")}
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
                      <th style={{ width: 60 }} className="text-center">
                        #
                      </th>
                      <th>{t("statistics.player")}</th>
                      <th className="text-center">{t("statistics.points")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRanking.map((player, idx) => {
                      const medal = medals[idx] ?? idx + 1;
                      const isTop3 = idx < 3;

                      return (
                        <tr key={player.userId} className={isTop3 ? "fw-bold" : ""}>
                          <td className="text-center">{medal}</td>
                          <td>
                            <div className="d-flex align-items-center justify-content-between">
                              <Link
                                to={`/participant/${player.userId}`}
                                style={{
                                  color: "inherit",
                                  textDecoration: "none",
                                  flex: 1,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.textDecoration = "underline";
                                  e.currentTarget.style.color = accentColor;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.textDecoration = "none";
                                  e.currentTarget.style.color = "inherit";
                                }}
                              >
                                {player.name}
                              </Link>
                              <Link to={`/participant/${player.userId}`}>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 ms-2"
                                  style={{
                                    color: accentColor,
                                    fontSize: "0.9rem",
                                    textDecoration: "none",
                                  }}
                                  title={t("common.view") || "View details"}
                                >
                                  →
                                </Button>
                              </Link>
                            </div>
                          </td>
                          <td className="text-center">
                            <Badge bg="success">{player.points}</Badge>
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

        {/* Grafici */}
        <Col xs={12} lg={8}>
          {/* Grafico punti cumulativi */}
          <Card
            className="shadow mb-4"
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
              {t("statistics.pointsProgression")} ({t("statistics.topPlayers")})
            </Card.Header>
            <Card.Body>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={pointsChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey="name"
                    stroke={textColor}
                    style={{ fontSize: "0.85rem" }}
                  />
                  <YAxis
                    stroke={textColor}
                    style={{ fontSize: "0.85rem" }}
                    label={{
                      value: t("statistics.points"),
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: textColor, fontSize: "0.7rem" },
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "0.85rem" }}
                    iconType="line"
                  />
                  {topPlayers.map((player, idx) => (
                    <Line
                      key={player.userId}
                      type="monotone"
                      dataKey={player.name}
                      stroke={CHART_COLORS[idx]}
                      strokeWidth={3}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>

          {/* Grafico posizioni */}
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
              {t("statistics.positionProgression")} ({t("statistics.topPlayers")})
            </Card.Header>
            <Card.Body>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={positionChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey="name"
                    stroke={textColor}
                    style={{ fontSize: "0.85rem" }}
                  />
                  <YAxis
                    stroke={textColor}
                    style={{ fontSize: "0.85rem" }}
                    reversed
                    domain={[1, currentRanking.length]}
                    ticks={Array.from(
                      { length: currentRanking.length },
                      (_, i) => i + 1
                    )}
                    label={{
                      value: t("statistics.position"),
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: textColor, fontSize: "0.7rem" },
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "0.85rem" }}
                    iconType="line"
                  />
                  {topPlayers.map((player, idx) => (
                    <Line
                      key={player.userId}
                      type="monotone"
                      dataKey={player.name}
                      stroke={CHART_COLORS[idx]}
                      strokeWidth={3}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
