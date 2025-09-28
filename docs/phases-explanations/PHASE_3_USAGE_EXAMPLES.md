# Phase 3: Message Protocols - Usage Examples

This document provides practical examples of how to use the DataService for Waku protocol operations.

## Overview

Phase 3 implementation includes:
- **ProtobufSchemas.ts**: Message structure definitions (PollData and VoteData)
- **DataService.ts**: Orchestrator that provides unified API for all protocols
- **protocols/LightPushService.ts**: Handles message publishing (Light Push protocol)
- **protocols/StoreService.ts**: Handles historical data loading (Store protocol)
- **protocols/FilterService.ts**: Handles real-time subscriptions (Filter protocol)

### Architecture

```
DataService (orchestrator - simple API)
  ├── LightPushService → Publishing polls/votes
  ├── StoreService → Loading historical data
  └── FilterService → Real-time subscriptions
```

This modular architecture makes it easier to:
- Understand each protocol independently
- Test individual protocols
- Learn Waku protocols step by step
- Extend functionality per protocol

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

## Publishing Messages (Light Push Protocol)

### Create and Publish a Poll

```typescript
import { createPollDataWithDefaults } from './services/DataService';

// Get user's identity
const identity = identityService.getIdentity();
if (!identity) {
  throw new Error('Identity not available');
}

// Create poll data
const pollData = createPollDataWithDefaults(
  "What's your favorite programming language?",
  ["TypeScript", "JavaScript", "Python", "Rust"],
  identity.publicKeyHex
);

// Publish the poll
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

// Create vote data
const voteData = createVoteDataWithDefaults(
  'poll_123456789',  // Poll ID
  0,                  // Option index (0 = first option)
  identity.publicKeyHex,
  ''                  // Signature (empty for now, Phase 5 will add signing)
);

// Publish the vote
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
try {
  const polls = await dataService.loadHistoricalPolls();
  console.log(`Loaded ${polls.length} polls`);

  // Display polls
  polls.forEach(poll => {
    console.log(`- ${poll.question}`);
    console.log(`  Options: ${poll.options.join(', ')}`);
  });
} catch (error) {
  console.error('Failed to load polls:', error);
}
```

### Load Historical Votes

```typescript
// Load all historical votes from the network
try {
  const votes = await dataService.loadHistoricalVotes();
  console.log(`Loaded ${votes.length} votes`);

  // Count votes per poll
  const votesByPoll = votes.reduce((acc, vote) => {
    acc[vote.pollId] = (acc[vote.pollId] || 0) + 1;
    return acc;
  }, {});

  console.log('Votes by poll:', votesByPoll);
} catch (error) {
  console.error('Failed to load votes:', error);
}
```

## Real-time Subscriptions (Filter Protocol)

### Subscribe to New Polls

```typescript
// Set up real-time subscription for new polls
try {
  await dataService.subscribeToPolls(
    (poll) => {
      // Callback: called when a new poll is received
      console.log('New poll received:', poll.question);

      // Update your UI here
      updatePollList(poll);
    },
    (error) => {
      // Error callback: called if decoding fails
      console.error('Poll subscription error:', error);
    }
  );

  console.log('Subscribed to new polls');
} catch (error) {
  console.error('Failed to subscribe to polls:', error);
}
```

### Subscribe to New Votes

```typescript
// Set up real-time subscription for new votes
try {
  await dataService.subscribeToVotes(
    (vote) => {
      // Callback: called when a new vote is received
      console.log('New vote received for poll:', vote.pollId);

      // Update vote counts in your UI
      updateVoteCount(vote.pollId, vote.optionIndex);
    },
    (error) => {
      // Error callback: called if decoding fails
      console.error('Vote subscription error:', error);
    }
  );

  console.log('Subscribed to new votes');
} catch (error) {
  console.error('Failed to subscribe to votes:', error);
}
```

## Complete Example: React Hook

Here's a complete example of a React hook that uses DataService:

