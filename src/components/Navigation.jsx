/**
 * @file Navigation.jsx
 * Main navigation bar with theme toggle and mobile menu support.
 */
import React, { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Navbar, Container, Nav } from "react-bootstrap";
import { useTheme } from "../contexts/ThemeContext";

/**
 * Main navigation component with responsive mobile menu and theme switcher.
 * @returns {JSX.Element} Navigation bar
 */
export default function Navigation() {
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const { toggleTheme, isDark } = useTheme();

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

        {/* Theme toggle - always visible on right */}
        <div className="d-flex align-items-center order-2 order-lg-3">
          <button
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label="Toggle theme"
            title={`Switch to ${isDark ? "light" : "dark"} theme`}
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
              to="/"
              onClick={handleNavClick}
              className={location.pathname === "/" ? "active" : ""}
            >
              📊 Classifica
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/schiera"
              onClick={handleNavClick}
              className={location.pathname === "/schiera" ? "active" : ""}
            >
              🏎️ Schiera
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/storico"
              onClick={handleNavClick}
              className={location.pathname === "/storico" ? "active" : ""}
            >
              📜 Storico
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/statistiche"
              onClick={handleNavClick}
              className={location.pathname === "/statistiche" ? "active" : ""}
            >
              📈 Statistiche
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/calcola"
              onClick={handleNavClick}
              className={location.pathname === "/calcola" ? "active" : ""}
            >
              🧮 Calcola Punteggi
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/admin"
              onClick={handleNavClick}
              className={`admin-link ${location.pathname === "/admin" ? "active" : ""}`}
            >
              ⚙️ Admin
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}