/**
 * @file useTranslation.js
 * @description Convenient hook for accessing translation function
 * Re-exports useLanguage for easier access to translations
 */

import { useLanguage } from "./useLanguage";

/**
 * Hook to access translation function
 * @returns {Function} Translation function t(key, params)
 */
export const useTranslation = () => {
  const { t } = useLanguage();
  return t;
};
