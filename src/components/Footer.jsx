/**
 * @file Footer.jsx
 * @description Footer component with disclaimer and copyright
 */

import React from "react";
import { Container } from "react-bootstrap";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * Footer component displaying F1 disclaimer and copyright
 * @returns {JSX.Element} Footer component
 */
export default function Footer() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  const bgColor = isDark ? "#1a1a1a" : "#f8f9fa";
  const textColor = isDark ? "#999999" : "#6c757d";
  const borderColor = isDark ? "#333333" : "#dee2e6";

  return (
    <footer
      className="mt-4"
      style={{
        backgroundColor: bgColor,
        borderTop: `1px solid ${borderColor}`,
        color: textColor,
      }}
    >
      <Container className="py-3 text-center">
        <div style={{ fontSize: "0.7rem", lineHeight: "1.4" }}>
          <div className="mb-1">
            {t("footer.disclaimer.text") ||
              "This is an unofficial fantasy game and is not affiliated with, endorsed by, or connected to Formula 1, Formula One Management, or any of its related entities. All F1-related trademarks, logos, and race data are property of Formula One World Championship Limited."}
          </div>
          <div style={{ fontSize: "0.65rem" }}>
            © {currentYear} {t("footer.copyright") || "Fanta F1 - All rights reserved"}
          </div>
        </div>
      </Container>
    </footer>
  );
}
