# Component Structure Guide

## Component Philosophy

**Keep it Simple:**
- One component = one responsibility
- Minimal props with clear interfaces
- Clear naming conventions
- Integration with modular service architecture
- Type safety with TypeScript

## Main Component Tree

```
App.tsx
├── ConnectionStatus.tsx (Connection status + Identity display)
├── PollCreation.tsx (Create new polls)
├── PollList.tsx (List all polls)
│   └── PollCard.tsx (Individual poll display)
│       ├── VoteInterface.tsx (Voting buttons)
│       └── VoteResults.tsx (Results display with real-time updates)
└── Footer.tsx (App information)
```

## Core Components

### 1. App.tsx (Main Container)

```typescript
// src/App.tsx
import React, { useState, useEffect } from 'react';
import { WakuService } from './services/WakuService';
import { DataService } from './services/DataService';
import ConnectionStatus from './components/ConnectionStatus';
import PollCreation from './components/PollCreation';
import PollList from './components/PollList';
import './App.css';

function App() {
  const [wakuService, setWakuService] = useState<WakuService | null>(null);
  const [dataService, setDataService] = useState<DataService | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize Waku service
        const waku = new WakuService();
        const node = await waku.initialize();
        setWakuService(waku);

        // Initialize DataService with the Waku node
        const data = new DataService(node);
        setDataService(data);

        setIsInitializing(false);
      } catch (err) {
        console.error('Failed to initialize services:', err);
        setError(err instanceof Error ? err.message : 'Initialization failed');
        setIsInitializing(false);
      }
    };

    initializeServices();

    // Cleanup on unmount
    return () => {
      dataService?.cleanup();
      wakuService?.stop();
    };
  }, []);

  if (isInitializing) {
    return (
      <div className="app loading">
        <div className="loading-container">
          <h2>🔄 Initializing DecenVote</h2>
          <p>Connecting to Waku network...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app error">
        <div className="error-container">
          <h2>❌ Connection Failed</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>DecenVote</h1>
        <ConnectionStatus
          wakuService={wakuService}
          dataService={dataService}
        />
      </header>

      <main className="app-main">
        <PollCreation dataService={dataService} />
        <PollList dataService={dataService} />
      </main>

      <footer className="app-footer">
        <span>Powered by Waku Network</span>
        <span>Fully decentralized • No servers required</span>
      </footer>
    </div>
  );
}

export default App;
```

### 2. ConnectionStatus.tsx (Status Display)

```typescript
// src/components/ConnectionStatus.tsx
import React, { useState, useEffect } from 'react';
import { WakuService } from '../services/WakuService';
import { DataService } from '../services/DataService';

interface ConnectionStatusProps {
  wakuService: WakuService | null;
  dataService: DataService | null;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  wakuService,
  dataService
}) => {
  const [identity, setIdentity] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (dataService) {
      const userIdentity = dataService.getOrCreateIdentity();
      setIdentity(userIdentity);
    }

    if (wakuService) {
      setIsConnected(wakuService.isConnected());
    }
  }, [wakuService, dataService]);

  return (
    <div className="connection-status">
      <div className="status-item">
        <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '✅ Connected' : '❌ Disconnected'}
        </span>
      </div>

      {identity && (
        <div className="status-item">
          <span className="identity-info">
            ID: {identity.publicKeyHex.slice(0, 8)}...
          </span>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
```

### 3. PollCreation.tsx (Create Polls)

