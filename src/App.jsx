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
import { Container as BContainer } from "react-bootstrap";
import { Toaster } from 'react-hot-toast';
import { useTheme } from "./contexts/ThemeContext";

import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Navigation from "./components/Navigation";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import CompleteProfileModal from "./components/CompleteProfileModal";
import InstallPwaBanner from "./components/InstallPwaBanner";
import NotificationPromptModal from "./components/NotificationPromptModal";
import { syncFromAPI } from "./services/f1DataResolver.js";
import { warn } from "./utils/logger";
import { hideSplash } from "./utils/splash";
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
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));


/**
 * Main application component with theme provider, language provider, auth, and routing
 * @returns {JSX.Element} App with navigation and routes
 */
/**
 * Theme-aware Toaster that adapts to dark/light mode
 */
function ThemedToaster() {
  const { isDark } = useTheme();
  return (
    <Toaster
      toastOptions={{
        style: {
          background: isDark ? '#2d2d2d' : '#ffffff',
          color: isDark ? '#f8f9fa' : '#212529',
          border: isDark ? '1px solid #404040' : '1px solid #dee2e6',
        },
        success: {
          style: {
            background: isDark ? '#1a3d2e' : '#d1e7dd',
            color: isDark ? '#a3ffcf' : '#0f5132',
            border: isDark ? '1px solid #2d6650' : '1px solid #badbcc',
          },
        },
        error: {
          style: {
            background: isDark ? '#4a1a1a' : '#f8d7da',
            color: isDark ? '#ffb3b3' : '#842029',
            border: isDark ? '1px solid #7f2d2d' : '1px solid #f5c2c7',
          },
        },
      }}
    />
  );
}

export default function App() {
  // Sincronizza dati piloti/team da API all'avvio (background)
  useEffect(() => {
    syncFromAPI().catch(err => {
      warn('Background sync failed:', err);
    });

    // Fallback: forcefully hide the splash screen after 3.5 seconds
    // to ensure users are never permanently blocked if a page fails to hide it
    const fallbackTimer = setTimeout(() => {
      hideSplash();
    }, 3500);

    return () => clearTimeout(fallbackTimer);
  }, []);

  // Set up FCM foreground notification listener (only if notifications are enabled)
  useEffect(() => {
    import("./services/notificationService").then(({ setupForegroundListener }) => {
      setupForegroundListener();
    }).catch(() => {
      // Notifications not enabled or not supported — ignore
    });
  }, []);

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <Router>
              <Navigation />
              <ThemedToaster />
              <InstallPwaBanner />
              <CompleteProfileModal />
              <NotificationPromptModal />

              <BContainer className="py-4">
                <Suspense fallback={null}>
                  <Routes>
                    {/* Public route */}
                    <Route path="/login" element={<LoginPage />} />

                    {/* Protected routes - require authentication */}
                    <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="/leaderboard" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="/participant/:userId" element={<ProtectedRoute><ParticipantDetail /></ProtectedRoute>} />
                    <Route path="/lineup" element={<ProtectedRoute><Formations /></ProtectedRoute>} />
                    <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
                    <Route path="/results" element={<ProtectedRoute><RaceResults /></ProtectedRoute>} />
                    <Route path="/statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

                    {/* Admin-only routes */}
                    <Route path="/calculate" element={<AdminRoute><CalculatePoints /></AdminRoute>} />
                    <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />

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
                    <Route path="/statistiche" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
                    <Route path="/profilo" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
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
