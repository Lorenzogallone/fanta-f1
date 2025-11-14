/**
 * @file Footer.jsx
 * @description Footer component with disclaimer, legal links, and copyright
 */

import React from "react";
import { Container, Row, Col } from "react-bootstrap";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * Footer component displaying F1 disclaimer, legal links, and copyright
 * @returns {JSX.Element} Footer component
 */
export default function Footer() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  const bgColor = isDark ? "#1a1a1a" : "#f8f9fa";
  const textColor = isDark ? "#cccccc" : "#6c757d";
  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const borderColor = isDark ? "#333333" : "#dee2e6";

  return (
    <footer
      className="mt-5"
      style={{
        backgroundColor: bgColor,
        borderTop: `2px solid ${borderColor}`,
        color: textColor,
      }}
    >
      <Container className="py-4">
        <Row className="g-3">
          {/* Disclaimer Section */}
          <Col xs={12} md={8}>
            <div style={{ fontSize: "0.85rem", lineHeight: "1.6" }}>
              <strong style={{ color: accentColor }}>
                {t("footer.disclaimer.title") || "Formula 1 Disclaimer"}
              </strong>
              <p className="mb-2 mt-1" style={{ fontSize: "0.8rem" }}>
                {t("footer.disclaimer.text") ||
                  "This is an unofficial fantasy game and is not affiliated with, endorsed by, or connected to Formula 1, Formula One Management, or any of its related entities. All F1-related trademarks, logos, and race data are property of Formula One World Championship Limited."}
              </p>
            </div>
          </Col>

          {/* Legal Links Section */}
          <Col xs={12} md={4} className="text-md-end">
            <div style={{ fontSize: "0.85rem" }}>
              <strong style={{ color: accentColor }}>
                {t("footer.legal") || "Legal"}
              </strong>
              <div className="mt-2">
                <a
                  href="#privacy"
                  className="d-block mb-1"
                  style={{
                    color: textColor,
                    textDecoration: "none",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.target.style.color = accentColor)}
                  onMouseLeave={(e) => (e.target.style.color = textColor)}
                >
                  {t("footer.privacy") || "Privacy Policy"}
                </a>
                <a
                  href="#terms"
                  className="d-block"
                  style={{
                    color: textColor,
                    textDecoration: "none",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.target.style.color = accentColor)}
                  onMouseLeave={(e) => (e.target.style.color = textColor)}
                >
                  {t("footer.terms") || "Terms of Service"}
                </a>
              </div>
            </div>
          </Col>

          {/* Copyright Section */}
          <Col xs={12}>
            <div
              className="text-center pt-3"
              style={{
                borderTop: `1px solid ${borderColor}`,
                fontSize: "0.8rem",
              }}
            >
              © {currentYear} {t("footer.copyright") || "Fanta F1 - All rights reserved"}
            </div>
          </Col>
        </Row>
      </Container>
    </footer>
  );
}
