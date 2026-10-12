/**
 * @file RaceDetail.jsx
 * @description Race weekend page: circuit and place, every session with its local
 * time and state (finished / live / countdown), results of the sessions already
 * run, the user's lineup deadlines, a few circuit facts and last year's winner.
 * Data: the race doc, the official calendar and results (Jolpica, cached by the
 * warm-up), src/data/circuits.js for what the API doesn't have.
 */

import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge } from "react-bootstrap";
import { useLanguage } from "../hooks/useLanguage";
import { useAuth } from "../hooks/useAuth";
import { useTimezone } from "../hooks/useTimezone";
import { useF1Data } from "../hooks/useF1Data";
import { useRacePhoto } from "../hooks/useRacePhoto";
import { useWarm } from "../hooks/useWarm";
import {
  loadRaces, loadRaceInfo, loadSessions, loadPrevWinner, loadSubmission,
  raceInfoKey, sessionsKey, submissionKey,
} from "../services/warmup";
import { CIRCUIT_FACTS, COUNTRY_FLAGS } from "../data/circuits";
import { error } from "../utils/logger";
import "../styles/cards.css";
import "../styles/racedetail.css";

const ms = (ts) => (ts?.seconds ? ts.seconds * 1000 : null);

/** How long a session runs, to show it as "live" (minutes) */
const DURATION_MIN = { fp1: 60, fp2: 60, fp3: 60, sprintQualifying: 45, sprint: 40, qualifying: 60, race: 120 };

/** Sessions that have results in the Jolpica feed */
const RESULT_SESSIONS = ["sprintQualifying", "sprint", "qualifying", "race"];

/**
 * "2g 03h" / "3h 12m" / "12m"
 * @param {number} diff - ms
 * @param {string} dayUnit - localized day suffix
 */
