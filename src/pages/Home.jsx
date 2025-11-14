/**
 * @file Home.jsx
 * @description Home page displaying main navigation options and current leaderboard
 */

import React from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import Leaderboard from "./Leaderboard";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * Home page component with quick navigation and leaderboard preview
 * @returns {JSX.Element} Home page with navigation cards and leaderboard
 */
export default function Home() {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const accentColor = isDark ? "#ff4d5a" : "#dc3545";

  return (
    <Container className="py-5">
      {/* Main navigation options */}
      <Row className="justify-content-center mb-5">
        <Col xs={12} md={10} lg={8}>
          <Card className="shadow">
            <Card.Body className="text-center">
              <Card.Title style={{ color: accentColor }} className="mb-4">
                {t("home.title")}
              </Card.Title>
              <Row className="g-3">
                <Col xs={12} md={6} lg={3}>
                  <Button
                    as={Link}
                    to="/schiera"
                    variant="outline-danger"
                    className="w-100 py-3"
                  >
                    {t("home.submitFormation")}
                  </Button>
                </Col>
                <Col xs={12} md={6} lg={3}>
                  <Button
                    as={Link}
                    to="/storico"
                    variant="outline-danger"
                    className="w-100 py-3"
                  >
                    {t("history.title")}
                  </Button>
                </Col>
                <Col xs={12} md={6} lg={3}>
                  <Button
                    as={Link}
                    to="/championship"
                    variant="outline-danger"
                    className="w-100 py-3"
                  >
                    {t("championshipForm.title")}
                  </Button>
                </Col>
                <Col xs={12} md={6} lg={3}>
                  <Button
                    as={Link}
                    to="/calcola"
                    variant="outline-danger"
                    className="w-100 py-3"
                  >
                    {t("nav.calculatePoints")}
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Current leaderboard preview */}
      <Row className="justify-content-center">
        <Col xs={12} md={10} lg={8}>
          <Card className="shadow">
            <Card.Body className="p-0">
              <Leaderboard />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}