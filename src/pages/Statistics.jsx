// src/pages/Statistics.jsx
import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  Table,
  Badge,
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
import { getChampionshipStatistics } from "../services/statisticsService";
import { useTheme } from "../contexts/ThemeContext";

const medals = ["🥇", "🥈", "🥉"];

// Colori per i grafici di ogni giocatore
const PLAYER_COLORS = [
  "#dc3545", // rosso
  "#0d6efd", // blu
  "#198754", // verde
  "#ffc107", // giallo
  "#6f42c1", // viola
  "#fd7e14", // arancione
  "#20c997", // teal
  "#d63384", // pink
  "#6c757d", // grigio
  "#0dcaf0", // cyan
];

export default function Statistics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [currentRanking, setCurrentRanking] = useState([]);
  const { isDark } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        const data = await getChampionshipStatistics();
        setStatistics(data);

        // Calcola la classifica attuale (ultima gara)
        const ranking = Object.keys(data.playerNames)
          .map(userId => {
            const history = data.playersData[userId] || [];
            const lastRace = history[history.length - 1];
            return {
              userId,
              name: data.playerNames[userId],
              points: lastRace ? lastRace.cumulativePoints : 0,
              position: lastRace ? lastRace.position : null,
            };
          })
          .sort((a, b) => b.points - a.points);

        setCurrentRanking(ranking);
      } catch (err) {
        console.error(err);
        setError("Impossibile caricare le statistiche del campionato.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";
  const bgHeader = isDark ? "var(--bg-tertiary)" : "#ffffff";
  const textColor = isDark ? "#e9ecef" : "#212529";
  const gridColor = isDark ? "#495057" : "#dee2e6";

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p className="mt-3">Caricamento statistiche...</p>
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
          Nessuna gara disponibile per le statistiche.
        </Alert>
      </Container>
    );
  }

  // Prepara i dati per il grafico dei punti cumulativi
  const pointsChartData = statistics.races.map((race, raceIndex) => {
    const dataPoint = {
      name: `R${race.round}`,
      fullName: race.name,
    };

    currentRanking.forEach(player => {
      const history = statistics.playersData[player.userId] || [];
      const raceData = history[raceIndex];
      dataPoint[player.name] = raceData ? raceData.cumulativePoints : 0;
    });

    return dataPoint;
  });

  // Prepara i dati per il grafico delle posizioni (invertito: 1° in alto)
  const positionChartData = statistics.races.map((race, raceIndex) => {
    const dataPoint = {
      name: `R${race.round}`,
      fullName: race.name,
    };

    currentRanking.forEach(player => {
      const history = statistics.playersData[player.userId] || [];
      const raceData = history[raceIndex];
      dataPoint[player.name] = raceData ? raceData.position : null;
    });

    return dataPoint;
  });

  // Custom tooltip per mostrare il nome completo della gara
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
            Statistiche Campionato
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
              Classifica Attuale
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
                      <th>Giocatore</th>
                      <th className="text-center">Punti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRanking.map((player, idx) => {
                      const medal = medals[idx] ?? idx + 1;
                      const isTop3 = idx < 3;
                      const playerColor = PLAYER_COLORS[idx % PLAYER_COLORS.length];

                      return (
                        <tr key={player.userId} className={isTop3 ? "fw-bold" : ""}>
                          <td className="text-center">{medal}</td>
                          <td>
                            <span
                              style={{
                                color: playerColor,
                                fontWeight: "500",
                              }}
                            >
                              {player.name}
                            </span>
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
              Andamento Punti Cumulativi
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
                      value: "Punti",
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: textColor },
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "0.85rem" }}
                    iconType="line"
                  />
                  {currentRanking.map((player, idx) => (
                    <Line
                      key={player.userId}
                      type="monotone"
                      dataKey={player.name}
                      stroke={PLAYER_COLORS[idx % PLAYER_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
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
              Andamento Posizioni in Classifica
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
                      value: "Posizione",
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: textColor },
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "0.85rem" }}
                    iconType="line"
                  />
                  {currentRanking.map((player, idx) => (
                    <Line
                      key={player.userId}
                      type="monotone"
                      dataKey={player.name}
                      stroke={PLAYER_COLORS[idx % PLAYER_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Statistiche dettagliate per ogni giocatore */}
      <Row className="mt-4">
        <Col xs={12}>
          <h4 className="mb-3" style={{ color: accentColor }}>
            Dettaglio per Giocatore
          </h4>
        </Col>
        {currentRanking.map((player, idx) => {
          const history = statistics.playersData[player.userId] || [];
          const playerColor = PLAYER_COLORS[idx % PLAYER_COLORS.length];

          // Calcola statistiche
          const totalRaces = history.length;
          const bestPosition = Math.min(...history.map(h => h.position));
          const worstPosition = Math.max(...history.map(h => h.position));
          const bestRacePoints = Math.max(...history.map(h => h.points));
          const worstRacePoints = Math.min(...history.map(h => h.points));
          const avgPointsPerRace = totalRaces > 0
            ? (player.points / totalRaces).toFixed(1)
            : 0;

          return (
            <Col key={player.userId} xs={12} lg={6} className="mb-4">
              <Card
                className="shadow"
                style={{
                  borderLeft: `4px solid ${playerColor}`,
                  backgroundColor: bgCard,
                }}
              >
                <Card.Header
                  style={{
                    backgroundColor: bgHeader,
                    borderBottom: `2px solid ${playerColor}`,
                  }}
                >
                  <h6 className="mb-0" style={{ color: playerColor }}>
                    {idx + 1}. {player.name}
                  </h6>
                </Card.Header>
                <Card.Body>
                  <Row className="g-2">
                    <Col xs={6} sm={4}>
                      <div className="text-center p-2 rounded" style={{ backgroundColor: isDark ? "#2a2a2a" : "#f8f9fa" }}>
                        <small className="text-muted d-block">Punti Totali</small>
                        <strong style={{ color: playerColor }}>{player.points}</strong>
                      </div>
                    </Col>
                    <Col xs={6} sm={4}>
                      <div className="text-center p-2 rounded" style={{ backgroundColor: isDark ? "#2a2a2a" : "#f8f9fa" }}>
                        <small className="text-muted d-block">Media Gara</small>
                        <strong style={{ color: playerColor }}>{avgPointsPerRace}</strong>
                      </div>
                    </Col>
                    <Col xs={6} sm={4}>
                      <div className="text-center p-2 rounded" style={{ backgroundColor: isDark ? "#2a2a2a" : "#f8f9fa" }}>
                        <small className="text-muted d-block">Gare</small>
                        <strong style={{ color: playerColor }}>{totalRaces}</strong>
                      </div>
                    </Col>
                    <Col xs={6} sm={4}>
                      <div className="text-center p-2 rounded" style={{ backgroundColor: isDark ? "#2a2a2a" : "#f8f9fa" }}>
                        <small className="text-muted d-block">Miglior Pos.</small>
                        <strong style={{ color: playerColor }}>{bestPosition}°</strong>
                      </div>
                    </Col>
                    <Col xs={6} sm={4}>
                      <div className="text-center p-2 rounded" style={{ backgroundColor: isDark ? "#2a2a2a" : "#f8f9fa" }}>
                        <small className="text-muted d-block">Peggior Pos.</small>
                        <strong style={{ color: playerColor }}>{worstPosition}°</strong>
                      </div>
                    </Col>
                    <Col xs={6} sm={4}>
                      <div className="text-center p-2 rounded" style={{ backgroundColor: isDark ? "#2a2a2a" : "#f8f9fa" }}>
                        <small className="text-muted d-block">Miglior Gara</small>
                        <strong style={{ color: playerColor }}>
                          {bestRacePoints > 0 ? `+${bestRacePoints}` : bestRacePoints}
                        </strong>
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>
    </Container>
  );
}
