/**
 * @file Navigation.jsx
 * Main navigation bar with theme toggle, language selector, auth state, and mobile menu support.
 */
import React, { useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { Navbar, Container, Nav, Dropdown, Modal, Button } from "react-bootstrap";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../hooks/useLanguage";
import { useAuth } from "../hooks/useAuth";
import UserAvatar from "./UserAvatar";

/**
 * Main navigation component with responsive mobile menu, theme switcher, language selector, and auth controls.
 * @returns {JSX.Element} Navigation bar
 */
export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { toggleTheme, isDark, themeMode } = useTheme();
  const { currentLanguage, changeLanguage, availableLanguages, t } = useLanguage();
  const { user, userProfile, isAdmin, logout } = useAuth();

  const handleNavClick = () => {
    setExpanded(false);
  };

  const handleLogoutRequest = () => {
    setExpanded(false);
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutConfirm(false);
    await logout();
    navigate("/login");
  };

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgColor = isDark ? "#1a1a1a" : "#ffffff";
  const menuBg = isDark ? "#1a1a1a" : "#ffffff";
  const menuBorder = isDark ? "#333333" : "#dee2e6";
  const textColor = isDark ? "#ffffff" : "#212529";
  const mutedColor = isDark ? "#aaa" : "#6c757d";

  // Don't show nav on login page
  if (location.pathname === "/login") return null;

  const logoutConfirmModal = (
    <Modal show={showLogoutConfirm} onHide={() => setShowLogoutConfirm(false)} centered size="sm">
      <Modal.Header className="border-0 pb-0">
        <Modal.Title style={{ fontSize: "1rem" }}>{t("auth.logout")}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="pt-1" style={{ fontSize: "0.9rem" }}>
        {t("auth.logoutConfirm")}
      </Modal.Body>
      <Modal.Footer className="border-0 pt-1 gap-2">
        <Button variant="outline-secondary" size="sm" onClick={() => setShowLogoutConfirm(false)}>
          {t("common.cancel")}
        </Button>
        <Button variant="danger" size="sm" onClick={handleLogoutConfirm}>
          {t("auth.logout")}
        </Button>
      </Modal.Footer>
    </Modal>
  );

  return (
    <>
    {logoutConfirmModal}
    <Navbar
      expand="lg"
      expanded={expanded}
      onToggle={(isOpen) => setExpanded(isOpen)}
      className="navbar-modern shadow-sm"
      style={{
        backgroundColor: bgColor,
        borderBottom: `3px solid ${accentColor}`,
      }}
    >
      <Container fluid className="px-3 px-lg-4">
        {/* Hamburger menu - mobile only, left side */}
        <Navbar.Toggle
          aria-controls="main-navbar-nav"
          aria-label="Toggle navigation menu"
          className="border-0 me-2 order-0"
          style={{ transform: "scale(0.85)" }}
        />

        {/* Logo - centered on mobile */}
        <Link
          to="/"
          onClick={() => setExpanded(false)}
          className="navbar-brand logo-wrapper d-flex align-items-center mx-auto mx-lg-0 order-1 order-lg-1"
          style={{ textDecoration: "none" }}
          aria-label="Fanta F1 home page"
        >
          <img
            src={isDark ? "/FantaF1_Logo_dark.webp" : "/FantaF1_Logo.webp"}
            alt="Fanta F1 Fantasy Formula 1 logo"
            height="45"
            style={{ objectFit: "contain" }}
          />
        </Link>

        {/* Right side: unified user menu */}
        <div className="d-flex align-items-center order-2 order-lg-3">
          <Dropdown align="end">
            <Dropdown.Toggle
              variant="link"
              className="user-menu-toggle p-0 border-0 shadow-none text-decoration-none d-flex align-items-center gap-2"
              style={{ color: textColor }}
            >
              <UserAvatar
                photoURL={userProfile?.photoURL}
                name={userProfile?.nickname || user?.email}
                size={34}
              />
              <span
                className="d-none d-md-inline"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  maxWidth: "120px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {userProfile?.nickname || user?.email || ""}
              </span>
            </Dropdown.Toggle>

            <Dropdown.Menu
              className="user-menu-dropdown shadow-sm"
              style={{
                backgroundColor: menuBg,
                border: `1px solid ${menuBorder}`,
                borderRadius: "8px",
                padding: "0.4rem 0",
                minWidth: "200px",
              }}
            >
              {/* User info header */}
              {user && (
                <>
                  <div style={{ padding: "0.5rem 1rem" }}>
                    <div className="d-flex align-items-center gap-2">
                      <UserAvatar
                        photoURL={userProfile?.photoURL}
                        name={userProfile?.nickname || user?.email}
                        size={28}
                      />
                      <div>
                        <div style={{ fontWeight: 600, color: textColor, fontSize: "0.9rem" }}>
                          {userProfile?.nickname || "User"}
                          {isAdmin && (
                            <span
                              className="ms-2"
                              style={{
                                fontSize: "0.6rem",
                                color: "#fff",
                                backgroundColor: accentColor,
                                borderRadius: "3px",
                                padding: "1px 4px",
                                fontWeight: 700,
                                verticalAlign: "middle",
                              }}
                            >
                              Admin
                            </span>
                          )}
                        </div>
                        <div style={{ color: mutedColor, fontSize: "0.78rem" }}>
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Dropdown.Divider style={{ borderColor: menuBorder, margin: "0.25rem 0" }} />
                </>
              )}

              {/* My Profile link */}
              <Dropdown.Item
                as={Link}
                to="/profile"
                style={{ color: textColor, fontSize: "0.85rem" }}
                className="user-menu-item"
              >
                👤 {t("nav.myProfile")}
              </Dropdown.Item>

              {/* Theme - single toggle button with emoji */}
              <Dropdown.Item
                as="div"
                className="px-3 py-1"
                style={{ backgroundColor: "transparent" }}
              >
                <div className="d-flex align-items-center gap-2">
                  <span style={{ color: textColor, fontSize: "0.85rem" }}>{t("nav.toggleTheme")}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTheme();
                    }}
                    className="btn btn-sm p-0 ms-auto"
                    style={{
                      fontSize: "1.3rem",
                      width: 36,
                      height: 36,
                      lineHeight: "36px",
                      textAlign: "center",
                      borderRadius: "6px",
                      border: `1px solid ${menuBorder}`,
                      backgroundColor: "transparent",
                    }}
                    title={themeMode === "auto" ? "Auto" : themeMode === "light" ? "Light" : "Dark"}
                    aria-label="Toggle theme"
                  >
                    {themeMode === "light" ? "☀️" : themeMode === "dark" ? "🌙" : "🌗"}
                  </button>
                </div>
              </Dropdown.Item>

              {/* Language */}
              <Dropdown.Item
                as="div"
                className="px-3 py-1"
                style={{ backgroundColor: "transparent" }}
              >
                <div className="d-flex align-items-center gap-2">
                  <span style={{ color: textColor, fontSize: "0.85rem" }}>{t("nav.changeLanguage")}</span>
                  <div className="d-flex gap-1 ms-auto">
                    {availableLanguages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => changeLanguage(lang.code)}
                        className="btn btn-sm p-0"
                        style={{
                          fontSize: "1.1rem",
                          width: 28,
                          height: 28,
                          lineHeight: "28px",
                          textAlign: "center",
                          borderRadius: "4px",
                          border: currentLanguage === lang.code
                            ? `2px solid ${accentColor}`
                            : `1px solid transparent`,
                          backgroundColor: "transparent",
                          opacity: currentLanguage === lang.code ? 1 : 0.5,
                        }}
                        title={lang.name}
                        aria-label={lang.name}
                      >
                        {lang.flag}
                      </button>
                    ))}
                  </div>
                </div>
              </Dropdown.Item>

              <Dropdown.Divider style={{ borderColor: menuBorder, margin: "0.25rem 0" }} />

              {/* Logout */}
              {user && (
                <Dropdown.Item
                  onClick={handleLogoutRequest}
                  style={{ color: accentColor, fontSize: "0.85rem", fontWeight: 500 }}
                  className="user-menu-item"
                >
                  {t("auth.logout")}
                </Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown>
        </div>

        {/* Collapsible menu */}
        <Navbar.Collapse id="main-navbar-nav" className="order-3 order-lg-2">
          <Nav className="mx-auto">
            <Nav.Link
              as={Link}
              to="/"
              onClick={handleNavClick}
              className={location.pathname === "/" ? "active" : ""}
            >
              📊 {t("nav.leaderboard")}
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/lineup"
              onClick={handleNavClick}
              className={location.pathname === "/lineup" ? "active" : ""}
            >
              🏎️ {t("nav.formations")}
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/history"
              onClick={handleNavClick}
              className={location.pathname === "/history" ? "active" : ""}
            >
              📜 {t("nav.history")}
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/results"
              onClick={handleNavClick}
              className={location.pathname === "/results" ? "active" : ""}
            >
              🏁 {t("nav.raceResults")}
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/statistics"
              onClick={handleNavClick}
              className={location.pathname === "/statistics" ? "active" : ""}
            >
              📈 {t("nav.statistics")}
            </Nav.Link>
            {isAdmin && (
              <>
                <Nav.Link
                  as={Link}
                  to="/calculate"
                  onClick={handleNavClick}
                  className={location.pathname === "/calculate" ? "active" : ""}
                >
                  🧮 {t("nav.calculatePoints")}
                </Nav.Link>
                <Nav.Link
                  as={Link}
                  to="/admin"
                  onClick={handleNavClick}
                  className={`admin-link ${location.pathname === "/admin" ? "active" : ""}`}
                >
                  ⚙️ {t("nav.admin")}
                </Nav.Link>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
    </>
  );
}
