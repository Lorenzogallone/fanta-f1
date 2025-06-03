// src/Navigation.jsx
import React, { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Navbar, Container, Nav, Button } from "react-bootstrap";

const accent = "#dc3545";

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  // Mostra il pulsante “Indietro” se non siamo sulla home
  const showBack = location.pathname !== "/";

  // Chiude il menu quando si clicca su una voce (utile su mobile)
  const handleNavClick = () => {
    setExpanded(false);
  };

  return (
    <Navbar
      bg="white"
      variant="light"
      expand="sm"
      expanded={expanded}
      onToggle={(isOpen) => setExpanded(isOpen)}
      collapseOnSelect
      style={{ borderBottom: `3px solid ${accent}` }}
    >
      <Container className="align-items-center">
        {showBack && (
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => navigate(-1)}
            className="me-2 d-flex align-items-center"
          >
            ← Indietro
          </Button>
        )}

        <Navbar.Toggle aria-controls="main-navbar-nav" />

        <Navbar.Collapse id="main-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/classifica" onClick={handleNavClick}>
              Classifica
            </Nav.Link>
            <Nav.Link as={Link} to="/schiera" onClick={handleNavClick}>
              Schiera Formazione
            </Nav.Link>
            <Nav.Link as={Link} to="/calcola" onClick={handleNavClick}>
              Calcola Punteggi
            </Nav.Link>
            <Nav.Link as={Link} to="/storico" onClick={handleNavClick}>
              Storico Gare
            </Nav.Link>
            <Nav.Link as={Link} to="/championship" onClick={handleNavClick}>
              Campionato Piloti &amp; Costruttori
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>

        <Button
          as={Link}
          to="/"
          variant="outline-danger"
          className="ms-auto d-flex align-items-center p-1"
          style={{ borderColor: accent }}
          onClick={() => setExpanded(false)}
        >
          <img
            src="/FantaF1_Logo.png"
            alt="Fanta F1 Logo"
            height="40"
            style={{ objectFit: "contain" }}
          />
        </Button>
      </Container>
    </Navbar>
  );
}