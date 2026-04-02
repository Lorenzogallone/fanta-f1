/**
 * @file ChampionshipManager.jsx
 * @description Championship deadline management and formation viewer/editor.
 * Unified card design, mobile-first, consistent with the admin panel style.
 */

import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Button,
  Form,
  Spinner,
  Badge,
  Modal,
  ListGroup,
  Alert,
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
import { DRIVERS, CONSTRUCTORS, DRIVER_TEAM, TEAM_LOGOS } from "../../constants/racing";
import Select from "react-select";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../hooks/useLanguage";
import { useTimezone } from "../../hooks/useTimezone";
import { getChampionshipDeadlineAutoMs } from "../../utils/championshipDeadline";
import { error as logError } from "../../utils/logger";
import "../../styles/customSelect.css";

const CONFIG_DOC = doc(db, "config", "championship");

const driverOptions = DRIVERS.map((d) => ({
  value: d,
  label: (
    <div className="select-option">
      <img
        src={TEAM_LOGOS[DRIVER_TEAM[d]]}
        className="option-logo"
        alt={`${DRIVER_TEAM[d]} team logo`}
        loading="lazy"
      />
      <span className="option-text">{d}</span>
    </div>
  ),
}));

const constructorOptions = CONSTRUCTORS.map((c) => ({
  value: c,
  label: (
    <div className="select-option">
      <img
        src={TEAM_LOGOS[c]}
        className="option-logo"
        alt={`${c} logo`}
        loading="lazy"
      />
      <span className="option-text">{c}</span>
    </div>
  ),
}));

function toDatetimeLocal(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(ms, locale, tz) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(locale, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    ...(tz ? { timeZone: tz } : {}),
  });
}

