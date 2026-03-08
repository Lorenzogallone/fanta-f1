/**
 * @file AdminPanel.jsx
 * @description Admin panel for managing participants, formations, race calendar, and database operations
 * Provides comprehensive administrative tools with authentication protection
 */

import React, { useState, useEffect } from "react";
import {
  Container,
  Card,
  Tab,
  Nav,
  Spinner,
} from "react-bootstrap";
import {
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useLanguage } from "../hooks/useLanguage";
import { error } from "../utils/logger";
import ParticipantsManager from "./admin/ParticipantsManager";
import FormationsManager from "./admin/FormationsManager";
import CalendarManager from "./admin/CalendarManager";
import DatabaseReset from "./admin/DatabaseReset";

/**
 * Main admin panel component with tabbed interface
 * @returns {JSX.Element} Admin panel with authentication and management tabs
 */
export default function AdminPanel() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("participants");

  // Shared data to avoid multiple fetches
  const [sharedParticipants, setSharedParticipants] = useState([]);
  const [sharedRaces, setSharedRaces] = useState([]);
  const [loadingShared, setLoadingShared] = useState(false);

  useEffect(() => {
    loadSharedData();
  }, []);

  const loadSharedData = async () => {
    setLoadingShared(true);
    try {
      const [partSnap, racesSnap] = await Promise.all([
        getDocs(collection(db, "ranking")),
        getDocs(collection(db, "races")),
      ]);

      const partList = partSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSharedParticipants(partList.sort((a, b) => a.name.localeCompare(b.name)));

      const racesList = racesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSharedRaces(racesList.sort((a, b) => a.round - b.round));
    } catch (err) {
      error("Error loading shared data:", err);
    } finally {
      setLoadingShared(false);
    }
  };

  return (
    <Container className="py-4">
      <Card className="shadow border-danger mb-4">
        <Card.Header className="bg-danger text-white">
          <h4 className="mb-0">⚙️ {t("admin.title")}</h4>
        </Card.Header>
      </Card>

      <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
        <Nav variant="tabs" className="mb-4 flex-nowrap">
          <Nav.Item>
            <Nav.Link eventKey="participants" className="px-2 px-sm-3">
              👥 <span className="d-none d-sm-inline">{t("admin.participants")}</span>
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="formations" className="px-2 px-sm-3">
              📝 <span className="d-none d-sm-inline">{t("admin.formations")}</span>
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="calendar" className="px-2 px-sm-3">
              📅 <span className="d-none d-sm-inline">{t("admin.raceCalendar")}</span>
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="reset" className="px-2 px-sm-3">
              🗑️ <span className="d-none d-sm-inline">{t("admin.database")}</span>
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          <Tab.Pane eventKey="participants">
            <ParticipantsManager
              participants={sharedParticipants}
              loading={loadingShared}
              onDataChange={loadSharedData}
            />
          </Tab.Pane>

          <Tab.Pane eventKey="formations">
            <FormationsManager
              participants={sharedParticipants}
              races={sharedRaces}
              loading={loadingShared}
              onDataChange={loadSharedData}
            />
          </Tab.Pane>

          <Tab.Pane eventKey="calendar">
            <CalendarManager
              races={sharedRaces}
              loading={loadingShared}
              onDataChange={loadSharedData}
            />
          </Tab.Pane>

          <Tab.Pane eventKey="reset">
            <DatabaseReset
              participants={sharedParticipants}
              races={sharedRaces}
              onDataChange={loadSharedData}
            />
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </Container>
  );
}
