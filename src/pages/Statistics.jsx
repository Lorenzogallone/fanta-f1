/**
 * @file Statistics.jsx
 * @description Championship statistics page with ranking trends and cumulative points charts
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Row,
  Col,
  Spinner,
  Alert,
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
import "../styles/cards.css";
import "../styles/stats.css";

// Categorical palette validated for color-blind separation (dataviz skill),
// one set per theme. Players after the 8th are drawn in grey.
const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const SERIES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

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
  const navigate = useNavigate();

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

    const wanted = racesFilter === "5" ? 5 : racesFilter === "10" ? 10 : statistics.races.length;
    const numRaces = Math.min(wanted, statistics.races.length);
    const filteredRaces = statistics.races.slice(-numRaces);
    const startIndex = statistics.races.length - numRaces;

    const points = filteredRaces.map((race, idx) => {
      const raceIndex = startIndex + idx;
      const dataPoint = { name: race.label, fullName: race.isChampionship ? t("statistics.championshipStep") : race.name };
      topPlayers.forEach(player => {
        const history = statistics.playersData[player.userId] || [];
        const raceData = history[raceIndex];
        dataPoint[player.name] = raceData ? raceData.cumulativePoints : 0;
      });
      return dataPoint;
    });

    const positions = filteredRaces.map((race, idx) => {
      const raceIndex = startIndex + idx;
      const dataPoint = { name: race.label, fullName: race.isChampionship ? t("statistics.championshipStep") : race.name };
      topPlayers.forEach(player => {
        const history = statistics.playersData[player.userId] || [];
        const raceData = history[raceIndex];
        dataPoint[player.name] = raceData ? raceData.position : null;
      });
      return dataPoint;
    });

    return { pointsChartData: points, positionChartData: positions };
  }, [statistics, racesFilter, topPlayers, t]);

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
          pointsByRace: userData.pointsByRace || {},
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
  const textColor = isDark ? "#adb5bd" : "#6c757d";
  const gridColor = isDark ? "#3a3a3a" : "#e9ecef";
  const palette = isDark ? SERIES_DARK : SERIES_LIGHT;
  const otherColor = isDark ? "#5c5c5c" : "#c4c4c4";
  // Color follows the player's slot in the ranking; after 8 players, grey
  const seriesColor = (idx) => (idx < palette.length ? palette[idx] : otherColor);

  // Show loading only if ranking hasn't loaded yet
  if (loadingRanking && currentRanking.length === 0) {
    return (
      <div className="py-5 text-center">
        <Spinner animation="border" />
        <p className="mt-3">{t("statistics.loading")}</p>
      </div>
    );
  }

  if (error && currentRanking.length === 0) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const playersLabel = playersFilter === "5"
    ? t("statistics.top5Players")
    : playersFilter === "10"
    ? t("statistics.top10Players")
    : t("statistics.allPlayers");

  const orderedPlayers = [...topPlayers].sort((a, b) => a.position - b.position);

  /**
   * Tooltip: full race name, then players sorted by value
   */
  const CustomTooltip = ({ active, payload, label, reversed = false }) => {
    if (!active || !payload?.length) return null;
    const fullName = payload[0]?.payload?.fullName || label;
    const rows = [...payload]
      .filter((p) => p.value !== null && p.value !== undefined)
      .sort((a, b) => (reversed ? a.value - b.value : b.value - a.value));
    return (
      <div className="stats-tooltip">
        <div className="stats-tooltip-title">{fullName}</div>
        {rows.map((entry) => (
          <div key={entry.dataKey} className="stats-tooltip-row">
            <span className="stats-tooltip-dot" style={{ backgroundColor: entry.color }} />
            <span className="stats-tooltip-name">{entry.name}</span>
            <span className="stats-tooltip-value">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const Segmented = ({ value, onChange, options, small }) => (
    <div className={`fx-segmented${small ? " is-small" : ""}`} role="group">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          className={`fx-segment${value === o.key ? " is-active" : ""}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  const renderLines = () =>
    orderedPlayers.map((player, idx) => {
      const isMe = player.userId === user?.uid;
      return (
        <Line
          key={player.userId}
          type="monotone"
          dataKey={player.name}
          stroke={seriesColor(idx)}
          strokeWidth={isMe ? 3 : 2}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls
        />
      );
    });

  const ChartCard = ({ title, children }) => (
    <div className="fx-card stats-chart">
      <h2 className="fx-card-title">{title} <span className="stats-chart-sub">· {playersLabel}</span></h2>
      {children}
    </div>
  );

  const axisProps = { stroke: textColor, tickLine: false, axisLine: false, style: { fontSize: "0.72rem" } };
  const legendProps = { wrapperStyle: { fontSize: "0.72rem", paddingTop: 8 }, iconType: "plainline", iconSize: 14 };

  return (
    <div className="fx stats-page">
      <div className="stats-head">
        <h1 className="stats-title">{t("statistics.title")}</h1>
      </div>

      <div className="mb-3">
        <Segmented
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { key: "general", label: t("statistics.generalRanking") },
            { key: "player", label: t("statistics.playerStatistics") },
          ]}
        />
      </div>

      {/* ============ GENERAL ============ */}
      {activeTab === "general" && (
        <Row className="g-3 g-lg-4">
          {/* Ranking */}
          <Col xs={12} lg={4}>
            <div className="fx-card stats-ranking">
              <h2 className="fx-card-title stats-card-title">{t("statistics.currentRanking")}</h2>
              {currentRanking.map((player) => (
                <button
                  key={player.userId}
                  type="button"
                  className={`stats-rank-row${player.userId === user?.uid ? " is-me" : ""}`}
                  onClick={() => navigate(`/participant/${player.userId}`)}
                >
                  <span className={`stats-rank-pos${player.position <= 3 ? " is-top" : ""}`}>{player.position}</span>
                  <span className="stats-rank-name">{player.name}</span>
                  <span className="stats-rank-pts">{player.points}</span>
                  <span className="stats-rank-chevron" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </Col>

          {/* Charts */}
          <Col xs={12} lg={8}>
            <div className="stats-filters">
              <div>
                <div className="fx-eyebrow mb-1">{t("statistics.playersToShow")}</div>
                <Segmented
                  small
                  value={playersFilter}
                  onChange={setPlayersFilter}
                  options={[
                    { key: "5", label: "Top 5" },
                    { key: "10", label: "Top 10" },
                    { key: "all", label: t("statistics.all") },
                  ]}
                />
              </div>
              <div>
                <div className="fx-eyebrow mb-1">{t("statistics.racesToShow")}</div>
                <Segmented
                  small
                  value={racesFilter}
                  onChange={setRacesFilter}
                  options={[
                    { key: "5", label: `${t("statistics.last")} 5` },
                    { key: "10", label: `${t("statistics.last")} 10` },
                    { key: "all", label: t("statistics.allFeminine") },
                  ]}
                />
              </div>
            </div>

            {loadingStatistics ? (
              <div className="fx-card stats-empty">
                <Spinner animation="border" size="sm" className="me-2" />
                {t("statistics.loadingCharts") || "Loading charts..."}
              </div>
            ) : statistics && statistics.races && statistics.races.length > 0 ? (
              <div className="d-flex flex-column gap-3">
                <ChartCard title={t("statistics.pointsProgression")}>
                  <ResponsiveContainer width="100%" height={340}>
                    <LineChart data={pointsChartData} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={gridColor} />
                      <XAxis dataKey="name" {...axisProps} />
                      <YAxis {...axisProps} width={44} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend {...legendProps} />
                      {renderLines()}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title={t("statistics.positionProgression")}>
                  <ResponsiveContainer width="100%" height={340}>
                    <LineChart data={positionChartData} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={gridColor} />
                      <XAxis dataKey="name" {...axisProps} />
                      <YAxis
                        {...axisProps}
                        width={36}
                        reversed
                        allowDecimals={false}
                        domain={[1, Math.max(1, currentRanking.length)]}
                      />
                      <Tooltip content={<CustomTooltip reversed />} />
                      <Legend {...legendProps} />
                      {renderLines()}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            ) : (
              <div className="fx-card stats-empty">{t("statistics.noRaces") || "No race data available yet"}</div>
            )}
          </Col>
        </Row>
      )}

      {/* ============ PLAYER ============ */}
      {activeTab === "player" && (
        <>
          <div className="stats-player-picker" role="listbox" aria-label={t("statistics.playerStatistics")}>
            {currentRanking.map((player) => {
              const isSelected = selectedPlayerId === player.userId;
              return (
                <button
                  key={player.userId}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`stats-chip${isSelected ? " is-active" : ""}`}
                  onClick={() => setSelectedPlayerId(isSelected ? null : player.userId)}
                >
                  <span className="stats-chip-pos">{player.position}</span>
                  {player.name}
                </button>
              );
            })}
          </div>

          {loadingPlayerStats && (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" style={{ color: accentColor }} />
            </div>
          )}

          {playerStats && (
            <PlayerStatsView
              playerData={playerStats.playerData}
              firstName={playerStats.firstName}
              lastName={playerStats.lastName}
              photoURL={playerStats.photoURL}
              raceHistory={playerStats.raceHistory}
              pointsByRace={playerStats.pointsByRace}
              totalCompletedRaces={playerStats.totalCompletedRaces}
              showCharts={!loadingRaceHistory}
              loadingHistory={loadingRaceHistory}
              showBackButton={false}
              positionData={
                statistics?.playersData?.[selectedPlayerId]
                  ? statistics.playersData[selectedPlayerId]
                      .filter(d => d.position !== undefined)
                      .map(d => ({
                        round: d.raceRound,
                        label: d.raceLabel,
                        name: d.isChampionship ? t("statistics.championshipStep") : d.raceName,
                        position: d.position,
                      }))
                  : []
              }
            />
          )}

          {!loadingPlayerStats && !playerStats && selectedPlayerId === null && (
            <div className="fx-card stats-empty">{t("statistics.selectPlayerPrompt")}</div>
          )}
        </>
      )}
    </div>
  );
}
