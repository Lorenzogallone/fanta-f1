// src/Home.jsx
import React from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
import Leaderboard from "./Leaderboard";

const accent = "#dc3545";

export default function Home() {
  return (
    <Container className="py-5">
      {/* Opzioni */}
      <Row className="justify-content-center mb-5">
        <Col xs={12} md={10} lg={8}>
          <Card className="shadow">
            <Card.Body className="text-center">
              <Card.Title style={{ color: accent }} className="mb-4">
                Benvenuto in Fanta F1
              </Card.Title>
              <Row className="g-3">
                <Col xs={12} md={3}>
                  <Button
                    as={Link}
                    to="/storico"
                    variant="outline-danger"
                    className="w-100 py-3"
                  >
                    Storico Gare
                  </Button>
                </Col>
                <Col xs={12} md={3}>
                  <Button
                    as={Link}
                    to="/schiera"
                    variant="outline-danger"
                    className="w-100 py-3"
                  >
                    Schiera Formazione
                  </Button>
                </Col>
                <Col xs={12} md={3}>
                  <Button
                    as={Link}
                    to="/calcola"
                    variant="outline-danger"
                    className="w-100 py-3"
                  >
                    Calcola Punteggi
                  </Button>
                </Col>
                <Col xs={12} md={3}>
                  <Button
                    as={Link}
                    to="/championship"
                    variant="outline-danger"
                    className="w-100 py-3"
                  >
                    Formazioni Campionato
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Anteprima dell’attuale Classifica */}
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