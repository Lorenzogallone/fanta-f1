/**
 * @file LoginPage.jsx
 * @description Login and registration page with Email/Password and Google Sign-In
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Alert,
  Nav,
  Tab,
  Spinner,
} from "react-bootstrap";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";
import { useTheme } from "../contexts/ThemeContext";

export default function LoginPage() {
  const { user, needsProfile, login, loginWithGoogle, register } = useAuth();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  // Redirect authenticated users who have a complete profile
  useEffect(() => {
    if (user && !needsProfile) {
      navigate(from, { replace: true });
    }
  }, [user, needsProfile, navigate, from]);

  const [activeTab, setActiveTab] = useState("login");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regNickname, setRegNickname] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err.code, t));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);

    if (regPassword !== regConfirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    if (regPassword.length < 6) {
      setError(t("auth.weakPassword"));
      return;
    }
    if (!regNickname.trim() || !regFirstName.trim() || !regLastName.trim()) {
      setError(t("auth.allFieldsRequired"));
      return;
    }

    setLoading(true);
    try {
      await register(regEmail, regPassword, {
        nickname: regNickname.trim(),
        firstName: regFirstName.trim(),
        lastName: regLastName.trim(),
      });
      navigate(from, { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err.code, t));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const { isNewUser } = await loginWithGoogle();
      if (!isNewUser) {
        navigate(from, { replace: true });
      }
      // If isNewUser, the CompleteProfileModal in App.jsx will handle it
    } catch (err) {
      setError(getAuthErrorMessage(err.code, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col xs={12} sm={10} md={8} lg={5}>
          <div className="text-center mb-4">
            <img
              src={isDark ? "/FantaF1_Logo_dark.png" : "/FantaF1_Logo.png"}
              alt="Fanta F1"
              height="60"
              style={{ objectFit: "contain" }}
            />
          </div>

          <Card className="shadow" style={{ borderTop: `4px solid ${accentColor}` }}>
            <Card.Body>
              <Tab.Container activeKey={activeTab} onSelect={(k) => { setActiveTab(k); setError(null); }}>
                <Nav variant="pills" className="justify-content-center mb-4">
                  <Nav.Item>
                    <Nav.Link
                      eventKey="login"
                      style={{
                        color: activeTab === "login" ? "#fff" : accentColor,
                        backgroundColor: activeTab === "login" ? accentColor : "transparent",
                      }}
                    >
                      {t("auth.login")}
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link
                      eventKey="register"
                      style={{
                        color: activeTab === "register" ? "#fff" : accentColor,
                        backgroundColor: activeTab === "register" ? accentColor : "transparent",
                      }}
                    >
                      {t("auth.register")}
                    </Nav.Link>
                  </Nav.Item>
                </Nav>

                {error && (
                  <Alert variant="danger" dismissible onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}

                <Tab.Content>
                  {/* LOGIN TAB */}
                  <Tab.Pane eventKey="login">
                    <Form onSubmit={handleLogin}>
                      <Form.Group className="mb-3">
                        <Form.Label>{t("auth.email")}</Form.Label>
                        <Form.Control
                          type="email"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="email@example.com"
                          required
                          autoFocus
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>{t("auth.password")}</Form.Label>
                        <Form.Control
                          type="password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                        />
                      </Form.Group>
                      <Button
                        variant="danger"
                        type="submit"
                        className="w-100 mb-3"
                        disabled={loading}
                      >
                        {loading ? <Spinner animation="border" size="sm" /> : t("auth.login")}
                      </Button>
                    </Form>

                    <div className="text-center text-muted mb-3">
                      <small>{t("auth.or")}</small>
                    </div>

                    <Button
                      variant="outline-secondary"
                      className="w-100"
                      onClick={handleGoogle}
                      disabled={loading}
                    >
                      <GoogleIcon /> {t("auth.loginWithGoogle")}
                    </Button>

                    <div className="text-center mt-3">
                      <small>
                        {t("auth.noAccount")}{" "}
                        <a
                          href="#"
                          onClick={(e) => { e.preventDefault(); setActiveTab("register"); setError(null); }}
                          style={{ color: accentColor }}
                        >
                          {t("auth.register")}
                        </a>
                      </small>
                    </div>
                  </Tab.Pane>

                  {/* REGISTER TAB */}
                  <Tab.Pane eventKey="register">
                    <Form onSubmit={handleRegister}>
                      <Form.Group className="mb-3">
                        <Form.Label>{t("auth.nickname")} *</Form.Label>
                        <Form.Control
                          type="text"
                          value={regNickname}
                          onChange={(e) => setRegNickname(e.target.value)}
                          placeholder={t("auth.nicknamePlaceholder")}
                          required
                          autoFocus
                        />
                      </Form.Group>
                      <Row>
                        <Col xs={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>{t("auth.firstName")} *</Form.Label>
                            <Form.Control
                              type="text"
                              value={regFirstName}
                              onChange={(e) => setRegFirstName(e.target.value)}
                              required
                            />
                          </Form.Group>
                        </Col>
                        <Col xs={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>{t("auth.lastName")} *</Form.Label>
                            <Form.Control
                              type="text"
                              value={regLastName}
                              onChange={(e) => setRegLastName(e.target.value)}
                              required
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                      <Form.Group className="mb-3">
                        <Form.Label>{t("auth.email")} *</Form.Label>
                        <Form.Control
                          type="email"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="email@example.com"
                          required
                        />
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>{t("auth.password")} *</Form.Label>
                        <Form.Control
                          type="password"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          required
                          minLength={6}
                        />
                        <Form.Text className="text-muted">{t("auth.passwordHint")}</Form.Text>
                      </Form.Group>
                      <Form.Group className="mb-3">
                        <Form.Label>{t("auth.confirmPassword")} *</Form.Label>
                        <Form.Control
                          type="password"
                          value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)}
                          required
                          isInvalid={regConfirmPassword && regPassword !== regConfirmPassword}
                        />
                        <Form.Control.Feedback type="invalid">
                          {t("auth.passwordMismatch")}
                        </Form.Control.Feedback>
                      </Form.Group>
                      <Button
                        variant="danger"
                        type="submit"
                        className="w-100 mb-3"
                        disabled={loading}
                      >
                        {loading ? <Spinner animation="border" size="sm" /> : t("auth.register")}
                      </Button>
                    </Form>

                    <div className="text-center text-muted mb-3">
                      <small>{t("auth.or")}</small>
                    </div>

                    <Button
                      variant="outline-secondary"
                      className="w-100"
                      onClick={handleGoogle}
                      disabled={loading}
                    >
                      <GoogleIcon /> {t("auth.registerWithGoogle")}
                    </Button>

                    <div className="text-center mt-3">
                      <small>
                        {t("auth.hasAccount")}{" "}
                        <a
                          href="#"
                          onClick={(e) => { e.preventDefault(); setActiveTab("login"); setError(null); }}
                          style={{ color: accentColor }}
                        >
                          {t("auth.login")}
                        </a>
                      </small>
                    </div>
                  </Tab.Pane>
                </Tab.Content>
              </Tab.Container>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

/**
 * Simple Google icon SVG
 */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" className="me-2" style={{ verticalAlign: "middle" }}>
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
    </svg>
  );
}

/**
 * Map Firebase auth error codes to user-friendly messages
 */
function getAuthErrorMessage(code, t) {
  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return t("auth.invalidCredentials");
    case "auth/email-already-in-use":
      return t("auth.emailInUse");
    case "auth/weak-password":
      return t("auth.weakPassword");
    case "auth/invalid-email":
      return t("auth.invalidEmail");
    case "auth/too-many-requests":
      return t("auth.tooManyRequests");
    case "auth/popup-closed-by-user":
      return t("auth.popupClosed");
    default:
      return t("auth.genericError");
  }
}
