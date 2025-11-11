// src/components/AdminLogin.jsx
import React, { useState } from "react";
import { Container, Row, Col, Card, Form, Button } from "react-bootstrap";

export const ADMIN_PASSWORD = "SUCASOLERA";

export default function AdminLogin({ onSuccess, useLocalStorage = false }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

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
              <h4 className="text-center mb-4">🔒 Accesso Protetto</h4>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Inserisci la password"
                    autoFocus
                    isInvalid={error}
                  />
                  <Form.Control.Feedback type="invalid">
                    Password non corretta
                  </Form.Control.Feedback>
                </Form.Group>
                <Button variant="danger" type="submit" className="w-100">
                  Accedi
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
