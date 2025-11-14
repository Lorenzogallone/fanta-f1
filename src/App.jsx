/**
 * @file App.jsx
 * @description Main application component with routing and lazy-loaded pages
 */

import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import { Container as BContainer, Spinner } from "react-bootstrap";

import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Navigation from "./components/Navigation";
import "./styles/theme.css";

// Lazy loading pages for code splitting
const Home = lazy(() => import("./pages/Home"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const ParticipantDetail = lazy(() => import("./pages/ParticipantDetail"));
const Formations = lazy(() => import("./pages/Formations"));
const FormationApp = lazy(() => import("./pages/FormationApp"));
const ChampionshipForm = lazy(() => import("./pages/ChampionshipForm"));
const CalculatePoints = lazy(() => import("./pages/CalculatePoints"));
const History = lazy(() => import("./pages/History"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const Statistics = lazy(() => import("./pages/Statistics"));

/**
 * Loading spinner displayed while pages are loading
 * @returns {JSX.Element} Centered spinner component
 */
const PageLoader = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
    <Spinner animation="border" variant="danger" />
  </div>
);

/**
 * Main application component with theme provider, language provider, and routing
 * @returns {JSX.Element} App with navigation and routes
 */
export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <Router>
          <Navigation />

          <BContainer className="py-4">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/"           element={<Home />} />
                <Route path="/classifica" element={<Leaderboard />} />
                <Route path="/partecipante/:userId" element={<ParticipantDetail />} />
                <Route path="/schiera"    element={<Formations />} />
                <Route path="/calcola"    element={<CalculatePoints />} />
                <Route path="/storico"    element={<History />} />
                <Route path="/statistiche" element={<Statistics />} />
                <Route path="/admin"      element={<AdminPanel />} />
                {/* Legacy routes for compatibility */}
                <Route path="/formations/races" element={<FormationApp />} />
                <Route path="/formations/championship" element={<ChampionshipForm />} />
              </Routes>
            </Suspense>
          </BContainer>
        </Router>
      </ThemeProvider>
    </LanguageProvider>
  );
}