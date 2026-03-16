/**
 * @file ChampionshipForm.jsx
 * @description Championship formation submission form with driver and constructor predictions
 */

import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Badge,
  Alert,
  Spinner,
} from "react-bootstrap";
import Select from "react-select";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { getChampionshipDeadlineMs } from "../utils/championshipDeadline";
import ChampionshipSubmissions from "../components/ChampionshipSubmissions";
import { DRIVERS, CONSTRUCTORS, DRIVER_TEAM, TEAM_LOGOS } from "../constants/racing";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../hooks/useLanguage";
import { useAuth } from "../hooks/useAuth";
import { error } from "../utils/logger";
import "../styles/customSelect.css";

// Constants imported from centralized file
const drivers = DRIVERS;
const constructors = CONSTRUCTORS;
const driverTeam = DRIVER_TEAM;
const teamLogos = TEAM_LOGOS;

/**
 * Helper to create driver options with team logos
 * @param {string[]} driversList - List of driver names
 * @returns {Object[]} Select options with logos
 */
const asDriverOptions = (driversList) =>
  driversList.map((name) => {
    const team = driverTeam[name];
    const logo = teamLogos[team];
    return {
      value: name,
      label: (
        <div className="select-option">
          {logo && <img className="option-logo" src={logo} alt={team} loading="lazy" />}
          <span className="option-text">{name}</span>
        </div>
      ),
    };
  });

/**
 * Helper to create constructor options with team logos
 * @param {string[]} constructorsList - List of constructor names
 * @returns {Object[]} Select options with logos
 */
const asConstructorOptions = (constructorsList) =>
  constructorsList.map((name) => {
    const logo = teamLogos[name];
    return {
      value: name,
      label: (
        <div className="select-option">
          {logo && <img className="option-logo" src={logo} alt={name} loading="lazy" />}
          <span className="option-text">{name}</span>
        </div>
      ),
    };
  });

/**
 * Championship formation form component
 * @returns {JSX.Element} Championship prediction form with deadline management
 */
