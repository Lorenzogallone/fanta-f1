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

const NotificationsActiveIcon = ({ fontSize, style }) => (
  <svg width={fontSize === 'small' ? 20 : 24} height={fontSize === 'small' ? 20 : 24} viewBox="0 0 24 24" fill="currentColor" style={style}>
    <path d="M7.58 4.08L6.15 2.65C3.75 4.48 2.17 7.3 2.03 10.5h2c.15-2.65 1.51-4.97 3.55-6.42zm12.39 6.42h2c-.15-3.2-1.73-6.02-4.12-7.85l-1.42 1.43c2.02 1.45 3.39 3.77 3.54 6.42zM18 11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2v-5zm-6 11c.14 0 .27-.01.4-.04.65-.14 1.18-.58 1.44-1.18.1-.24.15-.5.15-.78h-4c.01 1.1.9 2 2.01 2z"/>
  </svg>
);
const NotificationsOffIcon = ({ fontSize, style }) => (
  <svg width={fontSize === 'small' ? 20 : 24} height={fontSize === 'small' ? 20 : 24} viewBox="0 0 24 24" fill="currentColor" style={style}>
    <path d="M20 18.69L7.84 6.14 5.27 3.49 4 4.76l2.8 2.8v.01c-.52.99-.8 2.16-.8 3.42v5l-2 2v1h13.73l2 2L21 19.72l-1-1.03zM12 22c1.11 0 2-.89 2-2h-4c0 1.11.89 2 2 2zm6-7.32V11c0-3.08-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-.15.03-.29.08-.42.12-.1.03-.2.07-.3.11h-.01c-.01 0-.01 0-.02.01-.23.09-.46.2-.68.31 0 0-.01 0-.01.01L18 14.68z"/>
  </svg>
);
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