export default function ChampionshipManager({ participants, loading, onDataChange }) {
  const { t, currentLanguage } = useLanguage();
  const { isDark } = useTheme();
  const { timezone } = useTimezone();
  const dateLocale = currentLanguage === "en" ? "en-GB" : "it-IT";

  /* ── Deadline state ── */
  const [deadlineOverride, setDeadlineOverride] = useState(null);
  const [deadlineAutoMs, setDeadlineAutoMs] = useState(null);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [deadlineMsg, setDeadlineMsg] = useState(null);
  const [loadingDeadline, setLoadingDeadline] = useState(true);

  /* ── Deadline confirmation ── */
  const [showSaveDeadlineConfirm, setShowSaveDeadlineConfirm] = useState(false);
  const [showResetDeadlineConfirm, setShowResetDeadlineConfirm] = useState(false);

  /* ── Formation edit state ── */
  const [editingId, setEditingId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ pilots: [null, null, null], constructors: [null, null, null] });
  const [savingEdit, setSavingEdit] = useState(false);
  const [formationsMsg, setFormationsMsg] = useState(null);

  /* ── Formation save confirmation ── */
  const [showSaveFormationConfirm, setShowSaveFormationConfirm] = useState(false);

  /* ── Delete state ── */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingParticipant, setDeletingParticipant] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const borderColor = isDark ? "var(--border-color)" : "#dee2e6";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: isDark ? "var(--bg-tertiary)" : "#fff",
      borderColor: state.isFocused ? "var(--accent-red)" : isDark ? "var(--border-color)" : "#ced4da",
      boxShadow: state.isFocused ? "0 0 0 0.2rem rgba(220,53,69,.25)" : "none",
      "&:hover": { borderColor: "var(--accent-red)" },
      minHeight: 36,
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: isDark ? "var(--bg-tertiary)" : "#fff",
      border: `1px solid ${isDark ? "var(--border-color)" : "#ced4da"}`,
      zIndex: 9999,
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? (isDark ? "var(--bg-secondary)" : "#f8f9fa") : "transparent",
      color: "var(--text-primary)",
    }),
    singleValue: (base) => ({ ...base, color: "var(--text-primary)" }),
    input: (base) => ({ ...base, color: "var(--text-primary)" }),
    placeholder: (base) => ({ ...base, color: "var(--text-muted)" }),
  };

  /* ── Load deadline ── */
  const loadDeadline = useCallback(async () => {
    setLoadingDeadline(true);
    try {
      const [configSnap, autoMs] = await Promise.all([getDoc(CONFIG_DOC), getChampionshipDeadlineAutoMs()]);
      setDeadlineAutoMs(autoMs);
      if (configSnap.exists()) {
        const ov = configSnap.data().deadlineOverride || null;
        setDeadlineOverride(ov);
        setDeadlineInput(ov ? toDatetimeLocal(ov) : autoMs ? toDatetimeLocal(new Date(autoMs)) : "");
      } else {
        setDeadlineOverride(null);
        setDeadlineInput(autoMs ? toDatetimeLocal(new Date(autoMs)) : "");
      }
    } catch (e) { logError(e); }
    finally { setLoadingDeadline(false); }
  }, []);

  useEffect(() => { loadDeadline(); }, [loadDeadline]);

  const handleSaveDeadline = async () => {
    setShowSaveDeadlineConfirm(false);
    if (!deadlineInput) return;
    setSavingDeadline(true); setDeadlineMsg(null);
    try {
      const ts = Timestamp.fromDate(new Date(deadlineInput));
      await setDoc(CONFIG_DOC, { deadlineOverride: ts }, { merge: true });
      setDeadlineOverride(ts);
      setDeadlineMsg({ type: "success", text: t("admin.deadlineSaved") });
    } catch (err) {
      logError(err);
      setDeadlineMsg({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally { setSavingDeadline(false); }
  };

  const handleResetDeadline = async () => {
    setShowResetDeadlineConfirm(false);
    setSavingDeadline(true); setDeadlineMsg(null);
    try {
      await setDoc(CONFIG_DOC, { deadlineOverride: deleteField() }, { merge: true });
      setDeadlineOverride(null);
      setDeadlineInput("");
      setDeadlineMsg({ type: "success", text: t("admin.deadlineReset") });
    } catch (err) {
      logError(err);
      setDeadlineMsg({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally { setSavingDeadline(false); }
  };

  /* ── Edit formation ── */
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
    setShowEditModal(true);
  };

  const requestSaveFormation = () => {
    if (editForm.pilots.some((p) => !p) || editForm.constructors.some((c) => !c)) {
      setFormationsMsg({ type: "warning", text: t("errors.incompleteForm") });
      return;
    }
    setShowSaveFormationConfirm(true);
  };

  const handleSaveEdit = async () => {
    setShowSaveFormationConfirm(false);
    setSavingEdit(true); setFormationsMsg(null);
    try {
      await updateDoc(doc(db, "ranking", editingId), {
        championshipPiloti: editForm.pilots.map((p) => p.value),
        championshipCostruttori: editForm.constructors.map((c) => c.value),
      });
      setFormationsMsg({ type: "success", text: t("admin.formationUpdated") });
      setShowEditModal(false);
      setEditingId(null);
      onDataChange();
    } catch (err) {
      logError(err);
      setFormationsMsg({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally { setSavingEdit(false); }
  };

  /* ── Delete formation ── */
  const openDeleteConfirm = (participant) => {
    setDeletingParticipant(participant);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deletingParticipant) return;
    setDeletingId(deletingParticipant.id);
    setFormationsMsg(null);
    try {
      await updateDoc(doc(db, "ranking", deletingParticipant.id), {
        championshipPiloti: deleteField(),
        championshipCostruttori: deleteField(),
      });
      setFormationsMsg({ type: "success", text: t("admin.formationDeleted") });
      setShowDeleteConfirm(false);
      setDeletingParticipant(null);
      onDataChange();
    } catch (err) {
      logError(err);
      setFormationsMsg({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally { setDeletingId(null); }
  };

  /* ── Derived data ── */
  const hasFormation = (p) =>
    Array.isArray(p.championshipPiloti) && p.championshipPiloti.length === 3
    && Array.isArray(p.championshipCostruttori) && p.championshipCostruttori.length === 3;
  const formationsCount = participants.filter(hasFormation).length;
  const effectiveDeadlineMs = deadlineOverride ? deadlineOverride.toDate().getTime() : deadlineAutoMs;
  const isOpen = effectiveDeadlineMs ? Date.now() < effectiveDeadlineMs : true;

  const editingParticipantName = participants.find((p) => p.id === editingId)?.name;

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" /></div>;
  }

  return (
    <>
      {/* ── DEADLINE SECTION ── */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0 fw-bold" style={{ color: "var(--text-primary)" }}>
            {t("admin.championshipDeadline")}
          </h6>
          <Badge bg={isOpen ? "success" : "danger"} style={{ fontSize: "0.7rem" }}>
            {isOpen ? t("formations.open") : t("formations.closed")}
          </Badge>
        </div>

        <div
          className="rounded p-3"
          style={{ backgroundColor: bgCard, border: `1px solid ${borderColor}` }}
        >
          {deadlineMsg && (
            <Alert variant={deadlineMsg.type} dismissible onClose={() => setDeadlineMsg(null)} className="py-2 mb-2">
              {deadlineMsg.text}
            </Alert>
          )}

          {loadingDeadline ? (
            <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>
          ) : (
            <>
              <div className="d-flex flex-wrap align-items-center gap-2 mb-3" style={{ fontSize: "0.85rem" }}>
                <span className="fw-semibold">{t("admin.deadlineCurrentLabel")}:</span>
                <span className="fw-bold" style={{ color: isDark ? "#fbbf24" : "#d97706" }}>
                  {formatDate(effectiveDeadlineMs, dateLocale, timezone)}
                </span>
                <Badge
                  bg={deadlineOverride ? "warning" : "secondary"}
                  text={deadlineOverride ? "dark" : undefined}
                  style={{ fontSize: "0.65rem" }}
                >
                  {deadlineOverride ? t("admin.deadlineOverrideActive") : t("admin.deadlineAutoCalculated")}
                </Badge>
              </div>

              {deadlineAutoMs && deadlineOverride && (
                <p className="small text-muted mb-3" style={{ fontSize: "0.75rem" }}>
                  {t("admin.deadlineAutoCalculated")}: {formatDate(deadlineAutoMs, dateLocale, timezone)}
                </p>
              )}

              <Form onSubmit={(e) => { e.preventDefault(); setShowSaveDeadlineConfirm(true); }}>
                <Form.Label className="mb-1 small fw-semibold text-muted">{t("admin.editDeadline")}</Form.Label>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <Form.Control
                    type="datetime-local" size="sm"
                    value={deadlineInput}
                    onChange={(e) => setDeadlineInput(e.target.value)}
                    style={{ maxWidth: 220 }}
                  />
                  <Button variant="danger" type="submit" disabled={savingDeadline || !deadlineInput} size="sm">
                    {savingDeadline ? <Spinner animation="border" size="sm" /> : t("common.save")}
                  </Button>
                  {deadlineOverride && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      disabled={savingDeadline}
                      onClick={() => setShowResetDeadlineConfirm(true)}
                    >
                      {t("admin.resetDeadline")}
                    </Button>
                  )}
                </div>
              </Form>
            </>
          )}
        </div>
      </div>

      {/* ── FORMATIONS SECTION ── */}
      <div>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0 fw-bold" style={{ color: "var(--text-primary)" }}>
            {t("admin.manageChampionshipFormations")}
          </h6>
          <Badge bg="secondary" style={{ fontSize: "0.7rem" }}>
            {formationsCount}/{participants.length}
          </Badge>
        </div>

        {formationsMsg && (
          <Alert variant={formationsMsg.type} dismissible onClose={() => setFormationsMsg(null)} className="py-2 mb-2">
            {formationsMsg.text}
          </Alert>
        )}

        {participants.length === 0 ? (
          <div
            className="text-center py-4 rounded"
            style={{ backgroundColor: bgCard, border: `1px solid ${borderColor}`, color: "var(--text-muted)" }}
          >
            <p className="mb-0 small">{t("admin.noChampionshipFormations")}</p>
          </div>
        ) : (
          <ListGroup variant="flush" style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${borderColor}` }}>
            {participants.map((p) => {
              const has = hasFormation(p);
              return (
                <ListGroup.Item
                  key={p.id}
                  className="px-3 py-2"
                  style={{ backgroundColor: bgCard, color: "var(--text-primary)", borderColor }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span className="fw-semibold">{p.name}</span>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        {has ? (
                          <Badge bg="success" style={{ fontSize: "0.65rem" }}>{t("admin.submitted")}</Badge>
                        ) : (
                          <Badge bg="outline-secondary" style={{ fontSize: "0.65rem", border: `1px solid ${borderColor}`, color: "var(--text-muted)" }}>
                            {t("admin.notSubmitted")}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="d-flex gap-1 flex-shrink-0">
                      <Button
                        variant={has ? "outline-primary" : "outline-success"}
                        size="sm"
                        className="py-0 px-2"
                        onClick={() => startEdit(p)}
                        style={{ fontSize: "0.75rem" }}
                      >
                        {has ? t("common.edit") : "+ " + t("common.add")}
                      </Button>
                      {has && (
                        <Button variant="outline-danger" size="sm" className="py-0 px-2" onClick={() => openDeleteConfirm(p)}
                          disabled={deletingId === p.id} style={{ fontSize: "0.75rem" }}>
                          {deletingId === p.id ? <Spinner animation="border" size="sm" /> : t("common.delete")}
                        </Button>
                      )}
                    </div>
                  </div>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        )}
      </div>

      {/* ── Edit Formation Modal ── */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">
            {t("admin.editFormationTitle")}
            <small className="text-muted ms-2">— {editingParticipantName}</small>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formationsMsg && (
            <Alert variant={formationsMsg.type} dismissible onClose={() => setFormationsMsg(null)} className="py-2">
              {formationsMsg.text}
            </Alert>
          )}

          <p className="small fw-bold mb-2">{t("history.topDrivers")}</p>
          {[0, 1, 2].map((i) => (
            <Form.Group key={`d${i}`} className="mb-2">
              <Form.Label className="small mb-1">{t(`championshipForm.driver${i + 1}`)} <span className="text-danger">*</span></Form.Label>
              <Select
                options={driverOptions.filter(
                  (o) => !editForm.pilots.some((sel, idx) => sel?.value === o.value && idx !== i)
                )}
                value={editForm.pilots[i]}
                onChange={(sel) => {
                  const next = [...editForm.pilots]; next[i] = sel;
                  setEditForm((f) => ({ ...f, pilots: next }));
                }}
                styles={selectStyles}
                placeholder={t("common.select")}
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </Form.Group>
          ))}

          <hr />
          <p className="small fw-bold mb-2">{t("history.topConstructors")}</p>
          {[0, 1, 2].map((i) => (
            <Form.Group key={`c${i}`} className="mb-2">
              <Form.Label className="small mb-1">{t(`championshipForm.constructor${i + 1}`)} <span className="text-danger">*</span></Form.Label>
              <Select
                options={constructorOptions.filter(
                  (o) => !editForm.constructors.some((sel, idx) => sel?.value === o.value && idx !== i)
                )}
                value={editForm.constructors[i]}
                onChange={(sel) => {
                  const next = [...editForm.constructors]; next[i] = sel;
                  setEditForm((f) => ({ ...f, constructors: next }));
                }}
                styles={selectStyles}
                placeholder={t("common.select")}
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </Form.Group>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowEditModal(false)} disabled={savingEdit}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" size="sm" onClick={requestSaveFormation} disabled={savingEdit}>
            {savingEdit ? <Spinner animation="border" size="sm" /> : t("common.save")}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Save Formation Confirmation Modal ── */}
      <Modal show={showSaveFormationConfirm} onHide={() => setShowSaveFormationConfirm(false)} centered size="sm">
        <Modal.Body className="text-center py-4">
          <p className="fw-semibold mb-1">{t("admin.confirmSaveFormation") || "Conferma salvataggio"}</p>
          <p className="fw-bold mb-3">{editingParticipantName}</p>
          <div className="d-flex gap-2 justify-content-center">
            <Button variant="secondary" size="sm" onClick={() => setShowSaveFormationConfirm(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" size="sm" onClick={handleSaveEdit}>
              {t("common.confirm") || t("common.save")}
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Body className="text-center py-4">
          <p className="fw-semibold mb-1">{t("admin.confirmDeleteFormation")}</p>
          <p className="fw-bold mb-3">{deletingParticipant?.name}</p>
          <div className="d-flex gap-2 justify-content-center">
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={deletingId}>
              {deletingId ? <Spinner animation="border" size="sm" /> : t("common.delete")}
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      {/* ── Save Deadline Confirmation Modal ── */}
      <Modal show={showSaveDeadlineConfirm} onHide={() => setShowSaveDeadlineConfirm(false)} centered size="sm">
        <Modal.Body className="text-center py-4">
          <p className="fw-semibold mb-1">{t("admin.confirmSaveDeadline") || "Conferma salvataggio scadenza"}</p>
          <p className="fw-bold mb-3">{deadlineInput ? new Date(deadlineInput).toLocaleString(dateLocale, { timeZone: timezone }) : ""}</p>
          <div className="d-flex gap-2 justify-content-center">
            <Button variant="secondary" size="sm" onClick={() => setShowSaveDeadlineConfirm(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" size="sm" onClick={handleSaveDeadline}>
              {t("common.confirm") || t("common.save")}
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      {/* ── Reset Deadline Confirmation Modal ── */}
      <Modal show={showResetDeadlineConfirm} onHide={() => setShowResetDeadlineConfirm(false)} centered size="sm">
        <Modal.Body className="text-center py-4">
          <p className="fw-semibold mb-1">{t("admin.confirmResetDeadline") || "Conferma reset scadenza"}</p>
          <div className="d-flex gap-2 justify-content-center">
            <Button variant="secondary" size="sm" onClick={() => setShowResetDeadlineConfirm(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" size="sm" onClick={handleResetDeadline}>
              {t("common.confirm") || t("admin.resetDeadline")}
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}

ChampionshipManager.propTypes = {
  participants: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool.isRequired,
  onDataChange: PropTypes.func.isRequired,
};
