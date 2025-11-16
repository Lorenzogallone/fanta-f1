/**
 * @file App.jsx
 * @description Main application component with routing and lazy-loaded pages
 */

import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import { Container as BContainer, Spinner } from "react-bootstrap";

import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Navigation from "./components/Navigation";
import Footer from "./components/Footer";
import { syncFromAPI } from "./services/f1DataResolver.js";
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
const RaceResults = lazy(() => import("./pages/RaceResults"));
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
  // Sincronizza dati piloti/team da API all'avvio (background)
  useEffect(() => {
    syncFromAPI().catch(err => {
      console.warn('Background sync failed:', err);
      // Non bloccare l'app se il sync fallisce
    });
  }, []);

  return (
    <LanguageProvider>
      <ThemeProvider>
        <Router>
          <Navigation />

          <BContainer className="py-4">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/"           element={<Home />} />
                <Route path="/leaderboard" element={<Home />} />
                <Route path="/participant/:userId" element={<ParticipantDetail />} />
                <Route path="/lineup"     element={<Formations />} />
                <Route path="/calculate"  element={<CalculatePoints />} />
                <Route path="/history"    element={<History />} />
                <Route path="/results"    element={<RaceResults />} />
                <Route path="/statistics" element={<Statistics />} />
                <Route path="/admin"      element={<AdminPanel />} />
                {/* Legacy routes for compatibility */}
                <Route path="/formations/races" element={<FormationApp />} />
                <Route path="/formations/championship" element={<ChampionshipForm />} />
                {/* Italian routes redirects for backward compatibility */}
                <Route path="/classifica" element={<Home />} />
                <Route path="/partecipante/:userId" element={<ParticipantDetail />} />
                <Route path="/schiera" element={<Formations />} />
                <Route path="/calcola" element={<CalculatePoints />} />
                <Route path="/storico" element={<History />} />
                <Route path="/risultati" element={<RaceResults />} />
                <Route path="/statistiche" element={<Statistics />} />
              </Routes>
            </Suspense>
          </BContainer>

          <Footer />
        </Router>
      </ThemeProvider>
    </LanguageProvider>
  );
}