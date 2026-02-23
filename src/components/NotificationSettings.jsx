/**
 * @file NotificationSettings.jsx
 * @description Notification toggle for enabling/disabling qualifying reminders.
 * Only visible when the app is running as an installed PWA.
 */

import React, { useState, useEffect } from "react";
import { Form, Spinner } from "react-bootstrap";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";
import {
  isPwaInstalled,
  isNotificationSupported,
  isNotificationsEnabled,
  requestNotificationPermission,
  disableNotifications,
  getNotificationPermission,
} from "../services/notificationService";

/**
 * Inline notification settings for the user dropdown menu.
 * Shows a toggle switch to enable/disable qualifying push notifications.
 * Only renders when running as an installed PWA.
 * @param {Object} props
 * @param {Object} props.style - Style overrides for text elements
 * @returns {JSX.Element|null}
 */
export default function NotificationSettings({ style = {} }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPwa, setIsPwa] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setIsPwa(isPwaInstalled());
    setSupported(isNotificationSupported());
    setEnabled(isNotificationsEnabled());
  }, []);

  // Don't render if not in PWA mode
  if (!isPwa) return null;

  const permission = getNotificationPermission();

  const handleToggle = async () => {
    if (!user) return;
    setLoading(true);

    try {
      if (enabled) {
        await disableNotifications(user.uid);
        setEnabled(false);
      } else {
        const result = await requestNotificationPermission(user.uid);
        if (result.success) {
          setEnabled(true);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Not supported on this device
  if (!supported) {
    return (
      <div className="px-3 py-1">
        <div className="d-flex align-items-center gap-2" style={{ fontSize: "0.85rem", ...style }}>
          <NotificationsOffIcon fontSize="small" style={{ opacity: 0.4 }} />
          <span style={{ opacity: 0.5 }}>{t("notifications.notSupported")}</span>
        </div>
      </div>
    );
  }

  // Permission was permanently denied
  if (permission === "denied" && !enabled) {
    return (
      <div className="px-3 py-1">
        <div className="d-flex align-items-center gap-2" style={{ fontSize: "0.85rem", ...style }}>
          <NotificationsOffIcon fontSize="small" style={{ opacity: 0.4 }} />
          <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>{t("notifications.permissionDenied")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-1">
      <div className="d-flex align-items-center gap-2">
        {enabled ? (
          <NotificationsActiveIcon fontSize="small" style={{ color: "#28a745" }} />
        ) : (
          <NotificationsOffIcon fontSize="small" style={{ opacity: 0.5, ...style }} />
        )}
        <span style={{ fontSize: "0.85rem", flex: 1, ...style }}>
          {t("notifications.title")}
        </span>
        {loading ? (
          <Spinner animation="border" size="sm" style={{ width: 16, height: 16 }} />
        ) : (
          <Form.Check
            type="switch"
            id="notification-toggle"
            checked={enabled}
            onChange={handleToggle}
            className="ms-auto"
            style={{ marginBottom: 0 }}
          />
        )}
      </div>
    </div>
  );
}
