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
  Nav,
  Form,
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
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { getChampionshipStatistics } from "../services/statisticsService";
import { db } from "../services/firebase";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import PlayerStatsView from "../components/PlayerStatsView";
import "../styles/statistics.css";

const medals = ["🥇", "🥈", "🥉"];

// Distinct colors for up to 25 players in charts
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
  "#e83e8c", // hot pink - 11th
  "#28a745", // success green - 12th
  "#007bff", // primary blue - 13th
  "#ff6b6b", // coral - 14th
  "#4ecdc4", // turquoise - 15th
  "#95e1d3", // mint - 16th
  "#f38181", // light coral - 17th
  "#aa96da", // lavender - 18th
  "#fcbad3", // light pink - 19th
  "#a8e6cf", // light green - 20th
  "#ffd3b6", // peach - 21st
  "#ffaaa5", // salmon - 22nd
  "#ff8b94", // rose - 23rd
  "#a8dadc", // powder blue - 24th
  "#f1faee", // mint cream - 25th
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

  // Tab and individual player stats
  const [activeTab, setActiveTab] = useState("general"); // "general", "player"
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [playerStats, setPlayerStats] = useState(null);
  const [loadingPlayerStats, setLoadingPlayerStats] = useState(false);

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

  // Load individual player statistics when selected
  useEffect(() => {
    if (!selectedPlayerId) return;

    const loadPlayerStatistics = async () => {
      setLoadingPlayerStats(true);
      try {
        // Get full player data from ranking
        const userDoc = await getDoc(doc(db, "ranking", selectedPlayerId));
        if (!userDoc.exists()) {
          setLoadingPlayerStats(false);
          return;
        }

        const userData = userDoc.data();

        // Load all past races with submissions
        const now = Timestamp.now();
        const racesSnap = await getDocs(
          query(
            collection(db, "races"),
            where("raceUTC", "<", now),
            orderBy("raceUTC", "desc")
          )
        );

        // Count total completed races
        const totalCompleted = racesSnap.docs.filter(doc => doc.data().officialResults).length;

        // Load submissions for all races in parallel
        const submissionsPromises = racesSnap.docs.map(async (raceDoc) => {
          const raceData = raceDoc.data();

          // Only include races with official results
          if (!raceData.officialResults) {
            return null;
          }

          try {
            const submissionDoc = await getDoc(
              doc(db, "races", raceDoc.id, "submissions", selectedPlayerId)
            );

            return {
              raceId: raceDoc.id,
              raceName: raceData.name,
              round: raceData.round,
              raceUTC: raceData.raceUTC,
              submission: submissionDoc.exists() ? submissionDoc.data() : null,
              officialResults: raceData.officialResults,
              cancelledSprint: raceData.cancelledSprint || false,
              cancelledMain: raceData.cancelledMain || false,
            };
          } catch (err) {
            console.error(`Error fetching submission for race ${raceDoc.id}:`, err);
            return null;
          }
        });

        const allSubmissions = await Promise.all(submissionsPromises);
        const raceHistory = allSubmissions.filter(Boolean);

        setPlayerStats({
          playerData: {
            name: userData.name,
            totalPoints: userData.puntiTotali || 0,
            position: currentRanking.find(p => p.userId === selectedPlayerId)?.position,
            jolly: userData.jolly ?? 0,
            championshipPiloti: userData.championshipPiloti || [],
            championshipCostruttori: userData.championshipCostruttori || [],
            championshipPts: userData.championshipPts || 0,
          },
          raceHistory,
          totalCompletedRaces: totalCompleted,
        });
      } catch (err) {
        console.error("Error loading player statistics:", err);
      } finally {
        setLoadingPlayerStats(false);
      }
    };

    loadPlayerStatistics();
  }, [selectedPlayerId, currentRanking]);

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
  const playersLabel = playersFilter === "5"
    ? t("statistics.top5Players")
    : playersFilter === "10"
    ? t("statistics.top10Players")
    : t("statistics.allPlayers");

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

      {/* Tab Navigation */}
      <Row className="mb-3">
        <Col>
          <Nav
            variant="tabs"
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-3"
          >
            <Nav.Item>
              <Nav.Link
                eventKey="general"
                style={{
                  color: activeTab === "general" ? accentColor : textColor,
                  borderColor: activeTab === "general" ? accentColor : "transparent",
                  fontWeight: activeTab === "general" ? "bold" : "normal",
                }}
              >
                📊 {t("statistics.generalRanking")}
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link
                eventKey="player"
                style={{
                  color: activeTab === "player" ? accentColor : textColor,
                  borderColor: activeTab === "player" ? accentColor : "transparent",
                  fontWeight: activeTab === "player" ? "bold" : "normal",
                }}
              >
                👤 {t("statistics.playerStatistics")}
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </Col>
      </Row>

      {/* General Tab Content */}
      {activeTab === "general" && (
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
                        <tr
                          key={player.userId}
                          className={isTop3 ? "fw-bold" : ""}
                          style={{
                            cursor: "pointer",
                            transition: "background-color 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isDark ? "#2d3238" : "#f8f9fa";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "";
                          }}
                          onClick={() => {
                            // Navigate to participant page when clicking on row
                            window.location.href = `/participant/${player.userId}`;
                          }}
                        >
                          <td className="text-center">{medal}</td>
                          <td>
                            <div className="d-flex align-items-center justify-content-between">
                              <span style={{ flex: 1, color: "inherit" }}>
                                {player.name}
                              </span>
                              <span
                                style={{
                                  color: accentColor,
                                  fontSize: "0.9rem",
                                  fontWeight: "bold",
                                  marginLeft: "8px",
                                }}
                                title="Clicca per vedere dettagli"
                              >
                                👁️
                              </span>
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
              <div className="px-3 pb-2 text-center">
                <small className="text-muted">
                  💡 {t("statistics.clickPlayerHint")}
                </small>
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
                  👥 {t("statistics.playersToShow")}
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
                    {t("statistics.all")}
                  </Button>
                </div>
              </div>

              {/* Filtro Gare */}
              <div>
                <h6 className="mb-2 fw-semibold" style={{ color: accentColor }}>
                  🏁 {t("statistics.racesToShow")}
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
                    {t("statistics.last")} 5
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
                    {t("statistics.last")} 10
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
                    {t("statistics.allFeminine")}
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
                <Card.Body className="chart-container-optimized">
                  <ResponsiveContainer width="100%" height={450}>
                    <LineChart
                      data={pointsChartData}
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
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: "0.75rem" }}
                        iconType="line"
                        layout="horizontal"
                        align="center"
                        verticalAlign="bottom"
                      />
                      {topPlayers
                        .sort((a, b) => a.position - b.position)
                        .map((player, idx) => (
                          <Line
                            key={player.userId}
                            type="monotone"
                            dataKey={player.name}
                            stroke={CHART_COLORS[(player.position - 1) % CHART_COLORS.length]}
                            strokeWidth={2.5}
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
                <Card.Body className="chart-container-optimized">
                  <ResponsiveContainer width="100%" height={450}>
                    <LineChart
                      data={positionChartData}
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
                        wrapperStyle={{ fontSize: "0.75rem" }}
                        iconType="line"
                        layout="horizontal"
                        align="center"
                        verticalAlign="bottom"
                      />
                      {topPlayers
                        .sort((a, b) => a.position - b.position)
                        .map((player, idx) => (
                          <Line
                            key={player.userId}
                            type="monotone"
                            dataKey={player.name}
                            stroke={CHART_COLORS[(player.position - 1) % CHART_COLORS.length]}
                            strokeWidth={2.5}
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
      )}

      {/* Player Tab Content */}
      {activeTab === "player" && (
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
                as="h5"
                className="fw-semibold"
                style={{
                  backgroundColor: bgHeader,
                  borderBottom: `2px solid ${accentColor}`,
                }}
              >
                👤 {t("statistics.selectPlayer") || "Seleziona Giocatore"}
              </Card.Header>
              <Card.Body>
                <Form.Select
                  value={selectedPlayerId || ""}
                  onChange={(e) => setSelectedPlayerId(e.target.value || null)}
                  style={{
                    backgroundColor: isDark ? "var(--bg-tertiary)" : "#fff",
                    color: textColor,
                    borderColor: accentColor,
                  }}
                >
                  <option value="">{t("statistics.choosePlayer") || "-- Seleziona un giocatore --"}</option>
                  {currentRanking.map((player) => (
                    <option key={player.userId} value={player.userId}>
                      {player.position}. {player.name} ({player.points} pt)
                    </option>
                  ))}
                </Form.Select>

                {/* Loading spinner */}
                {loadingPlayerStats && (
                  <div className="text-center mt-4">
                    <Spinner animation="border" size="sm" style={{ color: accentColor }} />
                    <p className="mt-2 text-muted">{t("statistics.loadingPlayer") || "Caricamento statistiche giocatore..."}</p>
                  </div>
                )}

                {/* Player stats view using unified component */}
                {!loadingPlayerStats && playerStats && (
                  <div className="mt-4">
                    <PlayerStatsView
                      playerData={playerStats.playerData}
                      raceHistory={playerStats.raceHistory}
                      totalCompletedRaces={playerStats.totalCompletedRaces}
                      showCharts={true}
                      showBackButton={false}
                    />
                  </div>
                )}

                {/* No player selected message */}
                {!loadingPlayerStats && !playerStats && selectedPlayerId === null && (
                  <Alert variant="info" className="mt-4 text-center">
                    {t("statistics.selectPlayerPrompt")}
                  </Alert>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
}
