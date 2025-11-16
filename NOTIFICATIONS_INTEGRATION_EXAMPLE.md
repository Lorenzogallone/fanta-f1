# 📱 Esempi di Integrazione - Sistema Notifiche

Ecco come integrare il sistema di notifiche nelle varie pagine dell'app.

---

## 🏠 Esempio 1: Home Page (Banner Benvenuto)

```jsx
// src/pages/Home.jsx
import { useState, useEffect } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';
import { useNotifications } from '../hooks/useNotifications';
import { getAuth } from 'firebase/auth';

export default function Home() {
  const [userId, setUserId] = useState(null);
  const { isEnabled, isSupported, requestPermission } = useNotifications(userId);

  useEffect(() => {
    // Get current user ID (adapt to your auth system)
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      setUserId(user.uid);
    }
  }, []);

  // Show notification prompt only once per user
  const [hasPrompted, setHasPrompted] = useState(() => {
    return localStorage.getItem('notification-prompted') === 'true';
  });

  const handleEnableNotifications = async () => {
    await requestPermission();
    localStorage.setItem('notification-prompted', 'true');
    setHasPrompted(true);
  };

  return (
    <Container className="py-4">
      {/* Show banner if notifications are supported but not enabled */}
      {isSupported && !isEnabled && !hasPrompted && (
        <Alert variant="info" className="mb-4 d-flex justify-content-between align-items-center">
          <div>
            <strong>🔔 Never miss a race!</strong>
            <p className="mb-0 small">
              Get notified 30 minutes before each race starts.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={handleEnableNotifications}>
            Enable Notifications
          </Button>
        </Alert>
      )}

      {/* Rest of your Home page content */}
      <h1>Welcome to FantaF1!</h1>
      {/* ... */}
    </Container>
  );
}
```

---

## ⚙️ Esempio 2: Settings/Profile Page

```jsx
// src/pages/UserSettings.jsx (o Profile.jsx)
import { Container, Card, Row, Col } from 'react-bootstrap';
import NotificationSettings from '../components/NotificationSettings';

export default function UserSettings() {
  const userId = "current-user-id"; // Get from auth

  return (
    <Container className="py-4">
      <h2 className="mb-4">Settings</h2>

      <Row>
        <Col md={6}>
          <Card className="mb-3">
            <Card.Header>
              <h5 className="mb-0">Account Settings</h5>
            </Card.Header>
            <Card.Body>
              {/* Account settings content */}
            </Card.Body>
          </Card>

          {/* Notification Settings Card */}
          <NotificationSettings userId={userId} />
        </Col>

        <Col md={6}>
          {/* Other settings */}
        </Col>
      </Row>
    </Container>
  );
}
```

---

## 🏁 Esempio 3: Formations Page (Prompt Contestuale)

```jsx
// src/pages/Formations.jsx
import { useEffect } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { useNotifications } from '../hooks/useNotifications';

export default function Formations() {
  const userId = "current-user-id";
  const { isSupported, isEnabled, requestPermission } = useNotifications(userId);

  return (
    <Container className="py-4">
      <h2>Submit Your Lineup</h2>

      {/* Show prompt when user is about to submit formation */}
      {isSupported && !isEnabled && (
        <Alert variant="warning" className="mb-4">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>⏰ Don't forget your lineup!</strong>
              <p className="mb-0 small">
                Enable notifications to get reminded 30 minutes before the race.
              </p>
            </div>
            <Button variant="warning" size="sm" onClick={requestPermission}>
              Enable
            </Button>
          </div>
        </Alert>
      )}

      {/* Formation form */}
      {/* ... */}
    </Container>
  );
}
```

---

## 📊 Esempio 4: Admin Panel (Statistiche Notifiche)

```jsx
// src/pages/AdminPanel.jsx
import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Card, Table, Badge } from 'react-bootstrap';

function NotificationStats() {
  const [stats, setStats] = useState({
    totalTokens: 0,
    recentNotifications: []
  });

  useEffect(() => {
    const loadStats = async () => {
      // Count registered tokens
      const tokensSnap = await getDocs(collection(db, 'notificationTokens'));
      const totalTokens = tokensSnap.size;

      // Get recent notifications
      const notificationsSnap = await getDocs(
        query(
          collection(db, 'sentNotifications'),
          orderBy('sentAt', 'desc'),
          limit(10)
        )
      );

      const recentNotifications = notificationsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setStats({ totalTokens, recentNotifications });
    };

    loadStats();
  }, []);

  return (
    <Card className="mb-4">
      <Card.Header>
        <h5 className="mb-0">
          📊 Notification Statistics
          <Badge bg="primary" className="ms-2">
            {stats.totalTokens} Active Users
          </Badge>
        </h5>
      </Card.Header>
      <Card.Body>
        <h6>Recent Notifications</h6>
        <Table hover size="sm">
          <thead>
            <tr>
              <th>Race</th>
              <th>Sent At</th>
              <th>Recipients</th>
              <th>Success Rate</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentNotifications.map(notif => (
              <tr key={notif.id}>
                <td>{notif.raceName}</td>
                <td>{notif.sentAt?.toDate().toLocaleString()}</td>
                <td>{notif.recipientCount}</td>
                <td>
                  <Badge bg={notif.successCount === notif.recipientCount ? 'success' : 'warning'}>
                    {notif.successCount}/{notif.recipientCount}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
}

export default function AdminPanel() {
  return (
    <Container className="py-4">
      <h2>Admin Panel</h2>

      {/* Notification Statistics */}
      <NotificationStats />

      {/* Rest of admin panel */}
      {/* ... */}
    </Container>
  );
}
```

