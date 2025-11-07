// src/App.jsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import { Container as BContainer } from "react-bootstrap";

import Navigation       from "./Navigation";
import Home             from "./Home";
import Leaderboard      from "./Leaderboard";
import FormationApp     from "./FormationApp";
import CalculatePoints  from "./CalculatePoints";
import History          from "./History";
import ChampionshipForm from "./ChampionshipForm";
import AdminPanel       from "./AdminPanel";

export default function App() {
  return (
    <Router>
      {/* ------- NAVBAR ------------------------------------------------ */}
      <Navigation />

      {/* ------- CONTENUTO -------------------------------------------- */}
      <BContainer className="py-4">
        <Routes>
          <Route path="/"           element={<Home />} />
          <Route path="/classifica" element={<Leaderboard />} />
          <Route path="/schiera"    element={<FormationApp />} />
          <Route path="/calcola"    element={<CalculatePoints />} />
          <Route path="/storico"    element={<History />} />
          <Route path="/championship" element={<ChampionshipForm />} />
          <Route path="/admin"      element={<AdminPanel />} />
        </Routes>
      </BContainer>
    </Router>
  );
}