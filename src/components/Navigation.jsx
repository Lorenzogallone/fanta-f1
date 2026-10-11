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
  const bgColor = isDark ? "#1a1a1a" : "#ffffff";

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
    ...(isAdmin
      ? [
          { to: "/calculate", label: t("nav.calculatePoints"), paths: ["/calculate", "/calcola"] },
          { to: "/admin", label: t("nav.admin"), paths: ["/admin"] },
        ]
      : []),
    ...(myPage
      ? [{ to: myPage, label: t("nav.me"), paths: [myPage, `/partecipante/${user.uid}`, "/profile", "/profilo"] }]
      : []),
  ];

  return (
    <Navbar
      className="navbar-modern sticky-top"
      style={{
        backgroundColor: bgColor,
        borderBottom: `2px solid ${accentColor}`,
      }}
    >
      <Container fluid className="px-3 px-lg-4">
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
            height="40"
            style={{ objectFit: "contain" }}
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
      </Container>
    </Navbar>
  );
}
