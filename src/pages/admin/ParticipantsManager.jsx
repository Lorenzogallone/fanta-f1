/**
 * @file ParticipantsManager.jsx
 * @description Participants CRUD management — reference design for admin panel.
 * Clean card layout, mobile-first, no horizontal scroll.
 */

import React, { useState } from "react";
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
  setDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../hooks/useLanguage";
import { error } from "../../utils/logger";

export default function ParticipantsManager({ participants, loading, onDataChange }) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentParticipant, setCurrentParticipant] = useState(null);
  const [formData, setFormData] = useState({ id: "", name: "", puntiTotali: 0, jolly: 0, usedLateSubmission: false });

  const borderColor = isDark ? "var(--border-color)" : "#dee2e6";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";

  /**
   * Pretty-print the auth provider id stored in the users collection.
   * @param {string|null} providerId - Firebase provider id (e.g. "google.com", "password")
   * @returns {{label: string, variant: string, icon: string}}
   */
  const renderProvider = (providerId) => {
    if (providerId === "google.com") {
      return { label: "Google", variant: "primary", icon: "🇬" };
    }
    if (providerId === "password") {
      return { label: t("admin.providerPassword"), variant: "secondary", icon: "✉️" };
    }
    return { label: t("admin.providerUnknown"), variant: "outline-secondary", icon: "❔" };
  };

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
      onDataChange();
      setTimeout(() => setShowAddDialog(false), 1200);
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
      setTimeout(() => setShowEditDialog(false), 1200);
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
      setTimeout(() => setShowEditDialog(false), 1200);
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: t("common.error") });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" /></div>;
  }

  return (
    <>
      {/* Section header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0 fw-bold" style={{ color: "var(--text-primary)" }}>
          {t("admin.participants")}
          <Badge bg="secondary" className="ms-2" style={{ fontSize: "0.7rem", verticalAlign: "middle" }}>
            {participants.length}
          </Badge>
        </h6>
        <Button variant="danger" size="sm" onClick={openAddDialog}>
          + {t("admin.addParticipant")}
        </Button>
      </div>

      {participants.length === 0 ? (
        <Alert variant="info">{t("leaderboard.noData")}</Alert>
      ) : (
        <ListGroup variant="flush" style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${borderColor}` }}>
          {participants.map((p) => {
            const provider = renderProvider(p.authProvider);
            return (
              <ListGroup.Item
                key={p.id}
                className="px-3 py-2"
                action
                onClick={() => openEditDialog(p)}
                style={{ backgroundColor: bgCard, color: "var(--text-primary)", borderColor }}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span className="fw-semibold">{p.name}</span>
                    {p.email && (
                      <div
                        className="text-muted text-truncate"
                        style={{ fontSize: "0.75rem", maxWidth: "100%" }}
                        title={p.email}
                      >
                        {p.email}
                      </div>
                    )}
                    <div className="d-flex align-items-center flex-wrap gap-2 mt-1">
                      <small className="text-muted">{p.puntiTotali || 0} {t("common.points").toLowerCase()}</small>
                      <Badge
                        bg={isDark ? "dark" : "light"}
                        text={isDark ? "light" : "dark"}
                        style={{ fontSize: "0.65rem", border: `1px solid ${borderColor}` }}
                      >
                        {t("leaderboard.jokers")}: {p.jolly || 0}
                      </Badge>
                      <Badge
                        bg={provider.variant}
                        style={{ fontSize: "0.65rem" }}
                        title={t("admin.authProvider")}
                      >
                        <span className="me-1" aria-hidden="true">{provider.icon}</span>
                        {provider.label}
                      </Badge>
                      {p.usedLateSubmission && (
                        <Badge bg="warning" text="dark" style={{ fontSize: "0.65rem" }}>
                          {t("admin.lateSubmissionUsed")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-muted ms-2" style={{ fontSize: "0.85rem" }}>›</span>
                </div>
              </ListGroup.Item>
            );
          })}
        </ListGroup>
      )}

      {/* Add Participant Modal */}
      <Modal show={showAddDialog} onHide={() => setShowAddDialog(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">{t("admin.addParticipant")}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAdd}>
          <Modal.Body>
            {message && (
              <Alert variant={message.type} dismissible onClose={() => setMessage(null)} className="py-2">
                {message.text}
              </Alert>
            )}
            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">ID *</Form.Label>
              <Form.Control
                type="text" size="sm" placeholder="e.g. mario"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                required autoFocus
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">{t("admin.participantName")} *</Form.Label>
              <Form.Control
                type="text" size="sm" placeholder="e.g. Mario Rossi"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Form.Group>
            <div className="d-flex gap-2">
              <Form.Group className="flex-fill">
                <Form.Label className="small fw-semibold">{t("admin.totalPoints")}</Form.Label>
                <Form.Control
                  type="number" size="sm" value={formData.puntiTotali}
                  onChange={(e) => setFormData({ ...formData, puntiTotali: e.target.value })}
                />
              </Form.Group>
              <Form.Group className="flex-fill">
                <Form.Label className="small fw-semibold">{t("admin.availableJokers")}</Form.Label>
                <Form.Control
                  type="number" size="sm" value={formData.jolly}
                  onChange={(e) => setFormData({ ...formData, jolly: e.target.value })}
                />
              </Form.Group>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setShowAddDialog(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" size="sm" type="submit" disabled={saving}>
              {saving ? <Spinner animation="border" size="sm" /> : t("admin.addParticipant")}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Edit Participant Modal */}
      <Modal show={showEditDialog} onHide={() => setShowEditDialog(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">{t("admin.editParticipant")}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUpdate}>
          <Modal.Body>
            {message && (
              <Alert variant={message.type} dismissible onClose={() => setMessage(null)} className="py-2">
                {message.text}
              </Alert>
            )}
            {currentParticipant && (
              <>
                <div
                  className="px-3 py-2 rounded mb-3 small"
                  style={{
                    backgroundColor: isDark ? "var(--bg-tertiary)" : "#f8f9fa",
                    color: "var(--text-secondary)",
                  }}
                >
                  <div>ID: <strong>{currentParticipant.id}</strong></div>
                  {currentParticipant.email && (
                    <div className="text-truncate" title={currentParticipant.email}>
                      {t("admin.email")}: <strong>{currentParticipant.email}</strong>
                    </div>
                  )}
                  <div className="d-flex align-items-center gap-2 mt-1">
                    <span>{t("admin.authProvider")}:</span>
                    {(() => {
                      const provider = renderProvider(currentParticipant.authProvider);
                      return (
                        <Badge bg={provider.variant} style={{ fontSize: "0.7rem" }}>
                          <span className="me-1" aria-hidden="true">{provider.icon}</span>
                          {provider.label}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>

                <Form.Group className="mb-3">
                  <Form.Label className="small fw-semibold">{t("admin.participantName")} *</Form.Label>
                  <Form.Control
                    type="text" size="sm" value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required autoFocus
                  />
                </Form.Group>

                <div className="d-flex gap-2 mb-3">
                  <Form.Group className="flex-fill">
                    <Form.Label className="small fw-semibold">{t("admin.totalPoints")}</Form.Label>
                    <Form.Control
                      type="number" size="sm" value={formData.puntiTotali}
                      onChange={(e) => setFormData({ ...formData, puntiTotali: e.target.value })}
                    />
                  </Form.Group>
                  <Form.Group className="flex-fill">
                    <Form.Label className="small fw-semibold">{t("admin.availableJokers")}</Form.Label>
                    <Form.Control
                      type="number" size="sm" value={formData.jolly}
                      onChange={(e) => setFormData({ ...formData, jolly: e.target.value })}
                    />
                  </Form.Group>
                </div>

                <Form.Check
                  type="switch"
                  label={t("admin.lateSubmissionUsed")}
                  checked={formData.usedLateSubmission}
                  onChange={(e) => setFormData({ ...formData, usedLateSubmission: e.target.checked })}
                  className="mb-3"
                />

                <hr />
                <Button variant="outline-danger" size="sm" className="w-100" onClick={handleDelete} disabled={saving}>
                  {t("admin.deleteParticipant")}
                </Button>
                <Form.Text className="text-muted d-block text-center mt-1" style={{ fontSize: "0.75rem" }}>
                  {t("admin.deleteWarning")}
                </Form.Text>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setShowEditDialog(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" size="sm" type="submit" disabled={saving}>
              {saving ? <Spinner animation="border" size="sm" /> : t("common.update")}
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
