/**
 * App - Main application component for DecenVote
 *
 * This is the root component that orchestrates the entire DecenVote application:
 * - Initializes Waku network connection
 * - Manages user identity and authentication
 * - Provides global error handling for Store protocol
 * - Renders the main UI components (status, poll creation, poll list)
 */

import './App.css';
import { useEffect } from 'react';
import { useWaku } from './hooks/useWaku';
import { useIdentity } from './hooks/useIdentity';
import ConnectionStatus from './components/ConnectionStatus';
import ProtocolStatus from './components/ProtocolStatus';
import PollCreation from './components/PollCreation';
import PollList from './components/PollList';

function App() {
  const { status, isConnected, isInitializing, dataService, reconnect } = useWaku();
  const { identity, publicKey } = useIdentity();

  // Global error handler for unhandled Store protocol errors
  useEffect(() => {
    // Store original console.error
    const originalConsoleError = console.error;

    // Override console.error to filter Store protocol errors
    console.error = (...args: any[]) => {
      const errorStr = args.join(' ');

      // Check if it's a Store protocol error
      if (errorStr.includes('No peers available to query') ||
          errorStr.includes('MissingMessageRetriever') ||
          errorStr.includes('Store') || errorStr.includes('store')) {

        console.warn('⚠️ Store protocol error (suppressed from React error overlay):', ...args);
        return; // Don't call original console.error
      }

      // For non-Store errors, call original console.error
      originalConsoleError.apply(console, args);
    };

    const handleGlobalError = (event: ErrorEvent) => {
      const error = event.error || event.message || 'Unknown error';
      const errorStr = error.toString?.() || String(error);
      const messageStr = event.message || '';

      // Check if it's a Store protocol related error
      if (errorStr.includes('Store') || errorStr.includes('store') ||
          errorStr.includes('No peers available to query') ||
          errorStr.includes('MissingMessageRetriever') ||
          errorStr.includes('queryWithOrderedCallback') ||
          messageStr.includes('No peers available to query') ||
          messageStr.includes('Store') ||
          messageStr.includes('MissingMessageRetriever')) {

        console.warn('⚠️ Global Store protocol error intercepted (prevented UI popup):', error);
        event.preventDefault(); // Prevent React error overlay
        event.stopPropagation(); // Stop event propagation
        event.stopImmediatePropagation(); // Stop immediate propagation
        return false;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const errorStr = error?.toString?.() || String(error);

      // Check if it's a Store protocol related error
      if (errorStr.includes('Store') || errorStr.includes('store') ||
          errorStr.includes('No peers available to query') ||
          errorStr.includes('MissingMessageRetriever') ||
          errorStr.includes('queryWithOrderedCallback')) {

        console.warn('⚠️ Global Store protocol promise rejection intercepted (prevented UI popup):', error);
        event.preventDefault(); // Prevent unhandled promise rejection
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      // Restore original console.error
      console.error = originalConsoleError;

      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (isInitializing) {
    return (
      <div className="App">
        <div className="loading">
          <h2>Initializing DecenVote...</h2>
          <p>Setting up Waku protocols and identity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>🗳️ DecenVote</h1>
        <p>Decentralized Polling with Waku</p>
        <ConnectionStatus />
      </header>

      <main className="App-main">
        {isConnected && dataService ? (
          <div className="app-content">
            <div className="identity-info">
              <p>Your Identity: <code>{publicKey}</code></p>
              <p>Created: {identity?.created ? new Date(identity.created).toLocaleString() : 'Unknown'}</p>
            </div>

            <ProtocolStatus />

            <PollCreation dataService={dataService} />

            <PollList dataService={dataService} />
          </div>
        ) : (
          <div className="connection-error">
            <h3>Connection Required</h3>
            <p>Please wait while we connect to the Waku network...</p>
            {status.error && (
              <div className="error-details">
                <p><strong>Error:</strong> {status.error}</p>
                <button
                  onClick={reconnect}
                  className="retry-button"
                >
                  Retry Connection
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="App-footer">
        <p>Powered by Waku Protocol</p>
      </footer>
    </div>
  );
}

export default App;