```typescript
// src/components/PollCreation.tsx
import React, { useState } from 'react';
import { DataService } from '../services/DataService';
import { IPollData } from '../services/ProtobufSchemas';
import { DataValidator } from '../services/validators/DataValidator';

interface PollCreationProps {
  dataService: DataService | null;
}

export const PollCreation: React.FC<PollCreationProps> = ({ dataService }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!dataService) {
      setError('Data service not available');
      return;
    }

    try {
      // Validate input
      const validOptions = options.filter(opt => opt.trim().length > 0);

      if (!question.trim()) {
        throw new Error('Question is required');
      }

      if (validOptions.length < 2) {
        throw new Error('At least 2 options are required');
      }

      setIsSubmitting(true);

      // Get user identity
      const identity = dataService.getOrCreateIdentity();

      // Create poll data
      const poll: IPollData = {
        id: `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        question: question.trim(),
        options: validOptions,
        createdBy: identity.publicKeyHex,
        timestamp: Date.now()
      };

      // Validate poll before publishing
      if (!DataValidator.validatePoll(poll)) {
        throw new Error('Invalid poll data');
      }

      // Publish poll via DataService
      await dataService.publishPoll(poll);

      // Reset form
      setQuestion('');
      setOptions(['', '']);
      console.log('Poll created successfully:', poll.id);

    } catch (err) {
      console.error('Failed to create poll:', err);
      setError(err instanceof Error ? err.message : 'Failed to create poll');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  return (
    <div className="poll-creation">
      <h2>Create a Poll</h2>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="poll-form">
        <div className="form-group">
          <label htmlFor="question">Question:</label>
          <input
            id="question"
            type="text"
            placeholder="Enter your poll question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="form-group">
          <label>Options:</label>
          {options.map((option, index) => (
            <div key={index} className="option-input">
              <input
                type="text"
                placeholder={`Option ${index + 1}`}
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                disabled={isSubmitting}
                required
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="remove-option"
                  disabled={isSubmitting}
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addOption}
            className="add-option"
            disabled={isSubmitting}
          >
            + Add Option
          </button>
        </div>

        <button
          type="submit"
          className="create-poll-btn"
          disabled={isSubmitting || !question.trim()}
        >
          {isSubmitting ? 'Creating...' : 'Create Poll'}
        </button>
      </form>
    </div>
  );
};

export default PollCreation;
```

### 4. PollList.tsx (Display Polls)

```typescript
// src/components/PollList.tsx
import React from 'react';
import { DataService } from '../services/DataService';
import { usePolls } from '../hooks/usePolls';
import PollCard from './PollCard';

interface PollListProps {
  dataService: DataService | null;
}

export const PollList: React.FC<PollListProps> = ({ dataService }) => {
  const { polls, loading, error } = usePolls(dataService);

  if (loading) {
    return (
      <div className="poll-list loading">
        <h2>Polls</h2>
        <div className="loading-message">
          🔄 Loading polls...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="poll-list error">
        <h2>Polls</h2>
        <div className="error-message">
          ⚠️ {error}
        </div>
      </div>
    );
  }

  if (polls.length === 0) {
    return (
      <div className="poll-list empty">
        <h2>Polls</h2>
        <div className="empty-message">
          📋 No polls yet. Create the first one!
        </div>
      </div>
    );
  }

  return (
    <div className="poll-list">
      <h2>Polls ({polls.length})</h2>
      <div className="polls-container">
        {polls.map((poll) => (
          <PollCard
            key={poll.id}
            poll={poll}
            dataService={dataService}
          />
        ))}
      </div>
    </div>
  );
};

export default PollList;
```

### 5. PollCard.tsx (Individual Poll)

```typescript
// src/components/PollCard.tsx
import React, { useState } from 'react';
import { IPollData } from '../services/ProtobufSchemas';
import { DataService } from '../services/DataService';
import { useVotes } from '../hooks/useVotes';
import VoteInterface from './VoteInterface';
import VoteResults from './VoteResults';

interface PollCardProps {
  poll: IPollData;
  dataService: DataService | null;
}

export const PollCard: React.FC<PollCardProps> = ({ poll, dataService }) => {
  const [showResults, setShowResults] = useState(false);
  const { votes, hasVoted } = useVotes(dataService);

  const userHasVoted = hasVoted(poll.id);
  const pollVotes = votes.filter(vote => vote.pollId === poll.id);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="poll-card">
      <div className="poll-header">
        <h3 className="poll-question">{poll.question}</h3>
        <div className="poll-meta">
          <span className="poll-creator">
            By: {truncateAddress(poll.createdBy)}
          </span>
          <span className="poll-timestamp">
            {formatTimestamp(poll.timestamp)}
          </span>
        </div>
      </div>

      <div className="poll-content">
        {!userHasVoted ? (
          <VoteInterface
            poll={poll}
            dataService={dataService}
            disabled={!dataService}
          />
        ) : (
          <div className="voted-status">
            ✅ You have voted on this poll
          </div>
        )}

        <div className="poll-actions">
          <button
            onClick={() => setShowResults(!showResults)}
            className="toggle-results-btn"
          >
            {showResults ? 'Hide' : 'Show'} Results ({pollVotes.length} votes)
          </button>
        </div>

        {showResults && (
          <VoteResults
            poll={poll}
            votes={pollVotes}
          />
        )}
      </div>
    </div>
  );
};

export default PollCard;
```

### 6. VoteInterface.tsx (Voting Buttons)

```typescript
// src/components/VoteInterface.tsx
import React, { useState } from 'react';
import { IPollData, IVoteData } from '../services/ProtobufSchemas';
import { DataService } from '../services/DataService';
import { DataValidator } from '../services/validators/DataValidator';

interface VoteInterfaceProps {
  poll: IPollData;
  dataService: DataService | null;
  disabled?: boolean;
}

export const VoteInterface: React.FC<VoteInterfaceProps> = ({
  poll,
  dataService,
  disabled = false
}) => {
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVote = async (optionIndex: number) => {
    if (!dataService || disabled || isVoting) return;

    setError(null);
    setIsVoting(true);

    try {
      // Get user identity
      const identity = dataService.getOrCreateIdentity();

      // Create vote data
      const vote: IVoteData = {
        pollId: poll.id,
        optionIndex,
        voterPublicKey: identity.publicKeyHex,
        signature: '', // TODO: Implement proper signing
        timestamp: Date.now()
      };

      // Validate vote before publishing
      if (!DataValidator.validateVote(vote)) {
        throw new Error('Invalid vote data');
      }

      // Check option index is valid
      if (optionIndex < 0 || optionIndex >= poll.options.length) {
        throw new Error('Invalid option selected');
      }

      // Publish vote via DataService
      await dataService.publishVote(vote);

      console.log('Vote cast successfully:', {
        pollId: poll.id,
        option: poll.options[optionIndex]
      });

    } catch (err) {
      console.error('Failed to cast vote:', err);
      setError(err instanceof Error ? err.message : 'Failed to cast vote');
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="vote-interface">
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="vote-options">
        {poll.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleVote(index)}
            disabled={disabled || isVoting}
            className="vote-option"
          >
            {option}
          </button>
        ))}
      </div>

      {isVoting && (
        <div className="voting-status">
          🗳️ Casting your vote...
        </div>
      )}
    </div>
  );
};

