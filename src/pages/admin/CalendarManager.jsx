/**
 * @file CalendarManager.jsx
 * @description Race calendar management — ICS import, full race editing with
 * date-based round reordering and change preview. Sprint add/remove toggle.
 * Unified admin panel design, mobile-first.
 */

import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import {
  Button,
  Form,
  Alert,
  Spinner,
  Badge,
  Modal,
  ListGroup,
  Table,
} from "react-bootstrap";
import {
  doc,
  updateDoc,
  writeBatch,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../hooks/useLanguage";
import { useTimezone } from "../../hooks/useTimezone";
import { error } from "../../utils/logger";

const tsToLocal = (ts) => {
  if (!ts) return "";
  const d = new Date(ts.seconds * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function CalendarManager({ races, loading, onDataChange }) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const { timezone } = useTimezone();

  const fmtDate = (ts) => {
    if (!ts) return "—";
    return new Date(ts.seconds * 1000).toLocaleDateString("it-IT", { day: "2-digit", month: "short", timeZone: timezone });
  };

  const fmtFull = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts.seconds * 1000);
    return d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: timezone })
      + " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  };
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  // Edit Race
  const [editingRace, setEditingRace] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelType, setCancelType] = useState("");
  const [editFormData, setEditFormData] = useState({
    name: "", raceDateTimeUTC: "", qualiDateTimeUTC: "",
    sprintQualiDateTimeUTC: "", sprintDateTimeUTC: "",
  });
  const [showPreview, setShowPreview] = useState(false);
  const [showSprintFields, setShowSprintFields] = useState(false);

  // Add Race
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormData, setAddFormData] = useState({
    round: "", name: "", raceDateTimeUTC: "", qualiDateTimeUTC: "",
    sprintQualiDateTimeUTC: "", sprintDateTimeUTC: "",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addShowSprint, setAddShowSprint] = useState(false);

  // ICS Import
  const [parsedRaces, setParsedRaces] = useState([]);
  const [loadingIcs, setLoadingIcs] = useState(false);
  const [importing, setImporting] = useState(false);

  const borderColor = isDark ? "var(--border-color)" : "#dee2e6";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";

  // ─── Preview data ───
  const previewData = useMemo(() => {
    if (!showPreview || !editingRace || !editFormData.raceDateTimeUTC) return null;
    const newRaceDate = new Date(editFormData.raceDateTimeUTC);
    if (isNaN(newRaceDate.getTime())) return null;

    const updated = races.map((r) => ({
      ...r,
      name: r.id === editingRace.id ? (editFormData.name || r.name) : r.name,
      _newRaceMs: r.id === editingRace.id ? newRaceDate.getTime() : (r.raceUTC ? r.raceUTC.seconds * 1000 : 0),
    }));
    updated.sort((a, b) => a._newRaceMs - b._newRaceMs);
    return updated.map((r, i) => ({
      id: r.id,
      name: r.name,
      oldRound: r.round,
      newRound: i + 1,
      raceDate: r.id === editingRace.id ? fmtFull({ seconds: newRaceDate.getTime() / 1000 }) : fmtFull(r.raceUTC),
      isEdited: r.id === editingRace.id,
      changed: r.round !== i + 1 || r.id === editingRace.id,
    }));
  }, [showPreview, editingRace, editFormData.raceDateTimeUTC, editFormData.name, races]);

  // ─── ICS Import ───
  const handleIcsFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setMessage(null);
    setLoadingIcs(true);
    try {
      const text = await selectedFile.text();
      const { parseF1Calendar } = await import("../../utils/icsParser");
      const parsed = parseF1Calendar(text);
      setParsedRaces(parsed);
      setMessage({ type: "success", text: `${parsed.length} ${t("admin.racesFound")}` });
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
      setParsedRaces([]);
    } finally { setLoadingIcs(false); }
  };

  const handleIcsImport = async () => {
    if (!parsedRaces.length) return;
    if (!window.confirm(t("admin.confirmReset"))) return;
    setImporting(true); setMessage(null);
    try {
      const batch = writeBatch(db);
      for (const race of parsedRaces) {
        batch.set(doc(db, "races", race.id), {
          name: race.name, round: race.round,
          qualiUTC: Timestamp.fromDate(race.qualiUTC),
          raceUTC: Timestamp.fromDate(race.raceUTC),
          qualiSprintUTC: race.qualiSprintUTC ? Timestamp.fromDate(race.qualiSprintUTC) : null,
          sprintUTC: race.sprintUTC ? Timestamp.fromDate(race.sprintUTC) : null,
        }, { merge: true });
      }
      await batch.commit();
      setMessage({ type: "success", text: `${parsedRaces.length} ${t("admin.racesImported")}` });
      setParsedRaces([]);
      await onDataChange();
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally { setImporting(false); }
  };

  // ─── Add Race ───
  const openAddModal = () => {
    setAddFormData({ round: "", name: "", raceDateTimeUTC: "", qualiDateTimeUTC: "", sprintQualiDateTimeUTC: "", sprintDateTimeUTC: "" });
    setAddShowSprint(false);
    setMessage(null);
    setShowAddModal(true);
  };

  const handleAddRace = async (e) => {
    e.preventDefault();
    if (!addFormData.round || !addFormData.name || !addFormData.raceDateTimeUTC || !addFormData.qualiDateTimeUTC) {
      setMessage({ type: "warning", text: t("errors.incompleteForm") });
      return;
    }
    setAddSaving(true); setMessage(null);
    try {
      const newRound = parseInt(addFormData.round);
      const racesToShift = races.filter((r) => r.round >= newRound);
      if (racesToShift.length > 0) {
        const sorted = [...racesToShift].sort((a, b) => b.round - a.round);
        const batch = writeBatch(db);
        for (const r of sorted) batch.update(doc(db, "races", r.id), { round: r.round + 1 });
        await batch.commit();
      }
      const nameSlug = addFormData.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const raceId = `r${String(newRound).padStart(2, "0")}-${nameSlug}`;
      const sprintQualiDate = addFormData.sprintQualiDateTimeUTC ? new Date(addFormData.sprintQualiDateTimeUTC) : null;
      const sprintDate = addFormData.sprintDateTimeUTC ? new Date(addFormData.sprintDateTimeUTC) : null;
      await setDoc(doc(db, "races", raceId), {
        name: addFormData.name, round: newRound,
        raceUTC: Timestamp.fromDate(new Date(addFormData.raceDateTimeUTC)),
        qualiUTC: Timestamp.fromDate(new Date(addFormData.qualiDateTimeUTC)),
        ...(sprintQualiDate ? { qualiSprintUTC: Timestamp.fromDate(sprintQualiDate) } : {}),
        ...(sprintDate ? { sprintUTC: Timestamp.fromDate(sprintDate) } : {}),
      });
      setMessage({ type: "success", text: t("admin.raceAdded") });
      await onDataChange();
      setTimeout(() => setShowAddModal(false), 1200);
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally { setAddSaving(false); }
  };

  // ─── Edit Race ───
  const handleEditRace = (race) => {
    setEditingRace(race);
    const hasSprint = Boolean(race.qualiSprintUTC);
    setShowSprintFields(hasSprint);
    setEditFormData({
      name: race.name,
      raceDateTimeUTC: tsToLocal(race.raceUTC),
      qualiDateTimeUTC: tsToLocal(race.qualiUTC),
      sprintQualiDateTimeUTC: tsToLocal(race.qualiSprintUTC),
      sprintDateTimeUTC: tsToLocal(race.sprintUTC),
    });
    setShowPreview(false);
    setMessage(null);
    setShowEditModal(true);
  };

  const handleCancelRace = (type) => { setCancelType(type); setShowCancelModal(true); };

  const confirmCancelRace = async () => {
    if (!editingRace || !cancelType) return;
    setUploading(true); setMessage(null);
    try {
      const updates = cancelType === "main" ? { cancelledMain: true } : { cancelledSprint: true };
      await updateDoc(doc(db, "races", editingRace.id), updates);
      setMessage({ type: "success", text: t("admin.raceUpdated") });
      setShowCancelModal(false); setCancelType("");
      await onDataChange();
      setEditingRace((prev) => ({ ...prev, ...updates }));
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally { setUploading(false); }
  };

  const handleRestoreRace = async (type) => {
    if (!editingRace || !window.confirm(t("admin.cancelConfirmQuestion"))) return;
    setUploading(true); setMessage(null);
    try {
      const updates = type === "main" ? { cancelledMain: false } : { cancelledSprint: false };
      await updateDoc(doc(db, "races", editingRace.id), updates);
      setMessage({ type: "success", text: t("admin.raceUpdated") });
      await onDataChange();
      setEditingRace((prev) => ({ ...prev, ...updates }));
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally { setUploading(false); }
  };

  const handleShowPreview = () => {
    if (!editFormData.name || !editFormData.raceDateTimeUTC || !editFormData.qualiDateTimeUTC) {
      setMessage({ type: "warning", text: t("errors.incompleteForm") });
      return;
    }
    setMessage(null); setShowPreview(true);
  };

  const handleConfirmSave = async () => {
    if (!editingRace) return;
    setUploading(true); setMessage(null);
    try {
      const newRaceDate = new Date(editFormData.raceDateTimeUTC);
      const newQualiDate = new Date(editFormData.qualiDateTimeUTC);
      const newSprintQualiDate = editFormData.sprintQualiDateTimeUTC ? new Date(editFormData.sprintQualiDateTimeUTC) : null;
      const newSprintDate = editFormData.sprintDateTimeUTC ? new Date(editFormData.sprintDateTimeUTC) : null;

      const allRaces = races.map((r) => ({
        ...r, _sortMs: r.id === editingRace.id ? newRaceDate.getTime() : (r.raceUTC ? r.raceUTC.seconds * 1000 : 0),
      }));
      allRaces.sort((a, b) => a._sortMs - b._sortMs);
      const newRounds = {};
      allRaces.forEach((r, i) => { newRounds[r.id] = i + 1; });

      const batch = writeBatch(db);
      const raceUpdates = {
        name: editFormData.name,
        raceUTC: Timestamp.fromDate(newRaceDate),
        qualiUTC: Timestamp.fromDate(newQualiDate),
        round: newRounds[editingRace.id],
      };
      if (showSprintFields && newSprintQualiDate) raceUpdates.qualiSprintUTC = Timestamp.fromDate(newSprintQualiDate);
      else if (!showSprintFields || !newSprintQualiDate) raceUpdates.qualiSprintUTC = null;
      if (showSprintFields && newSprintDate) raceUpdates.sprintUTC = Timestamp.fromDate(newSprintDate);
      else if (!showSprintFields || !newSprintDate) raceUpdates.sprintUTC = null;

      batch.update(doc(db, "races", editingRace.id), raceUpdates);
      for (const r of races) {
        if (r.id !== editingRace.id && r.round !== newRounds[r.id]) {
          batch.update(doc(db, "races", r.id), { round: newRounds[r.id] });
        }
      }
      await batch.commit();
      setMessage({ type: "success", text: t("admin.raceUpdated") });
      setShowPreview(false); setShowEditModal(false); setEditingRace(null);
      await onDataChange();
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally { setUploading(false); }
  };

  // ─── Delete Race ───
  const handleDeleteRace = async () => {
    if (!editingRace || !window.confirm(t("admin.deleteRaceConfirm"))) return;
    setUploading(true); setMessage(null);
    try {
      const subsSnap = await getDocs(collection(db, "races", editingRace.id, "submissions"));
      if (!subsSnap.empty) {
        const batch = writeBatch(db);
        subsSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, "races", editingRace.id));
      const remaining = races.filter((r) => r.id !== editingRace.id).sort((a, b) =>
        (a.raceUTC ? a.raceUTC.seconds : 0) - (b.raceUTC ? b.raceUTC.seconds : 0)
      );
      if (remaining.length > 0) {
        const batch = writeBatch(db);
        remaining.forEach((r, i) => { if (r.round !== i + 1) batch.update(doc(db, "races", r.id), { round: i + 1 }); });
        await batch.commit();
      }
      setMessage({ type: "success", text: t("admin.raceDeleted") });
      setShowEditModal(false); setEditingRace(null);
      await onDataChange();
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally { setUploading(false); }
  };

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" /></div>;
  }

  return (
    <>
      {/* ── ICS Import ── */}
      <div className="mb-4">
        <h6 className="mb-2 fw-bold" style={{ color: "var(--text-primary)" }}>
          {t("admin.importICS")}
        </h6>
        <div className="rounded p-3" style={{ backgroundColor: bgCard, border: `1px solid ${borderColor}` }}>
          {message && !showEditModal && !showAddModal && (
            <Alert variant={message.type} dismissible onClose={() => setMessage(null)} className="py-2 mb-2">
              {message.text}
            </Alert>
          )}
          <Form.Control
            type="file" accept=".ics" size="sm"
            onChange={handleIcsFileSelect}
            disabled={loadingIcs || importing}
          />
          {loadingIcs && (
            <div className="text-center py-2"><Spinner animation="border" size="sm" className="me-2" />{t("common.loading")}</div>
          )}
          {parsedRaces.length > 0 && !loadingIcs && (
            <Button variant="danger" className="w-100 mt-2" size="sm" onClick={handleIcsImport} disabled={importing}>
              {importing ? <><Spinner animation="border" size="sm" className="me-2" />{t("common.loading")}</> : `${t("admin.importICS")} (${parsedRaces.length})`}
            </Button>
          )}
        </div>
      </div>

      {/* ── Race List ── */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0 fw-bold" style={{ color: "var(--text-primary)" }}>
          {t("admin.raceCalendar")}
          <Badge bg="secondary" className="ms-2" style={{ fontSize: "0.7rem", verticalAlign: "middle" }}>{races.length}</Badge>
        </h6>
        <Button size="sm" variant="danger" onClick={openAddModal}>+ {t("admin.addRace")}</Button>
      </div>

      {races.length === 0 ? (
        <Alert variant="info">{t("leaderboard.noData")}</Alert>
      ) : (
        <ListGroup variant="flush" style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${borderColor}` }}>
          {races.map((r) => {
            const hasSprint = Boolean(r.qualiSprintUTC);
            const hasResults = Boolean(r.officialResults);
            return (
              <ListGroup.Item key={r.id} className="px-3 py-2" action onClick={() => handleEditRace(r)}
                style={{ backgroundColor: bgCard, color: "var(--text-primary)", borderColor }}>
                <div className="d-flex justify-content-between align-items-center">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="d-flex align-items-center gap-1">
                      <span className="text-muted small fw-bold" style={{ minWidth: 28 }}>R{r.round}</span>
                      <span className="fw-semibold text-truncate">{r.name}</span>
                    </div>
                    <div className="d-flex align-items-center gap-2 mt-1">
                      <small className="text-muted">{fmtDate(r.raceUTC)}</small>
                      {hasSprint && !r.cancelledSprint && <Badge bg="warning" text="dark" style={{ fontSize: "0.6rem" }}>Sprint</Badge>}
                      {r.cancelledMain && <Badge bg="danger" style={{ fontSize: "0.6rem" }}>{t("admin.raceCancelled")}</Badge>}
                      {r.cancelledSprint && hasSprint && <Badge bg="secondary" style={{ fontSize: "0.6rem" }}>{t("admin.sprintCancelled")}</Badge>}
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-1 flex-shrink-0">
                    {hasResults ? <Badge bg="success" style={{ fontSize: "0.6rem" }}>{t("admin.hasResults")}</Badge>
                      : <Badge bg="secondary" style={{ fontSize: "0.6rem" }}>{t("admin.pending")}</Badge>}
                    <span className="text-muted" style={{ fontSize: "0.8rem" }}>›</span>
                  </div>
                </div>
              </ListGroup.Item>
            );
          })}
        </ListGroup>
      )}

      {/* ── Add Race Modal ── */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered>
        <Modal.Header closeButton><Modal.Title className="fs-6">{t("admin.addRace")}</Modal.Title></Modal.Header>
        <Form onSubmit={handleAddRace}>
          <Modal.Body>
            {message && <Alert variant={message.type} dismissible onClose={() => setMessage(null)} className="py-2">{message.text}</Alert>}
            <div className="d-flex gap-2 mb-3">
              <Form.Group style={{ width: 80 }}>
                <Form.Label className="small fw-semibold">{t("admin.raceRound")} *</Form.Label>
                <Form.Control type="number" size="sm" min="1" max="30" value={addFormData.round}
                  onChange={(e) => setAddFormData({ ...addFormData, round: e.target.value })} required />
              </Form.Group>
              <Form.Group className="flex-fill">
                <Form.Label className="small fw-semibold">{t("admin.raceName")} *</Form.Label>
                <Form.Control type="text" size="sm" placeholder="e.g. Bahrain Grand Prix" value={addFormData.name}
                  onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })} required />
              </Form.Group>
            </div>
            {addFormData.round && races.filter((r) => r.round >= parseInt(addFormData.round)).length > 0 && (
              <Alert variant="warning" className="py-1 small mb-2">
                {races.filter((r) => r.round >= parseInt(addFormData.round)).length} {t("admin.racesWillShift")}
              </Alert>
            )}
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">{t("admin.raceDateTimeUTC")} *</Form.Label>
              <Form.Control type="datetime-local" size="sm" value={addFormData.raceDateTimeUTC}
                onChange={(e) => setAddFormData({ ...addFormData, raceDateTimeUTC: e.target.value })} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">{t("admin.qualiDateTimeUTC")} *</Form.Label>
              <Form.Control type="datetime-local" size="sm" value={addFormData.qualiDateTimeUTC}
                onChange={(e) => setAddFormData({ ...addFormData, qualiDateTimeUTC: e.target.value })} required />
            </Form.Group>

            {!addShowSprint ? (
              <Button variant="outline-secondary" size="sm" className="w-100" onClick={() => setAddShowSprint(true)}>
                + {t("admin.addSprint")}
              </Button>
            ) : (
              <>
                <hr />
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small className="fw-semibold text-muted">Sprint</small>
                  <Button variant="link" size="sm" className="text-danger p-0" onClick={() => {
                    setAddShowSprint(false);
                    setAddFormData({ ...addFormData, sprintQualiDateTimeUTC: "", sprintDateTimeUTC: "" });
                  }}>{t("admin.removeSprint")}</Button>
                </div>
                <Form.Group className="mb-2">
                  <Form.Label className="small fw-semibold">{t("admin.sprintQualiDateTimeUTC")}</Form.Label>
                  <Form.Control type="datetime-local" size="sm" value={addFormData.sprintQualiDateTimeUTC}
                    onChange={(e) => setAddFormData({ ...addFormData, sprintQualiDateTimeUTC: e.target.value })} />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label className="small fw-semibold">{t("admin.sprintDateTimeUTC")}</Form.Label>
                  <Form.Control type="datetime-local" size="sm" value={addFormData.sprintDateTimeUTC}
                    onChange={(e) => setAddFormData({ ...addFormData, sprintDateTimeUTC: e.target.value })} />
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setShowAddModal(false)} disabled={addSaving}>{t("common.cancel")}</Button>
            <Button variant="danger" size="sm" type="submit" disabled={addSaving}>
              {addSaving ? <Spinner animation="border" size="sm" /> : t("admin.addRace")}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ── Edit Race Modal ── */}
      <Modal show={showEditModal} onHide={() => { setShowEditModal(false); setShowPreview(false); }} centered size={showPreview ? "lg" : undefined}>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">{t("admin.editRace")} — R{editingRace?.round}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {message && <Alert variant={message.type} dismissible onClose={() => setMessage(null)} className="py-2">{message.text}</Alert>}

          {!showPreview ? (
            <Form>
              {Boolean(editingRace?.officialResults) && (
                <Alert variant="info" className="py-2 small mb-3">
                  {t("admin.hasResults")} — {t("admin.datesLockedHint")}
                </Alert>
              )}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">{t("admin.raceName")} *</Form.Label>
                <Form.Control type="text" size="sm" value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} required />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">{t("admin.raceDateTimeUTC")} *</Form.Label>
                <Form.Control type="datetime-local" size="sm" value={editFormData.raceDateTimeUTC}
                  onChange={(e) => setEditFormData({ ...editFormData, raceDateTimeUTC: e.target.value })}
                  required disabled={Boolean(editingRace?.officialResults)} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">{t("admin.qualiDateTimeUTC")} *</Form.Label>
                <Form.Control type="datetime-local" size="sm" value={editFormData.qualiDateTimeUTC}
                  onChange={(e) => setEditFormData({ ...editFormData, qualiDateTimeUTC: e.target.value })}
                  required disabled={Boolean(editingRace?.officialResults)} />
                <Form.Text className="text-muted" style={{ fontSize: "0.72rem" }}>{t("admin.qualiDeadlineHint")}</Form.Text>
              </Form.Group>

              {/* Sprint toggle */}
              {!showSprintFields ? (
                <Button variant="outline-secondary" size="sm" className="w-100 mb-3" onClick={() => setShowSprintFields(true)}>
                  + {t("admin.addSprint")}
                </Button>
              ) : (
                <>
                  <hr />
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <small className="fw-semibold text-muted">Sprint</small>
                    <Button variant="link" size="sm" className="text-danger p-0" onClick={() => {
                      setShowSprintFields(false);
                      setEditFormData({ ...editFormData, sprintQualiDateTimeUTC: "", sprintDateTimeUTC: "" });
                    }}>{t("admin.removeSprint")}</Button>
                  </div>
                  <Form.Group className="mb-2">
                    <Form.Label className="small fw-semibold">{t("admin.sprintQualiDateTimeUTC")}</Form.Label>
                    <Form.Control type="datetime-local" size="sm" value={editFormData.sprintQualiDateTimeUTC}
                      onChange={(e) => setEditFormData({ ...editFormData, sprintQualiDateTimeUTC: e.target.value })}
                      disabled={Boolean(editingRace?.officialResults)} />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="small fw-semibold">{t("admin.sprintDateTimeUTC")}</Form.Label>
                    <Form.Control type="datetime-local" size="sm" value={editFormData.sprintDateTimeUTC}
                      onChange={(e) => setEditFormData({ ...editFormData, sprintDateTimeUTC: e.target.value })}
                      disabled={Boolean(editingRace?.officialResults)} />
                  </Form.Group>
                </>
              )}

              {/* Status badges */}
              {(editingRace?.cancelledMain || editingRace?.cancelledSprint) && (
                <div className="d-flex flex-wrap gap-2 mt-2">
                  {editingRace?.cancelledMain && <Badge bg="danger">{t("admin.raceCancelled")}</Badge>}
                  {editingRace?.cancelledSprint && <Badge bg="warning" text="dark">{t("admin.sprintCancelled")}</Badge>}
                </div>
              )}
            </Form>
          ) : (
            /* ── Preview ── */
            <div>
              <h6 className="fw-bold mb-3">{t("admin.previewChanges")}</h6>
              {editingRace && (
                <div className="rounded p-2 mb-3 small" style={{ backgroundColor: isDark ? "var(--bg-tertiary)" : "#f0f4f8", border: `1px solid ${borderColor}` }}>
                  <strong>{editingRace.name}</strong> → <strong>{editFormData.name}</strong>
                  {editFormData.name !== editingRace.name && <Badge bg="info" className="ms-1" style={{ fontSize: "0.6rem" }}>{t("admin.nameChanged")}</Badge>}
                  <br />
                  <span className="text-muted">{t("admin.raceDateTimeUTC")}:</span> {fmtFull(editingRace.raceUTC)} → {new Date(editFormData.raceDateTimeUTC).toLocaleString("it-IT", { timeZone: timezone })}
                  <br />
                  <span className="text-muted">{t("admin.qualiDateTimeUTC")}:</span> {fmtFull(editingRace.qualiUTC)} → {new Date(editFormData.qualiDateTimeUTC).toLocaleString("it-IT", { timeZone: timezone })}
                </div>
              )}
              {previewData && previewData.some((r) => r.changed) && (
                <>
                  <p className="small text-muted mb-2">{t("admin.roundReorderPreview")}</p>
                  <div style={{ maxHeight: 300, overflowY: "auto" }}>
                    <Table size="sm" bordered style={{ fontSize: "0.78rem" }}>
                      <thead><tr><th>{t("admin.raceRound")}</th><th>{t("admin.raceName")}</th><th>{t("common.date")}</th><th></th></tr></thead>
                      <tbody>
                        {previewData.map((r) => (
                          <tr key={r.id} style={{
                            backgroundColor: r.isEdited ? (isDark ? "rgba(25,135,84,0.12)" : "rgba(25,135,84,0.06)") : undefined,
                            fontWeight: r.isEdited ? 600 : undefined,
                          }}>
                            <td>
                              {r.oldRound !== r.newRound ? (
                                <><s className="text-muted">R{r.oldRound}</s> → <strong className="text-primary">R{r.newRound}</strong></>
                              ) : `R${r.newRound}`}
                            </td>
                            <td>{r.name}</td>
                            <td className="text-muted">{r.raceDate}</td>
                            <td>
                              {r.isEdited && <Badge bg="success" style={{ fontSize: "0.55rem" }}>{t("admin.edited")}</Badge>}
                              {!r.isEdited && r.oldRound !== r.newRound && <Badge bg="warning" text="dark" style={{ fontSize: "0.55rem" }}>{t("admin.shifted")}</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </>
              )}
              {previewData && !previewData.some((r) => r.changed && !r.isEdited) && (
                <p className="small text-success mb-0">{t("admin.noRoundChanges")}</p>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="flex-wrap gap-1">
          {!showPreview ? (
            <>
              <div className="d-flex gap-1 me-auto">
                <Button variant="outline-danger" size="sm" onClick={handleDeleteRace} disabled={uploading}>
                  {t("common.delete")}
                </Button>
                {!editingRace?.cancelledMain ? (
                  <Button variant="outline-secondary" size="sm" onClick={() => handleCancelRace("main")} disabled={uploading}>
                    {t("admin.cancelMainRace")}
                  </Button>
                ) : (
                  <Button variant="outline-success" size="sm" onClick={() => handleRestoreRace("main")} disabled={uploading}>
                    {t("admin.restoreRace")}
                  </Button>
                )}
                {(editingRace?.qualiSprintUTC || showSprintFields) && (
                  !editingRace?.cancelledSprint ? (
                    <Button variant="outline-secondary" size="sm" onClick={() => handleCancelRace("sprint")} disabled={uploading}>
                      {t("admin.cancelSprint")}
                    </Button>
                  ) : (
                    <Button variant="outline-success" size="sm" onClick={() => handleRestoreRace("sprint")} disabled={uploading}>
                      {t("admin.restoreSprint")}
                    </Button>
                  )
                )}
              </div>
              <Button variant="danger" size="sm" onClick={handleShowPreview} disabled={uploading || editingRace?.cancelledMain}>
                {t("admin.preview")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowPreview(false)}>{t("common.back")}</Button>
              <Button variant="success" size="sm" onClick={handleConfirmSave} disabled={uploading}>
                {uploading ? <Spinner animation="border" size="sm" /> : t("common.confirm")}
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>

      {/* ── Cancel Confirmation Modal ── */}
      <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)} centered size="sm">
        <Modal.Body className="py-4">
          <p className="fw-semibold mb-2">
            {cancelType === "main" ? t("admin.cancelMainRace") : t("admin.cancelSprint")}
          </p>
          <p className="small text-muted mb-3">
            {cancelType === "main" ? t("admin.cancelRaceWarning") : t("admin.cancelSprintWarning")}
          </p>
          <div className="d-flex gap-2 justify-content-end">
            <Button variant="secondary" size="sm" onClick={() => setShowCancelModal(false)}>{t("common.cancel")}</Button>
            <Button variant={cancelType === "main" ? "danger" : "warning"} size="sm" onClick={confirmCancelRace} disabled={uploading}>
              {uploading ? <Spinner animation="border" size="sm" /> : t("common.confirm")}
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}

CalendarManager.propTypes = {
  races: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool.isRequired,
  onDataChange: PropTypes.func.isRequired,
};
