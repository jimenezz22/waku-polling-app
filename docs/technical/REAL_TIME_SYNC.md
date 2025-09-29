# Real-Time Synchronization with ReliableChannel

## Overview

DecenVote achieves real-time synchronization using **ReliableChannel** for bidirectional communication combined with **Store protocol** for historical data. This document details the implementation patterns for maintaining synchronized state across all peers.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ReliableChannel   │    │   Store Protocol    │    │   Application   │
│   (Real-time)       │ +  │   (Historical)      │ =  │     State       │
│   - Live polls      │    │   - Past polls      │    │   (Complete)    │
│   - Live votes      │    │   - Past votes      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        ↓                       ↓                       ↓
   Instant updates         When app starts         Merged view
   Automatic buffering     Graceful fallback       Always current
```

## ReliableChannel Integration

### 1. Channel Management and Real-Time Data Flow

```typescript
// ReliableChannel provides bidirectional communication with automatic buffering
export class ReliableChannelService {
  private channelManager: ChannelManager;
  private dataProcessor: DataProcessor;
  private storeErrorPatcher: StoreErrorPatcher;

  constructor(private node: LightNode) {
    this.channelManager = new ChannelManager(node);
    this.dataProcessor = new DataProcessor();
    this.storeErrorPatcher = new StoreErrorPatcher();
  }

  // Real-time poll publishing
  async publishPoll(poll: IPollData): Promise<void> {
    const channel = await this.channelManager.createChannel(
      WakuConfig.RELIABLE_CHANNEL_TOPICS.polls
    );
    const payload = PollDataCodec.encode(poll);
    await channel.send(payload);
  }

  // Real-time vote publishing
  async publishVote(vote: IVoteData): Promise<void> {
    const channel = await this.channelManager.createChannel(
      WakuConfig.RELIABLE_CHANNEL_TOPICS.votes
    );
    const payload = VoteDataCodec.encode(vote);
    await channel.send(payload);
  }

  // Real-time subscriptions with automatic buffering
  private async setupSubscriptions(): Promise<void> {
    const pollChannel = await this.channelManager.createChannel(
      WakuConfig.RELIABLE_CHANNEL_TOPICS.polls
    );

    await pollChannel.subscribe((payload: Uint8Array) => {
      const poll = PollDataCodec.decode(payload);
      this.dataProcessor.processPoll(poll); // Automatic buffering if not ready
    });

    const voteChannel = await this.channelManager.createChannel(
      WakuConfig.RELIABLE_CHANNEL_TOPICS.votes
    );

    await voteChannel.subscribe((payload: Uint8Array) => {
      const vote = VoteDataCodec.decode(payload);
      this.dataProcessor.processVote(vote); // Automatic buffering if not ready
    });
  }
}
```

### 2. Data Processing and Buffering

```typescript
// Automatic data buffering for early-arriving data
export class DataProcessor {
  private pollBuffer: IPollData[] = [];
  private voteBuffer: IVoteData[] = [];
  private isReady = false;

  private pollCallbacks: PollCallback[] = [];
  private voteCallbacks: VoteCallback[] = [];

  // Set readiness state - flushes buffers when ready
  setReady(ready: boolean): void {
    this.isReady = ready;
    if (ready) {
      this.flushBuffers();
    }
  }

  // Process incoming poll with automatic buffering
  processPoll(poll: IPollData): void {
    if (!DataValidator.validatePoll(poll)) {
      console.warn(`Invalid poll data: ${poll.id}`);
      return;
    }

    if (this.isReady) {
      // App is ready - process immediately
      this.notifyPollCallbacks(poll);
    } else {
      // App not ready - buffer for later
      this.pollBuffer.push(poll);
      console.log(`Buffered poll: ${poll.id} (total buffered: ${this.pollBuffer.length})`);
    }
  }

  // Process incoming vote with automatic buffering
  processVote(vote: IVoteData): void {
    if (!DataValidator.validateVote(vote)) {
      console.warn(`Invalid vote data for poll: ${vote.pollId}`);
      return;
    }

    if (this.isReady) {
      // App is ready - process immediately
      this.notifyVoteCallbacks(vote);
    } else {
      // App not ready - buffer for later
      this.voteBuffer.push(vote);
      console.log(`Buffered vote for poll: ${vote.pollId} (total buffered: ${this.voteBuffer.length})`);
    }
  }

  // Flush all buffered data when app becomes ready
  private flushBuffers(): void {
    console.log(`Flushing ${this.pollBuffer.length} polls and ${this.voteBuffer.length} votes from buffer`);

    this.pollBuffer.forEach(poll => this.notifyPollCallbacks(poll));
    this.voteBuffer.forEach(vote => this.notifyVoteCallbacks(vote));

    this.pollBuffer = [];
    this.voteBuffer = [];
  }

  private notifyPollCallbacks(poll: IPollData): void {
    this.pollCallbacks.forEach(callback => {
      try {
        callback(poll);
      } catch (error) {
        console.error('Error in poll callback:', error);
      }
    });
  }

