/**
 * @file useRacePhoto.js
 * @description Background photo of a race: admin override (racePhotos/{raceId}) or the
 * bundled default. Starts from this device's cached override, so there's no flash.
 */

import { useEffect, useState } from "react";
import { cachedRacePhoto, resolveRacePhoto } from "../services/racePhotoService";
import { loadRacePhoto, peek } from "../services/warmup";
import { warn } from "../utils/logger";

/**
 * @param {Object|null} race - Race document (needs `id` and `name`)
 * @returns {{ src: string, pos: string }|null}
 */
export function useRacePhoto(race) {
  const raceId = race?.id;
  const [override, setOverride] = useState(() => peek(`racePhoto:${raceId}`) ?? cachedRacePhoto(raceId));

  useEffect(() => {
    if (!raceId) return undefined;
    let active = true;
    setOverride(peek(`racePhoto:${raceId}`) ?? cachedRacePhoto(raceId));
    loadRacePhoto(raceId)
      .then((o) => { if (active) setOverride(o); })
      .catch((err) => warn("Race photo not loaded:", err));
    return () => { active = false; };
  }, [raceId]);

  return race ? resolveRacePhoto(race, override) : null;
}
