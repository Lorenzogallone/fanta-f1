/**
 * @file ProfilePage.jsx
 * @description User profile management page with avatar upload, personal info editing, and preferences.
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Container,
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  Row,
  Col,
} from "react-bootstrap";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../hooks/useLanguage";
import { uploadProfileImage, removeProfileImage, updateProfile } from "../services/profileService";
import UserAvatar from "../components/UserAvatar";
import NotificationSettings from "../components/NotificationSettings";

export default function ProfilePage() {
  const { user, userProfile, checkNicknameAvailable, updateUserProfile } = useAuth();
  const { isDark, toggleTheme, themeMode, setMode } = useTheme();
  const { t, currentLanguage, changeLanguage, availableLanguages } = useLanguage();

  const [nickname, setNickname] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [previewURL, setPreviewURL] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [nicknameError, setNicknameError] = useState("");
  const [nicknameChecking, setNicknameChecking] = useState(false);

  const fileInputRef = useRef(null);
  const debounceRef = useRef(null);

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";
  const bgCard = isDark ? "var(--bg-secondary)" : "#ffffff";
  const bgHeader = isDark ? "var(--bg-tertiary)" : "#ffffff";
  const textColor = isDark ? "#e9ecef" : "#212529";
  const mutedColor = isDark ? "#aaa" : "#6c757d";

  // Initialize form from profile
  useEffect(() => {
    if (userProfile) {
      setNickname(userProfile.nickname || "");
      setFirstName(userProfile.firstName || "");
      setLastName(userProfile.lastName || "");
      setPhotoURL(userProfile.photoURL || "");
    }
  }, [userProfile]);

  // Debounced nickname validation
  const checkNickname = useCallback(
    (value) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim()) {
        setNicknameError("");
        return;
      }
      if (value.trim() === userProfile?.nickname) {
        setNicknameError("");
        return;
      }
      setNicknameChecking(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const available = await checkNicknameAvailable(value.trim(), user?.uid);
          setNicknameError(available ? "" : t("profile.nicknameTaken"));
        } catch {
          setNicknameError("");
        } finally {
          setNicknameChecking(false);
        }
      }, 500);
    },
    [checkNicknameAvailable, user?.uid, userProfile?.nickname, t]
  );

  const handleNicknameChange = (e) => {
    const val = e.target.value;
    setNickname(val);
    checkNickname(val);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("profile.imageTooLarge"));
      return;
    }

    setSelectedFile(file);
    setPreviewURL(URL.createObjectURL(file));
  };

  const handleUploadImage = async () => {
    if (!selectedFile || !user?.uid) return;
    setUploadingImage(true);
    try {
      const url = await uploadProfileImage(user.uid, selectedFile);
      setPhotoURL(url);
      setPreviewURL(null);
      setSelectedFile(null);
      updateUserProfile({ photoURL: url });
      toast.success(t("profile.profileUpdated"));
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!user?.uid) return;
    setUploadingImage(true);
    try {
      await removeProfileImage(user.uid);
      setPhotoURL("");
      setPreviewURL(null);
      setSelectedFile(null);
      updateUserProfile({ photoURL: "" });
      toast.success(t("profile.profileUpdated"));
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setUploadingImage(false);
    }
  };

  const cancelPreview = () => {
    setPreviewURL(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!nickname.trim() || !firstName.trim() || !lastName.trim()) {
      toast.error(t("auth.allFieldsRequired"));
      return;
    }
    if (nicknameError) return;

    setSaving(true);
    try {
      await updateProfile(user.uid, {
        nickname: nickname.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      updateUserProfile({
        nickname: nickname.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      toast.success(t("profile.profileUpdated"));
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    nickname.trim() !== (userProfile?.nickname || "") ||
    firstName.trim() !== (userProfile?.firstName || "") ||
    lastName.trim() !== (userProfile?.lastName || "");

  const memberSince = userProfile?.createdAt
    ? new Date(userProfile.createdAt.seconds * 1000).toLocaleDateString(
        currentLanguage === "en" ? "en-GB" : "it-IT",
        { day: "2-digit", month: "long", year: "numeric" }
      )
    : "—";

  const themeEmojis = { light: "☀️", dark: "🌙", auto: "🌗" };
  const themeLabels = {
    auto: t("profile.auto"),
    light: t("profile.light"),
    dark: t("profile.dark"),
  };

  return (
    <Container className="py-4" style={{ maxWidth: 600 }}>
      <Card
        className="shadow"
        style={{ borderColor: accentColor, backgroundColor: bgCard }}
      >
        <Card.Header
          style={{
            backgroundColor: bgHeader,
            borderBottom: `2px solid ${accentColor}`,
          }}
        >
          <h4 className="mb-0" style={{ color: accentColor }}>
            {t("profile.title")}
          </h4>
        </Card.Header>

        <Card.Body>
          {/* Avatar Section */}
          <div className="text-center mb-4">
            <div
              style={{ cursor: "pointer", display: "inline-block", position: "relative" }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              aria-label={t("profile.changePhoto")}
            >
              <UserAvatar
                photoURL={previewURL || photoURL}
                name={nickname}
                size={120}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  backgroundColor: accentColor,
                  color: "#fff",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.9rem",
                  border: `2px solid ${bgCard}`,
                }}
              >
                📷
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />

            <div className="mt-2 d-flex gap-2 justify-content-center">
              {previewURL && (
                <>
                  <Button
                    size="sm"
                    variant="outline-success"
                    onClick={handleUploadImage}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      t("common.save")
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={cancelPreview}
                    disabled={uploadingImage}
                  >
                    {t("common.cancel")}
                  </Button>
                </>
              )}
              {!previewURL && photoURL && (
                <Button
                  size="sm"
                  variant="outline-danger"
                  onClick={handleRemoveImage}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    t("profile.removePhoto")
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Personal Info Form */}
          <Form onSubmit={handleSave}>
            <h6 className="fw-bold mb-3" style={{ color: accentColor }}>
              {t("profile.personalInfo")}
            </h6>

            <Form.Group className="mb-3">
              <Form.Label style={{ color: textColor, fontSize: "0.85rem" }}>
                {t("profile.nickname")} *
              </Form.Label>
              <div className="position-relative">
                <Form.Control
                  type="text"
                  value={nickname}
                  onChange={handleNicknameChange}
                  required
                  isInvalid={!!nicknameError}
                  style={{ borderColor: accentColor }}
                />
                {nicknameChecking && (
                  <Spinner
                    animation="border"
                    size="sm"
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  />
                )}
                <Form.Control.Feedback type="invalid">
                  {nicknameError}
                </Form.Control.Feedback>
              </div>
            </Form.Group>

            <Row className="g-3 mb-3">
              <Col xs={6}>
                <Form.Group>
                  <Form.Label style={{ color: textColor, fontSize: "0.85rem" }}>
                    {t("profile.firstName")} *
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
              <Col xs={6}>
                <Form.Group>
                  <Form.Label style={{ color: textColor, fontSize: "0.85rem" }}>
                    {t("profile.lastName")} *
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label style={{ color: textColor, fontSize: "0.85rem" }}>
                {t("profile.email")}
              </Form.Label>
              <Form.Control
                type="email"
                value={user?.email || ""}
                disabled
                style={{ opacity: 0.7 }}
              />
            </Form.Group>

            <div className="mb-3" style={{ color: mutedColor, fontSize: "0.8rem" }}>
              {t("profile.memberSince")}: {memberSince}
            </div>

            <Button
              variant="danger"
              type="submit"
              className="w-100"
              disabled={saving || !hasChanges || !!nicknameError || nicknameChecking}
              style={{
                backgroundColor: accentColor,
                borderColor: accentColor,
              }}
            >
              {saving ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  {t("profile.savingProfile")}
                </>
              ) : (
                t("common.save")
              )}
            </Button>
          </Form>

          {/* Preferences Section */}
          <hr style={{ borderColor: isDark ? "#404040" : "#dee2e6" }} />
          <h6 className="fw-bold mb-3" style={{ color: accentColor }}>
            {t("profile.preferences")}
          </h6>

          {/* Theme */}
          <div className="d-flex align-items-center justify-content-between mb-3">
            <span style={{ color: textColor, fontSize: "0.9rem" }}>
              {t("profile.theme")}
            </span>
            <div className="d-flex gap-1">
              {["light", "auto", "dark"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMode(mode)}
                  className="btn btn-sm p-0"
                  style={{
                    fontSize: "1.3rem",
                    width: 40,
                    height: 40,
                    lineHeight: "40px",
                    textAlign: "center",
                    borderRadius: "6px",
                    border: themeMode === mode
                      ? `2px solid ${accentColor}`
                      : `1px solid ${isDark ? "#6c757d" : "#dee2e6"}`,
                    backgroundColor: "transparent",
                    opacity: themeMode === mode ? 1 : 0.5,
                  }}
                  title={themeLabels[mode]}
                  aria-label={themeLabels[mode]}
                >
                  {themeEmojis[mode]}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="d-flex align-items-center justify-content-between mb-3">
            <span style={{ color: textColor, fontSize: "0.9rem" }}>
              {t("profile.language")}
            </span>
            <div className="d-flex gap-1">
              {availableLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className="btn btn-sm p-0"
                  style={{
                    fontSize: "1.3rem",
                    width: 36,
                    height: 36,
                    lineHeight: "36px",
                    textAlign: "center",
                    borderRadius: "6px",
                    border:
                      currentLanguage === lang.code
                        ? `2px solid ${accentColor}`
                        : "1px solid transparent",
                    backgroundColor: "transparent",
                    opacity: currentLanguage === lang.code ? 1 : 0.5,
                  }}
                  title={lang.name}
                  aria-label={lang.name}
                >
                  {lang.flag}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="d-flex align-items-center justify-content-between">
            <span style={{ color: textColor, fontSize: "0.9rem" }}>
              {t("profile.notifications")}
            </span>
            <div style={{ marginLeft: "auto" }}>
              <NotificationSettings style={{ color: textColor }} />
            </div>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}
