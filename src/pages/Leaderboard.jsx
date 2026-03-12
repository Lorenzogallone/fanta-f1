/**
 * @file Leaderboard.jsx
 * @description Real-time leaderboard component displaying current rankings with user avatars
 */

import React, { useState, useEffect } from "react";
import { Card, Table, Spinner, Badge } from "react-bootstrap";
import { Link } from "react-router-dom";
import { collection, query, orderBy, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../hooks/useLanguage";
import { hideSplash } from "../utils/splash";
import UserAvatar from "../components/UserAvatar";

const medals = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [userProfiles, setUserProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const { isDark } = useTheme();
  const { t } = useLanguage();

  // Load user profiles for avatar display
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const profiles = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          profiles[d.id] = { photoURL: data.photoURL || "", nickname: data.nickname || "" };
        });
        setUserProfiles(profiles);
      } catch {
        // Non-critical: avatars will fallback to initials
      }
    })();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "ranking"), orderBy("puntiTotali", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const rawRows = snap.docs.map((d) => ({
        userId: d.id,
        name: d.data().name,
        pts: d.data().puntiTotali,
        jolly: d.data().jolly ?? 0,
        photoURL: d.data().photoURL || "",
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
      hideSplash();
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
        as="h6"
        className="text-center fw-semibold py-2"
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
              <col style={{ width: "28px" }} />
              <col />
              <col style={{ width: "42px" }} />
              <col style={{ width: "42px" }} />
              <col style={{ width: "28px" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="text-center px-1" style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>#</th>
                <th className="px-1" style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>{t("leaderboard.player")}</th>
                <th className="text-center px-1" style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>{t("common.points")}</th>
                <th className="text-center px-1" style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>{t("leaderboard.gap")}</th>
                <th className="text-center px-1" style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>J</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const medal = r.position <= 3 ? medals[r.position - 1] : r.position;
                const gap = (leaderPts - r.pts === 0) ? "—" : `-${leaderPts - r.pts}`;
                const isTop3 = r.position <= 3;
                const avatarURL = r.photoURL || userProfiles[r.userId]?.photoURL || "";

                return (
                  <tr key={r.userId} className={isTop3 ? "fw-bold" : ""}>
                    <td className="text-center px-1" style={{ fontSize: "0.85rem", padding: "6px 2px" }}>{medal}</td>
                    <td className="px-1" style={{ padding: "6px 4px" }}>
                      <Link
                        to={`/participant/${r.userId}`}
                        className="d-flex align-items-center gap-1 text-truncate"
                        style={{
                          color: "inherit",
                          textDecoration: "none",
                          fontSize: "0.88rem",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = "underline";
                          e.currentTarget.style.color = accentColor;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = "none";
                          e.currentTarget.style.color = "inherit";
                        }}
                      >
                        <UserAvatar
                          photoURL={avatarURL}
                          name={r.name}
                          size={22}
                        />
                        <span className="text-truncate">{r.name}</span>
                      </Link>
                    </td>
                    <td className="text-center px-1 fw-semibold" style={{ fontSize: "0.85rem", padding: "6px 2px" }}>{r.pts}</td>
                    <td className="text-center px-1 text-muted" style={{ fontSize: "0.75rem", padding: "6px 2px" }}>{gap}</td>
                    <td className="text-center px-1" style={{ padding: "6px 2px" }}>
                      <span style={{ fontSize: "0.7rem", color: r.jolly ? "#198754" : "#6c757d", fontWeight: "bold" }}>
                        {r.jolly}
                      </span>
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
