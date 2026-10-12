/**
 * @file RacePhotoEditor.jsx
 * @description Admin › Calendar › edit race: set, change or remove the photo shown
 * behind the next race card. Changes are saved right away (racePhotos/{raceId}),
 * independently of the race form.
 */

import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Button, Form } from "react-bootstrap";
import { useLanguage } from "../../hooks/useLanguage";
import { raceImage } from "../../data/raceImages";
import {
  PHOTO_POSITIONS,
  compressRacePhoto,
  getRacePhoto,
  removeRacePhoto,
  resetRacePhoto,
  resolveRacePhoto,
  saveCustomRacePhoto,
} from "../../services/racePhotoService";
import { error } from "../../utils/logger";
import LogoLoader from "../../components/LogoLoader";

export default function RacePhotoEditor({ race }) {
  const { t } = useLanguage();
  const fileRef = useRef(null);
  const [override, setOverride] = useState(undefined); // undefined while loading
  const [draft, setDraft] = useState(null); // { dataUrl, pos } being edited
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let active = true;
    setOverride(undefined);
    setDraft(null);
    setMessage(null);
    getRacePhoto(race.id)
      .then((o) => { if (active) setOverride(o); })
      .catch((err) => {
        error(err);
        if (active) setOverride(null);
      });
    return () => { active = false; };
  }, [race.id]);

  const hasDefault = Boolean(raceImage(race));
  const mode = override?.mode === "custom" ? "custom" : override?.mode === "none" || !hasDefault ? "none" : "default";
  const shown = draft ? { src: draft.dataUrl, pos: draft.pos } : resolveRacePhoto(race, override);

  const run = async (action, okText) => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await action();
      setOverride(next);
      setDraft(null);
      setMessage({ ok: true, text: okText });
    } catch (err) {
      error(err);
      setMessage({ ok: false, text: `${t("common.error")}: ${err.message}` });
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const dataUrl = await compressRacePhoto(file);
      setDraft({ dataUrl, pos: "center" });
    } catch (err) {
      setMessage({
        ok: false,
        text: err.message === "too-large" ? t("admin.racePhotoTooLarge") : t("admin.racePhotoInvalid"),
      });
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      await saveCustomRacePhoto(race.id, draft);
      return { mode: "custom", ...draft };
    }, t("admin.racePhotoSaved"));

  const remove = () =>
    run(async () => {
      await removeRacePhoto(race.id);
      return { mode: "none" };
    }, t("admin.racePhotoSaved"));

  const reset = () =>
    run(async () => {
      await resetRacePhoto(race.id);
      return null;
    }, t("admin.racePhotoSaved"));

  const statusLabel = {
    default: t("admin.racePhotoDefault"),
    custom: t("admin.racePhotoCustom"),
    none: t("admin.racePhotoNone"),
  }[draft ? "custom" : mode];

  return (
    <div className="race-photo-editor">
      <div className="d-flex align-items-baseline justify-content-between mb-1">
        <span className="small fw-semibold">{t("admin.racePhoto")}</span>
        <span className="race-photo-status">{override === undefined ? "…" : statusLabel}</span>
      </div>

      <div
        className={`race-photo-preview${shown ? " has-photo" : ""}`}
        style={shown ? { "--hero-img": `url("${shown.src}")`, "--hero-pos": shown.pos } : undefined}
      >
        {override === undefined || busy ? (
          <LogoLoader size="sm" />
        ) : (
          <span className="race-photo-preview-name">{race.name}</span>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

      {draft ? (
        <div className="race-photo-draft">
          <Form.Group className="mb-2">
            <Form.Label className="small mb-1">{t("admin.racePhotoPosition")}</Form.Label>
            <div className="fx-segmented is-small m-0" role="tablist">
              {PHOTO_POSITIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`fx-segment${draft.pos === p ? " is-active" : ""}`}
                  onClick={() => setDraft({ ...draft, pos: p })}
                >
                  {t(`admin.racePhotoPos_${p}`)}
                </button>
              ))}
            </div>
          </Form.Group>
          <div className="d-flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setDraft(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" variant="danger" className="flex-grow-1" onClick={save} disabled={busy}>
              {t("admin.racePhotoSave")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="race-photo-actions">
          <Button size="sm" variant="outline-secondary" onClick={() => fileRef.current?.click()} disabled={busy || override === undefined}>
            {mode === "custom" ? t("admin.racePhotoChange") : t("admin.racePhotoUpload")}
          </Button>
          {mode === "custom" && (
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => setDraft({ dataUrl: override.dataUrl, pos: override.pos || "center" })}
              disabled={busy}
            >
              {t("admin.racePhotoEdit")}
            </Button>
          )}
          {mode !== "default" && hasDefault && (
            <Button size="sm" variant="outline-secondary" onClick={reset} disabled={busy}>
              {t("admin.racePhotoReset")}
            </Button>
          )}
          {mode !== "none" && (
            <Button size="sm" variant="outline-danger" onClick={remove} disabled={busy}>
              {t("admin.racePhotoRemove")}
            </Button>
          )}
        </div>
      )}

      {message && (
        <div className={`race-photo-msg${message.ok ? " is-ok" : " is-error"}`}>{message.text}</div>
      )}
      <div className="race-photo-hint">{t("admin.racePhotoHint")}</div>
    </div>
  );
}

RacePhotoEditor.propTypes = {
  race: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
  }).isRequired,
};
