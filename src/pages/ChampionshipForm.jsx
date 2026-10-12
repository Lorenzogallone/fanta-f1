/**
 * @file ChampionshipForm.jsx
 * @description Championship formation submission form with driver and constructor predictions
 */

import React, { useState, useEffect, useMemo } from "react";
import { Container, Row, Col, Form, Button, Alert } from "react-bootstrap";
import Select from "react-select";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { getChampionshipDeadlineMs } from "../utils/championshipDeadline";
import ChampionshipSubmissions from "../components/ChampionshipSubmissions";
import { useF1Data } from "../hooks/useF1Data";
import { buildDriverOptions, buildTeamOptions, findOptionOrCreate } from "../utils/f1SelectOptions";
import { useLanguage } from "../hooks/useLanguage";
import { useTimezone } from "../hooks/useTimezone";
import { useAuth } from "../hooks/useAuth";
import { error } from "../utils/logger";
import "../styles/customSelect.css";
import "../styles/cards.css";
import "../styles/lineup.css";
import LogoLoader from "../components/LogoLoader";

/**
 * Championship formation form component
 * @returns {JSX.Element} Championship prediction form with deadline management
 */
function PickRow({ label, children }) {
  return (
    <div className="lineup-pick">
      <div className="lineup-pick-row">
        <span className="lineup-pick-label">{label}</span>
        <div className="lineup-pick-field">{children}</div>
      </div>
    </div>
  );
}

// On touch screens the pickers don't open the keyboard (it would cover the list)
const COARSE_POINTER = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

export default function ChampionshipForm() {
  const { t, currentLanguage } = useLanguage();
  const { timezone } = useTimezone();
  const { user } = useAuth();
  // Only selectable drivers and active teams can be picked
  const { selectableDrivers, activeTeams, getDriverTeam, getTeamLogo, getDriverLogo } = useF1Data();
  const driverOptions = useMemo(
    () => buildDriverOptions(selectableDrivers, getDriverTeam, getTeamLogo),
    [selectableDrivers, getDriverTeam, getTeamLogo]
  );
  const constructorOptions = useMemo(() => buildTeamOptions(activeTeams), [activeTeams]);
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
  // Unknown deadline (loading error, empty calendar) → closed, never open forever
  const pastDeadline = deadlineMs ? Date.now() > deadlineMs : !loadingDeadline;

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
            new Date(ms).toLocaleString(dateLocale, {
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit",
              timeZone: timezone,
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

          if (
            Array.isArray(championshipPiloti) &&
            championshipPiloti.length === 3 &&
            Array.isArray(championshipCostruttori) &&
            championshipCostruttori.length === 3
          ) {
            setForm((f) => ({
              ...f,
              D1: findOptionOrCreate(driverOptions, championshipPiloti[0], getDriverLogo),
              D2: findOptionOrCreate(driverOptions, championshipPiloti[1], getDriverLogo),
              D3: findOptionOrCreate(driverOptions, championshipPiloti[2], getDriverLogo),
              C1:
                findOptionOrCreate(constructorOptions, championshipCostruttori[0], getTeamLogo),
              C2:
                findOptionOrCreate(constructorOptions, championshipCostruttori[1], getTeamLogo),
              C3:
                findOptionOrCreate(constructorOptions, championshipCostruttori[2], getTeamLogo),
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
        <LogoLoader label={t("common.loading")} />
      </Container>
    );

  return (
    <div className="fx lineup-page">
      <Row className="g-3 g-lg-4 align-items-start">
        {/* FORM ------------------------------------------------------- */}
        <Col xs={12} lg={6}>
          <div className="fx-card lineup-card">
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
                <section className="lineup-section">
                  <div className="lineup-section-head">
                    <span className="lineup-section-title">{t("championshipForm.title")}</span>
                    <span className={`lineup-status ${pastDeadline ? "is-closed" : "is-open"}`}>
                      {pastDeadline ? t("formations.closed") : t("formations.open")}
                    </span>
                  </div>
                  <div className="lineup-section-deadline">
                    {t("formations.submitBy")} {deadlineText}
                  </div>
                </section>

                <section className="lineup-section">
                  <div className="lineup-section-head">
                    <span className="lineup-section-title">{t("championshipForm.topDrivers")}</span>
                  </div>
                  {["D1", "D2", "D3"].map((f, i) => (
                    <PickRow key={f} label={`${i + 1}°`}>
                      <Select
                        options={driverOptions}
                        value={form[f]}
                        onChange={(sel) => onSel(sel, f)}
                        placeholder={t(driverLabels[f])}
                        classNamePrefix="react-select"
                        isSearchable={!COARSE_POINTER}
                        menuPlacement="auto"
                        blurInputOnSelect
                        isDisabled={pastDeadline}
                        aria-label={t(driverLabels[f])}
                        required
                      />
                    </PickRow>
                  ))}
                </section>

                <section className="lineup-section">
                  <div className="lineup-section-head">
                    <span className="lineup-section-title">{t("championshipForm.topConstructors")}</span>
                  </div>
                  {["C1", "C2", "C3"].map((f, i) => (
                    <PickRow key={f} label={`${i + 1}°`}>
                      <Select
                        options={constructorOptions}
                        value={form[f]}
                        onChange={(sel) => onSel(sel, f)}
                        placeholder={t(constructorLabels[f])}
                        classNamePrefix="react-select"
                        isDisabled={pastDeadline}
                        aria-label={t(constructorLabels[f])}
                        required
                      />
                    </PickRow>
                  ))}
                </section>

                <div className="lineup-actions">
                  <Button
                    variant="danger"
                    type="submit"
                    className="lineup-btn"
                    disabled={!allPicked || saving || pastDeadline}
                  >
                    {saving
                      ? t("common.loading")
                      : isEdit
                      ? `${t("common.edit")} ${t("championshipForm.title")}`
                      : t("championshipForm.saveFormation")}
                  </Button>
                </div>
              </Form>
          </div>
        </Col>

        {/* LISTA ------------------------------------------------------ */}
        <Col xs={12} lg={6}>
          <ChampionshipSubmissions refresh={refreshKey} currentUserId={user?.uid} deadlineMs={deadlineMs} />
        </Col>
      </Row>
    </div>
  );
}