/**
 * @file useThemeColors.js
 * Custom hook for centralized theme color management.
 */
import { useTheme } from "../contexts/ThemeContext";

/**
 * Provides theme-aware colors to avoid duplication across components.
 * @returns {Object} Theme color values
 */
export const useThemeColors = () => {
  const { isDark } = useTheme();

  return {
    // Dark theme flag (for special conditions)
    isDark,

    // Main accent color (light/dark red)
    accent: isDark ? "#ff4d5a" : "#dc3545",

    // Card backgrounds
    bgCard: isDark ? "var(--bg-secondary)" : "#ffffff",
    bgHeader: isDark ? "var(--bg-tertiary)" : "#ffffff",

    // Generic background
    bg: isDark ? "#1a1a1a" : "#ffffff",

    // Text colors
    text: isDark ? "#e0e0e0" : "#212529",
    textMuted: isDark ? "#a0a0a0" : "#6c757d",

    // State colors
    success: isDark ? "#28a745" : "#198754",
    danger: isDark ? "#dc3545" : "#dc3545",
    warning: isDark ? "#ffc107" : "#ffc107",
    info: isDark ? "#17a2b8" : "#0dcaf0",
  };
};
