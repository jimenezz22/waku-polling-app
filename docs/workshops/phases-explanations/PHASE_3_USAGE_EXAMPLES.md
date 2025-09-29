# Phase 3: ReliableChannel and Data Services - Usage Examples

This document provides practical examples of how to use the updated DataService with ReliableChannel and modular architecture for Waku protocol operations.

## Overview

Phase 3 implementation includes:
- **WakuConfig.ts**: Centralized configuration for all Waku settings
- **DataValidator.ts**: Centralized validation for all data types
- **ProtobufSchemas.ts**: Data structure definitions (PollData and VoteData)
- **DataService.ts**: Orchestrator providing unified API for all operations
- **ReliableChannelService.ts**: Real-time bidirectional communication via ReliableChannel
- **StoreService.ts**: Historical data loading with graceful error handling
- **Modular Channel System**: ChannelManager, DataProcessor, StoreErrorPatcher

### Architecture

```
DataService (unified API orchestrator)
  ├── ReliableChannelService → Real-time data via ReliableChannel
  │   ├── ChannelManager → Channel lifecycle management
  │   ├── DataProcessor → Data processing and buffering
  │   └── StoreErrorPatcher → Graceful Store error handling
  └── StoreService → Historical data loading (Store protocol)
```

This modular architecture provides:
- **Single API**: DataService as unified interface
- **Real-time communication**: ReliableChannel for bidirectional data flow
- **Graceful degradation**: App works even without Store peers
- **Centralized configuration**: Easy to modify settings
- **Comprehensive validation**: Data integrity and type safety
- **Error resilience**: Proper error handling and recovery

## Basic Setup

```typescript
import { wakuService } from './services/WakuService';
import { DataService } from './services/DataService';
import { identityService } from './services/IdentityService';

// Initialize Waku node first
await wakuService.initialize();

// Create DataService instance
const dataService = new DataService(wakuService);
```

## Publishing Data (ReliableChannel)

### Create and Publish a Poll

```typescript
import { createPollDataWithDefaults } from './services/DataService';

// Get user's identity
const identity = identityService.getIdentity();
if (!identity) {
  throw new Error('Identity not available');
}

// Create poll data (automatically validated)
const pollData = createPollDataWithDefaults(
  "What's your favorite programming language?",
  ["TypeScript", "JavaScript", "Python", "Rust"],
  identity.publicKeyHex
);

// Publish the poll via ReliableChannel
try {
  const publishedPoll = await dataService.publishPoll(pollData);
  console.log('Poll published:', publishedPoll.id);
} catch (error) {
  console.error('Failed to publish poll:', error);
}
```

### Cast a Vote

```typescript
import { createVoteDataWithDefaults } from './services/DataService';

// Get user's identity
const identity = identityService.getIdentity();
if (!identity) {
  throw new Error('Identity not available');
}

// Create vote data (automatically validated)
const voteData = createVoteDataWithDefaults(
  'poll_123456789',  // Poll ID
  0,                  // Option index (0 = first option)
  identity.publicKeyHex,
  ''                  // Signature (empty for now)
);

// Publish the vote via ReliableChannel
try {
  const publishedVote = await dataService.publishVote(voteData);
  console.log('Vote cast successfully');
} catch (error) {
  console.error('Failed to cast vote:', error);
}
```

## Loading Historical Data (Store Protocol)

### Load Historical Polls

```typescript
// Load all historical polls from the network
// Gracefully handles Store protocol unavailability
try {
  const polls = await dataService.loadHistoricalPolls();
  console.log(`Loaded ${polls.length} polls`);

  // Display polls (all data is pre-validated)
  polls.forEach(poll => {
    console.log(`- ${poll.question}`);
    console.log(`  Options: ${poll.options.join(', ')}`);
    console.log(`  Created: ${new Date(poll.timestamp).toLocaleString()}`);
  });
} catch (error) {
  console.error('Failed to load polls:', error);
  // App continues to work with real-time data only
}
```

### Load Historical Votes

```typescript
// Load all historical votes from the network
try {
  const votes = await dataService.loadHistoricalVotes();
  console.log(`Loaded ${votes.length} votes`);

  // Count votes per poll (with deduplication)
  const votesByPoll = votes.reduce((acc, vote) => {
    if (!acc[vote.pollId]) {
      acc[vote.pollId] = {};
    }
    acc[vote.pollId][vote.optionIndex] = (acc[vote.pollId][vote.optionIndex] || 0) + 1;
    return acc;
  }, {} as Record<string, Record<number, number>>);

  console.log('Vote counts by poll:', votesByPoll);
} catch (error) {
  console.error('Failed to load votes:', error);
  // App continues to work with real-time voting only
}
```

## Real-time Subscriptions (ReliableChannel)

### Subscribe to New Polls

