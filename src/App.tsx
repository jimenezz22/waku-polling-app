import { useState, useEffect } from 'react';
import './App.css';
import { wakuService, WakuStatus } from './services/WakuService';
import { IdentityService, Identity } from './services/IdentityService';
import { DataService } from './services/DataService';
import ConnectionStatus from './components/ConnectionStatus';
import PollCreation from './components/PollCreation';
import PollList from './components/PollList';

function App() {
  const [wakuStatus, setWakuStatus] = useState<WakuStatus>({
    connected: false,
    peerCount: 0,
    syncComplete: false,
    error: null
  });
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [dataService, setDataService] = useState<DataService | null>(null);

  useEffect(() => {
    const initializeServices = async () => {
      try {
        setIsInitializing(true);

        const identityService = new IdentityService();
        const userIdentity = identityService.getIdentity();
        setIdentity(userIdentity);

        await wakuService.initialize();

        setWakuStatus(wakuService.getStatus());

        const service = new DataService(wakuService);
        setDataService(service);

      } catch (error) {
        console.error('Failed to initialize services:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeServices();

    return () => {
      console.log('🧹 App unmounting - cleaning up Waku service...');
      wakuService.cleanup().catch((error) => {
        console.error('Failed to cleanup Waku service:', error);
      });
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
        {wakuStatus.connected && dataService ? (
          <div className="app-content">
            <div className="identity-info">
              <p>Your Identity: <code>{identity?.publicKeyHex?.substring(0, 16)}...</code></p>
              <p>Created: {identity?.created ? new Date(identity.created).toLocaleString() : 'Unknown'}</p>
            </div>

            <PollCreation dataService={dataService} />

            <PollList dataService={dataService} />
          </div>
        ) : (
          <div className="connection-error">
            <h3>Connection Required</h3>
            <p>Please wait while we connect to the Waku network...</p>
            {wakuStatus.error && (
              <div className="error-details">
                <p><strong>Error:</strong> {wakuStatus.error}</p>
                <button
                  onClick={() => wakuService.reconnect()}
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