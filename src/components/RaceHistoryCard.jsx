/**
 * @file RaceHistoryCard.jsx
 * Unified component for displaying race history, lineups and scores.
 * Supports main race, sprint races, double jolly, double points, and dark/light themes.
 */
import React, { useState, useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { Card, Table, Badge, Alert, Row, Col } from "react-bootstrap";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";
import { POINTS } from "../constants/racing";
import { computeScores, scoreTone } from "../utils/raceScores";
import { useF1Data } from "../hooks/useF1Data";
import { useLanguage } from "../hooks/useLanguage";
import { useTimezone } from "../hooks/useTimezone";
import { error } from "../utils/logger";
import "../styles/cards.css";
import { useWarm } from "../hooks/useWarm";
import { watchRanking } from "../services/warmup";
import LogoLoader from "./LogoLoader";

/**
 * Formats driver name to first initial + surname
 * @param {string} name - Full driver name (e.g., "Max Verstappen")
 * @returns {string} Formatted name (e.g., "M. Verstappen")
 */
function formatDriverName(name) {
  if (!name) return "—";
  const parts = name.trim().split(" ");
  if (parts.length < 2) return name;
  const firstName = parts[0];
  const surname = parts.slice(1).join(" ");
  return `${firstName.charAt(0)}. ${surname}`;
}

/**
 * Displays driver name with team logo.
 * @param {Object} props - Component props
 * @param {string} props.name - Driver name
 * @param {boolean} props.short - Use short format (initial + surname)
 * @returns {JSX.Element} Driver name with team logo
 */
function DriverWithLogo({ name, short = false }) {
  const { getDriverTeam, getTeamLogo } = useF1Data();
  if (!name) return <>—</>;
  const team = getDriverTeam(name);
  const logoSrc = team ? getTeamLogo(team) : null;
  const displayName = short ? formatDriverName(name) : name;
  return (
    <span className="d-flex align-items-center">
      {logoSrc && (
        <img
          src={logoSrc}
          alt={`${team} team logo`}
          loading="lazy"
          style={{
            height: 20,
            width: 20,
            objectFit: "contain",
            marginRight: 6,
          }}
        />
      )}
      {displayName}
    </span>
  );
}

DriverWithLogo.propTypes = {
  name: PropTypes.string,
  short: PropTypes.bool,
};

/**
 * Colored points value ("—" when missing, 🔒 when hidden).
 * @param {Object} props - Component props
 * @param {number|null} props.value - Points value
 * @param {boolean} props.locked - Whether the value is hidden
 * @returns {JSX.Element} Points value
 */
function ScoreValue({ value, locked = false }) {
  if (locked) return <span className="text-muted">🔒</span>;
  if (value === null || value === undefined) return <span className="text-muted">—</span>;
  return <span className={`score-value is-${scoreTone(value)}`}>{value}</span>;
}

ScoreValue.propTypes = {
  value: PropTypes.number,
  locked: PropTypes.bool,
};

/**
 * Segmented summary of a lineup's scores: main race | sprint | total.
 * @param {Object} props - Component props
 * @param {Array} props.items - [{ key, label, value, locked, isTotal }]
 * @returns {JSX.Element} Score summary
 */
function ScoreSummary({ items }) {
  return (
    <div className="score-summary">
      {items.map((item) => (
        <div key={item.key} className={`score-summary-item${item.isTotal ? " is-total" : ""}`}>
          <span className="score-summary-label">{item.label}</span>
          <span className="score-summary-value">
            <ScoreValue value={item.value} locked={item.locked} />
          </span>
        </div>
      ))}
    </div>
  );
}

ScoreSummary.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      value: PropTypes.number,
      locked: PropTypes.bool,
      isTotal: PropTypes.bool,
    })
  ).isRequired,
};

/**
 * Points badge shown next to a pick.
 * @param {Object} props - Component props
 * @param {number} props.pts - Points value
 * @returns {JSX.Element} Points badge
 */
function PickBadge({ pts = 0 }) {
  return (
    <Badge bg={scoreTone(pts)} pill style={{ minWidth: 32, fontSize: "0.8rem" }}>
      {pts}
    </Badge>
  );
}

