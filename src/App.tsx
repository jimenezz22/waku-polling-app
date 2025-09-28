import './App.css';
import { useWaku } from './hooks/useWaku';
import { useIdentity } from './hooks/useIdentity';
import ConnectionStatus from './components/ConnectionStatus';
import PollCreation from './components/PollCreation';
import PollList from './components/PollList';

function App() {
  const { status, isConnected, isInitializing, dataService, reconnect } = useWaku();
  const { identity, publicKey } = useIdentity();

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