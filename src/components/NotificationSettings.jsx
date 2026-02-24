/**
 * @file NotificationSettings.jsx
 * @description Notification toggle for enabling/disabling qualifying reminders.
 * Shows in the user menu; active only when the app is running as an installed PWA
 * and the browser supports push notifications. Shows a helpful message otherwise.
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
 * Always renders when notifications are supported; shows a hint if not in PWA mode.
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
  const [supported, setSupported] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const pwa = isPwaInstalled();
    const sup = isNotificationSupported();
    setIsPwa(pwa);
    setSupported(sup);
    setEnabled(isNotificationsEnabled());
  }, []);

  // Not supported on this device at all
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

  // Supported but NOT in PWA mode — show hint to install
  if (!isPwa) {
    return (
      <div className="px-3 py-1">
        <div className="d-flex align-items-center gap-2" style={{ fontSize: "0.85rem", ...style }}>
          <NotificationsOffIcon fontSize="small" style={{ opacity: 0.4 }} />
          <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>{t("notifications.pwaRequired")}</span>
        </div>
      </div>
    );
  }

  const permission = getNotificationPermission();

  const handleToggle = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      if (enabled) {
        await disableNotifications(user.uid);
        setEnabled(false);
      } else {
        const result = await requestNotificationPermission(user.uid);
        if (result.success) {
          setEnabled(true);
        } else {
          // Show user-visible error so they can diagnose without devtools
          const errorMap = {
            not_supported: t("notifications.notSupported"),
            no_vapid_key: "Config error (VAPID)",
            permission_denied: t("notifications.permissionDenied"),
            no_token: "Token error",
            no_service_worker: "Service worker not available",
          };
          setErrorMsg(errorMap[result.error] || result.error);
        }
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

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
      {errorMsg && (
        <div style={{ fontSize: "0.75rem", color: "#dc3545", marginTop: 2, paddingLeft: 28 }}>
          {errorMsg}
        </div>
      )}
    </div>
  );
}
