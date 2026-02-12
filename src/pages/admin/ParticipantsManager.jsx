/**
 * @file ParticipantsManager.jsx
 * @description Participants management component for admin panel
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
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../hooks/useLanguage";
import { error } from "../../utils/logger";

/**
 * Participants management component
 * @param {Object} props - Component props
 * @param {Array} props.participants - List of participants
 * @param {boolean} props.loading - Loading state
 * @param {Function} props.onDataChange - Callback to refresh data
 * @returns {JSX.Element} Participants management interface
 */
export default function ParticipantsManager({ participants, loading, onDataChange }) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentParticipant, setCurrentParticipant] = useState(null);
  const [formData, setFormData] = useState({ id: "", name: "", puntiTotali: 0, jolly: 0, usedLateSubmission: false });
  const { isDark } = useTheme();

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";

  const openAddDialog = () => {
    setFormData({ id: "", name: "", puntiTotali: 0, jolly: 0, usedLateSubmission: false });
    setMessage(null);
    setShowAddDialog(true);
  };

  const openEditDialog = (participant) => {
    setCurrentParticipant(participant);
    setFormData({
      id: participant.id,
      name: participant.name,
      puntiTotali: participant.puntiTotali || 0,
      jolly: participant.jolly || 0,
      usedLateSubmission: participant.usedLateSubmission || false,
    });
    setMessage(null);
    setShowEditDialog(true);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!formData.id || !formData.name) {
      setMessage({ type: "warning", text: t("errors.incompleteForm") });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await setDoc(doc(db, "ranking", formData.id), {
        name: formData.name,
        puntiTotali: parseInt(formData.puntiTotali) || 0,
        jolly: parseInt(formData.jolly) || 0,
        usedLateSubmission: false,
        pointsByRace: {},
        championshipPiloti: [],
        championshipCostruttori: [],
        championshipPts: 0,
      });

      setMessage({ type: "success", text: t("admin.participantAdded") });
      setFormData({ id: "", name: "", puntiTotali: 0, jolly: 0, usedLateSubmission: false });
      onDataChange();
      setTimeout(() => setShowAddDialog(false), 1500);
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: t("common.error") });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await updateDoc(doc(db, "ranking", currentParticipant.id), {
        name: formData.name,
        puntiTotali: parseInt(formData.puntiTotali) || 0,
        jolly: parseInt(formData.jolly) || 0,
        usedLateSubmission: formData.usedLateSubmission,
      });

      setMessage({ type: "success", text: t("admin.participantUpdated") });
      onDataChange();
      setTimeout(() => setShowEditDialog(false), 1500);
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: t("common.error") });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`${t("admin.deleteParticipant")} ${currentParticipant.name}?\n\n${t("admin.deleteWarning")}`)) return;

    setSaving(true);
    setMessage(null);

    try {
      await deleteDoc(doc(db, "ranking", currentParticipant.id));
      setMessage({ type: "success", text: t("admin.participantDeleted") });
      onDataChange();
      setTimeout(() => setShowEditDialog(false), 1500);
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: t("common.error") });
    } finally {
      setSaving(false);
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
    <>
      <Row className="mb-3">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">{t("admin.participants")} ({participants.length})</h5>
            <Button variant="danger" onClick={openAddDialog} aria-label="Add new participant">
              ➕ {t("admin.addParticipant")}
            </Button>
          </div>
        </Col>
      </Row>

      <Row>
        <Col>
          <Card className="shadow">
            <Card.Body className="p-0">
              {participants.length === 0 ? (
                <Alert variant="info" className="m-3">
                  {t("leaderboard.noData")}
                </Alert>
              ) : (
                <div className="table-responsive">
                  <Table hover className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>{t("common.name")}</th>
                        <th className="text-center">{t("common.points")}</th>
                        <th className="text-center">{t("leaderboard.jokers")}</th>
                        <th className="text-center">{t("admin.lateSubmissionUsed")}</th>
                        <th className="text-center" style={{ width: 100 }}>{t("common.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div>
                              <strong>{p.name}</strong>
                              <br />
                              <small className="text-muted">ID: {p.id}</small>
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="fw-semibold">{p.puntiTotali || 0}</span>
                          </td>
                          <td className="text-center">
                            <span className="fw-semibold">{p.jolly || 0}</span>
                          </td>
                          <td className="text-center">
                            <Badge bg={p.usedLateSubmission ? "warning" : "secondary"}>
                              {p.usedLateSubmission ? "Yes" : "No"}
                            </Badge>
                          </td>
                          <td className="text-center">
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => openEditDialog(p)}
                              aria-label={`Edit participant ${p.name}`}
                            >
                              ✏️ {t("common.edit")}
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
      </Row>

      {/* Add Participant Dialog */}
      <Modal show={showAddDialog} onHide={() => setShowAddDialog(false)} centered>
        <Modal.Header closeButton style={{ borderBottomColor: accentColor }}>
          <Modal.Title>➕ {t("admin.addParticipant")}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAdd}>
          <Modal.Body>
            {message && (
              <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}

            <Form.Group className="mb-3">
              <Form.Label>ID *</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. mario"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                required
                autoFocus
              />
              <Form.Text>{t("formations.required")}</Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t("admin.participantName")} *</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. Mario Rossi"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t("admin.totalPoints")}</Form.Label>
              <Form.Control
                type="number"
                value={formData.puntiTotali}
                onChange={(e) => setFormData({ ...formData, puntiTotali: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t("admin.availableJokers")}</Form.Label>
              <Form.Control
                type="number"
                value={formData.jolly}
                onChange={(e) => setFormData({ ...formData, jolly: e.target.value })}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAddDialog(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" type="submit" disabled={saving}>
              {saving ? t("common.loading") : t("admin.addParticipant")}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Edit Participant Dialog */}
      <Modal show={showEditDialog} onHide={() => setShowEditDialog(false)} centered>
        <Modal.Header closeButton style={{ borderBottomColor: accentColor }}>
          <Modal.Title>✏️ {t("admin.editParticipant")}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUpdate}>
          <Modal.Body>
            {message && (
              <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}

            {currentParticipant && (
              <>
                <Alert variant="light" className="mb-3">
                  <strong>ID:</strong> {currentParticipant.id}
                </Alert>

                <Form.Group className="mb-3">
                  <Form.Label>{t("admin.participantName")} *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    autoFocus
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>{t("admin.totalPoints")}</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.puntiTotali}
                    onChange={(e) => setFormData({ ...formData, puntiTotali: e.target.value })}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>{t("admin.availableJokers")}</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.jolly}
                    onChange={(e) => setFormData({ ...formData, jolly: e.target.value })}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label={`⏰ ${t("admin.lateSubmissionUsed")}`}
                    checked={formData.usedLateSubmission}
                    onChange={(e) => setFormData({ ...formData, usedLateSubmission: e.target.checked })}
                  />
                </Form.Group>

                <hr />

                <div className="d-grid">
                  <Button variant="outline-danger" onClick={handleDelete} disabled={saving} aria-label={`Delete participant ${currentParticipant?.name}`}>
                    🗑️ {t("admin.deleteParticipant")}
                  </Button>
                  <Form.Text className="text-muted text-center mt-2">
                    {t("admin.deleteWarning")}
                  </Form.Text>
                </div>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditDialog(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" type="submit" disabled={saving}>
              {saving ? t("common.loading") : t("common.update")}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}

ParticipantsManager.propTypes = {
  participants: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool.isRequired,
  onDataChange: PropTypes.func.isRequired,
};
