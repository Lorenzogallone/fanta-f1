/**
 * @file AccountPanel.jsx
 * Account section of the user's own page ("Io" tab): profile and settings,
 * statistics, admin pages and logout. Replaces the old avatar menu in the navbar.
 */
import React, { useState } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import { Modal, Button } from "react-bootstrap";
import { useLanguage } from "../hooks/useLanguage";
import { useAuth } from "../hooks/useAuth";

function AccountLink({ to, title, text }) {
  return (
    <Link to={to} className="account-row">
      <span>
        <span className="account-row-title">{title}</span>
        {text && <span className="account-row-text">{text}</span>}
      </span>
      <span className="account-row-chevron" aria-hidden="true">›</span>
    </Link>
  );
}

AccountLink.propTypes = {
  to: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  text: PropTypes.string,
};

/**
 * @returns {JSX.Element} Account panel
 */
export default function AccountPanel() {
  const { t } = useLanguage();
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleLogout = async () => {
    setConfirmLogout(false);
    await logout();
    navigate("/login");
  };

  return (
    <>
      <div className="fx-card account-panel">
        {user?.email && <div className="account-email">{user.email}</div>}
        <AccountLink to="/profile" title={t("account.profileSettings")} text={t("account.profileSettingsHint")} />
        <AccountLink to="/statistics" title={t("nav.statistics")} text={t("home.statsHint")} />
        {isAdmin && <AccountLink to="/admin" title={t("nav.admin")} text={t("account.adminHint")} />}
        <button
          type="button"
          className="account-row"
          onClick={() => window.dispatchEvent(new Event("fantaf1:tour-start"))}
        >
          <span>
            <span className="account-row-title">{t("tour.replay")}</span>
            <span className="account-row-text">{t("tour.replayHint")}</span>
          </span>
          <span className="account-row-chevron" aria-hidden="true">›</span>
        </button>
        <button type="button" className="account-row account-logout" onClick={() => setConfirmLogout(true)}>
          {t("auth.logout")}
        </button>
      </div>

      <Modal show={confirmLogout} onHide={() => setConfirmLogout(false)} centered size="sm">
        <Modal.Header className="border-0 pb-0">
          <Modal.Title style={{ fontSize: "1rem" }}>{t("auth.logout")}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-1" style={{ fontSize: "0.9rem" }}>
          {t("auth.logoutConfirm")}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="outline-secondary" onClick={() => setConfirmLogout(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={handleLogout}>
            {t("auth.logout")}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