  private notifyVoteCallbacks(vote: IVoteData): void {
    this.voteCallbacks.forEach(callback => {
      try {
        callback(vote);
      } catch (error) {
        console.error('Error in vote callback:', error);
      }
    });
  }
}
```

### 3. Store Protocol Integration with Graceful Fallback

```typescript
// Historical data loading with graceful degradation
export class StoreService {
  constructor(private node: LightNode) {}

  async loadHistoricalPolls(): Promise<IPollData[]> {
    try {
      return await this.loadHistoricalData<IPollData>(
        WakuConfig.CONTENT_TOPICS.polls,
        PollDataCodec.decode,
        DataValidator.validatePoll
      );
    } catch (error) {
      console.warn('Store protocol unavailable for polls - app will work with real-time data only:', error.message);
      return [];
    }
  }

  async loadHistoricalVotes(): Promise<IVoteData[]> {
    try {
      return await this.loadHistoricalData<IVoteData>(
        WakuConfig.CONTENT_TOPICS.votes,
        VoteDataCodec.decode,
        DataValidator.validateVote
      );
    } catch (error) {
      console.warn('Store protocol unavailable for votes - app will work with real-time data only:', error.message);
      return [];
    }
  }

  private async loadHistoricalData<T>(
    contentTopic: string,
    decoder: (buffer: Uint8Array) => T,
    validator: (data: T) => boolean
  ): Promise<T[]> {
    const data: T[] = [];
    const storeDecoder = createDecoder(contentTopic);

    await this.node.store.queryWithOrderedCallback(
      [storeDecoder],
      (wakuMessage) => {
        if (!wakuMessage.payload) return;

        try {
          const decodedData = decoder(wakuMessage.payload);
          if (validator(decodedData)) {
            data.push(decodedData);
          }
        } catch (error) {
          console.error(`Failed to decode Store data:`, error);
        }
      },
      {
        timeFilter: {
          startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          endTime: new Date(),
        },
      }
    );

    console.log(`Loaded ${data.length} items from Store for topic: ${contentTopic}`);
    return data;
  }
}
```

### 4. Error Handling and Graceful Degradation

```typescript
// Graceful Store protocol error handling
export class StoreErrorPatcher {
  patchStoreError(error: Error): PatchedError {
    const errorMessage = error.message.toLowerCase();

    // Known Store protocol errors that allow graceful degradation
    if (
      errorMessage.includes('no store peers available') ||
      errorMessage.includes('store query failed') ||
      errorMessage.includes('no peers available') ||
      errorMessage.includes('timeout')
    ) {
      console.warn('Store protocol error - continuing with real-time only:', error.message);
      return {
        error: new Error('Store protocol unavailable - app will work with real-time data only'),
        shouldContinue: true
      };
    }

    // Critical errors that should not be ignored
    return {
      error,
      shouldContinue: false
    };
  }
}

// Integration in ReliableChannelService
private async setupSubscriptions(): Promise<void> {
  try {
    // Normal subscription setup
    await this.createChannelsAndSubscribe();
    this.dataProcessor.setReady(true);
  } catch (error) {
    const patchedError = this.storeErrorPatcher.patchStoreError(error as Error);

    if (patchedError.shouldContinue) {
      console.warn('Store protocol unavailable, continuing with real-time only');
      this.dataProcessor.setReady(true); // App still works
    } else {
      throw patchedError.error; // Critical error
    }
  }
}
```

## Complete Integration Pattern

### 1. DataService Orchestration

```typescript
// Unified API that coordinates ReliableChannel and Store
export class DataService {
  private reliableChannelService: ReliableChannelService;
  private storeService: StoreService;
  private identityService: IdentityService;

  constructor(node: LightNode) {
    this.reliableChannelService = new ReliableChannelService(node);
    this.storeService = new StoreService(node);
    this.identityService = new IdentityService();
  }

