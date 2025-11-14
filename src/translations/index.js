/**
 * @file index.js
 * @description Translation files index - exports all supported languages
 */

import { it } from "./it";
import { en } from "./en";

/**
 * Available translations mapped by language code
 * @type {Object}
 */
export const translations = {
  it,
  en,
};

/**
 * Supported languages with metadata
 * @type {Array}
 */
export const supportedLanguages = [
  {
    code: "it",
    name: "Italiano",
    flag: "🇮🇹",
    default: true,
  },
  {
    code: "en",
    name: "English",
    flag: "🇬🇧",
    default: false,
  },
];

/**
 * Default language code
 * @type {string}
 */
export const DEFAULT_LANGUAGE = "it";
