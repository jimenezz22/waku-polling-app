# DecenVote State Management

## Architecture Overview

DecenVote uses a **hybrid state management** approach combining React's built-in state management with Waku as the distributed data layer.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Waku Network  │ ←→ │ React Component │ ←→ │   User Interface│
│                 │    │     State       │    │                 │
│ Store + Filter  │    │ useState/Effect │    │  Forms + Lists  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## State Layers

### 1. Persistent State (Waku)
**What**: Data that needs to persist and sync across peers
**Where**: Waku Store protocol (historical) + Filter protocol (real-time)
**Contains**:
- Poll definitions
- Vote records
- Message signatures

### 2. Application State (React)
**What**: Derived data and UI state
**Where**: React `useState` and `useEffect`
**Contains**:
- Processed polls list
- Calculated vote counts
- User interface state
- Current user identity

### 3. UI State (React)
**What**: Ephemeral interface state
**Where**: Component-level `useState`
**Contains**:
- Form inputs
- Loading states
- Modal visibility
- Error messages

## Implementation Patterns

### Basic State Structure

```jsx
function DecenVoteApp() {
  // Persistent data (derived from Waku)
  const [polls, setPolls] = useState([]); // All polls
  const [votes, setVotes] = useState([]); // All votes
  const [identity, setIdentity] = useState(null); // User identity

  // UI state
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [loadingStates, setLoadingStates] = useState({});
  const [errors, setErrors] = useState({});

  // Form state
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
}
```

### Data Flow Pattern

```jsx
// 1. Waku → React State Synchronization
const { messages: historicalPolls } = useStoreMessages({ node, decoder: pollDecoder });
const { messages: livePolls } = useFilterMessages({ node, decoder: pollDecoder });

// 2. Process and merge Waku data
useEffect(() => {
  const allPollMessages = [...historicalPolls, ...livePolls];
  const decodedPolls = processPollMessages(allPollMessages);

  // Remove duplicates and update state
  const uniquePolls = deduplicatePolls(decodedPolls);
  setPolls(uniquePolls);
}, [historicalPolls, livePolls]);

// 3. Derive computed state
const pollsWithResults = useMemo(() => {
  return polls.map(poll => ({
    ...poll,
    results: calculateVoteResults(poll.id, votes),
    totalVotes: getVoteCount(poll.id, votes),
    userHasVoted: hasUserVoted(poll.id, votes, identity?.publicKey)
  }));
}, [polls, votes, identity]);
```

## State Management Utilities

### Message Processing

```jsx
// Utility function to process Waku messages
const processPollMessages = (wakuMessages) => {
  return wakuMessages
    .filter(msg => msg.payload)
    .map(msg => {
      try {
        return PollMessage.decode(msg.payload);
      } catch (error) {
        console.error('Failed to decode poll message:', error);
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.timestamp - a.timestamp); // Latest first
};

const processVoteMessages = (wakuMessages) => {
  return wakuMessages
    .filter(msg => msg.payload)
    .map(msg => {
      try {
        return VoteMessage.decode(msg.payload);
      } catch (error) {
        console.error('Failed to decode vote message:', error);
        return null;
      }
    })
    .filter(Boolean);
};
```

### Deduplication

```jsx
// Remove duplicate polls (same ID)
const deduplicatePolls = (polls) => {
  const seen = new Set();
  return polls.filter(poll => {
    if (seen.has(poll.id)) {
      return false;
    }
    seen.add(poll.id);
    return true;
  });
};

// Remove duplicate votes (same pollId + voterPublicKey)
const deduplicateVotes = (votes) => {
  const seen = new Set();
  return votes.filter(vote => {
    const key = `${vote.pollId}_${vote.voterPublicKey}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};
```

### Vote Calculations

```jsx
// Calculate vote results for a poll
const calculateVoteResults = (pollId, allVotes) => {
  const pollVotes = allVotes.filter(vote => vote.pollId === pollId);
  const poll = polls.find(p => p.id === pollId);

  if (!poll) return [];

  return poll.options.map((option, index) => {
    const count = pollVotes.filter(vote => vote.optionIndex === index).length;
    const percentage = pollVotes.length > 0
      ? Math.round((count / pollVotes.length) * 100)
      : 0;

    return {
      option,
      count,
      percentage
    };
  });
};

