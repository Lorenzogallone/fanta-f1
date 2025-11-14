/**
 * @file Navigation.jsx
 * Main navigation bar with theme toggle, language selector, and mobile menu support.
 */
import React, { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Navbar, Container, Nav, Dropdown } from "react-bootstrap";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * Main navigation component with responsive mobile menu, theme switcher, and language selector.
 * @returns {JSX.Element} Navigation bar
 */
export default function Navigation() {
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const { toggleTheme, isDark } = useTheme();
  const { currentLanguage, changeLanguage, availableLanguages, t } = useLanguage();

  /**
   * Closes mobile menu when a nav item is clicked.
   */
  const handleNavClick = () => {
    setExpanded(false);
  };

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgColor = isDark ? "#1a1a1a" : "#ffffff";

  return (
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
          className="border-0 me-2 order-0"
        />

        {/* Logo - centered on mobile */}
        <Link
          to="/"
          onClick={() => setExpanded(false)}
          className="navbar-brand logo-wrapper d-flex align-items-center mx-auto mx-lg-0 order-1 order-lg-1"
          style={{ textDecoration: "none" }}
        >
          <img
            src={isDark ? "/FantaF1_Logo_dark.png" : "/FantaF1_Logo.png"}
            alt="Fanta F1"
            height="45"
            style={{ objectFit: "contain" }}
          />
        </Link>

        {/* Theme toggle and language selector - always visible on right */}
        <div className="d-flex align-items-center gap-1 order-2 order-lg-3">
          {/* Language Selector */}
          <Dropdown align="end">
            <Dropdown.Toggle
              variant="link"
              className="p-0 border-0 shadow-none text-decoration-none"
              style={{
                fontSize: "1.2rem",
                lineHeight: 1,
                color: "inherit",
              }}
              title={t("nav.changeLanguage")}
            >
              {availableLanguages.find((lang) => lang.code === currentLanguage)?.flag || "🌐"}
            </Dropdown.Toggle>

            <Dropdown.Menu>
              {availableLanguages.map((lang) => (
                <Dropdown.Item
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  active={currentLanguage === lang.code}
                >
                  <span className="me-2">{lang.flag}</span>
                  {lang.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label={t("nav.toggleTheme")}
            title={`Switch to ${isDark ? "light" : "dark"} theme`}
            style={{
              transform: "scale(0.85)",
            }}
          >
            <div className="theme-toggle-slider">
              {isDark ? "🌙" : "☀️"}
            </div>
          </button>
        </div>

        {/* Collapsible menu */}
        <Navbar.Collapse id="main-navbar-nav" className="order-3 order-lg-2">
          <Nav className="mx-auto">
            <Nav.Link
              as={Link}
              to="/leaderboard"
              onClick={handleNavClick}
              className={location.pathname === "/leaderboard" ? "active" : ""}
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
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}