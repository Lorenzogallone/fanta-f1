/**
 * @file NotificationPromptModal.jsx
 * @description Modal shown once on first app open to prompt the user to enable
 * push notifications. Explains that reminders are sent 1 hour and 5 minutes
 * before each race. If the user dismisses with "No", it is never shown again.
 *
 * Conditions to show:
 * - User is authenticated
 * - App is running as installed PWA
 * - Browser supports push notifications
 * - Notifications not already enabled
 * - User hasn't previously dismissed this prompt
 */

import React, { useState, useEffect } from "react";
import { Modal, Button, Spinner } from "react-bootstrap";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import { useAuth } from "../hooks/useAuth";
import {
  isPwaInstalled,
  isNotificationSupported,
  isNotificationsEnabled,
  requestNotificationPermission,
} from "../services/notificationService";

const STORAGE_KEY = "fanta-f1-notification-prompt-dismissed";

export default function NotificationPromptModal() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(STORAGE_KEY) === "true") return;
    if (!isNotificationSupported()) return;
    if (!isPwaInstalled()) return;
    if (isNotificationsEnabled()) return;

    // Small delay so it doesn't pop up instantly on load
    const timer = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(timer);
  }, [user]);

  const handleEnable = async () => {
    setLoading(true);
    setError(null);
    const result = await requestNotificationPermission(user.uid);
    setLoading(false);
    if (result.success) {
      localStorage.setItem(STORAGE_KEY, "true");
      setShow(false);
    } else {
      if (result.error === "permission_denied") {
        // Browser denied — mark as dismissed so we don't ask again
        localStorage.setItem(STORAGE_KEY, "true");
        setShow(false);
      } else {
        setError(result.error);
      }
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
  };

  if (!show) return null;

  return (
    <Modal show={show} onHide={handleDismiss} centered size="sm" backdrop="static">
      <Modal.Header className="border-0 pb-0">
        <Modal.Title className="d-flex align-items-center gap-2" style={{ fontSize: "1.1rem" }}>
          <NotificationsActiveIcon style={{ color: "#dc3545" }} />
          Notifiche gara
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="pt-2">
        <p className="mb-2" style={{ fontSize: "0.95rem" }}>
          Vuoi ricevere un promemoria prima di ogni gara?
        </p>
        <ul className="ps-3 mb-3" style={{ fontSize: "0.88rem", color: "var(--bs-secondary-color)" }}>
          <li><strong>1 ora prima</strong> della partenza</li>
          <li><strong>5 minuti prima</strong> della partenza</li>
        </ul>
        <p className="mb-0" style={{ fontSize: "0.82rem", color: "var(--bs-secondary-color)" }}>
          Potrai sempre cambiare questa impostazione dal menu utente.
        </p>
        {error && (
          <p className="mt-2 mb-0 text-danger" style={{ fontSize: "0.82rem" }}>
            Errore: {error}. Riprova dal menu utente.
          </p>
        )}
      </Modal.Body>

      <Modal.Footer className="border-0 pt-1 gap-2">
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={handleDismiss}
          disabled={loading}
          className="d-flex align-items-center gap-1"
        >
          <NotificationsOffIcon fontSize="small" />
          No, grazie
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={handleEnable}
          disabled={loading}
          className="d-flex align-items-center gap-1"
        >
          {loading ? (
            <Spinner animation="border" size="sm" style={{ width: 14, height: 14 }} />
          ) : (
            <NotificationsActiveIcon fontSize="small" />
          )}
          Attiva
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