PickBadge.propTypes = {
  pts: PropTypes.number,
};

/**
 * Mobile row: pick label, driver and points.
 * @param {Object} props - Component props
 * @returns {JSX.Element} Pick line
 */
function PickLine({ label, pick, pts, showPts }) {
  return (
    <div className="d-flex justify-content-between align-items-center py-1 border-bottom" style={{ fontSize: "0.9rem" }}>
      <span className="text-muted">{label}</span>
      <div className="d-flex align-items-center gap-2">
        {pick ? (
          <>
            <DriverWithLogo name={pick} />
            {showPts && <PickBadge pts={pts} />}
          </>
        ) : (
          <span className="text-muted">—</span>
        )}
      </div>
    </div>
  );
}

PickLine.propTypes = {
  label: PropTypes.string.isRequired,
  pick: PropTypes.string,
  pts: PropTypes.number,
  showPts: PropTypes.bool,
};

/**
 * Desktop table cell: driver and points.
 * @param {Object} props - Component props
 * @returns {JSX.Element} Table cell
 */
function PickCell({ pick, pts, masked, showPts, groupStart = false }) {
  return (
    <td className={`text-center${groupStart ? " score-group-start" : ""}`}>
      {masked ? (
        <span className="text-muted">🔒</span>
      ) : pick ? (
        <div className="d-flex flex-column align-items-center gap-1 text-nowrap">
          <DriverWithLogo name={pick} short />
          {showPts && <PickBadge pts={pts} />}
        </div>
      ) : (
        "—"
      )}
    </td>
  );
}

PickCell.propTypes = {
  pick: PropTypes.string,
  pts: PropTypes.number,
  masked: PropTypes.bool,
  showPts: PropTypes.bool,
  groupStart: PropTypes.bool,
};

/**
 * Official podium table (main race or sprint).
 * @param {Object} props - Component props
 * @returns {JSX.Element} Podium table
 */
function OfficialPodium({ title, rows }) {
  return (
    <div className="rh-podium">
      <div className="rh-section-title">{title}</div>
      {rows.map(({ pos, name, pts }, i) => (
        <div key={pos} className="rh-podium-row">
          <span className={`rh-podium-pos${i === 0 ? " is-first" : ""}`}>{pos}</span>
          <span className="rh-podium-name"><DriverWithLogo name={name} /></span>
          <span className="rh-podium-pts">{pts}</span>
        </div>
      ))}
    </div>
  );
}

OfficialPodium.propTypes = {
  title: PropTypes.string.isRequired,
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      pos: PropTypes.string.isRequired,
      name: PropTypes.string,
      pts: PropTypes.number.isRequired,
    })
  ).isRequired,
};

/**
 * Displays race history card with official results, lineups and scores.
 * @param {Object} props - Component props
 * @param {Object} props.race - Race object with id, name, round, raceUTC, officialResults
 * @param {boolean} props.showOfficialResults - Whether to show official race results
 * @param {boolean} props.showPoints - Whether to show individual scores
 * @param {boolean} props.compact - Compact version without extended header
 * @returns {JSX.Element} Race history card
 */
