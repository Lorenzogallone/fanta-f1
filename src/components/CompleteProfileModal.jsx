/**
 * @file CompleteProfileModal.jsx
 * @description Modal to complete profile after Google Sign-In (nickname, first name, last name)
 */

import React, { useState } from "react";
import { Modal, Form, Button, Alert, Spinner } from "react-bootstrap";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";

export default function CompleteProfileModal() {
  const { needsProfile, completeProfile, logout } = useAuth();
  const { t } = useLanguage();

  const [nickname, setNickname] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!nickname.trim() || !firstName.trim() || !lastName.trim()) {
      setError(t("auth.allFieldsRequired"));
      return;
    }

    setLoading(true);
    try {
      await completeProfile({
        nickname: nickname.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
    } catch {
      setError(t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={needsProfile} backdrop="static" keyboard={false} centered>
      <Modal.Header>
        <Modal.Title>{t("auth.completeProfile")}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted mb-3">{t("auth.completeProfileDesc")}</p>

        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>{t("auth.nickname")} *</Form.Label>
            <Form.Control
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t("auth.nicknamePlaceholder")}
              required
              autoFocus
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>{t("auth.firstName")} *</Form.Label>
            <Form.Control
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>{t("auth.lastName")} *</Form.Label>
            <Form.Control
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </Form.Group>
          <Button variant="danger" type="submit" className="w-100" disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : t("auth.saveProfile")}
          </Button>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="link" size="sm" className="text-muted" onClick={logout}>
          {t("auth.logout")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
