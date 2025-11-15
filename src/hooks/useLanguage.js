/**
 * @file useLanguage.js
 * @description Hook to access language context
 */

import { useContext } from "react";
import { LanguageContext } from "../contexts/LanguageContext";

/**
 * Hook to use language context
 * @returns {Object} Language context value with currentLanguage, t, changeLanguage, availableLanguages
 * @throws {Error} If used outside LanguageProvider
 */
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
