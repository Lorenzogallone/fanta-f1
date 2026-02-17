/**
 * @file App.jsx
 * @description Main application component with routing, authentication, and lazy-loaded pages
 */

import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import { Container as BContainer, Spinner } from "react-bootstrap";
import { Toaster } from 'react-hot-toast';

import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Navigation from "./components/Navigation";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import CompleteProfileModal from "./components/CompleteProfileModal";
import { syncFromAPI } from "./services/f1DataResolver.js";
import { warn } from "./utils/logger";
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
const LoginPage = lazy(() => import("./pages/LoginPage"));

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
 * Main application component with theme provider, language provider, auth, and routing
 * @returns {JSX.Element} App with navigation and routes
 */
export default function App() {
  // Sincronizza dati piloti/team da API all'avvio (background)
  useEffect(() => {
    syncFromAPI().catch(err => {
      warn('Background sync failed:', err);
    });
  }, []);

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <Router>
              <Navigation />
              <Toaster />
              <CompleteProfileModal />

              <BContainer className="py-4">
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Public route */}
                    <Route path="/login" element={<LoginPage />} />

                    {/* Protected routes - require authentication */}
                    <Route path="/"           element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="/leaderboard" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="/participant/:userId" element={<ProtectedRoute><ParticipantDetail /></ProtectedRoute>} />
                    <Route path="/lineup"     element={<ProtectedRoute><Formations /></ProtectedRoute>} />
                    <Route path="/history"    element={<ProtectedRoute><History /></ProtectedRoute>} />
                    <Route path="/results"    element={<ProtectedRoute><RaceResults /></ProtectedRoute>} />
                    <Route path="/statistics" element={<Statistics />} />

                    {/* Admin-only routes */}
                    <Route path="/calculate"  element={<AdminRoute><CalculatePoints /></AdminRoute>} />
                    <Route path="/admin"      element={<AdminRoute><AdminPanel /></AdminRoute>} />

                    {/* Legacy routes */}
                    <Route path="/formations/races" element={<ProtectedRoute><FormationApp /></ProtectedRoute>} />
                    <Route path="/formations/championship" element={<ProtectedRoute><ChampionshipForm /></ProtectedRoute>} />

                    {/* Italian routes for backward compatibility */}
                    <Route path="/classifica" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="/partecipante/:userId" element={<ProtectedRoute><ParticipantDetail /></ProtectedRoute>} />
                    <Route path="/schiera" element={<ProtectedRoute><Formations /></ProtectedRoute>} />
                    <Route path="/calcola" element={<AdminRoute><CalculatePoints /></AdminRoute>} />
                    <Route path="/storico" element={<ProtectedRoute><History /></ProtectedRoute>} />
                    <Route path="/risultati" element={<ProtectedRoute><RaceResults /></ProtectedRoute>} />
                    <Route path="/statistiche" element={<Statistics />} />
                  </Routes>
                </Suspense>
              </BContainer>

              <Footer />
            </Router>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
