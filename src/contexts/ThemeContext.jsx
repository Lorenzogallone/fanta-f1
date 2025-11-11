// src/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme deve essere usato all'interno di ThemeProvider");
  }
  return context;
}

export function ThemeProvider({ children }) {
  // Rileva il tema del sistema
  const getSystemTheme = () => {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  };

  // Legge la preferenza: priorità a localStorage, poi sistema, infine default "light"
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("fanta-f1-theme");
    if (saved) return saved;
    return getSystemTheme();
  });

  // Ascolta i cambiamenti del tema del sistema
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e) => {
      // Cambia solo se l'utente non ha impostato manualmente un tema
      const saved = localStorage.getItem("fanta-f1-theme");
      if (!saved) {
        setTheme(e.matches ? "dark" : "light");
      }
    };

    // Listener moderno
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      // Fallback per browser più vecchi
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Applica il tema al body (NON salvare automaticamente nel localStorage)
  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    // Salva solo quando l'utente sceglie manualmente
    localStorage.setItem("fanta-f1-theme", newTheme);
  };

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