// Check if user has voted on a poll
const hasUserVoted = (pollId, allVotes, userPublicKey) => {
  if (!userPublicKey) return false;

  return allVotes.some(vote =>
    vote.pollId === pollId && vote.voterPublicKey === userPublicKey
  );
};
```

## Complete State Management Hook

```jsx
// Custom hook for DecenVote state management
function useDecenVoteState(node, identity) {
  // Raw Waku data
  const { messages: historicalPolls } = useStoreMessages({
    node,
    decoder: pollDecoder
  });
  const { messages: livePolls } = useFilterMessages({
    node,
    decoder: pollDecoder
  });
  const { messages: historicalVotes } = useStoreMessages({
    node,
    decoder: voteDecoder
  });
  const { messages: liveVotes } = useFilterMessages({
    node,
    decoder: voteDecoder
  });

  // Processed state
  const [polls, setPolls] = useState([]);
  const [votes, setVotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Process polls
  useEffect(() => {
    const allPollMessages = [...historicalPolls, ...livePolls];
    const processed = processPollMessages(allPollMessages);
    const unique = deduplicatePolls(processed);
    setPolls(unique);

    if (allPollMessages.length > 0) {
      setIsLoading(false);
    }
  }, [historicalPolls, livePolls]);

  // Process votes
  useEffect(() => {
    const allVoteMessages = [...historicalVotes, ...liveVotes];
    const processed = processVoteMessages(allVoteMessages);
    const unique = deduplicateVotes(processed);
    setVotes(unique);
  }, [historicalVotes, liveVotes]);

  // Computed state
  const pollsWithResults = useMemo(() => {
    return polls.map(poll => ({
      ...poll,
      results: calculateVoteResults(poll.id, votes),
      totalVotes: votes.filter(v => v.pollId === poll.id).length,
      userHasVoted: hasUserVoted(poll.id, votes, identity?.publicKey)
    }));
  }, [polls, votes, identity]);

  return {
    polls: pollsWithResults,
    votes,
    isLoading,

    // Helper functions
    getPollResults: (pollId) => calculateVoteResults(pollId, votes),
    getUserVote: (pollId) => votes.find(v =>
      v.pollId === pollId && v.voterPublicKey === identity?.publicKey
    )
  };
}
```

## Error Handling in State

```jsx
// Error boundary for state errors
const StateErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleError = (error) => {
      console.error('State management error:', error);
      setError(error);
      setHasError(true);
    };

    window.addEventListener('unhandledrejection', handleError);
    return () => window.removeEventListener('unhandledrejection', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="error-fallback">
        <h2>Something went wrong with data synchronization</h2>
        <button onClick={() => window.location.reload()}>
          Reload Application
        </button>
      </div>
    );
  }

  return children;
};

// State update error handling
const safeStateUpdate = (setter, newValue, fallback = null) => {
  try {
    setter(newValue);
  } catch (error) {
    console.error('State update failed:', error);
    if (fallback !== null) {
      setter(fallback);
    }
  }
};
```

## Performance Optimizations

### Memoization

```jsx
// Memoize expensive calculations
const pollResults = useMemo(() => {
  return polls.map(poll => ({
    ...poll,
    results: calculateVoteResults(poll.id, votes)
  }));
}, [polls, votes]);

// Memoize filtered data
const userPolls = useMemo(() => {
  if (!identity) return [];
  return polls.filter(poll => poll.createdBy === identity.publicKey);
}, [polls, identity]);
```

### Debounced Updates

```jsx
// Debounce rapid state updates
import { useDebouncedCallback } from 'use-debounce';

const debouncedPollUpdate = useDebouncedCallback(
  (newPolls) => {
    setPolls(newPolls);
  },
  300 // 300ms delay
);
```

## State Persistence

```jsx
// Persist UI state to localStorage
const usePersistedUIState = (key, defaultValue) => {
  const [state, setState] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to persist UI state:', error);
    }
  }, [key, state]);

  return [state, setState];
};

// Usage
const [uiPreferences, setUiPreferences] = usePersistedUIState('decenvote_ui', {
  theme: 'light',
  sortOrder: 'newest'
});
```

## Best Practices

### 1. Single Source of Truth
- Waku is the source of truth for persistent data
- React state is derived from Waku data
- UI state stays in React components

### 2. Unidirectional Data Flow
```
Waku Store/Filter → Process → React State → UI Components
                     ↑
                Message Validation
```

### 3. Separation of Concerns
- **Waku**: Data persistence and synchronization
- **React State**: Data transformation and UI state
- **Components**: Data presentation

### 4. Error Boundaries
- Wrap state-dependent components in error boundaries
- Graceful degradation when Waku is unavailable
- Clear error messages for users

### 5. Loading States
- Show loading while Waku data is syncing
- Progressive loading (show cached data first)
- Clear indication of sync status

This architecture keeps DecenVote simple while leveraging Waku's decentralized nature and React's reactive updates.