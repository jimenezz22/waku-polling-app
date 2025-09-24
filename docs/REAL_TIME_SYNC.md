# DecenVote Real-Time Synchronization

## Overview

DecenVote achieves real-time synchronization by combining **Waku Store** (historical data) with **Waku Filter** (live updates) to create a seamless, always-synchronized experience across all peers.

## Synchronization Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Historical     │    │   Live Updates  │    │   Application   │
│     Data        │ →  │   (Real-time)   │ →  │     State       │
│ (Waku Store)    │    │ (Waku Filter)   │    │   (React)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        ↓                       ↓                       ↓
   Past messages           New messages            Merged state
    (when joining)        (as they arrive)        (complete view)
```

## Core Synchronization Patterns

### 1. Initial Sync (Cold Start)

```js
class InitialSyncManager {
  constructor(node) {
    this.node = node;
    this.isInitialSyncComplete = false;
    this.historicalData = {
      polls: [],
      votes: []
    };
  }

  // Perform initial synchronization when app starts
  async performInitialSync() {
    console.log("🔄 Starting initial sync...");

    try {
      // Load historical data in parallel
      await Promise.all([
        this.loadHistoricalPolls(),
        this.loadHistoricalVotes()
      ]);

      this.isInitialSyncComplete = true;
      console.log("✅ Initial sync completed");

      return {
        polls: this.historicalData.polls,
        votes: this.historicalData.votes
      };
    } catch (error) {
      console.error("❌ Initial sync failed:", error);
      throw error;
    }
  }

  // Load all historical polls
  async loadHistoricalPolls() {
    const polls = [];

    const callback = (wakuMessage) => {
      if (!wakuMessage.payload) return;

      try {
        const pollData = PollMessage.decode(wakuMessage.payload);
        polls.push(pollData);
      } catch (error) {
        console.error("Failed to decode historical poll:", error);
      }
    };

    // Query Store for all historical polls
    await this.node.store.queryWithOrderedCallback([pollDecoder], callback);

    this.historicalData.polls = polls;
    console.log(`📊 Loaded ${polls.length} historical polls`);
  }

  // Load all historical votes
  async loadHistoricalVotes() {
    const votes = [];

    const callback = (wakuMessage) => {
      if (!wakuMessage.payload) return;

      try {
        const voteData = VoteMessage.decode(wakuMessage.payload);
        votes.push(voteData);
      } catch (error) {
        console.error("Failed to decode historical vote:", error);
      }
    };

    // Query Store for all historical votes
    await this.node.store.queryWithOrderedCallback([voteDecoder], callback);

    this.historicalData.votes = votes;
    console.log(`🗳️ Loaded ${votes.length} historical votes`);
  }

  // Check if initial sync is complete
  isReady() {
    return this.isInitialSyncComplete;
  }
}
```

### 2. Live Updates (Hot Sync)

```js
class LiveUpdateManager {
  constructor(node) {
    this.node = node;
    this.subscriptions = {
      polls: null,
      votes: null
    };
    this.callbacks = {
      onNewPoll: null,
      onNewVote: null,
      onSyncError: null
    };
  }

  // Setup live subscriptions
  async setupLiveSync() {
    try {
      console.log("🔄 Setting up live sync...");

      // Create Filter subscriptions
      const [pollsResult, votesResult] = await Promise.all([
        this.node.filter.createSubscription({
          contentTopics: ["/decenvote/1/polls/proto"]
        }),
        this.node.filter.createSubscription({
          contentTopics: ["/decenvote/1/votes/proto"]
        })
      ]);

      if (pollsResult.error || votesResult.error) {
        throw new Error("Failed to create subscriptions");
      }

      this.subscriptions.polls = pollsResult.subscription;
      this.subscriptions.votes = votesResult.subscription;

      // Subscribe to new polls
      await this.subscriptions.polls.subscribe([pollDecoder], (wakuMessage) => {
        this.handleNewPoll(wakuMessage);
      });

      // Subscribe to new votes
      await this.subscriptions.votes.subscribe([voteDecoder], (wakuMessage) => {
        this.handleNewVote(wakuMessage);
      });

      console.log("✅ Live sync active");

      // Setup subscription monitoring
      this.startSubscriptionMonitoring();

    } catch (error) {
      console.error("❌ Live sync setup failed:", error);
      this.callbacks.onSyncError?.(error);
      throw error;
    }
  }