```typescript
// Set up real-time subscription for new polls
// Includes automatic buffering and deduplication
try {
  await dataService.subscribeToPolls(
    (poll: IPollData) => {
      // Callback: called when a new poll is received
      console.log('New poll received:', poll.question);
      console.log('Poll ID:', poll.id);
      console.log('Creator:', poll.createdBy);

      // Data is pre-validated by DataProcessor
      // Update your UI here
      updatePollList(poll);
    },
    (error: Error) => {
      // Error callback: called for non-Store errors only
      console.error('Poll subscription error:', error);
      // Store errors are handled gracefully and don't reach here
    }
  );

  console.log('Subscribed to new polls via ReliableChannel');
} catch (error) {
  console.error('Failed to subscribe to polls:', error);
}
```

### Subscribe to New Votes

```typescript
// Set up real-time subscription for new votes
try {
  await dataService.subscribeToVotes(
    (vote: IVoteData) => {
      // Callback: called when a new vote is received
      console.log('New vote received for poll:', vote.pollId);
      console.log('Option selected:', vote.optionIndex);
      console.log('Voter:', vote.voterPublicKey);

      // Data is pre-validated by DataProcessor
      // Update vote counts in your UI
      updateVoteCount(vote.pollId, vote.optionIndex);
    },
    (error: Error) => {
      // Error callback: called for non-Store errors only
      console.error('Vote subscription error:', error);
    }
  );

  console.log('Subscribed to new votes via ReliableChannel');
} catch (error) {
  console.error('Failed to subscribe to votes:', error);
}
```

## Complete Example: React Hook

Here's a complete example of a React hook using the updated modular architecture:

```typescript
import { useEffect, useState } from 'react';
import { DataService } from '../services/DataService';
import type { IPollData, IVoteData } from '../services/ProtobufSchemas';

interface UsePolls {
  dataService: DataService | null;
  polls: IPollData[];
  votes: IVoteData[];
  loading: boolean;
  error: string | null;
  createPoll: (question: string, options: string[]) => Promise<void>;
  refreshPolls: () => Promise<void>;
}

export function usePolls(dataService: DataService | null): UsePolls {
  const [polls, setPolls] = useState<IPollData[]>([]);
  const [votes, setVotes] = useState<IVoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load historical data and setup subscriptions
  useEffect(() => {
    if (!dataService || !dataService.isReady()) {
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load historical data (gracefully handles Store unavailability)
        const [historicalPolls, historicalVotes] = await Promise.all([
          dataService.loadHistoricalPolls(),
          dataService.loadHistoricalVotes(),
        ]);

        setPolls(historicalPolls);
        setVotes(historicalVotes);

        // Setup real-time subscriptions with automatic buffering
        await dataService.subscribeToPolls(
          (newPoll: IPollData) => {
            console.log('📥 Received new poll:', newPoll.id);
            setPolls(prev => {
              // Prevent duplicates (handled by DataProcessor too)
              if (prev.some(p => p.id === newPoll.id)) {
                return prev;
              }
              return [newPoll, ...prev].sort((a, b) => b.timestamp - a.timestamp);
            });
          },
          (err: Error) => {
            console.error('Poll subscription error:', err);
            setError('Failed to subscribe to polls');
          }
        );

        await dataService.subscribeToVotes(
          (newVote: IVoteData) => {
            console.log('📥 Received new vote for poll:', newVote.pollId);
            setVotes(prev => {
              // Deduplicate by pollId + voterPublicKey (critical for vote integrity)
              if (prev.some(v =>
                v.pollId === newVote.pollId &&
                v.voterPublicKey === newVote.voterPublicKey
              )) {
                console.log('🔄 Duplicate vote ignored for poll:', newVote.pollId);
                return prev;
              }
              console.log('✅ Adding new vote to state for poll:', newVote.pollId);
              return [...prev, newVote];
            });
          },
          (err: Error) => {
            console.error('Vote subscription error:', err);
          }
        );

        setLoading(false);
      } catch (error) {
        console.error('Failed to load data:', error);
        setError('Failed to load polling data');
        setLoading(false);
      }
    };

    loadData();

    // Cleanup on unmount
    return () => {
      if (dataService) {
        dataService.unsubscribeFromPolls();
        dataService.unsubscribeFromVotes();
      }
    };
  }, [dataService]);

  // Create a new poll
  const createPoll = async (question: string, options: string[]) => {
    if (!dataService) {
      throw new Error('DataService not available');
    }

    const identity = identityService.getIdentity();
    if (!identity) {
      throw new Error('Identity not available');
    }

    const pollData = createPollDataWithDefaults(
      question,
      options,
      identity.publicKeyHex
    );

    await dataService.publishPoll(pollData);
  };

  // Refresh polls manually
  const refreshPolls = async () => {
    if (!dataService) return;

    try {
      const historicalPolls = await dataService.loadHistoricalPolls();
      setPolls(historicalPolls);
    } catch (error) {
      console.error('Failed to refresh polls:', error);
    }
  };

  return {
    dataService,
    polls,
    votes,
    loading,
    error,
    createPoll,
    refreshPolls,
  };
}
```

## Service Metrics and Debugging

The modular architecture provides metrics for debugging:

