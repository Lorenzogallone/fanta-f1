/**
 * @file SubmissionsList.jsx
 * Displays race lineup submissions with team logos and responsive layout.
 */
import React, { useState, useEffect } from "react";
import {
  Card, Table, Spinner, Alert, Badge,
} from "react-bootstrap";
import {
  collection, query, orderBy, getDocs,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { DRIVER_TEAM, TEAM_LOGOS } from "../constants/racing";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";

// Use centralized constants
const driverTeam = DRIVER_TEAM;
const teamLogos = TEAM_LOGOS;

/**
 * Displays driver name with team logo or dash if not provided.
 * @param {Object} props - Component props
 * @param {string} props.driverName - Driver name
 * @returns {JSX.Element} Driver cell with logo
 */
function DriverCell({ driverName }) {
  if (!driverName) return <>—</>;
  const team = driverTeam[driverName];
  const logo = teamLogos[team];
  return (
    <span className="d-flex align-items-center">
      {logo && (
        <img
          src={logo}
          alt={team}
          style={{ height: 20, width: 20, objectFit: "contain", marginRight: 4 }}
        />
      )}
      {driverName}
    </span>
  );
}

/**
 * Displays submitted race lineups with responsive mobile/desktop layouts.
 * @param {Object} props - Component props
 * @param {string} props.raceId - Selected race ID
 * @param {boolean} props.hasSprint - Whether race has a sprint
 * @param {number} props.refresh - Timestamp to force reload
 * @returns {JSX.Element} Submissions list
 */
function SubmissionsList({ raceId, hasSprint, refresh }) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [subs,    setSubs] = useState([]);
  const [loading, setLoad] = useState(true);
  const [error,   setErr ] = useState(null);

  // Fetch submissions from Firestore
  useEffect(() => {
    if (!raceId) {
      setSubs([]);
      setLoad(false);
      return;
    }

    (async () => {
      setLoad(true);
      setErr(null);
      try {
        const q = query(
          collection(db, "races", raceId, "submissions"),
          orderBy("user")
        );
        const snap = await getDocs(q);
        setSubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
        setErr("Unable to load lineups.");
      } finally {
        setLoad(false);
      }
    })();
  }, [raceId, refresh]);

  // Loading state
  if (loading)
    return (
      <Card className="mt-4 shadow">
        <Card.Body className="text-center">
          <Spinner animation="border" />
        </Card.Body>
      </Card>
    );

  if (error)
    return <Alert variant="danger" className="mt-4">{error}</Alert>;

  if (!subs.length)
    return (
      <Alert variant="info" className="mt-4">
        No lineups submitted for this race yet.
      </Alert>
    );

  // Render submissions list
  const headerBase = ["#", t("leaderboard.player"), "P1", "P2", "P3", t("formations.joker")];
  const headerSprint = ["SP1", "SP2", "SP3", `${t("formations.joker")} SP`];
  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";

  return (
    <Card
      className="mt-4 shadow h-100"
      style={{
        borderLeft: `4px solid ${accentColor}`,
        backgroundColor: bgCard
      }}
    >
      <Card.Body>
        <Card.Title className="text-center mb-3">
          Submitted Lineups
        </Card.Title>

        {/* Mobile layout - cards */}
        <div className="d-lg-none">
          {subs.map((s, i) => {
            const PickLine = ({ label, driver }) => (
              <div className="d-flex justify-content-between align-items-center py-1 border-bottom" style={{ fontSize: "0.9rem" }}>
                <span className="text-muted">{label}</span>
                <div className="d-flex align-items-center">
                  {driver ? <DriverCell driverName={driver} /> : <span className="text-muted">—</span>}
                </div>
              </div>
            );

            return (
              <Card key={s.id} className="mb-3" style={{ borderLeft: `3px solid ${accentColor}` }}>
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0" style={{ color: accentColor }}>
                      {i + 1}. {s.user}
                      {s.isLate && (
                        <Badge bg="warning" text="dark" className="ms-2">
                          ⏰ {t("formations.lateSubmission")} (-3)
                        </Badge>
                      )}
                    </h6>
                  </div>

                  <div className="mb-2">
                    <strong className="text-muted" style={{ fontSize: "0.85rem" }}>{t("formations.mainRace").toUpperCase()}</strong>
                    <PickLine label="P1" driver={s.mainP1} />
                    <PickLine label="P2" driver={s.mainP2} />
                    <PickLine label="P3" driver={s.mainP3} />
                    <PickLine label={t("formations.joker")} driver={s.mainJolly} />
                    {s.mainJolly2 && <PickLine label={`${t("formations.joker")} 2`} driver={s.mainJolly2} />}
                  </div>

                  {hasSprint && (
                    <div>
                      <strong className="text-muted" style={{ fontSize: "0.85rem" }}>{t("formations.sprint").toUpperCase()}</strong>
                      <PickLine label="SP1" driver={s.sprintP1} />
                      <PickLine label="SP2" driver={s.sprintP2} />
                      <PickLine label="SP3" driver={s.sprintP3} />
                      <PickLine label={`${t("formations.joker")} SP`} driver={s.sprintJolly} />
                    </div>
                  )}
                </Card.Body>
              </Card>
            );
          })}
        </div>

        {/* Desktop layout - table */}
        <div className="d-none d-lg-block table-responsive">
          <Table striped bordered hover size="sm" className="mb-0">
            <thead>
              <tr>
                {[...headerBase, ...(hasSprint ? headerSprint : [])].map(
                  (h) => (
                    <th key={h}>{h}</th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {subs.map((s, i) => {
                return (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td>
                      {s.user}
                      {s.isLate && (
                        <Badge bg="warning" text="dark" className="ms-1">
                          ⏰ -3
                        </Badge>
                      )}
                    </td>

                    {/* Main race picks */}
                    <td>
                      <DriverCell driverName={s.mainP1} />
                    </td>
                    <td>
                      <DriverCell driverName={s.mainP2} />
                    </td>
                    <td>
                      <DriverCell driverName={s.mainP3} />
                    </td>
                    <td>
                      <DriverCell driverName={s.mainJolly} />
                      {s.mainJolly2 && (
                        <>
                          {" / "}
                          <DriverCell driverName={s.mainJolly2} />
                        </>
                      )}
                      { !s.mainJolly && !s.mainJolly2 && "—" }
                    </td>

                    {/* Sprint race picks */}
                    {hasSprint && (
                      <>
                        <td>
                          <DriverCell driverName={s.sprintP1} />
                        </td>
                        <td>
                          <DriverCell driverName={s.sprintP2} />
                        </td>
                        <td>
                          <DriverCell driverName={s.sprintP3} />
                        </td>
                        <td>
                          <DriverCell driverName={s.sprintJolly} />
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  );
}

export default React.memo(SubmissionsList);