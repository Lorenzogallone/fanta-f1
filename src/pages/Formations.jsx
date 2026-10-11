/**
 * @file Formations.jsx
 * @description Formation page with a segmented control for race and championship lineups
 */

import React, { useState } from "react";
import FormationApp from "./FormationApp";
import ChampionshipForm from "./ChampionshipForm";
import { useLanguage } from "../hooks/useLanguage";
import "../styles/cards.css";

/**
 * Formations page: Gare | Campionato
 * @returns {JSX.Element} Formation page
 */
export default function Formations() {
  const [activeTab, setActiveTab] = useState("races");
  const { t } = useLanguage();

  const tabs = [
    { key: "races", label: t("formations.races") },
    { key: "championship", label: t("formations.championship") },
  ];

  return (
    <>
      <div className="fx-segmented mb-3" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`fx-segment${activeTab === tab.key ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "races" ? <FormationApp /> : <ChampionshipForm />}
    </>
  );
}
