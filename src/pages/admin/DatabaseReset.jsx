/**
 * @file DatabaseReset.jsx
 * @description Database backup/restore and reset — professional, unified admin style.
 * Mobile-first card layout with no horizontal scroll.
 */

import React, { useState, useEffect } from "react";
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

export default function DatabaseReset({ participants, races, onDataChange }) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetType, setResetType] = useState("");
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [backingUp, setBackingUp] = useState(false);

  // Backup management
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const borderColor = isDark ? "var(--border-color)" : "#dee2e6";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      setBackups(await getAllBackups());
    } catch (err) {
      error("Error loading backups:", err);
      setMessage({ type: "danger", text: `${t("admin.errorLoadingBackups")}: ${err.message}` });
    } finally { setLoadingBackups(false); }
  };

  useEffect(() => { loadBackups(); }, []);

  const handleCreateBackup = async () => {
    setBackingUp(true); setMessage(null);
    try {
      const backupId = await createAndSaveBackup("manual", {
        createdBy: "admin",
        description: t("admin.backupManualDescription"),
      });
      const backupsSnap = await getDocs(collection(db, "backups"));
      const savedBackup = backupsSnap.docs.find((d) => d.id === backupId);
      if (savedBackup) downloadBackupAsJSON(savedBackup.data(), `backup-manual-${Date.now()}`);
      setMessage({ type: "success", text: t("admin.backupCreatedAndSaved") });
      await loadBackups();
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally { setBackingUp(false); }
  };

  const handleDeleteBackup = async (backupId) => {
    if (!window.confirm(t("admin.confirmDeleteBackup"))) return;
    try {
      await deleteBackup(backupId);
      setMessage({ type: "success", text: t("admin.backupDeleted") });
      await loadBackups();
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    }
  };

  const handleRestore = async () => {
    if (confirmText !== "RESTORE") {
      setMessage({ type: "warning", text: t("admin.typeRestoreToConfirm") });
      return;
    }
    setRestoring(true); setMessage(null);
    try {
      await restoreFromBackup(selectedBackup);
      setMessage({ type: "success", text: t("admin.databaseRestored") });
      setShowRestoreModal(false); setConfirmText(""); setSelectedBackup(null);
      if (onDataChange) onDataChange();
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("admin.restoreError")}: ${err.message}` });
    } finally { setRestoring(false); }
  };

  const handleReset = async () => {
    if (confirmText !== "RESET") return;
    setResetting(true); setMessage(null);
    try {
      const batch = writeBatch(db);
      if (resetType === "submissions" || resetType === "all") {
        const racesSnap = await getDocs(collection(db, "races"));
        for (const raceDoc of racesSnap.docs) {
          const subsSnap = await getDocs(collection(db, "races", raceDoc.id, "submissions"));
          subsSnap.docs.forEach((subDoc) => batch.delete(subDoc.ref));
        }
      }
      if (resetType === "ranking" || resetType === "all") {
        const rankSnap = await getDocs(collection(db, "ranking"));
        rankSnap.docs.forEach((userDoc) => {
          batch.update(userDoc.ref, {
            puntiTotali: 0, jolly: 0, pointsByRace: {},
            championshipPts: 0, championshipPiloti: [], championshipCostruttori: [],
          });
        });
      }
      await batch.commit();
      setMessage({ type: "success", text: t("success.deleted") });
      setShowResetModal(false); setConfirmText("");
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: t("common.error") });
    } finally { setResetting(false); }
  };

  return (
    <>
      {message && (
        <Alert variant={message.type} dismissible onClose={() => setMessage(null)} className="py-2 mb-3">
          {message.text}
        </Alert>
      )}

      {/* ── Backup Section ── */}
      <div className="mb-4">
        <h6 className="mb-2 fw-bold" style={{ color: "var(--text-primary)" }}>
          {t("admin.backupDatabase")}
        </h6>
        <div className="rounded p-3" style={{ backgroundColor: bgCard, border: `1px solid ${borderColor}` }}>
          <p className="small text-muted mb-3">{t("admin.backupDescription")}</p>
          <Button variant="danger" size="sm" className="w-100" onClick={handleCreateBackup} disabled={backingUp}>
            {backingUp ? <><Spinner animation="border" size="sm" className="me-2" />{t("admin.creatingBackup")}</> : t("admin.createManualBackup")}
          </Button>
        </div>
      </div>

      {/* ── Saved Backups ── */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0 fw-bold" style={{ color: "var(--text-primary)" }}>
            {t("admin.savedBackups")}
            <Badge bg="secondary" className="ms-2" style={{ fontSize: "0.7rem", verticalAlign: "middle" }}>
              {backups.length}
            </Badge>
          </h6>
          <Button size="sm" variant="outline-secondary" onClick={loadBackups} disabled={loadingBackups}>
            {loadingBackups ? <Spinner animation="border" size="sm" /> : t("admin.refresh")}
          </Button>
        </div>

        {loadingBackups ? (
          <div className="text-center py-4"><Spinner animation="border" size="sm" /></div>
        ) : backups.length === 0 ? (
          <div className="text-center py-4 rounded small" style={{ backgroundColor: bgCard, border: `1px solid ${borderColor}`, color: "var(--text-muted)" }}>
            {t("admin.noBackupsAvailable")}
          </div>
        ) : (
          <ListGroup variant="flush" style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${borderColor}` }}>
            {backups.map((backup) => {
              const timestamp = backup.metadata?.timestamp?.toDate?.() || new Date();
              return (
                <ListGroup.Item key={backup.id} className="px-3 py-2" style={{ backgroundColor: bgCard, color: "var(--text-primary)", borderColor }}>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <Badge bg={backup.metadata?.type === "manual" ? "success" : "primary"} style={{ fontSize: "0.6rem" }}>
                      {backup.metadata?.type || "manual"}
                    </Badge>
                    <small className="text-muted">{timestamp.toLocaleString("it-IT")}</small>
                  </div>
                  <div className="small text-muted mb-2">
                    {backup.metadata?.totalRaces || backup.races?.length || 0} {t("formations.races").toLowerCase()} · {backup.metadata?.totalParticipants || backup.ranking?.length || 0} {t("admin.participants").toLowerCase()}
                  </div>
                  <div className="d-flex flex-wrap gap-1">
                    <Button size="sm" variant="outline-primary" className="py-0 px-2"
                      onClick={() => downloadBackupAsJSON(backup, backup.id)} style={{ fontSize: "0.7rem" }}>
                      {t("admin.downloadBackup")}
                    </Button>
                    <Button size="sm" variant="outline-warning" className="py-0 px-2"
                      onClick={() => { setSelectedBackup(backup); setConfirmText(""); setShowRestoreModal(true); }}
                      style={{ fontSize: "0.7rem" }}>
                      {t("admin.restore")}
                    </Button>
                    <Button size="sm" variant="outline-danger" className="py-0 px-2"
                      onClick={() => handleDeleteBackup(backup.id)} style={{ fontSize: "0.7rem" }}>
                      {t("common.delete")}
                    </Button>
                  </div>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        )}
      </div>

      {/* ── Reset Section ── */}
      <div>
        <h6 className="mb-2 fw-bold text-danger">{t("admin.resetAll")}</h6>
        <div className="rounded p-3" style={{ backgroundColor: bgCard, border: `1px solid ${borderColor}` }}>
          <p className="small text-muted mb-3">{t("admin.confirmReset")}</p>
          <Button variant="outline-danger" size="sm" className="w-100" onClick={() => { setResetType("all"); setConfirmText(""); setShowResetModal(true); }}>
            {t("admin.resetAll")}
          </Button>
        </div>
      </div>

      {/* ── Reset Modal ── */}
      <Modal show={showResetModal} onHide={() => !resetting && setShowResetModal(false)} centered size="sm">
        <Modal.Header closeButton={!resetting}>
          <Modal.Title className="fs-6">{t("admin.resetAll")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted">{t("admin.confirmReset")}</p>
          <Form.Group>
            <Form.Label className="small fw-semibold">{t("admin.typeResetToConfirm")}</Form.Label>
            <Form.Control type="text" size="sm" value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)} placeholder="RESET" disabled={resetting} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowResetModal(false)} disabled={resetting}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" size="sm" onClick={handleReset} disabled={resetting || confirmText !== "RESET"}>
            {resetting ? <Spinner animation="border" size="sm" /> : t("common.confirm")}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Restore Modal ── */}
      <Modal show={showRestoreModal} onHide={() => !restoring && setShowRestoreModal(false)} centered>
        <Modal.Header closeButton={!restoring}>
          <Modal.Title className="fs-6">{t("admin.restoreDatabase")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="danger" className="py-2 small">
            <strong>{t("admin.irreversibleWarning")}</strong>
            <br />{t("admin.restoreWarningDescription")}
          </Alert>

          {selectedBackup && (
            <>
              <div className="rounded p-2 mb-3 small" style={{ backgroundColor: isDark ? "var(--bg-tertiary)" : "#f8f9fa", border: `1px solid ${borderColor}` }}>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">{t("admin.backupType")}:</span>
                  <Badge bg={selectedBackup.metadata?.type === "manual" ? "success" : "primary"} style={{ fontSize: "0.6rem" }}>
                    {selectedBackup.metadata?.type || "manual"}
                  </Badge>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">{t("admin.creationDate")}:</span>
                  <span>{(selectedBackup.metadata?.timestamp?.toDate?.() || new Date()).toLocaleString("it-IT")}</span>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">{t("admin.racesCount")}:</span>
                  <span>{selectedBackup.metadata?.totalRaces || selectedBackup.races?.length || 0}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted">{t("admin.participantsCount")}:</span>
                  <span>{selectedBackup.metadata?.totalParticipants || selectedBackup.ranking?.length || 0}</span>
                </div>
              </div>

              <Form.Group>
                <Form.Label className="small fw-semibold">{t("admin.typeRestoreToConfirm")}</Form.Label>
                <Form.Control type="text" size="sm" value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)} placeholder="RESTORE" disabled={restoring} autoComplete="off" />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => { setShowRestoreModal(false); setConfirmText(""); }} disabled={restoring}>
            {t("common.cancel")}
          </Button>
          <Button variant="warning" size="sm" onClick={handleRestore} disabled={restoring || confirmText !== "RESTORE"}>
            {restoring ? <><Spinner animation="border" size="sm" className="me-2" />{t("admin.restoring")}</> : t("admin.restoreBackup")}
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
