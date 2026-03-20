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
        pointsByRace: d.data().pointsByRace || {},
      }));

      // Find the last calculated race (highest round from rXX- prefix)
      const allRaceIds = new Set();
      rawRows.forEach((r) => Object.keys(r.pointsByRace).forEach((id) => allRaceIds.add(id)));
      let lastRaceId = null;
      if (allRaceIds.size > 0) {
        lastRaceId = [...allRaceIds].sort((a, b) => {
          const ra = parseInt(a.match(/^r(\d+)/)?.[1] || "0", 10);
          const rb = parseInt(b.match(/^r(\d+)/)?.[1] || "0", 10);
          return rb - ra;
        })[0];
      }

      // Current positions
      let currentPos = 1;
      const rowsWithPositions = rawRows.map((row, index) => {
        if (index > 0 && row.pts < rawRows[index - 1].pts) {
          currentPos = index + 1;
        }
        return { ...row, position: currentPos };
      });

      // Previous positions (before last race)
      if (lastRaceId) {
        const prevRows = rawRows.map((r) => {
          const raceEntry = r.pointsByRace[lastRaceId];
          const raceTotal = raceEntry ? (raceEntry.mainPts || 0) + (raceEntry.sprintPts || 0) : 0;
          return { userId: r.userId, prevPts: r.pts - raceTotal };
        }).sort((a, b) => b.prevPts - a.prevPts);

        let prevPos = 1;
        const prevPositionMap = {};
        prevRows.forEach((r, i) => {
          if (i > 0 && r.prevPts < prevRows[i - 1].prevPts) prevPos = i + 1;
          prevPositionMap[r.userId] = prevPos;
        });

        rowsWithPositions.forEach((r) => {
          const prev = prevPositionMap[r.userId];
          if (prev != null) r.posChange = prev - r.position;
        });
      }

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
              minWidth: "300px",
            }}
          >
            <colgroup>
              <col style={{ width: "26px" }} />
              <col />
              <col style={{ width: "38px" }} />
              <col style={{ width: "38px" }} />
              <col style={{ width: "24px" }} />
              <col style={{ width: "28px" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="text-center px-0" style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>#</th>
                <th className="px-1" style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>{t("leaderboard.player")}</th>
                <th className="text-center px-0" style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>{t("common.points")}</th>
                <th className="text-center px-0" style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>{t("leaderboard.gap")}</th>
                <th className="text-center px-0" style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>J</th>
                <th className="px-0"></th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const medal = r.position <= 3 ? medals[r.position - 1] : r.position;
                const gap = (leaderPts - r.pts === 0) ? "—" : `-${leaderPts - r.pts}`;
                const isTop3 = r.position <= 3;
                const avatarURL = r.photoURL || userProfiles[r.userId]?.photoURL || "";
                const change = r.posChange;
                const changeDisplay = change == null ? "" : change > 0 ? `+${change}` : change === 0 ? "=" : `${change}`;
                const changeColor = change > 0 ? "#198754" : change < 0 ? "#dc3545" : "#6c757d";

                return (
                  <tr key={r.userId} className={isTop3 ? "fw-bold" : ""}>
                    <td className="text-center px-0" style={{ fontSize: "0.85rem", padding: "6px 2px" }}>{medal}</td>
                    <td className="px-1" style={{ padding: "6px 2px", overflow: "hidden" }}>
                      <Link
                        to={`/participant/${r.userId}`}
                        className="d-flex align-items-center gap-1 text-truncate"
                        style={{
                          color: "inherit",
                          textDecoration: "none",
                          fontSize: "0.85rem",
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
                          size={20}
                        />
                        <span className="text-truncate">{r.name}</span>
                      </Link>
                    </td>
                    <td className="text-center px-0 fw-semibold" style={{ fontSize: "0.82rem", padding: "6px 1px" }}>{r.pts}</td>
                    <td className="text-center px-0 text-muted" style={{ fontSize: "0.72rem", padding: "6px 1px" }}>{gap}</td>
                    <td className="text-center px-0" style={{ padding: "6px 1px" }}>
                      <span style={{ fontSize: "0.68rem", color: r.jolly ? "#198754" : "#6c757d", fontWeight: "bold" }}>
                        {r.jolly}
                      </span>
                    </td>
                    <td className="text-center px-0" style={{ padding: "6px 1px" }}>
                      {changeDisplay && (
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: changeColor }}>
                          {change > 0 ? "▲" : change < 0 ? "▼" : "•"}<span style={{ fontSize: "0.6rem" }}>{Math.abs(change) || ""}</span>
                        </span>
                      )}
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
