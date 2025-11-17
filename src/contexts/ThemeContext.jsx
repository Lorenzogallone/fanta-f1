/**
 * @file ThemeContext.jsx
 * Provides theme context for dark/light mode with system preference detection.
 * Supports 3 modes: "auto" (follow system), "light", "dark"
 */
import React, { createContext, useContext, useState, useEffect } from "react";
import PropTypes from "prop-types";

const ThemeContext = createContext();

/**
 * Hook to access theme context.
 * @returns {Object} Theme context value
 * @throws {Error} If used outside ThemeProvider
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

/**
 * Theme provider component with system preference detection.
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} Theme provider
 */
export function ThemeProvider({ children }) {
  /**
   * Detects system theme preference.
   * @returns {string} "dark" or "light"
   */
  const getSystemTheme = () => {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  };

  // Theme mode: "auto", "light", or "dark"
  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem("fanta-f1-theme-mode");
    return saved || "auto"; // Default to "auto" (follow system)
  });

  // Actual applied theme: "light" or "dark"
  const [appliedTheme, setAppliedTheme] = useState(() => {
    const saved = localStorage.getItem("fanta-f1-theme-mode");
    if (saved === "light" || saved === "dark") {
      return saved;
    }
    // Default to system theme
    return getSystemTheme();
  });

  // Listen for system theme changes when in "auto" mode
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    /**
     * Handles system theme change.
     * @param {MediaQueryListEvent} e - Media query event
     */
    const handleChange = (e) => {
      // Only update if in "auto" mode
      if (themeMode === "auto") {
        setAppliedTheme(e.matches ? "dark" : "light");
      }
    };

    // Modern listener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [themeMode]);

  // Update applied theme when mode changes
  useEffect(() => {
    if (themeMode === "auto") {
      setAppliedTheme(getSystemTheme());
    } else {
      setAppliedTheme(themeMode);
    }
  }, [themeMode]);

  // Apply theme to body
  useEffect(() => {
    document.body.setAttribute("data-theme", appliedTheme);
  }, [appliedTheme]);

  /**
   * Cycles through theme modes: auto → light → dark → auto
   */
  const toggleTheme = () => {
    const modes = ["auto", "light", "dark"];
    const currentIndex = modes.indexOf(themeMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];

    setThemeMode(nextMode);
    localStorage.setItem("fanta-f1-theme-mode", nextMode);
  };

  /**
   * Resets theme to system preference (auto mode).
   */
  const resetToSystem = () => {
    setThemeMode("auto");
    localStorage.setItem("fanta-f1-theme-mode", "auto");
  };

  const value = {
    theme: appliedTheme, // Backward compatibility
    themeMode, // New: "auto", "light", or "dark"
    toggleTheme,
    resetToSystem,
    isDark: appliedTheme === "dark",
    isAuto: themeMode === "auto",
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
