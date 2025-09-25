import { useState, useEffect } from 'react';
import './App.css';
import { WakuService, WakuStatus } from './services/WakuService';
import { IdentityService, Identity } from './services/IdentityService';

function App() {
  const [wakuStatus, setWakuStatus] = useState<WakuStatus>({
    connected: false,
    peerCount: 0,
    syncComplete: false,
    error: null
  });
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeServices = async () => {
      try {
        setIsInitializing(true);

        const identityService = new IdentityService();
        const wakuService = new WakuService();

        const userIdentity = identityService.getIdentity();
        setIdentity(userIdentity);

        await wakuService.initialize();

        // Update status after initialization
        setWakuStatus(wakuService.getStatus());

        // No cleanup needed for this version
      } catch (error) {
        console.error('Failed to initialize services:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeServices();
  }, []);

  const getStatusColor = () => {
    if (isInitializing) return '#ffa500';
    if (wakuStatus.connected) return '#4caf50';
    if (wakuStatus.error) return '#f44336';
    return '#9e9e9e';
  };

  const getStatusText = () => {
    if (isInitializing) return 'Initializing...';
    if (wakuStatus.connected) return `Connected (${wakuStatus.peerCount} peers)`;
    if (wakuStatus.error) return `Error: ${wakuStatus.error}`;
    return 'Disconnected';
  };

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
        <div className="connection-status">
          <div
            className="status-indicator"
            style={{ backgroundColor: getStatusColor() }}
          />
          <span className="status-text">{getStatusText()}</span>
        </div>
      </header>

      <main className="App-main">
        {wakuStatus.connected ? (
          <div className="app-content">
            <div className="identity-info">
              <p>Your Identity: <code>{identity?.publicKeyHex?.substring(0, 16)}...</code></p>
              <p>Created: {identity?.created ? new Date(identity.created).toLocaleString() : 'Unknown'}</p>
            </div>

            <div className="placeholder-content">
              <h3>🚧 Coming Soon</h3>
              <p>Poll creation and voting interface will be implemented in the next phases.</p>
              <p>Current status: Waku Light Node connected successfully!</p>
            </div>
          </div>
        ) : (
          <div className="connection-error">
            <h3>Connection Required</h3>
            <p>Please wait while we connect to the Waku network...</p>
            {wakuStatus.error && (
              <div className="error-details">
                <p><strong>Error:</strong> {wakuStatus.error}</p>
                <button
                  onClick={() => new WakuService().reconnect()}
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
