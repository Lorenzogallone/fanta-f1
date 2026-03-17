/**
 * @file ChampionshipManager.jsx
 * @description Admin component to manage championship deadline override
 * and view/edit/delete all championship formations (piloti + costruttori).
 */

import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Row,
  Col,
  Card,
  Button,
  Form,
  Spinner,
  Badge,
  Table,
} from "react-bootstrap";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteField,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { DRIVERS, CONSTRUCTORS } from "../../constants/racing";
import Select from "react-select";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../hooks/useLanguage";
import { getChampionshipDeadlineAutoMs } from "../../utils/championshipDeadline";
import { error as logError } from "../../utils/logger";

const CONFIG_DOC = doc(db, "config", "championship");

/** Slim inline feedback banner — replaces Bootstrap Alert for a cleaner look */
function InlineMsg({ msg, isDark, onClose }) {
  if (!msg) return null;
  const isSuccess = msg.type === "success";
  return (
    <div
      className="d-flex align-items-center gap-2 mb-3 px-3 py-2 rounded"
      style={{
        backgroundColor: isSuccess
          ? isDark ? "#0f2a1a" : "#f0fdf4"
          : isDark ? "#2a0f0f" : "#fff5f5",
        borderLeft: `3px solid ${isSuccess ? "#22c55e" : "#ef4444"}`,
        fontSize: "0.85rem",
        color: isSuccess
          ? isDark ? "#86efac" : "#15803d"
          : isDark ? "#fca5a5" : "#b91c1c",
      }}
    >
      <span style={{ fontWeight: 600 }}>{isSuccess ? "✓" : "✕"}</span>
      <span style={{ flex: 1 }}>{msg.text}</span>
      <button
        onClick={onClose}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: "1rem", lineHeight: 1, opacity: 0.6,
          color: "inherit", padding: "0 2px",
        }}
        aria-label="Close"
      >×</button>
    </div>
  );
}

const driverOptions = DRIVERS.map((d) => ({ value: d, label: d }));
const constructorOptions = CONSTRUCTORS.map((c) => ({ value: c, label: c }));