  // Handle new poll messages
  handleNewPoll(wakuMessage) {
    if (!wakuMessage.payload) return;

    try {
      const pollData = PollMessage.decode(wakuMessage.payload);
      console.log(`📊 New poll received: ${pollData.question}`);
      this.callbacks.onNewPoll?.(pollData);
    } catch (error) {
      console.error("Failed to decode new poll:", error);
    }
  }

  // Handle new vote messages
  handleNewVote(wakuMessage) {
    if (!wakuMessage.payload) return;

    try {
      const voteData = VoteMessage.decode(wakuMessage.payload);
      console.log(`🗳️ New vote received for poll: ${voteData.pollId}`);
      this.callbacks.onNewVote?.(voteData);
    } catch (error) {
      console.error("Failed to decode new vote:", error);
    }
  }

  // Monitor subscription health
  startSubscriptionMonitoring() {
    // Ping subscriptions every 30 seconds
    setInterval(async () => {
      await this.pingSubscriptions();
    }, 30000);
  }

  // Ping subscriptions to check health
  async pingSubscriptions() {
    try {
      if (this.subscriptions.polls) {
        await this.subscriptions.polls.ping();
      }
      if (this.subscriptions.votes) {
        await this.subscriptions.votes.ping();
      }
    } catch (error) {
      if (error.message.includes("peer has no subscriptions")) {
        console.log("🔄 Subscription lost, attempting to recover...");
        await this.recoverSubscriptions();
      } else {
        console.error("Subscription ping failed:", error);
      }
    }
  }

  // Recover lost subscriptions
  async recoverSubscriptions() {
    try {
      // Re-subscribe to both topics
      if (this.subscriptions.polls) {
        await this.subscriptions.polls.subscribe([pollDecoder], (wakuMessage) => {
          this.handleNewPoll(wakuMessage);
        });
      }

      if (this.subscriptions.votes) {
        await this.subscriptions.votes.subscribe([voteDecoder], (wakuMessage) => {
          this.handleNewVote(wakuMessage);
        });
      }

      console.log("✅ Subscriptions recovered");
    } catch (error) {
      console.error("❌ Subscription recovery failed:", error);
      this.callbacks.onSyncError?.(error);
    }
  }

  // Set callback functions
  setCallbacks({ onNewPoll, onNewVote, onSyncError }) {
    this.callbacks.onNewPoll = onNewPoll;
    this.callbacks.onNewVote = onNewVote;
    this.callbacks.onSyncError = onSyncError;
  }

  // Stop live sync
  async stopLiveSync() {
    if (this.subscriptions.polls) {
      await this.subscriptions.polls.unsubscribe(["/decenvote/1/polls/proto"]);
    }
    if (this.subscriptions.votes) {
      await this.subscriptions.votes.unsubscribe(["/decenvote/1/votes/proto"]);
    }
    console.log("🛑 Live sync stopped");
  }
}
```

### 3. Complete Sync Manager

```js
class DecenVoteSyncManager {
  constructor(node) {
    this.node = node;
    this.initialSync = new InitialSyncManager(node);
    this.liveSync = new LiveUpdateManager(node);

    // Application state
    this.state = {
      polls: [],
      votes: [],
      isLoading: true,
      lastSync: null,
      syncErrors: []
    };

    // Event callbacks
    this.callbacks = {
      onStateUpdate: null,
      onSyncComplete: null,
      onSyncError: null
    };
  }

  // Initialize complete synchronization
  async initialize() {
    try {
      console.log("🚀 Initializing DecenVote sync...");

      // Step 1: Perform initial sync (historical data)
      const historicalData = await this.initialSync.performInitialSync();

      // Update state with historical data
      this.updateState({
        polls: historicalData.polls,
        votes: historicalData.votes,
        isLoading: false,
        lastSync: new Date()
      });

      // Step 2: Setup live sync (real-time updates)
      this.liveSync.setCallbacks({
        onNewPoll: (poll) => this.handleNewPoll(poll),
        onNewVote: (vote) => this.handleNewVote(vote),
        onSyncError: (error) => this.handleSyncError(error)
      });

      await this.liveSync.setupLiveSync();

      console.log("✅ DecenVote sync initialized successfully");
      this.callbacks.onSyncComplete?.();

    } catch (error) {
      console.error("❌ Sync initialization failed:", error);
      this.handleSyncError(error);
      throw error;
    }
  }

