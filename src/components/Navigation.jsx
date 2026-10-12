/**
 * @file Navigation.jsx
 * Top bar: logo, plus the section links on desktop. On mobile the sections are in the
 * bottom tab bar (BottomTabBar.jsx); profile, settings, admin pages and logout live in
 * the "Io" tab (AccountPanel.jsx).
 */
import React from "react";
import { useLocation, Link } from "react-router-dom";
import { Navbar, Container, Nav } from "react-bootstrap";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../hooks/useLanguage";
import { useAuth } from "../hooks/useAuth";

/**
 * Main navigation bar.
 * @returns {JSX.Element|null} Navigation bar
 */
export default function Navigation() {
  const location = useLocation();
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const { user, isAdmin } = useAuth();

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";

  // Don't show nav on login page
  if (location.pathname === "/login") return null;

  const isActive = (paths) => paths.includes(location.pathname);
  const myPage = user ? `/participant/${user.uid}` : null;

  const desktopLinks = [
    { to: "/", label: t("nav.home"), paths: ["/", "/leaderboard", "/classifica"] },
    { to: "/lineup", label: t("nav.formations"), paths: ["/lineup", "/schiera"] },
    { to: "/history", label: t("nav.history"), paths: ["/history", "/storico"] },
    { to: "/results", label: t("nav.raceResults"), paths: ["/results", "/risultati"] },
    { to: "/statistics", label: t("nav.statistics"), paths: ["/statistics", "/statistiche"] },
    ...(isAdmin ? [{ to: "/admin", label: t("nav.admin"), paths: ["/admin"] }] : []),
    ...(myPage
      ? [{ to: myPage, label: t("nav.me"), paths: [myPage, `/partecipante/${user.uid}`, "/profile", "/profilo"] }]
      : []),
  ];

  return (
    <Navbar
      className="navbar-modern sticky-top"
      style={{ borderBottom: `2px solid ${accentColor}` }}
    >
      <Container fluid className="px-3 px-lg-4 position-relative">
        {/* Logo: centered on mobile, left on desktop */}
        <Link
          to="/"
          className="navbar-brand logo-wrapper d-flex align-items-center mx-auto ms-lg-0 me-lg-0"
          style={{ textDecoration: "none" }}
          aria-label="Fanta F1 home page"
        >
          <img
            src={isDark ? "/FantaF1_Logo_dark.webp" : "/FantaF1_Logo.webp"}
            alt="Fanta F1 Fantasy Formula 1 logo"
            height="32"
            style={{ objectFit: "contain", margin: "4px 0" }}
          />
        </Link>

        {/* Desktop links (mobile uses the bottom tab bar) */}
        <Nav className="mx-auto d-none d-lg-flex">
          {desktopLinks.map((l) => (
            <Nav.Link
              key={l.to}
              as={Link}
              to={l.to}
              className={isActive(l.paths) ? "active" : ""}
            >
              {l.label}
            </Nav.Link>
          ))}
        </Nav>

        {/* Admins only: one tap to the admin hub (mobile; desktop has the link) */}
        {isAdmin && (
          <Link
            to="/admin"
            className={`navbar-admin-btn d-lg-none${isActive(["/admin"]) ? " is-active" : ""}`}
            aria-label={t("nav.admin")}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        )}
      </Container>
    </Navbar>
  );
}