/** Format a JS Date or Firestore Timestamp to datetime-local string (local time) */
function toDatetimeLocal(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Format a ms timestamp to a readable date string */
function formatDate(ms, locale) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(locale, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Admin championship management component.
 * @param {Object} props
 * @param {Array}  props.participants - Shared participants array (includes championshipPiloti/Costruttori)
 * @param {boolean} props.loading     - Loading state from parent
 * @param {Function} props.onDataChange - Callback to refresh shared data
 */
export default function ChampionshipManager({ participants, loading, onDataChange }) {
  const { t, currentLanguage } = useLanguage();
  const { isDark } = useTheme();
  const dateLocale = currentLanguage === "en" ? "en-GB" : "it-IT";

  /* ─────────────────────── DEADLINE ─────────────────────── */
  const [deadlineOverride, setDeadlineOverride] = useState(null); // Firestore Timestamp | null
  const [deadlineAutoMs, setDeadlineAutoMs] = useState(null);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [deadlineMsg, setDeadlineMsg] = useState(null);
  const [loadingDeadline, setLoadingDeadline] = useState(true);

  /* ─────────────────────── FORMATIONS ─────────────────────── */
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    pilots: [null, null, null],
    constructors: [null, null, null],
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [formationsMsg, setFormationsMsg] = useState(null);

  /* ─────────────────────── STYLES ─────────────────────── */
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";
  const bgHeader = isDark ? "var(--bg-tertiary)" : "#f8f9fa";

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: isDark ? "#2d3748" : "#fff",
      borderColor: state.isFocused ? "#dc3545" : isDark ? "#4a5568" : "#ced4da",
      boxShadow: state.isFocused ? "0 0 0 0.2rem rgba(220,53,69,.25)" : "none",
      "&:hover": { borderColor: "#dc3545" },
      minHeight: "36px",
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: isDark ? "#2d3748" : "#fff",
      border: isDark ? "1px solid #4a5568" : "1px solid #ced4da",
      zIndex: 9999,
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused
        ? isDark ? "#4a5568" : "#f8f9fa"
        : isDark ? "#2d3748" : "#fff",
      color: isDark ? "#e2e8f0" : "#212529",
    }),
    singleValue: (base) => ({ ...base, color: isDark ? "#e2e8f0" : "#212529" }),
    input: (base) => ({ ...base, color: isDark ? "#e2e8f0" : "#212529" }),
    placeholder: (base) => ({ ...base, color: isDark ? "#a0aec0" : "#6c757d" }),
  };

  /* ─────────────────────── LOAD DEADLINE ─────────────────────── */
  const loadDeadline = useCallback(async () => {
    setLoadingDeadline(true);
    try {
      const [configSnap, autoMs] = await Promise.all([
        getDoc(CONFIG_DOC),
        getChampionshipDeadlineAutoMs(),
      ]);
      setDeadlineAutoMs(autoMs);
      if (configSnap.exists()) {
        const { deadlineOverride: ov } = configSnap.data();
        setDeadlineOverride(ov || null);
        const effectiveMs = ov ? ov.toDate().getTime() : autoMs;
        setDeadlineInput(effectiveMs ? toDatetimeLocal(new Date(effectiveMs)) : "");
      } else {
        setDeadlineOverride(null);
        setDeadlineInput(autoMs ? toDatetimeLocal(new Date(autoMs)) : "");
      }
    } catch (e) {
      logError(e);
    } finally {
      setLoadingDeadline(false);
    }
  }, []);

  useEffect(() => { loadDeadline(); }, [loadDeadline]);

  /* ─────────────────────── SAVE DEADLINE ─────────────────────── */
  const handleSaveDeadline = async (e) => {
    e.preventDefault();
    if (!deadlineInput) return;
    setSavingDeadline(true);
    setDeadlineMsg(null);
    try {
      const ts = Timestamp.fromDate(new Date(deadlineInput));
      await setDoc(CONFIG_DOC, { deadlineOverride: ts }, { merge: true });
      setDeadlineOverride(ts);
      setDeadlineMsg({ type: "success", text: t("admin.deadlineSaved") });
    } catch (err) {
      logError(err);
      setDeadlineMsg({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setSavingDeadline(false);
    }
  };

  /* ─────────────────────── RESET DEADLINE ─────────────────────── */
  const handleResetDeadline = async () => {
    setSavingDeadline(true);
    setDeadlineMsg(null);
    try {
      await setDoc(CONFIG_DOC, { deadlineOverride: deleteField() }, { merge: true });
      setDeadlineOverride(null);
      setDeadlineInput("");
      setDeadlineMsg({ type: "success", text: t("admin.deadlineReset") });
    } catch (err) {
      logError(err);
      setDeadlineMsg({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setSavingDeadline(false);
    }
  };

  /* ─────────────────────── EDIT FORMATION ─────────────────────── */
  const startEdit = (participant) => {
    const pilots = (participant.championshipPiloti || []).map(
      (v) => driverOptions.find((o) => o.value === v) || null
    );
    const constructors = (participant.championshipCostruttori || []).map(
      (v) => constructorOptions.find((o) => o.value === v) || null
    );
    setEditForm({
      pilots: [pilots[0] || null, pilots[1] || null, pilots[2] || null],
      constructors: [constructors[0] || null, constructors[1] || null, constructors[2] || null],
    });
    setEditingId(participant.id);
    setFormationsMsg(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ pilots: [null, null, null], constructors: [null, null, null] });
  };

  const handleSaveEdit = async () => {
    const { pilots, constructors } = editForm;
    if (pilots.some((p) => !p) || constructors.some((c) => !c)) {
      setFormationsMsg({ type: "danger", text: t("errors.incompleteForm") });
      return;
    }
    setSavingEdit(true);
    setFormationsMsg(null);
    try {
      await updateDoc(doc(db, "ranking", editingId), {
        championshipPiloti: pilots.map((p) => p.value),
        championshipCostruttori: constructors.map((c) => c.value),
      });
      setFormationsMsg({ type: "success", text: t("admin.formationUpdated") });
      cancelEdit();
      onDataChange();
    } catch (err) {
      logError(err);
      setFormationsMsg({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setSavingEdit(false);
    }
  };

  /* ─────────────────────── DELETE FORMATION ─────────────────────── */
  const handleDelete = async (userId) => {
    setDeletingId(userId);
    setFormationsMsg(null);
    try {
      await updateDoc(doc(db, "ranking", userId), {
        championshipPiloti: deleteField(),
        championshipCostruttori: deleteField(),
      });
      setFormationsMsg({ type: "success", text: t("admin.formationDeleted") });
      setConfirmDeleteId(null);
      onDataChange();
    } catch (err) {
      logError(err);
      setFormationsMsg({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setDeletingId(null);
    }
  };

  /* ─────────────────────── DERIVED DATA ─────────────────────── */
  const formations = participants.filter(
    (p) =>
      Array.isArray(p.championshipPiloti) &&
      p.championshipPiloti.length === 3 &&
      Array.isArray(p.championshipCostruttori) &&
      p.championshipCostruttori.length === 3
  );

  const effectiveDeadlineMs = deadlineOverride
    ? deadlineOverride.toDate().getTime()
    : deadlineAutoMs;
  const isOpen = effectiveDeadlineMs ? Date.now() < effectiveDeadlineMs : true;

  /* ─────────────────────── RENDER ─────────────────────── */
  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <Row className="g-4">

      {/* ── DEADLINE CARD ── */}
      <Col xs={12}>
        <Card className="shadow border-0" style={{ backgroundColor: bgCard }}>
          <Card.Header className="py-2" style={{ backgroundColor: bgHeader, borderBottom: `2px solid ${isDark ? "#4a5568" : "#dee2e6"}` }}>
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="mb-0 fw-bold">🗓️ {t("admin.championshipDeadline")}</h6>
              <Badge bg={isOpen ? "success" : "danger"} style={{ fontSize: "0.75rem" }}>
                {isOpen ? t("formations.open") : t("formations.closed")}
              </Badge>
            </div>
          </Card.Header>
          <Card.Body className="py-3">
            <InlineMsg msg={deadlineMsg} isDark={isDark} onClose={() => setDeadlineMsg(null)} />

            {loadingDeadline ? (
              <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>
            ) : (
              <>
                {/* Current effective deadline */}
                <div className="d-flex flex-wrap align-items-center gap-2 mb-3" style={{ fontSize: "0.9rem" }}>
                  <span className="fw-semibold">{t("admin.deadlineCurrentLabel")}:</span>
                  <span className="fw-bold" style={{ color: isDark ? "#fbbf24" : "#d97706" }}>
                    {formatDate(effectiveDeadlineMs, dateLocale)}
                  </span>
                  {deadlineOverride ? (
                    <Badge bg="warning" text="dark" style={{ fontSize: "0.7rem" }}>⚙️ {t("admin.deadlineOverrideActive")}</Badge>
                  ) : (
                    <Badge bg="secondary" style={{ fontSize: "0.7rem" }}>🤖 {t("admin.deadlineAutoCalculated")}</Badge>
                  )}
                </div>

                {/* Auto deadline info */}
                {deadlineAutoMs && deadlineOverride && (
                  <p className="small text-muted mb-3" style={{ fontSize: "0.8rem" }}>
                    {t("admin.deadlineAutoCalculated")}: {formatDate(deadlineAutoMs, dateLocale)}
                  </p>
                )}

                {/* Edit deadline form */}
                <Form onSubmit={handleSaveDeadline}>
                  <Form.Label className="mb-1 small fw-semibold text-muted">
                    ✏️ {t("admin.editDeadline")}
                  </Form.Label>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <Form.Control
                      type="datetime-local"
                      size="sm"
                      value={deadlineInput}
                      onChange={(e) => setDeadlineInput(e.target.value)}
                      style={{
                        backgroundColor: isDark ? "#2d3748" : undefined,
                        color: isDark ? "#e2e8f0" : undefined,
                        borderColor: isDark ? "#4a5568" : undefined,
                        maxWidth: 260,
                      }}
                    />
                    <Button
                      variant="danger"
                      type="submit"
                      disabled={savingDeadline || !deadlineInput}
                      size="sm"
                    >
                      {savingDeadline ? t("common.loading") : t("common.save")}
                    </Button>
                    {deadlineOverride && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        disabled={savingDeadline}
                        onClick={handleResetDeadline}
                      >
                        {t("admin.resetDeadline")}
                      </Button>
                    )}
                  </div>
                </Form>
              </>
            )}
          </Card.Body>
        </Card>
      </Col>

      {/* ── FORMATIONS CARD ── */}
      <Col xs={12}>
        <Card className="shadow border-0" style={{ backgroundColor: bgCard }}>
          <Card.Header className="py-2" style={{ backgroundColor: bgHeader, borderBottom: `2px solid ${isDark ? "#4a5568" : "#dee2e6"}` }}>
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="mb-0 fw-bold">
                📋 {t("admin.manageChampionshipFormations")}
              </h6>
              <Badge bg="secondary" style={{ fontSize: "0.75rem" }}>
                {formations.length} {t("admin.participants").toLowerCase()}
              </Badge>
            </div>
          </Card.Header>
          <Card.Body>
            <InlineMsg msg={formationsMsg} isDark={isDark} onClose={() => setFormationsMsg(null)} />

            {formations.length === 0 ? (
              <div
                className="text-center py-5"
                style={{ color: isDark ? "#718096" : "#adb5bd" }}
              >
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.35 }}>📋</div>
                <p className="mb-0 fw-semibold" style={{ color: isDark ? "#a0aec0" : "#6c757d" }}>
                  {t("admin.noChampionshipFormations")}
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <Table
                  striped
                  bordered
                  hover
                  size="sm"
                  className="mb-0 align-middle"
                  style={{ fontSize: "0.875rem" }}
                >
                  <thead>
                    <tr>
                      <th style={{ width: "20%" }}>{t("leaderboard.player")}</th>
                      <th>{t("history.topDrivers")}</th>
                      <th>{t("history.topConstructors")}</th>
                      <th style={{ width: "110px" }}>{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formations.map((p) => (
                      <React.Fragment key={p.id}>
                        {/* ── Display row ── */}
                        <tr>
                          <td className="fw-semibold">{p.name}</td>
                          <td>
                            {p.championshipPiloti.map((d, i) => (
                              <span key={d} className="me-2 text-nowrap">
                                <strong>{i + 1}°</strong> {d}
                              </span>
                            ))}
                          </td>
                          <td>
                            {p.championshipCostruttori.map((c, i) => (
                              <span key={c} className="me-2 text-nowrap">
                                <strong>{i + 1}°</strong> {c}
                              </span>
                            ))}
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => editingId === p.id ? cancelEdit() : startEdit(p)}
                                aria-label={`Edit formation for ${p.name}`}
                              >
                                {editingId === p.id ? "✕" : "✏️"}
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => setConfirmDeleteId(p.id)}
                                disabled={deletingId === p.id}
                                aria-label={`Delete formation for ${p.name}`}
                              >
                                {deletingId === p.id ? (
                                  <Spinner animation="border" size="sm" />
                                ) : "🗑️"}
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {/* ── Delete confirmation row ── */}
                        {confirmDeleteId === p.id && (
                          <tr>
                            <td
                              colSpan={4}
                              style={{
                                backgroundColor: isDark ? "#1e1a0f" : "#fffbeb",
                                borderLeft: "3px solid #f59e0b",
                              }}
                            >
                              <div className="d-flex align-items-center gap-3 flex-wrap px-2 py-2">
                                <span
                                  className="small"
                                  style={{ color: isDark ? "#fcd34d" : "#92400e" }}
                                >
                                  {t("admin.confirmDeleteFormation")} <strong>{p.name}</strong>?
                                </span>
                                <div className="d-flex gap-2">
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => handleDelete(p.id)}
                                    disabled={deletingId === p.id}
                                  >
                                    {deletingId === p.id
                                      ? <Spinner animation="border" size="sm" />
                                      : t("common.delete")}
                                  </Button>
                                  <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={() => setConfirmDeleteId(null)}
                                  >
                                    {t("common.cancel")}
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* ── Edit row ── */}
                        {editingId === p.id && (
                          <tr>
                            <td colSpan={4}>
                              <div
                                className="p-3 rounded"
                                style={{
                                  backgroundColor: isDark ? "#1a202c" : "#f8f9fa",
                                  border: `1px solid ${isDark ? "#4a5568" : "#dee2e6"}`,
                                }}
                              >
                                <Row className="g-3">
                                  {/* Drivers */}
                                  <Col xs={12} md={6}>
                                    <p className="fw-bold mb-2 small">
                                      🏎️ {t("history.topDrivers")}
                                    </p>
                                    {(["championshipForm.driver1", "championshipForm.driver2", "championshipForm.driver3"]).map((key, i) => (
                                      <Form.Group key={`d${i}`} className="mb-2">
                                        <Form.Label className="small mb-1">{t(key)}</Form.Label>
                                        <Select
                                          options={driverOptions.filter(
                                            (o) => !editForm.pilots.some(
                                              (sel, idx) => sel?.value === o.value && idx !== i
                                            )
                                          )}
                                          value={editForm.pilots[i]}
                                          onChange={(sel) => {
                                            const next = [...editForm.pilots];
                                            next[i] = sel;
                                            setEditForm((f) => ({ ...f, pilots: next }));
                                          }}
                                          styles={selectStyles}
                                          placeholder={t("formations.selectUser")}
                                          noOptionsMessage={() => t("errors.duplicateDriver")}
                                        />
                                      </Form.Group>
                                    ))}
                                  </Col>

                                  {/* Constructors */}
                                  <Col xs={12} md={6}>
                                    <p className="fw-bold mb-2 small">
                                      🏭 {t("history.topConstructors")}
                                    </p>
                                    {(["championshipForm.constructor1", "championshipForm.constructor2", "championshipForm.constructor3"]).map((key, i) => (
                                      <Form.Group key={`c${i}`} className="mb-2">
                                        <Form.Label className="small mb-1">{t(key)}</Form.Label>
                                        <Select
                                          options={constructorOptions.filter(
                                            (o) => !editForm.constructors.some(
                                              (sel, idx) => sel?.value === o.value && idx !== i
                                            )
                                          )}
                                          value={editForm.constructors[i]}
                                          onChange={(sel) => {
                                            const next = [...editForm.constructors];
                                            next[i] = sel;
                                            setEditForm((f) => ({ ...f, constructors: next }));
                                          }}
                                          styles={selectStyles}
                                          placeholder={t("formations.selectUser")}
                                          noOptionsMessage={() => t("errors.duplicateDriver")}
                                        />
                                      </Form.Group>
                                    ))}
                                  </Col>
                                </Row>

                                <div className="d-flex gap-2 mt-2">
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={handleSaveEdit}
                                    disabled={savingEdit}
                                  >
                                    {savingEdit ? t("common.loading") : t("common.save")}
                                  </Button>
                                  <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={cancelEdit}
                                    disabled={savingEdit}
                                  >
                                    {t("common.cancel")}
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

ChampionshipManager.propTypes = {
  participants: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool.isRequired,
  onDataChange: PropTypes.func.isRequired,
};
