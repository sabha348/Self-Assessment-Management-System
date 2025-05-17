import React from 'react';
import { reportError } from '../services/errorReportingService';

class ErrorBoundary extends React.Component {
constructor(props) {
  super(props);
  this.state = { hasError: false, error: null };
}

static getDerivedStateFromError(error) {
  return { hasError: true, error };
}

componentDidMount() {
  // Catch module loading errors
  window.addEventListener('error', event => {
    if (event.error.message.includes("Cannot find module")) {
      reportError({
        message: `Module loading error: ${event.error.message}`,
        stack: event.error.stack
      }, 'AppLoad');
      this.setState({ hasError: true, errorInfo: event.error });
    }
  });
}


  componentDidCatch(error, info) {
    console.error('Component Error:', error, info);
    // Report error to backend to notify admins
    reportError(error, this.props.componentName);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-container">
          <h2>Something went wrong</h2>
          <p>The error has been reported to our team.</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;