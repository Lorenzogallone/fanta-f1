/**
 * @file Formations.jsx
 * @description Formation management page with tabs for races and championship
 */

import React, { useState } from "react";
import { Tab, Nav } from "react-bootstrap";
import FormationApp from "./FormationApp";
import ChampionshipForm from "./ChampionshipForm";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * Formations page with tabbed interface for race and championship formations
 * @returns {JSX.Element} Tabbed formation interface
 */
export default function Formations() {
  const [activeTab, setActiveTab] = useState("races");
  const { isDark } = useTheme();
  const { t } = useLanguage();

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";

  return (
    <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
      <Nav variant="tabs" className="justify-content-center mb-4">
        <Nav.Item>
          <Nav.Link
            eventKey="races"
            style={{
              color: activeTab === "races" ? accentColor : undefined,
              borderBottomColor: activeTab === "races" ? accentColor : undefined,
            }}
          >
            🏎️ {t("formations.races")}
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link
            eventKey="championship"
            style={{
              color: activeTab === "championship" ? accentColor : undefined,
              borderBottomColor: activeTab === "championship" ? accentColor : undefined,
            }}
          >
            🏆 {t("formations.championship")}
          </Nav.Link>
        </Nav.Item>
      </Nav>

      <Tab.Content>
        <Tab.Pane eventKey="races">
          <FormationApp />
        </Tab.Pane>

        <Tab.Pane eventKey="championship">
          <ChampionshipForm />
        </Tab.Pane>
      </Tab.Content>
    </Tab.Container>
  );
}
