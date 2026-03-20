/**
 * @file AdminPanel.jsx
 * @description Admin panel with tabbed interface for managing the fantasy league.
 * Clean, professional design with consistent styling across all tabs.
 */

import React, { useState, useEffect } from "react";
import {
  Container,
  Spinner,
} from "react-bootstrap";
import {
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useLanguage } from "../hooks/useLanguage";
import { useTheme } from "../contexts/ThemeContext";
import { error } from "../utils/logger";
import ParticipantsManager from "./admin/ParticipantsManager";
import FormationsManager from "./admin/FormationsManager";
import ChampionshipManager from "./admin/ChampionshipManager";
import CalendarManager from "./admin/CalendarManager";
import DatabaseReset from "./admin/DatabaseReset";

const TABS = [
  { key: "participants", icon: "👥" },
  { key: "formations", icon: "📝" },
  { key: "championship", icon: "🏆" },
  { key: "calendar", icon: "📅" },
  { key: "database", icon: "💾" },
];

export default function AdminPanel() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState("participants");

  const [sharedParticipants, setSharedParticipants] = useState([]);
  const [sharedRaces, setSharedRaces] = useState([]);
  const [loadingShared, setLoadingShared] = useState(false);

  useEffect(() => { loadSharedData(); }, []);

  const loadSharedData = async () => {
    setLoadingShared(true);
    try {
      const [partSnap, racesSnap] = await Promise.all([
        getDocs(collection(db, "ranking")),
        getDocs(collection(db, "races")),
      ]);
      setSharedParticipants(
        partSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name))
      );
      setSharedRaces(
        racesSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.round - b.round)
      );
    } catch (err) {
      error("Error loading shared data:", err);
    } finally {
      setLoadingShared(false);
    }
  };

  const tabLabels = {
    participants: t("admin.participants"),
    formations: t("admin.formations"),
    championship: t("admin.championship"),
    calendar: t("admin.calendar"),
    database: t("admin.database"),
  };

  const borderColor = isDark ? "var(--border-color)" : "#dee2e6";

  return (
    <Container className="py-3 px-2 px-sm-3" style={{ maxWidth: 900 }}>
      {/* Header */}
      <h5 className="fw-bold mb-3" style={{ color: "var(--text-primary)" }}>
        {t("admin.title")}
      </h5>

      {/* Tab bar — pill-style, horizontally scrollable on mobile */}
      <div
        className="d-flex gap-1 pb-2 mb-3"
        style={{
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          borderBottom: `2px solid ${borderColor}`,
        }}
      >
        {TABS.map(({ key, icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="btn btn-sm flex-shrink-0"
              style={{
                backgroundColor: isActive ? "var(--accent-red)" : "transparent",
                color: isActive ? "#fff" : "var(--text-secondary)",
                border: "none",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: "0.8rem",
                fontWeight: isActive ? 600 : 400,
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <span className="d-sm-none">{icon}</span>
              <span className="d-none d-sm-inline">{icon} {tabLabels[key]}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {loadingShared && !sharedParticipants.length ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : (
        <>
          {activeTab === "participants" && (
            <ParticipantsManager participants={sharedParticipants} loading={loadingShared} onDataChange={loadSharedData} />
          )}
          {activeTab === "formations" && (
            <FormationsManager participants={sharedParticipants} races={sharedRaces} loading={loadingShared} onDataChange={loadSharedData} />
          )}
          {activeTab === "championship" && (
            <ChampionshipManager participants={sharedParticipants} loading={loadingShared} onDataChange={loadSharedData} />
          )}
          {activeTab === "calendar" && (
            <CalendarManager races={sharedRaces} loading={loadingShared} onDataChange={loadSharedData} />
          )}
          {activeTab === "database" && (
            <DatabaseReset participants={sharedParticipants} races={sharedRaces} onDataChange={loadSharedData} />
          )}
        </>
      )}
    </Container>
  );
}