function RaceHistoryCard({
  race,
  showOfficialResults = true,
  showPoints = true,
  compact = false,
  isLastRace = false,
  currentUserId = null,
  reactive = false,
  cardsOnly = false,
  collapsible = false,
}) {
  const { t } = useLanguage();
  const { timezone } = useTimezone();
  const [subs, setSubs] = useState([]);
  const [loadingSub, setLoadingSub] = useState(true);
  const [errorSub, setErrorSub] = useState(null);
  const [openIds, setOpenIds] = useState(() => new Set(currentUserId ? [currentUserId] : []));
  const toggleOpen = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // userId → name from the shared live ranking (no extra read per card)
  const ranking = useWarm("ranking");
  useEffect(() => { watchRanking(); }, []);
  const rankingMap = useMemo(() => {
    const map = {};
    (ranking || []).forEach((d) => { map[d.id] = d.name; });
    return map;
  }, [ranking]);
  // Read through a ref by the sort below, so a name update doesn't re-read the submissions
  const rankingMapRef = useRef(rankingMap);
  rankingMapRef.current = rankingMap;

  // Load submissions for this race (reactive via onSnapshot, or one-shot via getDocs)
  useEffect(() => {
    setLoadingSub(true);
    setErrorSub(null);

    const sortList = (list) => {
      list.sort((a, b) => {
        if (currentUserId) {
          if (a.id === currentUserId) return -1;
          if (b.id === currentUserId) return 1;
        }
        const aTs = a.submittedAt?.seconds ?? null;
        const bTs = b.submittedAt?.seconds ?? null;
        if (aTs !== null && bTs !== null) return aTs - bTs;
        if (aTs !== null) return -1;
        if (bTs !== null) return 1;
        const aName = a.user || rankingMapRef.current[a.id] || a.id;
        const bName = b.user || rankingMapRef.current[b.id] || b.id;
        return aName.localeCompare(bName, "it");
      });
      return list;
    };

    if (reactive) {
      const unsub = onSnapshot(
        collection(db, "races", race.id, "submissions"),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setSubs(sortList(list));
          setLoadingSub(false);
        },
        (e) => {
          error(e);
          setErrorSub(t("history.unableToLoadLineups"));
          setLoadingSub(false);
        }
      );
      return unsub;
    }

    // One-shot fetch
    getDocs(collection(db, "races", race.id, "submissions"))
      .then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSubs(sortList(list));
      })
      .catch((e) => {
        error(e);
        setErrorSub(t("history.unableToLoadLineups"));
      })
      .finally(() => setLoadingSub(false));
  }, [race.id, t, currentUserId, reactive]);

  const hasJolly2 = subs.some((s) => s.mainJolly2);
  const official = race.officialResults ?? null;
  const hasSprint = Boolean(race.qualiSprintUTC) || Boolean(official?.SP1) || subs.some(s => s.sprintP1 || s.sprintP2 || s.sprintP3 || s.sprintJolly);
  const doublePts = Boolean(official?.doublePoints);
  const multiplier = doublePts ? 2 : 1;
  const cancelledMain = race.cancelledMain || false;
  const cancelledSprint = race.cancelledSprint || false;
  const showSprintResults = hasSprint && !cancelledSprint;
  const scored = showPoints && Boolean(official);
  const sprintScored = scored && showSprintResults && Boolean(official.SP1);

  // Visibility rules: hide other players' picks until qualifying deadlines
  const nowMs = Date.now();
  const mainQualifyingStarted = race.qualiUTC ? nowMs >= race.qualiUTC.seconds * 1000 : true;
  const sprintQualifyingStarted = race.qualiSprintUTC ? nowMs >= race.qualiSprintUTC.seconds * 1000 : true;
  const canSeeOthersMain = !currentUserId || mainQualifyingStarted;
  const canSeeOthersSprint = !currentUserId || sprintQualifyingStarted;

  // Helper: check if a submission's main/sprint picks should be masked
  const isOwn = (subId) => currentUserId && subId === currentUserId;
  const maskMain = (subId) => !isOwn(subId) && !canSeeOthersMain;
  const maskSprint = (subId) => !isOwn(subId) && !canSeeOthersSprint;

  // Filter: hide other users entirely if nothing is visible for them
  const visibleSubs = subs.filter(s => {
    if (!currentUserId) return true;
    if (isOwn(s.id)) return true;
    return canSeeOthersMain || (hasSprint && canSeeOthersSprint);
  });

  const hiddenCount = subs.length - visibleSubs.length;

  // One entry per visible lineup, shared by the mobile and desktop layouts
  const rows = visibleSubs.map((s) => {
    const mainMasked = Boolean(maskMain(s.id));
    const sprintMasked = hasSprint && Boolean(maskSprint(s.id));
    return {
      s,
      userName: s.user || rankingMap[s.id] || s.id,
      mainMasked,
      sprintMasked,
      score: scored ? computeScores(s, official, multiplier, sprintScored) : null,
    };
  });


  const DoubleBadge = () =>
    doublePts ? (
      <Badge bg="danger" text="white" className="ms-2">
        {t("calculate.doublePoints")}
      </Badge>
    ) : null;

  return (
    <Card className="fx-card race-history-card">
      {!compact && (
        <div className="rh-head">
          <div className="fx-eyebrow">
            R{race.round} · {new Date(race.raceUTC.seconds * 1000).toLocaleDateString(undefined, { timeZone: timezone })}
          </div>
          <h2 className={`rh-title${cancelledMain ? " is-cancelled" : ""}`}>
            {race.name}
            {cancelledMain && (
              <Badge bg="danger" className="ms-2">
                ⛔ {t("history.cancelled")}
              </Badge>
            )}
            {cancelledSprint && hasSprint && (
              <Badge bg="warning" text="dark" className="ms-2">
                {t("history.sprintCancelledBadge")}
              </Badge>
            )}
            {doublePts && <DoubleBadge />}
          </h2>
        </div>
      )}

      <Card.Body>
        {/* Alert for cancelled races */}
        {cancelledMain && (
          <Alert variant="danger" className="mb-3">
            <strong>⛔ {t("history.raceCancelled")}</strong><br />
            {t("history.raceCancelledDescription")}
          </Alert>
        )}
        {cancelledSprint && hasSprint && !cancelledMain && (
          <Alert variant="warning" className="mb-3">
            <strong>⛔ {t("history.sprintCancelled")}</strong><br />
            {t("history.sprintCancelledDescription")}
          </Alert>
        )}

        {/* Official results section */}
        {showOfficialResults && official && !cancelledMain ? (
          <Row className="g-4 mb-4">
            <Col xs={12} lg={showSprintResults ? 6 : 12}>
              <OfficialPodium
                title={t("calculate.mainRace")}
                rows={[
                  { pos: "1°", name: official.P1, pts: POINTS.MAIN[1] * multiplier },
                  { pos: "2°", name: official.P2, pts: POINTS.MAIN[2] * multiplier },
                  { pos: "3°", name: official.P3, pts: POINTS.MAIN[3] * multiplier },
                ]}
              />
            </Col>
            {showSprintResults && (
              <Col xs={12} lg={6}>
                <OfficialPodium
                  title={t("formations.sprint")}
                  rows={[
                    { pos: "SP1°", name: official.SP1, pts: POINTS.SPRINT[1] * multiplier },
                    { pos: "SP2°", name: official.SP2, pts: POINTS.SPRINT[2] * multiplier },
                    { pos: "SP3°", name: official.SP3, pts: POINTS.SPRINT[3] * multiplier },
                  ]}
                />
              </Col>
            )}
          </Row>
        ) : showOfficialResults && !official ? (
          <Alert variant="warning">
            {t("history.officialResultsNotAvailable")}
          </Alert>
        ) : null}

        {/* Lineups and scores section */}
        {loadingSub ? (
          <div className="text-center py-3">
            <LogoLoader />
          </div>
        ) : errorSub ? (
          <Alert variant="danger">{errorSub}</Alert>
        ) : subs.length === 0 ? (
          <div className="rh-note">{t("history.noLineupsYet")}</div>
        ) : (
          <>
            <div className="rh-section-title mb-2">
              {scored ? t("history.lineupsAndScores") : t("history.lineups")}
            </div>

            {/* Visibility warning */}
            {currentUserId && !canSeeOthersMain && (
              <div className="rh-note mb-3">
                🔒 {hasSprint && canSeeOthersSprint
                  ? t("formations.othersMainHidden")
                  : t("formations.othersHidden")}
                {hiddenCount > 0 && !hasSprint && (
                  <div className="mt-1">
                    {t("formations.hiddenSubmissions", { count: subs.length - (subs.some(s => isOwn(s.id)) ? 1 : 0) })}
                  </div>
                )}
              </div>
            )}

            {/* Mobile layout - cards */}
            <div className={cardsOnly ? undefined : "d-lg-none"}>
              {rows.map(({ s, userName, mainMasked, sprintMasked, score }, idx) => {
                const open = !collapsible || openIds.has(s.id);
                const Head = collapsible ? "button" : "div";
                return (
                <Card key={s.id} className={`mb-2 score-user-card${collapsible ? " is-collapsible" : ""}${open ? " is-open" : ""}`}>
                  <Card.Body>
                    <Head
                      {...(collapsible ? { type: "button", onClick: () => toggleOpen(s.id), "aria-expanded": open } : {})}
                      className="score-user-head"
                    >
                      <span className="score-user-name">
                        {idx + 1}. {userName}
                        {(s.isLate || s.isLateSprint) && (
                          <Badge bg="warning" text="dark" className="ms-2">
                            ⏰ {t("formations.lateSubmission")} (-3)
                          </Badge>
                        )}
                      </span>
                      {collapsible && <span className="score-user-chevron" aria-hidden="true">›</span>}
                    </Head>

                    {scored && (
                      <ScoreSummary
                        items={[
                          { key: "main", label: t("history.scoreMain"), value: score?.mainTotal, locked: mainMasked },
                          ...(hasSprint
                            ? [{ key: "sprint", label: t("formations.sprint"), value: score?.sprintTotal, locked: sprintMasked }]
                            : []),
                          { key: "total", label: t("history.total"), value: score?.total, locked: mainMasked || sprintMasked, isTotal: true },
                        ]}
                      />
                    )}

                    {!open ? null : mainMasked ? (
                      <div className="text-center text-muted py-2">
                        🔒 <em>{t("formations.mainPicksHidden")}</em>
                      </div>
                    ) : (
                      <div className={hasSprint ? "mb-3" : undefined}>
                        <div className="score-section-title">{t("calculate.mainRace")}</div>
                        <PickLine label="P1" pick={s.mainP1} pts={score?.main.P1} showPts={scored} />
                        <PickLine label="P2" pick={s.mainP2} pts={score?.main.P2} showPts={scored} />
                        <PickLine label="P3" pick={s.mainP3} pts={score?.main.P3} showPts={scored} />
                        <PickLine label="J1" pick={s.mainJolly} pts={score?.main.J1} showPts={scored} />
                        {s.mainJolly2 && <PickLine label="J2" pick={s.mainJolly2} pts={score?.main.J2} showPts={scored} />}
                      </div>
                    )}

                    {open && hasSprint && (
                      sprintMasked ? (
                        <div className="text-center text-muted py-2">
                          🔒 <em>{t("formations.sprintPicksHidden")}</em>
                        </div>
                      ) : (
                        <div>
                          <div className="score-section-title">{t("formations.sprint")}</div>
                          <PickLine label="SP1" pick={s.sprintP1} pts={score?.sprint.SP1} showPts={sprintScored} />
                          <PickLine label="SP2" pick={s.sprintP2} pts={score?.sprint.SP2} showPts={sprintScored} />
                          <PickLine label="SP3" pick={s.sprintP3} pts={score?.sprint.SP3} showPts={sprintScored} />
                          <PickLine label="J SP" pick={s.sprintJolly} pts={score?.sprint.J} showPts={sprintScored} />
                        </div>
                      )
                    )}
                  </Card.Body>
                </Card>
                );
              })}
            </div>

            {/* Desktop layout - table grouped by main race / sprint / points */}
            <div className={cardsOnly ? "d-none" : "d-none d-lg-block table-responsive"}>
              <Table hover size="sm" className="align-middle race-scores-table">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: 40 }} className="text-center">#</th>
                    <th rowSpan={2} style={{ width: 120 }} className="text-center">{t("history.user")}</th>
                    {scored && (
                      <th colSpan={hasSprint ? 3 : 2} className="text-center score-group-start score-group-title">
                        {t("common.points")}
                      </th>
                    )}
                    <th colSpan={hasJolly2 ? 5 : 4} className="text-center score-group-start score-group-title">
                      {t("calculate.mainRace")}
                    </th>
                    {hasSprint && (
                      <th colSpan={4} className="text-center score-group-start score-group-title">
                        {t("formations.sprint")}
                      </th>
                    )}
                  </tr>
                  <tr>
                    {scored && (
                      <>
                        <th style={{ width: 70 }} className="text-center score-group-start">{t("history.scoreMain")}</th>
                        {hasSprint && <th style={{ width: 70 }} className="text-center">{t("formations.sprint")}</th>}
                        <th style={{ width: 80 }} className="text-center">{t("history.total")}</th>
                      </>
                    )}
                    <th className="text-center score-group-start">P1</th>
                    <th className="text-center">P2</th>
                    <th className="text-center">P3</th>
                    <th className="text-center">J1</th>
                    {hasJolly2 && <th className="text-center">J2</th>}
                    {hasSprint && (
                      <>
                        <th className="text-center score-group-start">SP1</th>
                        <th className="text-center">SP2</th>
                        <th className="text-center">SP3</th>
                        <th className="text-center">J SP</th>
                      </>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {rows.map(({ s, userName, mainMasked, sprintMasked, score }, idx) => (
                    <tr key={s.id}>
                      <td className="text-center">{idx + 1}</td>
                      <td className="text-center">
                        {userName}
                        {((s.isLate && !mainMasked) || (s.isLateSprint && !sprintMasked)) && (
                          <Badge bg="warning" text="dark" className="ms-1">
                            ⏰ {t("formations.latePenalty")}
                          </Badge>
                        )}
                      </td>

                      {/* Points: main race, sprint, total */}
                      {scored && (
                        <>
                          <td className="text-center score-group-start">
                            <ScoreValue value={score.mainTotal} locked={mainMasked} />
                          </td>
                          {hasSprint && (
                            <td className="text-center">
                              <ScoreValue value={score.sprintTotal} locked={sprintMasked} />
                            </td>
                          )}
                          <td className="text-center">
                            {mainMasked || sprintMasked ? (
                              <span className="text-muted">🔒</span>
                            ) : (
                              <Badge bg={scoreTone(score.total)} pill className="score-total-badge">
                                {score.total}
                              </Badge>
                            )}
                          </td>
                        </>
                      )}

                      {/* Main race picks */}
                      <PickCell pick={s.mainP1} pts={score?.main.P1} masked={mainMasked} showPts={scored} groupStart />
                      <PickCell pick={s.mainP2} pts={score?.main.P2} masked={mainMasked} showPts={scored} />
                      <PickCell pick={s.mainP3} pts={score?.main.P3} masked={mainMasked} showPts={scored} />
                      <PickCell pick={s.mainJolly} pts={score?.main.J1} masked={mainMasked} showPts={scored} />
                      {hasJolly2 && <PickCell pick={s.mainJolly2} pts={score?.main.J2} masked={mainMasked} showPts={scored} />}

                      {/* Sprint race picks */}
                      {hasSprint && (
                        <>
                          <PickCell pick={s.sprintP1} pts={score?.sprint.SP1} masked={sprintMasked} showPts={sprintScored} groupStart />
                          <PickCell pick={s.sprintP2} pts={score?.sprint.SP2} masked={sprintMasked} showPts={sprintScored} />
                          <PickCell pick={s.sprintP3} pts={score?.sprint.SP3} masked={sprintMasked} showPts={sprintScored} />
                          <PickCell pick={s.sprintJolly} pts={score?.sprint.J} masked={sprintMasked} showPts={sprintScored} />
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
}

RaceHistoryCard.propTypes = {
  race: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    round: PropTypes.number.isRequired,
    raceUTC: PropTypes.shape({
      seconds: PropTypes.number.isRequired,
    }).isRequired,
    officialResults: PropTypes.shape({
      P1: PropTypes.string,
      P2: PropTypes.string,
      P3: PropTypes.string,
      SP1: PropTypes.string,
      SP2: PropTypes.string,
      SP3: PropTypes.string,
      doublePoints: PropTypes.bool,
    }),
    cancelledMain: PropTypes.bool,
    cancelledSprint: PropTypes.bool,
  }).isRequired,
  showOfficialResults: PropTypes.bool,
  showPoints: PropTypes.bool,
  compact: PropTypes.bool,
  isLastRace: PropTypes.bool,
  currentUserId: PropTypes.string,
  reactive: PropTypes.bool,
  cardsOnly: PropTypes.bool, // always use the stacked card layout (narrow columns)
  collapsible: PropTypes.bool, // mobile cards start closed (own lineup open), tap to expand
};

export default React.memo(RaceHistoryCard);