  // Handle new poll from live sync
  handleNewPoll(newPoll) {
    // Check if poll already exists (prevent duplicates)
    const exists = this.state.polls.some(poll => poll.id === newPoll.id);

    if (!exists) {
      this.updateState({
        polls: [...this.state.polls, newPoll].sort((a, b) => b.timestamp - a.timestamp)
      });
      console.log(`📊 Added new poll: ${newPoll.question}`);
    }
  }

  // Handle new vote from live sync
  handleNewVote(newVote) {
    // Check if vote already exists (prevent duplicates)
    const exists = this.state.votes.some(vote =>
      vote.pollId === newVote.pollId &&
      vote.voterPublicKey === newVote.voterPublicKey
    );

    if (!exists) {
      this.updateState({
        votes: [...this.state.votes, newVote]
      });
      console.log(`🗳️ Added new vote for poll: ${newVote.pollId}`);
    }
  }

  // Update internal state and notify callbacks
  updateState(updates) {
    this.state = { ...this.state, ...updates };
    this.callbacks.onStateUpdate?.(this.state);
  }

  // Handle synchronization errors
  handleSyncError(error) {
    const syncError = {
      message: error.message,
      timestamp: new Date(),
      type: 'sync_error'
    };

    this.updateState({
      syncErrors: [...this.state.syncErrors.slice(-9), syncError] // Keep last 10 errors
    });

    this.callbacks.onSyncError?.(error);
  }

  // Get current state
  getState() {
    return { ...this.state };
  }

  // Set event callbacks
  setCallbacks({ onStateUpdate, onSyncComplete, onSyncError }) {
    this.callbacks.onStateUpdate = onStateUpdate;
    this.callbacks.onSyncComplete = onSyncComplete;
    this.callbacks.onSyncError = onSyncError;
  }

