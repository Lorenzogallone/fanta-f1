/**
 * @file NotificationSettings component
 * @description UI component to manage push notification preferences
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
    permission,
    isEnabled,
    loading,
    toggleNotifications,
  } = useNotifications(userId);

  const accentColor = isDark ? "#ff4d5a" : "#dc3545";

  if (!isSupported) {
    return (
      <Alert variant="warning" className="mb-3">
        <strong>⚠️ Notifications not supported</strong>
        <p className="mb-0 small">
          Your browser doesn&apos;t support push notifications.
          Try using Chrome, Firefox, or Edge.
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
              🔔 Race Reminders
              {isEnabled && (
                <Badge bg="success" className="ms-2">Active</Badge>
              )}
              {permission === 'denied' && (
                <Badge bg="danger" className="ms-2">Blocked</Badge>
              )}
            </h6>
            <p className="text-muted small mb-0">
              Get notified 30 minutes before each race
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
            aria-label={isEnabled ? "Disable race reminders" : "Enable race reminders"}
          >
            {loading ? (
              <Spinner animation="border" size="sm" />
            ) : isEnabled ? (
              'Disable'
            ) : (
              'Enable'
            )}
          </Button>
        </div>

        {permission === 'denied' && (
          <Alert variant="danger" className="mt-3 mb-0 small">
            <strong>Notifications blocked</strong>
            <p className="mb-0">
              You&apos;ve blocked notifications for this site.
              To enable them, click the lock icon in your browser&apos;s address bar
              and allow notifications.
            </p>
          </Alert>
        )}

        {permission === 'default' && !isEnabled && (
          <Alert variant="info" className="mt-3 mb-0 small">
            <strong>Stay updated!</strong>
            <p className="mb-0">
              Enable notifications to never miss a race deadline.
            </p>
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
}

NotificationSettings.propTypes = {
  userId: PropTypes.string.isRequired,
};