export default VoteInterface;
```

### 7. VoteResults.tsx (Results Display)

```typescript
// src/components/VoteResults.tsx
import React from 'react';
import { IPollData, IVoteData } from '../services/ProtobufSchemas';

interface VoteResultsProps {
  poll: IPollData;
  votes: IVoteData[];
}

interface OptionResult {
  option: string;
  count: number;
  percentage: number;
}

export const VoteResults: React.FC<VoteResultsProps> = ({ poll, votes }) => {
  const calculateResults = (): OptionResult[] => {
    // Initialize vote counts for each option
    const counts = new Array(poll.options.length).fill(0);

    // Count votes for each option
    votes.forEach(vote => {
      if (vote.optionIndex >= 0 && vote.optionIndex < poll.options.length) {
        counts[vote.optionIndex]++;
      }
    });

    const totalVotes = votes.length;

    // Create result objects with percentages
    return poll.options.map((option, index) => ({
      option,
      count: counts[index],
      percentage: totalVotes > 0 ? Math.round((counts[index] / totalVotes) * 100) : 0
    }));
  };

  const results = calculateResults();
  const totalVotes = votes.length;
  const maxCount = Math.max(...results.map(r => r.count));

  return (
    <div className="vote-results">
      <div className="results-header">
        <h4>Results ({totalVotes} votes)</h4>
      </div>

      <div className="results-list">
        {results.map((result, index) => (
          <div
            key={index}
            className={`result-item ${result.count === maxCount && totalVotes > 0 ? 'winner' : ''}`}
          >
            <div className="result-header">
              <span className="option-text">{result.option}</span>
              <span className="vote-stats">
                {result.count} votes ({result.percentage}%)
              </span>
            </div>

            <div className="result-bar">
              <div
                className="result-fill"
                style={{ width: `${result.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {totalVotes === 0 && (
        <div className="no-votes">
          No votes yet. Be the first to vote!
        </div>
      )}
    </div>
  );
};

export default VoteResults;
```

## Custom Hooks Integration

### usePolls.ts

```typescript
// src/hooks/usePolls.ts
import { useState, useEffect } from 'react';
import { IPollData } from '../services/ProtobufSchemas';
import { DataService } from '../services/DataService';

export const usePolls = (dataService: DataService | null) => {
  const [polls, setPolls] = useState<IPollData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataService) return;

    const initializePolls = async () => {
      try {
        // Load historical polls
        const historicalPolls = await dataService.loadHistoricalPolls();
        setPolls(historicalPolls);

        // Subscribe to new polls
        await dataService.subscribeToPolls(
          (newPoll: IPollData) => {
            setPolls(prev => {
              // Check if poll already exists to prevent duplicates
              const exists = prev.some(p => p.id === newPoll.id);
              if (exists) return prev;

              // Add new poll and sort by timestamp (newest first)
              return [...prev, newPoll].sort((a, b) => b.timestamp - a.timestamp);
            });
          },
          (err: Error) => {
            console.error('Error in poll subscription:', err);
            setError(err.message);
          }
        );

        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize polls:', err);
        setError(err instanceof Error ? err.message : 'Failed to load polls');
        setLoading(false);
      }
    };

    initializePolls();
  }, [dataService]);

  return { polls, loading, error };
};
```

### useVotes.ts

```typescript
// src/hooks/useVotes.ts
import { useState, useEffect } from 'react';
import { IVoteData } from '../services/ProtobufSchemas';
import { DataService } from '../services/DataService';

export const useVotes = (dataService: DataService | null) => {
  const [votes, setVotes] = useState<IVoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataService) return;

    const initializeVotes = async () => {
      try {
        // Load historical votes
        const historicalVotes = await dataService.loadHistoricalVotes();
        setVotes(historicalVotes);

        // Subscribe to new votes
        await dataService.subscribeToVotes(
          (newVote: IVoteData) => {
            setVotes(prev => {
              // Check if vote already exists (prevent duplicate votes)
              const exists = prev.some(v =>
                v.pollId === newVote.pollId &&
                v.voterPublicKey === newVote.voterPublicKey
              );

              if (exists) {
                console.log('Duplicate vote detected, ignoring');
                return prev;
              }

              return [...prev, newVote];
            });
          },
          (err: Error) => {
            console.error('Error in vote subscription:', err);
            setError(err.message);
          }
        );

        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize votes:', err);
        setError(err instanceof Error ? err.message : 'Failed to load votes');
        setLoading(false);
      }
    };

    initializeVotes();
  }, [dataService]);

  // Helper function to check if user has voted on a specific poll
  const hasVoted = (pollId: string): boolean => {
    if (!dataService) return false;

    const identity = dataService.getCurrentIdentity();
    if (!identity) return false;

    return votes.some(vote =>
      vote.pollId === pollId &&
      vote.voterPublicKey === identity.publicKeyHex
    );
  };

  return { votes, loading, error, hasVoted };
};
```

## Styling Guidelines

### Component-Specific CSS

```css
/* src/App.css */
.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0;
  border-bottom: 2px solid #e1e5e9;
  margin-bottom: 30px;
}

.connection-status {
  display: flex;
  gap: 15px;
  align-items: center;
}

.status-indicator.connected {
  color: #28a745;
  font-weight: 500;
}

.status-indicator.disconnected {
  color: #dc3545;
  font-weight: 500;
}

.poll-card {
  background: #ffffff;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.vote-option {
  display: block;
  width: 100%;
  padding: 12px 16px;
  margin: 8px 0;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 16px;
}

.vote-option:hover:not(:disabled) {
  background: #e9ecef;
  border-color: #007bff;
}

.vote-option:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-item {
  margin: 12px 0;
}

.result-item.winner {
  background: #d4edda;
  padding: 8px;
  border-radius: 4px;
}

.result-bar {
  background: #e9ecef;
  height: 24px;
  border-radius: 12px;
  overflow: hidden;
  margin: 4px 0;
}

.result-fill {
  background: linear-gradient(90deg, #007bff, #0056b3);
  height: 100%;
  transition: width 0.5s ease;
  border-radius: 12px;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  margin: 10px 0;
  border: 1px solid #f5c6cb;
}

.loading-message {
  text-align: center;
  color: #6c757d;
  padding: 40px;
}
```

## Best Practices

### Component Design
- **Single Responsibility**: Each component handles one specific UI concern
- **Clear Props**: TypeScript interfaces define all component props
- **Error Handling**: All components handle loading and error states
- **DataService Integration**: Components use DataService for all Waku operations

### State Management
- **Custom Hooks**: Encapsulate all data fetching and state logic
- **Local State**: Use useState for UI-specific state
- **Effect Cleanup**: Proper cleanup of subscriptions and services

### Performance
- **Memoization**: Consider React.memo for expensive components
- **Efficient Updates**: Prevent unnecessary re-renders with proper dependency arrays
- **Resource Cleanup**: Always cleanup services and subscriptions

### Type Safety
- **TypeScript**: Full typing for all props, state, and service interactions
- **Interface Definitions**: Clear interfaces for all data structures
- **Validation**: Use DataValidator for all data validation

This component structure provides a clean, maintainable architecture that integrates seamlessly with the modular Waku service layer while maintaining simplicity and clarity for educational purposes.