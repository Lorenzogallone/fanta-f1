/**
 * @file BottomTabBar.jsx
 * Mobile / PWA bottom navigation (hidden on desktop, where the top navbar shows the links).
 */
import React from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { useAuth } from "../hooks/useAuth";
import "../styles/tabbar.css";

/**
 * Minimal stroke icons (24x24, currentColor).
 */
const ICONS = {
  home: (
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  ),
  lineup: (
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  ),
  fanta: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  f1: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h13l-2 4 2 4H5" />
    </>
  ),
  me: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
};

function TabIcon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

TabIcon.propTypes = {
  name: PropTypes.oneOf(Object.keys(ICONS)).isRequired,
};

/**
 * Bottom tab bar: Home · Schiera · Risultati Fanta · Mondiale F1 · Io
 * @returns {JSX.Element|null} Tab bar
 */
export default function BottomTabBar() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (pathname === "/login" || !user) return null;

  const myPage = `/participant/${user.uid}`;
  const tabs = [
    { to: "/", icon: "home", label: t("nav.home"), match: ["/", "/leaderboard", "/classifica"] },
    { to: "/lineup", icon: "lineup", label: t("nav.formations"), match: ["/lineup", "/schiera", "/formations"] },
    { to: "/history", icon: "fanta", label: t("nav.history"), match: ["/history", "/storico"] },
    { to: "/results", icon: "f1", label: t("nav.raceResults"), match: ["/results", "/risultati"] },
    { to: myPage, icon: "me", label: t("nav.me"), match: [myPage, `/partecipante/${user.uid}`, "/profile", "/profilo"] },
  ];

  const isActive = (match) =>
    match.some((m) => (m === "/" ? pathname === "/" : pathname === m || pathname.startsWith(`${m}/`)));

  const bar = (
    <nav className="bottom-tabbar d-lg-none" aria-label={t("nav.home")}>
      {tabs.map((tab) => {
        const active = isActive(tab.match);
        return (
          <Link
            key={tab.icon}
            to={tab.to}
            className={`bottom-tabbar-item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <TabIcon name={tab.icon} />
            <span className="bottom-tabbar-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Keeps the page content clear of the fixed bar */}
      <div className="bottom-tabbar-spacer d-lg-none" aria-hidden="true" />
      {/* Rendered into <body> so no ancestor (transform, filter, overflow)
          can turn position: fixed into "scrolls with the page" */}
      {createPortal(bar, document.body)}
    </>
  );
}
