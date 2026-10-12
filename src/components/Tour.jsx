/**
 * @file Tour.jsx
 * @description One-time guided tour: a spotlight moves over the real UI (next
 * race card, tab bar, settings) with a short card per step. Skippable at any
 * point, shown once per device (localStorage), replayable from Io › Impostazioni
 * through the "fantaf1:tour-start" event.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";
import { isSplashActive } from "../utils/splash";
import "../styles/tour.css";

/** Bump to show the tour again after a redesign */
export const TOUR_KEY = "fanta-f1-tour-v1";

const DESKTOP = "(min-width: 992px)";

/**
 * Steps: the first and last have no target (centered card). `target` lists
 * selectors tried in order, so the same step works with the bottom tab bar
 * (phones) and the top navigation (desktop).
 */
const STEPS = [
  { key: "intro" },
  { key: "nextRace", target: [".home-hero"], align: "below" },
  { key: "lineup", target: ['.bottom-tabbar a[href="/lineup"]', '.navbar-modern a[href="/lineup"]'], pad: 10, round: 999 },
  { key: "fanta", target: ['.bottom-tabbar a[href="/history"]', '.navbar-modern a[href="/history"]'] },
  { key: "f1", target: ['.bottom-tabbar a[href="/results"]', '.navbar-modern a[href="/results"]'] },
  { key: "me", target: ['.bottom-tabbar a[href^="/participant/"]', '.navbar-modern a[href^="/participant/"]'] },
  { key: "done" },
];

const seen = () => {
  try { return localStorage.getItem(TOUR_KEY) === "1"; } catch { return true; }
};
const markSeen = () => {
  try { localStorage.setItem(TOUR_KEY, "1"); } catch { /* private mode */ }
};

/** First element matching one of the selectors that is actually displayed */
function findTarget(selectors = []) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.getClientRects().length > 0) return el;
  }
  return null;
}

export default function Tour() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState(-1); // -1: not running
  const [rect, setRect] = useState(null);

  const running = step >= 0;
  const current = running ? STEPS[step] : null;

  // Start once, on the Home, after the splash (also right after the login, when
  // the route changes to the Home); or on request from the settings
  const startedRef = React.useRef(false);
  const onHome = pathname === "/" || pathname === "/leaderboard";
  useEffect(() => {
    if (loading || !user || !onHome || startedRef.current || seen()) return undefined;
    const start = () => {
      startedRef.current = true;
      setTimeout(() => setStep(0), 700);
    };
    if (isSplashActive()) {
      window.addEventListener("fantaf1:splash-hidden", start, { once: true });
      return () => window.removeEventListener("fantaf1:splash-hidden", start);
    }
    start();
    return undefined;
  }, [user, loading, onHome]);

  useEffect(() => {
    const onRequest = () => {
      if (!onHome) navigate("/");
      startedRef.current = true;
      setTimeout(() => setStep(0), 700);
    };
    window.addEventListener("fantaf1:tour-start", onRequest);
    return () => window.removeEventListener("fantaf1:tour-start", onRequest);
  }, [onHome, navigate]);

  // Measure the target of the current step (and follow resizes / scrolls)
  const measure = useCallback(() => {
    if (!current?.target) { setRect(null); return; }
    const el = findTarget(current.target);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    const pad = current.pad ?? 8;
    setRect({
      top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2,
      round: current.round ?? 16,
    });
  }, [current]);

  useLayoutEffect(() => {
    if (!running) return undefined;
    const el = current?.target ? findTarget(current.target) : null;
    if (el && !el.closest(".bottom-tabbar, .navbar-modern")) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    } else if (step === 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    measure();
    const t1 = setTimeout(measure, 350);
    const t2 = setTimeout(measure, 700);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      clearTimeout(t1); clearTimeout(t2);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [running, step, current, measure]);

  // Lock the page scroll while the tour is up
  useEffect(() => {
    if (!running) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [running]);

  const finish = useCallback(() => { markSeen(); setStep(-1); }, []);
  const next = () => (step >= STEPS.length - 1 ? finish() : setStep(step + 1));
  const back = () => setStep(Math.max(0, step - 1));

  useEffect(() => {
    if (!running) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Card position: below the target when there is room, above it otherwise (tab bar)
  const cardStyle = useMemo(() => {
    if (!rect) return undefined;
    const vh = window.innerHeight;
    const below = rect.top + rect.height + 12;
    const isDesktop = window.matchMedia(DESKTOP).matches;
    const placeBelow = current?.align === "below" ? below + 190 < vh : below + 190 < vh && rect.top < vh / 2;
    return placeBelow
      ? { top: below, left: isDesktop ? Math.min(Math.max(16, rect.left), window.innerWidth - 376) : 16 }
      : { bottom: Math.max(12, vh - rect.top + 12), left: isDesktop ? Math.min(Math.max(16, rect.left), window.innerWidth - 376) : 16 };
  }, [rect, current]);

  // Swipe between steps (phones)
  const touch = React.useRef(null);
  const onTouchStart = (e) => { touch.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touch.current == null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    touch.current = null;
    if (dx < -45) next();
    else if (dx > 45 && step > 0) back();
  };

  if (!running) return null;

  const isLast = step === STEPS.length - 1;
  const centered = !current.target || !rect;
  const total = STEPS.length;

  return createPortal(
    <div
      className={`tour${centered ? " is-centered" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("tour.title")}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* The hole in the backdrop: a box with a huge shadow that follows the target */}
      {rect ? (
        <div
          className="tour-spot"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, borderRadius: rect.round }}
        />
      ) : (
        <div className="tour-backdrop" />
      )}

      <div className="tour-card" style={centered ? undefined : cardStyle} key={step}>
        {step === 0 && (
          <div className="tour-badge">{t("tour.badge")}</div>
        )}
        <div className="tour-card-title">{t(`tour.${current.key}Title`)}</div>
        <div className="tour-card-text">{t(`tour.${current.key}Text`)}</div>

        <div className="tour-card-foot">
          <span className="tour-dots" aria-label={`${step + 1}/${total}`}>
            {STEPS.map((s, i) => <span key={s.key} className={`tour-dot${i === step ? " is-on" : ""}`} />)}
          </span>
          <span className="tour-actions">
            {!isLast && (
              <button type="button" className="tour-skip" onClick={finish}>{t("tour.skip")}</button>
            )}
            {step > 0 && !isLast && (
              <button type="button" className="tour-btn is-ghost" onClick={back} aria-label={t("common.back")}>‹</button>
            )}
            <button type="button" className="tour-btn" onClick={next}>
              {step === 0 ? t("tour.start") : isLast ? t("tour.finish") : t("tour.next")}
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