```typescript
// Get service metrics
const metrics = dataService.reliableChannel.getMetrics();
console.log('Service Metrics:', {
  senderId: metrics.senderId,
  channelCount: metrics.channelCount,
  activeChannels: metrics.channels,
  hasActiveSubscriptions: metrics.hasActiveSubscriptions,
  pendingData: metrics.pendingData
});

// Check if services are ready
console.log('Service Status:', {
  wakuReady: dataService.isReady(),
  storeReady: dataService.store.isReady(),
  reliableChannelReady: dataService.reliableChannel.isReady()
});
```

## Configuration Management

All settings are centralized in WakuConfig:

```typescript
import { WakuConfig } from '../services/config/WakuConfig';

// Access configuration
console.log('Waku Configuration:', {
  contentTopics: WakuConfig.CONTENT_TOPICS,
  nodeSettings: WakuConfig.NODE,
  protocolTimeouts: WakuConfig.PROTOCOL_TIMEOUTS,
  routing: WakuConfig.ROUTING
});

// Get specific content topic
const pollsTopic = WakuConfig.getContentTopic('polls');
const votesTopic = WakuConfig.getContentTopic('votes');
```

## Error Handling and Validation

The system includes comprehensive validation and error handling:

```typescript
import { DataValidator } from '../services/validators/DataValidator';

// Validation is automatic, but you can also validate manually
const pollData = {
  id: 'test-poll',
  question: 'Test question?',
  options: ['Option 1', 'Option 2'],
  createdBy: 'user123',
  timestamp: Date.now()
};

if (DataValidator.validatePoll(pollData)) {
  console.log('Poll data is valid');
} else {
  console.log('Poll data is invalid');
}

// Batch validation
const validPolls = DataValidator.filterValidPolls(allPolls);
const validVotes = DataValidator.filterValidVotes(allVotes);
```

## Cleanup and Resource Management

Proper cleanup prevents memory leaks:

```typescript
// Unsubscribe from specific topics
await dataService.unsubscribeFromPolls();
await dataService.unsubscribeFromVotes();

// Or cleanup everything at once
await dataService.cleanup();

// WakuService cleanup (when shutting down app)
await wakuService.cleanup();
```

## Advanced Usage: Direct Service Access

For advanced use cases, you can access individual services:

```typescript
const dataService = new DataService(wakuService);

// Access modular services directly
const reliableChannel = dataService.reliableChannel;
const store = dataService.store;

// Get detailed metrics
const channelMetrics = reliableChannel.getMetrics();
console.log('Channel Manager State:', channelMetrics);

// Check Store service independently
if (store.isReady()) {
  const { polls, votes } = await store.loadAllHistoricalData();
  console.log(`Store loaded: ${polls.length} polls, ${votes.length} votes`);
}
```

## Testing the Implementation

### Manual Testing

```bash
# Build and start the application
npm run build
npm start

# In browser console, test the services
const dataService = new DataService(wakuService);

// Test poll creation
await dataService.publishPoll({
  id: 'test-' + Date.now(),
  question: 'Test poll?',
  options: ['Yes', 'No'],
  createdBy: 'test-user',
  timestamp: Date.now()
});

// Test subscription
await dataService.subscribeToPolls((poll) => {
  console.log('Received poll:', poll);
});
```

### Validation Testing

```typescript
// Test data validation
try {
  const invalidPoll = {
    id: '',  // Invalid: empty ID
    question: '',  // Invalid: empty question
    options: ['Only one'],  // Invalid: less than 2 options
    createdBy: '',  // Invalid: empty creator
    timestamp: 0,  // Invalid: zero timestamp
  };

  await dataService.publishPoll(invalidPoll);
} catch (error) {
  console.log('✅ Validation correctly rejected invalid poll:', error.message);
}
```

## Next Steps (Phase 4 & 5)

In the next phases, you'll:
- **Phase 4**: Create UI components using these updated services
- **Phase 5**: Implement voting with comprehensive deduplication
- **Phase 6**: Add final polish and monitoring
- **Phase 7**: Testing and deployment optimization

## Key Differences from Previous Version

1. **ReliableChannel**: Replaces separate LightPush/Filter services
2. **Modular Architecture**: Clear separation of concerns
3. **Centralized Configuration**: All settings in WakuConfig
4. **Comprehensive Validation**: DataValidator handles all validation
5. **Graceful Error Handling**: App works even without Store peers
6. **Automatic Buffering**: DataProcessor handles early-arriving data
7. **Better Resource Management**: Proper cleanup and lifecycle management

## Tips for Developers

1. **Always use DataService** - it provides the unified, validated API
2. **Handle Store unavailability** - app should work with real-time data only
3. **Trust the validation** - DataValidator ensures data integrity
4. **Use configuration** - WakuConfig for all timeouts and settings
5. **Monitor metrics** - use getMetrics() for debugging
6. **Cleanup properly** - prevent memory leaks with proper unsubscription
7. **Deduplicate in UI** - especially important for votes (pollId + voterPublicKey)

---

**Phase 3 Complete!** You now have a robust, modular message protocol system with ReliableChannel integration, comprehensive validation, and graceful error handling.