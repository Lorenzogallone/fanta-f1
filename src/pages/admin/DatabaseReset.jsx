/**
 * @file DatabaseReset.jsx
 * @description Database reset and backup component for admin panel
 */

import React, { useState, useEffect } from "react";
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
  collection,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../hooks/useLanguage";
import { error } from "../../utils/logger";
import {
  createAndSaveBackup,
  getAllBackups,
  deleteBackup,
  restoreFromBackup,
  downloadBackupAsJSON,
} from "../../services/backupService";

/**
 * Database reset and backup component
 * @param {Object} props - Component props
 * @param {Array} props.participants - List of participants
 * @param {Array} props.races - List of races
 * @param {Function} props.onDataChange - Callback to refresh data
 * @returns {JSX.Element} Database reset interface with backup functionality
 */
export default function DatabaseReset({ participants, races, onDataChange }) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [resetType, setResetType] = useState("");
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [backingUp, setBackingUp] = useState(false);

  // Backup management states
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const allBackups = await getAllBackups();
      setBackups(allBackups);
    } catch (err) {
      error("Error loading backups:", err);
      setMessage({ type: "danger", text: `${t("admin.errorLoadingBackups")}: ${err.message}` });
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    setBackingUp(true);
    setMessage(null);

    try {
      const backupId = await createAndSaveBackup("manual", {
        createdBy: "admin",
        description: t("admin.backupManualDescription"),
      });

      const backupsSnap = await getDocs(collection(db, "backups"));
      const savedBackup = backupsSnap.docs.find(d => d.id === backupId);
      if (savedBackup) {
        downloadBackupAsJSON(savedBackup.data(), `backup-manual-${Date.now()}`);
      }

      setMessage({
        type: "success",
        text: `✅ ${t("admin.backupCreatedAndSaved")}`
      });

      await loadBackups();
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setBackingUp(false);
    }
  };

  const handleDeleteBackup = async (backupId) => {
    if (!window.confirm(t("admin.confirmDeleteBackup"))) {
      return;
    }

    try {
      await deleteBackup(backupId);
      setMessage({ type: "success", text: t("admin.backupDeleted") });
      await loadBackups();
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    }
  };

  const handleShowRestorePreview = (backup) => {
    setSelectedBackup(backup);
    setShowRestoreModal(true);
  };

  const handleRestore = async () => {
    if (confirmText !== "RESTORE") {
      setMessage({ type: "warning", text: t("admin.typeRestoreToConfirm") });
      return;
    }

    setRestoring(true);
    setMessage(null);

    try {
      await restoreFromBackup(selectedBackup);
      setMessage({
        type: "success",
        text: `✅ ${t("admin.databaseRestored")}`
      });
      setShowRestoreModal(false);
      setConfirmText("");
      setSelectedBackup(null);

      if (onDataChange) {
        onDataChange();
      }
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("admin.restoreError")}: ${err.message}` });
    } finally {
      setRestoring(false);
    }
  };

  const handleReset = async () => {
    if (confirmText !== "RESET") {
      setMessage({ type: "warning", text: t("admin.confirmReset") });
      return;
    }

    setResetting(true);
    setMessage(null);

    try {
      const batch = writeBatch(db);

      if (resetType === "submissions") {
        const racesSnap = await getDocs(collection(db, "races"));
        for (const raceDoc of racesSnap.docs) {
          const subsSnap = await getDocs(collection(db, "races", raceDoc.id, "submissions"));
          subsSnap.docs.forEach((subDoc) => {
            batch.delete(subDoc.ref);
          });
        }
        await batch.commit();
        setMessage({ type: "success", text: t("success.deleted") });
      } else if (resetType === "ranking") {
        const rankSnap = await getDocs(collection(db, "ranking"));
        rankSnap.docs.forEach((userDoc) => {
          batch.update(userDoc.ref, {
            puntiTotali: 0,
            jolly: 0,
            pointsByRace: {},
            championshipPts: 0,
            championshipPiloti: [],
            championshipCostruttori: [],
          });
        });
        await batch.commit();
        setMessage({ type: "success", text: t("success.updated") });
      } else if (resetType === "all") {
        const rankSnap = await getDocs(collection(db, "ranking"));
        rankSnap.docs.forEach((userDoc) => {
          batch.update(userDoc.ref, {
            puntiTotali: 0,
            jolly: 0,
            pointsByRace: {},
            championshipPts: 0,
            championshipPiloti: [],
            championshipCostruttori: [],
          });
        });

        const racesSnap = await getDocs(collection(db, "races"));
        for (const raceDoc of racesSnap.docs) {
          const subsSnap = await getDocs(collection(db, "races", raceDoc.id, "submissions"));
          subsSnap.docs.forEach((subDoc) => {
            batch.delete(subDoc.ref);
          });
        }

        await batch.commit();
        setMessage({ type: "success", text: t("success.deleted") });
      }

      setShowModal(false);
      setConfirmText("");
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: t("common.error") });
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <Row className="g-4">
        {/* Create Backup Section */}
        <Col xs={12}>
          <Card className="shadow border-success mb-4">
            <Card.Header className="bg-success text-white">
              <h5 className="mb-0">💾 {t("admin.backupDatabase")}</h5>
            </Card.Header>
            <Card.Body>
              <p className="mb-3">{t("admin.backupDescription")}</p>
              <Button
                variant="success"
                onClick={handleCreateBackup}
                disabled={backingUp}
                className="w-100"
                aria-label="Create manual database backup"
              >
                {backingUp ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    {t("admin.creatingBackup")}
                  </>
                ) : (
                  `📥 ${t("admin.createManualBackup")}`
                )}
              </Button>
            </Card.Body>
          </Card>

          {message && (
            <Alert variant={message.type} dismissible onClose={() => setMessage(null)}>
              {message.text}
            </Alert>
          )}
        </Col>

        {/* Backups List Section */}
        <Col xs={12}>
          <Card className="shadow border-info mb-4">
            <Card.Header className="bg-info text-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">📋 {t("admin.savedBackups")}</h5>
              <Button
                size="sm"
                variant="light"
                onClick={loadBackups}
                disabled={loadingBackups}
                aria-label="Refresh backups list"
              >
                {loadingBackups ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  `🔄 ${t("admin.refresh")}`
                )}
              </Button>
            </Card.Header>
            <Card.Body>
              {loadingBackups ? (
                <div className="text-center py-3">
                  <Spinner animation="border" />
                </div>
              ) : backups.length === 0 ? (
                <Alert variant="info" className="mb-0">
                  {t("admin.noBackupsAvailable")}
                </Alert>
              ) : (
                <div className="table-responsive">
                  <Table hover variant={isDark ? "dark" : undefined}>
                    <thead>
                      <tr>
                        <th>{t("admin.backupType")}</th>
                        <th>{t("common.date")}</th>
                        <th>{t("formations.races")}</th>
                        <th>{t("admin.participants")}</th>
                        <th className="text-end">{t("common.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((backup) => {
                        const timestamp = backup.metadata?.timestamp?.toDate?.() || new Date();
                        return (
                          <tr key={backup.id}>
                            <td>
                              <Badge bg={backup.metadata?.type === "manual" ? "success" : "primary"}>
                                {backup.metadata?.type || "manual"}
                              </Badge>
                            </td>
                            <td>{timestamp.toLocaleString("it-IT")}</td>
                            <td>{backup.metadata?.totalRaces || backup.races?.length || 0}</td>
                            <td>{backup.metadata?.totalParticipants || backup.ranking?.length || 0}</td>
                            <td className="text-end">
                              <Button
                                size="sm"
                                variant="outline-primary"
                                className="me-2"
                                onClick={() => downloadBackupAsJSON(backup, backup.id)}
                                aria-label={`Download backup from ${timestamp.toLocaleDateString()}`}
                              >
                                📥
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-warning"
                                className="me-2"
                                onClick={() => handleShowRestorePreview(backup)}
                                aria-label={`Restore backup from ${timestamp.toLocaleDateString()}`}
                              >
                                ⚡ {t("admin.restore")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => handleDeleteBackup(backup.id)}
                                aria-label={`Delete backup from ${timestamp.toLocaleDateString()}`}
                              >
                                🗑️
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12}>
          <Card className="shadow border-danger">
            <Card.Body className="text-center">
              <h5>💥 {t("admin.resetAll")}</h5>
              <p className="text-muted">{t("admin.confirmReset")}</p>
              <Button
                variant="danger"
                onClick={() => {
                  setResetType("all");
                  setShowModal(true);
                }}
                aria-label="Reset all database data"
              >
                {t("admin.resetAll")}
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Reset confirmation modal */}
      <Modal show={showModal} onHide={() => !resetting && setShowModal(false)} centered>
        <Modal.Header closeButton={!resetting}>
          <Modal.Title>⚠️ {t("common.confirm")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{t("admin.resetAll")}</p>
          <p className="text-muted">{t("admin.confirmReset")}</p>

          <Form.Group>
            <Form.Label>{t("admin.confirmReset")}</Form.Label>
            <Form.Control
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET"
              disabled={resetting}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)} disabled={resetting}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={handleReset} disabled={resetting || confirmText !== "RESET"}>
            {resetting ? t("common.loading") : t("common.confirm")}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Backup Restore Modal */}
      <Modal
        show={showRestoreModal}
        onHide={() => !restoring && setShowRestoreModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton={!restoring}>
          <Modal.Title>⚡ {t("admin.restoreDatabase")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="danger">
            <strong>⚠️ {t("admin.irreversibleWarning")}</strong>
            <p className="mb-0 mt-2">
              {t("admin.restoreWarningDescription")}
            </p>
          </Alert>

          {selectedBackup && (
            <>
              <h6 className="mb-3">📋 {t("admin.backupPreview")}</h6>
              <Table bordered size="sm" variant={isDark ? "dark" : undefined}>
                <tbody>
                  <tr>
                    <th style={{ width: "40%" }}>{t("admin.backupType")}:</th>
                    <td>
                      <Badge bg={selectedBackup.metadata?.type === "manual" ? "success" : "primary"}>
                        {selectedBackup.metadata?.type || "manual"}
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <th>{t("admin.creationDate")}:</th>
                    <td>
                      {(selectedBackup.metadata?.timestamp?.toDate?.() || new Date()).toLocaleString("it-IT")}
                    </td>
                  </tr>
                  <tr>
                    <th>{t("admin.racesCount")}:</th>
                    <td>
                      <Badge bg="info">
                        {selectedBackup.metadata?.totalRaces || selectedBackup.races?.length || 0}
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <th>{t("admin.participantsCount")}:</th>
                    <td>
                      <Badge bg="info">
                        {selectedBackup.metadata?.totalParticipants || selectedBackup.ranking?.length || 0}
                      </Badge>
                    </td>
                  </tr>
                  {selectedBackup.metadata?.description && (
                    <tr>
                      <th>{t("admin.description")}:</th>
                      <td>{selectedBackup.metadata.description}</td>
                    </tr>
                  )}
                </tbody>
              </Table>

              <Form.Group className="mt-4">
                <Form.Label>
                  <strong>{t("admin.typeRestoreToConfirm")}</strong>
                </Form.Label>
                <Form.Control
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RESTORE"
                  disabled={restoring}
                  autoComplete="off"
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowRestoreModal(false);
              setConfirmText("");
            }}
            disabled={restoring}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="warning"
            onClick={handleRestore}
            disabled={restoring || confirmText !== "RESTORE"}
          >
            {restoring ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                {t("admin.restoring")}
              </>
            ) : (
              `⚡ ${t("admin.restoreBackup")}`
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

DatabaseReset.propTypes = {
  participants: PropTypes.arrayOf(PropTypes.object).isRequired,
  races: PropTypes.arrayOf(PropTypes.object).isRequired,
  onDataChange: PropTypes.func.isRequired,
};
