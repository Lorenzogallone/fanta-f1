// src/App.jsx
import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import { Container as BContainer, Spinner } from "react-bootstrap";

import { ThemeProvider } from "./contexts/ThemeContext";
import Navigation from "./components/Navigation";
import "./styles/theme.css";

// Lazy loading delle pagine per code splitting
const Home = lazy(() => import("./pages/Home"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const FormationApp = lazy(() => import("./pages/FormationApp"));
const CalculatePoints = lazy(() => import("./pages/CalculatePoints"));
const History = lazy(() => import("./pages/History"));
const ChampionshipForm = lazy(() => import("./pages/ChampionshipForm"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const Statistics = lazy(() => import("./pages/Statistics"));

// Componente di loading
const PageLoader = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
    <Spinner animation="border" variant="danger" />
  </div>
);

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        {/* ------- NAVBAR ------------------------------------------------ */}
        <Navigation />

        {/* ------- CONTENUTO -------------------------------------------- */}
        <BContainer className="py-4">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"           element={<Home />} />
              <Route path="/classifica" element={<Leaderboard />} />
              <Route path="/schiera"    element={<FormationApp />} />
              <Route path="/calcola"    element={<CalculatePoints />} />
              <Route path="/storico"    element={<History />} />
              <Route path="/statistiche" element={<Statistics />} />
              <Route path="/championship" element={<ChampionshipForm />} />
              <Route path="/admin"      element={<AdminPanel />} />
            </Routes>
          </Suspense>
        </BContainer>
      </Router>
    </ThemeProvider>
  );
}