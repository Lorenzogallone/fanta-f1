/**
 * @file LiveTiming.jsx
 * @description Live F1 session timing component
 */

import React, { useState, useEffect } from "react";
import { Row, Col, Card, Badge, Table, Alert, Spinner } from "react-bootstrap";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../hooks/useLanguage";
import {
  getCurrentLiveSession,
  getNextSession,
  getSessionPositions,
  getSessionLaps,
  getSessionStints,
  getSessionPitStops,
  getSessionDrivers,
  getTireCompoundDisplay,
} from "../services/openF1Service";

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
 * Live Timing Component
 */
export default function LiveTiming() {
  const [liveSession, setLiveSession] = useState(null);
  const [nextSession, setNextSession] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [stints, setStints] = useState([]);
  const [pitStops, setPitStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { isDark } = useTheme();
  const { t } = useLanguage();

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";

  // Check for live session on mount and every 30 seconds
  useEffect(() => {
    checkLiveSession();
    const interval = setInterval(checkLiveSession, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch session data when live session changes
  useEffect(() => {
    if (liveSession) {
      fetchSessionData();
      const interval = setInterval(fetchSessionData, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
  }, [liveSession]);

  async function checkLiveSession() {
    try {
      const live = await getCurrentLiveSession();
      setLiveSession(live);

      if (!live) {
        const next = await getNextSession();
        setNextSession(next);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error checking live session:", err);
      setError(t("liveTiming.errorLoading"));
      setLoading(false);
    }
  }

  async function fetchSessionData() {
    if (!liveSession) return;

    try {
      const [driversData, positionsData, stintsData, pitStopsData] = await Promise.all([
        getSessionDrivers(liveSession.session_key),
        getSessionPositions(liveSession.session_key),
        getSessionStints(liveSession.session_key),
        getSessionPitStops(liveSession.session_key),
      ]);

      setDrivers(driversData);
      setPositions(positionsData);
      setStints(stintsData);
      setPitStops(pitStopsData);
    } catch (err) {
      console.error("Error fetching session data:", err);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" style={{ color: accentColor }} />
        <p className="mt-3">{t("liveTiming.loading")}</p>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  // No live session - show next session info
  if (!liveSession) {
    return (
      <Card className="shadow" style={{ borderColor: accentColor, backgroundColor: bgCard }}>
        <Card.Body className="text-center py-5">
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🏁</div>
          <h4 style={{ color: accentColor }}>{t("liveTiming.noLiveSession")}</h4>
          {nextSession && (
            <div className="mt-4">
              <h5>{t("liveTiming.nextSession")}</h5>
              <p className="mb-1">
                <strong>{nextSession.session_name}</strong> - {nextSession.meeting_official_name}
              </p>
              <p className="text-muted">
                {new Date(nextSession.date_start).toLocaleString(t("dateTime.locale"), {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}
        </Card.Body>
      </Card>
    );
  }

  // Live session active - show timing data
  const isQualifying = liveSession.session_name?.toLowerCase().includes("qualifying");
  const isRace = liveSession.session_name?.toLowerCase().includes("race");

  // Get latest position for each driver
  const latestPositions = {};
  positions.forEach(pos => {
    if (!latestPositions[pos.driver_number] || new Date(pos.date) > new Date(latestPositions[pos.driver_number].date)) {
      latestPositions[pos.driver_number] = pos;
    }
  });

  // Get current stint for each driver
  const currentStints = {};
  stints.forEach(stint => {
    if (!currentStints[stint.driver_number] || stint.stint_number > currentStints[stint.driver_number].stint_number) {
      currentStints[stint.driver_number] = stint;
    }
  });

  // Combine data for display
  const timingData = drivers.map(driver => {
    const position = latestPositions[driver.driver_number];
    const stint = currentStints[driver.driver_number];
    const driverPits = pitStops.filter(pit => pit.driver_number === driver.driver_number);

    return {
      ...driver,
      position: position?.position || "—",
      compound: stint?.compound || "UNKNOWN",
      pitCount: driverPits.length,
      gap: position?.gap_to_leader || "—",
    };
  }).sort((a, b) => {
    const posA = typeof a.position === "number" ? a.position : 999;
    const posB = typeof b.position === "number" ? b.position : 999;
    return posA - posB;
  });

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
                <h4 className="mb-0">{liveSession.session_name}</h4>
              </div>
              <p className="text-muted mb-0 mt-1">{liveSession.meeting_official_name}</p>
            </Col>
            <Col xs={12} md={4} className="text-md-end mt-3 mt-md-0">
              <small className="text-muted">
                {t("liveTiming.started")}: {new Date(liveSession.date_start).toLocaleTimeString()}
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
                  {isRace && (
                    <th className="text-center">{t("liveTiming.pits")}</th>
                  )}
                  <th className="text-end">{t("liveTiming.gap")}</th>
                </tr>
              </thead>
              <tbody>
                {timingData.map((driver, idx) => (
                  <tr key={driver.driver_number}>
                    <td className="text-center fw-bold">{driver.position}</td>
                    <td className="fw-semibold">{driver.driver_number}</td>
                    <td>
                      <div className="d-flex align-items-center">
                        <span className="me-2">{driver.name_acronym}</span>
                        <small className="text-muted">{driver.team_name}</small>
                      </div>
                    </td>
                    <td className="text-center">
                      <TireBadge compound={driver.compound} />
                    </td>
                    {isRace && (
                      <td className="text-center">{driver.pitCount}</td>
                    )}
                    <td className="text-end text-muted">
                      {typeof driver.gap === "number" ? `+${driver.gap.toFixed(3)}` : driver.gap}
                    </td>
                  </tr>
                ))}
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
