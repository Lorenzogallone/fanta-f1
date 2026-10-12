/**
 * @file Leaderboard.jsx
 * @description Real-time leaderboard component displaying current rankings with user avatars
 */

import React, { useEffect, useMemo } from "react";
import { Card, Table, Badge } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../hooks/useLanguage";
import UserAvatar from "../components/UserAvatar";
import "../styles/cards.css";
import "../styles/home.css";
import LogoLoader from "../components/LogoLoader";
import { useWarm } from "../hooks/useWarm";
import { watchRanking, loadUsers, loadRaces } from "../services/warmup";

const medals = ["🥇", "🥈", "🥉"];

/**
 * Rows with positions (ties share the position) and the change since the last
 * scoring event: the end-of-season championship points once assigned, else
 * the last calculated race. "Before" = current total minus that event.
 * @param {Array<Object>} ranking - ranking docs by points descending
 * @param {Object|null} raceOrder - raceId → chronological index
 * @returns {Array<Object>} Rows
 */
function buildRows(ranking, raceOrder) {
  const rawRows = ranking.map((d) => ({
    userId: d.id,
    name: d.name,
    pts: d.puntiTotali || 0,
    jolly: d.jolly ?? 0,
    photoURL: d.photoURL || "",
    pointsByRace: d.pointsByRace || {},
    championshipPts: d.championshipPts || 0,
  }));

  const assignPositions = (arr) => {
    let pos = 1;
    const map = {};
    arr.forEach((r, i) => {
      if (i > 0 && r.sortPts < arr[i - 1].sortPts) pos = i + 1;
      map[r.userId] = pos;
    });
    return map;
  };

  // Last calculated race by date. Until the race order is known no position
  // changes are shown, rather than guessing from IDs.
  const allRaceIds = new Set();
  rawRows.forEach((r) => Object.keys(r.pointsByRace).forEach((id) => allRaceIds.add(id)));
  let lastRaceId = null;
  if (raceOrder && Object.keys(raceOrder).length > 0 && allRaceIds.size > 0) {
    lastRaceId = [...allRaceIds].reduce((best, id) =>
      (raceOrder[id] || 0) > (raceOrder[best] || 0) ? id : best
    );
  }

  let currentPos = 1;
  const rows = rawRows.map((row, index) => {
    if (index > 0 && row.pts < rawRows[index - 1].pts) currentPos = index + 1;
    return { ...row, position: currentPos };
  });

  const championshipAssigned = rawRows.some((r) => r.championshipPts !== 0);
  const lastEventPts = (r) => {
    if (championshipAssigned) return r.championshipPts;
    const lastEntry = r.pointsByRace[lastRaceId];
    return lastEntry ? (lastEntry.mainPts || 0) + (lastEntry.sprintPts || 0) : 0;
  };
  if (championshipAssigned || (lastRaceId && allRaceIds.size > 1)) {
    const curr = rawRows.map((r) => ({ userId: r.userId, sortPts: r.pts })).sort((a, b) => b.sortPts - a.sortPts);
    const prev = rawRows.map((r) => ({ userId: r.userId, sortPts: r.pts - lastEventPts(r) })).sort((a, b) => b.sortPts - a.sortPts);
    const currPosMap = assignPositions(curr);
    const prevPosMap = assignPositions(prev);
    rows.forEach((r) => {
      const c = currPosMap[r.userId];
      const p = prevPosMap[r.userId];
      if (c != null && p != null) r.posChange = p - c;
    });
  }
  return rows;
}

export default function Leaderboard() {
  const { isDark } = useTheme();
  const { t } = useLanguage();

  // Shared live ranking, profiles and calendar (warm-up cache, refreshed in the background)
  const ranking = useWarm("ranking");
  const users = useWarm("users");
  const races = useWarm("races");
  useEffect(() => {
    watchRanking();
    loadUsers(true);
    loadRaces(true);
  }, []);

  const userProfiles = useMemo(() => {
    const profiles = {};
    Object.entries(users || {}).forEach(([id, data]) => {
      profiles[id] = { photoURL: data.photoURL || "", nickname: data.nickname || "" };
    });
    return profiles;
  }, [users]);

  const raceOrder = useMemo(() => {
    if (!races) return null;
    const map = {};
    races.forEach((r, i) => { map[r.id] = i + 1; });
    return map;
  }, [races]);

  const rows = useMemo(() => buildRows(ranking || [], raceOrder), [ranking, raceOrder]);
  const loading = ranking == null;

  const leaderPts = rows[0]?.pts ?? 0;
  const accentColor = isDark ? "#ff4d5a" : "#dc3545";

  return (
    <Card className="fx-card leaderboard-card">
      <div className="fx-card-header">
        <h2 className="fx-card-title">{t("leaderboard.title")}</h2>
      </div>

      <Card.Body className="p-0" style={{ overflowX: "auto" }}>
        {loading ? (
          <div className="py-5 text-center">
            <LogoLoader label={t("common.loading")} />
          </div>
        ) : (
          <Table
            hover
            className="mb-0 align-middle"
            style={{
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
