/**
 * @file bilingualMessages.js
 * @description Helpers to build form validation messages in both Italian and
 * English at the same time, regardless of the user's currently selected
 * language. Useful where an error needs to be understood by every user (e.g.
 * shared screens) without forcing them to switch language.
 */

import { translations } from "../translations";

const SUPPORTED = ["it", "en"];

/**
 * Resolve a translation key against a specific language dictionary.
 * Falls back to the key itself when the path is missing.
 * @param {string} lang - Language code ("it" | "en")
 * @param {string} key - Dot-separated key (e.g. "errors.incompleteForm")
 * @param {Object} [params] - Optional `{{name}}` interpolation params
 * @returns {string}
 */
export const translateIn = (lang, key, params = {}) => {
  const dict = translations[lang];
  if (!dict) return key;
  const value = key.split(".").reduce((acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined), dict);
  if (typeof value !== "string") return key;
  if (!Object.keys(params).length) return value;
  return value.replace(/\{\{(\w+)\}\}/g, (m, p) => (params[p] !== undefined ? params[p] : m));
};

/**
 * Build a bilingual entry for an error message.
 * @param {string} key - Translation key
 * @param {Object} [params] - Optional interpolation params
 * @returns {{it: string, en: string}}
 */
export const bilingual = (key, params = {}) => ({
  it: translateIn("it", key, params),
  en: translateIn("en", key, params),
});

/**
 * Build a bilingual entry from a base key plus an extra suffix that is
 * language-independent (e.g. a list of driver names appended to a label).
 * @param {string} key - Translation key for the prefix
 * @param {string} suffix - Already-formatted suffix to append after ": "
 * @returns {{it: string, en: string}}
 */
export const bilingualWithSuffix = (key, suffix) => ({
  it: `${translateIn("it", key)}: ${suffix}`,
  en: `${translateIn("en", key)}: ${suffix}`,
});

export const SUPPORTED_BILINGUAL_LANGS = SUPPORTED;
