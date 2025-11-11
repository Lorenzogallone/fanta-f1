// src/Navigation.jsx
import React, { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Navbar, Container, Nav } from "react-bootstrap";
import { useTheme } from "../contexts/ThemeContext";

export default function Navigation() {
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const { toggleTheme, isDark } = useTheme();

  // Chiude il menu quando si clicca su una voce (utile su mobile)
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
        {/* Hamburger Menu - Solo mobile, a sinistra */}
        <Navbar.Toggle
          aria-controls="main-navbar-nav"
          className="border-0 me-2 order-0"
        />

        {/* Logo - Centrato su mobile */}
        <Link
          to="/"
          onClick={() => setExpanded(false)}
          className="navbar-brand logo-wrapper d-flex align-items-center mx-auto mx-lg-0 order-1 order-lg-1"
          style={{ textDecoration: "none" }}
        >
          <img
            src="/FantaF1_Logo.png"
            alt="Fanta F1"
            height="45"
            style={{
              objectFit: "contain",
              filter: isDark ? "invert(1) hue-rotate(180deg) brightness(1.1)" : "none"
            }}
          />
        </Link>

        {/* Theme Toggle - Sempre visibile a destra */}
        <div className="d-flex align-items-center order-2 order-lg-3">
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

        {/* Menu Collassabile */}
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
              to="/championship"
              onClick={handleNavClick}
              className={location.pathname === "/championship" ? "active" : ""}
            >
              🏆 Schiera Campionato
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