/**
 * @file App.jsx
 * @description Main application component with routing, authentication, and lazy-loaded pages
 */

import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Container as BContainer } from "react-bootstrap";
import { Toaster } from 'react-hot-toast';
import { useTheme } from "./contexts/ThemeContext";

import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider } from "./contexts/AuthContext";
import { F1DataProvider } from "./contexts/F1DataContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Navigation from "./components/Navigation";
import Footer from "./components/Footer";
import BottomTabBar from "./components/BottomTabBar";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import CompleteProfileModal from "./components/CompleteProfileModal";
import InstallPwaBanner from "./components/InstallPwaBanner";
import NotificationPromptModal from "./components/NotificationPromptModal";
import LogoLoader from "./components/LogoLoader";
import { hideSplash } from "./utils/splash";
import { useScrollReveal } from "./hooks/useScrollReveal";
import { useAuth } from "./hooks/useAuth";
import { warmUp } from "./services/warmup";
import "./styles/theme.css";
import "./styles/motion.css";

// Lazy loading pages for code splitting
const Home = lazy(() => import("./pages/Home"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const ParticipantDetail = lazy(() => import("./pages/ParticipantDetail"));
const Formations = lazy(() => import("./pages/Formations"));
const FormationApp = lazy(() => import("./pages/FormationApp"));
const ChampionshipForm = lazy(() => import("./pages/ChampionshipForm"));
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
        className: "fx-toast",
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

/** Bottom tab order: decides which way a page slides in */
const TAB_ORDER = [
  ["/", "/leaderboard", "/classifica"],
  ["/history", "/storico"],
  ["/lineup", "/schiera", "/formations"],
  ["/results", "/risultati"],
  ["/participant", "/partecipante", "/profile", "/profilo"],
];
const tabIndex = (pathname) =>
  TAB_ORDER.findIndex((paths) => paths.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p))));

/**
 * Animates the page in on every route change, without remounting it
 * (pages keep their state, e.g. Home on "/" and "/leaderboard").
 * Between tabs the page slides from the side it sits on; other pages rise in.
 */
function PageTransition({ children }) {
  const { pathname } = useLocation();
  const ref = useRef(null);
  const prev = useRef(pathname);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = tabIndex(prev.current);
    const to = tabIndex(pathname);
    const dir =
      from === -1 || to === -1 || from === to ? "from-below" : to > from ? "from-right" : "from-left";
    prev.current = pathname;

    el.classList.remove("is-entering", "from-right", "from-left", "from-below");
    void el.offsetWidth; // restart the CSS animation
    el.classList.add("is-entering", dir);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return <div ref={ref} className="fx-page">{children}</div>;
}

/**
 * Keeps the splash up until the signed-in user's data is loaded for every main
 * section (services/warmup.js), then lets the app in with no loaders to show.
 * The login page hides the splash by itself.
 */
function Warmup() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading || !user) return;
    warmUp(user.uid).finally(hideSplash);
  }, [user, loading]);
  return null;
}

/** Marks <html data-scrolled> so the top bar turns to glass once content scrolls under it */
function useScrolledFlag() {
  useEffect(() => {
    const onScroll = () => {
      document.documentElement.setAttribute("data-scrolled", window.scrollY > 8 ? "true" : "false");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

export default function App() {
  useScrollReveal();
  useScrolledFlag();

  useEffect(() => {
    // Fallback: forcefully hide the splash screen after 10 seconds
    // to ensure users are never permanently blocked if the warm-up hangs
    const fallbackTimer = setTimeout(() => {
      hideSplash();
    }, 10000);

    return () => clearTimeout(fallbackTimer);
  }, []);

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <F1DataProvider>
            <Router>
              <Warmup />
              <Navigation />
              <ThemedToaster />
              <InstallPwaBanner />
              <CompleteProfileModal />
              <NotificationPromptModal />

              <BContainer className="py-4">
                <Suspense fallback={<LogoLoader size="lg" className="fx-loader-page" />}>
                  <PageTransition>
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
                    <Route path="/calculate" element={<AdminRoute><Navigate to="/admin" replace /></AdminRoute>} />
                    <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />

                    {/* Legacy routes */}
                    <Route path="/formations/races" element={<ProtectedRoute><FormationApp /></ProtectedRoute>} />
                    <Route path="/formations/championship" element={<ProtectedRoute><ChampionshipForm /></ProtectedRoute>} />

                    {/* Italian routes for backward compatibility */}
                    <Route path="/classifica" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="/partecipante/:userId" element={<ProtectedRoute><ParticipantDetail /></ProtectedRoute>} />
                    <Route path="/schiera" element={<ProtectedRoute><Formations /></ProtectedRoute>} />
                    <Route path="/calcola" element={<AdminRoute><Navigate to="/admin" replace /></AdminRoute>} />
                    <Route path="/storico" element={<ProtectedRoute><History /></ProtectedRoute>} />
                    <Route path="/risultati" element={<ProtectedRoute><RaceResults /></ProtectedRoute>} />
                    <Route path="/statistiche" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
                    <Route path="/profilo" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                  </Routes>
                  </PageTransition>
                </Suspense>
              </BContainer>

              <Footer />
              <BottomTabBar />
            </Router>
            </F1DataProvider>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