  // Stop all synchronization
  async stop() {
    await this.liveSync.stopLiveSync();
    console.log("🛑 DecenVote sync stopped");
  }
}
```

## React Integration

### Sync Hook

```jsx
function useDecenVoteSync(node) {
  const [syncState, setSyncState] = useState({
    polls: [],
    votes: [],
    isLoading: true,
    lastSync: null,
    syncErrors: []
  });

  const [syncManager, setSyncManager] = useState(null);

  // Initialize sync manager
  useEffect(() => {
    if (!node) return;

    const manager = new DecenVoteSyncManager(node);

    manager.setCallbacks({
      onStateUpdate: (state) => {
        setSyncState(state);
      },
      onSyncComplete: () => {
        console.log("✅ Sync completed successfully");
      },
      onSyncError: (error) => {
        console.error("❌ Sync error:", error);
      }
    });

    setSyncManager(manager);

    // Initialize synchronization
    manager.initialize().catch(error => {
      console.error("Failed to initialize sync:", error);
    });

    // Cleanup on unmount
    return () => {
      manager.stop();
    };
  }, [node]);

  return {
    ...syncState,
    syncManager
  };
}
```

### Sync Status Component

```jsx
function SyncStatus({ syncState, onRetry }) {
  const { isLoading, lastSync, syncErrors } = syncState;

  if (isLoading) {
    return (
      <div className="sync-status loading">
        <span className="sync-spinner">🔄</span>
        <span>Synchronizing with Waku network...</span>
      </div>
    );
  }

  const hasErrors = syncErrors.length > 0;
  const latestError = hasErrors ? syncErrors[syncErrors.length - 1] : null;

  return (
    <div className={`sync-status ${hasErrors ? 'error' : 'success'}`}>
      {hasErrors ? (
        <div className="sync-error">
          <span>⚠️ Sync issues detected</span>
          <span className="error-message">{latestError.message}</span>
          <button onClick={onRetry} className="retry-button">
            Retry
          </button>
        </div>
      ) : (
        <div className="sync-success">
          <span>✅ Synchronized</span>
          {lastSync && (
            <span className="last-sync">
              Last sync: {lastSync.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

## Conflict Resolution

### Message Deduplication

```js
class MessageDeduplicator {
  constructor() {
    this.seenMessages = new Set();
  }

  // Generate unique message ID
  generateMessageId(message, type) {
    if (type === 'poll') {
      return `poll_${message.id}_${message.timestamp}`;
    } else if (type === 'vote') {
      return `vote_${message.pollId}_${message.voterPublicKey}_${message.timestamp}`;
    }
    return null;
  }

  // Check and register message
  isNewMessage(message, type) {
    const messageId = this.generateMessageId(message, type);
    if (!messageId) return false;

    if (this.seenMessages.has(messageId)) {
      return false; // Already seen
    }

    this.seenMessages.add(messageId);
    return true; // New message
  }

  // Clean old message IDs (memory management)
  cleanup(maxSize = 10000) {
    if (this.seenMessages.size > maxSize) {
      // Simple cleanup: clear half of the oldest entries
      const entries = Array.from(this.seenMessages);
      entries.slice(0, Math.floor(entries.length / 2)).forEach(id => {
        this.seenMessages.delete(id);
      });
    }
  }
}
```

### State Reconciliation

```js
class StateReconciler {
  // Merge historical and live data
  static mergeData(historical, live, type) {
    const combined = [...historical, ...live];

    if (type === 'polls') {
      return this.deduplicatePolls(combined);
    } else if (type === 'votes') {
      return this.deduplicateVotes(combined);
    }

    return combined;
  }

  // Remove duplicate polls (same ID)
  static deduplicatePolls(polls) {
    const seen = new Map();

    polls.forEach(poll => {
      if (!seen.has(poll.id) || poll.timestamp > seen.get(poll.id).timestamp) {
        seen.set(poll.id, poll);
      }
    });

    return Array.from(seen.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // Remove duplicate votes (same poll + voter)
  static deduplicateVotes(votes) {
    const seen = new Map();

    // Sort by timestamp to ensure consistent ordering
    const sortedVotes = votes.sort((a, b) => a.timestamp - b.timestamp);

    sortedVotes.forEach(vote => {
      const key = `${vote.pollId}_${vote.voterPublicKey}`;

      if (!seen.has(key)) {
        seen.set(key, vote);
      }
      // Keep first vote (earliest timestamp)
    });

    return Array.from(seen.values());
  }

  // Validate data consistency
  static validateConsistency(polls, votes) {
    const issues = [];

    // Check for votes on non-existent polls
    const pollIds = new Set(polls.map(p => p.id));
    const orphanVotes = votes.filter(v => !pollIds.has(v.pollId));

    if (orphanVotes.length > 0) {
      issues.push({
        type: 'orphan_votes',
        count: orphanVotes.length,
        description: 'Votes for polls that do not exist'
      });
    }

    // Check for invalid vote option indices
    const invalidVotes = [];
    votes.forEach(vote => {
      const poll = polls.find(p => p.id === vote.pollId);
      if (poll && (vote.optionIndex < 0 || vote.optionIndex >= poll.options.length)) {
        invalidVotes.push(vote);
      }
    });

    if (invalidVotes.length > 0) {
      issues.push({
        type: 'invalid_vote_indices',
        count: invalidVotes.length,
        description: 'Votes with invalid option indices'
      });
    }

    return issues;
  }
}
```

## Network Disconnection Handling

### Offline Detection

```js
class OfflineHandler {
  constructor(syncManager) {
    this.syncManager = syncManager;
    this.isOnline = navigator.onLine;
    this.setupEventListeners();
  }

  setupEventListeners() {
    window.addEventListener('online', () => {
      console.log("🌐 Network connection restored");
      this.handleOnline();
    });

    window.addEventListener('offline', () => {
      console.log("📴 Network connection lost");
      this.handleOffline();
    });
  }

  async handleOnline() {
    this.isOnline = true;

    // Attempt to reconnect and resync
    try {
      await this.syncManager.initialize();
      console.log("✅ Reconnected and resynced");
    } catch (error) {
      console.error("❌ Reconnection failed:", error);
    }
  }

  handleOffline() {
    this.isOnline = false;
    // The app can still function with cached data
    console.log("📱 App running in offline mode");
  }

  getStatus() {
    return {
      isOnline: this.isOnline,
      lastCheck: new Date()
    };
  }
}
```

### Graceful Degradation

```jsx
function AppWithOfflineSupport() {
  const { node } = useWaku();
  const syncState = useDecenVoteSync(node);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="offline-mode">
        <h2>📴 Offline Mode</h2>
        <p>You can view existing polls and votes, but cannot create new polls or vote until connection is restored.</p>
        <PollsList polls={syncState.polls} votes={syncState.votes} readOnly />
      </div>
    );
  }

  return (
    <div className="online-mode">
      <SyncStatus syncState={syncState} />
      <DecenVoteApp {...syncState} />
    </div>
  );
}
```

This real-time synchronization system ensures DecenVote stays perfectly synchronized across all peers while gracefully handling network issues and conflicts.