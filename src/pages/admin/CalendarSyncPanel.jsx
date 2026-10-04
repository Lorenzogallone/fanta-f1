/**
 * @file CalendarSyncPanel.jsx
 * @description Admin panel for the F1 sync with Jolpica: shows the differences
 * between the official data and the database (calendar and drivers), lets the
 * admin accept / lock / unlock single fields, and applies a full sync only
 * after a preview. The same logic runs weekly in the Cloud Functions.
 */

import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Badge, Button, Modal, Spinner, Table } from "react-bootstrap";
import { useLanguage } from "../../hooks/useLanguage";
import { useTimezone } from "../../hooks/useTimezone";
import { useTheme } from "../../contexts/ThemeContext";
import { useF1Data } from "../../hooks/useF1Data";
import {
  previewF1Sync,
  applyF1Sync,
  getSyncStatus,
  acceptField,
  setFieldsLocked,
} from "../../services/calendarSyncService";
import { toDate } from "../../../functions/shared/f1Sync.mjs";
import { error } from "../../utils/logger";

const FIELD_LABELS = {
  name: "f1Sync.fieldName",
  raceUTC: "f1Sync.fieldRace",
  qualiUTC: "f1Sync.fieldQuali",
  sprintUTC: "f1Sync.fieldSprint",
  qualiSprintUTC: "f1Sync.fieldSprintQuali",
  officialRound: "f1Sync.fieldOfficialRound",
  cancelledMain: "f1Sync.fieldCancelled",
  teamId: "f1Sync.fieldTeam",
};

