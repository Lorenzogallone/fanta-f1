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
  Table,
  Badge,
  Modal,
} from "react-bootstrap";
import {
  doc,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useLanguage } from "../../hooks/useLanguage";
import { error } from "../../utils/logger";

/**
 * Calendar management component with ICS import support
 * @param {Object} props - Component props
 * @param {Array} props.races - List of races
 * @param {boolean} props.loading - Loading state
 * @param {Function} props.onDataChange - Callback to refresh data
 * @returns {JSX.Element} Calendar management interface
 */
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
        text: `${t("common.success")}: ${parsed.length} ${t("history.pastRaces")}`,
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

    const confirmMsg = `${t("admin.confirmReset")}`;
    if (!window.confirm(confirmMsg)) return;

    setImporting(true);
    setMessage(null);

    try {
      for (const race of parsedRaces) {
        await setDoc(
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

      setMessage({
        type: "success",
        text: `${t("common.success")}: ${parsedRaces.length} ${t("history.pastRaces")}`,
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

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <Row className="g-4">
      {/* ICS Import Section */}
      <Col xs={12}>
        <Card className="shadow border-primary">
          <Card.Header className="bg-primary text-white">
            <h5 className="mb-0">📅 {t("admin.importICS")}</h5>
          </Card.Header>
          <Card.Body>
            <p>{t("admin.raceCalendar")}</p>

            {message && (
              <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}

            <Form.Group className="mb-3">
              <Form.Label>{t("admin.importICS")}</Form.Label>
              <Form.Control
                type="file"
                accept=".ics"
                onChange={handleIcsFileSelect}
                disabled={loadingIcs || importing}
                aria-label="Select ICS calendar file to import races"
              />
            </Form.Group>

            {loadingIcs && (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" className="me-2" />
                {t("common.loading")}
              </div>
            )}

            {parsedRaces.length > 0 && !loadingIcs && (
              <>
                <Alert variant="info">
                  {parsedRaces.length} {t("history.pastRaces")}
                </Alert>

                <div className="table-responsive" style={{ maxHeight: "300px", overflowY: "auto" }}>
                  <Table striped bordered hover size="sm">
                    <thead style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 1 }}>
                      <tr>
                        <th>#</th>
                        <th>{t("admin.raceName")}</th>
                        <th>{t("admin.qualifyingDate")}</th>
                        <th>{t("admin.raceDate")}</th>
                        <th>{t("formations.sprint")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRaces.map((race) => (
                        <tr key={race.id}>
                          <td>{race.round}</td>
                          <td>{race.name}</td>
                          <td>{race.qualiUTC.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</td>
                          <td>{race.raceUTC.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</td>
                          <td>
                            {race.sprintUTC ? (
                              <span className="text-success">✓</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  className="w-100 mt-3"
                  onClick={handleIcsImport}
                  disabled={importing}
                  aria-label={`Import ${parsedRaces.length} races from calendar file`}
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
              </>
            )}
          </Card.Body>
        </Card>
      </Col>

      <Col xs={12}>
        <Card className="shadow">
          <Card.Header className="bg-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">{t("admin.raceCalendar")} ({races.length})</h5>
            <Button size="sm" variant="outline-primary" onClick={onDataChange} aria-label="Refresh race calendar">
              🔄
            </Button>
          </Card.Header>
          <Card.Body className="p-0">
            {races.length === 0 ? (
              <Alert variant="info" className="m-3">
                {t("leaderboard.noData")}
              </Alert>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0" size="sm">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "50px" }}>#</th>
                      <th>{t("admin.raceName")}</th>
                      <th>{t("admin.raceDate")}</th>
                      <th>{t("admin.qualifyingDate")}</th>
                      <th className="text-center">{t("formations.sprint")}</th>
                      <th className="text-center">{t("admin.hasResults")}</th>
                      <th style={{ width: "80px" }} className="text-center">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {races.map((r) => (
                      <tr key={r.id}>
                        <td>{r.round}</td>
                        <td>
                          {r.name}
                          {r.cancelledMain && (
                            <Badge bg="danger" className="ms-2">{t("errors.raceCancelled")}</Badge>
                          )}
                          {r.cancelledSprint && r.qualiSprintUTC && (
                            <Badge bg="warning" text="dark" className="ms-2">{t("formations.sprint")} {t("errors.raceCancelled")}</Badge>
                          )}
                        </td>
                        <td>
                          {r.raceUTC
                            ? new Date(r.raceUTC.seconds * 1000).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })
                            : "—"}
                        </td>
                        <td>
                          {r.qualiUTC
                            ? new Date(r.qualiUTC.seconds * 1000).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })
                            : "—"}
                        </td>
                        <td className="text-center">
                          {r.qualiSprintUTC ? (
                            r.cancelledSprint ? (
                              <Badge bg="secondary">✗</Badge>
                            ) : (
                              <Badge bg="warning" text="dark">✓</Badge>
                            )
                          ) : "—"}
                        </td>
                        <td className="text-center">
                          {r.officialResults ? (
                            <Badge bg="success">{t("admin.hasResults")}</Badge>
                          ) : (
                            <Badge bg="secondary">{t("admin.pending")}</Badge>
                          )}
                        </td>
                        <td className="text-center">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => handleEditRace(r)}
                            aria-label={`Edit race ${r.name}`}
                          >
                            ✏️
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      </Col>

      {/* Modal to edit race dates */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>✏️ {t("admin.editRace")} - {editingRace?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Alert variant="light" className="mb-4">
              <strong>{t("admin.raceDate")}:</strong>{" "}
              {editingRace?.raceUTC && new Date(editingRace.raceUTC.seconds * 1000).toLocaleDateString("it-IT", {
                weekday: "long", year: "numeric", month: "long", day: "numeric"
              })}
            </Alert>

            <h6>⏰ {t("formations.deadline")} {t("formations.mainRace")}</h6>
            <Form.Group className="mb-3">
              <Form.Label>{t("formations.deadline")}</Form.Label>
              <Form.Control
                type="time"
                value={editFormData.qualiTime}
                onChange={(e) => setEditFormData({ ...editFormData, qualiTime: e.target.value })}
                required
                disabled={editingRace?.cancelledMain}
              />
            </Form.Group>

            {!editingRace?.cancelledMain ? (
              <Button variant="danger" size="sm" className="mb-4" onClick={() => handleCancelRace("main")}>
                ⛔ {t("errors.raceCancelled")}
              </Button>
            ) : (
              <Alert variant="danger" className="mb-4">
                <strong>⚠️ {t("errors.raceCancelled")}</strong>
              </Alert>
            )}

            {editingRace?.qualiSprintUTC && (
              <>
                <hr />
                <h6>🏁 {t("formations.sprint")}</h6>
                <Form.Group className="mb-3">
                  <Form.Label>{t("formations.deadline")} {t("formations.sprint")}</Form.Label>
                  <Form.Control
                    type="time"
                    value={editFormData.sprintTime}
                    onChange={(e) => setEditFormData({ ...editFormData, sprintTime: e.target.value })}
                    disabled={editingRace?.cancelledSprint}
                  />
                </Form.Group>

                {!editingRace?.cancelledSprint ? (
                  <Button variant="warning" size="sm" onClick={() => handleCancelRace("sprint")}>
                    ⛔ {t("formations.sprint")} {t("errors.raceCancelled")}
                  </Button>
                ) : (
                  <Alert variant="warning">
                    <strong>⚠️ {t("formations.sprint")} {t("errors.raceCancelled")}</strong>
                  </Alert>
                )}
              </>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={handleSaveRaceDates} disabled={uploading}>
            {uploading ? <Spinner animation="border" size="sm" /> : `💾 ${t("common.save")}`}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancellation confirmation modal */}
      <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>⚠️ {t("common.confirm")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant={cancelType === "main" ? "danger" : "warning"}>
            <strong>{t("common.warning")}!</strong>
            <br />
            {t("admin.deleteWarning")}
          </Alert>
          <p className="mb-0">{t("admin.confirmReset")}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={cancelType === "main" ? "danger" : "warning"}
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
