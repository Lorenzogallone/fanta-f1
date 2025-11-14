/**
 * @file Leaderboard.jsx
 * @description Real-time leaderboard component displaying current rankings and position changes
 */

import React, { useState, useEffect } from "react";
import { Card, Table, Spinner, Badge } from "react-bootstrap";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { getLastRankingSnapshot, calculatePositionChange } from "../services/rankingSnapshot";

const medals = ["🥇", "🥈", "🥉"];

/**
 * Leaderboard component showing live ranking with position trends
 * @returns {JSX.Element} Leaderboard table with live updates
 */
export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previousSnapshot, setPreviousSnapshot] = useState(null);
  const { isDark } = useTheme();
  const { t } = useLanguage();

  /**
   * Load the last ranking snapshot for position comparison
   */
  useEffect(() => {
    (async () => {
      const lastSnapshot = await getLastRankingSnapshot();
      if (lastSnapshot) {
        setPreviousSnapshot(lastSnapshot.snapshot);
      }
    })();
  }, []);

  /**
   * Subscribe to live ranking updates from Firestore
   */
  useEffect(() => {
    const q = query(collection(db, "ranking"), orderBy("puntiTotali", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setRows(
        snap.docs.map((d, index) => ({
          userId: d.id,
          name: d.data().name,
          pts: d.data().puntiTotali,
          jolly: d.data().jolly ?? 0,
          position: index + 1,
        }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const leaderPts = rows[0]?.pts ?? 0;
  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";
  const bgHeader = isDark ? "var(--bg-tertiary)" : "#ffffff";

  return (
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
        {t("leaderboard.title")}
      </Card.Header>

      <Card.Body className="p-0">
        {loading ? (
          <div className="py-5 text-center">
            <Spinner animation="border" />
          </div>
        ) : (
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
                  <th>{t("leaderboard.player")}</th>
                  <th className="text-center">{t("common.points")}</th>
                  <th className="text-center">{t("leaderboard.gap")}</th>
                  <th className="text-center">{t("leaderboard.jokers")}</th>
                  {previousSnapshot && (
                    <th style={{ width: 80 }} className="text-center">
                      {t("leaderboard.trend")}
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => {
                  const medal = medals[idx] ?? idx + 1;
                  const gap = idx === 0 ? "—" : `-${leaderPts - r.pts}`;
                  const isTop3 = idx < 3;

                  // Calculate position change from previous snapshot
                  const positionChange = previousSnapshot
                    ? calculatePositionChange(r.userId, r.position, previousSnapshot)
                    : 0;

                  /**
                   * Component to display position trend indicator
                   * @returns {JSX.Element} Trend badge with color-coded arrow
                   */
                  const TrendBadge = () => {
                    if (positionChange === 0) {
                      return <span style={{ color: "#6c757d" }}>—</span>;
                    } else if (positionChange > 0) {
                      return (
                        <span style={{ color: "#28a745", fontWeight: "bold" }}>
                          ↑ +{positionChange}
                        </span>
                      );
                    } else {
                      return (
                        <span style={{ color: "#dc3545", fontWeight: "bold" }}>
                          ↓ {positionChange}
                        </span>
                      );
                    }
                  };

                  return (
                    <tr key={r.name} className={isTop3 ? "fw-bold" : ""}>
                      <td className="text-center">{medal}</td>
                      <td>{r.name}</td>
                      <td className="text-center">{r.pts}</td>
                      <td className="text-center">{gap}</td>
                      <td className="text-center">
                        <Badge bg={r.jolly ? "success" : "secondary"}>
                          {r.jolly}
                        </Badge>
                      </td>
                      {previousSnapshot && (
                        <td className="text-center">
                          <TrendBadge />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}