// src/Leaderboard.jsx
import React, { useState, useEffect } from "react";
import { Card, Table, Spinner, Badge } from "react-bootstrap";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

const medals = ["🥇", "🥈", "🥉"];
const accent = "#dc3545"; // Rosso Ferrari

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  /* live ranking */
  useEffect(() => {
    const q = query(collection(db, "ranking"), orderBy("puntiTotali", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setRows(
        snap.docs.map((d) => ({
          name: d.data().name,
          pts: d.data().puntiTotali,
          jolly: d.data().jolly ?? 0,
        }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const leaderPts = rows[0]?.pts ?? 0;

  return (
    <Card className="shadow h-100" style={{ borderColor: accent }}>
      <Card.Header
        as="h5"
        className="text-center fw-semibold"
        style={{ background: "#fff", borderBottom: `2px solid ${accent}` }}
      >
        Classifica attuale
      </Card.Header>

      <Card.Body className="p-0">
        {loading ? (
          <div className="py-5 text-center">
            <Spinner animation="border" />
          </div>
        ) : (
          <div className="table-responsive">
            <Table
              hover
              striped
              className="mb-0 align-middle"
              style={{ borderTop: `1px solid ${accent}` }}
            >
              <thead style={{ background: "#fafafa" }}>
                <tr>
                  <th style={{ width: 60 }} className="text-center">
                    #
                  </th>
                  <th>Giocatore</th>
                  <th className="text-end">Punti</th>
                  <th className="text-end">Gap</th>
                  <th className="text-center">Jolly</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => {
                  const medal = medals[idx] ?? idx + 1;
                  const gap = idx === 0 ? "—" : `-${leaderPts - r.pts}`;
                  const isTop3 = idx < 3;

                  return (
                    <tr key={r.name} className={isTop3 ? "fw-bold" : ""}>
                      <td className="text-center">{medal}</td>
                      <td>{r.name}</td>
                      <td className="text-end">{r.pts}</td>
                      <td className="text-end">{gap}</td>
                      <td className="text-center">
                        <Badge bg={r.jolly ? "success" : "secondary"}>
                          {r.jolly}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}