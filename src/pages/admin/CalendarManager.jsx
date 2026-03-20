/**
 * @file CalendarManager.jsx
 * @description Calendar management component with ICS import, full race editing,
 *              date-based round reordering, and change preview for admin panel
 */

import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import {
  Row,
  Col,
  Card,
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
import { error } from "../../utils/logger";

/** Convert a Firestore Timestamp to "YYYY-MM-DDTHH:mm" for datetime-local inputs */
const tsToLocal = (ts) => {
  if (!ts) return "";
  const d = new Date(ts.seconds * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Short human-readable date */
const fmtDate = (ts) => {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
};

/** Full date+time string */
const fmtFull = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
};

export default function CalendarManager({ races, loading, onDataChange }) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  // Edit Race state
  const [editingRace, setEditingRace] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelType, setCancelType] = useState("");
  const [editFormData, setEditFormData] = useState({
    name: "",
    raceDateTimeUTC: "",
    qualiDateTimeUTC: "",
    sprintQualiDateTimeUTC: "",
    sprintDateTimeUTC: "",
  });
  const [showPreview, setShowPreview] = useState(false);

  // Add Race state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormData, setAddFormData] = useState({
    round: "",
    name: "",
    raceDateTimeUTC: "",
    qualiDateTimeUTC: "",
    sprintQualiDateTimeUTC: "",
    sprintDateTimeUTC: "",
  });
  const [addSaving, setAddSaving] = useState(false);

  // ICS Import state
  const [icsFile, setIcsFile] = useState(null);
  const [parsedRaces, setParsedRaces] = useState([]);
  const [loadingIcs, setLoadingIcs] = useState(false);
  const [importing, setImporting] = useState(false);

  // Dark mode colors
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";
  const bgHeader = isDark ? "var(--bg-tertiary)" : "#ffffff";
  const borderColor = isDark ? "var(--border-color)" : "#dee2e6";
  const textColor = isDark ? "var(--text-primary)" : undefined;

  const inputStyle = { backgroundColor: isDark ? "var(--bg-tertiary)" : undefined, color: textColor, borderColor };

  // ─── Preview: compute what the calendar would look like after the edit ───
  const previewData = useMemo(() => {
    if (!showPreview || !editingRace || !editFormData.raceDateTimeUTC) return null;

    const newRaceDate = new Date(editFormData.raceDateTimeUTC);
    if (isNaN(newRaceDate.getTime())) return null;

    // Build a list of all races with the edited one updated
    const updated = races.map((r) => {
      if (r.id === editingRace.id) {
        return {
          ...r,
          name: editFormData.name || r.name,
          _newRaceMs: newRaceDate.getTime(),
        };
      }
      return { ...r, _newRaceMs: r.raceUTC ? r.raceUTC.seconds * 1000 : 0 };
    });

    // Sort by new race date → derive new round numbers
    updated.sort((a, b) => a._newRaceMs - b._newRaceMs);
    const result = updated.map((r, i) => ({
      id: r.id,
      name: r.id === editingRace.id ? (editFormData.name || r.name) : r.name,
      oldRound: r.round,
      newRound: i + 1,
      raceDate: r.id === editingRace.id ? fmtFull({ seconds: newRaceDate.getTime() / 1000 }) : fmtFull(r.raceUTC),
      isEdited: r.id === editingRace.id,
      changed: r.round !== i + 1 || r.id === editingRace.id,
    }));

    return result;
  }, [showPreview, editingRace, editFormData.raceDateTimeUTC, editFormData.name, races]);

  // ─── ICS Import ───
  const handleIcsFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setIcsFile(selectedFile);
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
    } finally {
      setLoadingIcs(false);
    }
  };

  const handleIcsImport = async () => {
    if (!parsedRaces.length) {
      setMessage({ type: "warning", text: t("leaderboard.noData") });
      return;
    }
    if (!window.confirm(t("admin.confirmReset"))) return;

    setImporting(true);
    setMessage(null);

    try {
      const batch = writeBatch(db);
      for (const race of parsedRaces) {
        batch.set(
          doc(db, "races", race.id),
          {
            name: race.name,
            round: race.round,
            qualiUTC: Timestamp.fromDate(race.qualiUTC),
            raceUTC: Timestamp.fromDate(race.raceUTC),
            qualiSprintUTC: race.qualiSprintUTC ? Timestamp.fromDate(race.qualiSprintUTC) : null,
            sprintUTC: race.sprintUTC ? Timestamp.fromDate(race.sprintUTC) : null,
          },
          { merge: true }
        );
      }
      await batch.commit();
      setMessage({ type: "success", text: `${parsedRaces.length} ${t("admin.racesImported")}` });
      setParsedRaces([]);
      setIcsFile(null);
      await onDataChange();
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setImporting(false);
    }
  };

  // ─── Add Race ───
  const openAddModal = () => {
    setAddFormData({ round: "", name: "", raceDateTimeUTC: "", qualiDateTimeUTC: "", sprintQualiDateTimeUTC: "", sprintDateTimeUTC: "" });
    setMessage(null);
    setShowAddModal(true);
  };

  const handleAddRace = async (e) => {
    e.preventDefault();
    if (!addFormData.round || !addFormData.name || !addFormData.raceDateTimeUTC || !addFormData.qualiDateTimeUTC) {
      setMessage({ type: "warning", text: t("errors.incompleteForm") });
      return;
    }

    setAddSaving(true);
    setMessage(null);

    try {
      const newRound = parseInt(addFormData.round);
      const raceDate = new Date(addFormData.raceDateTimeUTC);
      const qualiDate = new Date(addFormData.qualiDateTimeUTC);
      const sprintQualiDate = addFormData.sprintQualiDateTimeUTC ? new Date(addFormData.sprintQualiDateTimeUTC) : null;
      const sprintDate = addFormData.sprintDateTimeUTC ? new Date(addFormData.sprintDateTimeUTC) : null;

      // Shift rounds >= newRound
      const racesToShift = races.filter((r) => r.round >= newRound);
      if (racesToShift.length > 0) {
        const sorted = [...racesToShift].sort((a, b) => b.round - a.round);
        const batch = writeBatch(db);
        for (const r of sorted) {
          batch.update(doc(db, "races", r.id), { round: r.round + 1 });
        }
        await batch.commit();
      }

      const nameSlug = addFormData.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const raceId = `r${String(newRound).padStart(2, "0")}-${nameSlug}`;

      await setDoc(doc(db, "races", raceId), {
        name: addFormData.name,
        round: newRound,
        raceUTC: Timestamp.fromDate(raceDate),
        qualiUTC: Timestamp.fromDate(qualiDate),
        ...(sprintQualiDate ? { qualiSprintUTC: Timestamp.fromDate(sprintQualiDate) } : {}),
        ...(sprintDate ? { sprintUTC: Timestamp.fromDate(sprintDate) } : {}),
      });

      setMessage({ type: "success", text: t("admin.raceAdded") });
      await onDataChange();
      setTimeout(() => setShowAddModal(false), 1200);
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setAddSaving(false);
    }
  };

  // ─── Edit Race ───
  const handleEditRace = (race) => {
    setEditingRace(race);
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

  const handleCancelRace = (type) => {
    setCancelType(type);
    setShowCancelModal(true);
  };

  const confirmCancelRace = async () => {
    if (!editingRace || !cancelType) return;
    setUploading(true);
    setMessage(null);

    try {
      const updates = {};
      if (cancelType === "main") updates.cancelledMain = true;
      else if (cancelType === "sprint") updates.cancelledSprint = true;

      await updateDoc(doc(db, "races", editingRace.id), updates);
      setMessage({ type: "success", text: t("admin.raceUpdated") });
      setShowCancelModal(false);
      setCancelType("");
      await onDataChange();
      setEditingRace((prev) => ({
        ...prev,
        ...(cancelType === "main" ? { cancelledMain: true } : { cancelledSprint: true }),
      }));
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setUploading(false);
    }
  };

  const handleRestoreRace = async (type) => {
    if (!editingRace) return;
    if (!window.confirm(t("admin.cancelConfirmQuestion"))) return;

    setUploading(true);
    setMessage(null);

    try {
      const updates = {};
      if (type === "main") updates.cancelledMain = false;
      else if (type === "sprint") updates.cancelledSprint = false;

      await updateDoc(doc(db, "races", editingRace.id), updates);
      setMessage({ type: "success", text: t("admin.raceUpdated") });
      await onDataChange();
      setEditingRace((prev) => ({
        ...prev,
        ...(type === "main" ? { cancelledMain: false } : { cancelledSprint: false }),
      }));
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setUploading(false);
    }
  };

  /** Show preview before saving */
  const handleShowPreview = () => {
    if (!editFormData.name || !editFormData.raceDateTimeUTC || !editFormData.qualiDateTimeUTC) {
      setMessage({ type: "warning", text: t("errors.incompleteForm") });
      return;
    }
    setMessage(null);
    setShowPreview(true);
  };

  /** Confirm and save all edits: name, dates, and recalculated rounds */
  const handleConfirmSave = async () => {
    if (!editingRace) return;

    setUploading(true);
    setMessage(null);

    try {
      const newRaceDate = new Date(editFormData.raceDateTimeUTC);
      const newQualiDate = new Date(editFormData.qualiDateTimeUTC);
      const newSprintQualiDate = editFormData.sprintQualiDateTimeUTC ? new Date(editFormData.sprintQualiDateTimeUTC) : null;
      const newSprintDate = editFormData.sprintDateTimeUTC ? new Date(editFormData.sprintDateTimeUTC) : null;

      // Build the full list with updated timestamps for the edited race
      const allRaces = races.map((r) => {
        if (r.id === editingRace.id) {
          return { ...r, _sortMs: newRaceDate.getTime() };
        }
        return { ...r, _sortMs: r.raceUTC ? r.raceUTC.seconds * 1000 : 0 };
      });

      // Sort by date → derive new round order
      allRaces.sort((a, b) => a._sortMs - b._sortMs);
      const newRounds = {};
      allRaces.forEach((r, i) => {
        newRounds[r.id] = i + 1;
      });

      // Batch update: edited race fields + all round changes
      const batch = writeBatch(db);

      // Update the edited race itself
      const raceRef = doc(db, "races", editingRace.id);
      const raceUpdates = {
        name: editFormData.name,
        raceUTC: Timestamp.fromDate(newRaceDate),
        qualiUTC: Timestamp.fromDate(newQualiDate),
        round: newRounds[editingRace.id],
      };
      if (newSprintQualiDate) {
        raceUpdates.qualiSprintUTC = Timestamp.fromDate(newSprintQualiDate);
      }
      if (newSprintDate) {
        raceUpdates.sprintUTC = Timestamp.fromDate(newSprintDate);
      }
      // Clear sprint fields if they were removed
      if (!newSprintQualiDate && editingRace.qualiSprintUTC) {
        raceUpdates.qualiSprintUTC = null;
      }
      if (!newSprintDate && editingRace.sprintUTC) {
        raceUpdates.sprintUTC = null;
      }
      batch.update(raceRef, raceUpdates);

      // Update rounds for any other races whose round changed
      for (const r of races) {
        if (r.id !== editingRace.id && r.round !== newRounds[r.id]) {
          batch.update(doc(db, "races", r.id), { round: newRounds[r.id] });
        }
      }

      await batch.commit();

      setMessage({ type: "success", text: t("admin.raceUpdated") });
      setShowPreview(false);
      setShowEditModal(false);
      setEditingRace(null);
      await onDataChange();
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setUploading(false);
    }
  };

  // ─── Delete Race ───
  const handleDeleteRace = async () => {
    if (!editingRace) return;
    if (!window.confirm(t("admin.deleteRaceConfirm"))) return;

    setUploading(true);
    setMessage(null);

    try {
      // Delete submissions subcollection first
      const subsSnap = await getDocs(collection(db, "races", editingRace.id, "submissions"));
      if (!subsSnap.empty) {
        const batch = writeBatch(db);
        subsSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      // Delete the race document
      await deleteDoc(doc(db, "races", editingRace.id));

      // Recalculate rounds for remaining races
      const remaining = races.filter((r) => r.id !== editingRace.id).sort((a, b) => {
        const aMs = a.raceUTC ? a.raceUTC.seconds * 1000 : 0;
        const bMs = b.raceUTC ? b.raceUTC.seconds * 1000 : 0;
        return aMs - bMs;
      });

      if (remaining.length > 0) {
        const batch = writeBatch(db);
        remaining.forEach((r, i) => {
          if (r.round !== i + 1) {
            batch.update(doc(db, "races", r.id), { round: i + 1 });
          }
        });
        await batch.commit();
      }

      setMessage({ type: "success", text: t("admin.raceDeleted") });
      setShowEditModal(false);
      setEditingRace(null);
      await onDataChange();
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <Row className="g-3">
      {/* ICS Import Section */}
      <Col xs={12}>
        <Card className="shadow-sm border-primary" style={{ backgroundColor: bgCard }}>
          <Card.Header className="bg-primary text-white py-2">
            <h6 className="mb-0">📅 {t("admin.importICS")}</h6>
          </Card.Header>
          <Card.Body className="py-3">
            {message && !showEditModal && (
              <Alert variant={message.type} dismissible onClose={() => setMessage(null)} className="py-2">
                {message.text}
              </Alert>
            )}

            <Form.Group className="mb-2">
              <Form.Control
                type="file"
                accept=".ics"
                size="sm"
                onChange={handleIcsFileSelect}
                disabled={loadingIcs || importing}
                style={inputStyle}
              />
            </Form.Group>

            {loadingIcs && (
              <div className="text-center py-2">
                <Spinner animation="border" size="sm" className="me-2" />
                {t("common.loading")}
              </div>
            )}

            {parsedRaces.length > 0 && !loadingIcs && (
              <Button variant="primary" className="w-100 mt-2" onClick={handleIcsImport} disabled={importing}>
                {importing ? (
                  <><Spinner animation="border" size="sm" className="me-2" />{t("common.loading")}</>
                ) : (
                  `📥 ${t("admin.importICS")} (${parsedRaces.length})`
                )}
              </Button>
            )}
          </Card.Body>
        </Card>
      </Col>

      {/* Race List */}
      <Col xs={12}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0" style={{ color: textColor }}>{t("admin.raceCalendar")} ({races.length})</h6>
          <Button size="sm" variant="danger" onClick={openAddModal}>
            ➕ {t("admin.addRace")}
          </Button>
        </div>

        {races.length === 0 ? (
          <Alert variant="info">{t("leaderboard.noData")}</Alert>
        ) : (
          <ListGroup variant="flush" style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${borderColor}` }}>
            {races.map((r) => {
              const isCancelledMain = r.cancelledMain;
              const isCancelledSprint = r.cancelledSprint;
              const hasSprint = Boolean(r.qualiSprintUTC);
              const hasResults = Boolean(r.officialResults);

              return (
                <ListGroup.Item
                  key={r.id}
                  className="px-2 py-2"
                  action
                  onClick={() => handleEditRace(r)}
                  style={{ backgroundColor: bgCard, color: textColor, borderColor }}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1 me-2" style={{ minWidth: 0 }}>
                      <div className="d-flex align-items-center gap-1 flex-wrap">
                        <span className="text-muted small fw-bold" style={{ minWidth: "24px" }}>R{r.round}</span>
                        <span className="fw-semibold text-truncate" style={{ color: textColor }}>{r.name}</span>
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                        <small className="text-muted">{fmtDate(r.raceUTC)}</small>
                        {hasSprint && !isCancelledSprint && (
                          <Badge bg="warning" text="dark" className="fw-normal" style={{ fontSize: "0.65rem" }}>Sprint</Badge>
                        )}
                        {isCancelledMain && (
                          <Badge bg="danger" className="fw-normal" style={{ fontSize: "0.65rem" }}>{t("admin.raceCancelled")}</Badge>
                        )}
                        {isCancelledSprint && hasSprint && (
                          <Badge bg="secondary" className="fw-normal" style={{ fontSize: "0.65rem" }}>{t("admin.sprintCancelled")}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-1 flex-shrink-0">
                      {hasResults ? (
                        <Badge bg="success" style={{ fontSize: "0.65rem" }}>{t("admin.hasResults")}</Badge>
                      ) : (
                        <Badge bg="secondary" style={{ fontSize: "0.65rem" }}>{t("admin.pending")}</Badge>
                      )}
                      <span className="text-muted">✏️</span>
                    </div>
                  </div>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        )}
      </Col>

      {/* ─── Add Race Modal ─── */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered>
        <Modal.Header closeButton style={{ backgroundColor: bgHeader, borderBottomColor: isDark ? "var(--border-color)" : undefined, color: textColor }}>
          <Modal.Title className="fs-6">➕ {t("admin.addRace")}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAddRace}>
          <Modal.Body style={{ backgroundColor: bgCard, color: textColor }}>
            {message && (
              <Alert variant={message.type} dismissible onClose={() => setMessage(null)} className="py-2">{message.text}</Alert>
            )}
            <Row className="g-2">
              <Col xs={4}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">{t("admin.raceRound")} *</Form.Label>
                  <Form.Control type="number" size="sm" min="1" max="30" value={addFormData.round}
                    onChange={(e) => setAddFormData({ ...addFormData, round: e.target.value })} required style={inputStyle} />
                </Form.Group>
                {addFormData.round && races.filter((r) => r.round >= parseInt(addFormData.round)).length > 0 && (
                  <small className="text-warning d-block mt-1">
                    ⚠️ {races.filter((r) => r.round >= parseInt(addFormData.round)).length} {t("admin.racesWillShift")}
                  </small>
                )}
              </Col>
              <Col xs={8}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">{t("admin.raceName")} *</Form.Label>
                  <Form.Control type="text" size="sm" placeholder="e.g. Bahrain Grand Prix" value={addFormData.name}
                    onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })} required style={inputStyle} />
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">{t("admin.raceDateTimeUTC")} *</Form.Label>
                  <Form.Control type="datetime-local" size="sm" value={addFormData.raceDateTimeUTC}
                    onChange={(e) => setAddFormData({ ...addFormData, raceDateTimeUTC: e.target.value })} required style={inputStyle} />
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">{t("admin.qualiDateTimeUTC")} *</Form.Label>
                  <Form.Control type="datetime-local" size="sm" value={addFormData.qualiDateTimeUTC}
                    onChange={(e) => setAddFormData({ ...addFormData, qualiDateTimeUTC: e.target.value })} required style={inputStyle} />
                </Form.Group>
              </Col>
              <Col xs={12}>
                <hr style={{ borderColor: isDark ? "var(--border-color)" : undefined }} />
                <small className="text-muted">Sprint weekend ({t("formations.optional")})</small>
              </Col>
              <Col xs={12}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">{t("admin.sprintQualiDateTimeUTC")}</Form.Label>
                  <Form.Control type="datetime-local" size="sm" value={addFormData.sprintQualiDateTimeUTC}
                    onChange={(e) => setAddFormData({ ...addFormData, sprintQualiDateTimeUTC: e.target.value })} style={inputStyle} />
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">{t("admin.sprintDateTimeUTC")}</Form.Label>
                  <Form.Control type="datetime-local" size="sm" value={addFormData.sprintDateTimeUTC}
                    onChange={(e) => setAddFormData({ ...addFormData, sprintDateTimeUTC: e.target.value })} style={inputStyle} />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer style={{ backgroundColor: bgHeader, borderTopColor: isDark ? "var(--border-color)" : undefined }}>
            <Button variant="secondary" size="sm" onClick={() => setShowAddModal(false)} disabled={addSaving}>{t("common.cancel")}</Button>
            <Button variant="danger" size="sm" type="submit" disabled={addSaving}>
              {addSaving ? <Spinner animation="border" size="sm" /> : `➕ ${t("admin.addRace")}`}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ─── Edit Race Modal (full editing + preview) ─── */}
      <Modal show={showEditModal} onHide={() => { setShowEditModal(false); setShowPreview(false); }} centered size={showPreview ? "lg" : undefined}>
        <Modal.Header closeButton style={{ backgroundColor: bgHeader, borderBottomColor: isDark ? "var(--border-color)" : undefined, color: textColor }}>
          <Modal.Title className="fs-6">✏️ {t("admin.editRace")} — R{editingRace?.round}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: bgCard, color: textColor }}>
          {message && (
            <Alert variant={message.type} dismissible onClose={() => setMessage(null)} className="py-2">{message.text}</Alert>
          )}

          {!showPreview ? (
            <Form>
              {/* Race Name */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">{t("admin.raceName")} *</Form.Label>
                <Form.Control type="text" size="sm" value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} required style={inputStyle} />
              </Form.Group>

              {/* Race Date/Time */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">{t("admin.raceDateTimeUTC")} *</Form.Label>
                <Form.Control type="datetime-local" size="sm" value={editFormData.raceDateTimeUTC}
                  onChange={(e) => setEditFormData({ ...editFormData, raceDateTimeUTC: e.target.value })} required style={inputStyle} />
              </Form.Group>

              {/* Qualifying Date/Time (deadline) */}
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">{t("admin.qualiDateTimeUTC")} *</Form.Label>
                <Form.Control type="datetime-local" size="sm" value={editFormData.qualiDateTimeUTC}
                  onChange={(e) => setEditFormData({ ...editFormData, qualiDateTimeUTC: e.target.value })} required style={inputStyle} />
                <Form.Text className="text-muted">{t("admin.qualiDeadlineHint")}</Form.Text>
              </Form.Group>

              <hr style={{ borderColor: isDark ? "var(--border-color)" : undefined }} />

              {/* Sprint Section */}
              <small className="text-muted d-block mb-2">Sprint ({t("formations.optional")})</small>

              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">{t("admin.sprintQualiDateTimeUTC")}</Form.Label>
                <Form.Control type="datetime-local" size="sm" value={editFormData.sprintQualiDateTimeUTC}
                  onChange={(e) => setEditFormData({ ...editFormData, sprintQualiDateTimeUTC: e.target.value })} style={inputStyle} />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">{t("admin.sprintDateTimeUTC")}</Form.Label>
                <Form.Control type="datetime-local" size="sm" value={editFormData.sprintDateTimeUTC}
                  onChange={(e) => setEditFormData({ ...editFormData, sprintDateTimeUTC: e.target.value })} style={inputStyle} />
              </Form.Group>

              <hr style={{ borderColor: isDark ? "var(--border-color)" : undefined }} />

              {/* Cancel / Restore buttons */}
              <div className="d-flex flex-wrap gap-2">
                {!editingRace?.cancelledMain ? (
                  <Button variant="outline-danger" size="sm" onClick={() => handleCancelRace("main")}>
                    ⛔ {t("admin.cancelMainRace")}
                  </Button>
                ) : (
                  <div className="d-flex align-items-center gap-2">
                    <Badge bg="danger">⛔ {t("admin.raceCancelled")}</Badge>
                    <Button variant="outline-success" size="sm" onClick={() => handleRestoreRace("main")} disabled={uploading}>
                      ✅ {t("admin.restoreRace")}
                    </Button>
                  </div>
                )}

                {editingRace?.qualiSprintUTC && (
                  <>
                    {!editingRace?.cancelledSprint ? (
                      <Button variant="outline-warning" size="sm" onClick={() => handleCancelRace("sprint")}>
                        ⛔ {t("admin.cancelSprint")}
                      </Button>
                    ) : (
                      <div className="d-flex align-items-center gap-2">
                        <Badge bg="warning" text="dark">⛔ {t("admin.sprintCancelled")}</Badge>
                        <Button variant="outline-success" size="sm" onClick={() => handleRestoreRace("sprint")} disabled={uploading}>
                          ✅ {t("admin.restoreSprint")}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Form>
          ) : (
            /* ─── Preview Panel ─── */
            <div>
              <h6 className="fw-bold mb-3">📋 {t("admin.previewChanges")}</h6>

              {/* Summary of what changed */}
              {editingRace && (
                <Alert variant="info" className="py-2 small">
                  <strong>{editingRace.name}</strong> → <strong>{editFormData.name}</strong>
                  {editFormData.name !== editingRace.name && <Badge bg="info" className="ms-1">{t("admin.nameChanged")}</Badge>}
                  <br />
                  {t("admin.raceDateTimeUTC")}: {fmtFull(editingRace.raceUTC)} → {editFormData.raceDateTimeUTC ? new Date(editFormData.raceDateTimeUTC).toLocaleString("it-IT") : "—"}
                  <br />
                  {t("admin.qualiDateTimeUTC")}: {fmtFull(editingRace.qualiUTC)} → {editFormData.qualiDateTimeUTC ? new Date(editFormData.qualiDateTimeUTC).toLocaleString("it-IT") : "—"}
                </Alert>
              )}

              {/* Round reorder preview */}
              {previewData && previewData.some((r) => r.changed) && (
                <>
                  <p className="small text-muted mb-2">{t("admin.roundReorderPreview")}</p>
                  <div style={{ maxHeight: 300, overflowY: "auto" }}>
                    <Table size="sm" bordered hover style={{ color: textColor, fontSize: "0.8rem" }}>
                      <thead>
                        <tr>
                          <th>{t("admin.raceRound")}</th>
                          <th>{t("admin.raceName")}</th>
                          <th>{t("common.date")}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((r) => (
                          <tr key={r.id} style={{
                            backgroundColor: r.isEdited ? (isDark ? "rgba(25,135,84,0.15)" : "rgba(25,135,84,0.08)") : undefined,
                            fontWeight: r.isEdited ? 600 : undefined,
                          }}>
                            <td>
                              {r.oldRound !== r.newRound ? (
                                <span>
                                  <s className="text-muted">R{r.oldRound}</s> → <strong className="text-primary">R{r.newRound}</strong>
                                </span>
                              ) : (
                                <span>R{r.newRound}</span>
                              )}
                            </td>
                            <td>{r.name}</td>
                            <td className="text-muted">{r.raceDate}</td>
                            <td>
                              {r.isEdited && <Badge bg="success" style={{ fontSize: "0.6rem" }}>{t("admin.edited")}</Badge>}
                              {!r.isEdited && r.oldRound !== r.newRound && <Badge bg="warning" text="dark" style={{ fontSize: "0.6rem" }}>{t("admin.shifted")}</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </>
              )}

              {previewData && !previewData.some((r) => r.changed && !r.isEdited) && (
                <p className="small text-success mb-0">✅ {t("admin.noRoundChanges")}</p>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: bgHeader, borderTopColor: isDark ? "var(--border-color)" : undefined }}>
          {!showPreview ? (
            <>
              <Button variant="outline-danger" size="sm" onClick={handleDeleteRace} disabled={uploading} className="me-auto">
                🗑️ {t("common.delete")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowEditModal(false)}>{t("common.cancel")}</Button>
              <Button variant="primary" size="sm" onClick={handleShowPreview} disabled={uploading || editingRace?.cancelledMain}>
                👁️ {t("admin.preview")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowPreview(false)}>
                ← {t("common.back")}
              </Button>
              <Button variant="success" size="sm" onClick={handleConfirmSave} disabled={uploading}>
                {uploading ? <Spinner animation="border" size="sm" /> : `✅ ${t("common.confirm")}`}
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>

      {/* ─── Cancel Race Confirmation Modal ─── */}
      <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)} centered>
        <Modal.Header closeButton style={{ backgroundColor: bgHeader, borderBottomColor: isDark ? "var(--border-color)" : undefined, color: textColor }}>
          <Modal.Title className="fs-6">
            ⚠️ {cancelType === "main" ? t("admin.cancelMainRace") : t("admin.cancelSprint")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: bgCard, color: textColor }}>
          <Alert variant={cancelType === "main" ? "danger" : "warning"} className="mb-3">
            {cancelType === "main" ? t("admin.cancelRaceWarning") : t("admin.cancelSprintWarning")}
          </Alert>
          <p className="fw-semibold mb-0">{t("admin.cancelConfirmQuestion")}</p>
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: bgHeader, borderTopColor: isDark ? "var(--border-color)" : undefined }}>
          <Button variant="secondary" size="sm" onClick={() => setShowCancelModal(false)}>{t("common.cancel")}</Button>
          <Button variant={cancelType === "main" ? "danger" : "warning"} size="sm" onClick={confirmCancelRace} disabled={uploading}>
            {uploading ? <Spinner animation="border" size="sm" /> : t("common.confirm")}
          </Button>
        </Modal.Footer>
      </Modal>
    </Row>
  );
}

CalendarManager.propTypes = {
  races: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool.isRequired,
  onDataChange: PropTypes.func.isRequired,
};