---

## 🎯 Esempio 5: Auto-prompt Intelligente (Best Practice)

```jsx
// src/App.jsx or custom hook
import { useState, useEffect } from 'react';
import { useNotifications } from './hooks/useNotifications';

/**
 * Smart notification prompt that shows after user has:
 * 1. Visited the site 2+ times
 * 2. Been active for at least 30 seconds
 * 3. Not already enabled notifications
 */
function useSmartNotificationPrompt(userId) {
  const { isSupported, isEnabled, requestPermission } = useNotifications(userId);
  const [shouldPrompt, setShouldPrompt] = useState(false);

  useEffect(() => {
    if (!isSupported || isEnabled) return;

    // Track visit count
    const visitCount = parseInt(localStorage.getItem('visit-count') || '0');
    localStorage.setItem('visit-count', String(visitCount + 1));

    // Check if already prompted
    const hasPrompted = localStorage.getItem('notification-prompted') === 'true';

    if (hasPrompted) return;

    // Prompt after 2+ visits and 30 seconds of activity
    if (visitCount >= 2) {
      const timer = setTimeout(() => {
        setShouldPrompt(true);
      }, 30000); // 30 seconds

      return () => clearTimeout(timer);
    }
  }, [isSupported, isEnabled]);

  const handlePrompt = async () => {
    await requestPermission();
    localStorage.setItem('notification-prompted', 'true');
    setShouldPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('notification-prompted', 'true');
    setShouldPrompt(false);
  };

  return {
    shouldPrompt,
    handlePrompt,
    handleDismiss
  };
}

// Usage in App.jsx
export default function App() {
  const userId = "current-user-id";
  const { shouldPrompt, handlePrompt, handleDismiss } = useSmartNotificationPrompt(userId);

  return (
    <div>
      {/* Smart notification banner */}
      {shouldPrompt && (
        <Alert variant="info" className="fixed-top m-3" onClose={handleDismiss} dismissible>
          <strong>🔔 Stay updated!</strong>
          <p className="mb-2">
            Get notified 30 minutes before each race so you never miss a deadline.
          </p>
          <Button variant="primary" size="sm" onClick={handlePrompt}>
            Enable Notifications
          </Button>
        </Alert>
      )}

      {/* Rest of app */}
    </div>
  );
}
```

---

## 🧪 Esempio 6: Test Component (Development Only)

```jsx
// src/components/NotificationTester.jsx
import { useState } from 'react';
import { Card, Button, Alert, Form } from 'react-bootstrap';

export default function NotificationTester() {
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const sendTestNotification = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        'https://europe-west1-fantaf1-b5410.cloudfunctions.net/testNotification',
        { method: 'POST' }
      );
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testBrowserNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🧪 Test Notification', {
        body: 'This is a test notification from FantaF1!',
        icon: '/FantaF1_Logo_big.png',
        tag: 'test',
      });
    } else {
      alert('Notification permission not granted');
    }
  };

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Card className="mb-3 border-warning">
      <Card.Header className="bg-warning text-dark">
        <strong>🧪 Notification Tester (Dev Only)</strong>
      </Card.Header>
      <Card.Body>
        <div className="d-flex gap-2 mb-3">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={testBrowserNotification}
          >
            Test Browser Notification
          </Button>
          <Button
            variant="outline-success"
            size="sm"
            onClick={sendTestNotification}
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send via Cloud Function'}
          </Button>
        </div>

        {testResult && (
          <Alert variant={testResult.error ? 'danger' : 'success'}>
            <pre className="mb-0">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
}
```

---

## 💡 Best Practices

### ✅ DO:
- Chiedi il permesso nel contesto giusto (dopo che l'utente ha mostrato interesse)
- Mostra il valore delle notifiche prima di chiederle
- Fornisci un modo facile per disabilitarle
- Testa su dispositivi reali, non solo desktop
- Monitora le statistiche di delivery

### ❌ DON'T:
- Non chiedere permesso immediatamente al primo caricamento
- Non mostrare popup invasivi
- Non inviare troppe notifiche
- Non dimenticare di gestire il caso "blocked"
- Non ignorare gli errori di delivery

---

## 📱 UX Tips

1. **Progressive Enhancement**: L'app deve funzionare anche senza notifiche
2. **Clear Value Prop**: Spiega perché le notifiche sono utili
3. **Easy Opt-out**: Rendi facile disabilitare le notifiche
4. **Respectful Timing**: Chiedi dopo che l'utente ha usato l'app almeno una volta
5. **Visual Feedback**: Mostra chiaramente lo stato delle notifiche

---

Scegli l'approccio più adatto al tuo caso d'uso! 🚀
