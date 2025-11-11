// src/Navigation.jsx
import React, { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Navbar, Container, Nav, Button } from "react-bootstrap";
import { useTheme } from "../contexts/ThemeContext";

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const { theme, toggleTheme, isDark } = useTheme();

  // Mostra il pulsante "Indietro" se non siamo sulla home
  const showBack = location.pathname !== "/";

  // Chiude il menu quando si clicca su una voce (utile su mobile)
  const handleNavClick = () => {
    setExpanded(false);
  };

  return (
    <Navbar
      expand="lg"
      expanded={expanded}
      onToggle={(isOpen) => setExpanded(isOpen)}
      collapseOnSelect
      className="navbar-modern shadow-sm"
      style={{
        backgroundColor: isDark ? "#1a1a1a" : "#ffffff",
        borderBottom: `3px solid ${isDark ? "#ff4d5a" : "#dc3545"}`,
      }}
    >
      <Container fluid className="px-3 px-lg-4">
        <div className="d-flex align-items-center gap-2">
          {/* Back Button */}
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="back-button"
              style={{ fontSize: "0.9rem" }}
            >
              <span>←</span>
              <span className="d-none d-sm-inline">Indietro</span>
            </button>
          )}

          {/* Logo */}
          <Link
            to="/"
            onClick={() => setExpanded(false)}
            className="logo-wrapper d-flex align-items-center"
            style={{ textDecoration: "none" }}
          >
            <img
              src="/FantaF1_Logo.png"
              alt="Fanta F1"
              height="45"
              style={{ objectFit: "contain" }}
            />
          </Link>
        </div>

        {/* Toggle Button per mobile */}
        <Navbar.Toggle aria-controls="main-navbar-nav" className="border-0" />

        <Navbar.Collapse id="main-navbar-nav">
          <Nav className="mx-auto">
            <Nav.Link
              as={Link}
              to="/classifica"
              onClick={handleNavClick}
              className={location.pathname === "/classifica" ? "active" : ""}
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
              to="/calcola"
              onClick={handleNavClick}
              className={location.pathname === "/calcola" ? "active" : ""}
            >
              🧮 Calcola
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
              to="/championship"
              onClick={handleNavClick}
              className={location.pathname === "/championship" ? "active" : ""}
            >
              🏆 Campionato
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

          {/* Theme Toggle */}
          <div className="d-flex align-items-center gap-2 ms-lg-3">
            <button
              onClick={toggleTheme}
              className="theme-toggle"
              aria-label="Toggle theme"
              title={`Passa a tema ${isDark ? "chiaro" : "scuro"}`}
            >
              <div className="theme-toggle-slider">
                {isDark ? "🌙" : "☀️"}
              </div>
            </button>
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}