/**
 * @file Leaderboard.jsx
 * @description Real-time leaderboard component displaying current rankings
 */

import React, { useState, useEffect } from "react";
import { Card, Table, Spinner, Badge } from "react-bootstrap";
import { Link } from "react-router-dom";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../hooks/useLanguage";
import { hideSplash } from "../utils/splash";

const medals = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isDark } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    const q = query(collection(db, "ranking"), orderBy("puntiTotali", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const rawRows = snap.docs.map((d) => ({
        userId: d.id,
        name: d.data().name,
        pts: d.data().puntiTotali,
        jolly: d.data().jolly ?? 0,
      }));

      let currentPos = 1;
      const rowsWithPositions = rawRows.map((row, index) => {
        if (index > 0 && row.pts < rawRows[index - 1].pts) {
          currentPos = index + 1;
        }
        return { ...row, position: currentPos };
      });

      setRows(rowsWithPositions);
      setLoading(false);
      hideSplash(); // Hide splash screen once data is loaded
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

      <Card.Body className="p-0" style={{ overflowX: "auto" }}>
        {loading ? (
          <div className="py-5 text-center">
            <Spinner animation="border" />
            <p className="mt-3">{t("common.loading")}</p>
          </div>
        ) : (
          <Table
            hover
            striped
            className="mb-0 align-middle"
            style={{
              borderTop: `1px solid ${accentColor}`,
              tableLayout: "fixed",
              minWidth: "320px",
            }}
          >
            <colgroup>
              <col style={{ width: "30px" }} />
              <col />
              <col style={{ width: "46px" }} />
              <col style={{ width: "44px" }} />
              <col style={{ width: "38px" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="text-center px-1" style={{ whiteSpace: "nowrap" }}>#</th>
                <th className="px-1" style={{ whiteSpace: "nowrap" }}>{t("leaderboard.player")}</th>
                <th className="text-center px-1" style={{ whiteSpace: "nowrap" }}>{t("common.points")}</th>
                <th className="text-center px-1" style={{ whiteSpace: "nowrap" }}>{t("leaderboard.gap")}</th>
                <th className="text-center px-1" style={{ whiteSpace: "nowrap" }}>J</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const medal = r.position <= 3 ? medals[r.position - 1] : r.position;
                const gap = (leaderPts - r.pts === 0) ? "—" : `-${leaderPts - r.pts}`;
                const isTop3 = r.position <= 3;

                return (
                  <tr key={r.userId} className={isTop3 ? "fw-bold" : ""}>
                    <td className="text-center px-1">{medal}</td>
                    <td className="px-1 text-truncate">
                      <Link
                        to={`/participant/${r.userId}`}
                        style={{
                          color: "inherit",
                          textDecoration: "none",
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.textDecoration = "underline";
                          e.target.style.color = accentColor;
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.textDecoration = "none";
                          e.target.style.color = "inherit";
                        }}
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="text-center px-1">{r.pts}</td>
                    <td className="text-center px-1 text-muted small">{gap}</td>
                    <td className="text-center px-1">
                      <Badge bg={r.jolly ? "success" : "secondary"} style={{ fontSize: "0.7rem" }}>
                        {r.jolly}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card.Body>
    </Card>
  );
}
