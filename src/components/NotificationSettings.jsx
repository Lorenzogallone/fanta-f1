/**
 * @file NotificationSettings.jsx
 * @description Notification toggle for enabling/disabling qualifying reminders.
 * Shows in the user menu; active only when the app is running as an installed PWA
 * and the browser supports push notifications. Shows a helpful message otherwise.
 */

import React, { useState, useEffect } from "react";
import { Form, Spinner } from "react-bootstrap";

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
