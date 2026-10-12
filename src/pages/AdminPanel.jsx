/**
 * @file AdminPanel.jsx
 * @description Admin hub: points calculation (first view) and every admin section,
 * reachable only by admins (AdminRoute in App.jsx).
 */

import React, { useState, useEffect } from "react";

import { useSearchParams } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";
import { useLanguage } from "../hooks/useLanguage";
import { error } from "../utils/logger";
import CalculatePoints from "./CalculatePoints";
import ParticipantsManager from "./admin/ParticipantsManager";
import FormationsManager from "./admin/FormationsManager";
import ChampionshipManager from "./admin/ChampionshipManager";
import CalendarManager from "./admin/CalendarManager";
import DriversManager from "./admin/DriversManager";
import DatabaseReset from "./admin/DatabaseReset";
import "../styles/cards.css";
import "../styles/admin.css";
import LogoLoader from "../components/LogoLoader";
import { loadRaces, loadChampionship, loadDeadlineMs, loadStatistics } from "../services/warmup";

const SECTIONS = ["calculate", "participants", "formations", "championship", "calendar", "drivers", "database"];

export default function AdminPanel() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("section");
  const activeTab = SECTIONS.includes(requested) ? requested : "calculate";

  const [sharedParticipants, setSharedParticipants] = useState([]);
  const [sharedRaces, setSharedRaces] = useState([]);
  const [loadingShared, setLoadingShared] = useState(false);

  useEffect(() => { loadSharedData(); }, []);

  /**
   * Reloads participants and races
   * @returns {Promise<Array<Object>|undefined>} The fresh races (sorted by round)
   */
  const loadSharedData = async () => {
    setLoadingShared(true);
    // Admin changes touch what the other pages read from the warm-up cache
    loadRaces(true); loadChampionship(true); loadDeadlineMs(true); loadStatistics(true);
    try {
      const [partSnap, racesSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "ranking")),
        getDocs(collection(db, "races")),
        getDocs(collection(db, "users")),
      ]);

      // Build a uid → { email, provider, ... } lookup so admin views can show
      // contact / sign-up info without needing a second roundtrip per user.
      const usersById = {};
      usersSnap.docs.forEach((d) => {
        usersById[d.id] = d.data();
      });

      setSharedParticipants(
        partSnap.docs
          .map((d) => {
            const userInfo = usersById[d.id];
            return {
              id: d.id,
              ...d.data(),
              email: userInfo?.email || null,
              authProvider: userInfo?.provider || null,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      const races = racesSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.round - b.round);
      setSharedRaces(races);
      return races;
    } catch (err) {
      error("Error loading shared data:", err);
    } finally {
      setLoadingShared(false);
    }
  };

  const labels = {
    calculate: t("admin.calculate"),
    participants: t("admin.participants"),
    formations: t("admin.formations"),
    championship: t("admin.championship"),
    calendar: t("admin.calendar"),
    drivers: t("admin.drivers"),
    database: t("admin.database"),
  };

  // The section is in the URL (?section=...), so back/forward and links work
  const selectSection = (key) =>
    setSearchParams(key === "calculate" ? {} : { section: key }, { replace: true });

  return (
    <div className="fx admin-page">
      <div className="admin-head">
        <div className="fx-eyebrow">{t("admin.onlyAdmins")}</div>
        <h1 className="admin-title">{t("admin.title")}</h1>
      </div>

      {/* Sections: scrollable chips on phones */}
      <nav className="admin-nav" aria-label={t("admin.title")}>
        {SECTIONS.map((key) => (
          <button
            key={key}
            type="button"
            className={`admin-chip${activeTab === key ? " is-active" : ""}`}
            aria-current={activeTab === key ? "page" : undefined}
            onClick={() => selectSection(key)}
          >
            {labels[key]}
          </button>
        ))}
      </nav>

      {activeTab === "calculate" ? (
        <CalculatePoints />
      ) : loadingShared && !sharedParticipants.length ? (
        <div className="text-center py-5"><LogoLoader /></div>
      ) : (
        <div className="admin-section">
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
          {activeTab === "drivers" && <DriversManager />}
          {activeTab === "database" && (
            <DatabaseReset participants={sharedParticipants} races={sharedRaces} onDataChange={loadSharedData} />
          )}
        </div>
      )}
    </div>
  );
}
