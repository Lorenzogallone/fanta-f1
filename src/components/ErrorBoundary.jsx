/**
 * @file Error Boundary Component
 * @description Catches and handles React errors gracefully
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Container, Card, Button, Alert } from 'react-bootstrap';
import { logError } from '../utils/logger';

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in child component tree
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development or to error tracking service
    logError(error, 'ErrorBoundary');

    // Store error details in state
    this.setState({
      error,
      errorInfo,
    });

    // In production, you could send this to an error tracking service:
    // Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // Optionally reload the page
    // window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom error UI
      return (
        <Container className="py-5">
          <Card className="shadow-lg border-danger">
            <Card.Header className="bg-danger text-white">
              <h4 className="mb-0">⚠️ Oops! Something went wrong</h4>
            </Card.Header>
            <Card.Body>
              <Alert variant="danger">
                <Alert.Heading>Error Occurred</Alert.Heading>
                <p>
                  We&apos;re sorry, but something unexpected happened.
                  The error has been logged and we&apos;ll look into it.
                </p>
              </Alert>

              {import.meta.env.DEV && this.state.error && (
                <details className="mt-4">
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                    Error Details (Development Only)
                  </summary>
                  <pre className="mt-3 p-3 bg-light border rounded" style={{ fontSize: '0.85rem', overflow: 'auto' }}>
                    <code>
                      {this.state.error.toString()}
                      {'\n\n'}
                      {this.state.errorInfo?.componentStack}
                    </code>
                  </pre>
                </details>
              )}

              <div className="mt-4 d-flex gap-3">
                <Button variant="danger" onClick={this.handleReset}>
                  Try Again
                </Button>
                <Button variant="outline-secondary" onClick={() => window.location.href = '/'}>
                  Go to Home
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Container>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ErrorBoundary;
