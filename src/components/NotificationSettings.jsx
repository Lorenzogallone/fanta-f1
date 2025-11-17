/**
 * @file NotificationSettings component
 * @description UI component to manage push notification preferences
 * @version 2.0.0 - Updated for qualifying, sprint, and race notifications
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Card, Button, Badge, Alert, Spinner } from 'react-bootstrap';
import { useNotifications } from '../hooks/useNotifications';
import { useTheme } from '../contexts/ThemeContext';

/**
 * NotificationSettings component
 * @param {Object} props - Component props
 * @param {string} props.userId - User ID for notification registration
 * @returns {JSX.Element} Notification settings UI
 */
export default function NotificationSettings({ userId }) {
  const { isDark } = useTheme();
  const {
    isSupported,
    isConfigured,
    permission,
    isEnabled,
    loading,
    error,
    toggleNotifications,
  } = useNotifications(userId);

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";

  // Show error if VAPID key not configured
  if (!isConfigured) {
    return (
      <Alert variant="info" className="mb-3">
        <strong>ℹ️ Notifiche non configurate</strong>
        <p className="mb-0 small">
          Le notifiche push richiedono configurazione aggiuntiva.
          Consulta la documentazione per attivarle.
        </p>
      </Alert>
    );
  }

  if (!isSupported) {
    return (
      <Alert variant="warning" className="mb-3">
        <strong>⚠️ Notifiche non supportate</strong>
        <p className="mb-0 small">
          Il tuo browser non supporta le notifiche push.
          Prova ad usare Chrome, Firefox o Edge.
        </p>
      </Alert>
    );
  }

  return (
    <Card className="shadow-sm mb-3">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h6 className="mb-1">
              🔔 Promemoria Eventi F1
              {isEnabled && (
                <Badge bg="success" className="ms-2">Attive</Badge>
              )}
              {permission === 'denied' && (
                <Badge bg="danger" className="ms-2">Bloccate</Badge>
              )}
            </h6>
            <p className="text-muted small mb-0">
              Ricevi notifiche 30 minuti prima di qualifiche, sprint e gare
            </p>
          </div>

          <Button
            variant={isEnabled ? "outline-danger" : "danger"}
            size="sm"
            onClick={toggleNotifications}
            disabled={loading || permission === 'denied'}
            style={{
              borderColor: accentColor,
              backgroundColor: isEnabled ? 'transparent' : accentColor,
              color: isEnabled ? accentColor : '#fff',
            }}
            aria-label={isEnabled ? "Disabilita promemoria" : "Abilita promemoria"}
          >
            {loading ? (
              <Spinner animation="border" size="sm" />
            ) : isEnabled ? (
              'Disabilita'
            ) : (
              'Abilita'
            )}
          </Button>
        </div>

        {permission === 'denied' && (
          <Alert variant="danger" className="mt-3 mb-0 small">
            <strong>Notifiche bloccate</strong>
            <p className="mb-0">
              Hai bloccato le notifiche per questo sito.
              Per abilitarle, clicca sull&apos;icona del lucchetto nella barra degli indirizzi
              e consenti le notifiche.
            </p>
          </Alert>
        )}

        {permission === 'default' && !isEnabled && (
          <Alert variant="info" className="mt-3 mb-0 small">
            <strong>✨ Resta aggiornato!</strong>
            <p className="mb-0">
              Abilita le notifiche per non perdere mai una scadenza.
              Riceverai un promemoria per:
            </p>
            <ul className="mb-0 mt-2">
              <li>⏱️ Qualifiche (30 min prima)</li>
              <li>🏃 Qualifiche Sprint (30 min prima)</li>
              <li>🏁 Gara (30 min prima)</li>
            </ul>
          </Alert>
        )}

        {error && (
          <Alert variant="warning" className="mt-3 mb-0 small">
            {error}
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
}

NotificationSettings.propTypes = {
  userId: PropTypes.string.isRequired,
};
