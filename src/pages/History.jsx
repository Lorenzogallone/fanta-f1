/* -----------------------------------------------------------------------
   src/History.jsx
   -----------------------------------------------------------------------
   • Mostra tutte le gare concluse con risultati, formazioni e punteggi
   • Usa il componente unificato RaceHistoryCard
---------------------------------------------------------------------------*/
import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Spinner,
  Alert,
} from "react-bootstrap";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../services/firebase";
import RaceHistoryCard from "../components/RaceHistoryCard";

/* ============================== HISTORY ============================== */
export default function History() {
  const [pastRaces, setPastRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const now = Timestamp.now();
        const snap = await getDocs(
          query(
            collection(db, "races"),
            where("raceUTC", "<", now),
            orderBy("raceUTC", "desc")
          )
        );
        setPastRaces(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
        setError("Impossibile caricare le gare passate.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  if (error)
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  if (!pastRaces.length)
    return (
      <Container className="py-5">
        <Alert variant="info">Nessuna gara passata trovata.</Alert>
      </Container>
    );

  return (
    <Container className="py-5">
      <Row className="g-4">
        {pastRaces.map((r) => (
          <Col key={r.id} xs={12}>
            <RaceHistoryCard race={r} />
          </Col>
        ))}
      </Row>
    </Container>
  );
}