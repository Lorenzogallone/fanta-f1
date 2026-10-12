/**
 * @file Home.jsx
 * @description Home page: next race with the user's lineup status, personal summary,
 * leaderboard and secondary links.
 */

import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Row, Col, Badge } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import Leaderboard from "./Leaderboard";
import { useLanguage } from "../hooks/useLanguage";
import { useAuth } from "../hooks/useAuth";
import { useTimezone } from "../hooks/useTimezone";
import { error } from "../utils/logger";
import { useRacePhoto } from "../hooks/useRacePhoto";
import { useWarm } from "../hooks/useWarm";
import { loadRaces, watchRanking, loadSubmission, submissionKey } from "../services/warmup";
import "../styles/cards.css";
import "../styles/home.css";
import "../styles/racephoto.css";

const ms = (ts) => (ts?.seconds ? ts.seconds * 1000 : null);

/**
 * Formats a time span as "1g 04h 12m" (or "4h 12m", "12m").
 * @param {number} diff - Milliseconds
 * @param {string} dayUnit - Localized day suffix
 * @returns {string} Countdown text
 */
function formatCountdown(diff, dayUnit) {
  const totalMin = Math.max(0, Math.floor(diff / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (d > 0) return `${d}${dayUnit} ${pad(h)}h ${pad(m)}m`;
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${m}m`;
}

/**
 * Current time, refreshed every 30 seconds (drives the countdown).
 * @returns {number} Now in ms
 */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * Lineup status line for one session (main race or sprint).
 */
function LineupStatus({ label, submitted, open }) {
  const { t } = useLanguage();
  const state = submitted ? "done" : open ? "todo" : "missed";
  return (
    <div className={`home-lineup-status is-${state}`}>
      <span className="home-lineup-dot" aria-hidden="true" />
      <span className="home-lineup-label">{label}</span>
      <span className="home-lineup-state">
        {submitted ? t("home.lineupDone") : open ? t("home.lineupTodo") : t("home.lineupMissed")}
      </span>
    </div>
  );
}

LineupStatus.propTypes = {
  label: PropTypes.string.isRequired,
  submitted: PropTypes.bool,
  open: PropTypes.bool,
};

/**
 * Next race card: deadline countdown, lineup status and the main action.
 */
function NextRaceCard({ race, submission, now }) {
  const { t, currentLanguage } = useLanguage();
  const { timezone } = useTimezone();
  const locale = currentLanguage === "en" ? "en-GB" : "it-IT";
  const photo = useRacePhoto(race);
  const navigate = useNavigate();

  if (!race) {
    return (
      <div className="fx-card home-hero">
        <div className="fx-eyebrow">{t("home.nextRace")}</div>
        <h2 className="home-hero-title">{t("home.seasonOver")}</h2>
        <Link to="/history" className="btn btn-outline-danger w-100 mt-3">
          {t("home.viewFantaResults")}
        </Link>
      </div>
    );
  }

  const mainMs = ms(race.qualiUTC);
  const sprintMs = ms(race.qualiSprintUTC);
  const hasSprint = Boolean(race.qualiSprintUTC) && !race.cancelledSprint;
  const mainOpen = mainMs !== null && now < mainMs;
  const sprintOpen = hasSprint && sprintMs !== null && now < sprintMs;
  const mainDone = Boolean(submission?.mainP1);
  const sprintDone = Boolean(submission?.sprintP1);

  // Countdown to the closest deadline that is still open
  const deadlines = [
    sprintOpen && { label: t("home.sprintDeadline"), at: sprintMs },
    mainOpen && { label: t("home.mainDeadline"), at: mainMs },
  ].filter(Boolean).sort((a, b) => a.at - b.at);
  const next = deadlines[0];

  const raceDate = new Date(ms(race.raceUTC)).toLocaleString(locale, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: timezone,
  });

  const anyOpen = mainOpen || sprintOpen;
  const allDone = mainDone && (!hasSprint || sprintDone);
  const actionLabel = !anyOpen
    ? t("home.viewLineup")
    : mainDone || sprintDone
      ? t("home.editFormation")
      : t("home.startLineup");

  return (
    <div
      className={`fx-card home-hero is-link${photo ? " has-photo" : ""}`}
      style={photo ? { "--hero-img": `url("${photo.src}")`, "--hero-pos": photo.pos } : undefined}
      role="link"
      tabIndex={0}
      aria-label={`${race.name}: ${t("raceDetail.details")}`}
      onClick={() => navigate(`/race/${race.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/race/${race.id}`); } }}
    >
      <div className="d-flex align-items-center gap-2">
        <span className="fx-eyebrow">{t("home.nextRace")} · R{race.round}</span>
        {hasSprint && <Badge bg="danger" className="home-sprint-badge">Sprint</Badge>}
        <span className="home-hero-more">{t("raceDetail.details")} ›</span>
      </div>
      <h2 className="home-hero-title">{race.name}</h2>
      <div className="home-hero-date">{raceDate}</div>

      <div className="home-deadline">
        {next ? (
          <>
            <span className="home-deadline-label">{next.label}</span>
            <span className="home-deadline-value">{formatCountdown(next.at - now, t("home.dayUnit"))}</span>
          </>
        ) : (
          <span className="home-deadline-label">{t("home.lineupsClosed")}</span>
        )}
      </div>

      <div className="home-lineup">
        <LineupStatus label={t("calculate.mainRace")} submitted={mainDone} open={mainOpen} />
        {hasSprint && <LineupStatus label="Sprint" submitted={sprintDone} open={sprintOpen} />}
      </div>

      <Link
        to="/lineup"
        className={`btn w-100 mt-3 home-hero-action ${anyOpen && !allDone ? "btn-danger" : "btn-outline-danger"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {actionLabel}
      </Link>
    </div>
  );
}

NextRaceCard.propTypes = {
  race: PropTypes.object,
  submission: PropTypes.object,
  now: PropTypes.number.isRequired,
};

/**
 * "Gran Premio degli Stati Uniti d'America" → "GP Stati Uniti d'America"
 * (also "Grand Prix" in English names), to fit the small summary column.
 */
const shortRaceName = (name = "") =>
  name
    .replace(/^Gran Premio\s+(dell'|dell’|della|delle|degli|del|dei|di|d'|d’)?\s*/i, "GP ")
    .replace(/\s+Grand Prix$/i, " GP");

/**
 * One summary figure: value, label and a short detail line. Every figure has
 * all three lines so the four columns stay aligned.
 */
function SummaryStat({ value, label, detail, tone = "" }) {
  return (
    <div className="home-me-stat">
      <span className={`home-me-value ${tone}`}>{value}</span>
      <span className="fx-eyebrow">{label}</span>
      <span className="home-me-detail">{detail || "\u00a0"}</span>
    </div>
  );
}

SummaryStat.propTypes = {
  value: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  detail: PropTypes.string,
  tone: PropTypes.string,
};

/**
 * Personal summary: position, points, jolly and last race score. Opens the player page.
 */
function MySummary({ me, lastRace, playersCount, leaderPts }) {
  const { t } = useLanguage();
  if (!me) return null;

  const last = lastRace ? me.pointsByRace?.[lastRace.id] : null;
  const lastTotal = last ? (last.mainPts || 0) + (last.sprintPts || 0) : null;
  const tone = (v) => (v > 0 ? "is-pos" : v < 0 ? "is-neg" : "");
  const gap = leaderPts - (me.puntiTotali || 0);

  return (
    <Link to={`/participant/${me.id}`} className="fx-card home-me" aria-label={t("home.mySummary")}>
      <SummaryStat
        value={`${me.position}°`}
        label={t("statistics.position")}
        detail={t("home.ofPlayers", { count: playersCount })}
      />
      <SummaryStat
        value={me.puntiTotali || 0}
        label={t("common.points")}
        detail={gap > 0 ? t("home.fromLeader", { gap }) : t("home.leading")}
      />
      <SummaryStat
        value={me.jolly ?? 0}
        label={t("leaderboard.jokers")}
        detail={t("home.jollyAvailable")}
      />
      <SummaryStat
        value={lastTotal === null ? "—" : lastTotal > 0 ? `+${lastTotal}` : lastTotal}
        label={t("home.lastRace")}
        tone={tone(lastTotal)}
        detail={last ? shortRaceName(lastRace.name) : ""}
      />
      <span className="home-me-chevron" aria-hidden="true">›</span>
    </Link>
  );
}

MySummary.propTypes = {
  me: PropTypes.object,
  lastRace: PropTypes.object,
  playersCount: PropTypes.number,
  leaderPts: PropTypes.number,
};

/**
 * Home page
 * @returns {JSX.Element} Home page
 */
const EMPTY = [];

export default function Home() {
  const { t } = useLanguage();
  const { user, isAdmin } = useAuth();
  const now = useNow();

  // Calendar and live ranking from the warm-up cache (there at first render, refreshed in the background)
  const races = useWarm("races") || EMPTY;
  const ranking = useWarm("ranking") || EMPTY;
  useEffect(() => {
    loadRaces(true).catch(error);
    watchRanking();
  }, []);

  const nextRace = useMemo(
    () => races.find((r) => !r.cancelledMain && ms(r.raceUTC) > now) || null,
    [races, now]
  );
  const lastScoredRace = useMemo(
    () => [...races].reverse().find((r) => r.officialResults && !r.cancelledMain) || null,
    [races]
  );
  // Admin: first race that has started and has no results yet
  const raceToCalculate = useMemo(
    () => races.find((r) => !r.cancelledMain && !r.officialResults && ms(r.raceUTC) <= now) || null,
    [races, now]
  );

  // The user's lineup for the next race
  const nextRaceId = nextRace?.id;
  const submission = useWarm(nextRaceId && user?.uid ? submissionKey(nextRaceId, user.uid) : "") ?? null;
  useEffect(() => {
    if (!nextRaceId || !user?.uid) return;
    loadSubmission(nextRaceId, user.uid, true).catch(error);
  }, [nextRaceId, user?.uid]);

  // Position with ties (competition ranking), as in the leaderboard
  const me = useMemo(() => {
    let pos = 1;
    for (let i = 0; i < ranking.length; i++) {
      if (i > 0 && (ranking[i].puntiTotali || 0) < (ranking[i - 1].puntiTotali || 0)) pos = i + 1;
      if (ranking[i].id === user?.uid) return { ...ranking[i], position: pos };
    }
    return null;
  }, [ranking, user?.uid]);

  const links = [
    { to: "/history", title: t("nav.history"), text: t("home.fantaResultsHint") },
    { to: "/results", title: t("nav.raceResults"), text: t("home.f1Hint") },
    { to: "/statistics", title: t("nav.statistics"), text: t("home.statsHint") },
  ];

  return (
    <div className="fx home-page">
      <Row className="g-3 g-lg-4 justify-content-center">
        <Col xs={12} lg={6} xl={5}>
          <div className="d-flex flex-column gap-3">
            {isAdmin && raceToCalculate && (
              <Link to="/admin" className="home-admin">
                <span className="home-admin-text">
                  <span className="home-admin-eyebrow">{t("home.adminOnly")} · R{raceToCalculate.round}</span>
                  <span className="home-admin-title">{t("home.toCalculate", { race: raceToCalculate.name })}</span>
                </span>
                <span className="home-admin-cta">{t("home.calculateNow")} ›</span>
              </Link>
            )}

            {races.length > 0 && <NextRaceCard race={nextRace} submission={nextRace ? submission : null} now={now} />}

            <MySummary
              me={me}
              lastRace={lastScoredRace}
              playersCount={ranking.length}
              leaderPts={ranking[0]?.puntiTotali || 0}
            />

            <nav className="fx-card home-links d-none d-lg-block">
              {links.map((l) => (
                <Link key={l.to} to={l.to} className="home-link">
                  <span>
                    <span className="home-link-title">{l.title}</span>
                    <span className="home-link-text">{l.text}</span>
                  </span>
                  <span aria-hidden="true">›</span>
                </Link>
              ))}
            </nav>
          </div>
        </Col>

        <Col xs={12} lg={6} xl={5}>
          <Leaderboard />
        </Col>

        {/* Mobile: Risultati Fanta and Mondiale F1 are in the tab bar */}
        <Col xs={12} className="d-lg-none">
          <Link to="/statistics" className="fx-card home-link">
            <span>
              <span className="home-link-title">{t("nav.statistics")}</span>
              <span className="home-link-text">{t("home.statsHint")}</span>
            </span>
            <span aria-hidden="true">›</span>
          </Link>
        </Col>
      </Row>
    </div>
  );
}
