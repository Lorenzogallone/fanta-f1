/**
 * @file ParticipantDetail.jsx
 * @description Detailed participant profile page showing race history, statistics, and formations
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  Badge,
  Table,
  Button,
} from "react-bootstrap";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { DRIVER_TEAM, TEAM_LOGOS, POINTS } from "../constants/racing";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * Displays driver name with team logo
 * @param {Object} props - Component props
 * @param {string} props.name - Driver name
 * @returns {JSX.Element} Driver name with team logo
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
 * @param {Object} props - Component props
 * @param {string} props.name - Team name
 * @returns {JSX.Element} Team name with logo
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
 * Participant detail page showing complete user profile and statistics
 * @returns {JSX.Element} Participant detail page
 */
export default function ParticipantDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { t } = useLanguage();

  const [participant, setParticipant] = useState(null);
  const [raceHistory, setRaceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";
  const bgHeader = isDark ? "var(--bg-tertiary)" : "#ffffff";

  /**
   * Load participant data and race history
   */
  useEffect(() => {
    (async () => {
      try {
        // Load participant basic info from ranking
        const userDoc = await getDoc(doc(db, "ranking", userId));
        if (!userDoc.exists()) {
          setError(t("participantDetail.notFound"));
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        setParticipant({
          userId,
          name: userData.name,
          puntiTotali: userData.puntiTotali || 0,
          jolly: userData.jolly ?? 0,
          championshipPiloti: userData.championshipPiloti || [],
          championshipCostruttori: userData.championshipCostruttori || [],
          championshipPts: userData.championshipPts || 0,
        });

        // Load all past races
        const now = Timestamp.now();
        const racesSnap = await getDocs(
          query(
            collection(db, "races"),
            where("raceUTC", "<", now),
            orderBy("raceUTC", "desc")
          )
        );

        // Load submissions for each race
        const history = [];
        for (const raceDoc of racesSnap.docs) {
          const raceData = raceDoc.data();
          const submissionDoc = await getDoc(
            doc(db, "races", raceDoc.id, "submissions", userId)
          );

          if (submissionDoc.exists()) {
            const subData = submissionDoc.data();
            history.push({
              raceId: raceDoc.id,
              raceName: raceData.name,
              round: raceData.round,
              raceUTC: raceData.raceUTC,
              submission: subData,
              officialResults: raceData.officialResults,
            });
          }
        }

        setRaceHistory(history);
      } catch (e) {
        console.error("Error loading participant:", e);
        setError(t("errors.generic"));
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, t]);

  // Calculate statistics
  const totalRaces = raceHistory.length;
  const averagePoints = totalRaces > 0
    ? (participant?.puntiTotali / totalRaces).toFixed(1)
    : 0;

  // Count total completed races (from all races collection)
  const [totalCompletedRaces, setTotalCompletedRaces] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const now = Timestamp.now();
        const racesSnap = await getDocs(
          query(
            collection(db, "races"),
            where("raceUTC", "<", now)
          )
        );
        setTotalCompletedRaces(racesSnap.size);
      } catch (e) {
        console.error("Error counting races:", e);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          {t("common.back")}
        </Button>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <Button
        variant="link"
        className="mb-3 p-0"
        onClick={() => navigate(-1)}
        style={{ color: accentColor }}
      >
        ← {t("common.back")}
      </Button>

      <Row className="g-4">
        {/* ============ PARTICIPANT INFO ============ */}
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
                👤 {participant?.name}
              </h3>
            </Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col xs={6} md={3}>
                  <div className="text-center">
                    <div className="text-muted small">{t("leaderboard.totalPoints")}</div>
                    <div className="fs-2 fw-bold" style={{ color: accentColor }}>
                      {participant?.puntiTotali}
                    </div>
                  </div>
                </Col>
                <Col xs={6} md={3}>
                  <div className="text-center">
                    <div className="text-muted small">{t("participantDetail.lineupsSubmitted")}</div>
                    <div className="fs-2 fw-bold" style={{ color: accentColor }}>
                      {totalRaces}/{totalCompletedRaces}
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
                <Col xs={6} md={3}>
                  <div className="text-center">
                    <div className="text-muted small">{t("leaderboard.jokers")}</div>
                    <div className="fs-2 fw-bold">
                      <Badge bg={participant?.jolly > 0 ? "success" : "secondary"} style={{ fontSize: "1.5rem" }}>
                        {participant?.jolly}
                      </Badge>
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>

        {/* ============ CHAMPIONSHIP FORMATION ============ */}
        {participant?.championshipPiloti?.length === 3 && (
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
                  {participant.championshipPiloti.map((driver, idx) => (
                    <div key={idx} className="py-1 border-bottom d-flex align-items-center">
                      <span className="text-muted me-2" style={{ minWidth: "25px" }}>{idx + 1}°</span>
                      <DriverWithLogo name={driver} />
                    </div>
                  ))}
                </div>

                {participant.championshipCostruttori?.length === 3 && (
                  <>
                    <h6 className="fw-bold mb-2 mt-3">{t("history.constructors")}</h6>
                    <div>
                      {participant.championshipCostruttori.map((team, idx) => (
                        <div key={idx} className="py-1 border-bottom d-flex align-items-center">
                          <span className="text-muted me-2" style={{ minWidth: "25px" }}>{idx + 1}°</span>
                          <TeamWithLogo name={team} />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {participant.championshipPts > 0 && (
                  <div className="mt-3 text-center">
                    <Badge bg="success" style={{ fontSize: "1rem" }}>
                      {participant.championshipPts} {t("common.points")}
                    </Badge>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>
    </Container>
  );
}
