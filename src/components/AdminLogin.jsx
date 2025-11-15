/**
 * @file AdminLogin.jsx
 * Provides admin authentication via password prompt.
 */
import React, { useState } from "react";
import { Container, Row, Col, Card, Form, Button } from "react-bootstrap";
import { useLanguage } from "../hooks/useLanguage";

export const ADMIN_PASSWORD = "SUCASOLERA";

/**
 * Admin login form component with password validation.
 * @param {Object} props - Component props
 * @param {Function} props.onSuccess - Callback when authentication succeeds
 * @param {boolean} props.useLocalStorage - Whether to persist auth in localStorage
 * @returns {JSX.Element} Admin login form
 */
export default function AdminLogin({ onSuccess, useLocalStorage = false }) {
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  /**
   * Handles form submission and password validation.
   * @param {Event} e - Form submit event
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      if (useLocalStorage) {
        localStorage.setItem("adminAuth", "true");
      }
      onSuccess();
    } else {
      setError(true);
      setPassword("");
    }
  };

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col xs={12} md={6} lg={4}>
          <Card className="shadow border-danger">
            <Card.Body>
              <h4 className="text-center mb-4">🔒 {t("admin.login")}</h4>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>{t("admin.password")}</Form.Label>
                  <Form.Control
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("admin.password")}
                    autoFocus
                    isInvalid={error}
                  />
                  <Form.Control.Feedback type="invalid">
                    {t("admin.wrongPassword")}
                  </Form.Control.Feedback>
                </Form.Group>
                <Button variant="danger" type="submit" className="w-100">
                  {t("admin.loginButton")}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
