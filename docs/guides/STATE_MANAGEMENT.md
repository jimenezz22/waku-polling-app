# State Management Guide

## Architecture Overview

DecenVote uses a **layered state management** approach that integrates the modular Waku service architecture with React's state management patterns. This provides clean separation between data layers while maintaining real-time synchronization.

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Waku Services     │ ←→ │   React Hooks       │ ←→ │   UI Components     │
│                     │    │                     │    │                     │
│ DataService         │    │ usePolls            │    │ PollList            │
│ ReliableChannel     │    │ useVotes            │    │ VoteInterface       │
│ StoreService        │    │ useState/useEffect  │    │ Form State          │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## State Layers

### 1. Service Layer (Waku Integration)
**What**: Abstracted Waku operations and data flow
**Where**: DataService, ReliableChannelService, StoreService
**Contains**:
- Real-time data subscriptions
- Historical data loading
- Data validation and processing
- Error handling and recovery

### 2. Hook Layer (Data Management)
**What**: React integration with service layer
**Where**: Custom hooks (usePolls, useVotes)
**Contains**:
- Service integration
- Data deduplication
- Loading and error states
- Subscription management

### 3. Component Layer (UI State)
**What**: Component-specific state and presentation
**Where**: React components with useState
**Contains**:
- Form inputs and validation
- UI interactions (toggles, modals)
- Loading indicators
- Error displays

## Custom Hooks Implementation

### usePolls.ts - Poll State Management

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
        setLoading(true);
        setError(null);

        // Load historical polls from Store protocol
        const historicalPolls = await dataService.loadHistoricalPolls();
        console.log(`Loaded ${historicalPolls.length} historical polls`);

        // Set initial polls state
        setPolls(historicalPolls.sort((a, b) => b.timestamp - a.timestamp));

        // Subscribe to real-time poll updates via ReliableChannel
        await dataService.subscribeToPolls(
          (newPoll: IPollData) => {
            console.log('New poll received:', newPoll.id);
            setPolls(prevPolls => {
              // Check for duplicates
              const exists = prevPolls.some(poll => poll.id === newPoll.id);
              if (exists) {
                console.log('Duplicate poll detected, skipping');
                return prevPolls;
              }

              // Add new poll and maintain sorting
              return [newPoll, ...prevPolls];
            });
          },
          (error: Error) => {
            console.error('Poll subscription error:', error);
            setError(`Real-time updates failed: ${error.message}`);
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

    // Cleanup subscription on unmount
    return () => {
      dataService.cleanup();
    };
  }, [dataService]);

  const createPoll = async (question: string, options: string[]): Promise<void> => {
    if (!dataService) throw new Error('DataService not available');

    const identity = dataService.getOrCreateIdentity();
    const poll: IPollData = {
      id: `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      question: question.trim(),
      options: options.filter(opt => opt.trim().length > 0),
      createdBy: identity.publicKeyHex,
      timestamp: Date.now()
    };

    await dataService.publishPoll(poll);
  };

  return {
    polls,
    loading,
    error,
    createPoll
  };
};
```

### useVotes.ts - Vote State Management

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
        setLoading(true);
        setError(null);

        // Load historical votes from Store protocol
        const historicalVotes = await dataService.loadHistoricalVotes();
        console.log(`Loaded ${historicalVotes.length} historical votes`);

        // Set initial votes state (deduplicated)
        setVotes(deduplicateVotes(historicalVotes));

        // Subscribe to real-time vote updates via ReliableChannel
        await dataService.subscribeToVotes(
          (newVote: IVoteData) => {
            console.log('New vote received for poll:', newVote.pollId);
            setVotes(prevVotes => {
              // Check for duplicate votes (same poll + voter)
              const exists = prevVotes.some(vote =>
                vote.pollId === newVote.pollId &&
                vote.voterPublicKey === newVote.voterPublicKey
              );

              if (exists) {
                console.log('Duplicate vote detected, rejecting');
                return prevVotes;
              }

              return [...prevVotes, newVote];
            });
          },
          (error: Error) => {
            console.error('Vote subscription error:', error);
            setError(`Real-time updates failed: ${error.message}`);
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

  // Cast a vote
  const castVote = async (pollId: string, optionIndex: number): Promise<void> => {
    if (!dataService) throw new Error('DataService not available');

    // Check if user already voted
    if (hasVoted(pollId)) {
      throw new Error('You have already voted on this poll');
    }

    const identity = dataService.getOrCreateIdentity();
    const vote: IVoteData = {
      pollId,
      optionIndex,
      voterPublicKey: identity.publicKeyHex,
      signature: '', // TODO: Implement proper signing
      timestamp: Date.now()
    };

    await dataService.publishVote(vote);
  };

  // Get votes for a specific poll
  const getVotesForPoll = (pollId: string): IVoteData[] => {
    return votes.filter(vote => vote.pollId === pollId);
  };

  return {
    votes,
    loading,
    error,
    hasVoted,
    castVote,
    getVotesForPoll
  };
};

// Utility function to remove duplicate votes
const deduplicateVotes = (votes: IVoteData[]): IVoteData[] => {
  const seen = new Map<string, IVoteData>();

  votes
    .sort((a, b) => a.timestamp - b.timestamp) // Keep earliest vote
    .forEach(vote => {
      const key = `${vote.pollId}_${vote.voterPublicKey}`;
      if (!seen.has(key)) {
        seen.set(key, vote);
      }
    });

  return Array.from(seen.values());
};
```

### useIdentity.ts - Identity Management

```typescript
// src/hooks/useIdentity.ts
import { useState, useEffect } from 'react';
import { DataService } from '../services/DataService';
import { IIdentity } from '../services/IdentityService';

export const useIdentity = (dataService: DataService | null) => {
  const [identity, setIdentity] = useState<IIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dataService) return;

    try {
      // Get or create identity through DataService
      const userIdentity = dataService.getOrCreateIdentity();
      setIdentity(userIdentity);
      setLoading(false);
    } catch (error) {
      console.error('Failed to initialize identity:', error);
      setLoading(false);
    }
  }, [dataService]);

  const regenerateIdentity = () => {
    if (!dataService) return;

    // Clear existing identity and generate new one
    dataService.clearIdentity();
    const newIdentity = dataService.getOrCreateIdentity();
    setIdentity(newIdentity);
  };

  return {
    identity,
    loading,
    regenerateIdentity
  };
};
```

## State Processing Utilities

### Data Processing and Validation

```typescript
// src/utils/stateUtils.ts
import { IPollData, IVoteData } from '../services/ProtobufSchemas';
import { DataValidator } from '../services/validators/DataValidator';

