// src/Leaderboard.jsx
import React, { useState, useEffect } from "react";
import { Card, Table, Spinner, Badge } from "react-bootstrap";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";
import { useTheme } from "../contexts/ThemeContext";
import { getLastRankingSnapshot, calculatePositionChange } from "../services/rankingSnapshot";

const medals = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previousSnapshot, setPreviousSnapshot] = useState(null);
  const { isDark } = useTheme();

  /* Carica l'ultimo snapshot della classifica */
  useEffect(() => {
    (async () => {
      const lastSnapshot = await getLastRankingSnapshot();
      if (lastSnapshot) {
        setPreviousSnapshot(lastSnapshot.snapshot);
      }
    })();
  }, []);

  /* live ranking */
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
        Classifica attuale
      </Card.Header>

      <Card.Body className="p-0">
        {loading ? (
          <div className="py-5 text-center">
            <Spinner animation="border" />
          </div>
        ) : (
          <>
            {/* Layout MOBILE - Cards compatte */}
            <div className="d-lg-none p-3">
              {rows.map((r, idx) => {
                const medal = medals[idx] ?? idx + 1;
                const gap = idx === 0 ? "—" : `-${leaderPts - r.pts}`;
                const isTop3 = idx < 3;
                const positionChange = previousSnapshot
                  ? calculatePositionChange(r.userId, r.position, previousSnapshot)
                  : 0;

                return (
                  <div
                    key={r.name}
                    className="d-flex align-items-center justify-content-between py-2 border-bottom"
                    style={{ fontWeight: isTop3 ? "bold" : "normal" }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <span style={{ fontSize: "1.1rem", minWidth: 30 }}>{medal}</span>
                      <div>
                        <div>{r.name}</div>
                        <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                          {r.pts} pts {gap !== "—" && `• ${gap}`}
                        </div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      {previousSnapshot && (
                        <div style={{ minWidth: 40, textAlign: "center" }}>
                          {positionChange === 0 ? (
                            <span style={{ color: "#6c757d" }}>—</span>
                          ) : positionChange > 0 ? (
                            <span style={{ color: "#28a745", fontWeight: "bold", fontSize: "0.9rem" }}>
                              ↑{positionChange}
                            </span>
                          ) : (
                            <span style={{ color: "#dc3545", fontWeight: "bold", fontSize: "0.9rem" }}>
                              ↓{Math.abs(positionChange)}
                            </span>
                          )}
                        </div>
                      )}
                      <Badge
                        bg={r.jolly ? "success" : "secondary"}
                        style={{ minWidth: 30 }}
                      >
                        {r.jolly}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Layout DESKTOP - Table */}
            <div className="d-none d-lg-block table-responsive">
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
                  {previousSnapshot && (
                    <th style={{ width: 80 }} className="text-center">
                      Trend
                    </th>
                  )}
                  <th className="text-center">Punti</th>
                  <th className="text-center">Gap</th>
                  <th className="text-center">Jolly</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => {
                  const medal = medals[idx] ?? idx + 1;
                  const gap = idx === 0 ? "—" : `-${leaderPts - r.pts}`;
                  const isTop3 = idx < 3;

                  // Calcola la differenza di posizione
                  const positionChange = previousSnapshot
                    ? calculatePositionChange(r.userId, r.position, previousSnapshot)
                    : 0;

                  // Componente per mostrare l'andamento
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
                      {previousSnapshot && (
                        <td className="text-center">
                          <TrendBadge />
                        </td>
                      )}
                      <td className="text-center">{r.pts}</td>
                      <td className="text-center">{gap}</td>
                      <td className="text-center">
                        <Badge bg={r.jolly ? "success" : "secondary"}>
                          {r.jolly}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </Table>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
}