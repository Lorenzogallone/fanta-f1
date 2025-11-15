/**
 * @file Home.jsx
 * @description Home page displaying main navigation options and current leaderboard
 */

import React from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import Leaderboard from "./Leaderboard";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../hooks/useLanguage";

/**
 * Home page component with quick navigation and leaderboard preview
 * @returns {JSX.Element} Home page with navigation cards and leaderboard
 */
export default function Home() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";

  return (
    <Container className="py-4">
      {/* Main Actions Grid - Compact for mobile */}
      <Row className="justify-content-center mb-4 g-3">
        <Col xs={12} md={10} lg={8}>
          <Row className="g-3">
            {/* Submit Formation - Highlighted */}
            <Col xs={12}>
              <Button
                as={Link}
                to="/lineup"
                variant="danger"
                size="lg"
                className="w-100 py-3"
                style={{ fontSize: "1.1rem", fontWeight: "600" }}
              >
                ⚡ {t("home.submitFormation")}
              </Button>
            </Col>

            {/* Statistics and Race Results - Side by Side */}
            <Col xs={12} sm={6}>
              <Button
                as={Link}
                to="/statistics"
                variant="outline-danger"
                className="w-100 py-3"
                style={{ height: "100%" }}
              >
                <div className="d-flex flex-column align-items-center gap-1">
                  <span style={{ fontSize: "1.5rem" }}>📊</span>
                  <span>{t("nav.statistics")}</span>
                </div>
              </Button>
            </Col>
            <Col xs={12} sm={6}>
              <Button
                as={Link}
                to="/results"
                variant="outline-danger"
                className="w-100 py-3"
                style={{ height: "100%" }}
              >
                <div className="d-flex flex-column align-items-center gap-1">
                  <span style={{ fontSize: "1.5rem" }}>🏁</span>
                  <span>{t("nav.raceResults")}</span>
                </div>
              </Button>
            </Col>

            {/* History - Full Width */}
            <Col xs={12}>
              <Button
                as={Link}
                to="/history"
                variant="outline-danger"
                className="w-100 py-3"
              >
                📜 {t("history.title")}
              </Button>
            </Col>

            {/* Calculate Points - Admin Only */}
            <Col xs={12}>
              <Button
                as={Link}
                to="/calculate"
                variant="outline-secondary"
                className="w-100 py-2"
                style={{ fontSize: "0.9rem" }}
              >
                🧮 {t("nav.calculatePoints")}
              </Button>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* Current leaderboard preview */}
      <Row className="justify-content-center">
        <Col xs={12} md={10} lg={8}>
          <Card className="shadow" style={{ backgroundColor: bgCard }}>
            <Card.Body className="p-0">
              <Leaderboard />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}