// Process and validate polls from raw data
export const processPolls = (rawPolls: IPollData[]): IPollData[] => {
  return rawPolls
    .filter(poll => DataValidator.validatePoll(poll))
    .sort((a, b) => b.timestamp - a.timestamp); // Newest first
};

// Process and validate votes from raw data
export const processVotes = (rawVotes: IVoteData[]): IVoteData[] => {
  const validVotes = rawVotes.filter(vote => DataValidator.validateVote(vote));
  return deduplicateVotes(validVotes);
};

// Calculate vote results for a poll
export const calculateVoteResults = (
  poll: IPollData,
  votes: IVoteData[]
): VoteResult[] => {
  const pollVotes = votes.filter(vote => vote.pollId === poll.id);
  const totalVotes = pollVotes.length;

  return poll.options.map((option, index) => {
    const count = pollVotes.filter(vote => vote.optionIndex === index).length;
    const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

    return {
      option,
      count,
      percentage,
      isWinner: count > 0 && count === Math.max(...poll.options.map((_, i) =>
        pollVotes.filter(vote => vote.optionIndex === i).length
      ))
    };
  });
};

interface VoteResult {
  option: string;
  count: number;
  percentage: number;
  isWinner: boolean;
}

// Remove duplicate votes by poll + voter
const deduplicateVotes = (votes: IVoteData[]): IVoteData[] => {
  const voteMap = new Map<string, IVoteData>();

  votes
    .sort((a, b) => a.timestamp - b.timestamp) // Keep first vote
    .forEach(vote => {
      const key = `${vote.pollId}_${vote.voterPublicKey}`;
      if (!voteMap.has(key)) {
        voteMap.set(key, vote);
      }
    });

  return Array.from(voteMap.values());
};
```

## Error Handling and Loading States

### Centralized Error Management

```typescript
// src/hooks/useErrorHandler.ts
import { useState, useCallback } from 'react';

export const useErrorHandler = () => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setError = useCallback((key: string, message: string) => {
    setErrors(prev => ({ ...prev, [key]: message }));
  }, []);

  const clearError = useCallback((key: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[key];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const hasError = useCallback((key?: string) => {
    if (key) return Boolean(errors[key]);
    return Object.keys(errors).length > 0;
  }, [errors]);

  return {
    errors,
    setError,
    clearError,
    clearAllErrors,
    hasError
  };
};
```

### Loading State Management

```typescript
// src/hooks/useLoadingState.ts
import { useState, useCallback } from 'react';

export const useLoadingState = (initialState = false) => {
  const [loading, setLoading] = useState(initialState);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const setGlobalLoading = useCallback((isLoading: boolean) => {
    setLoading(isLoading);
  }, []);

  const setSpecificLoading = useCallback((key: string, isLoading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: isLoading }));
  }, []);

  const isLoading = useCallback((key?: string) => {
    if (key) return Boolean(loadingStates[key]);
    return loading || Object.values(loadingStates).some(Boolean);
  }, [loading, loadingStates]);

  return {
    loading,
    loadingStates,
    setGlobalLoading,
    setSpecificLoading,
    isLoading
  };
};
```

## Component Integration Patterns

### State Provider Pattern

```typescript
// src/contexts/DecenVoteContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { DataService } from '../services/DataService';
import { usePolls } from '../hooks/usePolls';
import { useVotes } from '../hooks/useVotes';
import { useIdentity } from '../hooks/useIdentity';