```typescript
import { useEffect, useState } from 'react';
import { wakuService } from '../services/WakuService';
import { DataService } from '../services/DataService';
import type { IPollData, IVoteData } from '../services/ProtobufSchemas';

export function usePolls() {
  const [dataService, setDataService] = useState<DataService | null>(null);
  const [polls, setPolls] = useState<IPollData[]>([]);
  const [votes, setVotes] = useState<IVoteData[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize DataService
  useEffect(() => {
    const service = new DataService(wakuService);
    setDataService(service);

    return () => {
      // Cleanup on unmount
      service.cleanup();
    };
  }, []);

  // Load historical data and setup subscriptions
  useEffect(() => {
    if (!dataService || !wakuService.isReady()) {
      return;
    }

    const loadData = async () => {
      try {
        // Load historical data
        const [historicalPolls, historicalVotes] = await Promise.all([
          dataService.loadHistoricalPolls(),
          dataService.loadHistoricalVotes(),
        ]);

        setPolls(historicalPolls);
        setVotes(historicalVotes);

        // Setup real-time subscriptions
        await dataService.subscribeToPolls((newPoll) => {
          setPolls(prev => {
            // Avoid duplicates
            if (prev.some(p => p.id === newPoll.id)) {
              return prev;
            }
            return [...prev, newPoll];
          });
        });

        await dataService.subscribeToVotes((newVote) => {
          setVotes(prev => {
            // Avoid duplicates (same poll + voter)
            if (prev.some(v =>
              v.pollId === newVote.pollId &&
              v.voterPublicKey === newVote.voterPublicKey
            )) {
              return prev;
            }
            return [...prev, newVote];
          });
        });

        setLoading(false);
      } catch (error) {
        console.error('Failed to load data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [dataService]);

  return {
    dataService,
    polls,
    votes,
    loading,
  };
}
```

## Cleanup

Always cleanup subscriptions when they're no longer needed:

```typescript
// Unsubscribe from specific topics
await dataService.unsubscribeFromPolls();
await dataService.unsubscribeFromVotes();

// Or cleanup everything at once
await dataService.cleanup();
```

## Error Handling

The DataService includes basic validation and error handling:

```typescript
try {
  // Missing required fields will throw an error
  const invalidPoll = {
    id: '',  // Empty ID
    question: '',  // Empty question
    options: ['Only one option'],  // Less than 2 options
    createdBy: '',  // Empty creator
    timestamp: 0,  // Invalid timestamp
  };

  await dataService.publishPoll(invalidPoll);
} catch (error) {
  // Error will be caught here
  console.error('Validation failed:', error.message);
}
```

## Next Steps (Phase 4 & 5)

In the next phases, you'll:
- **Phase 4**: Create UI components that use these services
- **Phase 5**: Add vote signing and deduplication logic
- **Phase 6**: Integrate everything with custom React hooks

## Advanced Usage: Direct Protocol Access

For advanced use cases, you can access individual protocol services directly:

```typescript
const dataService = new DataService(wakuService);

// Direct access to individual protocol services
const lightPush = dataService.lightPush;
const store = dataService.store;
const filter = dataService.filter;

// Use individual services
await lightPush.publishPoll(pollData);
const polls = await store.loadHistoricalPolls();
await filter.subscribeToPolls(onPoll);
```

### When to Use Direct Access

- **Testing**: Test each protocol independently
- **Learning**: Understand how each protocol works in isolation
- **Debugging**: Isolate issues to specific protocols
- **Custom Logic**: Implement custom behavior for specific protocols

### Example: Using Only Store Protocol

```typescript
import { StoreService } from './services/protocols/StoreService';
import { wakuService } from './services/WakuService';

// Use only Store protocol for read-only view
const storeService = new StoreService(wakuService);

async function loadAllData() {
  const { polls, votes } = await storeService.loadAllHistoricalData();
  console.log(`Loaded ${polls.length} polls and ${votes.length} votes`);
}
```

## Tips for Developers

1. **Always initialize WakuService first** before creating DataService
2. **Wait for Waku to be ready** (`wakuService.isReady()`) before publishing/subscribing
3. **Handle errors gracefully** - network issues are common in P2P systems
4. **Cleanup subscriptions** when components unmount to prevent memory leaks
5. **Deduplicate messages** in your UI logic (polls by ID, votes by pollId + voterPublicKey)
6. **Use DataService for most cases** - it provides a simple, unified API
7. **Use individual services** only when you need protocol-specific control

## Testing

To test the implementation:

```bash
# Build the project
npm run build

# Start development server
npm start

# Open browser console and test manually
const { dataService } = usePolls();
await dataService.publishPoll(testPoll);
```

Check the browser console for logs from DataService showing:
- ✅ Successful operations
- ❌ Errors and validation failures
- 📡 Subscription events
- 📥 Historical data loading

---

**Phase 3 Complete!** You now have a fully functional message protocol system for DecenVote.