export default function CalendarSyncPanel({ races, onDataChange }) {
  const { t } = useLanguage();
  const { timezone } = useTimezone();
  const { isDark } = useTheme();
  const { drivers, teams, source, reload: reloadF1Data } = useF1Data();

  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState(null);

  const borderColor = isDark ? "var(--border-color)" : "#dee2e6";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";

  useEffect(() => {
    getSyncStatus().then(setStatus).catch((err) => error(err));
  }, []);

  const teamName = (id) => teams.find((tm) => tm.id === id)?.name || id || "—";

  const fmtValue = (field, value) => {
    if (value === null || value === undefined || value === "") return "—";
    if (field === "teamId") return teamName(value);
    if (field === "cancelledMain") return value ? t("f1Sync.yes") : t("f1Sync.no");
    const d = field.endsWith("UTC") ? toDate(value) : null;
    if (d) {
      return d.toLocaleString("it-IT", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: timezone,
      });
    }
    return String(value);
  };

  const fmtTs = (ts) => {
    const d = toDate(ts);
    return d ? d.toLocaleString("it-IT", { timeZone: timezone }) : "—";
  };

  /** Computes the preview against the current data */
  const runCheck = async (racesOverride) => {
    setChecking(true);
    setMessage(null);
    try {
      // Driver sync needs the Firestore collections (not the f1-data.json fallback)
      const useDrivers = source === "firestore";
      const result = await previewF1Sync({
        races: racesOverride || races,
        drivers: useDrivers ? drivers : [],
        teams: useDrivers ? teams : [],
      });
      setPreview(result);
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("f1Sync.apiError")}: ${err.message}` });
    } finally {
      setChecking(false);
    }
  };

  /** Reloads data after a single-field action and refreshes the preview */
  const refreshAfterAction = async (collectionName) => {
    if (collectionName === "drivers") await reloadF1Data();
    const fresh = collectionName === "races" ? await onDataChange() : null;
    await runCheck(Array.isArray(fresh) ? fresh : undefined);
  };

  const doAction = async (key, collectionName, fn) => {
    setBusyKey(key);
    setMessage(null);
    try {
      await fn();
      await refreshAfterAction(collectionName);
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setBusyKey(null);
    }
  };

  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);
    setMessage(null);
    try {
      await applyF1Sync(preview);
      setShowConfirm(false);
      setMessage({ type: "success", text: t("f1Sync.applied", { count: preview.writes.length }) });
      setStatus(await getSyncStatus());
      await reloadF1Data();
      const fresh = await onDataChange();
      await runCheck(Array.isArray(fresh) ? fresh : undefined);
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setApplying(false);
    }
  };

  const raceName = (id) => races.find((r) => r.id === id)?.name || id;

  /** One row of the differences table, with accept / lock / unlock */
  const renderDiffRow = (u, collectionName) => {
    const key = `${collectionName}:${u.id}:${u.field}`;
    const lockable = collectionName === "races"
      ? !["officialRound", "cancelledMain"].includes(u.field)
      : u.field === "teamId";
    const busy = busyKey === key;
    return (
      <tr key={key}>
        <td className="text-truncate" style={{ maxWidth: 160 }}>
          {collectionName === "races" ? raceName(u.id) : u.name}
        </td>
        <td>{t(FIELD_LABELS[u.field] || u.field)}</td>
        <td className="text-muted">{fmtValue(u.field, u.from)}</td>
        <td className="fw-semibold">{fmtValue(u.field, u.to)}</td>
        <td>
          {u.locked
            ? <Badge bg="secondary">🔒 {t("f1Sync.locked")}</Badge>
            : <Badge bg="info">{t("f1Sync.willApply")}</Badge>}
        </td>
        <td className="text-nowrap">
          <Button size="sm" variant="outline-success" className="py-0 px-1 me-1" disabled={Boolean(busyKey)}
            onClick={() => doAction(key, collectionName, () => acceptField(collectionName, u.id, u.field, u.to))}>
            {busy ? <Spinner animation="border" size="sm" /> : t("f1Sync.accept")}
          </Button>
          {lockable && (u.locked ? (
            <Button size="sm" variant="outline-secondary" className="py-0 px-1" disabled={Boolean(busyKey)}
              onClick={() => doAction(key, collectionName, () => setFieldsLocked(collectionName, u.id, [u.field], false))}>
              {t("f1Sync.unlock")}
            </Button>
          ) : (
            <Button size="sm" variant="outline-secondary" className="py-0 px-1" disabled={Boolean(busyKey)}
              onClick={() => doAction(key, collectionName, () => setFieldsLocked(collectionName, u.id, [u.field], true))}>
              {t("f1Sync.lock")}
            </Button>
          ))}
        </td>
      </tr>
    );
  };

  const cal = preview?.calendar;
  const drv = preview?.drivers;
  const applicable = preview?.writes.length || 0;
  const hasDiffs = cal && (cal.updates.length || cal.creates.length || cal.cancels.length ||
    drv.driverCreates.length || drv.driverUpdates.length || drv.teamCreates.length || preview.roundChanges.length);

  return (
    <div className="mb-4">
      <h6 className="mb-2 fw-bold" style={{ color: "var(--text-primary)" }}>{t("f1Sync.title")}</h6>
      <div className="rounded p-3" style={{ backgroundColor: bgCard, border: `1px solid ${borderColor}` }}>
        <p className="small text-muted mb-2">{t("f1Sync.description")}</p>
        <p className="small mb-2">
          <span className="text-muted">{t("f1Sync.lastRun")}:</span>{" "}
          {status?.lastRunAt ? `${fmtTs(status.lastRunAt)} (${status.source === "manual" ? t("f1Sync.sourceManual") : t("f1Sync.sourceScheduled")})` : "—"}
          {status?.lastCheckAt && (
            <><br /><span className="text-muted">{t("f1Sync.lastCheck")}:</span> {fmtTs(status.lastCheckAt)}</>
          )}
        </p>

        {message && (
          <Alert variant={message.type} dismissible onClose={() => setMessage(null)} className="py-2 mb-2">
            {message.text}
          </Alert>
        )}

        <div className="d-flex gap-2 flex-wrap">
          <Button size="sm" variant="outline-primary" onClick={() => runCheck()} disabled={checking || applying}>
            {checking ? <><Spinner animation="border" size="sm" className="me-1" />{t("common.loading")}</> : t("f1Sync.check")}
          </Button>
          <Button size="sm" variant="danger" onClick={() => setShowConfirm(true)}
            disabled={!preview || checking || applying || applicable === 0}>
            {t("f1Sync.syncNow")} {preview ? `(${applicable})` : ""}
          </Button>
        </div>

        {source !== "firestore" && (
          <Alert variant="warning" className="py-1 small mt-2 mb-0">{t("f1Sync.driversNotMigrated")}</Alert>
        )}

        {preview && !hasDiffs && (
          <Alert variant="success" className="py-2 small mt-3 mb-0">{t("f1Sync.noDiffs")}</Alert>
        )}

        {preview && hasDiffs && (
          <div className="mt-3">
            {cal.updates.length > 0 && (
              <>
                <div className="small fw-semibold mb-1">{t("f1Sync.calendarDiffs")}</div>
                <div style={{ overflowX: "auto" }}>
                  <Table size="sm" bordered style={{ fontSize: "0.78rem" }}>
                    <thead>
                      <tr>
                        <th>{t("admin.raceName")}</th><th>{t("f1Sync.field")}</th>
                        <th>{t("f1Sync.db")}</th><th>{t("f1Sync.api")}</th><th></th><th></th>
                      </tr>
                    </thead>
                    <tbody>{cal.updates.map((u) => renderDiffRow(u, "races"))}</tbody>
                  </Table>
                </div>
              </>
            )}

            {cal.creates.length > 0 && (
              <p className="small mb-1">
                <strong>{t("f1Sync.newRaces")}:</strong>{" "}
                {cal.creates.map((c) => `R${c.officialRound} ${c.name} (${fmtValue("raceUTC", c.raceUTC)})`).join(", ")}
              </p>
            )}
            {cal.cancels.length > 0 && (
              <p className="small mb-1 text-danger">
                <strong>{t("f1Sync.toCancel")}:</strong> {cal.cancels.map((c) => c.name).join(", ")}
              </p>
            )}
            {preview.roundChanges.length > 0 && (
              <p className="small mb-1">
                <strong>{t("f1Sync.roundChanges")}:</strong>{" "}
                {preview.roundChanges.map((c) => `${c.name} R${c.from}→R${c.to}`).join(", ")}
              </p>
            )}
            {cal.skipped.length > 0 && (
              <p className="small text-muted mb-2">{t("f1Sync.skippedWithResults", { count: cal.skipped.length })}</p>
            )}

            {(drv.driverUpdates.length > 0) && (
              <>
                <div className="small fw-semibold mb-1 mt-2">{t("f1Sync.driverDiffs")}</div>
                <div style={{ overflowX: "auto" }}>
                  <Table size="sm" bordered style={{ fontSize: "0.78rem" }}>
                    <thead>
                      <tr>
                        <th>{t("f1Sync.driver")}</th><th>{t("f1Sync.field")}</th>
                        <th>{t("f1Sync.db")}</th><th>{t("f1Sync.api")}</th><th></th><th></th>
                      </tr>
                    </thead>
                    <tbody>{drv.driverUpdates.map((u) => renderDiffRow(u, "drivers"))}</tbody>
                  </Table>
                </div>
              </>
            )}
            {drv.driverCreates.length > 0 && (
              <p className="small mb-1">
                <strong>{t("f1Sync.newDrivers")}:</strong>{" "}
                {drv.driverCreates.map((d) => `${d.name} (${teamName(d.teamId)})`).join(", ")}
              </p>
            )}
            {drv.teamCreates.length > 0 && (
              <p className="small mb-1">
                <strong>{t("f1Sync.newTeams")}:</strong> {drv.teamCreates.map((tm) => tm.name).join(", ")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Sync preview / confirmation ── */}
      <Modal show={showConfirm} onHide={() => setShowConfirm(false)} centered size="lg">
        <Modal.Header closeButton><Modal.Title className="fs-6">{t("f1Sync.confirmTitle")}</Modal.Title></Modal.Header>
        <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {preview && (
            <>
              <p className="small text-muted">{t("f1Sync.confirmHint")}</p>
              <ul className="small mb-0">
                {cal.updates.filter((u) => !u.locked).map((u) => (
                  <li key={`u-${u.id}-${u.field}`}>
                    <strong>{raceName(u.id)}</strong> · {t(FIELD_LABELS[u.field] || u.field)}: {fmtValue(u.field, u.from)} → {fmtValue(u.field, u.to)}
                  </li>
                ))}
                {cal.creates.map((c) => (
                  <li key={`c-${c.officialRound}`}>➕ {t("f1Sync.newRace")}: <strong>{c.name}</strong> ({fmtValue("raceUTC", c.raceUTC)})</li>
                ))}
                {cal.cancels.map((c) => (
                  <li key={`x-${c.id}`} className="text-danger">✖ {t("f1Sync.cancelRace")}: <strong>{c.name}</strong></li>
                ))}
                {preview.roundChanges.map((c) => (
                  <li key={`r-${c.id}`}>{c.name}: R{c.from} → R{c.to}</li>
                ))}
                {drv.driverCreates.map((d) => (
                  <li key={`d-${d.id}`}>➕ {t("f1Sync.newDriver")}: <strong>{d.name}</strong> ({teamName(d.teamId)}, {t("f1Sync.notSelectable")})</li>
                ))}
                {drv.teamCreates.map((tm) => (
                  <li key={`t-${tm.id}`}>➕ {t("f1Sync.newTeam")}: <strong>{tm.name}</strong></li>
                ))}
                {drv.driverUpdates.filter((u) => !u.locked).map((u) => (
                  <li key={`du-${u.id}`}><strong>{u.name}</strong> · {t("f1Sync.fieldTeam")}: {teamName(u.from)} → {teamName(u.to)}</li>
                ))}
              </ul>
              {(preview.summary.calendar.lockedSkipped + preview.summary.drivers.lockedSkipped) > 0 && (
                <p className="small text-muted mt-2 mb-0">
                  🔒 {t("f1Sync.lockedNotApplied", { count: preview.summary.calendar.lockedSkipped + preview.summary.drivers.lockedSkipped })}
                </p>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowConfirm(false)} disabled={applying}>{t("common.cancel")}</Button>
          <Button variant="danger" size="sm" onClick={handleApply} disabled={applying}>
            {applying ? <Spinner animation="border" size="sm" /> : t("common.confirm")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

CalendarSyncPanel.propTypes = {
  races: PropTypes.arrayOf(PropTypes.object).isRequired,
  onDataChange: PropTypes.func.isRequired,
};