interface DecenVoteContextType {
  polls: ReturnType<typeof usePolls>;
  votes: ReturnType<typeof useVotes>;
  identity: ReturnType<typeof useIdentity>;
}

const DecenVoteContext = createContext<DecenVoteContextType | null>(null);

interface DecenVoteProviderProps {
  dataService: DataService | null;
  children: ReactNode;
}

export const DecenVoteProvider: React.FC<DecenVoteProviderProps> = ({
  dataService,
  children
}) => {
  const polls = usePolls(dataService);
  const votes = useVotes(dataService);
  const identity = useIdentity(dataService);

  const value = {
    polls,
    votes,
    identity
  };

  return (
    <DecenVoteContext.Provider value={value}>
      {children}
    </DecenVoteContext.Provider>
  );
};

export const useDecenVote = () => {
  const context = useContext(DecenVoteContext);
  if (!context) {
    throw new Error('useDecenVote must be used within DecenVoteProvider');
  }
  return context;
};
```

### Component Usage Example

```typescript
// Example: PollCard component using state hooks
import React from 'react';
import { IPollData } from '../services/ProtobufSchemas';
import { useDecenVote } from '../contexts/DecenVoteContext';
import { calculateVoteResults } from '../utils/stateUtils';

interface PollCardProps {
  poll: IPollData;
}

export const PollCard: React.FC<PollCardProps> = ({ poll }) => {
  const { votes, identity } = useDecenVote();

  // Derived state from hooks
  const pollVotes = votes.getVotesForPoll(poll.id);
  const userHasVoted = votes.hasVoted(poll.id);
  const results = calculateVoteResults(poll, pollVotes);

  const handleVote = async (optionIndex: number) => {
    try {
      await votes.castVote(poll.id, optionIndex);
    } catch (error) {
      console.error('Failed to cast vote:', error);
    }
  };

  return (
    <div className="poll-card">
      <h3>{poll.question}</h3>

      {!userHasVoted ? (
        <div className="vote-options">
          {poll.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleVote(index)}
              className="vote-option"
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <div className="vote-results">
          {results.map((result, index) => (
            <div key={index} className="result-item">
              <span>{result.option}</span>
              <div className="result-bar">
                <div
                  className="result-fill"
                  style={{ width: `${result.percentage}%` }}
                />
              </div>
              <span>{result.count} ({result.percentage}%)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

## Performance Optimization

### Memoization Strategies

```typescript
import { useMemo } from 'react';

// Memoize expensive calculations
export const usePollResults = (polls: IPollData[], votes: IVoteData[]) => {
  return useMemo(() => {
    return polls.map(poll => ({
      ...poll,
      results: calculateVoteResults(poll, votes),
      totalVotes: votes.filter(v => v.pollId === poll.id).length
    }));
  }, [polls, votes]);
};

// Memoize filtered data
export const useFilteredPolls = (polls: IPollData[], filter: string) => {
  return useMemo(() => {
    if (!filter) return polls;
    return polls.filter(poll =>
      poll.question.toLowerCase().includes(filter.toLowerCase())
    );
  }, [polls, filter]);
};
```

### Subscription Cleanup

```typescript
// Proper cleanup pattern for subscriptions
useEffect(() => {
  if (!dataService) return;

  let isActive = true;

  const initialize = async () => {
    try {
      await dataService.subscribeToPolls(
        (poll) => {
          if (isActive) {
            // Only update state if component is still mounted
            setPolls(prev => [...prev, poll]);
          }
        },
        (error) => {
          if (isActive) {
            setError(error.message);
          }
        }
      );
    } catch (err) {
      if (isActive) {
        setError(err.message);
      }
    }
  };

  initialize();

  return () => {
    isActive = false;
    dataService.cleanup();
  };
}, [dataService]);
```

## Best Practices

### 1. Service Layer Integration
- Use DataService as the single point of contact with Waku
- Let services handle all Waku-specific operations
- Keep components focused on UI concerns

### 2. State Synchronization
- Trust the service layer for data consistency
- Use hooks to bridge services and React
- Implement proper deduplication at the hook level

### 3. Error Handling
- Handle errors at the appropriate level (service, hook, or component)
- Provide meaningful error messages to users
- Implement fallback UI states

### 4. Performance
- Memoize expensive calculations
- Use proper dependency arrays in useEffect
- Implement cleanup to prevent memory leaks

### 5. Type Safety
- Use TypeScript interfaces throughout the state layer
- Validate data at service boundaries
- Maintain strict typing in hooks and components

This state management approach provides a clean, scalable architecture that leverages the modular Waku service layer while maintaining React best practices for state management and component integration.