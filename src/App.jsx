// src/App.jsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import { Container as BContainer } from "react-bootstrap";

import { ThemeProvider } from "./contexts/ThemeContext";
import Navigation       from "./components/Navigation";
import Home             from "./pages/Home";
import Leaderboard      from "./pages/Leaderboard";
import FormationApp     from "./pages/FormationApp";
import CalculatePoints  from "./pages/CalculatePoints";
import History          from "./pages/History";
import ChampionshipForm from "./pages/ChampionshipForm";
import AdminPanel       from "./pages/AdminPanel";
import "./styles/theme.css";

export default function App() {
  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}