export default function ChampionshipForm() {
  const { isDark } = useTheme();
  const { t, currentLanguage } = useLanguage();
  const { user, userProfile } = useAuth();
  const dateLocale = currentLanguage === "en" ? "en-GB" : "it-IT";

  // Translation key mappings for driver and constructor labels
  const driverLabels = {
    D1: "championshipForm.driver1",
    D2: "championshipForm.driver2",
    D3: "championshipForm.driver3",
  };

  const constructorLabels = {
    C1: "championshipForm.constructor1",
    C2: "championshipForm.constructor2",
    C3: "championshipForm.constructor3",
  };

  const [form, setForm] = useState({
    userId: user?.uid || "",
    D1: null,
    D2: null,
    D3: null,
    C1: null,
    C2: null,
    C3: null,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Used to trigger refresh of ChampionshipSubmissions component
  const [refreshKey, setRefreshKey] = useState(0);

  // Track if editing existing formation
  const [isEdit, setIsEdit] = useState(false);

  // Dynamically calculated deadline
  const [deadlineMs, setDeadlineMs] = useState(null);
  const [deadlineText, setDeadlineText] = useState("");
  const [loadingDeadline, setLoadingDeadline] = useState(true);
  const pastDeadline = deadlineMs ? Date.now() > deadlineMs : false;

  // Auto-set userId from authenticated user
  useEffect(() => {
    if (user?.uid && form.userId !== user.uid) {
      setForm(f => ({ ...f, userId: user.uid }));
    }
  }, [user]);

  /**
   * Calculate dynamic deadline based on mid-championship race
   */
  useEffect(() => {
    (async () => {
      try {
        const ms = await getChampionshipDeadlineMs();
        if (ms) {
          setDeadlineMs(ms);
          setDeadlineText(
            new Date(ms).toLocaleDateString(dateLocale, {
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })
          );
        }
      } catch (e) {
        error("Deadline calc error:", e);
      } finally {
        setLoadingDeadline(false);
      }
    })();
  }, []);

  /**
   * Pre-fill form with existing values when userId changes
   */
  useEffect(() => {
    const { userId } = form;
    if (!userId) {
      setIsEdit(false);
      return;
    }

    (async () => {
      try {
        const userDoc = await getDoc(doc(db, "ranking", userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const { championshipPiloti, championshipCostruttori } = data;

          // Find corresponding select option objects
          const driverOpts = asDriverOptions(drivers);
          const constructorOpts = asConstructorOptions(constructors);

          if (
            Array.isArray(championshipPiloti) &&
            championshipPiloti.length === 3 &&
            Array.isArray(championshipCostruttori) &&
            championshipCostruttori.length === 3
          ) {
            setForm((f) => ({
              ...f,
              D1: driverOpts.find((o) => o.value === championshipPiloti[0]) || null,
              D2: driverOpts.find((o) => o.value === championshipPiloti[1]) || null,
              D3: driverOpts.find((o) => o.value === championshipPiloti[2]) || null,
              C1:
                constructorOpts.find((o) => o.value === championshipCostruttori[0]) ||
                null,
              C2:
                constructorOpts.find((o) => o.value === championshipCostruttori[1]) ||
                null,
              C3:
                constructorOpts.find((o) => o.value === championshipCostruttori[2]) ||
                null,
            }));
            setIsEdit(true);
          } else {
            // No formation found for user
            setForm((f) => ({
              ...f,
              D1: null,
              D2: null,
              D3: null,
              C1: null,
              C2: null,
              C3: null,
            }));
            setIsEdit(false);
          }
        }
      } catch (err) {
        error("Errore recupero formazione esistente:", err);
        setIsEdit(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.userId]);

  const onSel = (selected, field) =>
    setForm((f) => ({ ...f, [field]: selected }));

  const allPicked =
    form.userId &&
    form.D1 &&
    form.D2 &&
    form.D3 &&
    form.C1 &&
    form.C2 &&
    form.C3;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allPicked || pastDeadline) return;

    setSaving(true);
    setMessage(null);

    const userId = form.userId;
    const driversPicked = [form.D1.value, form.D2.value, form.D3.value];
    const constructorsPicked = [form.C1.value, form.C2.value, form.C3.value];

    try {
      await updateDoc(doc(db, "ranking", userId), {
        championshipPiloti: driversPicked,
        championshipCostruttori: constructorsPicked,
      });
      setMessage({
        variant: "success",
        text: isEdit
          ? t("success.formationUpdated")
          : t("championshipForm.formationSaved"),
      });
      // forza il refresh della card di destra
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      error("Errore salvataggio:", err);
      setMessage({
        variant: "danger",
        text: t("errors.generic"),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loadingDeadline)
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="danger" />
        <p className="mt-3">{t("common.loading")}</p>
      </Container>
    );

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";

  return (
    <Container className="py-5">
      <Row className="justify-content-center g-4 align-items-start">
        {/* FORM ------------------------------------------------------- */}
        <Col xs={12} lg={6}>
          <Card className="shadow" style={{ borderLeft: `4px solid ${accentColor}` }}>
            <Card.Body>
              <Card.Title className="mb-3" style={{ color: accentColor }}>
                📋 {t("championshipForm.title")}
              </Card.Title>

              {message && (
                <Alert
                  variant={message.variant}
                  onClose={() => setMessage(null)}
                  dismissible
                >
                  {message.text}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                {/* User info */}
                <div className="text-muted mb-3" style={{ fontSize: "0.9rem" }}>
                  {t("auth.submittingAs")}: <strong style={{ color: accentColor }}>{userProfile?.nickname || user?.email}</strong>
                </div>

                {/* Scadenza — stile allineato a FormationApp */}
                <hr style={{ borderColor: accentColor }} />
                <div className="d-flex align-items-center gap-2 mb-1">
                  <h5 className="mb-0" style={{ color: accentColor }}>
                    {t("formations.deadline")}
                  </h5>
                  <Badge bg={pastDeadline ? "danger" : "success"}>
                    {pastDeadline ? t("formations.closed") : t("formations.open")}
                  </Badge>
                </div>
                <p className="small text-muted mb-3">
                  {t("formations.submitBy")}: {deadlineText}
                </p>

                <h6 className="fw-bold">{t("championshipForm.topDrivers")}</h6>
                {["D1", "D2", "D3"].map((f) => (
                  <Form.Group key={f} className="mb-3">
                    <Form.Label>{t(driverLabels[f])}</Form.Label>
                    <Select
                      options={asDriverOptions(drivers)}
                      value={form[f]}
                      onChange={(sel) => onSel(sel, f)}
                      placeholder={t(driverLabels[f])}
                      classNamePrefix="react-select"
                      isSearchable
                      isDisabled={pastDeadline}
                      required
                    />
                  </Form.Group>
                ))}

                <h6 className="fw-bold mt-4">{t("championshipForm.topConstructors")}</h6>
                {["C1", "C2", "C3"].map((f) => (
                  <Form.Group key={f} className="mb-3">
                    <Form.Label>{t(constructorLabels[f])}</Form.Label>
                    <Select
                      options={asConstructorOptions(constructors)}
                      value={form[f]}
                      onChange={(sel) => onSel(sel, f)}
                      placeholder={t(constructorLabels[f])}
                      classNamePrefix="react-select"
                      isDisabled={pastDeadline}
                      required
                    />
                  </Form.Group>
                ))}

                <Button
                  variant="danger"
                  type="submit"
                  className="w-100 mt-3"
                  disabled={!allPicked || saving || pastDeadline}
                >
                  {saving
                    ? t("common.loading")
                    : isEdit
                    ? `${t("common.edit")} ${t("championshipForm.title")}`
                    : t("championshipForm.saveFormation")}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* LISTA ------------------------------------------------------ */}
        <Col xs={12} lg={6}>
          <ChampionshipSubmissions refresh={refreshKey} currentUserId={user?.uid} deadlineMs={deadlineMs} />
        </Col>
      </Row>
    </Container>
  );
}