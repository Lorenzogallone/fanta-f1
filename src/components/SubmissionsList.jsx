// src/SubmissionsList.jsx  –  light-F1 styling with team logos
import React, { useState, useEffect } from "react";
import {
  Card, Table, Button, Spinner, Alert,
} from "react-bootstrap";
import {
  collection, query, orderBy, getDocs,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { DRIVER_TEAM, TEAM_LOGOS } from "../constants/racing";

/* Usa costanti centralizzate */
const driverTeam = DRIVER_TEAM;
const teamLogos = TEAM_LOGOS;

/**
 * Restituisce JSX con logo + nome del pilota, oppure "—" se assente.
 */
function DriverCell({ driverName }) {
  if (!driverName) return <>—</>;
  const team = driverTeam[driverName];
  const logo = teamLogos[team];
  return (
    <span className="d-flex align-items-center">
      {logo && (
        <img
          src={logo}
          alt={team}
          style={{ height: 20, width: 20, objectFit: "contain", marginRight: 4 }}
        />
      )}
      {driverName}
    </span>
  );
}

/**
 * Props
 *  ─ raceId    : ID della gara selezionata
 *  ─ hasSprint : true se la gara ha la Sprint
 *  ─ refresh   : timestamp che forza il reload
 */
export default function SubmissionsList({ raceId, hasSprint, refresh }) {
  const [subs,    setSubs] = useState([]);
  const [loading, setLoad] = useState(true);
  const [error,   setErr ] = useState(null);

  /* ---------- fetch submissions ------------------------------------ */
  useEffect(() => {
    if (!raceId) {
      setSubs([]);
      setLoad(false);
      return;
    }

    (async () => {
      setLoad(true);
      setErr(null);
      try {
        const q = query(
          collection(db, "races", raceId, "submissions"),
          orderBy("user")
        );
        const snap = await getDocs(q);
        setSubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
        setErr("Impossibile caricare le formazioni.");
      } finally {
        setLoad(false);
      }
    })();
  }, [raceId, refresh]);


  /* ---------- UI states -------------------------------------------- */
  if (loading)
    return (
      <Card className="mt-4 shadow">
        <Card.Body className="text-center">
          <Spinner animation="border" />
        </Card.Body>
      </Card>
    );

  if (error)
    return <Alert variant="danger" className="mt-4">{error}</Alert>;

  if (!subs.length)
    return (
      <Alert variant="info" className="mt-4">
        Nessuna formazione ancora schierata per questa gara.
      </Alert>
    );

  /* ---------- render ----------------------------------------------- */
  const headerBase = ["#", "Utente", "P1", "P2", "P3", "Jolly"];
  const headerSprint = ["SP1", "SP2", "SP3", "Jolly Sprint"];

  return (
    <Card className="mt-4 shadow h-100 border-danger">
      <Card.Body>
        <Card.Title className="text-center mb-3">
          Formazioni ricevute&nbsp;
        </Card.Title>

        <div className="table-responsive">
          <Table striped bordered hover size="sm" className="mb-0">
            <thead>
              <tr>
                {[...headerBase, ...(hasSprint ? headerSprint : [])].map(
                  (h) => (
                    <th key={h}>{h}</th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {subs.map((s, i) => {
                return (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td>{s.user}</td>

                    {/* MAIN PICKS */}
                    <td>
                      <DriverCell driverName={s.mainP1} />
                    </td>
                    <td>
                      <DriverCell driverName={s.mainP2} />
                    </td>
                    <td>
                      <DriverCell driverName={s.mainP3} />
                    </td>
                    <td>
                      <DriverCell driverName={s.mainJolly} />
                      {s.mainJolly2 && (
                        <>
                          {" / "}
                          <DriverCell driverName={s.mainJolly2} />
                        </>
                      )}
                      { !s.mainJolly && !s.mainJolly2 && "—" }
                    </td>

                    {/* SPRINT PICKS */}
                    {hasSprint && (
                      <>
                        <td>
                          <DriverCell driverName={s.sprintP1} />
                        </td>
                        <td>
                          <DriverCell driverName={s.sprintP2} />
                        </td>
                        <td>
                          <DriverCell driverName={s.sprintP3} />
                        </td>
                        <td>
                          <DriverCell driverName={s.sprintJolly} />
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  );
}