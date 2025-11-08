// src/ChampionshipSubmissions.jsx
import React, { useState, useEffect } from "react";
import { Card, Table, Spinner, Alert, Image } from "react-bootstrap";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { DRIVER_TEAM, TEAM_LOGOS } from "./constants/racing";

/* Usa costanti centralizzate */
const driverTeam = DRIVER_TEAM;
const teamLogos = TEAM_LOGOS;

export default function ChampionshipSubmissions({ refresh }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDocs(collection(db, "ranking"));
        const list = snap.docs
          .map((d) => {
            const data = d.data();
            if (
              Array.isArray(data.championshipPiloti) &&
              Array.isArray(data.championshipCostruttori)
            ) {
              return {
                id: d.id,
                name: data.name || d.id,
                pilots: data.championshipPiloti,
                constructors: data.championshipCostruttori,
              };
            }
            return null;
          })
          .filter(Boolean);
        setSubs(list);
      } catch (e) {
        console.error(e);
        setError("Impossibile caricare le formazioni campionato.");
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  if (loading) {
    return (
      <Card className="mt-4 shadow">
        <Card.Body className="text-center">
          <Spinner animation="border" />
        </Card.Body>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" className="mt-4">
        {error}
      </Alert>
    );
  }

  if (!subs.length) {
    return (
      <Alert variant="info" className="mt-4">
        Nessuna formazione campionato inviata.
      </Alert>
    );
  }

  return (
    <Card className="mt-4 shadow h-100 border-danger">
      <Card.Body>
        <Card.Title className="text-center mb-3">
          Formazioni Campionato Inviate ({subs.length})
        </Card.Title>
        <div className="table-responsive">
          <Table striped bordered hover size="sm" className="mb-0 align-middle">
            <thead>
              <tr>
                <th>#</th>
                <th>Utente</th>
                <th>Piloti Top 3</th>
                <th>Costruttori Top 3</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s, idx) => (
                <tr key={s.id}>
                  <td>{idx + 1}</td>
                  <td>{s.name}</td>
                  <td>
                    {s.pilots.map((p, i) => {
                      const team = driverTeam[p];
                      const logo = teamLogos[team];
                      return (
                        <span
                          key={p}
                          className="d-inline-flex align-items-center me-3"
                          style={{ gap: "0.25rem" }}
                        >
                          <strong>{i + 1}°</strong>
                          {logo && (
                            <Image
                              src={logo}
                              alt={team}
                              height={24}
                              style={{ objectFit: "contain" }}
                            />
                          )}
                          <span>{p}</span>
                        </span>
                      );
                    })}
                  </td>
                  <td>
                    {s.constructors.map((c, i) => {
                      const logo = teamLogos[c];
                      return (
                        <span
                          key={c}
                          className="d-inline-flex align-items-center me-3"
                          style={{ gap: "0.25rem" }}
                        >
                          <strong>{i + 1}°</strong>
                          {logo && (
                            <Image
                              src={logo}
                              alt={c}
                              height={24}
                              style={{ objectFit: "contain" }}
                            />
                          )}
                          <span>{c}</span>
                        </span>
                      );
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  );
}