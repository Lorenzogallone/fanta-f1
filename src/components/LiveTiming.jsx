/**
 * @file LiveTiming.jsx
 * @description Live F1 session timing component using SignalR
 */

import React, { useState, useEffect } from "react";
import { Row, Col, Card, Badge, Table, Alert, Spinner } from "react-bootstrap";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../hooks/useLanguage";
import { getTireCompoundDisplay } from "../services/openF1Service";
import f1LiveTimingService from "../services/f1LiveTimingService";

/**
 * Tire compound badge component
 */
function TireBadge({ compound }) {
  const display = getTireCompoundDisplay(compound);

  return (
    <Badge
      style={{
        backgroundColor: display.background,
        color: display.color,
        fontWeight: "bold",
        fontSize: "0.9rem",
        padding: "4px 8px",
      }}
    >
      {display.letter}
    </Badge>
  );
}

/**
 * Live Timing Component using SignalR
 */
export default function LiveTiming() {
  const [timingData, setTimingData] = useState([]);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [sessionStatus, setSessionStatus] = useState(null);
  const [trackStatus, setTrackStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCorsError, setIsCorsError] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const { isDark } = useTheme();
  const { t } = useLanguage();

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";

  // Connect to SignalR on mount
  useEffect(() => {
    async function initializeSignalR() {
      try {
        setLoading(true);

        // Connect to F1 Live Timing
        const result = await f1LiveTimingService.connect();

        if (!result.success) {
          setError(result.message);
          setIsCorsError(result.isCorsError);
          setLoading(false);
          return;
        }

        setIsConnected(true);

        // Set up callbacks for data updates
        f1LiveTimingService.onSessionInfoUpdate = (data) => {
          setSessionInfo(data);
          setLoading(false);
        };

        f1LiveTimingService.onSessionStatusUpdate = (data) => {
          setSessionStatus(data);
        };

        f1LiveTimingService.onTrackStatusUpdate = (data) => {
          setTrackStatus(data);
        };

        f1LiveTimingService.onTimingDataUpdate = () => {
          const formatted = f1LiveTimingService.getFormattedTimingData();
          setTimingData(formatted);
        };

        f1LiveTimingService.onDriverListUpdate = () => {
          const formatted = f1LiveTimingService.getFormattedTimingData();
          setTimingData(formatted);
        };

        f1LiveTimingService.onPositionUpdate = () => {
          const formatted = f1LiveTimingService.getFormattedTimingData();
          setTimingData(formatted);
        };

        // Check initial connection state
        if (f1LiveTimingService.isConnected) {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error connecting to F1 Live Timing:", err);
        setError(t("liveTiming.errorLoading"));
        setLoading(false);
      }
    }

    initializeSignalR();

    // Cleanup on unmount
    return () => {
      f1LiveTimingService.disconnect();
    };
  }, [t]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" style={{ color: accentColor }} />
        <p className="mt-3">{t("liveTiming.loading")}</p>
      </div>
    );
  }

  if (error) {
    if (isCorsError) {
      return (
        <Card className="shadow" style={{ borderColor: accentColor, backgroundColor: bgCard }}>
          <Card.Body className="py-4">
            <Alert variant="warning" className="mb-3">
              <Alert.Heading className="h5">
                🚧 {t("liveTiming.corsError")}
              </Alert.Heading>
              <p className="mb-2">{t("liveTiming.corsExplanation")}</p>
              <hr />
              <p className="mb-2"><strong>{t("liveTiming.corsWorkaround")}</strong></p>
              <ul className="mb-0">
                <li>{t("liveTiming.corsOption1")}</li>
                <li>{t("liveTiming.corsOption2")}</li>
                <li>{t("liveTiming.corsOption3")}</li>
              </ul>
            </Alert>
            <div className="text-center">
              <small className="text-muted">
                API Endpoint: <code>livetiming.formula1.com/signalr</code>
              </small>
            </div>
          </Card.Body>
        </Card>
      );
    }
    return <Alert variant="danger">{error}</Alert>;
  }

  // Check if there's an active session
  const hasActiveSession = f1LiveTimingService.hasActiveSession();

  // No live session - show message
  if (!hasActiveSession || !sessionInfo) {
    return (
      <Card className="shadow" style={{ borderColor: accentColor, backgroundColor: bgCard }}>
        <Card.Body className="text-center py-5">
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🏁</div>
          <h4 style={{ color: accentColor }}>{t("liveTiming.noLiveSession")}</h4>
          <p className="text-muted mt-3">
            {isConnected
              ? "Connesso al server F1 Live Timing. In attesa di una sessione attiva..."
              : "Connessione al server F1 Live Timing..."}
          </p>
        </Card.Body>
      </Card>
    );
  }

  // Determine session type
  const sessionType = sessionInfo.Type || "";
  const isQualifying = sessionType.toLowerCase().includes("qualifying");
  const isRace = sessionType.toLowerCase().includes("race");

  return (
    <div>
      {/* Session Header */}
      <Card className="shadow mb-4" style={{ borderColor: accentColor, backgroundColor: bgCard }}>
        <Card.Body>
          <Row className="align-items-center">
            <Col xs={12} md={8}>
              <div className="d-flex align-items-center gap-2">
                <Badge bg="danger" className="pulse-badge" style={{ fontSize: "1rem" }}>
                  🔴 LIVE
                </Badge>
                <h4 className="mb-0">
                  {sessionInfo.Meeting?.Name || "F1 Session"} - {sessionInfo.Name || sessionType}
                </h4>
              </div>
              <p className="text-muted mb-0 mt-1">
                Status: <strong>{sessionStatus || "In Progress"}</strong>
                {trackStatus && ` | Track: ${trackStatus}`}
              </p>
            </Col>
            <Col xs={12} md={4} className="text-md-end mt-3 mt-md-0">
              <small className="text-muted">
                Lap: {f1LiveTimingService.getLapCount() || "—"}
              </small>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Timing Table */}
      <Card className="shadow" style={{ borderColor: accentColor, backgroundColor: bgCard }}>
        <Card.Header style={{ backgroundColor: isDark ? "var(--bg-tertiary)" : "#f8f9fa" }}>
          <h5 className="mb-0">⏱️ {t("liveTiming.timingTable")}</h5>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0" style={{ fontSize: "0.9rem" }}>
              <thead>
                <tr>
                  <th className="text-center" style={{ width: "60px" }}>{t("liveTiming.pos")}</th>
                  <th style={{ width: "50px" }}>#</th>
                  <th>{t("liveTiming.driver")}</th>
                  <th className="text-center">{t("liveTiming.tire")}</th>
                  {isQualifying && (
                    <>
                      <th className="text-end">{t("liveTiming.q1")}</th>
                      <th className="text-end">{t("liveTiming.q2")}</th>
                      <th className="text-end">{t("liveTiming.q3")}</th>
                    </>
                  )}
                  {isRace && (
                    <th className="text-center">{t("liveTiming.pits")}</th>
                  )}
                  {!isQualifying && (
                    <th className="text-end">{t("liveTiming.gap")}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {timingData.length === 0 ? (
                  <tr>
                    <td colSpan={isQualifying ? 7 : (isRace ? 6 : 5)} className="text-center text-muted py-4">
                      {t("liveTiming.loading")}
                    </td>
                  </tr>
                ) : (
                  timingData.map((driver, idx) => {
                    // Determine elimination status for qualifying
                    const position = typeof driver.position === "number" ? driver.position : parseInt(driver.position) || 999;
                    const isEliminatedQ1 = isQualifying && position > 15;
                    const isEliminatedQ2 = isQualifying && position > 10 && position <= 15;
                    const rowStyle = isEliminatedQ1 || isEliminatedQ2
                      ? { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)" }
                      : {};

                    return (
                      <tr key={driver.number} style={rowStyle}>
                        <td className="text-center fw-bold">
                          {driver.position}
                          {isEliminatedQ1 && (
                            <Badge bg="secondary" className="ms-1" style={{ fontSize: "0.65rem" }}>
                              {t("liveTiming.eliminated")}
                            </Badge>
                          )}
                          {isEliminatedQ2 && (
                            <Badge bg="warning" className="ms-1" style={{ fontSize: "0.65rem" }}>
                              {t("liveTiming.eliminated")}
                            </Badge>
                          )}
                        </td>
                        <td className="fw-semibold">{driver.number}</td>
                        <td>
                          <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center">
                            <span className="me-2 fw-semibold">{driver.name}</span>
                            <small className="text-muted">{driver.team}</small>
                          </div>
                        </td>
                        <td className="text-center">
                          <TireBadge compound={driver.compound} />
                        </td>
                        {isQualifying && (
                          <>
                            <td className="text-end">
                              <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                                {driver.q1 || "—"}
                              </span>
                            </td>
                            <td className="text-end">
                              <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                                {driver.q2 || "—"}
                              </span>
                            </td>
                            <td className="text-end">
                              <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                                {driver.q3 || "—"}
                              </span>
                            </td>
                          </>
                        )}
                        {isRace && (
                          <td className="text-center">{driver.pitStops}</td>
                        )}
                        {!isQualifying && (
                          <td className="text-end text-muted">{driver.gap}</td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      <style>{`
        .pulse-badge {
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}
