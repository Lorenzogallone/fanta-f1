/**
 * @file Statistics.jsx
 * @description Championship statistics page with ranking trends and cumulative points charts
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { useLanguage } from "../hooks/useLanguage";
import { useAuth } from "../hooks/useAuth";
import { error as logError } from "../utils/logger";
import { getChampionshipDeadlineMs } from "../utils/championshipDeadline";
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
  const [loadingRaceHistory, setLoadingRaceHistory] = useState(false);
  const [championshipDeadlinePassed, setChampionshipDeadlinePassed] = useState(false);

  // Cache: evita ri-fetch gare e dati giocatori già caricati
  const racesCache = useRef(null); // { docs, totalCompleted } — caricato una volta sola
  const playerCache = useRef({}); // { [userId]: playerStats }

  const { isDark } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();

  // Apply players filter to determine how many players to show in charts
  // MUST be before any conditional returns to follow Rules of Hooks
  const topPlayers = useMemo(() => {
    const numPlayers = playersFilter === "5" ? 5 : playersFilter === "10" ? 10 : currentRanking.length;
    return currentRanking.slice(0, numPlayers);
  }, [playersFilter, currentRanking]);

  // Prepare chart data only if statistics are loaded
  // MUST be before any conditional returns to follow Rules of Hooks
  const { pointsChartData, positionChartData } = useMemo(() => {
    if (!statistics?.races?.length) {
      return { pointsChartData: [], positionChartData: [] };
    }

    const numRaces = racesFilter === "5" ? 5 : racesFilter === "10" ? 10 : statistics.races.length;
    const filteredRaces = statistics.races.slice(-numRaces);
    const startIndex = statistics.races.length - numRaces;

    const points = filteredRaces.map((race, idx) => {
      const raceIndex = startIndex + idx;
      const dataPoint = { name: `R${race.round}`, fullName: race.name };
      topPlayers.forEach(player => {
        const history = statistics.playersData[player.userId] || [];
        const raceData = history[raceIndex];
        dataPoint[player.name] = raceData ? raceData.cumulativePoints : 0;
      });
      return dataPoint;
    });

    const positions = filteredRaces.map((race, idx) => {
      const raceIndex = startIndex + idx;
      const dataPoint = { name: `R${race.round}`, fullName: race.name };
      topPlayers.forEach(player => {
        const history = statistics.playersData[player.userId] || [];
        const raceData = history[raceIndex];
        dataPoint[player.name] = raceData ? raceData.position : null;
      });
      return dataPoint;
    });

    return { pointsChartData: points, positionChartData: positions };
  }, [statistics, racesFilter, topPlayers]);

  useEffect(() => {
    // Load ranking and statistics in parallel for faster initial render
    const loadRanking = async () => {
      try {
        const rankingSnap = await getDocs(
          query(collection(db, "ranking"), orderBy("puntiTotali", "desc"))
        );

        let currentPos = 1;
        const ranking = rankingSnap.docs.map((doc, index) => {
          const points = doc.data().puntiTotali || 0;
          if (index > 0 && points < (rankingSnap.docs[index - 1].data().puntiTotali || 0)) {
            currentPos = index + 1;
          }
          return {
            userId: doc.id,
            name: doc.data().name,
            points,
            position: currentPos,
          };
        });

        setCurrentRanking(ranking);
        setLoadingRanking(false); // Show ranking immediately
      } catch (err) {
        logError("Error loading ranking:", err);
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
        logError("Error loading statistics:", err);
        // Don't set error here - ranking might still be visible
        setLoadingStatistics(false);
      }
    };

    const loadDeadline = async () => {
      try {
        const ms = await getChampionshipDeadlineMs();
        setChampionshipDeadlinePassed(ms ? Date.now() > ms : false);
      } catch {
        // Non-critical
      }
    };

    // Execute all in parallel
    loadRanking();
    loadStatistics();
    loadDeadline();
  }, [t]);

  // Load individual player statistics when selected
  useEffect(() => {
    if (!selectedPlayerId) {
      setPlayerStats(null);
      return;
    }

    // Se già in cache, mostra subito senza fetch
    if (playerCache.current[selectedPlayerId]) {
      setPlayerStats(playerCache.current[selectedPlayerId]);
      return;
    }

    const loadPlayerStatistics = async () => {
      setLoadingPlayerStats(true);
      setPlayerStats(null);

      try {
        // Step 1: dati base giocatore (2 read) — mostra subito l'header
        const [rankingDoc, profileDoc] = await Promise.all([
          getDoc(doc(db, "ranking", selectedPlayerId)),
          getDoc(doc(db, "users", selectedPlayerId)),
        ]);

        if (!rankingDoc.exists()) {
          setLoadingPlayerStats(false);
          return;
        }

        const userData = rankingDoc.data();
        const profileData = profileDoc.exists() ? profileDoc.data() : {};
        const isOwnProfile = user?.uid === selectedPlayerId;
        const showChampionship = championshipDeadlinePassed || isOwnProfile;

        // Mostra subito i dati base, storia ancora vuota
        const baseStats = {
          playerData: {
            name: userData.name,
            totalPoints: userData.puntiTotali || 0,
            position: currentRanking.find(p => p.userId === selectedPlayerId)?.position,
            jolly: userData.jolly ?? 0,
            championshipPiloti: showChampionship ? (userData.championshipPiloti || []) : [],
            championshipCostruttori: showChampionship ? (userData.championshipCostruttori || []) : [],
            championshipPts: showChampionship ? (userData.championshipPts || 0) : 0,
          },
          firstName: profileData.firstName || "",
          lastName: profileData.lastName || "",
          photoURL: profileData.photoURL || "",
          raceHistory: [],
          totalCompletedRaces: 0,
        };
        setPlayerStats(baseStats);
        setLoadingPlayerStats(false);

        // Step 2: carica la race history in background (loader solo sul grafico/tabella)
        setLoadingRaceHistory(true);

        // Usa la cache delle gare se già disponibile, altrimenti fetchale una volta sola
        if (!racesCache.current) {
          const now = Timestamp.now();
          const racesSnap = await getDocs(
            query(collection(db, "races"), where("raceUTC", "<", now), orderBy("raceUTC", "desc"))
          );
          racesCache.current = {
            docs: racesSnap.docs,
            totalCompleted: racesSnap.docs.filter(d => d.data().officialResults).length,
          };
        }

        const { docs: raceDocs, totalCompleted } = racesCache.current;

        // Fetch solo le submission del giocatore selezionato (in parallelo)
        const submissionsPromises = raceDocs.map(async (raceDoc) => {
          const raceData = raceDoc.data();
          if (!raceData.officialResults) return null;
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
            logError(`Error fetching submission for race ${raceDoc.id}:`, err);
            return null;
          }
        });

        const allSubmissions = await Promise.all(submissionsPromises);
        const raceHistory = allSubmissions.filter(Boolean);

        const fullStats = { ...baseStats, raceHistory, totalCompletedRaces: totalCompleted };
        playerCache.current[selectedPlayerId] = fullStats;
        setPlayerStats(fullStats);
      } catch (err) {
        logError("Error loading player statistics:", err);
        setLoadingPlayerStats(false);
      } finally {
        setLoadingRaceHistory(false);
      }
    };

    loadPlayerStatistics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayerId, championshipDeadlinePassed, user?.uid]);

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

  // Get label for chart headers based on players filter
  const playersLabel = playersFilter === "5"
    ? t("statistics.top5Players")
    : playersFilter === "10"
    ? t("statistics.top10Players")
    : t("statistics.allPlayers");

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
            className="mb-3 justify-content-center"
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
          {/* Current Ranking (left sidebar on desktop) */}
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
                      {currentRanking.map((player) => {
                        const medal = medals[player.position - 1] ?? player.position;
                        const isTop3 = player.position <= 3;

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

          {/* Charts Section (right side on desktop) */}
          <Col xs={12} lg={8}>
            {/* Filters */}
            <Card
              className="shadow mb-4"
              style={{
                borderColor: accentColor,
                backgroundColor: bgCard,
              }}
            >
              <Card.Body>
                <Row className="g-3">
                  <Col xs={12} md={6} className="text-center text-md-start">
                    <h6 className="mb-2 fw-semibold" style={{ color: accentColor }}>
                      👥 {t("statistics.playersToShow")}
                    </h6>
                    <div className="d-flex gap-2 flex-wrap justify-content-center justify-content-md-start">
                      <Button
                        size="sm"
                        variant={playersFilter === "5" ? "danger" : "outline-secondary"}
                        onClick={() => setPlayersFilter("5")}
                        style={{
                          backgroundColor: playersFilter === "5" ? accentColor : "transparent",
                          borderColor: playersFilter === "5" ? accentColor : (isDark ? "#6c757d" : "#dee2e6"),
                          color: playersFilter === "5" ? "#fff" : (isDark ? "#e9ecef" : "#212529"),
                        }}
                        aria-label="Show top 5 players in charts"
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
                        aria-label="Show top 10 players in charts"
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
                        aria-label="Show all players in charts"
                      >
                        {t("statistics.all")}
                      </Button>
                    </div>
                  </Col>

                  <Col xs={12} md={6} className="text-center text-md-start">
                    <h6 className="mb-2 fw-semibold" style={{ color: accentColor }}>
                      🏁 {t("statistics.racesToShow")}
                    </h6>
                    <div className="d-flex gap-2 flex-wrap justify-content-center justify-content-md-start">
                      <Button
                        size="sm"
                        variant={racesFilter === "5" ? "danger" : "outline-secondary"}
                        onClick={() => setRacesFilter("5")}
                        style={{
                          backgroundColor: racesFilter === "5" ? accentColor : "transparent",
                          borderColor: racesFilter === "5" ? accentColor : (isDark ? "#6c757d" : "#dee2e6"),
                          color: racesFilter === "5" ? "#fff" : (isDark ? "#e9ecef" : "#212529"),
                        }}
                        aria-label="Show last 5 races in charts"
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
                        aria-label="Show last 10 races in charts"
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
                        aria-label="Show all races in charts"
                      >
                        {t("statistics.allFeminine")}
                      </Button>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Charts */}
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
                        .map((player) => (
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
                        .map((player) => (
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
            {/* Player grid */}
            <div className="d-flex flex-wrap gap-2 mb-4">
              {currentRanking.map((player) => {
                const isSelected = selectedPlayerId === player.userId;
                const medal = medals[player.position - 1];
                return (
                  <Button
                    key={player.userId}
                    size="sm"
                    onClick={() => setSelectedPlayerId(isSelected ? null : player.userId)}
                    style={{
                      backgroundColor: isSelected ? accentColor : (isDark ? "var(--bg-secondary)" : "#f8f9fa"),
                      borderColor: isSelected ? accentColor : (isDark ? "var(--border-color)" : "#dee2e6"),
                      color: isSelected ? "#fff" : textColor,
                      fontWeight: isSelected ? "bold" : "normal",
                    }}
                  >
                    {medal ?? `${player.position}.`} {player.name}
                    <Badge bg={isSelected ? "light" : "secondary"} text={isSelected ? "dark" : undefined} className="ms-1" style={{ fontSize: "0.7rem" }}>
                      {player.points} pt
                    </Badge>
                  </Button>
                );
              })}
            </div>

            {/* Spinner solo per caricamento dati base (molto veloce) */}
            {loadingPlayerStats && (
              <div className="text-center py-4">
                <Spinner animation="border" size="sm" style={{ color: accentColor }} />
              </div>
            )}

            {/* Player stats view — mostra subito l'header, la history arriva dopo */}
            {playerStats && (
              <PlayerStatsView
                playerData={playerStats.playerData}
                firstName={playerStats.firstName}
                lastName={playerStats.lastName}
                photoURL={playerStats.photoURL}
                raceHistory={playerStats.raceHistory}
                totalCompletedRaces={playerStats.totalCompletedRaces}
                showCharts={!loadingRaceHistory}
                loadingHistory={loadingRaceHistory}
                showBackButton={false}
              />
            )}

            {/* No player selected */}
            {!loadingPlayerStats && !playerStats && selectedPlayerId === null && (
              <Alert variant="info" className="text-center">
                👆 {t("statistics.selectPlayerPrompt")}
              </Alert>
            )}
          </Col>
        </Row>
      )}
    </Container>
  );
}
