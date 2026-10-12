/**
 * @file useWarm.js
 * @description Reads a key of the warm-up cache (services/warmup.js) and re-renders when it changes.
 */

import { useSyncExternalStore } from "react";
import { peek, subscribe } from "../services/warmup";

/**
 * @param {string} key - Cache key
 * @returns {*} The cached value (undefined until loaded)
 */
export function useWarm(key) {
  return useSyncExternalStore(
    (cb) => subscribe(key, cb),
    () => peek(key),
    () => peek(key)
  );
}
