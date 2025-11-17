/**
 * @file LanguageContext.jsx
 * @description Language context for managing app internationalization
 * Provides language selection and persistence across sessions
 */

import React, { createContext, useState, useEffect } from "react";
import PropTypes from "prop-types";
import { translations, DEFAULT_LANGUAGE, supportedLanguages } from "../translations";
import { warn } from "../utils/logger";

/**
 * Language context
 * @type {React.Context}
 */
export const LanguageContext = createContext(undefined);

/**
 * Language provider component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} Provider component
 */
export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(DEFAULT_LANGUAGE);

  /**
   * Load saved language from localStorage on mount
   */
  useEffect(() => {
    const savedLanguage = localStorage.getItem("fanta-f1-language");
    if (savedLanguage && translations[savedLanguage]) {
      setCurrentLanguage(savedLanguage);
    }
  }, []);

  /**
   * Change current language
   * @param {string} languageCode - Language code (e.g., 'it', 'en')
   */
  const changeLanguage = (languageCode) => {
    if (translations[languageCode]) {
      setCurrentLanguage(languageCode);
      localStorage.setItem("fanta-f1-language", languageCode);
    } else {
      warn(`Language '${languageCode}' not supported, falling back to ${DEFAULT_LANGUAGE}`);
    }
  };

  /**
   * Translation function - get translated string by key path
   * @param {string} key - Translation key path (e.g., 'nav.home', 'common.save')
   * @param {Object} params - Optional parameters for string interpolation
   * @returns {string} Translated string
   */
  const t = (key, params = {}) => {
    const keys = key.split(".");
    let translation = translations[currentLanguage];

    // Navigate through nested keys
    for (const k of keys) {
      if (translation && typeof translation === "object") {
        translation = translation[k];
      } else {
        // Fallback to key if translation not found
        warn(`Translation key '${key}' not found for language '${currentLanguage}'`);
        return key;
      }
    }

    // Handle string interpolation
    if (typeof translation === "string" && Object.keys(params).length > 0) {
      return translation.replace(/\{\{(\w+)\}\}/g, (match, param) => params[param] || match);
    }

    return translation || key;
  };

  const value = {
    currentLanguage,
    changeLanguage,
    t,
    availableLanguages: supportedLanguages,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

LanguageProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
