/**
 * @file FormationsManager.jsx
 * @description Formations management — race selector card at top, then user list
 * with submission status and edit/create/delete actions via modal.
 */

import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import {
  Button,
  Form,
  Alert,
  Spinner,
  Badge,
  Modal,
  ListGroup,
} from "react-bootstrap";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { DRIVERS, DRIVER_TEAM, TEAM_LOGOS } from "../../constants/racing";
import Select from "react-select";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../hooks/useLanguage";
import { error } from "../../utils/logger";
import "../../styles/customSelect.css";

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

export default function FormationsManager({ participants, races, loading, onDataChange }) {
  const { t } = useLanguage();
  const { isDark } = useTheme();

  const [selectedRace, setSelectedRace] = useState(null);
  const [submissions, setSubmissions] = useState({});     // userId → submission data
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({
    mainP1: null, mainP2: null, mainP3: null,
    mainJolly: null, mainJolly2: null,
    sprintP1: null, sprintP2: null, sprintP3: null,
    sprintJolly: null,
  });
  const [isLateSubmission, setIsLateSubmission] = useState(false);

  // Save confirmation
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);

  const borderColor = isDark ? "var(--border-color)" : "#dee2e6";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";

  // Default to first race without results and not cancelled
  const defaultRace = useMemo(() => {
    return races.find((r) => !r.officialResults && !r.cancelledMain) || (races.length > 0 ? races[0] : null);
  }, [races]);

  useEffect(() => {
    if (!selectedRace && defaultRace) {
      setSelectedRace(defaultRace);
    }
  }, [defaultRace]);

  // Load all submissions when race changes
  useEffect(() => {
    if (!selectedRace) return;
    loadSubmissions();
  }, [selectedRace]);

  const loadSubmissions = async () => {
    if (!selectedRace) return;
    setLoadingSubs(true);
    try {
      const results = {};
      const docs = await Promise.all(
        participants.map((p) => getDoc(doc(db, "races", selectedRace.id, "submissions", p.id)))
      );
      docs.forEach((d, i) => {
        if (d.exists()) {
          results[participants[i].id] = d.data();
        }
      });
      setSubmissions(results);
    } catch (err) {
      error(err);
    } finally {
      setLoadingSubs(false);
    }
  };

  const hasSprint = Boolean(selectedRace?.qualiSprintUTC);

  // ─── Edit Modal ───
  const openEdit = (participant) => {
    setEditingUser(participant);
    setMessage(null);
    const sub = submissions[participant.id];
    if (sub) {
      setFormData({
        mainP1: findOpt(sub.mainP1), mainP2: findOpt(sub.mainP2), mainP3: findOpt(sub.mainP3),
        mainJolly: findOpt(sub.mainJolly), mainJolly2: findOpt(sub.mainJolly2),
        sprintP1: findOpt(sub.sprintP1), sprintP2: findOpt(sub.sprintP2), sprintP3: findOpt(sub.sprintP3),
        sprintJolly: findOpt(sub.sprintJolly),
      });
      setIsLateSubmission(sub.isLate ?? false);
    } else {
      resetForm();
    }
    setShowEditModal(true);
  };

  const findOpt = (name) => name ? driverOptions.find((o) => o.value === name) || null : null;

  const resetForm = () => {
    setFormData({
      mainP1: null, mainP2: null, mainP3: null,
      mainJolly: null, mainJolly2: null,
      sprintP1: null, sprintP2: null, sprintP3: null,
      sprintJolly: null,
    });
    setIsLateSubmission(false);
  };

  const getSelectedDrivers = (fields) =>
    fields.map((f) => formData[f]?.value).filter(Boolean);

  const getAvailableOptions = (field, fields) => {
    const selected = getSelectedDrivers(fields);
    const current = formData[field]?.value;
    return driverOptions.filter((o) => !selected.includes(o.value) || o.value === current);
  };

  const mainFields = ["mainP1", "mainP2", "mainP3", "mainJolly", "mainJolly2"];
  const sprintFields = ["sprintP1", "sprintP2", "sprintP3", "sprintJolly"];

  const requestSave = () => {
    if (!formData.mainP1 || !formData.mainP2 || !formData.mainP3 || !formData.mainJolly) {
      setMessage({ type: "warning", text: t("errors.incompleteForm") });
      return;
    }
    const mainDrivers = mainFields.map((f) => formData[f]?.value).filter(Boolean);
    if (new Set(mainDrivers).size !== mainDrivers.length) {
      setMessage({ type: "warning", text: t("errors.duplicateDriver") });
      return;
    }
    setShowSaveConfirm(true);
  };

  const handleSave = async () => {
    setShowSaveConfirm(false);
    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        user: editingUser.name,
        userId: editingUser.id,
        mainP1: formData.mainP1.value,
        mainP2: formData.mainP2.value,
        mainP3: formData.mainP3.value,
        mainJolly: formData.mainJolly.value,
        mainJolly2: formData.mainJolly2?.value || null,
        sprintP1: formData.sprintP1?.value || null,
        sprintP2: formData.sprintP2?.value || null,
        sprintP3: formData.sprintP3?.value || null,
        sprintJolly: formData.sprintJolly?.value || null,
        submittedAt: Timestamp.now(),
      };

      if (isLateSubmission) {
        payload.isLate = true;
        payload.latePenalty = -3;
        await updateDoc(doc(db, "ranking", editingUser.id), { usedLateSubmission: true });
      }

      const isNew = !submissions[editingUser.id];
      await setDoc(doc(db, "races", selectedRace.id, "submissions", editingUser.id), payload, { merge: true });

      setMessage({ type: "success", text: isNew ? t("admin.formationAdded") : t("admin.formationUpdated") });
      await loadSubmissions();
      setTimeout(() => { setShowEditModal(false); setMessage(null); }, 1200);
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ───
  const confirmDelete = (participant) => {
    setDeletingUser(participant);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deletingUser || !selectedRace) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "races", selectedRace.id, "submissions", deletingUser.id));
      await loadSubmissions();
      setShowDeleteConfirm(false);
      setDeletingUser(null);
    } catch (err) {
      error(err);
    } finally {
      setSaving(false);
    }
  };

  // ─── Select styles ───
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

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" /></div>;
  }

  const renderDriverSelect = (field, label, required, fieldGroup) => (
    <Form.Group className="mb-2" key={field}>
      <Form.Label className="small fw-semibold mb-1">
        {label} {required && <span className="text-danger">*</span>}
      </Form.Label>
      <Select
        options={getAvailableOptions(field, fieldGroup)}
        value={formData[field]}
        onChange={(sel) => setFormData({ ...formData, [field]: sel })}
        placeholder={t("common.select")}
        styles={selectStyles}
        isClearable={!required}
        menuPortalTarget={document.body}
        menuPosition="fixed"
      />
    </Form.Group>
  );

  return (
    <>
      {/* Race selector */}
      <div className="mb-3">
        <h6 className="mb-2 fw-bold" style={{ color: "var(--text-primary)" }}>
          {t("admin.manageFormations")}
        </h6>
        <Form.Select
          size="sm"
          value={selectedRace?.id || ""}
          onChange={(e) => {
            const race = races.find((r) => r.id === e.target.value);
            setSelectedRace(race || null);
          }}
        >
          <option value="">{t("formations.selectRace")}</option>
          {races.map((r) => {
            const hasResults = Boolean(r.officialResults);
            const cancelled = r.cancelledMain;
            const sprint = Boolean(r.qualiSprintUTC);
            let label = `R${r.round} — ${r.name}`;
            const tags = [];
            if (sprint) tags.push("Sprint");
            if (hasResults) tags.push(t("admin.hasResults"));
            if (cancelled) tags.push(t("admin.raceCancelled"));
            if (tags.length) label += ` [${tags.join(", ")}]`;
            return <option key={r.id} value={r.id}>{label}</option>;
          })}
        </Form.Select>
      </div>

      {/* User list with submission status */}
      {selectedRace && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <small className="text-muted fw-semibold">
              R{selectedRace.round} — {selectedRace.name}
            </small>
            <Badge bg="secondary" style={{ fontSize: "0.7rem" }}>
              {Object.keys(submissions).length}/{participants.length}
            </Badge>
          </div>

          {loadingSubs ? (
            <div className="text-center py-4"><Spinner animation="border" size="sm" /></div>
          ) : (
            <ListGroup variant="flush" style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${borderColor}` }}>
              {participants.map((p) => {
                const sub = submissions[p.id];
                const hasSubmission = Boolean(sub);
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
                          {hasSubmission ? (
                            <>
                              <Badge bg="success" style={{ fontSize: "0.65rem" }}>{t("admin.submitted")}</Badge>
                              {sub.isLate && (
                                <Badge bg="warning" text="dark" style={{ fontSize: "0.6rem" }}>
                                  {t("formations.lateSubmission")}
                                </Badge>
                              )}
                            </>
                          ) : (
                            <Badge bg="outline-secondary" style={{ fontSize: "0.65rem", border: `1px solid ${borderColor}`, color: "var(--text-muted)" }}>
                              {t("admin.notSubmitted")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="d-flex gap-1 flex-shrink-0">
                        <Button
                          variant={hasSubmission ? "outline-primary" : "outline-success"}
                          size="sm"
                          className="py-0 px-2"
                          onClick={() => openEdit(p)}
                          style={{ fontSize: "0.75rem" }}
                        >
                          {hasSubmission ? t("common.edit") : "+ " + t("common.add")}
                        </Button>
                        {hasSubmission && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            className="py-0 px-2"
                            onClick={() => confirmDelete(p)}
                            style={{ fontSize: "0.75rem" }}
                          >
                            {t("common.delete")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          )}
        </>
      )}

      {/* Edit/Create Formation Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">
            {submissions[editingUser?.id] ? t("admin.editFormationTitle") : t("admin.addFormation")}
            {editingUser && <small className="text-muted ms-2">— {editingUser.name}</small>}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {message && (
            <Alert variant={message.type} dismissible onClose={() => setMessage(null)} className="py-2">
              {message.text}
            </Alert>
          )}

          <p className="small fw-bold mb-2" style={{ color: "var(--text-primary)" }}>{t("formations.mainRace")}</p>
          {renderDriverSelect("mainP1", "P1", true, mainFields)}
          {renderDriverSelect("mainP2", "P2", true, mainFields)}
          {renderDriverSelect("mainP3", "P3", true, mainFields)}
          {renderDriverSelect("mainJolly", t("formations.joker"), true, mainFields)}
          {renderDriverSelect("mainJolly2", t("formations.joker2"), false, mainFields)}

          <Form.Check
            type="switch"
            label={`${t("formations.lateSubmission")} (${t("formations.latePenalty")})`}
            checked={isLateSubmission}
            onChange={(e) => setIsLateSubmission(e.target.checked)}
            className="my-3"
          />

          {hasSprint && (
            <>
              <hr />
              <p className="small fw-bold mb-2" style={{ color: "var(--text-primary)" }}>
                {t("formations.sprintOptional")}
              </p>
              {renderDriverSelect("sprintP1", "SP1", false, sprintFields)}
              {renderDriverSelect("sprintP2", "SP2", false, sprintFields)}
              {renderDriverSelect("sprintP3", "SP3", false, sprintFields)}
              {renderDriverSelect("sprintJolly", `${t("formations.joker")} Sprint`, false, sprintFields)}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowEditModal(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" size="sm" onClick={requestSave} disabled={saving}>
            {saving ? <Spinner animation="border" size="sm" /> : t("common.save")}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Save Confirmation Modal */}
      <Modal show={showSaveConfirm} onHide={() => setShowSaveConfirm(false)} centered size="sm">
        <Modal.Body className="text-center py-4">
          <p className="fw-semibold mb-1">{t("admin.confirmSaveFormation") || "Conferma salvataggio"}</p>
          <p className="fw-bold mb-3">{editingUser?.name}</p>
          <div className="d-flex gap-2 justify-content-center">
            <Button variant="secondary" size="sm" onClick={() => setShowSaveConfirm(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" size="sm" onClick={handleSave}>
              {t("common.confirm") || t("common.save")}
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Body className="text-center py-4">
          <p className="fw-semibold mb-1">{t("admin.confirmDeleteFormation")}</p>
          <p className="fw-bold mb-3">{deletingUser?.name}</p>
          <div className="d-flex gap-2 justify-content-center">
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={saving}>
              {saving ? <Spinner animation="border" size="sm" /> : t("common.delete")}
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}

FormationsManager.propTypes = {
  participants: PropTypes.arrayOf(PropTypes.object).isRequired,
  races: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool.isRequired,
  onDataChange: PropTypes.func.isRequired,
};