function countdown(diff, dayUnit) {
  const totalMin = Math.max(0, Math.floor(diff / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (d > 0) return `${d}${dayUnit} ${pad(h)}h`;
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${m}m`;
}

/** Current time, refreshed every 30 s */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Driver name with the team logo */
function Driver({ name }) {
  const { getDriverLogo } = useF1Data();
  const logo = getDriverLogo(name);
  return (
    <span className="race-driver">
      {logo && <img src={logo} alt="" loading="lazy" />}
      <span className="text-truncate">{name}</span>
    </span>
  );
}

Driver.propTypes = { name: PropTypes.string.isRequired };

/** Top three of a session (pole time for qualifying) */
function Podium({ rows, withTime }) {
  return (
    <ol className="race-podium">
      {rows.slice(0, 3).map((r) => (
        <li key={r.position}>
          <span className="race-podium-pos">{r.position}</span>
          <Driver name={r.driver} />
          {withTime && <span className="race-podium-time">{r.q3 !== "—" ? r.q3 : r.q2 !== "—" ? r.q2 : r.q1}</span>}
        </li>
      ))}
    </ol>
  );
}

Podium.propTypes = { rows: PropTypes.array.isRequired, withTime: PropTypes.bool };

export default function RaceDetail() {
  const { raceId } = useParams();
  const { t, currentLanguage } = useLanguage();
  const { user } = useAuth();
  const { timezone } = useTimezone();
  const navigate = useNavigate();
  const now = useNow();
  const locale = currentLanguage === "en" ? "en-GB" : "it-IT";

  const races = useWarm("races");
  const race = useMemo(() => (races || []).find((r) => r.id === raceId) || null, [races, raceId]);
  const photo = useRacePhoto(race);
  const info = useWarm(race ? raceInfoKey(race) : "");
  const sessionData = useWarm(race ? sessionsKey(race) : "");
  const submission = useWarm(race && user?.uid ? submissionKey(race.id, user.uid) : "") ?? null;
  const season = race ? race.raceUTC.toDate().getFullYear() : null;
  const prevWinner = useWarm(info?.circuitId ? `prevWinner:${info.circuitId}:${season - 1}` : "");

  useEffect(() => { loadRaces(true).catch(error); }, []);
  useEffect(() => {
    if (!race) return;
    loadRaceInfo(race, true).catch(error);
    loadSessions(race, true).catch(error);
    if (user?.uid) loadSubmission(race.id, user.uid, true).catch(error);
  }, [race, user?.uid]);
  useEffect(() => {
    if (info?.circuitId) loadPrevWinner(info.circuitId, season - 1).catch(error);
  }, [info?.circuitId, season]);

  // Sessions: the official calendar when loaded, else what the race doc knows
  const sessions = useMemo(() => {
    if (!race) return [];
    if (info?.sessions?.length) return info.sessions;
    return [
      race.qualiSprintUTC && { key: "sprintQualifying", at: ms(race.qualiSprintUTC) },
      race.sprintUTC && { key: "sprint", at: ms(race.sprintUTC) },
      { key: "qualifying", at: ms(race.qualiUTC) },
      { key: "race", at: ms(race.raceUTC) },
    ].filter((s) => s && s.at).sort((a, b) => a.at - b.at);
  }, [race, info]);

  if (!races) return null;
  if (!race) {
    return (
      <div className="fx race-page">
        <div className="fx-card race-empty">{t("raceDetail.notFound")}</div>
      </div>
    );
  }

  const hasSprint = Boolean(race.qualiSprintUTC) && !race.cancelledSprint;
  const flag = COUNTRY_FLAGS[info?.country] || "";
  const place = [info?.locality, info?.country].filter(Boolean).join(", ");
  const facts = CIRCUIT_FACTS[info?.circuitId] || null;
  const fmtDay = (at) => new Date(at).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: timezone });
  const fmtTime = (at) => new Date(at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  const raceDate = new Date(ms(race.raceUTC)).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", timeZone: timezone });

  const stateOf = (s) => {
    const end = s.at + (DURATION_MIN[s.key] || 60) * 60000;
    if (now >= end) return "done";
    if (now >= s.at) return "live";
    return "upcoming";
  };

  // Lineup deadlines
  const mainMs = ms(race.qualiUTC);
  const sprintMs = ms(race.qualiSprintUTC);
  const lineups = [
    { label: t("calculate.mainRace"), at: mainMs, done: Boolean(submission?.mainP1) },
    ...(hasSprint ? [{ label: "Sprint", at: sprintMs, done: Boolean(submission?.sprintP1) }] : []),
  ].map((l) => ({ ...l, open: l.at !== null && now < l.at }));
  const anyOpen = lineups.some((l) => l.open && !l.done);

  return (
    <div className="fx race-page">
      <div className="race-top">
        <button type="button" className="race-back" onClick={() => navigate(-1)} aria-label={t("common.back")}>‹</button>
        <span className="fx-eyebrow">R{race.round} · {season}</span>
      </div>

      {/* Hero */}
      <section
        className={`fx-card race-hero${photo ? " has-photo" : ""}`}
        style={photo ? { "--hero-img": `url("${photo.src}")`, "--hero-pos": photo.pos } : undefined}
      >
        <div className="race-hero-place">
          {flag && <span className="race-flag" aria-hidden="true">{flag}</span>}
          <span>{place || " "}</span>
          {hasSprint && <Badge bg="danger" className="race-sprint-badge">Sprint</Badge>}
        </div>
        <h1 className="race-hero-title">{race.name}</h1>
        <div className="race-hero-sub">{info?.circuitName || " "}</div>
        <div className="race-hero-date">{raceDate}</div>
      </section>

      {/* Schedule */}
      <section className="fx-card race-card">
        <div className="race-card-head">
          <h2 className="fx-card-title">{t("raceDetail.schedule")}</h2>
          <span className="race-card-hint">{t("raceDetail.timesIn")} {timezone.split("/").pop().replace("_", " ")}</span>
        </div>
        <ul className="race-sessions">
          {sessions.map((s) => {
            const state = stateOf(s);
            const results = RESULT_SESSIONS.includes(s.key) ? sessionData?.[s.key] : null;
            return (
              <li key={s.key} className={`race-session is-${state}`}>
                <div className="race-session-row">
                  <span className="race-session-name">
                    {t(`raceDetail.${s.key}`)}
                    <span className="race-session-day">{fmtDay(s.at)}</span>
                  </span>
                  <span className="race-session-time">{fmtTime(s.at)}</span>
                  <span className="race-session-state">
                    {state === "live" && <span className="race-live-dot" aria-hidden="true" />}
                    {state === "done" ? t("raceDetail.done") : state === "live" ? t("raceDetail.live") : `${t("raceDetail.startsIn")} ${countdown(s.at - now, t("home.dayUnit"))}`}
                  </span>
                </div>
                {results?.length > 0 && <Podium rows={results} withTime={s.key === "qualifying" || s.key === "sprintQualifying"} />}
              </li>
            );
          })}
        </ul>
        {sessions.some((s) => stateOf(s) === "done" && RESULT_SESSIONS.includes(s.key)) && (
          <Link to="/results" className="race-card-link">{t("raceDetail.allResults")} ›</Link>
        )}
      </section>

      {/* Lineups */}
      <section className="fx-card race-card">
        <div className="race-card-head">
          <h2 className="fx-card-title">{t("raceDetail.yourLineups")}</h2>
        </div>
        <ul className="race-lineups">
          {lineups.map((l) => {
            const state = l.done ? "done" : l.open ? "todo" : "missed";
            return (
              <li key={l.label} className={`race-lineup is-${state}`}>
                <span className="race-lineup-dot" aria-hidden="true" />
                <span className="race-lineup-label">{l.label}</span>
                <span className="race-lineup-when">
                  {l.open
                    ? `${t("raceDetail.deadline")} ${t("raceDetail.startsIn")} ${countdown(l.at - now, t("home.dayUnit"))}`
                    : t("raceDetail.closed")}
                </span>
                <span className="race-lineup-state">
                  {l.done ? t("raceDetail.submitted") : l.open ? t("raceDetail.toSubmit") : t("raceDetail.missed")}
                </span>
              </li>
            );
          })}
        </ul>
        <Link to="/lineup" className={`btn w-100 mt-2 ${anyOpen ? "btn-danger" : "btn-outline-danger"}`}>
          {anyOpen ? t("home.startLineup") : t("home.viewLineup")}
        </Link>
      </section>

      {/* Circuit */}
      {(info || prevWinner) && (
        <section className="fx-card race-card">
          <div className="race-card-head">
            <h2 className="fx-card-title">{t("raceDetail.circuit")}</h2>
          </div>
          <dl className="race-facts">
            {info?.circuitName && (
              <div><dt>{t("raceDetail.circuit")}</dt><dd>{info.circuitName}</dd></div>
            )}
            {facts && (
              <>
                <div><dt>{t("raceDetail.length")}</dt><dd>{facts.length.toFixed(3)} km</dd></div>
                <div><dt>{t("raceDetail.laps")}</dt><dd>{facts.laps}</dd></div>
                <div><dt>{t("raceDetail.distance")}</dt><dd>{(facts.length * facts.laps).toFixed(1)} km</dd></div>
              </>
            )}
            {prevWinner && (
              <div>
                <dt>{t("raceDetail.lastWinner", { year: prevWinner.season })}</dt>
                <dd><Driver name={prevWinner.driver} />{prevWinner.constructor && <span className="race-fact-sub"> · {prevWinner.constructor}</span>}</dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}