  // Initialize both real-time and historical data
  async initialize(): Promise<{ polls: IPollData[], votes: IVoteData[] }> {
    try {
      // Load historical data first (graceful fallback if unavailable)
      const [historicalPolls, historicalVotes] = await Promise.all([
        this.storeService.loadHistoricalPolls(),
        this.storeService.loadHistoricalVotes()
      ]);

      console.log(`Loaded ${historicalPolls.length} historical polls and ${historicalVotes.length} historical votes`);

      // Setup real-time subscriptions (with automatic buffering)
      await this.reliableChannelService.subscribeToPolls(
        (poll: IPollData) => {
          // Real-time poll handler
          console.log('New poll received in real-time:', poll.id);
        }
      );

      await this.reliableChannelService.subscribeToVotes(
        (vote: IVoteData) => {
          // Real-time vote handler
          console.log('New vote received in real-time for poll:', vote.pollId);
        }
      );

      return {
        polls: historicalPolls,
        votes: historicalVotes
      };
    } catch (error) {
      console.error('DataService initialization error:', error);
      throw error;
    }
  }
}
```

### 2. React Hook Integration

```typescript
// Custom hook for managing synchronized state
export const useDecenVoteSync = (dataService: DataService | null) => {
  const [state, setState] = useState({
    polls: [] as IPollData[],
    votes: [] as IVoteData[],
    loading: true,
    error: null as string | null,
    storeAvailable: true
  });

  useEffect(() => {
    if (!dataService) return;

    const initializeSync = async () => {
      try {
        // Load initial data (historical + setup real-time)
        const initialData = await dataService.initialize();

        setState(prev => ({
          ...prev,
          polls: initialData.polls,
          votes: initialData.votes,
          loading: false
        }));

        // Setup real-time callbacks
        await dataService.subscribeToPolls(
          (newPoll: IPollData) => {
            setState(prev => ({
              ...prev,
              polls: deduplicatePolls([...prev.polls, newPoll])
            }));
          }
        );

        await dataService.subscribeToVotes(
          (newVote: IVoteData) => {
            setState(prev => ({
              ...prev,
              votes: deduplicateVotes([...prev.votes, newVote])
            }));
          }
        );

      } catch (error) {
        console.error('Sync initialization failed:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Sync failed',
          loading: false,
          storeAvailable: !error.message.includes('Store protocol unavailable')
        }));
      }
    };

    initializeSync();

    return () => {
      dataService.cleanup();
    };
  }, [dataService]);

  return state;
};
```

### 3. Deduplication and State Management

```typescript
// Remove duplicate polls (by ID, keep latest)
export const deduplicatePolls = (polls: IPollData[]): IPollData[] => {
  const pollMap = new Map<string, IPollData>();

  polls.forEach(poll => {
    const existing = pollMap.get(poll.id);
    if (!existing || poll.timestamp > existing.timestamp) {
      pollMap.set(poll.id, poll);
    }
  });

  return Array.from(pollMap.values()).sort((a, b) => b.timestamp - a.timestamp);
};

// Remove duplicate votes (by pollId + voterPublicKey, keep first)
export const deduplicateVotes = (votes: IVoteData[]): IVoteData[] => {
  const voteMap = new Map<string, IVoteData>();

  votes
    .sort((a, b) => a.timestamp - b.timestamp) // Sort by timestamp
    .forEach(vote => {
      const key = `${vote.pollId}_${vote.voterPublicKey}`;
      if (!voteMap.has(key)) {
        voteMap.set(key, vote); // Keep first vote only
      }
    });

  return Array.from(voteMap.values());
};
```

## Performance Monitoring and Debugging

### 1. Real-Time Metrics

```typescript
export class SyncMetrics {
  private metrics = {
    pollsReceived: 0,
    votesReceived: 0,
    bufferedMessages: 0,
    storeErrors: 0,
    lastSyncTime: null as Date | null
  };

  recordPollReceived(): void {
    this.metrics.pollsReceived++;
    this.metrics.lastSyncTime = new Date();
  }

  recordVoteReceived(): void {
    this.metrics.votesReceived++;
    this.metrics.lastSyncTime = new Date();
  }

  recordBufferedMessage(): void {
    this.metrics.bufferedMessages++;
  }

  recordStoreError(): void {
    this.metrics.storeErrors++;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  logSummary(): void {
    console.log('📊 Sync Metrics:', {
      'Polls received': this.metrics.pollsReceived,
      'Votes received': this.metrics.votesReceived,
      'Messages buffered': this.metrics.bufferedMessages,
      'Store errors': this.metrics.storeErrors,
      'Last sync': this.metrics.lastSyncTime?.toLocaleTimeString() || 'Never'
    });
  }
}
```

### 2. Debug Logging

```typescript
export const enableDebugLogging = () => {
  // Enable Waku debug logs
  localStorage.setItem('debug', '@waku/*');

  console.log('🔍 Debug logging enabled for Waku protocols');
  console.log('📝 Check browser console for detailed ReliableChannel and Store protocol logs');
};

export const logSyncState = (state: any) => {
  console.group('🔄 DecenVote Sync State');
  console.log('Polls:', state.polls.length);
  console.log('Votes:', state.votes.length);
  console.log('Loading:', state.loading);
  console.log('Store available:', state.storeAvailable);
  if (state.error) console.error('Error:', state.error);
  console.groupEnd();
};
```

## Best Practices

### 1. Initialization Order
1. **WakuService** - Start Waku Light Node
2. **StoreService** - Load historical data (graceful fallback)
3. **ReliableChannelService** - Setup real-time subscriptions
4. **DataProcessor** - Set ready state and flush buffers
5. **UI** - Display synchronized data

### 2. Error Handling
- **Store unavailable**: Continue with real-time data only
- **ReliableChannel errors**: Retry with exponential backoff
- **Network issues**: Graceful degradation with offline mode
- **Data validation**: Filter invalid data, log warnings

### 3. Memory Management
- **Buffer limits**: Prevent unlimited buffering
- **Cleanup subscriptions**: Proper cleanup on unmount
- **Deduplication**: Regular cleanup of seen message IDs

### 4. User Experience
- **Loading states**: Show sync progress
- **Error notifications**: User-friendly error messages
- **Offline mode**: Continue with cached data
- **Real-time indicators**: Show live activity

This real-time synchronization system ensures DecenVote maintains perfect state consistency across all peers while gracefully handling network issues and providing a smooth user experience.