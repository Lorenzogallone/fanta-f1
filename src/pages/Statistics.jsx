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

// Distinct colors for players in charts
const CHART_COLORS = [
  "#dc3545", // red - 1st
  "#0d6efd", // blue - 2nd
  "#198754", // green - 3rd
  "#ffc107", // yellow - 4th
  "#6f42c1", // purple - 5th
  "#fd7e14", // orange - 6th
  "#20c997", // teal - 7th
  "#d63384", // pink - 8th
  "#17a2b8", // cyan - 9th
  "#6c757d", // gray - 10th
];

/**
 * Statistics page displaying championship progression charts and current standings
 * @returns {JSX.Element} Statistics page with charts and ranking table
 */
export default function Statistics() {
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [loadingStatistics, setLoadingStatistics] = useState(true);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [currentRanking, setCurrentRanking] = useState([]);
  const [playersFilter, setPlayersFilter] = useState("5"); // "5", "10", "all"
  const [racesFilter, setRacesFilter] = useState("all"); // "5", "10", "all"
  const { isDark } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    // Load ranking and statistics in parallel for faster initial render
    const loadRanking = async () => {
      try {
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
        setLoadingRanking(false); // Show ranking immediately
      } catch (err) {
        console.error("Error loading ranking:", err);
        setError(t("statistics.errorLoading"));
        setLoadingRanking(false);
      }
    };

    const loadStatistics = async () => {
      try {
        const data = await getChampionshipStatistics();
        setStatistics(data);
        setLoadingStatistics(false); // Show charts when ready
      } catch (err) {
        console.error("Error loading statistics:", err);
        // Don't set error here - ranking might still be visible
        setLoadingStatistics(false);
      }
    };

    // Execute both in parallel
    loadRanking();
    loadStatistics();
  }, [t]);

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";
  const bgHeader = isDark ? "var(--bg-tertiary)" : "#ffffff";
  const textColor = isDark ? "#e9ecef" : "#212529";
  const gridColor = isDark ? "#495057" : "#dee2e6";

  // Show loading only if ranking hasn't loaded yet
  if (loadingRanking && currentRanking.length === 0) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p className="mt-3">{t("statistics.loading")}</p>
      </Container>
    );
  }

  if (error && currentRanking.length === 0) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  // Apply players filter to determine how many players to show in charts
  const numPlayers = playersFilter === "5" ? 5 : playersFilter === "10" ? 10 : currentRanking.length;
  const topPlayers = currentRanking.slice(0, numPlayers);

  // Get label for chart headers based on players filter
  const playersLabel = playersFilter === "5" ? "Top 5 Giocatori" : playersFilter === "10" ? "Top 10 Giocatori" : "Tutti i Giocatori";

  // Prepare chart data only if statistics are loaded
  let pointsChartData = [];
  let positionChartData = [];

  if (statistics && statistics.races && statistics.races.length > 0) {
    // Apply races filter to determine how many races to show
    const numRaces = racesFilter === "5" ? 5 : racesFilter === "10" ? 10 : statistics.races.length;
    const filteredRaces = statistics.races.slice(-numRaces); // Get last N races
    const startIndex = statistics.races.length - numRaces; // Starting index in original array

    // Prepare data for cumulative points chart
    pointsChartData = filteredRaces.map((race, idx) => {
      const raceIndex = startIndex + idx; // Actual index in original array
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
    positionChartData = filteredRaces.map((race, idx) => {
      const raceIndex = startIndex + idx; // Actual index in original array
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
  }

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

        {/* Filtri per i grafici */}
        <Col xs={12}>
          <Card
            className="shadow"
            style={{
              borderColor: accentColor,
              backgroundColor: bgCard,
            }}
          >
            <Card.Body>
              {/* Filtro Giocatori */}
              <div className="mb-3">
                <h6 className="mb-2 fw-semibold" style={{ color: accentColor }}>
                  👥 Giocatori da visualizzare:
                </h6>
                <div className="d-flex justify-content-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={playersFilter === "5" ? "danger" : "outline-secondary"}
                    onClick={() => setPlayersFilter("5")}
                    style={{
                      backgroundColor: playersFilter === "5" ? accentColor : "transparent",
                      borderColor: playersFilter === "5" ? accentColor : (isDark ? "#6c757d" : "#dee2e6"),
                      color: playersFilter === "5" ? "#fff" : (isDark ? "#e9ecef" : "#212529"),
                    }}
                  >
                    Top 5
                  </Button>
                  <Button
                    size="sm"
                    variant={playersFilter === "10" ? "danger" : "outline-secondary"}
                    onClick={() => setPlayersFilter("10")}
                    style={{
                      backgroundColor: playersFilter === "10" ? accentColor : "transparent",
                      borderColor: playersFilter === "10" ? accentColor : (isDark ? "#6c757d" : "#dee2e6"),
                      color: playersFilter === "10" ? "#fff" : (isDark ? "#e9ecef" : "#212529"),
                    }}
                  >
                    Top 10
                  </Button>
                  <Button
                    size="sm"
                    variant={playersFilter === "all" ? "danger" : "outline-secondary"}
                    onClick={() => setPlayersFilter("all")}
                    style={{
                      backgroundColor: playersFilter === "all" ? accentColor : "transparent",
                      borderColor: playersFilter === "all" ? accentColor : (isDark ? "#6c757d" : "#dee2e6"),
                      color: playersFilter === "all" ? "#fff" : (isDark ? "#e9ecef" : "#212529"),
                    }}
                  >
                    Tutti
                  </Button>
                </div>
              </div>

              {/* Filtro Gare */}
              <div>
                <h6 className="mb-2 fw-semibold" style={{ color: accentColor }}>
                  🏁 Gare da visualizzare:
                </h6>
                <div className="d-flex justify-content-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={racesFilter === "5" ? "danger" : "outline-secondary"}
                    onClick={() => setRacesFilter("5")}
                    style={{
                      backgroundColor: racesFilter === "5" ? accentColor : "transparent",
                      borderColor: racesFilter === "5" ? accentColor : (isDark ? "#6c757d" : "#dee2e6"),
                      color: racesFilter === "5" ? "#fff" : (isDark ? "#e9ecef" : "#212529"),
                    }}
                  >
                    Ultime 5
                  </Button>
                  <Button
                    size="sm"
                    variant={racesFilter === "10" ? "danger" : "outline-secondary"}
                    onClick={() => setRacesFilter("10")}
                    style={{
                      backgroundColor: racesFilter === "10" ? accentColor : "transparent",
                      borderColor: racesFilter === "10" ? accentColor : (isDark ? "#6c757d" : "#dee2e6"),
                      color: racesFilter === "10" ? "#fff" : (isDark ? "#e9ecef" : "#212529"),
                    }}
                  >
                    Ultime 10
                  </Button>
                  <Button
                    size="sm"
                    variant={racesFilter === "all" ? "danger" : "outline-secondary"}
                    onClick={() => setRacesFilter("all")}
                    style={{
                      backgroundColor: racesFilter === "all" ? accentColor : "transparent",
                      borderColor: racesFilter === "all" ? accentColor : (isDark ? "#6c757d" : "#dee2e6"),
                      color: racesFilter === "all" ? "#fff" : (isDark ? "#e9ecef" : "#212529"),
                    }}
                  >
                    Tutte
                  </Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Grafici */}
        <Col xs={12} lg={8}>
          {loadingStatistics ? (
            // Show loading placeholders for charts
            <>
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
                  {t("statistics.pointsProgression")} ({playersLabel})
                </Card.Header>
                <Card.Body className="text-center" style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div>
                    <Spinner animation="border" size="sm" />
                    <p className="mt-3 mb-0 text-muted">{t("statistics.loadingCharts") || "Loading charts..."}</p>
                  </div>
                </Card.Body>
              </Card>

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
                  {t("statistics.positionProgression")} ({playersLabel})
                </Card.Header>
                <Card.Body className="text-center" style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div>
                    <Spinner animation="border" size="sm" />
                    <p className="mt-3 mb-0 text-muted">{t("statistics.loadingCharts") || "Loading charts..."}</p>
                  </div>
                </Card.Body>
              </Card>
            </>
          ) : statistics && statistics.races && statistics.races.length > 0 ? (
            // Show charts when statistics are loaded
            <>
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
                  {t("statistics.pointsProgression")} ({playersLabel})
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
                          stroke={CHART_COLORS[idx % CHART_COLORS.length]}
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
                  {t("statistics.positionProgression")} ({playersLabel})
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
                          stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                          strokeWidth={3}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </>
          ) : (
            // Show message if no race data available
            <Card
              className="shadow"
              style={{
                borderColor: accentColor,
                backgroundColor: bgCard,
              }}
            >
              <Card.Body className="text-center py-5">
                <Alert variant="info" className="mb-0">
                  {t("statistics.noRaces") || "No race data available yet"}
                </Alert>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
}
