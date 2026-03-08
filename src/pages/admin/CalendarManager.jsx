/**
 * @file CalendarManager.jsx
 * @description Calendar management component with ICS import support for admin panel
 */

import React, { useState } from "react";
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
} from "react-bootstrap";
import {
  doc,
  updateDoc,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useLanguage } from "../../hooks/useLanguage";
import { error } from "../../utils/logger";

export default function CalendarManager({ races, loading, onDataChange }) {
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingRace, setEditingRace] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelType, setCancelType] = useState("");
  const [editFormData, setEditFormData] = useState({
    qualiTime: "",
    sprintTime: "",
  });

  // ICS Import state
  const [icsFile, setIcsFile] = useState(null);
  const [parsedRaces, setParsedRaces] = useState([]);
  const [loadingIcs, setLoadingIcs] = useState(false);
  const [importing, setImporting] = useState(false);

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
      setMessage({
        type: "success",
        text: `${parsed.length} gare trovate nel file`,
      });
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

      setMessage({
        type: "success",
        text: `${parsedRaces.length} gare importate`,
      });
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

  const handleEditRace = (race) => {
    setEditingRace(race);

    const formatTime = (firestoreTimestamp) => {
      if (!firestoreTimestamp) return "";
      const date = new Date(firestoreTimestamp.seconds * 1000);
      return date.toTimeString().slice(0, 5);
    };

    setEditFormData({
      qualiTime: formatTime(race.qualiUTC),
      sprintTime: race.qualiSprintUTC ? formatTime(race.qualiSprintUTC) : "",
    });

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
      if (cancelType === "main") {
        updates.cancelledMain = true;
      } else if (cancelType === "sprint") {
        updates.cancelledSprint = true;
      }

      await updateDoc(doc(db, "races", editingRace.id), updates);

      setMessage({ type: "success", text: t("admin.raceUpdated") });
      setShowCancelModal(false);
      setCancelType("");
      await onDataChange();

      setEditingRace(prev => ({
        ...prev,
        ...(cancelType === "main" ? { cancelledMain: true } : { cancelledSprint: true })
      }));
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveRaceDates = async () => {
    if (!editingRace) return;

    setUploading(true);
    setMessage(null);

    try {
      const updateTime = (originalTimestamp, newTime) => {
        if (!originalTimestamp || !newTime) return null;
        const originalDate = new Date(originalTimestamp.seconds * 1000);
        const [hours, minutes] = newTime.split(':');
        originalDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return Timestamp.fromDate(originalDate);
      };

      const updates = {
        qualiUTC: updateTime(editingRace.qualiUTC, editFormData.qualiTime),
      };

      if (editingRace.qualiSprintUTC && editFormData.sprintTime) {
        updates.qualiSprintUTC = updateTime(editingRace.qualiSprintUTC, editFormData.sprintTime);
      }

      await updateDoc(doc(db, "races", editingRace.id), updates);

      setMessage({ type: "success", text: t("admin.raceUpdated") });
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

  const formatDate = (firestoreTimestamp) => {
    if (!firestoreTimestamp) return "—";
    return new Date(firestoreTimestamp.seconds * 1000).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
    });
  };

  const formatDateTime = (firestoreTimestamp) => {
    if (!firestoreTimestamp) return "—";
    return new Date(firestoreTimestamp.seconds * 1000).toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
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
        <Card className="shadow-sm border-primary">
          <Card.Header className="bg-primary text-white py-2">
            <h6 className="mb-0">📅 {t("admin.importICS")}</h6>
          </Card.Header>
          <Card.Body className="py-3">
            {message && (
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
              />
            </Form.Group>

            {loadingIcs && (
              <div className="text-center py-2">
                <Spinner animation="border" size="sm" className="me-2" />
                {t("common.loading")}
              </div>
            )}

            {parsedRaces.length > 0 && !loadingIcs && (
              <Button
                variant="primary"
                className="w-100 mt-2"
                onClick={handleIcsImport}
                disabled={importing}
              >
                {importing ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    {t("common.loading")}
                  </>
                ) : (
                  `📥 ${t("admin.importICS")} (${parsedRaces.length})`
                )}
              </Button>
            )}
          </Card.Body>
        </Card>
      </Col>

      {/* Race List — mobile-first card layout */}
      <Col xs={12}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0">{t("admin.raceCalendar")} ({races.length})</h6>
          <Button size="sm" variant="outline-secondary" onClick={onDataChange}>
            🔄
          </Button>
        </div>

        {races.length === 0 ? (
          <Alert variant="info">{t("leaderboard.noData")}</Alert>
        ) : (
          <ListGroup variant="flush">
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
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1 me-2" style={{ minWidth: 0 }}>
                      <div className="d-flex align-items-center gap-1 flex-wrap">
                        <span className="text-muted small fw-bold" style={{ minWidth: "24px" }}>
                          R{r.round}
                        </span>
                        <span className="fw-semibold text-truncate">
                          {r.name}
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                        <small className="text-muted">
                          {formatDate(r.raceUTC)}
                        </small>
                        {hasSprint && !isCancelledSprint && (
                          <Badge bg="warning" text="dark" className="fw-normal" style={{ fontSize: "0.65rem" }}>
                            Sprint
                          </Badge>
                        )}
                        {isCancelledMain && (
                          <Badge bg="danger" className="fw-normal" style={{ fontSize: "0.65rem" }}>
                            {t("admin.raceCancelled")}
                          </Badge>
                        )}
                        {isCancelledSprint && hasSprint && (
                          <Badge bg="secondary" className="fw-normal" style={{ fontSize: "0.65rem" }}>
                            {t("admin.sprintCancelled")}
                          </Badge>
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

      {/* Edit Race Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">
            ✏️ {editingRace?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {/* Race date info */}
            <div className="text-muted small mb-3">
              {editingRace?.raceUTC && new Date(editingRace.raceUTC.seconds * 1000).toLocaleDateString("it-IT", {
                weekday: "long", year: "numeric", month: "long", day: "numeric"
              })}
            </div>

            {/* Main Race Section */}
            {!editingRace?.cancelledMain ? (
              <>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-semibold">
                    {t("admin.deadline")} {t("formations.mainRace")}
                  </Form.Label>
                  <Form.Control
                    type="time"
                    size="sm"
                    value={editFormData.qualiTime}
                    onChange={(e) => setEditFormData({ ...editFormData, qualiTime: e.target.value })}
                    required
                  />
                </Form.Group>

                <Button
                  variant="outline-danger"
                  size="sm"
                  className="mb-3"
                  onClick={() => handleCancelRace("main")}
                >
                  ⛔ {t("admin.cancelMainRace")}
                </Button>
              </>
            ) : (
              <Alert variant="danger" className="py-2 mb-3">
                ⛔ {t("admin.raceCancelled")}
              </Alert>
            )}

            {/* Sprint Section */}
            {editingRace?.qualiSprintUTC && (
              <>
                <hr />
                {!editingRace?.cancelledSprint ? (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-semibold">
                        {t("admin.deadline")} {t("formations.sprint")}
                      </Form.Label>
                      <Form.Control
                        type="time"
                        size="sm"
                        value={editFormData.sprintTime}
                        onChange={(e) => setEditFormData({ ...editFormData, sprintTime: e.target.value })}
                      />
                    </Form.Group>

                    <Button
                      variant="outline-warning"
                      size="sm"
                      onClick={() => handleCancelRace("sprint")}
                    >
                      ⛔ {t("admin.cancelSprint")}
                    </Button>
                  </>
                ) : (
                  <Alert variant="warning" className="py-2">
                    ⛔ {t("admin.sprintCancelled")}
                  </Alert>
                )}
              </>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowEditModal(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveRaceDates}
            disabled={uploading || editingRace?.cancelledMain}
          >
            {uploading ? <Spinner animation="border" size="sm" /> : `💾 ${t("common.save")}`}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancel Race Confirmation Modal */}
      <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">
            ⚠️ {cancelType === "main" ? t("admin.cancelMainRace") : t("admin.cancelSprint")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant={cancelType === "main" ? "danger" : "warning"} className="mb-3">
            {cancelType === "main"
              ? t("admin.cancelRaceWarning")
              : t("admin.cancelSprintWarning")
            }
          </Alert>
          <p className="fw-semibold mb-0">{t("admin.cancelConfirmQuestion")}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowCancelModal(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={cancelType === "main" ? "danger" : "warning"}
            size="sm"
            onClick={confirmCancelRace}
            disabled={uploading}
          >
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
