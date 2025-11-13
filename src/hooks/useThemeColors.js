// src/hooks/useThemeColors.js
import { useTheme } from "../contexts/ThemeContext";

/**
 * Custom hook per gestire i colori del tema in modo centralizzato.
 * Evita duplicazione del pattern accentColor/bgCard in ogni componente.
 *
 * @returns {Object} Oggetto con i colori del tema corrente
 */
export const useThemeColors = () => {
  const { isDark } = useTheme();

  return {
    // Flag tema scuro (per condizioni speciali)
    isDark,

    // Colore accent principale (rosso chiaro/scuro)
    accent: isDark ? "#ff4d5a" : "#dc3545",

    // Sfondi card
    bgCard: isDark ? "var(--bg-secondary)" : "#ffffff",
    bgHeader: isDark ? "var(--bg-tertiary)" : "#ffffff",

    // Sfondo generico
    bg: isDark ? "#1a1a1a" : "#ffffff",

    // Colori testo
    text: isDark ? "#e0e0e0" : "#212529",
    textMuted: isDark ? "#a0a0a0" : "#6c757d",

    // Colori stato
    success: isDark ? "#28a745" : "#198754",
    danger: isDark ? "#dc3545" : "#dc3545",
    warning: isDark ? "#ffc107" : "#ffc107",
    info: isDark ? "#17a2b8" : "#0dcaf0",
  };
};
