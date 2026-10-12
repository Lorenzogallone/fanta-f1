/**
 * @file DriversManager.jsx
 * @description Admin management of drivers and teams (Firestore `drivers` and
 * `teams`). The name of a driver/team is the value stored in formations, so it
 * can't be changed after creation. Changing a driver's team by hand locks it
 * against the automatic sync.
 */

import React, { useState } from "react";
import { Alert, Badge, Button, Form, ListGroup, Modal } from "react-bootstrap";
import { doc, setDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useLanguage } from "../../hooks/useLanguage";
import { useF1Data } from "../../hooks/useF1Data";
import { makeSlug } from "../../../functions/shared/f1Sync.mjs";
import { error } from "../../utils/logger";
import LogoLoader from "../../components/LogoLoader";

/** "a, b , c" → ["a", "b", "c"] */
const parseAliases = (text) => [...new Set(text.split(",").map((s) => s.trim()).filter(Boolean))];

export default function DriversManager() {
  const { t } = useLanguage();
  const { drivers, teams, source, loading, reload } = useF1Data();

  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);
  const [editing, setEditing] = useState(null); // { kind: "driver"|"team", isNew, data }
  const [saving, setSaving] = useState(false);

  const editable = source === "firestore";

  const teamName = (id) => teams.find((tm) => tm.id === id)?.name || "—";
  const teamLogo = (id) => teams.find((tm) => tm.id === id)?.logo || null;

  const sortedDrivers = [...drivers].sort((a, b) =>
    teamName(a.teamId).localeCompare(teamName(b.teamId)) || a.name.localeCompare(b.name)
  );
  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  /** Targeted update of one document, then reload */
  const update = async (collectionName, id, data) => {
    setBusyId(`${collectionName}:${id}`);
    setMessage(null);
    try {
      await updateDoc(doc(db, collectionName, id), { ...data, updatedAt: serverTimestamp() });
      await reload();
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setBusyId(null);
    }
  };

  const openDriver = (driver) => setEditing({
    kind: "driver",
    isNew: !driver,
    data: driver
      ? { ...driver, aliasesText: (driver.apiAliases || []).join(", "), number: driver.number ?? "" }
      : { name: "", firstName: "", lastName: "", number: "", teamId: teams[0]?.id || "", aliasesText: "", selectable: false, active: true },
  });

  const openTeam = (team) => setEditing({
    kind: "team",
    isNew: !team,
    data: team
      ? { ...team, aliasesText: (team.apiAliases || []).join(", "), logo: team.logo || "" }
      : { name: "", logo: "", aliasesText: "", active: true },
  });

  const setField = (field, value) => setEditing((e) => ({ ...e, data: { ...e.data, [field]: value } }));

  const handleSave = async () => {
    const { kind, isNew, data } = editing;
    const name = data.name.trim();
    if (!name) {
      setMessage({ type: "warning", text: t("errors.incompleteForm") });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const aliases = parseAliases(data.aliasesText);
      if (kind === "driver") {
        const fields = {
          firstName: data.firstName?.trim() || "",
          lastName: data.lastName?.trim() || "",
          number: data.number === "" ? null : Number(data.number),
          teamId: data.teamId || null,
          apiAliases: aliases,
          selectable: Boolean(data.selectable),
          active: Boolean(data.active),
          updatedAt: serverTimestamp(),
        };
        if (isNew) {
          const id = makeSlug(name);
          if (drivers.some((d) => d.id === id || d.name === name)) throw new Error(t("driversAdmin.duplicate"));
          await setDoc(doc(db, "drivers", id), {
            ...fields, name, apiAliases: [...new Set([name, ...aliases])], source: "manual", locked: ["teamId"],
          });
        } else {
          const original = drivers.find((d) => d.id === data.id);
          // A team changed by hand is locked against the sync
          if (original && original.teamId !== fields.teamId) fields.locked = arrayUnion("teamId");
          await updateDoc(doc(db, "drivers", data.id), fields);
        }
      } else {
        const fields = { logo: data.logo?.trim() || null, apiAliases: aliases, active: Boolean(data.active), updatedAt: serverTimestamp() };
        if (isNew) {
          const id = makeSlug(name);
          if (teams.some((tm) => tm.id === id || tm.name === name)) throw new Error(t("driversAdmin.duplicate"));
          await setDoc(doc(db, "teams", id), { ...fields, name, apiAliases: [...new Set([name, ...aliases])], source: "manual" });
        } else {
          await updateDoc(doc(db, "teams", data.id), fields);
        }
      }
      await reload();
      setEditing(null);
      setMessage({ type: "success", text: t("driversAdmin.saved") });
    } catch (err) {
      error(err);
      setMessage({ type: "danger", text: `${t("common.error")}: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading && drivers.length === 0) {
    return <div className="text-center py-5"><LogoLoader /></div>;
  }

  const switchCell = (collectionName, item, field) => (
    <Form.Check
      type="switch"
      id={`${collectionName}-${item.id}-${field}`}
      checked={item[field] !== false}
      disabled={!editable || busyId === `${collectionName}:${item.id}`}
      onChange={(e) => update(collectionName, item.id, { [field]: e.target.checked })}
    />
  );

  return (
    <>
      {!editable && <Alert variant="warning" className="py-2 small">{t("driversAdmin.notMigrated")}</Alert>}
      {message && !editing && (
        <Alert variant={message.type} dismissible onClose={() => setMessage(null)} className="py-2">{message.text}</Alert>
      )}

      {/* ── Drivers ── */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0 fw-bold" style={{ color: "var(--text-primary)" }}>
          {t("driversAdmin.drivers")}
          <Badge bg="secondary" className="ms-2" style={{ fontSize: "0.7rem", verticalAlign: "middle" }}>{drivers.length}</Badge>
        </h6>
        <Button size="sm" variant="danger" onClick={() => openDriver(null)} disabled={!editable}>+ {t("driversAdmin.addDriver")}</Button>
      </div>
      <ListGroup variant="flush" className="admin-list mb-4">
        {sortedDrivers.map((d) => {
          const teamLocked = (d.locked || []).includes("teamId");
          return (
            <ListGroup.Item key={d.id} className={`admin-row${d.active === false ? " is-off" : ""}`}>
              <button type="button" className="admin-row-main" onClick={() => openDriver(d)} disabled={!editable}>
                <span className="admin-row-title">
                  {d.name}
                  {d.number != null && d.number !== "" && <span className="admin-row-num">#{d.number}</span>}
                </span>
                <span className="admin-meta d-flex align-items-center gap-1">
                  {teamLogo(d.teamId) && <img src={teamLogo(d.teamId)} alt="" style={{ height: 14, width: 14, objectFit: "contain" }} />}
                  {teamName(d.teamId)}
                  {d.source === "api" && <> · {t("driversAdmin.fromApi")}</>}
                </span>
              </button>
              <Button variant="link" size="sm" className="admin-lock" disabled={!editable || busyId === `drivers:${d.id}`}
                title={teamLocked ? t("driversAdmin.unlockTeam") : t("driversAdmin.lockTeam")}
                aria-label={teamLocked ? t("driversAdmin.unlockTeam") : t("driversAdmin.lockTeam")}
                onClick={() => update("drivers", d.id, { locked: teamLocked ? arrayRemove("teamId") : arrayUnion("teamId") })}>
                {teamLocked ? "🔒" : "🔓"}
              </Button>
              <div className="admin-switches">
                <label className="admin-switch">
                  {switchCell("drivers", d, "selectable")}
                  <span>{t("driversAdmin.selectable")}</span>
                </label>
                <label className="admin-switch">
                  {switchCell("drivers", d, "active")}
                  <span>{t("driversAdmin.active")}</span>
                </label>
              </div>
            </ListGroup.Item>
          );
        })}
      </ListGroup>

      {/* ── Teams ── */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0 fw-bold" style={{ color: "var(--text-primary)" }}>
          {t("driversAdmin.teams")}
          <Badge bg="secondary" className="ms-2" style={{ fontSize: "0.7rem", verticalAlign: "middle" }}>{teams.length}</Badge>
        </h6>
        <Button size="sm" variant="danger" onClick={() => openTeam(null)} disabled={!editable}>+ {t("driversAdmin.addTeam")}</Button>
      </div>
      <ListGroup variant="flush" className="admin-list">
        {sortedTeams.map((tm) => (
          <ListGroup.Item key={tm.id} className={`admin-row${tm.active === false ? " is-off" : ""}`}>
            <button type="button" className="admin-row-main" onClick={() => openTeam(tm)} disabled={!editable}>
              <span className="admin-row-title d-flex align-items-center gap-1">
                {tm.logo && <img src={tm.logo} alt="" style={{ height: 16, width: 16, objectFit: "contain" }} />}
                {tm.name}
              </span>
              <span className="admin-meta" title={(tm.apiAliases || []).join(", ")}>
                {t("driversAdmin.aliasesCount", { count: String((tm.apiAliases || []).length) })}
                {tm.source === "api" && <> · {t("driversAdmin.fromApi")}</>}
              </span>
            </button>
            <div className="admin-switches">
              <label className="admin-switch">
                {switchCell("teams", tm, "active")}
                <span>{t("driversAdmin.active")}</span>
              </label>
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>

      {/* ── Edit / add modal ── */}
      <Modal show={Boolean(editing)} onHide={() => setEditing(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">
            {editing?.kind === "driver"
              ? (editing?.isNew ? t("driversAdmin.addDriver") : t("driversAdmin.editDriver"))
              : (editing?.isNew ? t("driversAdmin.addTeam") : t("driversAdmin.editTeam"))}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {message && editing && <Alert variant={message.type} className="py-2">{message.text}</Alert>}
          {editing && (
            <Form>
              <Form.Group className="mb-2">
                <Form.Label className="small fw-semibold">{t("driversAdmin.name")} *</Form.Label>
                <Form.Control size="sm" value={editing.data.name} disabled={!editing.isNew}
                  onChange={(e) => setField("name", e.target.value)} />
                <Form.Text className="text-muted" style={{ fontSize: "0.72rem" }}>{t("driversAdmin.nameHint")}</Form.Text>
              </Form.Group>

              {editing.kind === "driver" ? (
                <>
                  <div className="d-flex gap-2 mb-2">
                    <Form.Group className="flex-fill">
                      <Form.Label className="small fw-semibold">{t("driversAdmin.firstName")}</Form.Label>
                      <Form.Control size="sm" value={editing.data.firstName || ""} onChange={(e) => setField("firstName", e.target.value)} />
                    </Form.Group>
                    <Form.Group className="flex-fill">
                      <Form.Label className="small fw-semibold">{t("driversAdmin.lastName")}</Form.Label>
                      <Form.Control size="sm" value={editing.data.lastName || ""} onChange={(e) => setField("lastName", e.target.value)} />
                    </Form.Group>
                    <Form.Group style={{ width: 80 }}>
                      <Form.Label className="small fw-semibold">#</Form.Label>
                      <Form.Control size="sm" type="number" min="0" value={editing.data.number} onChange={(e) => setField("number", e.target.value)} />
                    </Form.Group>
                  </div>
                  <Form.Group className="mb-2">
                    <Form.Label className="small fw-semibold">{t("driversAdmin.team")}</Form.Label>
                    <Form.Select size="sm" value={editing.data.teamId || ""} onChange={(e) => setField("teamId", e.target.value)}>
                      {sortedTeams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                    </Form.Select>
                    <Form.Text className="text-muted" style={{ fontSize: "0.72rem" }}>{t("driversAdmin.teamHint")}</Form.Text>
                  </Form.Group>
                  <div className="d-flex gap-3 mb-2">
                    <Form.Check type="switch" id="edit-selectable" label={t("driversAdmin.selectable")}
                      checked={editing.data.selectable !== false} onChange={(e) => setField("selectable", e.target.checked)} />
                    <Form.Check type="switch" id="edit-active" label={t("driversAdmin.active")}
                      checked={editing.data.active !== false} onChange={(e) => setField("active", e.target.checked)} />
                  </div>
                </>
              ) : (
                <>
                  <Form.Group className="mb-2">
                    <Form.Label className="small fw-semibold">{t("driversAdmin.logo")}</Form.Label>
                    <div className="d-flex align-items-center gap-2">
                      {editing.data.logo && <img src={editing.data.logo} alt="" style={{ height: 24, width: 24, objectFit: "contain" }} />}
                      <Form.Control size="sm" placeholder="/mclaren.webp" value={editing.data.logo || ""} onChange={(e) => setField("logo", e.target.value)} />
                    </div>
                  </Form.Group>
                  <Form.Check type="switch" id="edit-team-active" className="mb-2" label={t("driversAdmin.active")}
                    checked={editing.data.active !== false} onChange={(e) => setField("active", e.target.checked)} />
                </>
              )}

              <Form.Group>
                <Form.Label className="small fw-semibold">{t("driversAdmin.aliases")}</Form.Label>
                <Form.Control size="sm" as="textarea" rows={2} value={editing.data.aliasesText}
                  onChange={(e) => setField("aliasesText", e.target.value)} />
                <Form.Text className="text-muted" style={{ fontSize: "0.72rem" }}>{t("driversAdmin.aliasesHint")}</Form.Text>
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setEditing(null)} disabled={saving}>{t("common.cancel")}</Button>
          <Button variant="danger" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <LogoLoader size="sm" /> : t("common.save")}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
