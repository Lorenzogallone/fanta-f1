/**
 * @file ThemeContext.jsx
 * Provides theme context for dark/light mode with system preference detection.
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

  // Read preference: priority to localStorage, then system, finally default "light"
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("fanta-f1-theme");
    if (saved) return saved;
    return getSystemTheme();
  });

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    /**
     * Handles system theme change.
     * @param {MediaQueryListEvent} e - Media query event
     */
    const handleChange = (e) => {
      // Only change if user hasn't manually set a theme
      const saved = localStorage.getItem("fanta-f1-theme");
      if (!saved) {
        setTheme(e.matches ? "dark" : "light");
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
  }, []);

  // Apply theme to body (do NOT auto-save to localStorage)
  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  /**
   * Toggles between light and dark theme.
   */
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    // Save only when user manually chooses
    localStorage.setItem("fanta-f1-theme", newTheme);
  };

  /**
   * Resets theme to system preference.
   */
  const resetToSystem = () => {
    localStorage.removeItem("fanta-f1-theme");
    setTheme(getSystemTheme());
  };

  const value = {
    theme,
    toggleTheme,
    resetToSystem,
    isDark: theme === "dark",
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
